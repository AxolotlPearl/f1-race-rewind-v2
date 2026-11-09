// lib/openf1.js
// Client เรียก OpenF1 API จริงทุกครั้งผ่าน rateLimiter (คุม 3 req/s, 30 req/min)
// พร้อม cache ชั้นที่ 1 แบบ module-scope (best effort — จะหายเมื่อ serverless function เย็นลง
// แต่ระหว่างที่ instance ยังอุ่นอยู่จะช่วยลดการยิงซ้ำ)
// ข้อมูลเรซที่แข่งจบไปแล้วไม่เปลี่ยน cache ถาวรได้ แต่ "รายชื่อเรซของปีปัจจุบัน" ต้องหมดอายุได้
// ไม่งั้นเรซใหม่ที่เพิ่งแข่งจบจะไม่โผล่จนกว่า instance จะเย็นลงเอง

import { rateLimiter } from "./rateLimiter.js";
import { HashTable } from "./HashTable.js";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { AsyncLocalStorage } from "node:async_hooks";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------- cache ชั้นดิสก์ (stale-on-error) ----------
// ช่วงที่มีเซสชัน F1 กำลังแข่งสด OpenF1 ปิด API ทั้งหมด (รวมข้อมูลย้อนหลัง) สำหรับผู้ใช้ที่ไม่มี key แบบเสียเงิน
// → ตอบ 401 จนกว่าเซสชันจบ (เจอจริงระหว่าง São Paulo GP 2026) ถ้าไม่มีสำรอง ทั้งเว็บใช้ไม่ได้ช่วงนั้น
// จึงบันทึกทุกคำตอบที่สำเร็จลงดิสก์ แล้วถ้ายิงจริงไม่สำเร็จ (401/5xx/เน็ตหลุด) ใช้ข้อมูลล่าสุดที่เคยได้แทน
// (ข้อมูลเรซที่จบแล้วไม่เปลี่ยน ข้อมูลเก่าจึงยังถูกต้อง) — เก็บนอก git ใน backend/.cache/
// บน Vercel ไฟล์ของโปรเจกต์เป็น read-only เขียนได้แค่ /tmp
const DISK_DIR = process.env.VERCEL
  ? "/tmp/f1rr-cache/openf1"
  : path.join(path.dirname(fileURLToPath(import.meta.url)), "../.cache/openf1");

function diskFile(apiPath) {
  return path.join(DISK_DIR, `${createHash("sha1").update(apiPath).digest("hex")}.json`);
}

async function diskGet(apiPath) {
  try {
    return JSON.parse(await readFile(diskFile(apiPath), "utf8"));
  } catch {
    return null;
  }
}

function diskSet(apiPath, data) {
  // ไม่ต้องรอเขียนเสร็จ — ช้าหรือพังก็แค่ไม่มีสำรอง ไม่กระทบคำตอบปัจจุบัน (Vercel เขียนดิสก์ไม่ได้ก็เงียบไป)
  mkdir(DISK_DIR, { recursive: true })
    .then(() => writeFile(diskFile(apiPath), JSON.stringify({ path: apiPath, savedAt: new Date().toISOString(), data })))
    .catch(() => {});
}

// ---------- บอกหน้าเว็บว่า "คำตอบนี้ใช้ข้อมูลสำรอง" ----------
// server.js เปิด context ต่อ request ด้วย AsyncLocalStorage ({ staleSince }) — ถ้าระหว่างตอบ request นั้นต้องใช้ข้อมูลสำรอง
// จะจดเวลาที่บันทึกข้อมูลสำรองไว้ แล้ว server.js ใส่ header X-Data-Saved-At ให้หน้าเว็บแสดงป้าย "ข้อมูลที่บันทึกไว้เมื่อ ..."
// (ไม่ต้องส่งค่าผ่านทุกฟังก์ชันตั้งแต่ route ลงมาถึงตรงนี้)
export const requestContext = new AsyncLocalStorage();

function markStale(savedAt) {
  const store = requestContext.getStore();
  if (!store) return;
  if (!store.staleSince || savedAt < store.staleSince) store.staleSince = savedAt;
}

// ---------- สถานะ OpenF1 ล่าสุด (หน้าเว็บถาม /api/status เพื่อแสดงแถบแจ้งเตือน) ----------
let lastSuccessAt = 0;
let lastLockoutAt = 0;
let lastFailureAt = 0;
let lastProbeAt = 0;
const STATUS_FRESH_MS = 60 * 1000;

