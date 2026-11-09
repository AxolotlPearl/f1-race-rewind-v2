// src/components/RaceLeaderboard.jsx
// ตารางอันดับแบบหน้าจอถ่ายทอดสด ข้างแผนที่ — อัปเดตตามเวลาที่แผนที่เล่นอยู่
// แต่ละแถว: อันดับ · สีทีม · ชื่อย่อ · ช่องว่างเวลา · ยาง · สถานะ (PIT / OUT / 🏁 / รอบเร็วสุด)
//
// state ของ component นี้:
//   gapMode — "leader" (ห่างผู้นำ) | "interval" (ห่างคันหน้า) กดสลับที่หัวตาราง
// props: model (จาก prepareLeaderboard), drivers, timeMs (เวลาบนแผนที่), focusDriver, onFocus
// แถวคำนวณด้วย useMemo จาก timeMs — ไม่เก็บซ้ำเป็น state

import { memo, useMemo, useState } from "react";
import { leaderboardAt } from "../player/leaderboardModel.js";

const TYRE_NAME = { S: "Soft", M: "Medium", H: "Hard", I: "Intermediate", W: "Wet" };

function formatGap(value, isLeader, mode) {
  if (isLeader) return mode === "leader" ? "Leader" : "Interval";
  if (value == null) return "";
  if (typeof value === "string") return value.replace(" LAPS", "L").replace(" LAP", "L");
  return `+${value.toFixed(value >= 100 ? 0 : 1)}`;
}

function RaceLeaderboard({ model, drivers, timeMs, focusDriver, onFocus }) {
  const [gapMode, setGapMode] = useState("leader");
  const board = useMemo(() => (timeMs == null ? null : leaderboardAt(model, drivers, timeMs)), [model, drivers, timeMs]);
  if (!board) return null;

  return (
    <div className="race-board" aria-label="อันดับระหว่างแข่ง">
      <div className="board-head">
        <span className="board-lap">
          LAP <strong>{Math.max(board.lap, 1)}</strong>/{board.totalLaps}
        </span>
        <div className="board-toggle" role="group" aria-label="แสดงช่องว่างเวลา">
          <button type="button" className={gapMode === "leader" ? "active" : ""} onClick={() => setGapMode("leader")}>
            ผู้นำ
          </button>
          <button type="button" className={gapMode === "interval" ? "active" : ""} onClick={() => setGapMode("interval")}>
            คันหน้า
          </button>
        </div>
      </div>

      <ol className="board-list">
        {board.rows.map((r, i) => {
          const d = r.driver;
          const isLeader = i === 0 && !r.out;
          const focused = focusDriver === d.driverNumber;
          return (
            <li
              key={d.driverNumber}
              className={["board-row", r.out && "out", focused && "focused", focusDriver != null && !focused && "faded"].filter(Boolean).join(" ")}
              style={{ "--team-color": `#${d.teamColour}` }}
              onClick={() => onFocus(focused ? null : d.driverNumber)}
              title={`${d.fullName} · ${d.teamName}`}
            >
              <span className="board-pos">{r.out ? "–" : r.position ?? "–"}</span>
              <span className="board-team" />
              <span className="board-name">{d.acronym}</span>
              <span className="board-gap">{r.out ? "OUT" : formatGap(gapMode === "leader" ? r.gap : r.interval, isLeader, gapMode)}</span>
              <span className="board-tyre">
                {r.compound && !r.out && (
                  <span className={`tyre tyre-${r.compound}`} title={TYRE_NAME[r.compound]}>
                    {r.compound}
                  </span>
                )}
              </span>
              <span className="board-flags">
                {r.inPit && !r.out && <span className="flag-pit">PIT</span>}
                {r.fastest && <span className="flag-fastest" title="รอบเร็วสุดขณะนี้">⏱</span>}
                {r.finished && !r.out && <span title="เข้าเส้นชัยแล้ว">🏁</span>}
              </span>
            </li>
          );
        })}
      </ol>
      {board.fastestLap && (
        <p className="board-foot">
          ⏱ รอบเร็วสุด {drivers.find((d) => d.driverNumber === board.fastestLap[1])?.acronym ?? board.fastestLap[1]}{" "}
          {Math.floor(board.fastestLap[2] / 60)}:{(board.fastestLap[2] % 60).toFixed(3).padStart(6, "0")} (รอบ {board.fastestLap[3]})
        </p>
      )}
    </div>
  );
}

// memo: RaceStage re-render ทุกครั้งที่เวลาเปลี่ยนอยู่แล้ว ไม่ต้อง re-render ซ้ำเมื่อ props เดิม
export default memo(RaceLeaderboard);
