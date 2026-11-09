// src/components/StatusBanner.jsx
// แถบแจ้งสถานะแหล่งข้อมูลด้านบนทุกหน้า — ซ่อนอยู่เมื่อทุกอย่างปกติ
//   🔴 OpenF1 ปิดชั่วคราวช่วงแข่งสด (ผู้ใช้ไม่มี key แบบเสียเงินเข้าถึงไม่ได้แม้ข้อมูลย้อนหลัง)
//   🟠 ติดต่อ OpenF1 / backend ไม่ได้
//   📦 ข้อมูลบนจอเป็นข้อมูลที่บันทึกไว้เมื่อ ... (server ตอบด้วยข้อมูลสำรอง)
//
// state:
//   status    — ผลจาก /api/status { openf1, savedEntries } หรือ { openf1: "backend-down" }
//   savedAt   — เวลาบันทึกของข้อมูลสำรองที่เก่าที่สุดที่หน้าเว็บได้รับ (null = ยังไม่มี)
//   dismissed — ผู้ใช้กดปิดแถบแล้ว (เปิดใหม่เองถ้าสถานะเปลี่ยน)

import { useCallback, useEffect, useState } from "react";
import { api, subscribeApiEvents } from "../api.js";

const POLL_MS = 60 * 1000;
const timeFormat = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function StatusBanner() {
  const [status, setStatus] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  // useCallback: ใช้ใน effect 2 ตัวด้านล่าง ฟังก์ชันต้องเป็นตัวเดิม ไม่งั้น effect จะตั้ง interval ใหม่ทุก render
  const refresh = useCallback(() => {
    api
      .status()
      .then((s) => {
        setStatus(s);
        if (s.openf1 === "ok") setSavedAt(null); // OpenF1 กลับมาแล้ว ข้อมูลที่โหลดต่อจากนี้เป็นข้อมูลสด
      })
      .catch(() => setStatus({ openf1: "backend-down" }));
  }, []);

  // effect 1: เช็คสถานะตอนเปิดเว็บ และทุก 1 นาที (OpenF1 จะเปิดกลับเองเมื่อเซสชันจบ แถบจะหายเอง); cleanup = clearInterval
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // effect 2: ฟัง event จาก api.js — ได้ข้อมูลสำรอง → จดเวลาที่เก่าที่สุด, เจอ 503 → เช็คสถานะทันทีไม่ต้องรอรอบถัดไป
  useEffect(
    () =>
      subscribeApiEvents((event) => {
        if (event.type === "stale") setSavedAt((prev) => (!prev || event.savedAt < prev ? event.savedAt : prev));
        else if (event.type === "lockout") refresh();
      }),
    [refresh]
  );

  const state = status?.openf1;

  // effect 3: สถานะเปลี่ยน (เช่น ปกติ → ปิดช่วงแข่งสด) → แสดงแถบอีกครั้งแม้ผู้ใช้เคยกดปิดไว้
  useEffect(() => {
    setDismissed(false);
  }, [state]);
  const showSaved = savedAt != null;
  if (dismissed || (!showSaved && (state == null || state === "ok"))) return null;

  let tone = "info";
  let title = "";
  let detail = "";
  if (state === "locked") {
    tone = "live";
    title = "🔴 ตอนนี้มีการแข่ง F1 สดอยู่ — ข้อมูลใหม่จะใช้ได้หลังจบเซสชัน";
    detail = status.savedEntries > 0 ? "หน้าที่เคยเปิดดูแล้วยังดูได้ตามปกติ" : "บางหน้าอาจยังโหลดไม่ได้ชั่วคราว";
  } else if (state === "down") {
    tone = "warn";
    title = "🟠 โหลดข้อมูลใหม่ไม่ได้ชั่วคราว";
    detail = "กำลังแสดงข้อมูลล่าสุดที่มี";
  } else if (state === "backend-down") {
    tone = "warn";
    title = "🟠 เชื่อมต่อเซิร์ฟเวอร์ไม่ได้";
    detail = "ลองรีเฟรชอีกครั้งในอีกสักครู่";
  }

  return (
    <div className={`status-banner ${tone}`} role="status" aria-live="polite">
      <div className="status-text">
        {title && <strong>{title}</strong>}
        {detail && <span>{detail}</span>}
        {showSaved && <span className="saved-note">📦 ข้อมูลอัปเดตล่าสุด {timeFormat.format(new Date(savedAt))}</span>}
      </div>
      <button type="button" className="status-close" onClick={() => setDismissed(true)} aria-label="ปิดแถบแจ้งเตือน">
        ✕
      </button>
    </div>
  );
}
