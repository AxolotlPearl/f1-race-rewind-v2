// src/pages/RacePage.jsx — /race/:sessionKey
// หน้าเรซ: สรุป → เวที (แผนที่ + Race Leaderboard) → แท็บ (ผลจบ / เหตุการณ์ / พิทสต็อป / คลิปไฮไลต์)
// แท็บที่เปิดอยู่เก็บใน URL (?tab=events) — แชร์ลิงก์/กด back แล้วได้แท็บเดิม
//
// state ที่วางไว้ที่ RacePage (แม่) เพราะ "ลูก 2 ตัวต้องใช้ร่วมกัน":
//   currentEventId : TrackMap เป็นคนเปลี่ยน (เวลาบนแผนที่เดิน) → TimelinePanel ใช้ไฮไลต์/เลื่อนการ์ด
//   playRequest    : TimelinePanel เป็นคนเปลี่ยน (ผู้ใช้คลิกการ์ด) → TrackMap ใช้สั่งเล่นคลิป
//   ถ้าเก็บไว้ในลูกตัวใดตัวหนึ่ง อีกตัวจะเข้าถึงไม่ได้ (props ไหลลงอย่างเดียว) จึงยกขึ้นมาที่แม่ร่วม
// ส่วน state ที่ใช้ตัวเดียว (sort/filter ของไทม์ไลน์, การเรียงตารางผล) อยู่ในลูกตัวนั้นเอง

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { api } from "../api.js";
import { useAsync } from "../hooks/useAsync.js";
import SummaryBar from "../components/SummaryBar.jsx";
import RaceStage from "../components/RaceStage.jsx";
import TimelinePanel from "../components/TimelinePanel.jsx";
import ResultsTable from "../components/ResultsTable.jsx";
import FastestPits from "../components/FastestPits.jsx";
import HighlightVideo from "../components/HighlightVideo.jsx";
import { Skeleton, EmptyState, ErrorState } from "../components/StatusViews.jsx";

const dateFormat = new Intl.DateTimeFormat("th-TH", { dateStyle: "long" });
const TABS = [
  { id: "results", label: "ผลจบการแข่ง" },
  { id: "events", label: "เหตุการณ์" },
  { id: "pits", label: "พิทสต็อปเร็วสุด" },
  { id: "highlight", label: "🎬 คลิปไฮไลต์" },
];

export default function RacePage({ onVisitRace }) {
  const { sessionKey: rawKey } = useParams();
  const sessionKey = Number(rawKey);
  const validKey = Number.isInteger(sessionKey) && sessionKey > 0;

  const [currentEventId, setCurrentEventId] = useState(null);
  const [playRequest, setPlayRequest] = useState(null);
  const stageRef = useRef(null); // คลิกการ์ดเหตุการณ์ในแท็บ → เลื่อนขึ้นไปให้เห็นแผนที่ที่กำลังเล่น
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === searchParams.get("tab")) ? searchParams.get("tab") : "results";
  const selectTab = (id) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id === "results") next.delete("tab");
        else next.set("tab", id);
        return next;
      },
      { replace: true }
    );

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
        <EmptyState title="ยังไม่มีข้อมูลของเรซนี้" hint="เรซที่เพิ่งแข่งจบอาจต้องรอข้อมูลสักพัก">
          <Link to="/">เลือกเรซอื่น</Link>
        </EmptyState>
      )}

      {hasRaceData && (
        <section ref={stageRef} className="card stage-card" aria-label="แผนที่สนามและอันดับ">
          {(timelineReq.status === "loading" || infoReq.status === "loading") && <Skeleton variant="map" />}
          {timeline && race && (
            <RaceStage race={race} timeline={timeline} playRequest={playRequest} currentEventId={currentEventId} onEventChange={setCurrentEventId} />
          )}
        </section>
      )}

      {hasRaceData && (
        <section className="card race-tabs">
          <div className="tab-bar" role="tablist" aria-label="ข้อมูลเรซ">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`tab-btn ${tab === t.id ? "active" : ""}`} onClick={() => selectTab(t.id)}>
                {t.label}
                {t.id === "events" && timeline && <span className="tab-count">{timeline.events.length}</span>}
              </button>
            ))}
          </div>
          <div className="tab-body" role="tabpanel">
            {timelineReq.status === "loading" && <Skeleton variant="row" count={5} />}
            {timeline && tab === "results" && <ResultsTable sessionKey={sessionKey} results={timeline.sessionResult} year={race?.year} />}
            {timeline && tab === "events" && (
              <TimelinePanel
                events={timeline.events}
                drivers={timeline.drivers}
                currentEventId={currentEventId}
                year={race?.year}
                // object ใหม่ทุกคลิก → TrackMap รู้ว่าต้องเล่น แม้คลิกการ์ดเดิมซ้ำ
                onSelectEvent={(event) => {
                  setPlayRequest({ event });
                  stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              />
            )}
            {timeline && tab === "pits" && <FastestPits sessionKey={sessionKey} pits={timeline.fastestPits} year={race?.year} />}
            {race && tab === "highlight" && <HighlightVideo race={race} />}
          </div>
        </section>
      )}
    </div>
  );
}
