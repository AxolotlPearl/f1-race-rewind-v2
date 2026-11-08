// lib/standings.js
// ตารางคะแนนทั้งฤดูกาล (นักขับ + ทีม) ประมวลผลที่ Express จากผลการแข่งของทุก Race/Sprint ในปีนั้น
//
// ทำไมคำนวณเองแทนการดึง "ตารางคะแนนสำเร็จรูป":
//   - OpenF1 มี championship endpoint เฉพาะบางปี/บาง session; คำนวณจาก session_result ใช้ได้ทุกปี (2023+)
//   - ได้ผลรายสนามของแต่ละคน/ทีมมาพร้อมกัน ใช้ทำบัตรนักขับ/บัตรทีมได้เลยโดยไม่ต้องยิง API เพิ่ม
//
// ใช้ OpenF1 แค่ 2 request ต่อฤดูกาล (ผลทุก session + นักขับทุก session ด้วยช่วง session_key) แล้วรวมเอง:
//   1. HashTable: sessionKey -> เรซ, "session:driver" -> ข้อมูลนักขับของเรซนั้น (ทีมของเรซนั้นจริง ๆ)
//   2. HashTable: driverNumber -> สถิติสะสม, teamName -> สถิติสะสม  (รวมคะแนน O(R) เมื่อ R = จำนวนแถวผล)
//   3. mergeSort จัดอันดับ: คะแนนมากก่อน ถ้าเท่ากันใช้ "countback" แบบ F1 จริง (ชนะมากกว่า → ที่ 2 มากกว่า → ...)
//      O(n log n × P) โดย P = จำนวนอันดับที่เทียบ (สูงสุด ~20) — n ≤ ~25 คน จึงเร็วมาก

import { getFinishedRaces, currentYear } from "./races.js";
import { getSessionResultRange, getDriversRange } from "./openf1.js";
import { HashTable } from "./HashTable.js";
import { mergeSort } from "./sort.js";

const CURRENT_SEASON_TTL_MS = 10 * 60 * 1000;
const MAX_POSITION = 30;

