// src/components/HighlightVideo.jsx
// คลิปไฮไลต์ของเรซจาก YouTube (ช่อง Formula 1) — Express หา videoId ให้ (ถือ API key ไว้ฝั่ง server)
//
// แสดงเป็น "ภาพปก + ปุ่มเล่น" ก่อน แล้วค่อยโหลด iframe ของ YouTube เมื่อผู้ใช้กดเล่น (click-to-load):
//   iframe ของ YouTube หนักหลาย MB และฝัง cookie — ไม่โหลดจนกว่าผู้ใช้อยากดูจริง หน้าเรซจึงเปิดเร็วเท่าเดิม
//   ใช้โดเมน youtube-nocookie.com (โหมดความเป็นส่วนตัวของ YouTube)
//
// props: sessionKey
// state: playing — ผู้ใช้กดเล่นแล้วหรือยัง (true = แสดง iframe แทนภาพปก)

import { useState } from "react";
import { api } from "../api.js";
import { useAsync } from "../hooks/useAsync.js";
import { Skeleton } from "./StatusViews.jsx";

const REASON_TEXT = {
  "no-key": "ยังไม่ได้ตั้งค่า YouTube API key ที่ backend จึงฝังคลิปไม่ได้",
  "not-found": "ยังไม่พบคลิปไฮไลต์ของเรซนี้ในช่อง Formula 1",
  quota: "โควตาค้นหา YouTube ของวันนี้หมดแล้ว",
  error: "ค้นหาคลิปไม่สำเร็จ",
};

export default function HighlightVideo({ sessionKey }) {
  const [playing, setPlaying] = useState(false);
  const req = useAsync((signal) => api.highlight(sessionKey, signal), [sessionKey]);

  if (req.status === "loading") return <Skeleton variant="map" />;
  if (req.status === "error") {
    return <p className="panel-hint">โหลดข้อมูลคลิปไม่สำเร็จ — {req.error.message}</p>;
  }

  const h = req.data;
  if (!h.available) {
    return (
      <div className="highlight-fallback">
        <p className="dim">{REASON_TEXT[h.reason] ?? "ยังไม่มีคลิปให้ดูในหน้านี้"}</p>
        <a className="yt-button" href={h.searchUrl} target="_blank" rel="noreferrer">
          ▶ ค้นหาคลิปไฮไลต์บน YouTube ↗
        </a>
      </div>
    );
  }

  return (
    <div className="highlight-video">
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${h.videoId}?autoplay=1&rel=0`}
          title={h.title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      ) : (
        <button type="button" className="video-facade" onClick={() => setPlaying(true)} aria-label={`เล่นคลิป ${h.title}`}>
          {h.thumbnail && <img src={h.thumbnail} alt="" loading="lazy" />}
          <span className="play-icon">▶</span>
        </button>
      )}
      <p className="video-title">
        {h.title} ·{" "}
        <a href={`https://www.youtube.com/watch?v=${h.videoId}`} target="_blank" rel="noreferrer">
          เปิดใน YouTube ↗
        </a>
      </p>
    </div>
  );
}
