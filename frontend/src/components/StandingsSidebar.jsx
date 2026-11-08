// src/components/StandingsSidebar.jsx
// แถบขวาของหน้าแรก: การ์ดผู้นำอันดับ 1 + ตารางคะแนน 10 อันดับแรก (สลับนักแข่ง/ทีมได้)
//
// props: year — ฤดูกาลที่จะแสดง
// state: view — "drivers" | "teams" (แท็บของแถบนี้ ใช้แค่ที่นี่ จึงไม่ต้องยกขึ้นไป)
// ข้อมูลมาจาก seasonCache (ชุดเดียวกับหน้าตารางคะแนน/ป๊อปอัปโปรไฟล์ — ไม่โหลดซ้ำ)

import { useState } from "react";
import { Link } from "react-router-dom";
import { getSeason } from "../seasonCache.js";
import { useAsync } from "../hooks/useAsync.js";
import TeamLogo from "./TeamLogo.jsx";
import DriverHover from "./DriverHover.jsx";
import { Skeleton, EmptyState, ErrorState } from "./StatusViews.jsx";

const TOP_N = 10;

function LeaderCard({ leader, second, year }) {
  const gap = second ? leader.points - second.points : null;
  return (
    <Link to={`/standings?year=${year}&driver=${leader.driverNumber}`} className="leader-card" style={{ "--team-color": `#${leader.teamColour}` }}>
      <span className="leader-badge">🏆 อันดับ 1 · {year}</span>
      {leader.headshotUrl && <img className="leader-photo" src={leader.headshotUrl} alt="" />}
      <span className="leader-info">
        <span className="leader-first">{leader.firstName}</span>
        <span className="leader-last">{leader.lastName ?? leader.fullName}</span>
        <span className="leader-team">
          <TeamLogo teamName={leader.teamName} colour={leader.teamColour} year={year} size={22} /> {leader.teamName}
        </span>
        <span className="leader-points">
          <strong>{leader.points}</strong> คะแนน · {leader.wins} ชนะ
        </span>
        {gap != null && (
          <span className="leader-gap">
            นำ {second.acronym} อยู่ {gap} คะแนน
          </span>
        )}
      </span>
    </Link>
  );
}

export default function StandingsSidebar({ year }) {
  const [view, setView] = useState("drivers");
  const season = useAsync((signal) => getSeason(year), [year], {
    enabled: year != null,
    isEmpty: (s) => s.data.drivers.length === 0,
  });
  const data = season.status === "success" ? season.data.data : null;

  return (
    <aside className="standings-sidebar" aria-label="ตารางคะแนน">
      {season.status === "loading" && (
        <>
          <Skeleton variant="map" />
          <Skeleton variant="row" count={6} />
        </>
      )}
      {season.status === "error" && <ErrorState title="โหลดตารางคะแนนไม่สำเร็จ" error={season.error} onRetry={season.reload} />}
      {season.status === "empty" && <EmptyState title={`ยังไม่มีคะแนนของปี ${year}`} />}

      {data && (
        <>
          <LeaderCard leader={data.drivers[0]} second={data.drivers[1]} year={year} />

          <section className="card mini-standings">
            <div className="mini-head">
              <h2>ตารางคะแนน {year}</h2>
              <div className="view-tabs">
                <button type="button" className={`sort-btn ${view === "drivers" ? "active" : ""}`} onClick={() => setView("drivers")}>
                  นักแข่ง
                </button>
                <button type="button" className={`sort-btn ${view === "teams" ? "active" : ""}`} onClick={() => setView("teams")}>
                  ทีม
                </button>
              </div>
            </div>

            <ol className="mini-list">
              {view === "drivers"
                ? data.drivers.slice(0, TOP_N).map((d) => (
                    <li key={d.driverNumber} style={{ "--team-color": `#${d.teamColour}` }}>
                      <span className="mini-rank">{d.rank}</span>
                      <span className="team-bar" />
                      <DriverHover year={year} driverNumber={d.driverNumber}>
                        <Link to={`/standings?year=${year}&driver=${d.driverNumber}`} className="mini-name">
                          {d.fullName}
                        </Link>
                      </DriverHover>
                      <span className="mini-points">{d.points}</span>
                    </li>
                  ))
                : data.teams.slice(0, TOP_N).map((t) => (
                    <li key={t.teamName} style={{ "--team-color": `#${t.teamColour}` }}>
                      <span className="mini-rank">{t.rank}</span>
                      <TeamLogo teamName={t.teamName} colour={t.teamColour} year={year} size={20} />
                      <Link to={`/standings?year=${year}&view=teams&team=${encodeURIComponent(t.teamName)}`} className="mini-name">
                        {t.teamName}
                      </Link>
                      <span className="mini-points">{t.points}</span>
                    </li>
                  ))}
            </ol>
            <Link to={`/standings?year=${year}${view === "teams" ? "&view=teams" : ""}`} className="mini-more">
              ดูตารางคะแนนทั้งหมด ›
            </Link>
          </section>
        </>
      )}
    </aside>
  );
}
