// src/components/SeasonCards.jsx
// แสดง "บัตรที่เปิดอยู่" (บัตรนักแข่ง หรือ บัตรทีม) ตามค่าใน URL — ใช้ทั้งหน้าตารางคะแนนและหน้านักแข่ง
// props มาจาก useSeason(): year, data, lookup, openDriver, openTeam, showDriver, showTeam, closeCard

import ProfileModal from "./ProfileModal.jsx";
import DriverCard from "./DriverCard.jsx";
import TeamCard from "./TeamCard.jsx";
import { EmptyState } from "./StatusViews.jsx";

export default function SeasonCards({ year, data, lookup, openDriver, openTeam, showDriver, showTeam, closeCard }) {
  if (!data || !lookup) return null;
  const cardDriver = openDriver != null ? lookup.drivers.get(openDriver) : null;
  const cardTeam = openTeam ? lookup.teams.get(openTeam) : null;

  if (cardDriver) {
    return (
      <ProfileModal title={`บัตรนักแข่ง ${cardDriver.fullName}`} accent={cardDriver.teamColour} onClose={closeCard}>
        <DriverCard driver={cardDriver} year={year} maxPoints={lookup.maxPoints} onOpenTeam={showTeam} teamLookup={lookup.teams} />
      </ProfileModal>
    );
  }
  if (cardTeam) {
    return (
      <ProfileModal title={`บัตรทีม ${cardTeam.teamName}`} accent={cardTeam.teamColour} onClose={closeCard}>
        <TeamCard team={cardTeam} year={year} onOpenDriver={showDriver} />
      </ProfileModal>
    );
  }
  if (openDriver != null || openTeam) {
    return (
      <ProfileModal title="ไม่พบข้อมูล" onClose={closeCard}>
        <EmptyState title={`ไม่พบ${openTeam ? `ทีม “${openTeam}”` : `นักแข่งหมายเลข ${openDriver}`} ในฤดูกาล ${year}`} hint="ลองเลือกจากรายชื่อ" />
      </ProfileModal>
    );
  }
  return null;
}