// circuit breaker: เจอ "ปิดช่วงแข่งสด" แล้ว ไม่ต้องยิงซ้ำทุก request (แต่ละตัวต้องรอคิว rate limit แล้วโดน 401 อยู่ดี
// ทำให้หน้าเว็บค้างนาน) — 60 วินาทีถัดไปตอบจากสำรอง/แจ้ง lockout ทันที แล้วค่อยลองยิงจริงอีกครั้ง
const LOCKOUT_PAUSE_MS = 60 * 1000;
let lockoutUntil = 0;

/** OpenF1Error - เก็บ status + บอกว่าเป็นการปิด API ช่วงแข่งสดหรือไม่ (server.js แปลงเป็นข้อความที่ผู้ใช้เข้าใจ) */
export class OpenF1Error extends Error {
  constructor(status, apiPath, body) {
    super(`OpenF1 API ตอบ ${status} สำหรับ ${apiPath}: ${body}`);
    this.status = status;
    this.liveLockout = status === 401 && /live f1 session/i.test(body);
  }
}

const BASE_URL = "https://api.openf1.org/v1";
const CURRENT_SEASON_TTL_MS = 10 * 60 * 1000;

// cache module-scope: key = path string เต็ม, value = { data, expiresAt }
const cache = new HashTable(64);

const MAX_RETRIES = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isCurrentOrFutureSeason(year) {
  return Number(year) >= new Date().getUTCFullYear();
}

/**
 * @param {string} path
 * @param {{ ttlMs?: number, useCache?: boolean, priority?: "high"|"low", isCancelled?: () => boolean }} options
 *   ttlMs: อายุ cache (ค่าเริ่มต้นไม่หมดอายุ), useCache: false = ไม่เก็บลง cache เลย
 *   priority/isCancelled: ส่งต่อให้ rateLimiter (ดูคำอธิบายใน lib/rateLimiter.js)
 */
async function fetchOpenF1(path, { ttlMs = Infinity, useCache = true, priority = "high", isCancelled } = {}) {
  // ไม่ลบ entry ที่หมดอายุทิ้ง — เก็บไว้เป็นสำรองถ้ายิงใหม่ไม่สำเร็จ
  const memEntry = useCache ? cache.get(path) : undefined;
  if (memEntry && memEntry.expiresAt > Date.now()) return memEntry.data; // ยังไม่หมดอายุ = ข้อมูลปกติ ไม่ใช่สำรอง

  let data;
  try {
    if (Date.now() < lockoutUntil) throw new OpenF1Error(401, path, "Live F1 session in progress (paused locally)");
    data = await requestOpenF1(path, { priority, isCancelled });
    lastSuccessAt = Date.now();
  } catch (err) {
    if (err.name === "AbortError") throw err;
    if (err.liveLockout) {
      lastLockoutAt = Date.now();
      if (Date.now() >= lockoutUntil) lockoutUntil = Date.now() + LOCKOUT_PAUSE_MS;
    } else lastFailureAt = Date.now();
    if (!useCache) throw err;
    const stale = memEntry ?? (await diskGet(path));
    if (!stale) throw err;
    markStale(stale.savedAt);
    return stale.data;
  }

  if (useCache) {
    const savedAt = new Date().toISOString();
    cache.set(path, { data, savedAt, expiresAt: Date.now() + ttlMs });
    diskSet(path, data);
  }
  return data;
}

/**
 * getOpenF1Status - "ok" | "locked" (ปิดช่วงแข่งสด) | "down" (ล่ม/เน็ตหลุด) + จำนวนข้อมูลสำรองบนดิสก์
 * ใช้ผลจาก request จริงล่าสุดก่อน ถ้าไม่มีสัญญาณใหม่เกิน 60 วินาที ค่อยยิงเช็คเบา ๆ 1 ครั้ง (จำกัดไม่เกินนาทีละครั้ง)
 */
