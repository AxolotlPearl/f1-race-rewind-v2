// src/components/SeasonCalendar.jsx
// ปฏิทินฤดูกาลแบบการ์ดทีละสนาม: รอบ, ธง, ชื่อรายการ, วันแข่ง, สถานะ (จบแล้ว / กำลังแข่ง / ถัดไป / ยกเลิก)
// สนามที่แข่งจบแล้วกดเข้าไปดูเรซย้อนหลังได้ — ไม่มี state (แสดงผลจาก props ล้วน)
//
// props: rounds (จาก /api/calendar), showPast — แสดงทั้งฤดูกาลไหม (แม่เป็นคนสลับ)

import { Link } from "react-router-dom";

const dayFormat = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" });

const STATUS_LABEL = { done: "จบแล้ว", live: "กำลังแข่ง", next: "ถัดไป", upcoming: "", cancelled: "ยกเลิก" };

function RoundBody({ r }) {
  const weekend = `${dayFormat.format(new Date(r.weekendStart))} – ${dayFormat.format(new Date(r.race.dateStart))}`;
  return (
    <>
      <span className="cal-round">{r.round ?? "–"}</span>
      <span className="cal-main">
        <span className="cal-name">
          {r.countryFlag && <img className="flag" src={r.countryFlag} alt="" loading="lazy" />} {r.meetingName}
          {r.sprint && <span className="sprint-tag">Sprint</span>}
        </span>
        <span className="cal-meta">
          {weekend} · {r.circuitShortName}
        </span>
      </span>
      {STATUS_LABEL[r.status] && <span className={`cal-status ${r.status}`}>{STATUS_LABEL[r.status]}</span>}
    </>
  );
}

export default function SeasonCalendar({ rounds, showPast }) {
  // ย่อ = เฉพาะสนามที่ยังไม่แข่ง (กำลังแข่ง/ถัดไป/รอแข่ง); ขยาย = ทั้งฤดูกาลรวมที่จบแล้วและที่ถูกยกเลิก
  const visible = showPast ? rounds : rounds.filter((r) => r.status === "live" || r.status === "next" || r.status === "upcoming");
  return (
    <ol className="season-calendar">
      {visible.map((r) => (
        <li key={r.meetingKey} className={`cal-item ${r.status}`}>
          {r.status === "done" ? (
            <Link to={`/race/${r.race.sessionKey}`} className="cal-row" title="ดูเรซนี้ย้อนหลัง">
              <RoundBody r={r} />
            </Link>
          ) : (
            <div className="cal-row">
              <RoundBody r={r} />
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
