// src/components/TrackMap.jsx
// แผนที่สนาม + ตัวควบคุมการเล่น ห่อ MapPlayer (class ที่วาดจุดรถเองผ่าน ref)
//
// state ของ component นี้:
//   player status { playing, speed, statusText } — MapPlayer แจ้งผ่าน onStatus เฉพาะตอนเปลี่ยน (ไม่ใช่ทุกเฟรม)
//   track (ผ่าน useAsync) — เส้นสนามจาก Express /api/track/:sessionKey
// ref (ไม่ใช่ state เพราะเปลี่ยนแล้วไม่ต้อง re-render):
//   playerRef — instance ของ MapPlayer ตัวเดียวตลอดอายุ component
//   dotsRef / scrubberRef / clockRef / bufferRef — DOM ที่ MapPlayer เขียนตรง 60 ครั้ง/วินาที
//   scrubTimer — ตัวจับเวลา debounce ตอนลาก scrubber
// props:
//   race (หัวเรื่อง เพื่อรู้เวลาเริ่ม/จบ), timeline (drivers + events), playRequest (เหตุการณ์ที่แม่สั่งให้เล่น)
//   onEventChange(eventId) — callback ส่งเหตุการณ์ปัจจุบันขึ้นไปให้แม่ส่งต่อให้ TimelinePanel

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api.js";
import { useAsync } from "../hooks/useAsync.js";
import { MapPlayer } from "../player/MapPlayer.js";
import { Skeleton, EmptyState, ErrorState } from "./StatusViews.jsx";

const SPEEDS = [1, 2, 5, 10];

export default function TrackMap({ race, timeline, playRequest, onEventChange }) {
  const sessionKey = race.sessionKey;
  const [status, setStatus] = useState({ playing: false, speed: 1, statusText: "" });
  const playerRef = useRef(null);
  const dotsRef = useRef(null);
  const scrubberRef = useRef(null);
  const clockRef = useRef(null);
  const bufferRef = useRef(null);
  const scrubTimer = useRef(null);
  // เก็บ callback ล่าสุดไว้ใน ref: player สร้างครั้งเดียว แต่ต้องเรียก onEventChange ตัวล่าสุดของแม่เสมอ
  const onEventChangeRef = useRef(onEventChange);
  onEventChangeRef.current = onEventChange;

  const trackReq = useAsync((signal) => api.track(sessionKey, signal), [sessionKey]);
  const track = trackReq.status === "success" ? trackReq.data : null;

  // ค่าที่คำนวณจาก track ได้ → useMemo ไม่ใช่ state (คำนวณใหม่เฉพาะตอนเปลี่ยนสนาม)
  const pathD = useMemo(() => {
    if (!track) return "";
    return track.points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + " Z";
  }, [track]);

  // effect 1: สร้าง MapPlayer เมื่อ DOM ของแผนที่พร้อม (track โหลดเสร็จ) แล้ว load เรซเข้าไป
  // deps: [track, timeline, race] — เปลี่ยนเรซ/สนาม = ทำลายตัวเก่า (cleanup) สร้างใหม่ ไม่มี player ค้างยิง API
  useEffect(() => {
    if (!track || !dotsRef.current) return undefined;
    const player = new MapPlayer(
      { dotsGroup: dotsRef.current, scrubber: scrubberRef.current, clockLabel: clockRef.current, bufferFill: bufferRef.current },
      { onStatus: setStatus, onEventChange: (id) => onEventChangeRef.current?.(id) }
    );
    player.load({ sessionKey, track, drivers: timeline.drivers, events: timeline.events, dateStart: race.dateStart, dateEnd: race.dateEnd });
    playerRef.current = player;
    return () => {
      player.destroy(); // หยุด animation + ยกเลิก request ที่ค้าง
      playerRef.current = null;
      clearTimeout(scrubTimer.current);
    };
  }, [track, timeline, race, sessionKey]);

  // effect 2: แม่ส่งเหตุการณ์มาให้เล่น (ผู้ใช้คลิกการ์ดในไทม์ไลน์) — playRequest เป็น object ใหม่ทุกคลิก
  // จึงคลิกการ์ดเดิมซ้ำก็เล่นซ้ำได้ ทำงานเฉพาะตอน playRequest เปลี่ยน
  useEffect(() => {
    if (playRequest && playerRef.current) playerRef.current.playEvent(playRequest.event);
  }, [playRequest]);

  if (trackReq.status === "loading") {
    return (
      <>
        <p className="map-status-label">⏳ กำลังโหลดเส้นสนาม (สนามใหม่อาจใช้เวลาสร้างสักครู่)</p>
        <Skeleton variant="map" />
      </>
    );
  }
  if (trackReq.status === "error") {
    return trackReq.error.status === 404 ? (
      <EmptyState title="ยังไม่มีแผนที่สนามสำหรับเรซนี้" hint="ดูไทม์ไลน์ด้านล่างได้ตามปกติ" />
    ) : (
      <ErrorState title="โหลดแผนที่สนามไม่สำเร็จ" error={trackReq.error} onRetry={trackReq.reload} />
    );
  }
  if (!track) return null;

  return (
    <div className="map-view">
      <div className="map-header">
        <span className="map-status-label" aria-live="polite">
          {status.statusText}
        </span>
      </div>
      <svg className="track-svg" viewBox={`0 0 ${track.viewBox.width} ${track.viewBox.height}`} preserveAspectRatio="xMidYMid meet">
        <path className="track-path" d={pathD} />
        {/* React ไม่ render อะไรใน <g> นี้ — MapPlayer สร้างจุดรถและขยับเองผ่าน ref */}
        <g ref={dotsRef} />
      </svg>

      <div className="player-row">
        <div className="player-buttons" role="group" aria-label="ควบคุมการเล่น">
          <button type="button" className="icon-btn" title="ย้อน 10 วินาที" onClick={() => playerRef.current?.skipBy(-10000)}>
            ⏪ 10s
          </button>
          <button type="button" className="icon-btn play-pause-btn" title="เล่น/หยุด" onClick={() => playerRef.current?.toggle()}>
            {status.playing ? "⏸" : "▶"}
          </button>
          <button type="button" className="icon-btn" title="ข้ามไป 10 วินาที" onClick={() => playerRef.current?.skipBy(10000)}>
            10s ⏩
          </button>
        </div>
        <div className="speed-buttons" role="group" aria-label="ความเร็วเล่น">
          {SPEEDS.map((s) => (
            <button key={s} type="button" className={`speed-btn ${status.speed === s ? "active" : ""}`} onClick={() => playerRef.current?.setSpeed(s)}>
              x{s}
            </button>
          ))}
        </div>
      </div>

      <div className="map-controls">
        <div className="scrubber-wrap">
          <input
            type="range"
            ref={scrubberRef}
            step="1"
            defaultValue="0"
            aria-label="เลื่อนดูช่วงเวลา"
            onInput={(e) => {
              const ms = Number(e.target.value);
              playerRef.current?.previewScrub(ms);
              clearTimeout(scrubTimer.current);
              scrubTimer.current = setTimeout(() => playerRef.current?.seekTo(ms), 150);
            }}
          />
          <div className="buffer-track" title="ช่วงที่โหลดข้อมูลเก็บไว้แล้ว">
            <div ref={bufferRef} className="buffer-fill" />
          </div>
        </div>
        <span ref={clockRef} className="scrubber-time-label">
          --:--:--
        </span>
      </div>
    </div>
  );
}