export async function getOpenF1Status() {
  const now = Date.now();
  const latestSignal = Math.max(lastSuccessAt, lastLockoutAt, lastFailureAt);
  if (now - latestSignal > STATUS_FRESH_MS && now - lastProbeAt > STATUS_FRESH_MS && now >= lockoutUntil) {
    lastProbeAt = now;
    try {
      await requestOpenF1("/sessions?session_key=latest", { priority: "low" });
      lastSuccessAt = Date.now();
    } catch (err) {
      if (err.liveLockout) {
        lastLockoutAt = Date.now();
        lockoutUntil = Date.now() + LOCKOUT_PAUSE_MS;
      } else lastFailureAt = Date.now();
    }
  }

  let state = "ok";
  if (lastLockoutAt > lastSuccessAt) state = "locked";
  else if (lastFailureAt > lastSuccessAt) state = "down";

  let savedEntries = 0;
  try {
    savedEntries = (await readdir(DISK_DIR)).length;
  } catch {
    savedEntries = 0;
  }
  return {
    openf1: state,
    lastSuccessAt: lastSuccessAt ? new Date(lastSuccessAt).toISOString() : null,
    savedEntries,
  };
}

function requestOpenF1(path, { priority, isCancelled }) {
  return rateLimiter.enqueue(async () => {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const res = await fetch(`${BASE_URL}${path}`);

      // OpenF1 ตอบ 404 "No results found" เมื่อไม่มีข้อมูลประเภทนั้นสำหรับเรซนี้ (พบจริงกับ /pit
      // ของเรซ 2023 Bahrain ตอนสำรวจเฟส 0) ต้อง treat เป็น "ไม่มีข้อมูล" ไม่ใช่ error
      if (res.status === 404) return [];

      // rate limit เป็น resource กลางที่ทุกคนบนอินเทอร์เน็ตแชร์กัน ต่อให้ scheduler ของเราคุมดีแล้ว
      // ก็ยังมีโอกาสชน 429 ได้จาก jitter/ผู้ใช้คนอื่น จึง retry แบบ backoff ไม่ throw ทันที
      if (res.status === 429 && attempt < MAX_RETRIES) {
        const retryAfterHeader = Number(res.headers.get("retry-after"));
        const backoffMs = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0 ? retryAfterHeader * 1000 : 400 * (attempt + 1);
        await sleep(backoffMs);
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new OpenF1Error(res.status, path, text);
      }

      return res.json();
    }
    throw new Error(`OpenF1 API ยัง 429 ต่อเนื่องหลัง retry ${MAX_RETRIES} ครั้งสำหรับ ${path}`);
  }, { priority, isCancelled });
}

export function getSessions(year, sessionType = "Race") {
  const ttlMs = isCurrentOrFutureSeason(year) ? CURRENT_SEASON_TTL_MS : Infinity;
  return fetchOpenF1(`/sessions?year=${encodeURIComponent(year)}&session_type=${encodeURIComponent(sessionType)}`, { ttlMs });
}

/** ทุก session ของปี (ซ้อม/ควอลิฟาย/สปรินต์/เรซ) — ใช้ทำปฏิทินที่บอกเวลาควอลิฟายและสปรินต์ด้วย */
export function getAllSessions(year) {
  const ttlMs = isCurrentOrFutureSeason(year) ? CURRENT_SEASON_TTL_MS : Infinity;
  return fetchOpenF1(`/sessions?year=${encodeURIComponent(year)}`, { ttlMs });
}

export function getMeetings(year) {
  const ttlMs = isCurrentOrFutureSeason(year) ? CURRENT_SEASON_TTL_MS : Infinity;
  return fetchOpenF1(`/meetings?year=${encodeURIComponent(year)}`, { ttlMs });
}

export function getDrivers(sessionKey) {
  return fetchOpenF1(`/drivers?session_key=${encodeURIComponent(sessionKey)}`);
}

export function getOvertakes(sessionKey) {
  return fetchOpenF1(`/overtakes?session_key=${encodeURIComponent(sessionKey)}`);
}

export function getPit(sessionKey) {
  return fetchOpenF1(`/pit?session_key=${encodeURIComponent(sessionKey)}`);
}

export function getRaceControl(sessionKey) {
  return fetchOpenF1(`/race_control?session_key=${encodeURIComponent(sessionKey)}`);
}

export function getSessionResult(sessionKey) {
  return fetchOpenF1(`/session_result?session_key=${encodeURIComponent(sessionKey)}`);
}

