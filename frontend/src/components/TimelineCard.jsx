// src/components/TimelineCard.jsx
// การ์ดเหตุการณ์ 1 ใบ — ใช้ทั้งในหน้าเรซ (TimelinePanel) และหน้านักขับ (DriverPage)
// ไม่มี state: ทุกอย่างมาจาก props, เหตุการณ์คลิกส่งกลับขึ้นไปผ่าน callback (onSelect / onDriverClick)

import { memo } from "react";

export const TYPE_ICON = { overtake: "🔁", pit: "🔧", flag: "🚩", safety_car: "🚨", drs: "⚡", other_control: "ℹ️" };
export const TYPE_LABEL = { overtake: "แซง", pit: "เข้าพิท", flag: "ธง", safety_car: "Safety Car", drs: "DRS", other_control: "อื่น ๆ" };
const FLAG_COLOR = { GREEN: "#2ea043", YELLOW: "#d29922", RED: "#f85149", BLUE: "#58a6ff", CHEQUERED: "#e6edf3", CLEAR: "#2ea043" };
const clockFormat = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

function TimelineCard({ event, isCurrent, dim, highlight, onSelect, onDriverClick }) {
  const teamColor = event.drivers[0]?.teamColour ?? "888888";
  const accent = event.type === "flag" && FLAG_COLOR[event.flag] ? FLAG_COLOR[event.flag] : `#${teamColor}`;
  const lapLabel = event.lap != null ? `รอบ ${event.lap}${event.lapIsEstimated ? " (~)" : ""}` : "รอบ -";
  const classes = ["timeline-card", isCurrent && "current-time", dim && "dimmed", highlight && "highlighted", onSelect && "clickable"].filter(Boolean).join(" ");

  return (
    <li data-id={event.id} className={classes} style={{ "--team-color": accent }} onClick={onSelect ? () => onSelect(event) : undefined} title={onSelect ? "คลิกเพื่อเล่นเหตุการณ์นี้บนแผนที่" : undefined}>
      <span className="icon">{TYPE_ICON[event.type] ?? "•"}</span>
      <div className="body">
        <div className="meta-row">
          <span className="lap-badge">{lapLabel}</span>
          <span>{clockFormat.format(Date.parse(event.date))}</span>
        </div>
        <div className="message">
          {event.message ?? "-"}{" "}
          {event.drivers.map((d) =>
            onDriverClick ? (
              <button
                type="button"
                key={d.driverNumber}
                className="driver-chip"
                style={{ color: `#${d.teamColour}` }}
                title="ไฮไลต์เหตุการณ์ของนักขับคนนี้"
                onClick={(e) => {
                  e.stopPropagation(); // ไม่ให้การ์ดเล่นคลิป
                  onDriverClick(d.driverNumber);
                }}
              >
                {d.acronym}
              </button>
            ) : (
              <span key={d.driverNumber} className="driver-chip static" style={{ color: `#${d.teamColour}` }}>
                {d.acronym}
              </span>
            )
          )}
        </div>
      </div>
    </li>
  );
}

// memo: เวลาเหตุการณ์ปัจจุบันเปลี่ยน มีแค่ 2 การ์ด (เก่า/ใหม่) ที่ props เปลี่ยนจริง อีกหลายร้อยใบไม่ต้อง re-render
export default memo(TimelineCard);
