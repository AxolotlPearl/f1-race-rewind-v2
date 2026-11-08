// src/components/TeamCard.jsx
// บัตรข้อมูลทีมทั้งฤดูกาล: ชื่อทีม, คะแนน/อันดับ, นักขับในทีม (กดเปิดบัตรนักขับ), ผลรายสนาม
// ไม่มี state — ข้อมูลมาจากตารางคะแนนชุดเดียวกับ DriverCard
//
// props: team, year, onOpenDriver(driverNumber) — callback ขึ้นไปหา ScoreboardPage ให้สลับเป็นบัตรนักขับ

import { Link } from "react-router-dom";
import { resultTone } from "./DriverCard.jsx";

const dateFormat = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" });

export default function TeamCard({ team, year, onOpenDriver }) {
  return (
    <article className="profile-card">
      <header className="profile-head">
        <div className="team-swatch" aria-hidden="true" />
        <div>
          <p className="profile-kicker">
            ฤดูกาล {year} · อันดับทีม {team.rank}
          </p>
          <h2 className="profile-name">{team.teamName}</h2>
        </div>
      </header>

      <div className="profile-stats">
        <div>
          <strong>{team.points}</strong>
          <span>คะแนนทีม</span>
        </div>
        <div>
          <strong>{team.wins}</strong>
          <span>ชนะ</span>
        </div>
        <div>
          <strong>{team.podiums}</strong>
          <span>โพเดียม</span>
        </div>
        <div>
          <strong>{team.results.length}</strong>
          <span>รายการที่ลง</span>
        </div>
      </div>

      <h3 className="profile-section-title">นักขับในทีม</h3>
      <div className="team-drivers">
        {team.drivers.map((d) => {
          const share = team.points > 0 ? Math.round((d.points / team.points) * 100) : 0;
          return (
            <button key={d.driverNumber} type="button" className="team-driver" onClick={() => onOpenDriver(d.driverNumber)}>
              <span className="team-driver-name">
                <strong>{d.acronym}</strong> {d.fullName} ›
              </span>
              <span className="team-driver-meta">
                {d.points} คะแนน · {d.races} รายการ · {share}% ของทีม
              </span>
              <span className="share-bar">
                <span style={{ width: `${share}%` }} />
              </span>
            </button>
          );
        })}
      </div>

      <h3 className="profile-section-title">ผลแต่ละสนาม ({team.results.length} รายการ)</h3>
      <div className="profile-table-wrap">
        <table className="data-table profile-table">
          <thead>
            <tr>
              <th>วันที่</th>
              <th>สนาม</th>
              <th>นักขับ</th>
              <th>คะแนน</th>
            </tr>
          </thead>
          <tbody>
            {team.results.map((r) => (
              <tr key={r.sessionKey}>
                <td className="dim">{dateFormat.format(new Date(r.dateStart))}</td>
                <td>
                  <Link to={`/race/${r.sessionKey}`}>{r.meetingName}</Link> {r.sessionName === "Sprint" && <span className="sprint-tag">Sprint</span>}
                </td>
                <td>
                  {r.entries.map((e) => (
                    <button key={e.driverNumber} type="button" className={`result-badge tone-${resultTone(e)} as-button`} onClick={() => onOpenDriver(e.driverNumber)}>
                      {e.acronym} {e.status}
                    </button>
                  ))}
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
