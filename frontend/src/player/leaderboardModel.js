// src/player/leaderboardModel.js
// แปลงข้อมูล /api/race/:key/leaderboard ให้ "ถามค่า ณ เวลาใดก็ได้" เร็ว ๆ
//   prepareLeaderboard(data) — ทำครั้งเดียวต่อเรซ: แยกตามนักขับใน HashTable + เรียงตามเวลาเป็น array
//   leaderboardAt(model, drivers, ms) — เรียก ~4 ครั้ง/วินาทีตอนเล่น: ทุกค่าหาด้วย binary search
//
// Big-O ต่อการถาม 1 ครั้ง (D = นักขับ ~20 คน):
//   อันดับ / รอบ / ช่องว่างเวลา / รอบเร็วสุด: binary search O(log n) ต่อคน → O(D log n)
//   ยาง / พิท: วนช่วงของคนนั้น (~3–6 ช่วง) → O(D)
//   เรียงแถวตามอันดับ: mergeSort O(D log D)
// ถ้าวนหาแบบ linear ทุกครั้ง จะเป็น O(D × n) — intervals มีหลายร้อยแถวต่อคน

import { HashTable } from "../dsa/HashTable.js";
import { mergeSort } from "../dsa/sort.js";
import { upperBound } from "./MapPlayer.js";

const PIT_PADDING_S = 1;

function toTable(obj, map) {
  const table = new HashTable(32);
  for (const key of Object.keys(obj ?? {})) table.set(Number(key), map(obj[key]));
  return table;
}

export function prepareLeaderboard(data) {
  // อันดับ: [[วินาที, นักขับ, อันดับ], ...] เรียงตามเวลาแล้ว → แยกเป็น { t[], pos[] } ต่อคน
  const positions = new HashTable(32);
  for (const [t, num, pos] of data.positions) {
    if (!positions.has(num)) positions.set(num, { t: [], v: [] });
    const s = positions.get(num);
    s.t.push(t);
    s.v.push(pos);
  }
  return {
    t0: data.t0,
    totalLaps: data.totalLaps,
    positions,
    // เวลาเริ่มรอบ (ตัด null ทิ้ง เก็บเลขรอบคู่กันไว้)
    laps: toTable(data.lapStarts, (arr) => {
      const t = [];
      const lap = [];
      arr.forEach((v, i) => {
        if (v != null) {
          t.push(v);
          lap.push(i + 1);
        }
      });
      return { t, lap };
    }),
    intervals: toTable(data.intervals, (rows) => ({ t: rows.map((r) => r[0]), rows })),
    stints: toTable(data.stints, (rows) => rows),
    pits: toTable(data.pits, (rows) => rows),
    fastestTimes: data.fastestLaps.map((r) => r[0]),
    fastestLaps: data.fastestLaps,
    weatherTimes: (data.weather ?? []).map((w) => w[0]),
    weather: data.weather ?? [],
    statusTimes: (data.trackStatus ?? []).map((r) => r[0]),
    trackStatus: data.trackStatus ?? [],
    out: toTable(data.out, (v) => v),
    finish: toTable(data.finish, (v) => v),
  };
}

const lastAt = (series, s) => {
  if (!series) return null;
  const i = upperBound(series.t, s);
  return i >= 0 ? i : null;
};

function compoundAt(stints, lap) {
  if (!stints || stints.length === 0) return null;
  const l = Math.max(1, lap);
  for (const [from, to, c] of stints) if (l >= from && l <= to) return c;
  return l > stints[stints.length - 1][1] ? stints[stints.length - 1][2] : stints[0][2];
}

/** แถวของ leaderboard ณ เวลา ms — คนที่ออกจากการแข่งไปอยู่ท้ายตาราง */
export function leaderboardAt(model, drivers, ms) {
  const s = (ms - model.t0) / 1000;
  const fi = upperBound(model.fastestTimes, s);
  const fastest = fi >= 0 ? model.fastestLaps[fi] : null;

  const rows = drivers.map((d) => {
    const num = d.driverNumber;
    const ps = model.positions.get(num);
    const pi = lastAt(ps, s);
    const ls = model.laps.get(num);
    const li = lastAt(ls, s);
    const lap = li != null ? ls.lap[li] : 0;
    const iv = model.intervals.get(num);
    const ii = lastAt(iv, s);
    const outAt = model.out.get(num);
    const finishAt = model.finish.get(num);
    const pits = model.pits.get(num) ?? [];
    return {
      driver: d,
      position: pi != null ? ps.v[pi] : null,
      lap,
      gap: ii != null ? iv.rows[ii][1] : null,
      interval: ii != null ? iv.rows[ii][2] : null,
      compound: compoundAt(model.stints.get(num), lap),
      inPit: pits.some(([a, b]) => s >= a - PIT_PADDING_S && s <= b + PIT_PADDING_S),
      out: outAt != null && s >= outAt,
      finished: finishAt != null && s >= finishAt,
      fastest: fastest != null && fastest[1] === num,
    };
  });

  const sorted = mergeSort(rows, (a, b) => {
    if (a.out !== b.out) return a.out ? 1 : -1;
    return (a.position ?? 99) - (b.position ?? 99);
  });
  const leaderLap = sorted.reduce((m, r) => (r.out ? m : Math.max(m, r.lap)), 0);
  return { rows: sorted, lap: Math.min(leaderLap, model.totalLaps), totalLaps: model.totalLaps, fastestLap: fastest };
}

/** สภาพอากาศ + สถานะสนาม ณ เวลา ms (binary search 2 ครั้ง O(log n)) — ก่อนมีข้อมูลแรกใช้ค่าอากาศแรกแทน */
export function conditionsAt(model, ms) {
  const s = (ms - model.t0) / 1000;
  const wi = upperBound(model.weatherTimes, s);
  const w = model.weather[Math.max(0, wi)] ?? null;
  const ti = upperBound(model.statusTimes, s);
  const t = ti >= 0 ? model.trackStatus[ti] : null;
  return {
    weather: w && { air: w[1], track: w[2], humidity: w[3], rain: w[4] === 1, wind: w[5], windDir: w[6] },
    status: t ? t[1] : null,
    yellowSectors: t ? t[2] : [],
  };
}
