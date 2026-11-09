// lib/leaderboard.js
// ข้อมูล Race Leaderboard ข้างแผนที่ (อันดับ / ช่องว่างเวลา / ยาง / เข้าพิท / รอบเร็วสุด / ออกจากการแข่ง)
// ทุกอย่างผูกกับ "เวลา" เพื่อให้หน้าเว็บหาค่า ณ เวลาที่แผนที่เล่นอยู่ได้ด้วย binary search
//
// Express ทำหน้าที่ "ย่อข้อมูล" ก่อนส่ง:
//   /intervals ดิบ ~19,000 แถว (~2.6 MB) → เก็บทุก ~6 วินาทีต่อคัน + ทุกครั้งที่สถานะเปลี่ยน (เช่น "+1 LAP")
//   วันที่ ISO ยาว ๆ → วินาทีนับจาก t0 (ตัวเลขสั้น) และจัดกลุ่มตามนักขับใน HashTable
// ผลลัพธ์ cache ต่อเรซใน HashTable (ข้อมูลเรซที่จบแล้วไม่เปลี่ยน)

import { getLaps, getStints, getPositionChanges, getIntervals, getPit, getSessionResult } from "./openf1.js";
import { HashTable } from "./HashTable.js";
import { mergeSort } from "./sort.js";

const INTERVAL_STEP_SECONDS = 6;
const COMPOUND_LETTER = { SOFT: "S", MEDIUM: "M", HARD: "H", INTERMEDIATE: "I", WET: "W" };
const cache = new HashTable(16);

const round = (v, digits) => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};

/** groupByDriver - แยกแถวตาม driver_number ด้วย HashTable แล้วคืนเป็น object สำหรับส่ง JSON. O(n) */
function groupBy(rows, mapRow) {
  const table = new HashTable(32);
  for (const r of rows) {
    const key = r.driver_number;
    if (!table.has(key)) table.set(key, []);
    const v = mapRow(r);
    if (v != null) table.get(key).push(v);
  }
  const out = {};
  for (const key of table.keys()) out[key] = table.get(key);
  return out;
}

export function compactIntervals(rows, t0) {
  const sorted = mergeSort(rows, (a, b) => Date.parse(a.date) - Date.parse(b.date));
  const last = new HashTable(32); // driver -> { off, gapKind }
  const kept = [];
  for (const r of sorted) {
    const off = (Date.parse(r.date) - t0) / 1000;
    const gapKind = typeof r.gap_to_leader === "string" ? r.gap_to_leader : r.gap_to_leader == null ? "null" : "num";
    const prev = last.get(r.driver_number);
    if (prev && off - prev.off < INTERVAL_STEP_SECONDS && prev.gapKind === gapKind) continue;
    last.set(r.driver_number, { off, gapKind });
    kept.push(r);
  }
  return groupBy(kept, (r) => [
    round((Date.parse(r.date) - t0) / 1000, 1),
    typeof r.gap_to_leader === "number" ? round(r.gap_to_leader, 3) : r.gap_to_leader ?? null,
    typeof r.interval === "number" ? round(r.interval, 3) : r.interval ?? null,
  ]);
}

/** รอบเร็วสุด "ณ เวลานั้น": ไล่รอบตามเวลาที่จบรอบ เก็บเฉพาะตอนที่ทำลายสถิติ → หน้าเว็บหา holder ด้วย binary search */
export function fastestLapRecords(laps, t0) {
  const finished = laps
    .filter((l) => l.date_start && l.lap_duration > 0 && !l.is_pit_out_lap)
    .map((l) => ({ end: Date.parse(l.date_start) + l.lap_duration * 1000, driver: l.driver_number, duration: l.lap_duration, lap: l.lap_number }));
  const sorted = mergeSort(finished, (a, b) => a.end - b.end);
  const records = [];
  let best = Infinity;
  for (const l of sorted) {
    if (l.duration < best) {
      best = l.duration;
      records.push([round((l.end - t0) / 1000, 1), l.driver, round(l.duration, 3), l.lap]);
    }
  }
  return records;
}

