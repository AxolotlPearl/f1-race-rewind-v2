// src/components/ResultsTable.jsx
// ตารางผลจบการแข่ง คลิกหัวคอลัมน์เพื่อเรียง (mergeSort เอง) คลิกชื่อนักขับเพื่อไปหน้าเจาะนักขับ
//
// state (อยู่ในนี้เพราะมีแค่ตารางนี้ใช้): sortKey, sortAsc
// props: sessionKey, results (จากไทม์ไลน์ที่ RacePage โหลดมา)

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { mergeSort } from "../dsa/sort.js";
import { EmptyState } from "./StatusViews.jsx";

const COLUMNS = [
  { key: "position", label: "อันดับ" },
  { key: "fullName", label: "นักขับ" },
  { key: "teamName", label: "ทีม" },
  { key: "points", label: "แต้ม" },
];

export default function ResultsTable({ sessionKey, results }) {
  const [sortKey, setSortKey] = useState("position");
  const [sortAsc, setSortAsc] = useState(true);

  const sorted = useMemo(() => {
    const compare = (a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      let cmp;
      if (typeof va === "string" || typeof vb === "string") cmp = String(va ?? "") < String(vb ?? "") ? -1 : String(va ?? "") > String(vb ?? "") ? 1 : 0;
      // ไม่มีอันดับ (DNF) ไปอยู่ท้ายเสมอเมื่อเรียงจากน้อยไปมาก
      else cmp = (va ?? Infinity) - (vb ?? Infinity);
      return sortAsc ? cmp : -cmp;
    };
    return mergeSort(results, compare);
  }, [results, sortKey, sortAsc]);

  if (results.length === 0) return <EmptyState title="ไม่มีข้อมูลผลจบการแข่ง" />;

  function handleSort(key) {
    if (key === sortKey) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          {COLUMNS.map((c) => (
            <th key={c.key} className={c.key === sortKey ? `sorted ${sortAsc ? "asc" : "desc"}` : ""} onClick={() => handleSort(c.key)}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => (
          <tr key={r.driver_number}>
            <td>{r.dnf ? "DNF" : r.position ?? "-"}</td>
            <td>
              <span className="team-dot" style={{ "--dot-color": `#${r.teamColour}` }} />
              <Link to={`/race/${sessionKey}/driver/${r.driver_number}`} title="ดูเรื่องราวของนักขับคนนี้">
                {r.fullName}
              </Link>
            </td>
            <td>{r.teamName}</td>
            <td>{r.points ?? 0}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
