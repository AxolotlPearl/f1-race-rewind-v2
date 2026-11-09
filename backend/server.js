// backend/server.js
// Express backend ของ F1 Race Rewind v2 — frontend (React + Vite) เรียกผ่าน /api/* เท่านั้น
//
// Express ไม่ได้ "แค่ส่งต่อ" ข้อมูล OpenF1 แต่มีหน้าที่จริง 4 อย่าง:
//   1. Proxy + rate limit : OpenF1 จำกัด 3 req/s, 30 req/min ต่อ IP — ทุก request ผ่านคิวกลางตัวเดียว
//                           (lib/rateLimiter.js) ผู้ใช้หลายคนพร้อมกันก็ไม่โดน 429 และไม่ต้องให้ browser ยิงเอง
//   2. Cache              : HashTable module-scope (lib/openf1.js) + header Cache-Control ให้ CDN
//   3. Validate           : ตรวจ year / sessionKey / driverNumber / ช่วงเวลา / คำค้น ก่อนยิง API จริง
//   4. ประมวลผล           : รวม 5 endpoint เป็นไทม์ไลน์เดียว (merge sort), สร้างเส้นสนามจากพิกัด GPS,
//                           ดัชนีค้นหา Trie, สรุปเรื่องราวนักขับ — ส่งให้ React เฉพาะสิ่งที่ต้องแสดง

import express from "express";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { getLocation, getSessionInfo, requestContext, getOpenF1Status } from "./lib/openf1.js";
import { buildTimeline } from "./lib/timeline.js";
import { buildPositionsResponse } from "./lib/positions.js";
import { buildTrackAuto } from "./lib/trackBuilder.js";
import { getFinishedRaces, isValidYear, listYears, FIRST_YEAR, currentYear } from "./lib/races.js";
import { searchRaces, findRace } from "./lib/searchIndex.js";
import { buildDriverStory } from "./lib/driverStory.js";
import { buildStandings } from "./lib/standings.js";
import { buildCalendar } from "./lib/calendar.js";
import { findHighlight } from "./lib/youtube.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRACKS_DIR = path.join(__dirname, "data/tracks");
const MAX_POSITIONS_WINDOW_SECONDS = 60;
const MAX_QUERY_LENGTH = 60;

const app = express();
app.disable("x-powered-by");

// ---------- helpers ----------

/** ให้ CDN/browser cache คำตอบไว้ — ข้อมูลเรซที่จบแล้วไม่เปลี่ยน คนถัดไปได้ทันทีไม่ต้องยิง OpenF1 ซ้ำ */
function setCdnCache(res, seconds) {
  res.set("Cache-Control", `public, max-age=60, s-maxage=${seconds}`);
}

/** ApiError - error ที่ตั้งใจส่งให้ผู้ใช้เห็น (status + ข้อความภาษาไทย) ต่างจาก error ภายในที่ไม่ควรรั่วออกไป */
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** parsePositiveInt - validate พารามิเตอร์ที่ต้องเป็นจำนวนเต็มบวก ไม่งั้นโยน 400 */
function parsePositiveInt(raw, label) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw new ApiError(400, `${label} ไม่ถูกต้อง`);
  return n;
}

/** wrap - ห่อ async handler ให้ error ทุกตัวไปจบที่ error middleware ด้านล่าง (server ไม่ล่มเพราะ promise reject) */
const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

