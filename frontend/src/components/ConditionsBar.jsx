// src/components/ConditionsBar.jsx
// แถบเหนือแผนที่: สถานะสนาม (ธงเขียว / Safety Car / VSC / ธงแดง / ธงเหลืองรายมินิเซกเตอร์ / จบเรซ)
// + สภาพอากาศ ณ เวลาที่แผนที่เล่นอยู่ (อากาศ, พื้นสนาม, ความชื้น, ลม, ฝน)
// ไม่มี state — คำนวณจาก model + timeMs ด้วย useMemo

import { memo, useMemo } from "react";
import { conditionsAt } from "../player/leaderboardModel.js";

const STATUS = {
  green: { label: "ธงเขียว", icon: "🟢", tone: "green" },
  sc: { label: "Safety Car", icon: "🚨", tone: "sc" },
  vsc: { label: "Virtual Safety Car", icon: "🟨", tone: "sc" },
  red: { label: "ธงแดง หยุดการแข่ง", icon: "🟥", tone: "red" },
  chequered: { label: "จบการแข่ง", icon: "🏁", tone: "done" },
};
// OpenF1 ให้ทิศที่ลม "พัดมา" (0° = เหนือ) — ลูกศรชี้ทิศที่ลม "พัดไป"
const WIND_ARROWS = ["↓", "↙", "←", "↖", "↑", "↗", "→", "↘"];

function ConditionsBar({ model, timeMs }) {
  const c = useMemo(() => (timeMs == null ? null : conditionsAt(model, timeMs)), [model, timeMs]);
  if (!c) return <div className="conditions-bar" />;
  const st = STATUS[c.status] ?? STATUS.green;
  const w = c.weather;
  const sectors = c.yellowSectors;
  const yellowOnly = sectors.length > 0 && st.tone === "green";

  return (
    <div className="conditions-bar">
      <span className={`track-status tone-${yellowOnly ? "yellow" : st.tone}`}>
        {yellowOnly ? `🟡 ธงเหลือง · มินิเซกเตอร์ ${sectors.join(", ")}` : `${st.icon} ${st.label}`}
        {!yellowOnly && sectors.length > 0 && st.tone !== "done" && <small> · เหลืองที่มินิเซกเตอร์ {sectors.join(", ")}</small>}
      </span>
      {w && (
        <span className="weather">
          <span title="สภาพอากาศ">{w.rain ? "🌧️ ฝนตก" : "☀️ แห้ง"}</span>
          <span title="อุณหภูมิอากาศ">🌡️ อากาศ {w.air?.toFixed(1)}°C</span>
          <span title="อุณหภูมิพื้นสนาม">🛣️ สนาม {w.track?.toFixed(1)}°C</span>
          <span title="ความชื้น">💧 {Math.round(w.humidity)}%</span>
          <span title="ความเร็วลม / ทิศที่ลมพัดไป">
            🍃 {w.wind?.toFixed(1)} m/s {w.windDir != null && WIND_ARROWS[Math.round(w.windDir / 45) % 8]}
          </span>
        </span>
      )}
    </div>
  );
}

export default memo(ConditionsBar);
