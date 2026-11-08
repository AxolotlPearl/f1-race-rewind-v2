// src/seasonCache.js
// ตารางคะแนนของแต่ละปี "โหลดครั้งเดียว ใช้ได้ทั้งเว็บ" — หน้า Scoreboard, หน้านักแข่ง และป๊อปอัปโปรไฟล์ตอนชี้เมาส์
// ใช้ชุดเดียวกัน ถ้าแต่ละที่โหลดเอง ชี้เมาส์ 20 ชื่อ = ยิง API 20 ครั้ง
//
// เก็บ Promise (ไม่ใช่แค่ผลลัพธ์) ใน HashTable: ถ้าชี้หลายชื่อพร้อมกันระหว่างที่ยังโหลดไม่เสร็จ ทุกคนรอ Promise ตัวเดียวกัน
// ชั้นล่างยังมี localStorage cache ใน api.js (ปีที่จบแล้วเก็บถาวร) และ cache ของ Express อีกชั้น

import { api } from "./api.js";
import { HashTable } from "./dsa/HashTable.js";

const pending = new HashTable(8); // year -> Promise<{ data, lookup }>

/** buildLookup - ดัชนีหา driver/team แบบ O(1) + คะแนนสูงสุดในสนามเดียว (สเกลกราฟแท่ง) */
export function buildLookup(data) {
  const drivers = new HashTable(64);
  const teams = new HashTable(32);
  let maxPoints = 0;
  for (const d of data.drivers) {
    drivers.set(d.driverNumber, d);
    for (const r of d.results) if (r.points > maxPoints) maxPoints = r.points;
  }
  for (const t of data.teams) teams.set(t.teamName, t);
  return { drivers, teams, maxPoints };
}

/** getSeason - ตารางคะแนน + ดัชนีของปีนั้น (Promise ตัวเดียวต่อปี; ถ้าล้มเหลวลบทิ้งเพื่อให้ลองใหม่ได้) */
export function getSeason(year) {
  if (!pending.has(year)) {
    const promise = api.standings(year).then((data) => ({ data, lookup: buildLookup(data) }));
    promise.catch(() => pending.delete(year));
    pending.set(year, promise);
  }
  return pending.get(year);
}
