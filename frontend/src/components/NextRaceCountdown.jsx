// src/components/NextRaceCountdown.jsx
// นับถอยหลังถึงเรซสนามต่อไป (วัน ชั่วโมง นาที วินาที) + สถานที่, ธงชาติ, รูปสนาม, เวลาควอลิฟาย/สปรินต์ (เวลาไทย)
//
// props: next (สนามต่อไปจาก /api/calendar), onFinished (callback ให้แม่โหลดปฏิทินใหม่)
// ใช้นาฬิกาเครื่องผู้ใช้ (ไม่ใช้เวลา server จากคำตอบ เพราะคำตอบถูก cache ได้ถึง 60 วินาที เวลาในนั้นจึงอาจเก่า)
// state: now — เวลาปัจจุบัน อัปเดตทุก 1 วินาทีด้วย setInterval
//   ทำไมเป็น state: ตัวเลขนับถอยหลังต้อง re-render ทุกวินาที; ส่วน "เหลืออีกเท่าไร" คำนวณจาก now ได้ จึงไม่เก็บซ้ำ

import { useEffect, useState } from "react";

const dateTimeFormat = new Intl.DateTimeFormat("th-TH", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function split(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return { days: Math.floor(total / 86400), hours: Math.floor((total % 86400) / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60 };
}

export default function NextRaceCountdown({ next, onFinished }) {
  const [now, setNow] = useState(() => Date.now());

  // effect: ตั้งนาฬิกาเดินทุก 1 วินาที; cleanup = clearInterval (ออกจากหน้าแล้ว timer ไม่ค้างทำงานต่อ)
  // deps []: ตั้งครั้งเดียวตอน mount ไม่ใช่ทุกครั้งที่ re-render (ไม่งั้นจะสร้าง timer ซ้อนกันทุกวินาที)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const start = next ? Date.parse(next.race.dateStart) : null;
  const end = next ? Date.parse(next.race.dateEnd) : null;
  const isLive = next && (next.status === "live" || (now >= start && now <= end));
  const isOver = next && now > end;

  // effect: เรซจบระหว่างเปิดหน้าอยู่ → ให้แม่โหลดปฏิทินใหม่ (สนามต่อไปเลื่อนเอง) ทำงานครั้งเดียวตอน isOver เปลี่ยนเป็น true
  useEffect(() => {
    if (isOver) onFinished?.();
  }, [isOver, onFinished]);

  if (!next) {
    return (
      <div className="countdown-card ended">
        <p className="countdown-kicker">🏁 สนามต่อไป</p>
        <h2>ฤดูกาลนี้แข่งครบแล้ว</h2>
        <p className="dim">ปฏิทินฤดูกาลหน้าจะขึ้นที่นี่เมื่อประกาศ</p>
      </div>
    );
  }

  const t = split(start - now);

  return (
    <div className={`countdown-card ${isLive ? "live" : ""}`}>
      {next.circuitImage && <img className="countdown-circuit" src={next.circuitImage} alt="" aria-hidden="true" />}
      <div className="countdown-info">
        <p className="countdown-kicker">
          {isLive ? "🔴 กำลังแข่งอยู่ตอนนี้" : `🏁 สนามต่อไป · รอบที่ ${next.round}`}
        </p>
        <h2 className="countdown-title">
          {next.countryFlag && <img className="flag" src={next.countryFlag} alt="" />} {next.meetingName}
        </h2>
        <p className="countdown-place">
          📍 {next.circuitShortName}, {next.location}, {next.countryName}
        </p>

        {!isLive && (
          <div className="countdown-digits" role="timer" aria-label={`อีก ${t.days} วัน ${t.hours} ชั่วโมง ${t.minutes} นาที`}>
            {[
              [t.days, "วัน"],
              [t.hours, "ชั่วโมง"],
              [t.minutes, "นาที"],
              [t.seconds, "วินาที"],
            ].map(([value, label]) => (
              <div key={label} className="digit-box">
                <strong>{String(value).padStart(2, "0")}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        )}

        <ul className="countdown-sessions">
          {next.qualifying && <li>ควอลิฟาย: {dateTimeFormat.format(new Date(next.qualifying.dateStart))}</li>}
          {next.sprint && <li>สปรินต์: {dateTimeFormat.format(new Date(next.sprint.dateStart))}</li>}
          <li>
            <strong>เรซ: {dateTimeFormat.format(new Date(next.race.dateStart))}</strong> (เวลาไทย)
          </li>
        </ul>
      </div>
    </div>
  );
}
