// test/standings.test.js — ทดสอบการจัดอันดับคะแนน (รวม countback แบบ F1)
import assert from "node:assert/strict";
import { compareStanding } from "../lib/standings.js";
import { mergeSort } from "../lib/sort.js";

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log("Standings ranking");
test("คะแนนมากกว่าอยู่ก่อน", () => {
  const ranked = mergeSort([{ id: "A", points: 10, finishCounts: [] }, { id: "B", points: 25, finishCounts: [] }], compareStanding);
  assert.deepEqual(ranked.map((x) => x.id), ["B", "A"]);
});
test("คะแนนเท่ากัน → ชนะมากกว่าอยู่ก่อน", () => {
  const a = { id: "A", points: 50, finishCounts: [, 0, 3] };
  const b = { id: "B", points: 50, finishCounts: [, 1] };
  assert.deepEqual(mergeSort([a, b], compareStanding).map((x) => x.id), ["B", "A"]);
});
test("ชนะเท่ากัน → ดูที่ 2 ต่อ", () => {
  const a = { id: "A", points: 50, finishCounts: [, 1, 0, 4] };
  const b = { id: "B", points: 50, finishCounts: [, 1, 1] };
  assert.deepEqual(mergeSort([a, b], compareStanding).map((x) => x.id), ["B", "A"]);
});
test("เท่ากันทุกอย่าง → ลำดับเดิม (merge sort เป็น stable sort)", () => {
  const a = { id: "A", points: 0, finishCounts: [] };
  const b = { id: "B", points: 0, finishCounts: [] };
  assert.deepEqual(mergeSort([a, b], compareStanding).map((x) => x.id), ["A", "B"]);
});

console.log(`\n${passed} tests passed`);
