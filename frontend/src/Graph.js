// src/Graph.js
// โครงสร้างข้อมูล Graph เขียนเอง (adjacency list) — ใช้เชื่อม "เมนู (nav)" กับ "หน้า" ของเว็บ
//   node = หน้า 1 หน้า (home, race, driver, about)
//   edge = เมนู/ลิงก์ที่พาจากหน้าหนึ่งไปอีกหน้าหนึ่ง (directed: A → B แปลว่า "อยู่หน้า A มีเมนูไป B")
//
// NavBar ไม่ได้เขียนรายการเมนูตายตัว แต่ถาม Graph ว่า "หน้าปัจจุบันมี edge ไปไหนบ้าง" (neighbors)
// และใช้ BFS หา "เส้นทางสั้นสุดจากหน้าแรกมาหน้านี้" เพื่อสร้าง breadcrumb
//
// adjacency list เก็บใน HashTable ของเราเอง: nodeId -> array ของ edge ที่ออกจาก node นั้น
// เลือก adjacency list (ไม่ใช่ adjacency matrix) เพราะกราฟของเราเบาบาง (sparse) — E ใกล้ V ไม่ใช่ V²
//   - หาเมนูของหน้าปัจจุบัน neighbors(): O(deg(v)) แทน O(V) ของ matrix
//   - memory O(V + E) แทน O(V²)

import { HashTable } from "./dsa/HashTable.js";
import { Queue } from "./dsa/Queue.js";

export class Graph {
  constructor() {
    this.nodeTable = new HashTable(16); // id -> { id, label, path, icon, params }
    this.adjacency = new HashTable(16); // id -> [{ to, label }]
    this.nodeOrder = []; // ลำดับที่เพิ่ม ใช้วนแสดงผลแบบคงที่
  }

  /** addNode - เพิ่มหน้า O(1). path ใส่ :param ได้แบบ React Router เช่น "/race/:sessionKey" */
  addNode(id, { label, path, icon = "" }) {
    if (this.nodeTable.has(id)) throw new Error(`node ${id} ซ้ำ`);
    // ดึงชื่อพารามิเตอร์ออกจาก path ไว้เช็คว่า "ไปหน้านี้ได้หรือยัง" (มีค่าพารามิเตอร์ครบไหม)
    const params = (path.match(/:(\w+)/g) ?? []).map((p) => p.slice(1));
    this.nodeTable.set(id, { id, label, path, icon, params });
    this.adjacency.set(id, []);
    this.nodeOrder.push(id);
    return this;
  }

  /** addEdge - เพิ่มเมนูจากหน้า from ไปหน้า to O(1). label = ข้อความบนเมนู (ถ้าไม่ใส่ใช้ชื่อหน้าปลายทาง) */
  addEdge(from, to, label) {
    if (!this.nodeTable.has(from) || !this.nodeTable.has(to)) throw new Error(`edge ${from}→${to} ชี้ไป node ที่ไม่มี`);
    this.adjacency.get(from).push({ to, label: label ?? this.nodeTable.get(to).label });
    return this;
  }

  getNode(id) {
    return this.nodeTable.get(id);
  }

  nodes() {
    return this.nodeOrder.map((id) => this.nodeTable.get(id));
  }

  /** neighbors - เมนูทั้งหมดที่ออกจากหน้า id. Time complexity: O(deg(id)) */
  neighbors(id) {
    return (this.adjacency.get(id) ?? []).map((edge) => ({ ...edge, node: this.nodeTable.get(edge.to) }));
  }

  edgeCount() {
    let count = 0;
    for (const id of this.nodeOrder) count += this.adjacency.get(id).length;
    return count;
  }

