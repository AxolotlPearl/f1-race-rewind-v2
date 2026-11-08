// src/pages/ScoreboardPage.jsx — /standings?year=2024&view=drivers&driver=1 | &team=McLaren
// ตารางคะแนนทั้งฤดูกาล (นักขับ / ทีม) + บัตรข้อมูลนักขับและทีมที่กดสลับไปมาได้
//
// ไม่ใช้ useState เก็บ "ปี / แท็บ / บัตรที่เปิด" แต่เก็บใน URL (useSearchParams) เพราะ:
//   - แชร์ลิงก์บัตรของนักขับ/ทีมได้ เช่น /standings?year=2024&team=McLaren
//   - ปุ่ม back ของ browser = ปิดบัตร / ย้อนกลับไปบัตรก่อนหน้า (นักขับ → ทีม → back → นักขับ)
//   - URL เป็นแหล่งความจริงเดียว ถ้าเก็บซ้ำเป็น state ต้องคอย sync กับ URL ตลอด
//
// เปิดบัตรได้ทันทีไม่ต้องยิง API: ตารางคะแนนที่โหลดมามีผลรายสนามของทุกคน/ทุกทีมครบแล้ว
// หา driver/team จาก URL ด้วย HashTable (สร้างครั้งเดียวต่อชุดข้อมูลด้วย useMemo) O(1) แทน .find() O(n)

import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import { useAsync } from "../hooks/useAsync.js";
import { HashTable } from "../dsa/HashTable.js";
import ProfileModal from "../components/ProfileModal.jsx";
import DriverCard from "../components/DriverCard.jsx";
import TeamCard from "../components/TeamCard.jsx";
import { Skeleton, EmptyState, ErrorState } from "../components/StatusViews.jsx";

export default function ScoreboardPage() {
  const [params, setParams] = useSearchParams();
  const yearsReq = useAsync((signal) => api.years(signal), []);

  const latestYear = yearsReq.data?.years?.[0] ?? null;
  const year = Number(params.get("year")) || latestYear;
  const view = params.get("view") === "teams" ? "teams" : "drivers";
  const openDriver = params.get("driver") ? Number(params.get("driver")) : null;
  const openTeam = params.get("team");

  const standingsReq = useAsync((signal) => api.standings(year, signal), [year], {
    enabled: year != null,
    isEmpty: (s) => s.drivers.length === 0,
  });
  const data = standingsReq.status === "success" ? standingsReq.data : null;

  // ดัชนีสำหรับเปิดบัตร O(1) + คะแนนสูงสุดในสนามเดียว (สเกลกราฟแท่งในบัตรนักขับ)
  const lookup = useMemo(() => {
    if (!data) return null;
    const drivers = new HashTable(64);
    const teams = new HashTable(32);
    let maxPoints = 0;
    for (const d of data.drivers) {
      drivers.set(d.driverNumber, d);
      for (const r of d.results) if (r.points > maxPoints) maxPoints = r.points;
    }
    for (const t of data.teams) teams.set(t.teamName, t);
    return { drivers, teams, maxPoints };
  }, [data]);

  /** เปลี่ยนค่าใน URL (push history → กด back ได้) โดยคงค่าอื่นไว้ */
  const update = useCallback(
    (changes) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value == null || value === "") next.delete(key);
          else next.set(key, String(value));
        }
        return next;
      });
    },
    [setParams]
  );

  // บัตรเปิดได้ทีละใบ: เปิดบัตรทีม = ปิดบัตรนักขับ และกลับกัน
  const showDriver = useCallback((num) => update({ driver: num, team: null }), [update]);
  const showTeam = useCallback((name) => update({ team: name, driver: null }), [update]);
  const closeCard = useCallback(() => update({ driver: null, team: null }), [update]);

  const cardDriver = openDriver != null ? lookup?.drivers.get(openDriver) : null;
  const cardTeam = openTeam ? lookup?.teams.get(openTeam) : null;

  return (
    <div className="scoreboard-page">
      <section className="page-head">
        <h1>🏆 ตารางคะแนน {year ?? ""}</h1>
        <p className="page-sub">คะแนนสะสมจากทุก Race และ Sprint ที่แข่งจบแล้ว · คลิกชื่อนักขับหรือทีมเพื่อดูบัตรข้อมูล</p>
      </section>

      <div className="scoreboard-toolbar">
        {yearsReq.status === "success" && (
          <div className="year-chips" role="tablist" aria-label="ฤดูกาล">
            {yearsReq.data.years.map((y) => (
              <button key={y} type="button" role="tab" aria-selected={y === year} className={`chip ${y === year ? "active" : ""}`} onClick={() => update({ year: y, driver: null, team: null })}>
                {y}
              </button>
            ))}
          </div>
        )}
        <div className="view-tabs" role="tablist" aria-label="ประเภทตาราง">
          <button type="button" role="tab" aria-selected={view === "drivers"} className={`sort-btn ${view === "drivers" ? "active" : ""}`} onClick={() => update({ view: null })}>
            นักขับ
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
                  <th>นักขับ</th>
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
                      <button type="button" className="name-link" onClick={() => showDriver(d.driverNumber)}>
                        <span className="team-bar" /> {d.fullName} <small className="dim">{d.acronym}</small>
                      </button>
                    </td>
                    <td>
                      <button type="button" className="name-link team" onClick={() => showTeam(d.teamName)}>
                        {d.teamName}
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
                  <th>นักขับ</th>
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
                        <span className="team-bar" /> {t.teamName}
                      </button>
                    </td>
                    <td>
                      {t.drivers.map((d) => (
                        <button key={d.driverNumber} type="button" className="name-link small" onClick={() => showDriver(d.driverNumber)}>
                          {d.acronym}
                        </button>
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

      {cardDriver && (
        <ProfileModal title={`บัตรนักขับ ${cardDriver.fullName}`} accent={cardDriver.teamColour} onClose={closeCard}>
          <DriverCard driver={cardDriver} year={year} maxPoints={lookup.maxPoints} onOpenTeam={showTeam} />
        </ProfileModal>
      )}
      {cardTeam && (
        <ProfileModal title={`บัตรทีม ${cardTeam.teamName}`} accent={cardTeam.teamColour} onClose={closeCard}>
          <TeamCard team={cardTeam} year={year} onOpenDriver={showDriver} />
        </ProfileModal>
      )}
      {data && ((openDriver != null && !cardDriver) || (openTeam && !cardTeam)) && (
        <ProfileModal title="ไม่พบข้อมูล" onClose={closeCard}>
          <EmptyState title={`ไม่พบ${openTeam ? `ทีม “${openTeam}”` : `นักขับหมายเลข ${openDriver}`} ในฤดูกาล ${year}`} hint="ลองเลือกจากตาราง" />
        </ProfileModal>
      )}
    </div>
  );
}
