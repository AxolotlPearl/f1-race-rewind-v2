// src/App.jsx
// component บนสุด: ถือ state ที่ "หลายหน้า + NavBar" ต้องใช้ร่วมกัน แล้วส่งลงไปเป็น props
//
// ทำไม recent (เรซ/นักขับที่ดูล่าสุด) อยู่ที่ App ไม่ใช่ใน RacePage:
//   NavBar กับ RacePage เป็น "พี่น้อง" กัน (ลูกของ App ทั้งคู่) — NavBar ต้องรู้ว่าดูเรซไหนอยู่เพื่อสร้างลิงก์
//   "เรซที่ดูล่าสุด" ตอนอยู่หน้าแรก/หน้าเกี่ยวกับ ถ้าเก็บใน RacePage ค่าจะหายทันทีที่ออกจากหน้าเรซ (unmount)
//   จึง "ยก state ขึ้น" มาไว้ที่ App แล้วให้หน้าลูกแจ้งกลับขึ้นมาผ่าน callback onVisitRace / onVisitDriver

import { useCallback, useEffect, useState } from "react";
import { Routes, Route, useLocation, matchPath } from "react-router-dom";
import { siteGraph } from "./Graph.js";
import NavBar from "./components/NavBar.jsx";
import HomePage from "./pages/HomePage.jsx";
import RacePage from "./pages/RacePage.jsx";
import DriverPage from "./pages/DriverPage.jsx";
import AboutPage from "./pages/AboutPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";

const RECENT_KEY = "f1rr:recent";

function loadRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY)) ?? null;
  } catch {
    return null;
  }
}

/** หาว่า URL ตอนนี้ตรงกับ node ไหนใน Graph (และได้ค่าพารามิเตอร์มาด้วย) */
function matchCurrentNode(pathname) {
  for (const node of siteGraph.nodes()) {
    const match = matchPath({ path: node.path, end: true }, pathname);
    if (match) return { id: node.id, params: match.params };
  }
  return { id: null, params: {} };
}

export default function App() {
  const location = useLocation();
  // lazy initializer: อ่าน localStorage ครั้งเดียวตอน mount ไม่ใช่ทุก render
  const [recent, setRecent] = useState(loadRecent); // { race: {...}, driver: { driverNumber, acronym } | null }

  // บันทึก recent ลง localStorage ทุกครั้งที่ค่าเปลี่ยน — กลับมาเปิดเว็บใหม่ เมนู "เรซที่ดูล่าสุด" ยังอยู่
  useEffect(() => {
    try {
      if (recent) localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
    } catch {
      /* ไม่เป็นไร */
    }
  }, [recent]);

  // useCallback: ให้ฟังก์ชันเป็นตัวเดิมข้าม render — หน้าลูกใส่ไว้ใน dependency ของ useEffect ได้โดยไม่วนลูป
  const handleVisitRace = useCallback((race) => {
    setRecent((prev) => (prev?.race?.sessionKey === race.sessionKey ? { ...prev, race } : { race, driver: null }));
  }, []);

  const handleVisitDriver = useCallback((race, driver) => {
    setRecent({ race, driver: { driverNumber: driver.driverNumber, acronym: driver.acronym } });
  }, []);

  // ค่าที่คำนวณจาก URL + recent ได้ → ไม่เก็บเป็น state ซ้ำ (คำนวณใหม่ทุก render ถูกและไม่มีวันไม่ตรงกัน)
  const current = matchCurrentNode(location.pathname);
  const params = {
    sessionKey: current.params.sessionKey ?? recent?.race?.sessionKey,
    driverNumber: current.params.driverNumber ?? (current.params.sessionKey == null || String(recent?.race?.sessionKey) === current.params.sessionKey ? recent?.driver?.driverNumber : undefined),
  };
  const raceForLabel = recent?.race && String(recent.race.sessionKey) === String(params.sessionKey) ? recent.race : null;
  const labels = {
    race: raceForLabel ? `${raceForLabel.meetingName} ${raceForLabel.year}${raceForLabel.sessionName === "Sprint" ? " (Sprint)" : ""}` : "",
    driver: params.driverNumber && recent?.driver?.driverNumber === Number(params.driverNumber) ? recent.driver.acronym : "",
  };

  return (
    <>
      <NavBar graph={siteGraph} currentId={current.id} params={params} labels={labels} />
      <main>
        <Routes>
          <Route path="/" element={<HomePage recentRace={recent?.race ?? null} />} />
          <Route path="/race/:sessionKey" element={<RacePage onVisitRace={handleVisitRace} />} />
          <Route
            path="/race/:sessionKey/driver/:driverNumber"
            element={<DriverPage onVisitRace={handleVisitRace} onVisitDriver={handleVisitDriver} />}
          />
          <Route path="/about" element={<AboutPage graph={siteGraph} />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <footer className="app-footer">
        <p>
          ข้อมูลจาก{" "}
          <a href="https://openf1.org" target="_blank" rel="noreferrer">
            OpenF1 API
          </a>{" "}
          ผ่าน Express backend — ข้อมูลย้อนหลังเท่านั้น (REPLAY)
        </p>
      </footer>
    </>
  );
}
