// src/pages/AboutPage.jsx — /about
// อธิบายว่าเว็บทำงานอย่างไร + แสดงโครงสร้าง Graph ที่ใช้สร้างเมนู (ดึงจาก siteGraph จริง ไม่ได้พิมพ์ซ้ำ)
// + เช็คสถานะ backend สด ๆ (ให้ผู้ใช้รู้ว่าถ้าโหลดไม่ขึ้น ปัญหาอยู่ที่ไหน)

import { api } from "../api.js";
import { useAsync } from "../hooks/useAsync.js";

export default function AboutPage({ graph }) {
  const health = useAsync((signal) => api.health(signal), []);

  return (
    <div className="about-page">
      <section className="page-head">
        <h1>เกี่ยวกับ F1 Race Rewind</h1>
        <p className="page-sub">ดูย้อนหลังว่าเรซ Formula 1 แต่ละสนามเกิดอะไรขึ้น จากข้อมูลจริงของ OpenF1</p>
      </section>

      <section className="card">
        <h2>ระบบทำงานอย่างไร</h2>
        <div className="flow-diagram" aria-label="แผนภาพการทำงาน">
          <div className="flow-box">
            React + Vite
            <small>หน้าเว็บ (frontend/)</small>
          </div>
          <span className="flow-arrow">⇄ /api/*</span>
          <div className="flow-box accent">
            Express
            <small>proxy · rate limit · cache · validate · ประมวลผล</small>
          </div>
          <span className="flow-arrow">⇄ HTTPS</span>
          <div className="flow-box">
            OpenF1 API
            <small>api.openf1.org (30 req/นาที)</small>
          </div>
        </div>
        <p className="health-line">
          สถานะ backend:{" "}
          {health.status === "loading" && <span>⏳ กำลังเช็ค...</span>}
          {health.status === "success" && <span className="ok-text">✅ ทำงานปกติ</span>}
          {health.status === "error" && (
            <span className="error-text">
              ⚠️ {health.error.message}{" "}
              <button type="button" className="link-btn" onClick={health.reload}>
                เช็คใหม่
              </button>
            </span>
          )}
        </p>
      </section>

      <section className="card">
        <h2>Graph ของเมนู (src/Graph.js)</h2>
        <p className="panel-hint">
          node = หน้า ({graph.nodes().length} หน้า) · edge = เมนูที่พาไปหน้าอื่น ({graph.edgeCount()} เส้น) — เมนูด้านบนสร้างจากตารางนี้
        </p>
        <table className="data-table graph-table">
          <thead>
            <tr>
              <th>หน้า (node)</th>
              <th>path</th>
              <th>เมนูที่มีในหน้านี้ (edge →)</th>
            </tr>
          </thead>
          <tbody>
            {graph.nodes().map((n) => (
              <tr key={n.id}>
                <td>
                  {n.icon} {n.label} <code>{n.id}</code>
                </td>
                <td>
                  <code>{n.path}</code>
                </td>
                <td>
                  {graph.neighbors(n.id).map((e) => (
                    <span key={e.to} className="edge-pill">
                      → {e.label}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
