// src/components/TeamLogo.jsx
// โลโก้ทีมจากคลังภาพของ formula1.com (OpenF1 ไม่มีโลโก้ให้)
// URL มีรูปแบบ .../teams/<ปี>/<slug>-logo.png — ลองปีที่ดูอยู่ก่อน ถ้าไม่มี (เช่นปี 2026 ที่ยังไม่มีไฟล์)
// ถอยไปปีก่อนหน้า และถ้าไม่มีเลย (ทีมใหม่เช่น Cadillac) แสดงป้ายตัวย่อสีทีมแทน ไม่ให้เห็นรูปแตก
//
// state: attempt — ลำดับ URL ที่กำลังลอง (onError → ลองตัวถัดไป)
// จำผลไว้ใน HashTable ระดับ module: ทีมที่หาไม่เจอแล้วไม่ต้องลองซ้ำทุกครั้งที่ render โลโก้ทีมเดิม

import { useState } from "react";
import { HashTable } from "../dsa/HashTable.js";

const BASE = "https://media.formula1.com/content/dam/fom-website/teams";
const LOGO_YEARS = [2025, 2024, 2023]; // ปีที่มีไฟล์โลโก้ (ตรวจแล้ว)

// ชื่อทีมจาก OpenF1 → slug ในคลังภาพ (บางทีมใช้ slug ต่างกันแต่ละปี จึงมีหลายตัวเลือก)
const SLUG_ALIASES = {
  "Haas F1 Team": ["haas-f1-team", "haas"],
  "Racing Bulls": ["racing-bulls", "rb"],
  RB: ["rb", "racing-bulls"],
};

const resolved = new HashTable(32); // "ปี|ทีม" -> index ของ URL ที่ใช้ได้ หรือ -1 (ไม่มีโลโก้)

function candidateUrls(teamName, year) {
  const slugs = SLUG_ALIASES[teamName] ?? [teamName.toLowerCase().replace(/\s+/g, "-")];
  const years = [year, ...LOGO_YEARS.filter((y) => y !== year && y <= (year ?? 9999))];
  const urls = [];
  for (const y of years) {
    if (!LOGO_YEARS.includes(y)) continue;
    for (const slug of slugs) urls.push(`${BASE}/${y}/${slug}-logo.png.transform/2col/image.png`);
  }
  return urls;
}

/** monogram - ตัวย่อทีม เช่น "Red Bull Racing" → "RBR", "McLaren" → "MCL" */
function monogram(teamName) {
  const words = teamName.split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words.map((w) => w[0]).join("") : teamName.slice(0, 3)).toUpperCase().slice(0, 3);
}

// key ผูกกับปี+ทีม: เปลี่ยนทีม = component ใหม่ state attempt เริ่มนับใหม่ (ไม่ค้างค่าของทีมเดิม)
export default function TeamLogo(props) {
  return <TeamLogoImage key={`${props.year}|${props.teamName}`} {...props} />;
}

function TeamLogoImage({ teamName, colour, year, size = 28 }) {
  const key = `${year}|${teamName}`;
  const urls = candidateUrls(teamName, year);
  const known = resolved.get(key);
  const [attempt, setAttempt] = useState(known ?? 0);
  const index = known ?? attempt;

  if (index < 0 || index >= urls.length) {
    return (
      <span className="team-logo monogram" style={{ width: size, height: size, "--team-color": `#${colour ?? "888888"}`, fontSize: size * 0.34 }} aria-label={teamName}>
        {monogram(teamName)}
      </span>
    );
  }

  return (
    <span className="team-logo" style={{ width: size, height: size, "--team-color": `#${colour ?? "888888"}` }}>
      <img
        src={urls[index]}
        alt={`โลโก้ ${teamName}`}
        loading="lazy"
        onLoad={() => resolved.set(key, index)}
        onError={() => {
          const next = index + 1;
          if (next >= urls.length) resolved.set(key, -1);
          setAttempt(next);
        }}
      />
    </span>
  );
}
