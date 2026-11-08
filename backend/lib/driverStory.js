// lib/driverStory.js
// "เรื่องราวของนักขับคนเดียวในเรซนี้" — ประมวลผลจากไทม์ไลน์ที่ server สร้างอยู่แล้ว (ไม่ยิง OpenF1 เพิ่ม)
// แฟน F1 ส่วนใหญ่ตามเชียร์นักขับ/ทีมที่ชอบ อยากรู้ "คนของฉันเป็นยังไงบ้าง" โดยไม่ต้องกรองไทม์ไลน์เอง
//
// งานนี้ทำฝั่ง Express (ไม่ใช่ React) เพราะ:
//   - ส่งกลับไปเฉพาะ event ของนักขับคนนั้น (~20–60 รายการ) แทนทั้งไทม์ไลน์ (~300–700 รายการ) → payload เล็กลงมาก
//   - ค่าอย่าง "อันดับพิทสต็อปเทียบทั้งสนาม" ต้องใช้ข้อมูลของทุกคน ซึ่ง server มีอยู่แล้ว

import { HashTable } from "./HashTable.js";

/**
 * buildDriverStory - สรุปเรซของนักขับ 1 คน
 * Time complexity: O(E + P) โดย E = จำนวน event, P = จำนวนพิทสต็อปทั้งสนาม (วนครั้งเดียวแต่ละชุด)
 * @returns null ถ้าไม่พบนักขับเบอร์นี้ในเรซ
 */
export function buildDriverStory(timeline, driverNumber) {
  const driver = timeline.drivers.find((d) => d.driverNumber === driverNumber);
  if (!driver) return null;

  const events = [];
  let overtakesMade = 0;
  let overtakesSuffered = 0;
  const pits = [];
  const rivals = new HashTable(16); // คู่แข่งที่แซง/โดนแซงบ่อยสุด: driverNumber -> { driver, made, suffered }

  for (const e of timeline.events) {
    if (!e.driverNumbers.includes(driverNumber)) continue;
    events.push(e);

    if (e.type === "overtake") {
      const [by, over] = e.driverNumbers;
      const isMaker = by === driverNumber;
      if (isMaker) overtakesMade++;
      else overtakesSuffered++;

      const rivalNum = isMaker ? over : by;
      const rivalInfo = e.drivers.find((d) => d.driverNumber === rivalNum);
      if (!rivals.has(rivalNum)) rivals.set(rivalNum, { driver: rivalInfo, made: 0, suffered: 0 });
      const r = rivals.get(rivalNum);
      if (isMaker) r.made++;
      else r.suffered++;
    } else if (e.type === "pit") {
      pits.push({ lap: e.lap, pitDuration: e.pitDuration, date: e.date });
    }
  }

  // อันดับพิทสต็อปเทียบทั้งสนาม: fastestPits เรียงเร็ว→ช้าไว้แล้ว (mergeSort ใน timeline.js)
  // จึงหาตำแหน่งแรกของนักขับคนนี้ได้ด้วยการวนครั้งเดียว O(P)
  const fastestPits = timeline.fastestPits;
  let bestPitRank = null;
  for (let i = 0; i < fastestPits.length; i++) {
    if (fastestPits[i].driverNumber === driverNumber) {
      bestPitRank = { rank: i + 1, of: fastestPits.length, pitDuration: fastestPits[i].pitDuration };
      break;
    }
  }

  // คู่ปรับหลัก = คนที่มีการแซงกันไปมามากที่สุด
  let mainRival = null;
  for (const r of rivals.values()) {
    if (!mainRival || r.made + r.suffered > mainRival.made + mainRival.suffered) mainRival = r;
  }

  const result = timeline.sessionResult.find((r) => r.driver_number === driverNumber) ?? null;

  return {
    sessionKey: timeline.sessionKey,
    driver,
    result: result
      ? { position: result.position ?? null, points: result.points ?? 0, dnf: !!result.dnf, laps: result.number_of_laps ?? null }
      : null,
    stats: {
      overtakesMade,
      overtakesSuffered,
      pitCount: pits.length,
      bestPitRank,
      mainRival,
    },
    pits,
    events,
    // ให้หน้าเว็บทำปุ่ม "นักขับคนอื่น" (เปลี่ยนคนดูได้ทันทีไม่ต้องย้อนกลับ)
    otherDrivers: timeline.drivers.filter((d) => d.driverNumber !== driverNumber),
  };
}
