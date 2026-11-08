// test/trie.test.js — ทดสอบ Trie (ค้นหาเรซแบบ prefix) ด้วยข้อมูลจำลองหน้าตาเหมือนเรซจริง
import assert from "node:assert/strict";
import { Trie } from "../lib/Trie.js";

const races = [
  "Japanese Grand Prix Suzuka Japan Suzuka 2024 Race",
  "Las Vegas Grand Prix Las Vegas United States Las Vegas 2024 Race",
  "Las Vegas Grand Prix Las Vegas United States Las Vegas 2023 Race",
  "São Paulo Grand Prix São Paulo Brazil Interlagos 2024 Sprint",
  "Monaco Grand Prix Monte Carlo Monaco Monte Carlo 2025 Race",
];
const trie = new Trie();
races.forEach((text, id) => trie.insertText(text, id));

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log("Trie");
test("prefix ของคำเดียว", () => assert.deepEqual(trie.search("suz"), [0]));
test("ไม่สนตัวพิมพ์เล็ก/ใหญ่", () => assert.deepEqual(trie.search("MONACO"), [4]));
test("หลายคำต้องตรงทุกคำ (AND)", () => assert.deepEqual(trie.search("las 2024"), [1]));
test("คำที่ไม่มีคืน array ว่าง", () => assert.deepEqual(trie.search("silverstone"), []));
test("ตัดเครื่องหมายเสียง São → sao", () => assert.deepEqual(trie.search("sao paulo"), [3]));
test("id ไม่ซ้ำแม้คำซ้ำหลายครั้งใน item เดียว", () => assert.deepEqual(trie.search("vegas"), [1, 2]));
test("คำค้นว่าง", () => assert.deepEqual(trie.search("   "), []));
test("ลำดับคำไม่มีผล", () => assert.deepEqual(trie.search("2023 vegas"), [2]));
test("คำซ้ำในคำค้น", () => assert.deepEqual(trie.search("las las"), [1, 2]));

console.log(`\n${passed} tests passed`);
