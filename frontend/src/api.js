// src/api.js
// ทุกการเรียกข้อมูลของ React วิ่งไปที่ Express (/api/*) เท่านั้น — ไม่เรียก OpenF1 ตรงจาก browser
// มี cache ใน localStorage อีกชั้น: เรซที่จบไปนานแล้วข้อมูลไม่เปลี่ยน เปิดซ้ำได้ทันทีไม่ต้องรอ network

const CACHE_PREFIX = "f1rr:v5:";
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

function cacheGet(key, maxAgeMs = Infinity) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { savedAt, data } = JSON.parse(raw);
    return Date.now() - savedAt <= maxAgeMs ? data : null;
  } catch {
    return null;
  }
}

function cacheSet(key, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // localStorage เต็ม/ปิดอยู่ — ไม่เป็นไร แค่ไม่ได้ cache
  }
}

/** ApiError ฝั่ง client: เก็บ status ไว้ให้ UI แยก "ไม่พบ (404)" ออกจาก "ระบบมีปัญหา" ได้ */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// ---------- แจ้ง StatusBanner เมื่อได้ "ข้อมูลสำรอง" หรือเจอ OpenF1 ปิด ----------
// ใช้ observer แบบง่าย: component ที่สนใจ subscribe แล้วได้ event ทุกครั้งที่มีคำตอบแบบนี้ (ไม่ต้องส่ง props ผ่านทุกหน้า)
const listeners = [];

/** subscribeApiEvents - คืนฟังก์ชันยกเลิก (ใช้เป็น cleanup ของ useEffect ได้ตรง ๆ) */
export function subscribeApiEvents(listener) {
  listeners.push(listener);
  return () => {
    const i = listeners.indexOf(listener);
    if (i >= 0) listeners.splice(i, 1);
  };
}

function emit(event) {
  for (const listener of listeners.slice()) listener(event);
}

export async function fetchJson(url, { signal, headers } = {}) {
  let res;
  try {
    res = await fetch(url, { signal, headers });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new ApiError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่", 0);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 503) emit({ type: "lockout" }); // OpenF1 ปิดช่วงแข่งสด และไม่มีข้อมูลสำรองของ request นี้
    // ไม่มีข้อความจาก Express เลย + status 5xx = ไม่ได้คุยกับ Express ของเรา (backend ดับ/proxy ต่อไม่ติด)
    const fallback = res.status >= 500 ? "ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้ง" : "โหลดข้อมูลไม่สำเร็จ";
    throw new ApiError(body.error || fallback, res.status);
  }
  // server ใช้ข้อมูลสำรองตอบ (OpenF1 ปิด/ล่ม) → บอกแถบสถานะว่าข้อมูลบนจอบันทึกไว้เมื่อไหร่
  const savedAt = res.headers.get("X-Data-Saved-At");
  if (savedAt) emit({ type: "stale", savedAt });
  return res.json();
}

/** cached - ห่อ fetch ด้วย localStorage cache ตามอายุที่กำหนด */
async function cached(key, maxAgeMs, url, signal) {
  const hit = cacheGet(key, maxAgeMs);
  if (hit) return hit;
  const data = await fetchJson(url, { signal });
  cacheSet(key, data);
  return data;
}

const isCurrentSeason = (year) => year >= new Date().getFullYear();
// เรซที่เพิ่งจบไม่ถึงวัน OpenF1 อาจยังประมวลผลไม่ครบ อย่าเก็บถาวร
const raceMaxAge = (dateEnd) => (dateEnd && Date.now() - new Date(dateEnd).getTime() > DAY_MS ? Infinity : 10 * MINUTE_MS);

export const api = {
  years: (signal) => cached("years", DAY_MS, "/api/years", signal),
  races: (year, signal) => cached(`races:${year}`, isCurrentSeason(year) ? 10 * MINUTE_MS : Infinity, `/api/races?year=${year}`, signal),
  search: (q, signal) => fetchJson(`/api/search?q=${encodeURIComponent(q)}&limit=8`, { signal }),
  standings: (year, signal) => cached(`standings:${year}`, isCurrentSeason(year) ? 10 * MINUTE_MS : Infinity, `/api/standings?year=${year}`, signal),
  // ปฏิทิน: ไม่ cache ใน localStorage — สถานะ "สนามต่อไป/กำลังแข่ง" ต้องสดเสมอ
  calendar: (year, signal) => fetchJson(`/api/calendar${year ? `?year=${year}` : ""}`, { signal }),
  // เก็บใน localStorage เฉพาะตอน "เจอคลิป" — ถ้ายังไม่เจอ/ยังไม่ตั้ง key ต้องถามใหม่ทุกครั้ง
  // ส่งชื่อเรซไปด้วย เผื่อ server หาเรซจาก OpenF1 ไม่ได้ (เช่นช่วงที่ OpenF1 ปิด API ระหว่างแข่งสด)
  highlight: async (race, signal) => {
    const key = `hl:${race.sessionKey}`;
    const hit = cacheGet(key, DAY_MS);
    if (hit) return hit;
    const q = new URLSearchParams({ year: race.year, meeting: race.meetingName, session: race.sessionName, date: race.dateStart });
    const data = await fetchJson(`/api/race/${race.sessionKey}/highlight?${q}`, { signal });
    if (data.available) cacheSet(key, data);
    return data;
  },
  raceInfo: (sessionKey, signal) => cached(`info:${sessionKey}`, DAY_MS, `/api/race/${sessionKey}/info`, signal),
  timeline: (sessionKey, dateEnd, signal) => cached(`race:${sessionKey}`, raceMaxAge(dateEnd), `/api/race/${sessionKey}`, signal),
  driver: (sessionKey, driverNumber, signal) =>
    cached(`driver:${sessionKey}:${driverNumber}`, DAY_MS, `/api/race/${sessionKey}/driver/${driverNumber}`, signal),
  track: (sessionKey, signal) => fetchJson(`/api/track/${sessionKey}`, { signal }),
  health: (signal) => fetchJson("/api/health", { signal }),
  status: (signal) => fetchJson("/api/status", { signal }),
  positions: (sessionKey, fromMs, toMs, { signal, prefetch = false } = {}) => {
    // ขอบเวลาถูกจัดให้ตรง "ตาราง" เสมอ (ดู CHUNK_MS ใน MapPlayer) URL ซ้ำได้ → CDN/cache ตอบได้
    const from = encodeURIComponent(new Date(fromMs).toISOString());
    const to = encodeURIComponent(new Date(toMs).toISOString());
    const headers = prefetch ? { "X-Prefetch": "1" } : undefined;
    return fetchJson(`/api/positions/${sessionKey}?from=${from}&to=${to}`, { signal, headers });
  },
};
