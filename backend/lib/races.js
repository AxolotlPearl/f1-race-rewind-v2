// lib/races.js
// สร้าง "รายชื่อเรซที่แข่งจบแล้ว" ของปีหนึ่ง ๆ จาก /sessions + /meetings ของ OpenF1
// แยกออกมาจาก server.js เพื่อให้ทั้ง /api/races และดัชนีค้นหา (lib/searchIndex.js) ใช้ร่วมกัน

import { getSessions, getMeetings } from "./openf1.js";
import { HashTable } from "./HashTable.js";

export const FIRST_YEAR = 2023; // OpenF1 มีข้อมูลย้อนหลังตั้งแต่ปี 2023

export function currentYear() {
  return new Date().getUTCFullYear();
}

/** listYears - ปีที่เลือกได้ คำนวณจากวันที่ปัจจุบัน ไม่ hardcode (ขึ้นปีใหม่แล้วปีนั้นโผล่เอง) */
export function listYears() {
  const years = [];
  for (let y = currentYear(); y >= FIRST_YEAR; y--) years.push(y);
  return years;
}

export function isValidYear(year) {
  return Number.isInteger(year) && year >= FIRST_YEAR && year <= currentYear();
}

/**
 * getFinishedRaces - เรซ (Race + Sprint) ที่แข่งจบแล้วของปีนั้น เรียงตามเวลาจาก OpenF1
 * ใช้ HashTable จับคู่ meeting_key -> meeting แบบ O(1) แทน .find() ทุก session (O(s × m))
 */
export async function getFinishedRaces(year) {
  const [sessions, meetings] = await Promise.all([getSessions(year), getMeetings(year)]);

  const meetingLookup = new HashTable(16);
  for (const m of meetings) meetingLookup.set(m.meeting_key, m);

  const now = Date.now();
  return (
    sessions
      // ปฏิทินของปีปัจจุบันมีเรซที่ยังไม่แข่งปนมาด้วย (ยังไม่มีข้อมูลให้ replay) ตัดออก
      .filter((s) => !s.is_cancelled && new Date(s.date_end).getTime() < now)
      .map((s) => {
        const meeting = meetingLookup.get(s.meeting_key);
        return {
          sessionKey: s.session_key,
          year: s.year,
          location: s.location,
          countryName: s.country_name,
          dateStart: s.date_start,
          dateEnd: s.date_end,
          // session_type=Race ครอบคลุมทั้ง "Race" และ "Sprint" จึงต้องส่ง sessionName แยกให้ UI แสดงต่างกันได้
          sessionName: s.session_name,
          circuitKey: s.circuit_key,
          // ใช้สนามของ session เองก่อน: บาง meeting ถูกย้ายสนาม (ข้อมูลระดับ meeting จะชี้สนามผิด)
          circuitShortName: s.circuit_short_name ?? meeting?.circuit_short_name ?? s.location,
          meetingName: meeting?.meeting_name ?? s.location,
        };
      })
  );
}
