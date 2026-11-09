// src/pages/HomePage.jsx
// หน้าแรก: ทางเข้าเรซ 3 ทาง ให้ผู้ใช้ถึงเรซที่อยากดูด้วยจำนวนขั้นน้อยที่สุด
//   1. ค้นหา (SearchBox) — รู้ชื่อสนาม: พิมพ์ 3 ตัว + Enter = ถึงหน้าเรซ (งานแรกต้องเลือกปี → เลื่อนหาใน dropdown)
//   2. "ดูต่อจากครั้งก่อน" — เรซที่ดูล่าสุด (ส่งมาจาก App)
//   3. เลือกตามฤดูกาล — ปุ่มปี + การ์ดเรซทั้งปี (เห็นทั้งปฏิทินในจอเดียว ไม่ต้องเปิด dropdown)
//
// เป็นหน้า dashboard: คอลัมน์ซ้าย = ค้นหา, นับถอยหลังสนามต่อไป, ปฏิทินฤดูกาล, ดูย้อนหลัง
//                    คอลัมน์ขวา = ผู้นำอันดับ 1 + ตารางคะแนน 10 อันดับ (StandingsSidebar)
//
// state: year     — ปีที่กำลังเลือกดูในส่วน "ดูย้อนหลังตามฤดูกาล" (null = ใช้ปีล่าสุดจาก API อัตโนมัติ)
//        showPast — ปฏิทินแสดงสนามที่แข่งจบแล้วด้วยไหม (ค่าเริ่มต้นแสดงเฉพาะที่ยังไม่แข่ง ให้สั้น)

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAsync } from "../hooks/useAsync.js";
import SearchBox from "../components/SearchBox.jsx";
import RaceCard from "../components/RaceCard.jsx";
import NextRaceCountdown from "../components/NextRaceCountdown.jsx";
import SeasonCalendar from "../components/SeasonCalendar.jsx";
import StandingsSidebar from "../components/StandingsSidebar.jsx";
import { Skeleton, EmptyState, ErrorState } from "../components/StatusViews.jsx";

export default function HomePage({ recentRace }) {
  const navigate = useNavigate();
  const [year, setYear] = useState(null);
  const [showPast, setShowPast] = useState(false);

  // ปฏิทินปีปัจจุบัน + สนามต่อไป
  const calendarReq = useAsync((signal) => api.calendar(null, signal), [], { isEmpty: (c) => c.rounds.length === 0 });
  const calendar = calendarReq.status === "success" ? calendarReq.data : null;
  // reload จาก useAsync เป็นฟังก์ชันเดิมทุก render (useCallback ใน hook) — ส่งให้ NextRaceCountdown ใส่ใน deps ได้
  const reloadCalendar = calendarReq.reload;

  const yearsReq = useAsync((signal) => api.years(signal), []);
  // ปีที่แสดง = ที่ผู้ใช้เลือก หรือปีล่าสุดจาก API — คำนวณได้ จึงไม่เก็บเป็น state แยก
  const shownYear = year ?? yearsReq.data?.years?.[0] ?? null;

  const racesReq = useAsync((signal) => api.races(shownYear, signal), [shownYear], {
    enabled: shownYear != null,
    isEmpty: (d) => d.races.length === 0,
  });

  const races = racesReq.data?.races ?? [];
  const latest = racesReq.status === "success" ? races[races.length - 1] : null;

  return (
    <div className="home-page dashboard">
      <div className="dashboard-main">
      <section className="hero">
        <h1>ดูย้อนหลังว่าเรซ F1 เกิดอะไรขึ้น</h1>
        <p className="tagline">ไทม์ไลน์การแซง · เข้าพิท · ธง พร้อมแผนที่สนามที่รถวิ่งจริง</p>
        <SearchBox onPick={(race) => navigate(`/race/${race.sessionKey}`)} />
      </section>

      <section className="home-section">
        {calendarReq.status === "loading" && <Skeleton variant="map" />}
        {calendarReq.status === "error" && <ErrorState title="โหลดปฏิทินไม่สำเร็จ" error={calendarReq.error} onRetry={calendarReq.reload} />}
        {calendar && <NextRaceCountdown next={calendar.next} onFinished={reloadCalendar} />}
      </section>

      {calendar && (
        <section className="home-section">
          <div className="section-head">
            <h2>
              📅 ปฏิทินฤดูกาล {calendar.year} <small className="dim">แข่งแล้ว {calendar.completed}/{calendar.total} สนาม</small>
            </h2>
            <button type="button" className="chip" onClick={() => setShowPast((v) => !v)}>
              {showPast ? "ซ่อนสนามที่จบแล้ว" : "แสดงทั้งฤดูกาล"}
            </button>
          </div>
          <SeasonCalendar rounds={calendar.rounds} showPast={showPast} />
        </section>
      )}

      {recentRace && (
        <section className="home-section">
          <h2>ดูต่อจากครั้งก่อน</h2>
          <div className="race-grid single">
            <RaceCard race={recentRace} featured />
          </div>
        </section>
      )}

      <section className="home-section">
        <div className="section-head">
          <h2>ดูย้อนหลังตามฤดูกาล</h2>
          {yearsReq.status === "success" && (
            <div className="year-chips" role="tablist" aria-label="ฤดูกาล">
              {yearsReq.data.years.map((y) => (
                <button key={y} type="button" role="tab" aria-selected={y === shownYear} className={`chip ${y === shownYear ? "active" : ""}`} onClick={() => setYear(y)}>
                  {y}
                </button>
              ))}
            </div>
          )}
        </div>

        {yearsReq.status === "error" && <ErrorState error={yearsReq.error} onRetry={yearsReq.reload} />}
        {racesReq.status === "loading" && <Skeleton variant="race-card" count={8} />}
        {racesReq.status === "error" && <ErrorState title="โหลดรายชื่อเรซไม่สำเร็จ" error={racesReq.error} onRetry={racesReq.reload} />}
        {racesReq.status === "empty" && (
          <EmptyState title={`ยังไม่มีเรซที่แข่งจบในปี ${shownYear}`} hint="เลือกปีก่อนหน้า หรือค้นหาด้านบน" />
        )}
        {racesReq.status === "success" && (
          <>
            {latest && (
              <p className="section-note">
                เรซล่าสุดของปีนี้: <strong>{latest.meetingName}</strong>
              </p>
            )}
            <div className="race-grid">
              {/* ล่าสุดก่อน: ผู้ใช้ส่วนใหญ่อยากดูเรซที่เพิ่งจบ */}
              {races
                .slice()
                .reverse()
                .map((r, i) => (
                  <RaceCard key={r.sessionKey} race={r} featured={i === 0} />
                ))}
            </div>
          </>
        )}
      </section>
      </div>

      <StandingsSidebar year={calendar?.year ?? yearsReq.data?.years?.[0] ?? null} />
    </div>
  );
}
