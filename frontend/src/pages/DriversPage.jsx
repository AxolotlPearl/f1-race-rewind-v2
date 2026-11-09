// src/pages/DriversPage.jsx — /drivers?year=2025&driver=4 | &team=McLaren
// หน้านักแข่ง: รายชื่อนักแข่งทั้งฤดูกาลแบบการ์ดรูป จัดกลุ่มตามทีม (เรียงตามอันดับทีม) พร้อมโลโก้ทีม
// กดการ์ดนักแข่ง = บัตรนักแข่ง, กดหัวทีม/โลโก้ = บัตรทีม (บัตรชุดเดียวกับหน้าตารางคะแนน ผ่าน SeasonCards)
//
// state ของหน้านี้: filter — ข้อความค้นชื่อนักแข่ง/ทีม/เบอร์ (กรองทันทีใน memory ไม่ยิง API)
// ส่วน ปี/บัตรที่เปิด อยู่ใน URL ผ่าน useSeason() เหมือนหน้าตารางคะแนน

import { useMemo, useState } from "react";
import { useSeason } from "../hooks/useSeason.js";
import SeasonCards from "../components/SeasonCards.jsx";
import TeamLogo from "../components/TeamLogo.jsx";
import DriverHover from "../components/DriverHover.jsx";
import { Skeleton, EmptyState, ErrorState } from "../components/StatusViews.jsx";
import { headshot } from "../photo.js";

function DriverTile({ driver, year, onOpen }) {
  return (
    <DriverHover year={year} driverNumber={driver.driverNumber}>
      <button type="button" className="driver-tile" style={{ "--team-color": `#${driver.teamColour}` }} onClick={() => onOpen(driver.driverNumber)}>
        <span className="tile-number">{driver.driverNumber}</span>
        {driver.headshotUrl ? <img className="tile-photo" src={headshot(driver.headshotUrl)} alt="" loading="lazy" /> : <span className="tile-photo placeholder">{driver.acronym}</span>}
        <span className="tile-body">
          <span className="tile-first">{driver.firstName ?? ""}</span>
          <span className="tile-last">{driver.lastName ?? driver.fullName}</span>
          <span className="tile-meta">
            P{driver.rank} · {driver.points} คะแนน
          </span>
        </span>
      </button>
    </DriverHover>
  );
}

export default function DriversPage() {
  const season = useSeason();
  const { yearsReq, year, standingsReq, data, lookup, showDriver, showTeam, setYear } = season;
  const [filter, setFilter] = useState("");

  // จัดกลุ่มนักแข่งตาม "ทีมล่าสุด" เรียงตามอันดับทีม — คำนวณจาก data + filter จึงใช้ useMemo ไม่เก็บเป็น state
  // ใช้ HashTable ของ lookup.teams หาอันดับทีม O(1) ต่อคน
  const groups = useMemo(() => {
    if (!data || !lookup) return [];
    const q = filter.trim().toLowerCase();
    const matches = (d) =>
      !q || d.fullName.toLowerCase().includes(q) || d.acronym.toLowerCase().includes(q) || String(d.driverNumber) === q || d.teamName.toLowerCase().includes(q);
    return data.teams
      .map((team) => ({ team, drivers: data.drivers.filter((d) => d.teamName === team.teamName && matches(d)) }))
      .filter((g) => g.drivers.length > 0);
  }, [data, lookup, filter]);

  const total = groups.reduce((n, g) => n + g.drivers.length, 0);

  return (
    <div className="drivers-page">
      <section className="page-head">
        <h1>🧑‍✈️ นักแข่ง {year ?? ""}</h1>
        <p className="page-sub">นักแข่งทุกคนในฤดูกาล จัดตามทีม</p>
      </section>

      <div className="scoreboard-toolbar">
        {yearsReq.status === "success" && (
          <div className="year-chips" role="tablist" aria-label="ฤดูกาล">
            {yearsReq.data.years.map((y) => (
              <button key={y} type="button" role="tab" aria-selected={y === year} className={`chip ${y === year ? "active" : ""}`} onClick={() => setYear(y)}>
                {y}
              </button>
            ))}
          </div>
        )}
        <input type="search" className="filter-input" placeholder="ค้นชื่อ / เบอร์ / ทีม" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="ค้นหานักแข่ง" />
      </div>

      {yearsReq.status === "error" && <ErrorState error={yearsReq.error} onRetry={yearsReq.reload} />}
      {standingsReq.status === "loading" && <Skeleton variant="race-card" count={8} />}
      {standingsReq.status === "error" && <ErrorState title="โหลดรายชื่อนักแข่งไม่สำเร็จ" error={standingsReq.error} onRetry={standingsReq.reload} />}
      {standingsReq.status === "empty" && <EmptyState title={`ยังไม่มีเรซที่แข่งจบในปี ${year}`} hint="เลือกปีก่อนหน้า" />}

      {data && total === 0 && (
        <EmptyState title={`ไม่พบนักแข่งที่ตรงกับ “${filter}”`} hint="ลองชื่อย่อ เช่น VER หรือเบอร์รถ">
          <button type="button" onClick={() => setFilter("")}>
            ล้างคำค้น
          </button>
        </EmptyState>
      )}

      {groups.map(({ team, drivers }) => (
        <section key={team.teamName} className="team-group" style={{ "--team-color": `#${team.teamColour}` }}>
          <button type="button" className="team-group-head" onClick={() => showTeam(team.teamName)}>
            <TeamLogo teamName={team.teamName} colour={team.teamColour} year={year} size={40} />
            <span className="team-group-name">{team.teamName}</span>
            <span className="team-group-meta">
              อันดับทีม {team.rank} · {team.points} คะแนน ›
            </span>
          </button>
          <div className="driver-tiles">
            {drivers.map((d) => (
              <DriverTile key={d.driverNumber} driver={d} year={year} onOpen={showDriver} />
            ))}
          </div>
        </section>
      ))}

      <SeasonCards {...season} />
    </div>
  );
}
