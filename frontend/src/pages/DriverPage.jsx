// src/pages/DriverPage.jsx — /race/:sessionKey/driver/:driverNumber
// ฟีเจอร์ UX ใหม่: "เจาะนักขับ" — แฟน F1 ส่วนใหญ่ตามเชียร์นักขับคนเดียว อยากรู้ว่า "คนของฉันเป็นยังไงในเรซนี้"
// งานแรกต้องเลือกนักขับใน dropdown กรองไทม์ไลน์ แล้วนับเอง (แซงกี่ครั้ง/โดนแซงกี่ครั้ง/พิทเร็วไหม)
// หน้านี้ Express สรุปให้แล้ว (backend/lib/driverStory.js) + เปลี่ยนนักขับได้ทันทีจากแถบด้านบน
//
// state: ไม่มี state ของตัวเองนอกจากผลโหลด (useAsync) — นักขับที่ดูอยู่มาจาก URL (useParams)
// เพราะ URL คือ "แหล่งความจริง" อยู่แล้ว: แชร์ลิงก์/กด back/รีเฟรชได้ ถ้าเก็บซ้ำเป็น state จะเสี่ยงไม่ตรงกับ URL

import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api.js";
import { useAsync } from "../hooks/useAsync.js";
import TimelineCard from "../components/TimelineCard.jsx";
import DriverHover from "../components/DriverHover.jsx";
import { Skeleton, EmptyState, ErrorState } from "../components/StatusViews.jsx";

function StatCard({ label, value, sub, color }) {
  return (
    <div className="stat-card" style={color ? { "--team-color": `#${color}` } : undefined}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export default function DriverPage({ onVisitRace, onVisitDriver }) {
  const { sessionKey: rawKey, driverNumber: rawDriver } = useParams();
  const sessionKey = Number(rawKey);
  const driverNumber = Number(rawDriver);

  const infoReq = useAsync((signal) => api.raceInfo(sessionKey, signal), [sessionKey]);
  const storyReq = useAsync((signal) => api.driver(sessionKey, driverNumber, signal), [sessionKey, driverNumber], {
    isEmpty: (s) => s.events.length === 0 && !s.result,
  });

  const race = infoReq.status === "success" ? infoReq.data : null;
  const story = storyReq.status === "success" || storyReq.status === "empty" ? storyReq.data : null;

  // แจ้ง App (ยก state ขึ้น) ให้ NavBar/breadcrumb แสดงชื่อเรซและชื่อย่อนักขับ
  useEffect(() => {
    if (race && story) onVisitDriver(race, story.driver);
    else if (race) onVisitRace(race);
  }, [race, story, onVisitRace, onVisitDriver]);

  const s = story?.stats;
  const color = story?.driver.teamColour;

  return (
    <div className="driver-page">
      <section className="page-head" style={color ? { "--team-color": `#${color}` } : undefined}>
        {storyReq.status === "loading" && <Skeleton variant="title" />}
        {story && (
          <>
            <h1 className="driver-title">
              <span className="driver-number">#{story.driver.driverNumber}</span> {story.driver.fullName}
            </h1>
            <p className="page-sub">
              {race ? (
                <Link to={`/standings?year=${race.year}&team=${encodeURIComponent(story.driver.teamName)}`} title="ดูบัตรทีมทั้งฤดูกาล">
                  {story.driver.teamName}
                </Link>
              ) : (
                story.driver.teamName
              )}
              {race && (
                <>
                  {" "}
                  · <Link to={`/race/${sessionKey}`}>{race.meetingName} {race.year}{race.sessionName === "Sprint" ? " (Sprint)" : ""}</Link>
                  {" "}
                  · <Link to={`/standings?year=${race.year}&driver=${driverNumber}`}>🏆 ผลทั้งฤดูกาล {race.year}</Link>
                </>
              )}
            </p>
          </>
        )}
      </section>

      {storyReq.status === "error" && <ErrorState title="โหลดข้อมูลนักขับไม่สำเร็จ" error={storyReq.error} onRetry={storyReq.reload} />}

      {story && (
        <>
          <nav className="driver-switcher" aria-label="เปลี่ยนนักขับ">
            <span className="toolbar-label">ดูคนอื่น:</span>
            {story.otherDrivers.map((d) => (
              <DriverHover key={d.driverNumber} year={race?.year} driverNumber={d.driverNumber}>
                <Link to={`/race/${sessionKey}/driver/${d.driverNumber}`} className="driver-pill" style={{ "--team-color": `#${d.teamColour}` }}>
                  {d.acronym}
                </Link>
              </DriverHover>
            ))}
          </nav>

          <section className="stat-grid">
            <StatCard
              label="ผลจบ"
              color={color}
              value={story.result ? (story.result.dnf ? "DNF" : `P${story.result.position ?? "-"}`) : "-"}
              sub={story.result ? `${story.result.points} แต้ม · ${story.result.laps ?? "-"} รอบ` : "ไม่มีผลจบ"}
            />
            <StatCard label="แซงคนอื่น" value={s.overtakesMade} sub="ครั้ง" />
            <StatCard label="ถูกแซง" value={s.overtakesSuffered} sub="ครั้ง" />
            <StatCard
              label="เข้าพิท"
              value={s.pitCount}
              sub={s.bestPitRank ? `เร็วสุด ${s.bestPitRank.pitDuration.toFixed(1)}s (อันดับ ${s.bestPitRank.rank}/${s.bestPitRank.of} ของสนาม)` : "ไม่มีข้อมูลเวลาพิท"}
            />
            <StatCard
              label="คู่ปรับหลัก"
              color={s.mainRival?.driver?.teamColour}
              value={s.mainRival?.driver ? <Link to={`/race/${sessionKey}/driver/${s.mainRival.driver.driverNumber}`}>{s.mainRival.driver.acronym}</Link> : "-"}
              sub={s.mainRival ? `แซงเขา ${s.mainRival.made} · โดนเขาแซง ${s.mainRival.suffered}` : "ไม่มีการแซงกับใคร"}
            />
          </section>

          <section className="card">
            <h2>เหตุการณ์ของ {story.driver.acronym} ({story.events.length})</h2>
            {story.events.length === 0 ? (
              <EmptyState title="ไม่มีเหตุการณ์ของนักขับคนนี้ในข้อมูล" hint="บางเรซ OpenF1 ไม่มีข้อมูลการแซง (เช่นปี 2023)" />
            ) : (
              <>
                <p className="panel-hint">
                  อยากเห็นบนแผนที่? <Link to={`/race/${sessionKey}`}>เปิดหน้าเรซ</Link> แล้วคลิกการ์ดเหตุการณ์
                </p>
                <ul className="timeline-list driver-events">
                  {story.events.map((e) => (
                    <TimelineCard key={e.id} event={e} year={race?.year} />
                  ))}
                </ul>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
