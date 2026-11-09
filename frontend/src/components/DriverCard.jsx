// src/components/DriverCard.jsx
// บัตรข้อมูลนักขับทั้งฤดูกาล: ชื่อ, ทีม (กดเปิดบัตรทีม), คะแนน/อันดับ, ผลรายสนาม
// ไม่มี state — ข้อมูลทั้งหมดมาจากตารางคะแนนที่ ScoreboardPage โหลดไว้แล้ว (เปิดบัตรได้ทันทีไม่ต้องรอ API)
//
// props: driver (จาก /api/standings), year, maxPoints (คะแนนสูงสุดในสนามเดียวของปี ใช้สเกลกราฟแท่ง)
//        onOpenTeam(teamName) — callback ขึ้นไปหา ScoreboardPage ให้สลับเป็นบัตรทีม

import { Link } from "react-router-dom";
import { useState } from "react";
import TeamLogo from "./TeamLogo.jsx";
import { headshot } from "../photo.js";

const dateFormat = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" });

/** สีป้ายผล: ชนะ = ทอง, โพเดียม = เงิน/ทองแดง, ได้คะแนน = เขียว, ไม่จบ = แดง */
export function resultTone(result) {
  if (result.status !== `P${result.position}`) return "out";
  if (result.position === 1) return "p1";
  if (result.position <= 3) return "podium";
  if (result.points > 0) return "points";
  return "none";
}

function Headshot({ url, alt }) {
  const [failed, setFailed] = useState(false); // รูปโหลดไม่ได้ → แสดงตัวอักษรแทน ไม่ให้เห็นรูปแตก
  if (!url || failed) return <div className="headshot placeholder">{alt.slice(0, 3)}</div>;
  return <img className="headshot" src={url} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
}

export default function DriverCard({ driver, year, maxPoints, onOpenTeam, teamLookup }) {
  const finished = driver.results.filter((r) => r.status === `P${r.position}`).length;

  return (
    <article className="profile-card">
      <header className="profile-head">
        <Headshot url={headshot(driver.headshotUrl, "4col")} alt={driver.acronym} />
        <div>
          <p className="profile-kicker">
            ฤดูกาล {year} · อันดับ {driver.rank} {driver.countryCode && `· ${driver.countryCode}`}
          </p>
          <h2 className="profile-name">
            <span className="driver-number">#{driver.driverNumber}</span> {driver.fullName}
          </h2>
          <p className="profile-teams">
            {driver.teams.map((team) => {
              // สีของ "ทีมนั้น" (นักแข่งที่ย้ายทีมกลางปีมีหลายทีม สีไม่เท่ากัน) หาจาก HashTable O(1)
              const colour = teamLookup?.get(team)?.teamColour ?? driver.teamColour;
              return (
                <button key={team} type="button" className="team-link" style={{ "--team-color": `#${colour}` }} onClick={() => onOpenTeam(team)}>
                  <TeamLogo teamName={team} colour={colour} year={year} size={22} /> {team} ›
                </button>
              );
            })}
            {driver.teams.length > 1 && <span className="hint-inline">ย้ายทีมระหว่างฤดูกาล</span>}
          </p>
        </div>
      </header>

      <div className="profile-stats">
        <div>
          <strong>{driver.points}</strong>
          <span>คะแนน</span>
        </div>
        <div>
          <strong>{driver.wins}</strong>
          <span>ชนะ</span>
        </div>
        <div>
          <strong>{driver.podiums}</strong>
          <span>โพเดียม</span>
        </div>
        <div>
          <strong>{driver.bestFinish ? `P${driver.bestFinish}` : "-"}</strong>
          <span>ดีที่สุด</span>
        </div>
        <div>
          <strong>{driver.dnfs}</strong>
          <span>ไม่จบ (DNF)</span>
        </div>
      </div>

      {/* กราฟแท่งคะแนนรายสนาม — เห็นฟอร์มทั้งปีในแวบเดียว (สูง = ได้คะแนนมาก) */}
      <div className="points-bars" aria-label="คะแนนแต่ละสนาม">
        {driver.results.map((r) => (
          <span
            key={r.sessionKey}
            className={`bar tone-${resultTone(r)}`}
            style={{ height: `${Math.max(4, (r.points / (maxPoints || 1)) * 100)}%` }}
            title={`${r.meetingName}${r.sessionName === "Sprint" ? " (Sprint)" : ""}: ${r.status} · ${r.points} คะแนน`}
          />
        ))}
      </div>

      <h3 className="profile-section-title">
        ผลแต่ละสนาม ({driver.results.length} รายการ · จบ {finished})
      </h3>
      <div className="profile-table-wrap">
        <table className="data-table profile-table">
          <thead>
            <tr>
              <th>วันที่</th>
              <th>สนาม</th>
              <th>ผล</th>
              <th>คะแนน</th>
            </tr>
          </thead>
          <tbody>
            {driver.results.map((r) => (
              <tr key={r.sessionKey}>
                <td className="dim">{dateFormat.format(new Date(r.dateStart))}</td>
                <td>
                  <Link to={`/race/${r.sessionKey}/driver/${driver.driverNumber}`} title="ดูเรื่องราวของนักขับในเรซนี้">
                    {r.meetingName}
                  </Link>{" "}
                  {r.sessionName === "Sprint" && <span className="sprint-tag">Sprint</span>}
                  {driver.teams.length > 1 && <small className="dim"> · {r.teamName}</small>}
                </td>
                <td>
                  <span className={`result-badge tone-${resultTone(r)}`}>{r.status}</span>
                </td>
                <td>{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
