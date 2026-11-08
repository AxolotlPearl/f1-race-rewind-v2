// test/youtube.test.js — ทดสอบการเลือกคลิปไฮไลต์จากผลค้น (ไม่ยิง YouTube จริง)
import assert from "node:assert/strict";
import { pickBest, findHighlight } from "../lib/youtube.js";

let passed = 0;
async function test(name, fn) {
  await fn();
  passed++;
  console.log(`  ✓ ${name}`);
}
const item = (id, title) => ({ id: { videoId: id }, snippet: { title } });
const race = { sessionKey: 1, year: 2024, meetingName: "Japanese Grand Prix", sessionName: "Race", dateStart: "2024-04-07T05:00:00Z" };

console.log("YouTube highlight picking");
await test("เลือกคลิป Race Highlights ของปีที่ถูก", () => {
  const best = pickBest([item("q", "Qualifying Highlights | 2024 Japanese Grand Prix"), item("r", "Race Highlights | 2024 Japanese Grand Prix")], race);
  assert.equal(best.item.id.videoId, "r");
});
await test("ไม่เอาคลิปปีอื่น", () => {
  assert.equal(pickBest([item("old", "Race Highlights | 2023 Japanese Grand Prix")], race), null);
});
await test("Sprint เลือกคลิป Sprint", () => {
  const sprint = { ...race, sessionName: "Sprint" };
  const best = pickBest([item("r", "Race Highlights | 2024 Chinese Grand Prix"), item("s", "Sprint Highlights | 2024 Chinese Grand Prix")], sprint);
  assert.equal(best.item.id.videoId, "s");
});
await test("ไม่มี API key → available false + ลิงก์ค้นหา", async () => {
  const saved = process.env.YOUTUBE_API_KEY;
  delete process.env.YOUTUBE_API_KEY;
  const r = await findHighlight(race);
  assert.equal(r.available, false);
  assert.equal(r.reason, "no-key");
  assert.match(r.searchUrl, /^https:\/\/www\.youtube\.com\/results\?search_query=/);
  if (saved) process.env.YOUTUBE_API_KEY = saved;
});
console.log(`\n${passed} tests passed`);
