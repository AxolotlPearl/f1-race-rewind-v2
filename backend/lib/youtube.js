// lib/youtube.js
// หาคลิปไฮไลต์ของเรซจากช่อง YouTube ทางการของ Formula 1 ผ่าน YouTube Data API v3
//
// ทำไมต้องผ่าน Express:
//   - YouTube Data API ต้องใช้ API key — ถ้าเรียกจาก browser key จะหลุดไปอยู่ในโค้ดหน้าเว็บ ใครก็ก๊อปไปใช้ได้
//     Express อ่าน key จาก environment (ไฟล์ backend/.env ที่ไม่ขึ้น git) แล้วส่งให้หน้าเว็บแค่ videoId
//   - โควตาฟรีวันละ 10,000 หน่วย แต่การค้น 1 ครั้งใช้ 100 หน่วย (= ค้นได้แค่ ~100 ครั้ง/วัน)
//     จึง cache ผลไว้ใน HashTable: เรซหนึ่งค้นครั้งเดียวแล้วใช้ซ้ำให้ทุกคน (ไม่เจอ = cache 1 ชั่วโมงแล้วลองใหม่)
//
// ไม่มี key → ตอบ available: false พร้อมลิงก์ค้นหาบน YouTube ให้หน้าเว็บแสดงปุ่มแทน (ระบบยังใช้ได้ ไม่ error)

import { HashTable } from "./HashTable.js";

const F1_CHANNEL_ID = "UCB_qr75-ydFVKSF9Dmo6izg"; // ช่อง FORMULA 1 (youtube.com/@Formula1)
const NOT_FOUND_TTL_MS = 60 * 60 * 1000;
const cache = new HashTable(64); // sessionKey -> { data, expiresAt }

function buildQuery(race) {
  const kind = race.sessionName === "Sprint" ? "Sprint" : "Race";
  return `${kind} Highlights ${race.year} ${race.meetingName}`;
}

export function youtubeSearchUrl(race) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`F1 ${buildQuery(race)}`)}`;
}

/** decodeEntities - ชื่อคลิปจาก API มี HTML entity (&amp; &#39;) */
function decodeEntities(text) {
  return String(text)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/**
 * pickBest - เลือกคลิปที่ "ชื่อมีคำว่า Highlights + ปี + ประเภท (Race/Sprint) ตรง" ก่อน
 * ผลค้นของ YouTube บางทีเอาคลิปปีอื่นหรือคลิปควอลิฟายขึ้นมาก่อน จึงให้คะแนนแต่ละคลิปแล้วเลือกตัวที่ดีที่สุด O(k), k ≤ 5
 */
export function pickBest(items, race) {
  const wantSprint = race.sessionName === "Sprint";
  let best = null;
  let bestScore = -1;
  for (const item of items) {
    const title = decodeEntities(item.snippet?.title ?? "");
    const lower = title.toLowerCase();
    let score = 0;
    if (lower.includes("highlights")) score += 4;
    if (lower.includes(String(race.year))) score += 3;
    if (wantSprint === lower.includes("sprint")) score += 2;
    if (lower.includes("qualifying") || lower.includes("practice") || lower.includes("fp1")) score -= 5;
    if (score > bestScore) {
      best = { item, title };
      bestScore = score;
    }
  }
  return bestScore >= 7 ? best : null; // ต้องมี highlights + ปี ตรงเป็นอย่างน้อย ไม่งั้นถือว่าไม่เจอ
}

/** findHighlight - { available, videoId?, title?, thumbnail?, searchUrl, reason? } */
export async function findHighlight(race) {
  const searchUrl = youtubeSearchUrl(race);
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return { available: false, reason: "no-key", searchUrl };

  const hit = cache.get(race.sessionKey);
  if (hit && hit.expiresAt > Date.now()) return hit.data;

  const params = new URLSearchParams({
    part: "snippet",
    channelId: F1_CHANNEL_ID,
    q: buildQuery(race),
    type: "video",
    maxResults: "5",
    // คลิปไฮไลต์ลงหลังเรซจบ — จำกัดช่วงเวลาให้ไม่ไปเจอคลิปของปีก่อน
    publishedAfter: new Date(Date.parse(race.dateStart) - 86400000).toISOString(),
    key,
  });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  if (!res.ok) {
    // key ผิด/โควตาหมด — ไม่ทำให้หน้าเรซพัง แค่ถอยไปใช้ลิงก์ค้นหาแทน
    console.error(`YouTube API ตอบ ${res.status}`);
    return { available: false, reason: res.status === 403 ? "quota" : "error", searchUrl };
  }
  const body = await res.json();
  const best = pickBest(body.items ?? [], race);

  const data = best
    ? {
        available: true,
        videoId: best.item.id.videoId,
        title: best.title,
        thumbnail: best.item.snippet.thumbnails?.high?.url ?? best.item.snippet.thumbnails?.default?.url ?? null,
        publishedAt: best.item.snippet.publishedAt,
        searchUrl,
      }
    : { available: false, reason: "not-found", searchUrl };

  cache.set(race.sessionKey, { data, expiresAt: best ? Infinity : Date.now() + NOT_FOUND_TTL_MS });
  return data;
}
