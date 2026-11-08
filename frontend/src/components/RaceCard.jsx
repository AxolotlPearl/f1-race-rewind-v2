// src/components/RaceCard.jsx
// การ์ดเรซ 1 ใบ — component แสดงผลล้วน (ไม่มี state) รับ race ผ่าน props แล้วลิงก์ไปหน้าเรซ

import { Link } from "react-router-dom";

const dateFormat = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" });

export default function RaceCard({ race, featured = false }) {
  return (
    <Link to={`/race/${race.sessionKey}`} className={`race-card ${featured ? "featured" : ""}`}>
      <span className="race-card-date">{dateFormat.format(new Date(race.dateStart))}</span>
      <span className="race-card-title">
        {race.meetingName} {race.sessionName === "Sprint" && <span className="sprint-tag">Sprint</span>}
      </span>
      <span className="race-card-meta">
        {race.circuitShortName} · {race.countryName}
      </span>
    </Link>
  );
}
