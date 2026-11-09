// src/components/HighlightVideo.jsx
// คลิปไฮไลต์ของเรซจาก YouTube (ช่อง Formula 1) — Express หา videoId ที่ตรงเรซให้ (ถือ API key ไว้ฝั่ง server)
//
// ทำไมเปิดใน YouTube แทนการฝัง (iframe) ในหน้า:
//   ทดสอบแล้ว (8 พ.ย. 2569) แม้ API บอกว่า embeddable: true แต่ Formula One Management (FOM) จำกัดให้เล่นได้เฉพาะ
//   เว็บที่ได้รับอนุญาต — ฝังใน localhost/เว็บของเราขึ้น "Video unavailable … blocked it from display on this website"
//   ทั้ง youtube.com/embed และ youtube-nocookie.com จึงแสดงภาพปก + ชื่อคลิปจริง แล้วกดเปิดคลิปนั้นตรง ๆ ในแท็บใหม่
//   (ยังดีกว่าลิงก์ค้นหา: ผู้ใช้ได้คลิปที่ถูกเรซ/ถูกปี/ถูกประเภท Race-Sprint ทันที)
//
// props: race (หัวเรื่องเรซ: sessionKey, year, meetingName, sessionName, dateStart)
// ไม่มี state ของตัวเอง — ผลโหลดอยู่ใน useAsync

import { api } from "../api.js";
import { useAsync } from "../hooks/useAsync.js";
import { Skeleton } from "./StatusViews.jsx";

const REASON_TEXT = {
  "no-key": "ยังไม่มีคลิปให้ดูในหน้านี้",
  "not-found": "ยังไม่พบคลิปไฮไลต์ของเรซนี้ในช่อง Formula 1",
  quota: "โควตาค้นหา YouTube ของวันนี้หมดแล้ว",
  error: "ค้นหาคลิปไม่สำเร็จ",
};

export default function HighlightVideo({ race }) {
  const req = useAsync((signal) => api.highlight(race, signal), [race.sessionKey]);

  if (req.status === "loading") return <Skeleton variant="map" />;
  if (req.status === "error") {
    return <p className="panel-hint">โหลดคลิปไม่สำเร็จ</p>;
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

  const watchUrl = `https://www.youtube.com/watch?v=${h.videoId}`;
  return (
    <div className="highlight-video">
      <a className="video-facade" href={watchUrl} target="_blank" rel="noreferrer" aria-label={`ดูคลิป ${h.title} บน YouTube (แท็บใหม่)`}>
        {h.thumbnail && <img src={h.thumbnail} alt="" loading="lazy" />}
        <span className="play-icon">▶</span>
        <span className="video-badge">เปิดใน YouTube ↗</span>
      </a>
      <p className="video-title">
        {h.title}
      </p>
    </div>
  );
}
