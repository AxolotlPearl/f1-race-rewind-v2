// test/stale.test.js — จำลอง "OpenF1 ปิดช่วงแข่งสด" (fetch ตอบ 401) แล้วตรวจว่า Express ใช้ข้อมูลสำรองบนดิสก์
// และจดเวลาบันทึกไว้ใน request context (เพื่อส่ง header X-Data-Saved-At ให้หน้าเว็บแสดงป้าย)
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSessions, requestContext, getOpenF1Status } from "../lib/openf1.js";

const DISK_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "../.cache/openf1");
const apiPath = "/sessions?year=2019&session_type=Race"; // ปีที่แอปไม่ได้ใช้จริง จะไม่ทับข้อมูลสำรองจริง
const file = path.join(DISK_DIR, `${createHash("sha1").update(apiPath).digest("hex")}.json`);
const savedAt = "2026-11-01T10:00:00.000Z";

let passed = 0;
async function test(name, fn) {
  await fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

const realFetch = globalThis.fetch;
globalThis.fetch = async () =>
  new Response(JSON.stringify({ detail: "Live F1 session in progress. Global API access (including past sessions) is restricted" }), { status: 401 });

console.log("Stale-on-error (OpenF1 live lockout)");
try {
  await mkdir(DISK_DIR, { recursive: true });
  await writeFile(file, JSON.stringify({ path: apiPath, savedAt, data: [{ session_key: 1, location: "Test" }] }));

  await test("OpenF1 ตอบ 401 → ได้ข้อมูลสำรองจากดิสก์ + จดเวลาบันทึกใน context", async () => {
    const store = { staleSince: null };
    const data = await requestContext.run(store, () => getSessions(2019));
    assert.equal(data[0].location, "Test");
    assert.equal(store.staleSince, savedAt);
  });

  await test("สถานะเป็น locked หลังเจอ 401 แบบแข่งสด", async () => {
    const status = await getOpenF1Status();
    assert.equal(status.openf1, "locked");
  });

  await test("ไม่มีข้อมูลสำรอง → โยน error ที่มี liveLockout", async () => {
    await assert.rejects(() => getSessions(2018), (err) => err.liveLockout === true);
  });
} finally {
  globalThis.fetch = realFetch;
  await rm(file, { force: true });
}
console.log(`\n${passed} tests passed`);
