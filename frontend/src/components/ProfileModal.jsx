// src/components/ProfileModal.jsx
// กรอบ "บัตร" ลอยทับหน้า (modal) ใช้ร่วมกันทั้งบัตรนักขับและบัตรทีม
// ปิดได้ 3 ทาง: ปุ่ม ✕, คลิกพื้นหลัง, กด Esc — และเพราะบัตรที่เปิดอยู่เก็บใน URL (?driver= / ?team=)
// ปุ่ม back ของ browser ก็ปิด/ย้อนกลับไปบัตรก่อนหน้าได้ด้วย
//
// props: title (สำหรับ screen reader), accent (สีทีม), onClose (callback ขึ้นไปให้แม่ลบค่าออกจาก URL), children

import { useEffect, useRef } from "react";

export default function ProfileModal({ title, accent, onClose, children }) {
  const closeRef = useRef(null);

  // effect: ตอนบัตรเปิด — ฟังปุ่ม Esc, ล็อกการเลื่อนหน้าด้านหลัง, ย้าย focus ไปปุ่มปิด (คีย์บอร์ดใช้ต่อได้ทันที)
  // cleanup คืนทุกอย่างตอนบัตรปิด; deps = [onClose] (แม่ส่งฟังก์ชันจาก useCallback มา effect จึงไม่ทำงานซ้ำทุก render)
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="profile-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={accent ? { "--team-color": `#${accent}` } : undefined}
        onClick={(e) => e.stopPropagation()} // คลิกในบัตรไม่ปิดบัตร
      >
        <button ref={closeRef} type="button" className="modal-close" onClick={onClose} aria-label="ปิด">
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
