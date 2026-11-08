// src/pages/RacePage.jsx — /race/:sessionKey
// หน้าเรซ: สรุป + แผนที่ + ไทม์ไลน์ + ผลจบ + พิทเร็วสุด
//
// state ที่วางไว้ที่ RacePage (แม่) เพราะ "ลูก 2 ตัวต้องใช้ร่วมกัน":
//   currentEventId : TrackMap เป็นคนเปลี่ยน (เวลาบนแผนที่เดิน) → TimelinePanel ใช้ไฮไลต์/เลื่อนการ์ด
//   playRequest    : TimelinePanel เป็นคนเปลี่ยน (ผู้ใช้คลิกการ์ด) → TrackMap ใช้สั่งเล่นคลิป
//   ถ้าเก็บไว้ในลูกตัวใดตัวหนึ่ง อีกตัวจะเข้าถึงไม่ได้ (props ไหลลงอย่างเดียว) จึงยกขึ้นมาที่แม่ร่วม
// ส่วน state ที่ใช้ตัวเดียว (sort/filter ของไทม์ไลน์, การเรียงตารางผล) อยู่ในลูกตัวนั้นเอง

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api.js";
import { useAsync } from "../hooks/useAsync.js";
import SummaryBar from "../components/SummaryBar.jsx";
import TrackMap from "../components/TrackMap.jsx";
import TimelinePanel from "../components/TimelinePanel.jsx";
import ResultsTable from "../components/ResultsTable.jsx";
import FastestPits from "../components/FastestPits.jsx";
import { Skeleton, EmptyState, ErrorState } from "../components/StatusViews.jsx";

const dateFormat = new Intl.DateTimeFormat("th-TH", { dateStyle: "long" });

export default function RacePage({ onVisitRace }) {
  const { sessionKey: rawKey } = useParams();
  const sessionKey = Number(rawKey);
  const validKey = Number.isInteger(sessionKey) && sessionKey > 0;

  const [currentEventId, setCurrentEventId] = useState(null);
  const [playRequest, setPlayRequest] = useState(null);

  // โหลด 2 อย่างพร้อมกัน (ไม่รอกัน): หัวเรื่องเรซ + ไทม์ไลน์ — deps = [sessionKey] เปลี่ยนเรซเมื่อไหร่ค่อยโหลดใหม่
  const infoReq = useAsync((signal) => api.raceInfo(sessionKey, signal), [sessionKey], { enabled: validKey });
  const timelineReq = useAsync((signal) => api.timeline(sessionKey, infoReq.data?.dateEnd, signal), [sessionKey], {
    enabled: validKey,
    isEmpty: (t) => t.events.length === 0 && t.sessionResult.length === 0,
  });

  // เปลี่ยนเรซ → ล้างเหตุการณ์ปัจจุบัน/คลิปของเรซเก่า
  useEffect(() => {
    setCurrentEventId(null);
    setPlayRequest(null);
  }, [sessionKey]);

  // แจ้ง App ว่ากำลังดูเรซนี้ (ให้ NavBar ทำเมนู "เรซที่ดูล่าสุด") — ทำเฉพาะตอนได้หัวเรื่องเรซใหม่
  // onVisitRace มาจาก useCallback ใน App จึงเป็นฟังก์ชันเดิมทุก render ไม่ทำให้ effect วนซ้ำ
  const race = infoReq.status === "success" ? infoReq.data : null;
  useEffect(() => {
    if (race) onVisitRace(race);
  }, [race, onVisitRace]);

  if (!validKey) return <ErrorState title="ลิงก์เรซไม่ถูกต้อง" error={{ status: 404, message: "ตรวจสอบ URL หรือกลับไปค้นหาจากหน้าแรก" }} />;

  // เรซที่ไม่มีอยู่จริง (ลิงก์ผิด/เรซยังไม่แข่ง) → บอกตรง ๆ แล้วพากลับไปค้นหา ไม่ปล่อย skeleton ค้าง
  if (infoReq.status === "error" && infoReq.error.status === 404) {
    return (
      <div className="race-page">
        <ErrorState title="ไม่พบเรซนี้" error={infoReq.error} />
        <p className="center-link">
          <Link to="/">← กลับไปค้นหาเรซ</Link>
        </p>
      </div>
    );
  }

  const timeline = timelineReq.status === "success" ? timelineReq.data : null;
  const hasRaceData = timelineReq.status === "loading" || timelineReq.status === "success";

  return (
    <div className="race-page">
      <section className="page-head">
        {infoReq.status === "loading" && <Skeleton variant="title" />}
        {infoReq.status === "error" && <ErrorState title="ไม่พบข้อมูลเรซนี้" error={infoReq.error} onRetry={infoReq.reload} />}
        {race && (
          <>
            <h1>
              {race.meetingName} {race.year} {race.sessionName === "Sprint" && <span className="sprint-tag">Sprint</span>}
            </h1>
            <p className="page-sub">
              {race.circuitShortName}, {race.countryName} · {dateFormat.format(new Date(race.dateStart))}
            </p>
          </>
        )}
      </section>

      <section className="summary-bar" aria-label="สรุปเรซ">
        {timelineReq.status === "loading" && <Skeleton variant="chip" count={4} />}
        {timeline && <SummaryBar sessionKey={sessionKey} summary={timeline.summary} dataAvailability={timeline.dataAvailability} />}
      </section>

      {timelineReq.status === "error" && <ErrorState title="โหลดข้อมูลเรซไม่สำเร็จ" error={timelineReq.error} onRetry={timelineReq.reload} />}
      {timelineReq.status === "empty" && (
        <EmptyState title="OpenF1 ยังไม่มีข้อมูลของเรซนี้" hint="เรซที่เพิ่งแข่งจบอาจต้องรอข้อมูลสักพัก">
          <Link to="/">เลือกเรซอื่น</Link>
        </EmptyState>
      )}

      {hasRaceData && (
        <section className="card map-card" aria-label="แผนที่สนาม">
          <h2>แผนที่สนาม</h2>
          {(timelineReq.status === "loading" || infoReq.status === "loading") && <Skeleton variant="map" />}
          {timeline && race && <TrackMap race={race} timeline={timeline} playRequest={playRequest} onEventChange={setCurrentEventId} />}
        </section>
      )}

      {hasRaceData && (
      <section className="content-grid">
        <div>
          {timelineReq.status === "loading" && <Skeleton variant="card" count={6} />}
          {timeline && (
            <TimelinePanel
              events={timeline.events}
              drivers={timeline.drivers}
              currentEventId={currentEventId}
              // object ใหม่ทุกคลิก → TrackMap รู้ว่าต้องเล่น แม้คลิกการ์ดเดิมซ้ำ
              onSelectEvent={(event) => setPlayRequest({ event })}
            />
          )}
        </div>
        <div className="side-panel">
          <section className="card">
            <h2>ผลจบการแข่ง</h2>
            <p className="panel-hint">คลิกชื่อนักขับเพื่อดูเรื่องราวของเขาในเรซนี้</p>
            {timelineReq.status === "loading" && <Skeleton variant="row" count={5} />}
            {timeline && <ResultsTable sessionKey={sessionKey} results={timeline.sessionResult} />}
          </section>
          <section className="card">
            <h2>พิทสต็อปเร็วสุด</h2>
            {timelineReq.status === "loading" && <Skeleton variant="row" count={3} />}
            {timeline && <FastestPits sessionKey={sessionKey} pits={timeline.fastestPits} />}
          </section>
        </div>
      </section>
      )}
    </div>
  );
}
