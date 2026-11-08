// src/components/NavBar.jsx
// เมนูของเว็บ "สร้างจากข้อมูลใน Graph" (src/Graph.js) ไม่ได้เขียนรายการลิงก์ตายตัว
//   - เมนู      = graph.neighbors(หน้าปัจจุบัน) → แต่ละหน้ามีเมนูต่างกันตาม edge ที่ออกจาก node นั้น
//   - breadcrumb = graph.shortestPath("home", หน้าปัจจุบัน) ด้วย BFS → บอกผู้ใช้ว่าอยู่ตรงไหนของเว็บ
// ลิงก์ที่ต้องใช้พารามิเตอร์ (เช่น /race/:sessionKey) จะกดได้เมื่อรู้ค่าแล้วเท่านั้น ไม่งั้นแสดงเป็นเมนูจางพร้อมคำใบ้
//
// props:
//   graph        : Graph ของเว็บ
//   currentId    : node ของหน้าที่เปิดอยู่ (App หาให้จาก URL)
//   params       : ค่าพารามิเตอร์ที่รู้ตอนนี้ { sessionKey, driverNumber } (จาก URL หรือเรซ/นักขับที่ดูล่าสุด)
//   labels       : ชื่อที่อ่านง่ายของ node ที่มีพารามิเตอร์ เช่น { race: "Japanese GP 2024", driver: "VER" }

import { Link, NavLink } from "react-router-dom";

const DISABLED_HINT = {
  race: "เลือกเรซจากหน้าแรกก่อน",
  driver: "เลือกนักขับจากตารางผลในหน้าเรซ",
};

export default function NavBar({ graph, currentId, params, labels }) {
  const crumbs = currentId ? graph.shortestPath("home", currentId) : [];
  const menu = currentId ? graph.neighbors(currentId) : graph.neighbors("home");

  return (
    <header className="app-header">
      <div className="header-row">
        <Link to="/" className="brand">
          🏁 F1 Race Rewind <span className="replay-badge">v2</span>
        </Link>

        <nav className="main-nav" aria-label="เมนูหลัก">
          {menu.map(({ to, label, node }) => {
            const href = graph.resolvePath(to, params);
            if (!href) {
              return (
                <span key={to} className="nav-link disabled" title={DISABLED_HINT[to]}>
                  {node.icon} {label}
                </span>
              );
            }
            return (
              <NavLink key={to} to={href} className="nav-link" end>
                {node.icon} {label}
                {labels[to] && <small className="nav-sub">{labels[to]}</small>}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {crumbs.length > 1 && (
        <ol className="breadcrumb" aria-label="ตำแหน่งปัจจุบัน">
          {crumbs.map((id, i) => {
            const node = graph.getNode(id);
            const href = graph.resolvePath(id, params);
            const text = labels[id] ? `${node.label}: ${labels[id]}` : node.label;
            const isLast = i === crumbs.length - 1;
            return (
              <li key={id}>
                {isLast || !href ? <span aria-current={isLast ? "page" : undefined}>{text}</span> : <Link to={href}>{text}</Link>}
              </li>
            );
          })}
        </ol>
      )}
    </header>
  );
}