// log สั้น ๆ ทุก request: method, path, status, เวลา — ใช้ดูในคลิปว่า frontend เรียกอะไรบ้าง
app.use((req, res, next) => {
  const started = Date.now();
  res.on("finish", () => {
    if (req.path.startsWith("/api")) console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - started}ms)`);
  });
  next();
});

// context ต่อ request: ถ้าระหว่างตอบต้องใช้ข้อมูลสำรอง (OpenF1 ปิด/ล่ม) lib/openf1.js จะจดเวลาไว้ใน store
// แล้วตอนส่ง JSON เราแนบ header X-Data-Saved-At ให้หน้าเว็บแสดงป้าย และห้าม CDN/browser cache คำตอบสำรองนี้
app.use((req, res, next) => {
  const store = { staleSince: null };
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (store.staleSince) {
      res.set("X-Data-Saved-At", store.staleSince);
      res.set("Cache-Control", "no-store");
    }
    return originalJson(body);
  };
  requestContext.run(store, next);
});

// ---------- routes ----------

app.get("/api/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// สถานะ OpenF1 ตอนนี้ — หน้าเว็บถามทุก 1 นาทีเพื่อแสดง/ซ่อนแถบแจ้งเตือน "มีแข่งสด OpenF1 ปิดชั่วคราว"
app.get(
  "/api/status",
  wrap(async (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(await getOpenF1Status());
  })
);

app.get("/api/years", (req, res) => {
  setCdnCache(res, 3600);
  res.json({ years: listYears() });
});

app.get(
  "/api/races",
  wrap(async (req, res) => {
    const year = Number(req.query.year);
    if (!isValidYear(year)) throw new ApiError(400, `ต้องระบุ year เป็นปีที่ถูกต้อง (${FIRST_YEAR}–${currentYear()})`);
    const races = await getFinishedRaces(year);
    // ปีปัจจุบันต้อง refresh บ่อยให้เรซที่เพิ่งจบโผล่เร็ว ปีที่จบไปแล้ว cache ได้นาน
    setCdnCache(res, year === currentYear() ? 300 : 86400);
    res.json({ year, races });
  })
);

// ค้นหาเรซข้ามทุกปีด้วย Trie (prefix) — ใช้กับช่องค้นหาแบบ autocomplete ในหน้าแรก
app.get(
  "/api/search",
  wrap(async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    if (q.length === 0) throw new ApiError(400, "กรุณาพิมพ์คำค้นหา");
    if (q.length > MAX_QUERY_LENGTH) throw new ApiError(400, `คำค้นยาวเกิน ${MAX_QUERY_LENGTH} ตัวอักษร`);
    const limit = Math.min(Number(req.query.limit) || 8, 20);
    const { total, results } = await searchRaces(q, limit);
    setCdnCache(res, 300);
    res.json({ q, total, results });
  })
);

// ตารางคะแนนทั้งฤดูกาล (นักขับ + ทีม + ผลรายสนาม) — หน้า Scoreboard เปิดบัตรนักขับ/ทีมจากข้อมูลชุดนี้ได้ทันที
app.get(
  "/api/standings",
  wrap(async (req, res) => {
    const year = Number(req.query.year);
    if (!isValidYear(year)) throw new ApiError(400, `ต้องระบุ year เป็นปีที่ถูกต้อง (${FIRST_YEAR}–${currentYear()})`);
    const standings = await buildStandings(year);
    setCdnCache(res, year === currentYear() ? 300 : 86400);
    res.json(standings);
  })
);

// ปฏิทินฤดูกาล + สนามต่อไป (นับถอยหลังในหน้าแรก) — สถานะคำนวณจากเวลา server ทุก request
app.get(
  "/api/calendar",
  wrap(async (req, res) => {
    const year = req.query.year == null ? currentYear() : Number(req.query.year);
    if (!isValidYear(year)) throw new ApiError(400, `ต้องระบุ year เป็นปีที่ถูกต้อง (${FIRST_YEAR}–${currentYear()})`);
    const calendar = await buildCalendar(year);
    // ปีปัจจุบัน cache สั้น (สถานะ live/next เปลี่ยนได้) ปีเก่า cache นาน
    setCdnCache(res, year === currentYear() ? 60 : 86400);
    res.json(calendar);
  })
);

// คลิปไฮไลต์ YouTube ของเรซ — Express ถือ API key (ไม่ส่งถึง browser) และ cache ผลประหยัดโควตา
app.get(
  "/api/race/:sessionKey/highlight",
  wrap(async (req, res) => {
    const sessionKey = parsePositiveInt(req.params.sessionKey, "session key");
    // ปกติหาข้อมูลเรซจากดัชนีของเราเอง แต่ถ้า OpenF1 ใช้ไม่ได้ (เช่นช่วงแข่งสด) ให้ใช้ชื่อเรซที่หน้าเว็บส่งมาแทน
    // (validate ทุกค่า — ใช้เป็นแค่คำค้น YouTube จึงไม่มีผลกับข้อมูลอื่นในระบบ)
    let race = await findRace(sessionKey).catch(() => null);
    if (!race) {
      const year = Number(req.query.year);
      const meetingName = String(req.query.meeting ?? "").trim();
      const sessionName = req.query.session === "Sprint" ? "Sprint" : "Race";
      const dateStart = new Date(String(req.query.date ?? ""));
      if (!isValidYear(year) || meetingName.length === 0 || meetingName.length > 80 || Number.isNaN(dateStart.getTime())) {
        throw new ApiError(404, "ไม่พบเรซนี้ (หรือยังแข่งไม่จบ)");
      }
      race = { sessionKey, year, meetingName, sessionName, dateStart: dateStart.toISOString() };
    }
    const highlight = await findHighlight(race);
    setCdnCache(res, highlight.available ? 86400 : 600);
    res.json(highlight);
  })
);

// ข้อมูลหัวเรื่องของเรซเดียว (ชื่อรายการ/สนาม/เวลา) — ให้หน้าเรซที่เปิดจากลิงก์ตรง/รีเฟรชรู้ว่าเป็นเรซอะไร
app.get(
  "/api/race/:sessionKey/info",
  wrap(async (req, res) => {
    const sessionKey = parsePositiveInt(req.params.sessionKey, "session key");
    const race = await findRace(sessionKey);
    if (!race) throw new ApiError(404, "ไม่พบเรซนี้ (หรือยังแข่งไม่จบ)");
    setCdnCache(res, 3600);
    res.json(race);
  })
);

app.get(
  "/api/race/:sessionKey",
  wrap(async (req, res) => {
    const sessionKey = parsePositiveInt(req.params.sessionKey, "session key");
    const timeline = await buildTimeline(sessionKey);
    setCdnCache(res, 3600);
    res.json(timeline);
  })
);

// เรื่องราวของนักขับ 1 คนในเรซ (ประมวลผลที่ server ส่งเฉพาะ event ที่เกี่ยวข้อง)
app.get(
  "/api/race/:sessionKey/driver/:driverNumber",
  wrap(async (req, res) => {
    const sessionKey = parsePositiveInt(req.params.sessionKey, "session key");
    const driverNumber = parsePositiveInt(req.params.driverNumber, "หมายเลขนักขับ");
    const timeline = await buildTimeline(sessionKey);
    const story = buildDriverStory(timeline, driverNumber);
    if (!story) throw new ApiError(404, `ไม่พบนักขับหมายเลข ${driverNumber} ในเรซนี้`);
    setCdnCache(res, 3600);
    res.json(story);
  })
);

// เส้นสนาม: ใช้ไฟล์ที่ precompute ไว้ถ้ามี (เร็ว ไม่ใช้โควตา OpenF1) ไม่งั้นสร้างสดจากพิกัดจริง
// งานแรก browser ต้องลองไฟล์ static ก่อน แล้วค่อยยิงอีก endpoint ถ้า 404 — ตอนนี้ Express ตัดสินใจแทนใน request เดียว
app.get(
  "/api/track/:sessionKey",
  wrap(async (req, res) => {
    const sessionKey = parsePositiveInt(req.params.sessionKey, "session key");
    const [session] = await getSessionInfo(sessionKey);
    if (!session) throw new ApiError(404, "ไม่พบเรซนี้");

    try {
      const file = await readFile(path.join(TRACKS_DIR, `${Number(session.circuit_key)}.json`), "utf8");
      setCdnCache(res, 30 * 86400);
      res.type("json").send(file);
      return;
    } catch {
      // ไม่มีไฟล์ precompute (สนามใหม่) → สร้างสดด้านล่าง
    }

    const track = await buildTrackAuto(sessionKey);
    if (!track) {
      setCdnCache(res, 600);
      throw new ApiError(404, "ยังสร้างเส้นสนามของเรซนี้ไม่ได้");
    }
    setCdnCache(res, 30 * 86400);
    res.json(track);
  })
);

app.get(
  "/api/positions/:sessionKey",
  wrap(async (req, res) => {
    const sessionKey = parsePositiveInt(req.params.sessionKey, "session key");
    const fromIso = req.query.from;
    const toIso = req.query.to;
    const from = new Date(fromIso);
    const to = new Date(toIso);
    if (!fromIso || !toIso || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new ApiError(400, "ต้องระบุ from และ to เป็นวันที่ ISO ที่ถูกต้อง");
    }
    const windowSeconds = (to.getTime() - from.getTime()) / 1000;
    if (windowSeconds <= 0 || windowSeconds > MAX_POSITIONS_WINDOW_SECONDS) {
      throw new ApiError(400, `ช่วงเวลาต้องมากกว่า 0 และไม่เกิน ${MAX_POSITIONS_WINDOW_SECONDS} วินาที`);
    }

    // client ยกเลิก (กระโดดเวลา/เปลี่ยนเรซ) ระหว่างรอคิว → ไม่ต้องยิง OpenF1 จริง ประหยัดโควตา
    let cancelled = false;
    res.on("close", () => {
      if (!res.writableFinished) cancelled = true;
    });

    // ก้อนที่โหลดล่วงหน้า (header X-Prefetch) ได้ priority ต่ำ — request ที่ผู้ใช้รออยู่ไปก่อน
    const priority = req.get("x-prefetch") === "1" ? "low" : "high";
    try {
      const rawPoints = await getLocation(sessionKey, { fromIso, toIso, priority, isCancelled: () => cancelled });
      const positions = buildPositionsResponse(rawPoints, windowSeconds);
      setCdnCache(res, 86400);
      res.json({ sessionKey, from: fromIso, to: toIso, positions });
    } catch (err) {
      if (err.name === "AbortError") return; // client ไปแล้ว ไม่ต้องตอบ
      throw err;
    }
  })
);

// ---------- 404 + error handling ----------

app.use("/api", (req, res) => {
  res.status(404).json({ error: "ไม่พบ endpoint นี้" });
});

// error ทุกตัวจบที่นี่: ApiError ส่งข้อความตามที่ตั้งใจ, error อื่น (OpenF1 ล่ม/timeout) ตอบ 502
// พร้อมข้อความที่ผู้ใช้เข้าใจ — server ไม่ล่ม และไม่รั่วรายละเอียดภายในออกไป
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (res.headersSent) return;
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message });
  }
  // OpenF1 ปิด API ช่วงมีการแข่งสด และยังไม่มีข้อมูลสำรองบนดิสก์ของ request นี้ → บอกสาเหตุตรง ๆ (503 = ชั่วคราว)
  if (err.liveLockout) {
    return res.status(503).json({ error: "ตอนนี้มีการแข่ง F1 สดอยู่ ข้อมูลนี้จะใช้ได้หลังจบเซสชัน" });
  }
  console.error(err.message);
  res.status(502).json({ error: "โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง" });
});

// ถ้ามี frontend ที่ build แล้ว (frontend/dist) ให้ Express เสิร์ฟด้วย — ใช้ตอนรันแบบ production เครื่องเดียว
const DIST_DIR = path.join(__dirname, "../frontend/dist");
app.use(express.static(DIST_DIR));
app.get(/^\/(?!api\/).*/, (req, res, next) => {
  res.sendFile(path.join(DIST_DIR, "index.html"), (err) => err && next());
});

if (process.env.VERCEL === undefined) {
  const port = process.env.PORT || 3001;
  app.listen(port, () => {
    console.log(`F1 Race Rewind backend กำลังรันที่ http://localhost:${port}`);
  });
}

export default app;
