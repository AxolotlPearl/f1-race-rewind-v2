// src/components/FastestPits.jsx
// 8 พิทสต็อปที่เร็วที่สุด (server เรียงด้วย mergeSort มาให้แล้ว) — แสดงผลล้วน ไม่มี state

import { Link } from "react-router-dom";
import { EmptyState } from "./StatusViews.jsx";
import DriverHover from "./DriverHover.jsx";

export default function FastestPits({ sessionKey, pits, year }) {
  if (pits.length === 0) return <EmptyState title="ไม่มีข้อมูลการเข้าพิทสำหรับเรซนี้" />;
  return (
    <ol className="pits-list">
      {pits.slice(0, 8).map((p, i) => (
        <li key={`${p.driverNumber}-${p.lap}-${i}`}>
          <span className="team-dot" style={{ "--dot-color": `#${p.teamColour}` }} />
          <DriverHover year={year} driverNumber={p.driverNumber}>
            <Link to={`/race/${sessionKey}/driver/${p.driverNumber}`}>{p.fullName}</Link>
          </DriverHover> — {p.pitDuration.toFixed(1)}s (รอบ {p.lap ?? "-"})
        </li>
      ))}
    </ol>
  );
}