  /**
   * shortestPath - BFS หาเส้นทางที่ใช้ "จำนวนคลิกน้อยที่สุด" จาก start ไป goal
   * Time complexity: O(V + E) — แต่ละ node เข้าคิวไม่เกิน 1 ครั้ง แต่ละ edge ถูกดูไม่เกิน 1 ครั้ง
   * เลือก BFS (ไม่ใช่ DFS) เพราะทุก edge มีน้ำหนักเท่ากัน (1 คลิก) BFS รับประกันว่าเจอเส้นทางสั้นสุดก่อน
   * @returns array ของ node id จาก start ถึง goal หรือ [] ถ้าไปไม่ถึง
   */
  shortestPath(start, goal) {
    if (!this.nodeTable.has(start) || !this.nodeTable.has(goal)) return [];
    if (start === goal) return [start];

    const previous = new HashTable(16); // node -> node ก่อนหน้าบนเส้นทาง (ใช้ย้อนกลับสร้าง path)
    previous.set(start, null);
    const queue = new Queue(8);
    queue.enqueue(start);

    while (!queue.isEmpty()) {
      const current = queue.dequeue();
      for (const { to } of this.adjacency.get(current)) {
        if (previous.has(to)) continue; // เคยเจอแล้ว (visited)
        previous.set(to, current);
        if (to === goal) {
          const path = [goal];
          let step = current;
          while (step !== null) {
            path.push(step);
            step = previous.get(step);
          }
          return path.reverse();
        }
        queue.enqueue(to);
      }
    }
    return [];
  }

  /**
   * resolvePath - แปลง path ของ node เป็น URL จริงด้วยค่าพารามิเตอร์ที่มี
   * คืน null ถ้าพารามิเตอร์ไม่ครบ (เช่นยังไม่เคยเลือกเรซ เมนู "หน้าเรซ" จึงยังกดไม่ได้)
   */
  resolvePath(id, values) {
    const node = this.nodeTable.get(id);
    if (!node) return null;
    let url = node.path;
    for (const p of node.params) {
      const v = values?.[p];
      if (v == null || v === "") return null;
      url = url.replace(`:${p}`, encodeURIComponent(v));
    }
    return url;
  }
}

// ---------- กราฟของเว็บนี้ ----------
// node 5 หน้า, edge 14 เส้น (ลูกศร = อยู่หน้าต้นทางมีเมนูพาไปหน้าปลายทาง)
//
//   home ──► race ──► driver          home ⇄ standings ⇄ race
//   home ⇄ about    race ⇄ home       driver ──► standings, driver ──► race, driver ──► home
//   race ──► about  standings ──► about  about ──► home
//
// standings (ตารางคะแนน) เชื่อมกับเกือบทุกหน้า เพราะเป็นทางเข้าที่ 2 ของเว็บ (ดูทั้งฤดูกาล แทนดูทีละเรซ)
export const siteGraph = new Graph()
  .addNode("home", { label: "หน้าแรก", path: "/", icon: "🏠" })
  .addNode("standings", { label: "ตารางคะแนน", path: "/standings", icon: "🏆" })
  .addNode("race", { label: "ดูเรซ", path: "/race/:sessionKey", icon: "🏁" })
  .addNode("driver", { label: "เจาะนักขับ", path: "/race/:sessionKey/driver/:driverNumber", icon: "🧑‍✈️" })
  .addNode("about", { label: "เกี่ยวกับ", path: "/about", icon: "ℹ️" })
  .addEdge("home", "race", "เรซที่ดูล่าสุด")
  .addEdge("home", "standings")
  .addEdge("home", "about")
  .addEdge("standings", "home", "ค้นหาเรซ")
  .addEdge("standings", "race", "เรซที่ดูล่าสุด")
  .addEdge("standings", "about")
  .addEdge("race", "home", "ค้นหาเรซอื่น")
  .addEdge("race", "driver")
  .addEdge("race", "standings")
  .addEdge("race", "about")
  .addEdge("driver", "race", "กลับไปดูทั้งเรซ")
  .addEdge("driver", "standings")
  .addEdge("driver", "home", "ค้นหาเรซอื่น")
  .addEdge("about", "home");