/** compareStanding - คะแนนมากก่อน, เท่ากัน → นับจำนวนครั้งที่ได้ที่ 1, 2, 3, ... ใครมากกว่าก่อน (countback) */
export function compareStanding(a, b) {
  if (a.points !== b.points) return b.points - a.points;
  for (let p = 1; p <= MAX_POSITION; p++) {
    const diff = (b.finishCounts[p] ?? 0) - (a.finishCounts[p] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function newDriverEntry(info) {
  return {
    driverNumber: info.driver_number,
    fullName: info.full_name,
    acronym: info.name_acronym,
    firstName: info.first_name ?? null,
    lastName: info.last_name ?? null,
    countryCode: info.country_code ?? null,
    headshotUrl: info.headshot_url ?? null,
    teamName: info.team_name ?? "-",
    teamColour: (info.team_colour ?? "888888").toLowerCase(),
    teams: [], // ทีมทั้งหมดที่เคยขับในปีนี้ (ย้ายทีมกลางฤดูกาลได้)
    points: 0,
    wins: 0,
    podiums: 0,
    dnfs: 0,
    starts: 0,
    bestFinish: null,
    finishCounts: [],
    results: [],
  };
}

function newTeamEntry(teamName, colour) {
  return {
    teamName,
    teamColour: colour,
    points: 0,
    wins: 0,
    podiums: 0,
    finishCounts: [],
    driverTable: new HashTable(8), // driverNumber -> { driverNumber, acronym, fullName, points }
    results: [], // ต่อสนาม: { race..., points, entries: [...] }
    resultBySession: new HashTable(32), // sessionKey -> แถวใน results (รวมนักขับ 2 คนของทีมในเรซเดียว)
  };
}

function raceSummary(race) {
  return {
    sessionKey: race.sessionKey,
    meetingName: race.meetingName,
    sessionName: race.sessionName,
    circuitShortName: race.circuitShortName,
    countryName: race.countryName,
    dateStart: race.dateStart,
  };
}

/** classify - ข้อความสถานะจบของแถวผล ใช้แสดงในบัตร (P1, DNF, DNS, DSQ) */
function finishLabel(row) {
  if (row.dsq) return "DSQ";
  if (row.dns) return "DNS";
  if (row.dnf) return "DNF";
  return row.position != null ? `P${row.position}` : "-";
}

/**
 * buildStandings - ตารางคะแนนนักขับ + ทีมของปีนั้น พร้อมผลรายสนาม
 * Time complexity: O(R + D + n log n) โดย R = แถวผลทั้งปี (~2,000), D = แถวนักขับ (~2,000), n = จำนวนคน/ทีม
 */
export async function buildStandings(year) {
  const races = await getFinishedRaces(year);
  if (races.length === 0) return { year, races: [], drivers: [], teams: [] };

  // ช่วง session_key ของเรซในปีนี้ (key เรียงตามเวลา จึงครอบทุกเรซของปี)
  let minKey = Infinity;
  let maxKey = -Infinity;
  const raceByKey = new HashTable(64);
  for (const r of races) {
    raceByKey.set(r.sessionKey, r);
    if (r.sessionKey < minKey) minKey = r.sessionKey;
    if (r.sessionKey > maxKey) maxKey = r.sessionKey;
  }

  const ttlMs = year >= currentYear() ? CURRENT_SEASON_TTL_MS : Infinity;
  const [results, driverRows] = await Promise.all([getSessionResultRange(minKey, maxKey, ttlMs), getDriversRange(minKey, maxKey, ttlMs)]);

  // "sessionKey:driverNumber" -> ข้อมูลนักขับของเรซนั้น (เฉพาะ session ที่เป็นเรซ ลดขนาดตาราง)
  const driverInfo = new HashTable(1024);
  for (const d of driverRows) {
    if (raceByKey.has(d.session_key)) driverInfo.set(`${d.session_key}:${d.driver_number}`, d);
  }

  const drivers = new HashTable(32);
  const teams = new HashTable(16);

  // วนเรซตามลำดับเวลา → ผลรายสนามของทุกคนเรียงตามเวลาเอง และ "ทีมล่าสุด" ของนักขับคือทีมในเรซสุดท้าย
  const resultsBySession = new HashTable(64);
  for (const row of results) {
    if (!raceByKey.has(row.session_key)) continue; // ตัดผลซ้อม/ควอลิฟายทิ้ง
    if (!resultsBySession.has(row.session_key)) resultsBySession.set(row.session_key, []);
    resultsBySession.get(row.session_key).push(row);
  }

  for (const race of races) {
    const rows = resultsBySession.get(race.sessionKey) ?? [];
    const summary = raceSummary(race);

    for (const row of rows) {
      const info = driverInfo.get(`${row.session_key}:${row.driver_number}`) ?? {
        driver_number: row.driver_number,
        full_name: `#${row.driver_number}`,
        name_acronym: String(row.driver_number),
      };
      const points = Number(row.points) || 0;
      const position = row.position ?? null;
      const teamName = info.team_name ?? "-";
      const teamColour = (info.team_colour ?? "888888").toLowerCase();

      // ---- นักขับ ----
      if (!drivers.has(row.driver_number)) drivers.set(row.driver_number, newDriverEntry(info));
      const d = drivers.get(row.driver_number);
      // ข้อมูลโปรไฟล์ล่าสุดชนะ (ทีม/สี/รูป ของเรซล่าสุด)
      d.teamName = teamName;
      d.teamColour = teamColour;
      if (info.headshot_url) d.headshotUrl = info.headshot_url;
      if (!d.teams.includes(teamName)) d.teams.push(teamName);
      d.points += points;
      d.starts += row.dns ? 0 : 1;
      if (row.dnf) d.dnfs++;
      if (position != null && !row.dnf && !row.dns && !row.dsq) {
        d.finishCounts[position] = (d.finishCounts[position] ?? 0) + 1;
        if (race.sessionName === "Race") {
          if (position === 1) d.wins++;
          if (position <= 3) d.podiums++;
        }
        if (d.bestFinish == null || position < d.bestFinish) d.bestFinish = position;
      }
      d.results.push({ ...summary, position, points, status: finishLabel(row), teamName });

      // ---- ทีม ----
      if (!teams.has(teamName)) teams.set(teamName, newTeamEntry(teamName, teamColour));
      const t = teams.get(teamName);
      t.teamColour = teamColour;
      t.points += points;
      if (position != null && !row.dnf && !row.dns && !row.dsq) {
        t.finishCounts[position] = (t.finishCounts[position] ?? 0) + 1;
        if (race.sessionName === "Race") {
          if (position === 1) t.wins++;
          if (position <= 3) t.podiums++;
        }
      }
      if (!t.driverTable.has(row.driver_number)) {
        t.driverTable.set(row.driver_number, { driverNumber: row.driver_number, acronym: info.name_acronym, fullName: info.full_name, points: 0, races: 0 });
      }
      const td = t.driverTable.get(row.driver_number);
      td.points += points;
      td.races++;

      if (!t.resultBySession.has(race.sessionKey)) {
        const entry = { ...summary, points: 0, entries: [] };
        t.resultBySession.set(race.sessionKey, entry);
        t.results.push(entry);
      }
      const tr = t.resultBySession.get(race.sessionKey);
      tr.points += points;
      tr.entries.push({ driverNumber: row.driver_number, acronym: info.name_acronym, position, points, status: finishLabel(row) });
    }
  }

  // จัดอันดับ + แนบเลขอันดับ, ตัดฟิลด์ภายใน (HashTable) ออกก่อนส่ง JSON
  const rankedDrivers = mergeSort(drivers.values(), compareStanding).map((d, i) => {
    const { finishCounts, ...rest } = d;
    return { rank: i + 1, ...rest };
  });

  const rankedTeams = mergeSort(teams.values(), compareStanding).map((t, i) => {
    const { finishCounts, driverTable, resultBySession, ...rest } = t;
    const teamDrivers = mergeSort(driverTable.values(), (a, b) => b.points - a.points);
    // ผลของนักขับในแต่ละสนามเรียงตามอันดับ (คนจบหน้ามาก่อน, ไม่มีอันดับไว้ท้าย)
    const results = rest.results.map((r) => ({
      ...r,
      entries: mergeSort(r.entries, (a, b) => (a.position ?? 99) - (b.position ?? 99)),
    }));
    return { rank: i + 1, ...rest, results, drivers: teamDrivers };
  });

  return {
    year,
    races: races.map(raceSummary),
    drivers: rankedDrivers,
    teams: rankedTeams,
  };
}
