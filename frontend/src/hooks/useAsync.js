// src/hooks/useAsync.js
// custom hook สำหรับ "โหลดข้อมูลจาก Express" ให้ทุกหน้าใช้รูปแบบเดียวกัน
// คืน status 4 สถานะ: "loading" | "success" | "empty" | "error" ให้ component แสดงผลครบทุกกรณี
//
// กัน loop ไม่รู้จบ / เรียก API ซ้ำโดยไม่จำเป็นอย่างไร:
//   1. effect ทำงานใหม่เฉพาะเมื่อค่าใน deps เปลี่ยน (เช่น sessionKey) — ไม่ได้ทำงานทุกครั้งที่ re-render
//   2. ใน effect เรา setState (status/data) แต่ไม่ได้ใส่ state พวกนั้นใน deps → setState ไม่ทำให้ effect วนกลับมาอีก
//   3. cleanup เรียก controller.abort() — ถ้า deps เปลี่ยนระหว่างรอ (ผู้ใช้กดเรซอื่น) request เก่าถูกยกเลิก
//      คำตอบเก่าที่มาช้าจะไม่ทับข้อมูลใหม่ (กัน race condition) และ StrictMode ที่ mount 2 รอบตอน dev ก็ไม่ซ้อนกัน
//   4. reload() เพิ่มตัวนับ attempt ซึ่งอยู่ใน deps → ยิงใหม่เฉพาะตอนผู้ใช้กด "ลองใหม่" เท่านั้น

import { useEffect, useState } from "react";

/**
 * @param {(signal: AbortSignal) => Promise<any>} loader ฟังก์ชันโหลดข้อมูล
 * @param {any[]} deps ค่าที่ถ้าเปลี่ยนแล้วต้องโหลดใหม่
 * @param {{ isEmpty?: (data:any) => boolean, enabled?: boolean }} options
 */
export function useAsync(loader, deps, { isEmpty = () => false, enabled = true } = {}) {
  const [state, setState] = useState({ status: enabled ? "loading" : "idle", data: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setState({ status: "idle", data: null, error: null });
      return undefined;
    }
    const controller = new AbortController();
    setState((prev) => ({ status: "loading", data: prev.data, error: null }));

    loader(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setState({ status: isEmpty(data) ? "empty" : "success", data, error: null });
      })
      .catch((error) => {
        if (controller.signal.aborted || error.name === "AbortError") return;
        setState({ status: "error", data: null, error });
      });

    return () => controller.abort();
    // loader/isEmpty เป็นฟังก์ชันที่สร้างใหม่ทุก render — ตั้งใจไม่ใส่ใน deps ไม่งั้นจะยิง API ทุก render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt, enabled]);

  return { ...state, reload: () => setAttempt((n) => n + 1) };
}