export async function buildLeaderboard(sessionKey) {
  const cached = cache.get(sessionKey);
  if (cached) return cached;

  // อันดับ + รอบ เป็นข้อมูลหลัก (ต้องได้) ส่วน intervals/stints/pit ถ้าโหลดไม่ได้ก็ยังแสดงตารางได้
  const [positions, laps, results] = await Promise.all([getPositionChanges(sessionKey), getLaps(sessionKey), getSessionResult(sessionKey)]);
  const [intervalsRes, stintsRes, pitRes] = await Promise.allSettled([getIntervals(sessionKey), getStints(sessionKey), getPit(sessionKey)]);

  if (positions.length === 0) return null;
  const t0 = Math.floor(Math.min(...positions.map((p) => Date.parse(p.date))) / 1000) * 1000;
  const off = (iso) => round((Date.parse(iso) - t0) / 1000, 1);

  const posRows = mergeSort(positions, (a, b) => Date.parse(a.date) - Date.parse(b.date));
  // จำนวนรอบทั้งหมด = รอบที่ผู้ชนะวิ่ง (ข้อมูล /laps บางเรซมีรอบเกินมา 1 รอบหลังเข้าเส้นชัย)
  const winner = results.find((r) => r.position === 1);
  const totalLaps = winner?.number_of_laps ?? laps.reduce((m, l) => Math.max(m, l.lap_number ?? 0), 0);

  // เวลาเริ่มแต่ละรอบ: index = lap_number - 1
  const lapStarts = {};
  const lastLapEnd = new HashTable(32);
  for (const l of laps) {
    if (!l.date_start) continue;
    const key = l.driver_number;
    (lapStarts[key] ??= [])[l.lap_number - 1] = off(l.date_start);
    const end = Date.parse(l.date_start) + (l.lap_duration ?? 0) * 1000;
    if (!lastLapEnd.has(key) || end > lastLapEnd.get(key)) lastLapEnd.set(key, end);
  }
  for (const key of Object.keys(lapStarts)) {
    lapStarts[key] = Array.from(lapStarts[key], (v) => v ?? null);
  }

  // ออกจากการแข่ง (DNF/DNS/DSQ) และเวลาที่เข้าเส้นชัย (คนที่วิ่งจบ)
  const out = {};
  const finish = {};
  for (const r of results) {
    const end = lastLapEnd.get(r.driver_number);
    if (r.dns) out[r.driver_number] = 0;
    else if (r.dnf || r.dsq) out[r.driver_number] = end != null ? round((end - t0) / 1000, 1) : 0;
    else if (end != null) finish[r.driver_number] = round((end - t0) / 1000, 1);
  }

  const data = {
    sessionKey,
    t0,
    totalLaps,
    positions: posRows.map((p) => [off(p.date), p.driver_number, p.position]),
    lapStarts,
    intervals: intervalsRes.status === "fulfilled" ? compactIntervals(intervalsRes.value, t0) : {},
    stints:
      stintsRes.status === "fulfilled"
        ? groupBy(stintsRes.value, (s) => [s.lap_start ?? 1, s.lap_end ?? totalLaps, COMPOUND_LETTER[s.compound] ?? "?"])
        : {},
    pits:
      pitRes.status === "fulfilled"
        ? groupBy(pitRes.value, (p) => {
            const dur = p.lane_duration ?? p.pit_duration;
            if (!p.date || dur == null) return null;
            return [off(p.date), round(off(p.date) + dur, 1)];
          })
        : {},
    fastestLaps: fastestLapRecords(laps, t0),
    out,
    finish,
  };
  // เก็บ cache เฉพาะตอนข้อมูลครบ — ถ้าบางส่วนล้ม (เช่น OpenF1 ปิดชั่วคราว) ให้ลองใหม่ครั้งหน้า
  if (intervalsRes.status === "fulfilled" && stintsRes.status === "fulfilled" && pitRes.status === "fulfilled") cache.set(sessionKey, data);
  return data;
}
