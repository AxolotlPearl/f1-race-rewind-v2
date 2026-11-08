// lib/calendar.js
// ปฏิทินฤดูกาล + "สนามต่อไป" สำหรับนับถอยหลังในหน้าแรก
// ใช้ /meetings (ชื่อรายการ, ธงชาติ, รูปสนาม) + /sessions ทุกประเภท (หาเวลา Race/Sprint/Qualifying ของแต่ละสนาม)
//
// สถานะของแต่ละสนามคำนวณจากเวลาปัจจุบันทุกครั้งที่ขอ (ไม่ hardcode): done / live / next / upcoming / cancelled
// สถานะคำนวณใหม่ทุก request จากนาฬิกา server → สนามต่อไปเลื่อนเองทันทีที่เรซจบ

import { HashTable } from "./HashTable.js";
import { mergeSort } from "./sort.js";
import { currentYear } from "./races.js";
import { getMeetings, getAllSessions } from "./openf1.js";

// ข้อมูลดิบถูก cache ใน openf1.js อยู่แล้ว (ปีปัจจุบัน 10 นาที, ปีที่จบแล้วถาวร) ส่วนนี้แค่ประมวลผลต่อ
async function loadSeason(year) {
  const [meetings, sessions] = await Promise.all([getMeetings(year), getAllSessions(year)]);

  // meeting_key -> session ที่สำคัญของสนามนั้น (HashTable O(1) ต่อ session แทน filter ทุก meeting)
  const byMeeting = new HashTable(32);
  for (const s of sessions) {
    if (!byMeeting.has(s.meeting_key)) byMeeting.set(s.meeting_key, {});
    const slot = byMeeting.get(s.meeting_key);
    if (s.session_name === "Race") slot.race = s;
    else if (s.session_name === "Sprint") slot.sprint = s;
    else if (s.session_name === "Qualifying") slot.qualifying = s;
  }

  const rounds = meetings
    // ตัด pre-season testing (ไม่มี Race) ออก
    .filter((m) => byMeeting.get(m.meeting_key)?.race)
    .map((m) => {
      const slot = byMeeting.get(m.meeting_key);
      return {
        meetingKey: m.meeting_key,
        meetingName: m.meeting_name,
        officialName: m.meeting_official_name ?? m.meeting_name,
        location: m.location,
        countryName: m.country_name,
        countryFlag: m.country_flag ?? null,
        circuitShortName: slot.race.circuit_short_name ?? m.circuit_short_name,
        circuitImage: m.circuit_image ?? null,
        weekendStart: m.date_start,
        isCancelled: !!(m.is_cancelled || slot.race.is_cancelled),
        race: { sessionKey: slot.race.session_key, dateStart: slot.race.date_start, dateEnd: slot.race.date_end },
        sprint: slot.sprint ? { sessionKey: slot.sprint.session_key, dateStart: slot.sprint.date_start, dateEnd: slot.sprint.date_end } : null,
        qualifying: slot.qualifying ? { dateStart: slot.qualifying.date_start } : null,
      };
    });

  return mergeSort(rounds, (a, b) => Date.parse(a.race.dateStart) - Date.parse(b.race.dateStart));
}

/** withStatus - ใส่สถานะตามเวลาปัจจุบัน + เลขรอบ (นับเฉพาะสนามที่ไม่ถูกยกเลิก) */
function withStatus(rounds, now) {
  let round = 0;
  let nextFound = false;
  return rounds.map((r) => {
    let status;
    if (r.isCancelled) status = "cancelled";
    else {
      round++;
      const start = Date.parse(r.race.dateStart);
      const end = Date.parse(r.race.dateEnd);
      if (end < now) status = "done";
      else if (start <= now) status = "live";
      else if (!nextFound) {
        status = "next";
        nextFound = true;
      } else status = "upcoming";
      if (status === "live") nextFound = true; // กำลังแข่ง = นับเป็น "สนามปัจจุบัน" แทนสนามต่อไป
    }
    return { ...r, round: r.isCancelled ? null : round, status };
  });
}

/**
 * buildCalendar - ปฏิทินของปีนั้น + สนามที่ต้องนับถอยหลัง
 * ถ้าปีนี้แข่งครบแล้ว ลองหาเรซแรกของปีถัดไป (OpenF1 มักลงปฏิทินปีหน้าไว้ล่วงหน้า)
 */
export async function buildCalendar(year) {
  const now = Date.now();
  const rounds = withStatus(await loadSeason(year), now);
  let next = rounds.find((r) => r.status === "live" || r.status === "next") ?? null;

  if (!next && year === currentYear()) {
    try {
      const nextYear = withStatus(await loadSeason(year + 1), now);
      next = nextYear.find((r) => r.status === "next") ?? null;
    } catch {
      next = null; // ปีหน้ายังไม่มีปฏิทิน — หน้าเว็บจะบอกว่าฤดูกาลจบแล้ว
    }
  }

  return {
    year,
    serverTime: new Date(now).toISOString(), // ให้ browser ชดเชยนาฬิกาเครื่องที่เดินไม่ตรงได้
    next,
    rounds,
    completed: rounds.filter((r) => r.status === "done").length,
    total: rounds.filter((r) => r.status !== "cancelled").length,
  };
}
