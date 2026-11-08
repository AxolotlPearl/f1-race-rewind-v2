// lib/Trie.js
// Trie (prefix tree) เขียนเอง — ใช้ทำ "ค้นหาเรซแบบพิมพ์แล้วขึ้นทันที" (autocomplete) ฝั่ง Express
//
// ทำไมเป็น Trie:
//   - งานแรกผู้ใช้ต้องเลือก "ปี" ก่อน แล้วค่อยเลื่อนหา "เรซ" ใน dropdown ยาว ๆ (2 ขั้น และต้องรู้ปีก่อน)
//   - งานนี้พิมพ์ "suz", "monaco", "las 2024" ก็เจอเรซจากทุกปีในช่องเดียว
//   - ถ้าค้นแบบเดิม (วนทุกเรซแล้ว .includes()) = O(N × L) ต่อการกดแป้น 1 ครั้ง (N = จำนวนเรซทุกปี
//     ~100+, L = ความยาวข้อความ) ส่วน Trie เดินตามตัวอักษรของคำค้น O(P) (P = ความยาวคำค้น)
//     แล้วอ่านรายการ id ที่เก็บไว้ที่ node นั้นได้ทันที O(k) (k = จำนวนผลที่ต้องการ)
//   - แลกกับ memory ตอนสร้าง: O(total characters ของทุกคำ) สร้างครั้งเดียวต่อ instance แล้วใช้ซ้ำ
//
// node.children ใช้ HashTable ของเราเอง (ไม่ใช้ Map/object) — key = ตัวอักษร 1 ตัว

import { HashTable } from "./HashTable.js";

class TrieNode {
  constructor() {
    this.children = new HashTable(4);
    // id ของทุก item ที่มีคำขึ้นต้นด้วย prefix ของ node นี้ (เก็บไว้ล่วงหน้า → ค้นไม่ต้องเดินทั้งกิ่ง)
    this.ids = [];
    this.lastId = null; // กันใส่ id ซ้ำใน node เดียวกัน เมื่อ item เดียวมีหลายคำที่ prefix เหมือนกัน
  }
}

export class Trie {
  constructor() {
    this.root = new TrieNode();
    this.wordCount = 0;
  }

  /** normalize - ตัวเล็ก + ตัดเครื่องหมาย ให้ "São Paulo" กับ "sao paulo" เจอเหมือนกัน */
  static normalize(text) {
    return String(text)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .trim();
  }

  /** tokenize - แตกข้อความเป็นคำ (ตัด - _ / , . เว้นวรรค) */
  static tokenize(text) {
    return Trie.normalize(text)
      .split(/[\s\-_/,.()]+/)
      .filter(Boolean);
  }

  /**
   * insert - ใส่คำ 1 คำ ผูกกับ id ของ item
   * Time complexity: O(W) โดย W = ความยาวคำ
   */
  insert(word, id) {
    let node = this.root;
    for (const ch of word) {
      let next = node.children.get(ch);
      if (!next) {
        next = new TrieNode();
        node.children.set(ch, next);
      }
      node = next;
      if (node.lastId !== id) {
        node.ids.push(id);
        node.lastId = id;
      }
    }
    this.wordCount++;
  }

  /** insertText - แตกข้อความเป็นคำแล้ว insert ทุกคำกับ id เดียวกัน */
  insertText(text, id) {
    for (const word of Trie.tokenize(text)) this.insert(word, id);
  }

  /**
   * startsWith - id ทั้งหมดที่มีคำขึ้นต้นด้วย prefix
   * Time complexity: O(P) เดินตามตัวอักษร + คืน array ที่เก็บไว้แล้ว (ไม่ต้อง DFS ทั้งกิ่ง)
   */
  startsWith(prefix) {
    let node = this.root;
    for (const ch of prefix) {
      node = node.children.get(ch);
      if (!node) return [];
    }
    return node.ids;
  }

  /**
   * search - ค้นหลายคำพร้อมกัน ("las vegas 2024") ผลต้องตรง "ทุกคำ" (AND)
   * ใช้ HashTable นับว่าแต่ละ id ตรงกี่คำ: O(Σ|ids ของแต่ละคำ|)
   */
  search(query) {
    const tokens = Trie.tokenize(query);
    if (tokens.length === 0) return [];

    // เริ่มจากคำที่มีผลน้อยสุด ลดงานการ intersect
    const lists = tokens.map((t) => this.startsWith(t));
    let smallest = 0;
    for (let i = 1; i < lists.length; i++) if (lists[i].length < lists[smallest].length) smallest = i;
    if (lists[smallest].length === 0) return [];
    if (lists.length === 1) return lists[0].slice();

    const hits = new HashTable(Math.max(16, lists[smallest].length * 2));
    for (const id of lists[smallest]) hits.set(id, 1);
    let round = 1; // id ที่ "ผ่านมาแล้วทุกรอบ" จะมี count === round
    for (let i = 0; i < lists.length; i++) {
      if (i === smallest) continue;
      for (const id of lists[i]) {
        if (hits.get(id) === round) hits.set(id, round + 1);
      }
      round++;
    }
    return lists[smallest].filter((id) => hits.get(id) === tokens.length);
  }
}
