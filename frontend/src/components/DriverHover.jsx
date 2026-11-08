// src/components/DriverHover.jsx
// ห่อชื่อนักแข่งที่ไหนก็ได้ → เอาเมาส์ชี้ (หรือ focus ด้วยคีย์บอร์ด) ค้าง ~0.3 วินาที ขึ้นโปรไฟล์ย่อ:
// รูป, เบอร์, ชื่อ, โลโก้ + ชื่อทีม, อันดับ/คะแนน/ชนะ/โพเดียมของฤดูกาลนั้น
//
// props: year, driverNumber, children (ตัวชื่อที่ถูกห่อ — ยังคลิกได้ตามเดิม)
// state:
//   open   — ป๊อปอัปเปิดอยู่ไหม (ชี้ค้างครบเวลา = เปิด, เอาเมาส์ออก = ปิด)
//   pos    — ตำแหน่งบนจอ { top, left, above } คำนวณจากตำแหน่งชื่อตอนเปิด
//   info   — { status: "loading" | "success" | "missing" | "error", driver }
// ref: timer — ตัวหน่วงเวลา (ชี้ผ่านเร็ว ๆ ไม่เด้งป๊อปอัปรัว ๆ และไม่โหลดข้อมูลโดยไม่จำเป็น)
//
// ป๊อปอัป render ผ่าน portal ไปที่ <body> + position: fixed — ไม่ถูกตัดขอบเมื่อชื่ออยู่ในตาราง/บัตรที่ overflow: auto

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getSeason } from "../seasonCache.js";
import TeamLogo from "./TeamLogo.jsx";

const OPEN_DELAY_MS = 300;
const POPOVER_HEIGHT = 170;

export default function DriverHover({ year, driverNumber, children }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const [info, setInfo] = useState({ status: "loading", driver: null });
  const anchorRef = useRef(null);
  const timer = useRef(null);

  // effect: ป๊อปอัปเปิด → โหลดข้อมูลฤดูกาล (ใช้ cache ร่วม ชี้ชื่อที่สองเป็นต้นไปได้ทันที)
  // deps [open, year, driverNumber]: โหลดเฉพาะตอนเปิดจริง ไม่ใช่ทุกชื่อบนหน้าตั้งแต่แรก; cancelled กันผลมาช้าหลังปิดแล้ว
  useEffect(() => {
    if (!open || !year) return undefined;
    let cancelled = false;
    getSeason(year)
      .then(({ lookup }) => {
        if (cancelled) return;
        const driver = lookup.drivers.get(Number(driverNumber));
        setInfo(driver ? { status: "success", driver } : { status: "missing", driver: null });
      })
      .catch(() => !cancelled && setInfo({ status: "error", driver: null }));
    return () => {
      cancelled = true;
    };
  }, [open, year, driverNumber]);

  // ล้าง timer ตอน component หายไป (เช่นเปลี่ยนหน้าระหว่างกำลังจะเปิด)
  useEffect(() => () => clearTimeout(timer.current), []);

  function show() {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const above = rect.bottom + POPOVER_HEIGHT > window.innerHeight; // ใกล้ขอบล่าง → แสดงด้านบนแทน
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - 268);
      setPos({ left, top: above ? rect.top - 8 : rect.bottom + 8, above });
      setOpen(true);
    }, OPEN_DELAY_MS);
  }

  function hide() {
    clearTimeout(timer.current);
    setOpen(false);
  }

  const d = info.driver;

  // ยังไม่รู้ว่าเป็นฤดูกาลไหน (หัวเรื่องเรซยังโหลดไม่เสร็จ) → แสดงชื่อเฉย ๆ ไม่มีป๊อปอัป
  if (!year) return children;

  return (
    <span ref={anchorRef} className="driver-hover" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {open &&
        pos &&
        createPortal(
          <div
            className={`hover-card ${pos.above ? "above" : ""}`}
            role="tooltip"
            style={{ left: pos.left, top: pos.top, "--team-color": d ? `#${d.teamColour}` : undefined }}
          >
            {info.status === "loading" && <p className="hover-note">⏳ กำลังโหลดโปรไฟล์...</p>}
            {info.status === "missing" && <p className="hover-note">ไม่มีข้อมูลฤดูกาล {year} ของนักแข่งคนนี้</p>}
            {info.status === "error" && <p className="hover-note">โหลดโปรไฟล์ไม่สำเร็จ</p>}
            {info.status === "success" && (
              <>
                <div className="hover-head">
                  {d.headshotUrl ? <img className="hover-photo" src={d.headshotUrl} alt="" /> : <div className="hover-photo placeholder">{d.acronym}</div>}
                  <div>
                    <div className="hover-name">
                      <span className="driver-number">#{d.driverNumber}</span> {d.fullName}
                    </div>
                    <div className="hover-team">
                      <TeamLogo teamName={d.teamName} colour={d.teamColour} year={year} size={20} /> {d.teamName}
                    </div>
                    {d.countryCode && <div className="hover-sub">{d.countryCode}</div>}
                  </div>
                </div>
                <div className="hover-stats">
                  <span>
                    <strong>P{d.rank}</strong> ฤดูกาล {year}
                  </span>
                  <span>
                    <strong>{d.points}</strong> คะแนน
                  </span>
                  <span>
                    <strong>{d.wins}</strong> ชนะ
                  </span>
                  <span>
                    <strong>{d.podiums}</strong> โพเดียม
                  </span>
                </div>
              </>
            )}
          </div>,
          document.body
        )}
    </span>
  );
}