/**
 * ตารางคะแนนทั้งฤดูกาล: OpenF1 กรองด้วยช่วง session_key ได้ (>=, <=) จึงดึงผลทุก session ของปีได้ใน
 * request เดียว แทนการยิงทีละเรซ ~30 ครั้ง (ซึ่งกินโควตา 30 req/นาทีหมดในครั้งเดียว ผู้ใช้ต้องรอ 1 นาที+)
 * ผลที่ได้มี session ประเภทอื่น (ซ้อม/ควอลิฟาย) ปนมาด้วย — ฝั่ง lib/standings.js กรองเหลือแค่ Race/Sprint
 */
export function getSessionResultRange(fromKey, toKey, ttlMs) {
  return fetchOpenF1(`/session_result?session_key>=${Number(fromKey)}&session_key<=${Number(toKey)}`, { ttlMs });
}

/** นักขับของทุก session ในช่วง — ต้องรู้ทีม "ของเรซนั้น" เพราะนักขับย้ายทีมกลางฤดูกาลได้ */
export function getDriversRange(fromKey, toKey, ttlMs) {
  return fetchOpenF1(`/drivers?session_key>=${Number(fromKey)}&session_key<=${Number(toKey)}`, { ttlMs });
}

// ใช้ตอนสร้างเส้นสนาม (ทั้ง scripts/build-track.js แบบ offline และ /api/track สำหรับสนามใหม่ที่ยัง
// ไม่มีไฟล์ precompute) เพื่อรู้ circuit_key/date_start ของเรซที่จะดึงพิกัดมาสร้างเส้นสนาม
export function getSessionInfo(sessionKey) {
  return fetchOpenF1(`/sessions?session_key=${encodeURIComponent(sessionKey)}`);
}

/**
 * getLocation - พิกัด x,y ของรถในช่วงเวลาที่ขอ (3.7 Hz ต่อนักขับ)
 * ต้อง encodeURIComponent ค่า ISO date เพราะมี "+00:00"/":" ที่ query string ตีความผิดได้ถ้าไม่ encode
 */
export function getLocation(sessionKey, { driverNumber, fromIso, toIso, priority = "high", isCancelled } = {}) {
  const params = new URLSearchParams();
  params.set("session_key", sessionKey);
  if (driverNumber != null) params.set("driver_number", driverNumber);
  // ต่อ query string ที่มี operator (>=, <=) เองเพราะ URLSearchParams จะ encode "=" ตัวหลังทับ
  const base = `/location?${params.toString()}`;
  const dateFilter = `&date>=${encodeURIComponent(fromIso)}&date<=${encodeURIComponent(toIso)}`;
  // ไม่ cache: ตอนเล่นแผนที่ยาว ๆ แต่ละหน้าต่างเวลาไม่ซ้ำกันเลย เก็บไว้มีแต่บวม memory ของ instance
  return fetchOpenF1(base + dateFilter, { useCache: false, priority, isCancelled });
}

// ---------- ข้อมูลสำหรับ Race Leaderboard (ข้อมูลเรซที่จบแล้วไม่เปลี่ยน จึง cache ได้ตลอด) ----------

/** เวลาเริ่มแต่ละรอบของนักขับทุกคน (~1,000 แถวต่อเรซ) — ใช้นับรอบปัจจุบัน + หารอบเร็วสุด */
export function getLaps(sessionKey) {
  return fetchOpenF1(`/laps?session_key=${encodeURIComponent(sessionKey)}`);
}

/** ช่วงยางแต่ละชุด (lap_start–lap_end, compound) */
export function getStints(sessionKey) {
  return fetchOpenF1(`/stints?session_key=${encodeURIComponent(sessionKey)}`);
}

/** อันดับที่เปลี่ยน (ส่งมาเฉพาะตอนเปลี่ยน ~300 แถวต่อเรซ) */
export function getPositionChanges(sessionKey) {
  return fetchOpenF1(`/position?session_key=${encodeURIComponent(sessionKey)}`);
}

/** ช่องว่างเวลากับผู้นำ/คันหน้า ทุก ~4 วินาที (~19,000 แถว ~2.6 MB) — Express ย่อก่อนส่งให้หน้าเว็บ */
export function getIntervals(sessionKey) {
  // ไม่เก็บก้อนดิบ 2.6 MB ไว้ใน cache — lib/leaderboard.js เก็บผลที่ย่อแล้วแทน
  return fetchOpenF1(`/intervals?session_key=${encodeURIComponent(sessionKey)}`, { useCache: false });
}
