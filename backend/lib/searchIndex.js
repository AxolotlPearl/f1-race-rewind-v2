// lib/searchIndex.js
// ดัชนีค้นหาเรซข้ามทุกฤดูกาล: ดึงรายชื่อเรซทุกปี (ผ่าน cache ของ openf1.js) แล้วใส่ลง Trie
// สร้างครั้งเดียวต่อ instance แล้วใช้ซ้ำ หมดอายุทุก 10 นาที (ให้เรซที่เพิ่งแข่งจบเข้าดัชนีเอง)

import { Trie } from "./Trie.js";
import { getFinishedRaces, listYears } from "./races.js";
import { mergeSort } from "./sort.js";
import { HashTable } from "./HashTable.js";

const INDEX_TTL_MS = 10 * 60 * 1000;

let index = null; // { trie, races, builtAt }
let building = null; // Promise ที่กำลังสร้างอยู่ — request พร้อมกันหลายตัวรอตัวเดียวกัน ไม่ยิง OpenF1 ซ้ำ

async function buildIndex() {
  const years = listYears();
  let failed = false;
  let firstError = null;
  // ปีใดดึงไม่ได้ ยังค้นปีอื่นได้ แต่ให้ดัชนีหมดอายุเร็ว (30 วินาที) จะได้ลองดึงปีที่ขาดใหม่
  const perYear = await Promise.all(
    years.map((y) =>
      getFinishedRaces(y).catch((err) => {
        failed = true;
        firstError ??= err;
        return [];
      })
    )
  );
  // ดึงไม่ได้เลยสักปี → ส่ง error ต้นเหตุต่อ (เช่น OpenF1 ปิดช่วงแข่งสด) ให้ server แสดงข้อความที่ตรงสาเหตุ
  if (failed && perYear.every((list) => list.length === 0)) throw firstError;
  const races = perYear.flat();

  const trie = new Trie();
  const byKey = new HashTable(Math.max(16, races.length * 2)); // sessionKey -> race แบบ O(1)
  races.forEach((r, id) => {
    byKey.set(r.sessionKey, r);
    // คำค้นที่ผู้ใช้น่าจะพิมพ์: ชื่อรายการ, เมือง, ประเทศ, ชื่อสนาม, ปี, Race/Sprint
    trie.insertText(`${r.meetingName} ${r.location} ${r.countryName} ${r.circuitShortName} ${r.year} ${r.sessionName}`, id);
  });
  return { trie, races, byKey, ttlMs: failed ? 30 * 1000 : INDEX_TTL_MS, builtAt: Date.now() };
}

async function getIndex() {
  if (index && Date.now() - index.builtAt < index.ttlMs) return index;
  if (!building) {
    building = buildIndex()
      .then((built) => {
        index = built;
        return built;
      })
      .finally(() => {
        building = null;
      });
  }
  return building;
}

/**
 * searchRaces - ค้นเรซด้วย prefix ของคำ คืนผลล่าสุดก่อน ไม่เกิน limit รายการ
 * ผลจาก Trie อยู่ในลำดับที่ insert (ปีใหม่ → เก่า, ในปีเรียงตามเวลา) จึงเรียงใหม่ด้วย mergeSort ตามวันที่
 */
export async function searchRaces(query, limit = 8) {
  const { trie, races } = await getIndex();
  const ids = trie.search(query);
  const matched = ids.map((id) => races[id]);
  const newestFirst = mergeSort(matched, (a, b) => new Date(b.dateStart) - new Date(a.dateStart));
  return { total: matched.length, results: newestFirst.slice(0, limit) };
}

/** findRace - หาเรซจาก sessionKey ในดัชนี (ใช้เติมชื่อเรซให้ endpoint อื่น เช่นหน้าเรซที่เปิดจากลิงก์ตรง) */
export async function findRace(sessionKey) {
  const { byKey } = await getIndex();
  return byKey.get(sessionKey) ?? null;
}
