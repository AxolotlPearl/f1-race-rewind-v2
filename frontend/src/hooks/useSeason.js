// src/hooks/useSeason.js
// ใช้ร่วมกันระหว่างหน้าตารางคะแนน (/standings) และหน้านักแข่ง (/drivers):
// ปีที่เลือก, ตารางคะแนนของปีนั้น, ดัชนีหา driver/team, และ "บัตรที่เปิดอยู่" — ทั้งหมดอ่าน/เขียนผ่าน URL
//
// ไม่ใช้ useState เก็บ ปี / บัตรที่เปิด แต่เก็บใน URL (useSearchParams) เพราะ:
//   - แชร์ลิงก์บัตรได้ เช่น /standings?year=2024&team=McLaren
//   - ปุ่ม back ของ browser = ปิดบัตร / ย้อนกลับไปบัตรก่อนหน้า (นักขับ → ทีม → back → นักขับ)
//   - URL เป็นแหล่งความจริงเดียว ถ้าเก็บซ้ำเป็น state ต้องคอย sync กับ URL ตลอด

import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import { useAsync } from "./useAsync.js";
import { buildLookup } from "../seasonCache.js";

export function useSeason() {
  const [params, setParams] = useSearchParams();
  const yearsReq = useAsync((signal) => api.years(signal), []);

  const latestYear = yearsReq.data?.years?.[0] ?? null;
  const year = Number(params.get("year")) || latestYear;
  const openDriver = params.get("driver") ? Number(params.get("driver")) : null;
  const openTeam = params.get("team");

  const standingsReq = useAsync((signal) => api.standings(year, signal), [year], {
    enabled: year != null,
    isEmpty: (s) => s.drivers.length === 0,
  });
  const data = standingsReq.status === "success" ? standingsReq.data : null;

  // ดัชนีหา driver/team แบบ O(1) (HashTable) สร้างครั้งเดียวต่อชุดข้อมูล
  const lookup = useMemo(() => (data ? buildLookup(data) : null), [data]);

  /** เปลี่ยนค่าใน URL (push history → กด back ได้) โดยคงค่าอื่นไว้ */
  const update = useCallback(
    (changes) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value == null || value === "") next.delete(key);
          else next.set(key, String(value));
        }
        return next;
      });
    },
    [setParams]
  );

  // บัตรเปิดได้ทีละใบ: เปิดบัตรทีม = ปิดบัตรนักขับ และกลับกัน
  const showDriver = useCallback((num) => update({ driver: num, team: null }), [update]);
  const showTeam = useCallback((name) => update({ team: name, driver: null }), [update]);
  const closeCard = useCallback(() => update({ driver: null, team: null }), [update]);
  const setYear = useCallback((y) => update({ year: y, driver: null, team: null }), [update]);

  return { params, update, yearsReq, year, standingsReq, data, lookup, openDriver, openTeam, showDriver, showTeam, closeCard, setYear };
}
