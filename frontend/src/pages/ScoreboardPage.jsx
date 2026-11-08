// src/pages/ScoreboardPage.jsx — /standings?year=2024&view=teams&driver=1 | &team=McLaren
// ตารางคะแนนทั้งฤดูกาล (นักแข่ง / ทีม) + บัตรข้อมูลนักแข่งและทีมที่กดสลับไปมาได้
//
// state ทั้งหมด (ปี, แท็บ, บัตรที่เปิด) อยู่ใน URL ผ่าน useSeason() — ดูเหตุผลใน hooks/useSeason.js
// เปิดบัตรได้ทันทีไม่ต้องยิง API: ตารางคะแนนที่โหลดมามีผลรายสนามของทุกคน/ทุกทีมครบแล้ว

import { useSeason } from "../hooks/useSeason.js";
import SeasonCards from "../components/SeasonCards.jsx";
import TeamLogo from "../components/TeamLogo.jsx";
import DriverHover from "../components/DriverHover.jsx";
import { Skeleton, EmptyState, ErrorState } from "../components/StatusViews.jsx";

export default function ScoreboardPage() {
  const season = useSeason();
  const { params, update, yearsReq, year, standingsReq, data, showDriver, showTeam, setYear } = season;
  const view = params.get("view") === "teams" ? "teams" : "drivers";

  return (
    <div className="scoreboard-page">
      <section className="page-head">
        <h1>🏆 ตารางคะแนน {year ?? ""}</h1>
        <p className="page-sub">คะแนนสะสมจากทุก Race และ Sprint ที่แข่งจบแล้ว · คลิกชื่อนักแข่งหรือทีมเพื่อดูบัตรข้อมูล · ชี้ชื่อนักแข่งเพื่อดูโปรไฟล์ย่อ</p>
      </section>

      <div className="scoreboard-toolbar">
        {yearsReq.status === "success" && (
          <div className="year-chips" role="tablist" aria-label="ฤดูกาล">
            {yearsReq.data.years.map((y) => (
              <button key={y} type="button" role="tab" aria-selected={y === year} className={`chip ${y === year ? "active" : ""}`} onClick={() => setYear(y)}>
                {y}
              </button>
            ))}
          </div>
        )}
        <div className="view-tabs" role="tablist" aria-label="ประเภทตาราง">
          <button type="button" role="tab" aria-selected={view === "drivers"} className={`sort-btn ${view === "drivers" ? "active" : ""}`} onClick={() => update({ view: null })}>
            นักแข่ง
          </button>
          <button type="button" role="tab" aria-selected={view === "teams"} className={`sort-btn ${view === "teams" ? "active" : ""}`} onClick={() => update({ view: "teams" })}>
            ทีม
          </button>
        </div>
      </div>

      {yearsReq.status === "error" && <ErrorState error={yearsReq.error} onRetry={yearsReq.reload} />}
      {standingsReq.status === "loading" && (
        <>
          <p className="panel-hint">⏳ กำลังรวมคะแนนจากทุกสนาม (ครั้งแรกของปีอาจใช้เวลาไม่กี่วินาที)</p>
          <Skeleton variant="row" count={10} />
        </>
      )}
      {standingsReq.status === "error" && <ErrorState title="โหลดตารางคะแนนไม่สำเร็จ" error={standingsReq.error} onRetry={standingsReq.reload} />}
      {standingsReq.status === "empty" && <EmptyState title={`ยังไม่มีเรซที่แข่งจบในปี ${year}`} hint="เลือกปีก่อนหน้า" />}

      {data && (
        <section className="card">
          <p className="panel-hint">
            รวม {data.races.length} รายการ ({data.races.filter((r) => r.sessionName === "Sprint").length} Sprint) · ล่าสุด: {data.races[data.races.length - 1]?.meetingName}
          </p>
          {view === "drivers" ? (
            <table className="data-table standings-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>นักแข่ง</th>
                  <th>ทีม</th>
                  <th className="num hide-sm">ชนะ</th>
                  <th className="num hide-sm">โพเดียม</th>
                  <th className="num">คะแนน</th>
                </tr>
              </thead>
              <tbody>
                {data.drivers.map((d) => (
                  <tr key={d.driverNumber} style={{ "--team-color": `#${d.teamColour}` }}>
                    <td className="rank-cell">{d.rank}</td>
                    <td>
                      <DriverHover year={year} driverNumber={d.driverNumber}>
                        <button type="button" className="name-link" onClick={() => showDriver(d.driverNumber)}>
                          <span className="team-bar" /> {d.fullName} <small className="dim">{d.acronym}</small>
                        </button>
                      </DriverHover>
                    </td>
                    <td>
                      <button type="button" className="name-link team" onClick={() => showTeam(d.teamName)}>
                        <TeamLogo teamName={d.teamName} colour={d.teamColour} year={year} size={22} /> {d.teamName}
                      </button>
                    </td>
                    <td className="num hide-sm">{d.wins}</td>
                    <td className="num hide-sm">{d.podiums}</td>
                    <td className="num points-cell">{d.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="data-table standings-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>ทีม</th>
                  <th>นักแข่ง</th>
                  <th className="num hide-sm">ชนะ</th>
                  <th className="num hide-sm">โพเดียม</th>
                  <th className="num">คะแนน</th>
                </tr>
              </thead>
              <tbody>
                {data.teams.map((t) => (
                  <tr key={t.teamName} style={{ "--team-color": `#${t.teamColour}` }}>
                    <td className="rank-cell">{t.rank}</td>
                    <td>
                      <button type="button" className="name-link" onClick={() => showTeam(t.teamName)}>
                        <TeamLogo teamName={t.teamName} colour={t.teamColour} year={year} size={26} /> {t.teamName}
                      </button>
                    </td>
                    <td>
                      {t.drivers.map((d) => (
                        <DriverHover key={d.driverNumber} year={year} driverNumber={d.driverNumber}>
                          <button type="button" className="name-link small" onClick={() => showDriver(d.driverNumber)}>
                            {d.acronym}
                          </button>
                        </DriverHover>
                      ))}
                    </td>
                    <td className="num hide-sm">{t.wins}</td>
                    <td className="num hide-sm">{t.podiums}</td>
                    <td className="num points-cell">{t.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      <SeasonCards {...season} />
    </div>
  );
}
