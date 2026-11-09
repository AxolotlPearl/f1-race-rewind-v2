// src/components/RaceStage.jsx
// "เวที" ของหน้าเรซ: แผนที่ (ซ้าย) + Race Leaderboard (ขวา) + แถบเหตุการณ์ล่าสุดใต้แผนที่
//
// state ที่อยู่ที่นี่ (ไม่ยกขึ้นไป RacePage) เพราะเปลี่ยนบ่อย ~4 ครั้ง/วินาทีตอนเล่น:
//   timeMs      — เวลาบนแผนที่ (TrackMap ส่งขึ้นมา) → leaderboard ใช้คำนวณอันดับ ณ เวลานั้น
//   focusDriver — นักขับที่คลิกใน leaderboard → TrackMap ทำให้คันนั้นสว่าง คันอื่นจาง
// ถ้าเก็บไว้ที่ RacePage ทั้งหน้า (รวมไทม์ไลน์หลายร้อยการ์ด) จะ re-render ตามทุกครั้ง
//
// โหลด leaderboard แยก (useAsync) — ถ้าโหลดไม่ได้ แผนที่ยังใช้ได้ตามปกติ

import { useMemo, useState } from "react";
import { api } from "../api.js";
import { useAsync } from "../hooks/useAsync.js";
import { prepareLeaderboard } from "../player/leaderboardModel.js";
import TrackMap from "./TrackMap.jsx";
import RaceLeaderboard from "./RaceLeaderboard.jsx";
import { TYPE_ICON } from "./TimelineCard.jsx";
import { Skeleton } from "./StatusViews.jsx";

export default function RaceStage({ race, timeline, playRequest, currentEventId, onEventChange }) {
  const [timeMs, setTimeMs] = useState(null);
  const [focusDriver, setFocusDriver] = useState(null);

  const boardReq = useAsync((signal) => api.leaderboard(race.sessionKey, signal), [race.sessionKey]);
  const model = useMemo(() => (boardReq.status === "success" ? prepareLeaderboard(boardReq.data) : null), [boardReq.status, boardReq.data]);

  const currentEvent = currentEventId ? timeline.events.find((e) => e.id === currentEventId) : null;

  return (
    <div className="race-stage">
      <div className="stage-map">
        <TrackMap race={race} timeline={timeline} playRequest={playRequest} onEventChange={onEventChange} onTimeChange={setTimeMs} focusDriver={focusDriver} />
        {currentEvent && (
          <p className="event-ticker" aria-live="polite">
            <span className="ticker-icon">{TYPE_ICON[currentEvent.type] ?? "•"}</span>
            <span className="ticker-text">{currentEvent.message}</span>
          </p>
        )}
      </div>
      <aside className="stage-board">
        {boardReq.status === "loading" && <Skeleton variant="row" count={10} />}
        {boardReq.status === "error" && <p className="dim board-empty">โหลดตารางอันดับไม่สำเร็จ</p>}
        {model && <RaceLeaderboard model={model} drivers={timeline.drivers} timeMs={timeMs} focusDriver={focusDriver} onFocus={setFocusDriver} />}
      </aside>
    </div>
  );
}
