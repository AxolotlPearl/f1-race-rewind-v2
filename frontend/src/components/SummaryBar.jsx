// src/components/SummaryBar.jsx
// แถบสรุปเรซ (ผู้ชนะ / จำนวนรอบ / แซง / เข้าพิท) — แสดงผลล้วนจาก props ไม่มี state

import { Link } from "react-router-dom";

export default function SummaryBar({ sessionKey, summary, dataAvailability }) {
  if (!summary?.winner) {
    return (
      <div className="summary-content">
        <div className="summary-chip">
          <div className="label">สรุป</div>
          <div className="value">ไม่มีข้อมูลสรุปสำหรับเรซนี้</div>
        </div>
      </div>
    );
  }
  const chips = [
    {
      label: "ผู้ชนะ",
      value: summary.winner.fullName ? (
        <Link to={`/race/${sessionKey}/driver/${summary.winner.driverNumber}`}>{summary.winner.fullName}</Link>
      ) : (
        "-"
      ),
      color: summary.winner.teamColour,
    },
    { label: "จำนวนรอบ", value: summary.totalLaps ?? "-" },
    { label: "แซงกี่ครั้ง", value: dataAvailability.hasOvertakes ? summary.overtakeCount : "ไม่มีข้อมูล" },
    { label: "เข้าพิทกี่ครั้ง", value: dataAvailability.hasPit ? summary.pitCount : "ไม่มีข้อมูล" },
  ];
  return (
    <div className="summary-content">
      {chips.map((c) => (
        <div key={c.label} className="summary-chip" style={c.color ? { "--team-color": `#${c.color}` } : undefined}>
          <div className="label">{c.label}</div>
          <div className="value">{c.value}</div>
        </div>
      ))}
    </div>
  );
}
