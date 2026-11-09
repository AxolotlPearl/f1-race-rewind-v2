// lib/pitLane.js
// เส้นพิทเลนบนแผนที่: OpenF1 ไม่มีพิกัดพิทเลนให้ตรง ๆ จึงสร้างจาก "เส้นทางที่รถวิ่งจริงตอนเข้าพิท"
//   1) เลือกการเข้าพิทที่ปกติที่สุด (ใช้เวลาในพิทเลน 15–40 วินาที ไม่ใช่จอดซ่อมนาน/ธงแดง)
//   2) ดึงพิกัดรถคันนั้นช่วง [เข้าพิท − 6 วิ, ออกพิท + 6 วิ] (1 request)
//   3) แปลงพิกัดด้วย transform เดียวกับเส้นสนาม → วาดซ้อนบนแผนที่ได้ทันที
// cache ต่อเรซใน HashTable — สร้างครั้งเดียวต่อ instance

import { getPit, getLocation } from "./openf1.js";
import { applyTrackTransform } from "./track.js";
import { HashTable } from "./HashTable.js";
import { mergeSort } from "./sort.js";

const MIN_LANE_SECONDS = 15;
const MAX_LANE_SECONDS = 40;
const PADDING_MS = 6000;
const MAX_ATTEMPTS = 2;
const cache = new HashTable(16);

export async function buildPitLane(sessionKey, transform) {
  if (cache.has(sessionKey)) return cache.get(sessionKey);

  const pits = await getPit(sessionKey);
  const candidates = mergeSort(
    pits.filter((p) => {
      const d = p.lane_duration ?? p.pit_duration;
      return p.date && d >= MIN_LANE_SECONDS && d <= MAX_LANE_SECONDS;
    }),
    (a, b) => (a.lane_duration ?? a.pit_duration) - (b.lane_duration ?? b.pit_duration)
  );

  let lane = null;
  for (const p of candidates.slice(0, MAX_ATTEMPTS)) {
    const startMs = Date.parse(p.date) - PADDING_MS;
    const endMs = Date.parse(p.date) + (p.lane_duration ?? p.pit_duration) * 1000 + PADDING_MS;
    const raw = await getLocation(sessionKey, {
      driverNumber: p.driver_number,
      fromIso: new Date(startMs).toISOString(),
      toIso: new Date(endMs).toISOString(),
      priority: "low",
    });
    const moving = raw.filter((pt, i) => i === 0 || pt.x !== raw[i - 1].x || pt.y !== raw[i - 1].y);
    if (moving.length >= 15) {
      lane = moving.map((pt) => {
        const { x, y } = applyTrackTransform(transform, pt);
        return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
      });
      break;
    }
  }
  cache.set(sessionKey, lane);
  return lane;
}
