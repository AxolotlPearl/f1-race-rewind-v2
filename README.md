# 🏁 F1 Race Rewind v2 — React + Vite / Express

ใบงาน **ต่อยอดงาน API ด้วย React-Vite + Express** วิชา 801201 การออกแบบอัลกอริทึมและการพัฒนาเว็บ

| | |
|---|---|
| **API ที่ใช้** | [OpenF1 API](https://openf1.org) (API เดิมจากงานแรก ไม่ต้องใช้ API key) |
| **งานแรก (Before)** | repo [AxolotlPearl/f1-race-rewind](https://github.com/AxolotlPearl/f1-race-rewind) · เว็บ https://miniprojectnodejs.vercel.app |
| **งานนี้ (After)** | repo นี้ (fork มาจากงานแรก ประวัติ commit เดิมอยู่ครบ) |
| **คลิปนำเสนอ** | _(ใส่ลิงก์ YouTube แบบ Unlisted)_ |

เว็บสำหรับ "ดูย้อนหลัง" ว่าเรซ Formula 1 แต่ละสนามเกิดอะไรขึ้น: ไทม์ไลน์การแซง/เข้าพิท/ธง, แผนที่สนามที่รถวิ่งจริง
และ (ใหม่) หน้าเจาะนักขับรายคน, ค้นหาเรซข้ามทุกฤดูกาล ตารางคะแนนทั้งฤดูกาลพร้อมบัตรนักแข่ง/บัตรทีม, หน้านักแข่งพร้อมโลโก้ทีม และโปรไฟล์ย่อเมื่อชี้เมาส์ที่ชื่อนักแข่ง

---

## วิธีรัน

ต้องมี Node.js 18 ขึ้นไป

```bash
npm run install:all
```

เปิด 2 terminal:

```bash
npm run dev:backend
```

```bash
npm run dev:frontend
```

แล้วเปิด http://localhost:5173 — Vite proxy `/api/*` ไปหา Express ที่พอร์ต 3001 ให้เอง ([frontend/vite.config.js](frontend/vite.config.js))

รันแบบ production เครื่องเดียว (Express เสิร์ฟทั้ง API และไฟล์ React ที่ build แล้ว) ที่ http://localhost:3001:

```bash
npm run build && npm start
```

ทดสอบ DSA ฝั่ง backend (merge sort, HashTable, Queue, rate limiter, Trie):

```bash
npm test
```

## โครงสร้างโปรเจกต์

```
frontend/                React + Vite
  src/Graph.js           ★ Graph (adjacency list + BFS) เชื่อมเมนูกับหน้า
  src/App.jsx            Routes + state ที่ใช้ร่วมกันหลายหน้า
  src/pages/             HomePage, ScoreboardPage, DriversPage, RacePage, DriverPage, AboutPage, NotFoundPage
  src/components/        NavBar, SearchBox, RaceCard, SummaryBar, TrackMap, TimelinePanel,
                         TimelineCard, ResultsTable, FastestPits, StatusViews,
                         ProfileModal, DriverCard, TeamCard, SeasonCards (บัตรนักแข่ง/ทีม),
                         TeamLogo (โลโก้ทีม), DriverHover (โปรไฟล์ย่อตอนชี้เมาส์)
  src/hooks/useAsync.js  hook โหลดข้อมูล (loading/empty/error/success + กันยิงซ้ำ)
  src/hooks/useSeason.js ปี + ตารางคะแนน + บัตรที่เปิด (อ่าน/เขียนผ่าน URL) ใช้ร่วม 2 หน้า
  src/seasonCache.js     cache ตารางคะแนนต่อปี (Promise ใน HashTable) ให้ป๊อปอัปทุกจุดใช้ร่วม
  src/player/MapPlayer.js เครื่องเล่นตำแหน่งรถบนแผนที่ (requestAnimationFrame)
  src/dsa/               mergeSort, HashTable, Queue (ชุดเดียวกับ backend)
  src/api.js             เรียก Express + cache ใน localStorage
backend/                 Express
  server.js              routes + validate + error middleware
  lib/Trie.js            ★ Trie สำหรับค้นหาเรซ (DSA ใหม่)
  lib/searchIndex.js     ดัชนีค้นหาข้ามทุกปี
  lib/standings.js       ★ ตารางคะแนนนักขับ/ทีมทั้งฤดูกาล + countback
  lib/driverStory.js     ★ สรุปเรื่องราวนักขับ (ประมวลผลที่ server)
  lib/races.js           รายชื่อเรซที่แข่งจบแล้ว
  lib/timeline.js        รวม 5 endpoint เป็นไทม์ไลน์เดียว (merge sort)
  lib/openf1.js          client + cache (HashTable) + retry
  lib/rateLimiter.js     คิว 2 ระดับคุม 3 req/s, 30 req/min
  lib/trackBuilder.js    สร้างเส้นสนามจากพิกัด GPS
  data/tracks/           เส้นสนามที่ precompute ไว้ (26 สนาม)
  test/                  unit test ของ DSA
docs/decision-log-v1.md  decision log ของงานแรก (path ในไฟล์อ้างโครงสร้างเดิม)
```

---

## 8.1 ตารางส่วนร่วม

> ⚠️ ตรวจว่าชิ้นงานของแต่ละคนตรงกับที่ทำจริง (สลับแถวได้) — ต้องตรงกับ commit history ใน GitHub ที่แต่ละคน commit ด้วยชื่อตัวเอง

| ชื่อ-สกุล | รหัสนักศึกษา | ชิ้นงานที่รับผิดชอบ (ไฟล์ / component / route / DSA) | ช่วงที่นำเสนอในคลิป |
|---|---|---|---|
| น.ส.สมัชญา จันทร์สว่าง | 681310797 | **React**: `App.jsx`, `NavBar.jsx`, `Graph.js` (Graph + BFS), `useAsync.js`, `RacePage.jsx`, `TimelinePanel.jsx` | ช่วง 4 อธิบายโค้ด React |
| น.ส.สรัลพร สุขสมวงศ์ | 681310023 | **UX**: `HomePage.jsx`, `SearchBox.jsx`, `DriverPage.jsx`, `ScoreboardPage.jsx`, `DriversPage.jsx` + `DriverCard`/`TeamCard`/`ProfileModal`/`TeamLogo`/`DriverHover`, `StatusViews.jsx`, `TrackMap.jsx` + `MapPlayer.js`, ตาราง Before→After | ช่วง 2 จากงานแรกสู่งานนี้, ช่วง 3 Demo |
| นายธนพัฒน์ ก๋งเม่ง | 681310011 | **Express / DSA**: `server.js` (validate, error middleware, routes), `lib/Trie.js`, `lib/searchIndex.js`, `lib/driverStory.js`, `lib/standings.js`, `test/trie.test.js`, `test/standings.test.js` | ช่วง 5 Express และ DSA |

---

## 8.2 ตารางข้อแนะนำจากงานแรก → สิ่งที่แก้

> ⚠️ คอลัมน์ซ้ายต้องเป็น **ข้อแนะนำที่อาจารย์ให้จริง** — ด้านล่างคือสิ่งที่ปรับปรุงไปแล้วในงานนี้ ให้จับคู่กับข้อแนะนำจริง
> (ภาพ Before ถ่ายจาก https://miniprojectnodejs.vercel.app หรือรัน repo งานแรก, ภาพ After ถ่ายจากเว็บนี้)

| ข้อแนะนำจากงานแรก | สิ่งที่แก้ในงานนี้ | หลักฐาน Before / After |
|---|---|---|
| _(ใส่ข้อแนะนำจริง)_ | **flow หาเรซยาว** — เดิมต้องเลือกปีจาก dropdown แล้วเลื่อนหาเรซใน dropdown ยาว ~24 รายการ (ต้องรู้ปีก่อน) → เพิ่มช่องค้นหาข้ามทุกปี (Trie ฝั่ง Express) พิมพ์ "suz" + Enter ถึงหน้าเรซ | Before: 2 dropdown (ปี → เรซ) · After: `SearchBox` autocomplete + คีย์บอร์ด ↑↓ Enter |
| _(ใส่ข้อแนะนำจริง)_ | **โค้ด frontend เป็นไฟล์เดียว** — เดิม `public/app.js` 1,267 บรรทัด DOM + state ปนกันในไฟล์เดียว → แยกเป็น React 5 หน้า 10 component + hook + player class | Before: `public/app.js` (git history) · After: `frontend/src/` |
| _(ใส่ข้อแนะนำจริง)_ | **แชร์/รีเฟรชแล้วหลุด** — เดิม URL เป็น `/` เสมอ รีเฟรชแล้วกลับไปเรซล่าสุด แชร์เรซที่ดูอยู่ไม่ได้ → ทุกหน้ามี URL ของตัวเอง (`/race/9496`, `/race/9496/driver/1`) | Before: URL เดียว · After: React Router + deep link |
| _(ใส่ข้อแนะนำจริง)_ | **ดูนักขับคนเดียวยาก** — เดิมต้องกรองไทม์ไลน์แล้วนับเอง → หน้าเจาะนักขับ: ผลจบ, แซง/โดนแซง, พิทเร็วสุดอันดับเท่าไรของสนาม, คู่ปรับหลัก | Before: dropdown กรองนักขับ · After: `DriverPage` |
| _(ใส่ข้อแนะนำจริง)_ | **Express ทำหน้าที่ไม่ชัด / error** — เดิม error handling กระจายทุก route, browser ต้องลองไฟล์เส้นสนามเองแล้วค่อยยิงอีก endpoint → `wrap()` + `ApiError` + error middleware กลาง, `/api/track` ตัดสินใจแทนใน request เดียว | Before: `api/index.js` · After: `backend/server.js` |

---

## 3.3 Component Tree และทิศทาง props

```
<BrowserRouter>
└─ App                                  state: recent  (เรซ/นักขับที่ดูล่าสุด)
   ├─ NavBar        ◄─ props: graph, currentId, params, labels
   └─ <Routes>
      ├─ HomePage   ◄─ props: recentRace                    state: year
      │  ├─ SearchBox    ──► callback onPick(race) ขึ้นไปหา HomePage (navigate)
      │  │                                                   state: query, debounced, activeIndex, open
      │  └─ RaceCard ×n  ◄─ props: race, featured
      ├─ RacePage   ◄─ props: onVisitRace (callback ขึ้นไปหา App)
      │  │                                                   state: currentEventId, playRequest
      │  ├─ SummaryBar   ◄─ props: sessionKey, summary, dataAvailability
      │  ├─ TrackMap     ◄─ props: race, timeline, playRequest
      │  │               ──► callback onEventChange(eventId) ขึ้นไปหา RacePage
      │  │                                                   state: status {playing, speed, statusText}
      │  ├─ TimelinePanel◄─ props: events, drivers, currentEventId
      │  │  │            ──► callback onSelectEvent(event) ขึ้นไปหา RacePage
      │  │  │                                                state: sortKey, driverFilter, typeFilter, highlightedDriver
      │  │  └─ TimelineCard ×n ◄─ props: event, isCurrent, dim, highlight
      │  │                     ──► callback onSelect(event), onDriverClick(num)
      │  ├─ ResultsTable ◄─ props: sessionKey, results       state: sortKey, sortAsc
      │  └─ FastestPits  ◄─ props: sessionKey, pits
      ├─ DriverPage ◄─ props: onVisitRace, onVisitDriver (callback ขึ้นไปหา App)
      │  ├─ StatCard ×5   ◄─ props: label, value, sub, color
      │  └─ TimelineCard ×n ◄─ props: event   (ใช้ component เดียวกับหน้าเรซ)
      ├─ ScoreboardPage   ใช้ hook useSeason()                (ปี/แท็บ/บัตรที่เปิด อยู่ใน URL ไม่ใช่ state)
      │  ├─ TeamLogo ×n  ◄─ props: teamName, colour, year, size   state: attempt
      │  ├─ DriverHover ×n ◄─ props: year, driverNumber, children  state: open, pos, info
      │  └─ SeasonCards  ◄─ props: year, data, lookup, openDriver, openTeam, showDriver, showTeam, closeCard
      ├─ DriversPage      ใช้ hook useSeason()                                     state: filter
      │  ├─ TeamLogo / DriverHover / DriverTile ◄─ props: driver, year, onOpen (callback)
      │  └─ SeasonCards  (บัตรชุดเดียวกับหน้าตารางคะแนน)
      │     ↓ SeasonCards render:
      │  └─ ProfileModal ◄─ props: title, accent, onClose (callback ปิดบัตร)
      │     ├─ DriverCard ◄─ props: driver, year, maxPoints, teamLookup
      │     │             ──► callback onOpenTeam(teamName) ขึ้นไปหา ScoreboardPage (สลับเป็นบัตรทีม)
      │     │   └─ Headshot ◄─ props: url, alt               state: failed
      │     └─ TeamCard   ◄─ props: team, year
      │                   ──► callback onOpenDriver(driverNumber) ขึ้นไปหา ScoreboardPage (สลับเป็นบัตรนักขับ)
      └─ AboutPage  ◄─ props: graph
(ทุกหน้าใช้ Skeleton / EmptyState / ErrorState จาก StatusViews.jsx)
```

**ทำไมวาง state ไว้ตรงนั้น**

- **`currentEventId` และ `playRequest` อยู่ที่ `RacePage`** — `TrackMap` เป็นคนรู้ว่าเวลาบนแผนที่ถึงเหตุการณ์ไหน แต่
  `TimelinePanel` เป็นคนต้องไฮไลต์/เลื่อนการ์ด และกลับกัน `TimelinePanel` รู้ว่าผู้ใช้คลิกการ์ดไหน แต่ `TrackMap`
  เป็นคนเล่น — สอง component เป็นพี่น้องกัน props ไหลลงอย่างเดียว จึงยก state ขึ้นไปที่แม่ร่วม (lifting state up)
  แล้วให้ลูกส่งค่ากลับขึ้นมาผ่าน callback
- **`recent` อยู่ที่ `App`** — `NavBar` ต้องรู้ว่าดูเรซไหนอยู่เพื่อสร้างลิงก์ "เรซที่ดูล่าสุด" แม้ตอนอยู่หน้าแรก/หน้าเกี่ยวกับ
  ถ้าเก็บใน `RacePage` ค่าจะหายทันทีที่ออกจากหน้า (unmount)
- **sort/filter อยู่ใน `TimelinePanel`, การเรียงตารางอยู่ใน `ResultsTable`** — มี component เดียวที่ใช้ ไม่ต้องยกขึ้นไป
  ยกขึ้นไปจะทำให้ `RacePage` re-render ทั้งหน้า (รวมแผนที่) ทุกครั้งที่กดเรียง โดยไม่จำเป็น
- **บัตรที่เปิดอยู่ในหน้าตารางคะแนนอยู่ใน URL** (`?driver=1` / `?team=McLaren`) ผ่าน `useSearchParams` — DriverCard กับ TeamCard
  ไม่ได้เปิดกันเองโดยตรง แต่ส่ง callback `onOpenTeam`/`onOpenDriver` ขึ้นไปให้ `ScoreboardPage` เปลี่ยน URL แล้ว render บัตรใบใหม่
  ผลคือแชร์ลิงก์บัตรได้ และปุ่ม back = ย้อนกลับไปบัตรก่อนหน้า (นักขับ → ทีม → back → นักขับ)
- **นักขับที่ดูอยู่ (`DriverPage`) ไม่ได้เป็น state เลย** — อ่านจาก URL (`useParams`) เพราะ URL คือแหล่งความจริงอยู่แล้ว
  (แชร์ลิงก์/กด back/รีเฟรชได้) เก็บซ้ำเป็น state เสี่ยงไม่ตรงกับ URL

---

## 8.3 ตาราง useState

| ชื่อ state | เก็บข้อมูลอะไร | อยู่ใน component | เปลี่ยนค่าเมื่อใด / โดยใคร | ทำไมต้องเป็น state |
|---|---|---|---|---|
| `recent` | เรซ + นักขับที่ดูล่าสุด `{ race, driver }` | `App` | `RacePage`/`DriverPage` เรียก callback `onVisitRace`/`onVisitDriver` เมื่อโหลดหัวเรื่องเรซ/นักขับสำเร็จ | NavBar ต้อง re-render เมนู/breadcrumb ตามค่านี้ และต้องอยู่ข้ามการเปลี่ยนหน้า |
| `year` | ปีที่ผู้ใช้กดเลือก (`null` = ยังไม่เลือก) | `HomePage` | ผู้ใช้กดปุ่มปี | เปลี่ยนแล้วต้องโหลดและแสดงรายชื่อเรซชุดใหม่ (ปีที่ "แสดง" คำนวณจาก `year ?? ปีล่าสุดจาก API` ไม่เก็บซ้ำ) |
| `query` | ข้อความในช่องค้นหา | `SearchBox` | ผู้ใช้พิมพ์ (`onChange`) | controlled input — ช่องต้องแสดงค่าที่พิมพ์ |
| `debounced` | `query` ที่นิ่งแล้ว 250ms | `SearchBox` | effect debounce ตั้งค่าหลังหยุดพิมพ์ | เป็น dependency ของการยิง `/api/search` — ยิงตอนหยุดพิมพ์ ไม่ใช่ทุกการกดแป้น |
| `activeIndex` | แถวผลค้นหาที่ไฮไลต์ | `SearchBox` | ผู้ใช้กด ↑↓ / เอาเมาส์ชี้, รีเซ็ตเมื่อผลชุดใหม่มา | ต้อง re-render ไฮไลต์ และ Enter ต้องรู้ว่าเลือกแถวไหน |
| `open` | dropdown ผลค้นหาเปิดอยู่ไหม | `SearchBox` | focus/พิมพ์ = เปิด, blur/Esc/เลือกแล้ว = ปิด | ควบคุมการแสดง panel |
| `currentEventId` | id เหตุการณ์ที่ตรงกับเวลาบนแผนที่ | `RacePage` | `TrackMap` เรียก `onEventChange` เมื่อเวลาข้ามไปเหตุการณ์ใหม่ | `TimelinePanel` ต้องไฮไลต์การ์ด + เลื่อนตาม (แชร์ระหว่างลูก 2 ตัว) |
| `playRequest` | เหตุการณ์ที่ผู้ใช้คลิกให้เล่นบนแผนที่ `{ event }` | `RacePage` | ผู้ใช้คลิกการ์ดใน `TimelinePanel` (callback `onSelectEvent`) | `TrackMap` ต้องรู้ว่าต้องเล่น — object ใหม่ทุกคลิกจึงคลิกการ์ดเดิมซ้ำแล้วเล่นซ้ำได้ |
| `status` | `{ playing, speed, statusText }` ของเครื่องเล่น | `TrackMap` | `MapPlayer` เรียก `onStatus` เฉพาะตอนค่าเปลี่ยน (กดเล่น/หยุด/กำลังโหลด) | ปุ่ม ▶/⏸, ปุ่มความเร็ว, ข้อความสถานะต้อง re-render (เวลา/ตำแหน่งรถที่เปลี่ยน 60 ครั้ง/วินาที **ไม่ใช่** state — ใช้ ref) |
| `sortKey` | เรียงไทม์ไลน์แบบไหน | `TimelinePanel` | ผู้ใช้กดปุ่มเรียง | ลำดับการ์ดต้องเปลี่ยน (`visibleEvents` คำนวณด้วย `useMemo` ไม่เก็บเป็น state) |
| `driverFilter` | นักขับที่กรอง | `TimelinePanel` | ผู้ใช้เลือก dropdown | controlled select + กรองการ์ด |
| `typeFilter` | ประเภทเหตุการณ์ที่กรอง | `TimelinePanel` | ผู้ใช้เลือก dropdown / ปุ่ม "ล้างตัวกรอง" | controlled select + กรองการ์ด |
| `highlightedDriver` | นักขับที่คลิกชิปเพื่อไฮไลต์ | `TimelinePanel` | ผู้ใช้คลิกชื่อย่อนักขับ (คลิกซ้ำ = ยกเลิก) | การ์ดต้องสว่าง/จางตามค่านี้ |
| `filter` | ข้อความค้นชื่อ/เบอร์/ทีม | `DriversPage` | ผู้ใช้พิมพ์ในช่องค้น / กด "ล้างคำค้น" | controlled input + กรองการ์ดทันที (กลุ่มที่แสดงคำนวณด้วย `useMemo`) |
| `attempt` (TeamLogo) | ลำดับ URL โลโก้ที่กำลังลอง | `TeamLogo` | `onError` ของรูป → ลอง URL ถัดไป (ปีก่อนหน้า/slug อื่น) | ต้อง re-render เป็นรูปใหม่ หรือป้ายตัวย่อเมื่อไม่มีโลโก้ (ผลที่หาเจอจำไว้ใน HashTable ระดับ module ไม่ต้องลองซ้ำ) |
| `open` | ป๊อปอัปโปรไฟล์ย่อเปิดอยู่ไหม | `DriverHover` | ชี้เมาส์/focus ค้าง 0.3 วินาที = เปิด, เอาออก/blur = ปิด | ต้อง render/ไม่ render ป๊อปอัป |
| `pos` | ตำแหน่งป๊อปอัปบนจอ `{ top, left, above }` | `DriverHover` | คำนวณจากตำแหน่งชื่อตอนเปิด (ใกล้ขอบล่าง → แสดงด้านบน) | ใช้วางป๊อปอัปแบบ `position: fixed` ผ่าน portal |
| `info` | `{ status, driver }` ข้อมูลโปรไฟล์ที่โหลดมา | `DriverHover` | effect โหลดตารางคะแนนของปีนั้นเมื่อเปิด | แสดงสถานะ loading / missing / error / success ในป๊อปอัป |
| `failed` | รูปนักขับโหลดไม่สำเร็จหรือไม่ | `Headshot` (ใน `DriverCard`) | event `onError` ของ `<img>` | ต้อง re-render เป็นตัวอักษรย่อแทนรูปแตก |
| `sortKey`, `sortAsc` | คอลัมน์และทิศทางการเรียงตารางผล | `ResultsTable` | ผู้ใช้คลิกหัวคอลัมน์ | ลำดับแถวต้องเปลี่ยน |
| `state` `{status, data, error}` | ผลการโหลดข้อมูล 4 สถานะ | `useAsync` (ทุกหน้าที่โหลดข้อมูล) | effect ตั้งเป็น loading → success/empty/error | UI ต้องแสดงสถานะครบ loading/empty/error/success |
| `attempt` | ตัวนับการกด "ลองใหม่" | `useAsync` | ผู้ใช้กดปุ่มลองใหม่ (`reload()`) | อยู่ใน deps ของ effect → ยิงใหม่เฉพาะตอนผู้ใช้สั่ง |

**ค่าที่ตั้งใจไม่เก็บเป็น state** (คำนวณจาก state/props ได้ หรืออยู่ใน URL แล้ว): ปี/แท็บ/บัตรที่เปิดในหน้าตารางคะแนนและหน้านักแข่ง (`useSearchParams` ใน `useSeason`), กลุ่มทีมในหน้านักแข่ง (`useMemo`), `lookup` HashTable ของบัตร (`useMemo`), `shownYear`, `visibleEvents`, `driverEventIndex`,
`pathD` ของเส้นสนาม, `params`/`labels` ของ NavBar, นักขับที่ดูอยู่ (มาจาก URL) — ถ้าเก็บซ้ำต้องคอย sync ทุกครั้ง เสี่ยงข้อมูลไม่ตรงกัน

---

## 8.4 ตาราง useEffect

| component | effect ทำอะไร | dependency array | ทำงานตอนไหน |
|---|---|---|---|
| `useAsync` (ใช้ในทุกหน้า) | เรียก Express ผ่าน `loader` แล้ว setState ผลลัพธ์; cleanup = `controller.abort()` | `[...deps, attempt, enabled]` | ครั้งแรกที่ mount, เมื่อ deps เปลี่ยน (เช่น `sessionKey`), หรือผู้ใช้กดลองใหม่ — **ไม่** ทำงานทุก render |
| `App` | บันทึก `recent` ลง localStorage | `[recent]` | ทุกครั้งที่ดูเรซ/นักขับใหม่ |
| `SearchBox` | debounce: ตั้งเวลา 250ms แล้วค่อย `setDebounced`; cleanup = `clearTimeout` | `[query]` | ทุกครั้งที่พิมพ์ (แต่ตัวเก่าถูกยกเลิก จึงยิง API จริงแค่ตอนหยุดพิมพ์) |
| `SearchBox` | รีเซ็ตแถวที่ไฮไลต์เป็นแถวแรก | `[debounced]` | เมื่อคำค้นที่ใช้ยิงจริงเปลี่ยน |
| `RacePage` | ล้าง `currentEventId`/`playRequest` ของเรซเก่า | `[sessionKey]` | เปลี่ยนเรซ |
| `RacePage` | แจ้ง App ว่ากำลังดูเรซนี้ (`onVisitRace`) | `[race, onVisitRace]` | เมื่อโหลดหัวเรื่องเรซสำเร็จ |
| `DriverPage` | แจ้ง App ว่ากำลังดูนักขับนี้ (`onVisitDriver`) | `[race, story, onVisitRace, onVisitDriver]` | เมื่อโหลดข้อมูลนักขับ/เรซสำเร็จ |
| `TimelinePanel` | เลื่อนกล่องไทม์ไลน์ให้การ์ดปัจจุบันอยู่บนสุด | `[currentEventId]` | เมื่อเวลาบนแผนที่ข้ามไปเหตุการณ์ใหม่ (ไม่กี่วินาทีครั้ง ไม่ใช่ทุกเฟรม) |
| `TrackMap` | สร้าง `MapPlayer` แล้ว `load()` เรซ; cleanup = `player.destroy()` (หยุด animation + ยกเลิก request) | `[track, timeline, race, sessionKey]` | เมื่อเส้นสนามโหลดเสร็จ หรือเปลี่ยนเรซ |
| `TrackMap` | สั่ง `player.playEvent()` | `[playRequest]` | ผู้ใช้คลิกการ์ดเหตุการณ์ |
| `DriverHover` | โหลดตารางคะแนนของปีนั้นจาก `seasonCache` แล้วหานักแข่งด้วย HashTable; cleanup = ตั้ง `cancelled` กันผลมาช้าหลังปิด | `[open, year, driverNumber]` | ตอนป๊อปอัปเปิดเท่านั้น (ชื่อบนหน้าเป็นร้อยชื่อไม่ได้โหลดทุกชื่อตั้งแต่แรก) |
| `DriverHover` | ล้าง timer หน่วงเวลาตอน component หายไป | `[]` | unmount (เช่นเปลี่ยนหน้าระหว่างกำลังจะเปิด) |
| `ProfileModal` | ฟังปุ่ม Esc, ล็อกการเลื่อนหน้าด้านหลัง, ย้าย focus ไปปุ่มปิด; cleanup = เอา listener ออก + คืนการเลื่อนหน้า | `[onClose]` (มาจาก `useCallback` จึงไม่เปลี่ยนทุก render) | ตอนบัตรเปิด (mount) และคืนค่าตอนบัตรปิด (unmount) |

**กัน loop ไม่รู้จบ / เรียก API ซ้ำโดยไม่จำเป็นอย่างไร**

1. effect ใน `useAsync` setState (`status/data`) แต่ **ไม่ได้ใส่ state พวกนั้นใน deps** → setState ไม่ทำให้ effect วนกลับมา
2. `loader` เป็นฟังก์ชันที่สร้างใหม่ทุก render จึง **ตั้งใจไม่ใส่ใน deps** (ไม่งั้นยิง API ทุก render) — ใส่เฉพาะค่าที่มีผลจริง เช่น `sessionKey`
3. callback ที่ส่งจาก App (`onVisitRace`, `onVisitDriver`) ห่อด้วย `useCallback(..., [])` เป็นฟังก์ชันเดิมทุก render
   → effect ของหน้าลูกที่มีมันใน deps ไม่ทำงานซ้ำ (ถ้าไม่ห่อ: ลูก setState ใน App → App re-render → ฟังก์ชันใหม่ → effect ลูกทำงานอีก → วนลูป)
4. cleanup `abort()` — เปลี่ยนเรซระหว่างรอ คำตอบเก่าถูกยกเลิก ไม่ทับข้อมูลใหม่ (กัน race condition) และ `React.StrictMode`
   ที่ mount 2 รอบตอน dev ก็ไม่ทำให้ข้อมูลซ้อน
5. ป๊อปอัปโปรไฟล์: หน่วง 0.3 วินาทีก่อนเปิด (ลากเมาส์ผ่านไม่โหลด) และทุกจุดใช้ `seasonCache` ที่เก็บ **Promise ตัวเดียวต่อปี** ใน HashTable — ชี้ 20 ชื่อ = ยิง API ครั้งเดียว
6. ค้นหาใช้ debounce + ไม่ยิงถ้าพิมพ์ไม่ถึง 2 ตัวอักษร (`enabled: false`)
7. ชั้น cache: localStorage (เรซที่จบนานแล้วเก็บถาวร) → Express HashTable cache → CDN `Cache-Control`

---

## 3.4 Graph.js เชื่อมเมนูกับหน้า

ไฟล์ [frontend/src/Graph.js](frontend/src/Graph.js) — เขียน Graph เอง (adjacency list เก็บใน HashTable ของเราเอง) ไม่ใช่ไลบรารีวาดกราฟ

- **node = หน้า** 6 หน้า: `home` (/), `standings` (/standings), `drivers` (/drivers), `race` (/race/:sessionKey), `driver` (/race/:sessionKey/driver/:driverNumber), `about` (/about)
- **edge = เมนูที่พาไปหน้าอื่น** (directed) 20 เส้น:

| จากหน้า | เมนู (edge →) |
|---|---|
| home | → เรซที่ดูล่าสุด (race), → ตารางคะแนน (standings), → นักแข่ง (drivers), → เกี่ยวกับ (about) |
| standings | → ค้นหาเรซ (home), → เรซที่ดูล่าสุด (race), → นักแข่ง (drivers), → เกี่ยวกับ (about) |
| drivers | → ค้นหาเรซ (home), → ตารางคะแนน (standings), → เกี่ยวกับ (about) |
| race | → ค้นหาเรซอื่น (home), → เจาะนักขับ (driver), → ตารางคะแนน (standings), → นักแข่ง (drivers), → เกี่ยวกับ (about) |
| driver | → กลับไปดูทั้งเรซ (race), → ตารางคะแนน (standings), → ค้นหาเรซอื่น (home) |
| about | → หน้าแรก (home) |

**Graph ช่วยผู้ใช้อย่างไร** ([NavBar.jsx](frontend/src/components/NavBar.jsx))

1. **เมนูตามหน้าที่อยู่** — `graph.neighbors(currentId)` คืน edge ที่ออกจากหน้านั้น แต่ละหน้าจึงมีเมนูต่างกัน (ไม่มีรายการเมนูเขียนตายตัวในหน้า)
2. **breadcrumb** — `graph.shortestPath("home", currentId)` ด้วย **BFS** เช่น `หน้าแรก › ดูเรซ: Japanese GP 2024 › เจาะนักขับ: VER`
3. **เมนูที่ยังไปไม่ได้** — `graph.resolvePath()` เติม `:sessionKey` จาก URL หรือเรซที่ดูล่าสุด ถ้ายังไม่มีค่า เมนูจะจางพร้อมคำใบ้ ("เลือกนักขับจากตารางผลในหน้าเรซ")
4. หน้า About แสดงตาราง node/edge ที่ดึงจาก `siteGraph` จริง

**Big-O**: `neighbors` = O(deg(v)), `shortestPath` (BFS) = O(V + E) — เลือก adjacency list แทน matrix เพราะกราฟเบาบาง
(memory O(V+E) แทน O(V²)) และเลือก BFS แทน DFS เพราะทุก edge มีน้ำหนักเท่ากัน (1 คลิก) BFS รับประกันว่าเจอเส้นทางสั้นสุดก่อน

---

## Express มีหน้าที่จริงอะไรบ้าง

```
React (Vite :5173) ──/api/*──► Express (:3001) ──HTTPS──► api.openf1.org
                                  │
                                  ├─ proxy + rate limit   คิวกลาง 2 ระดับ 3 req/s, 30 req/min (OpenF1 จำกัดต่อ IP)
                                  ├─ cache                HashTable module-scope + Cache-Control ให้ CDN
                                  ├─ validate             year / sessionKey / driverNumber / ช่วงเวลา / คำค้น → 400
                                  ├─ ประมวลผล             รวม 5 endpoint เป็นไทม์ไลน์ (merge sort), Trie ค้นหา,
                                  │                       สรุปนักขับ, ตารางคะแนนทั้งปี, สร้างเส้นสนามจาก GPS
                                  └─ error middleware     OpenF1 ล่ม → 502 + ข้อความภาษาไทย, server ไม่ล่ม
```

| Route | หน้าที่ |
|---|---|
| `GET /api/health` | เช็คว่า backend ทำงาน (หน้า About ใช้) |
| `GET /api/years` | ปีที่เลือกได้ (2023 → ปีปัจจุบัน คำนวณจากวันที่) |
| `GET /api/races?year=` | เรซที่แข่งจบแล้วของปีนั้น (validate ปี) |
| `GET /api/search?q=` | **ใหม่** ค้นหาเรซข้ามทุกปีด้วย Trie |
| `GET /api/standings?year=` | **ใหม่** ตารางคะแนนนักขับ + ทีมทั้งฤดูกาล พร้อมผลรายสนาม (OpenF1 2 request ต่อปี) |
| `GET /api/race/:key/info` | **ใหม่** หัวเรื่องเรซ (ให้ deep link/รีเฟรชรู้ว่าเป็นเรซอะไร) |
| `GET /api/race/:key` | ไทม์ไลน์ + ผลจบ + พิทเร็วสุด + สรุป |
| `GET /api/race/:key/driver/:num` | **ใหม่** เรื่องราวนักขับ (ส่งเฉพาะ event ของคนนั้น) |
| `GET /api/track/:key` | **ปรับ** เส้นสนาม: ไฟล์ precompute ถ้ามี ไม่งั้นสร้างสด — ใน request เดียว |
| `GET /api/positions/:key?from=&to=` | พิกัดรถช่วง ≤ 60 วินาที (downsample, ยกเลิกได้, priority ต่ำถ้าเป็น prefetch) |

**API error ไม่ทำให้ระบบล่ม**: ทุก route ห่อด้วย `wrap()` ส่ง error ไปที่ error middleware ตัวเดียว ฝั่ง React ทุกการโหลดผ่าน
`useAsync` ที่จับ error แล้วแสดง `ErrorState` + ปุ่มลองใหม่ (ทดสอบแล้วโดยปิด backend ระหว่างใช้งาน — หน้าเว็บแสดง
"ติดต่อ backend ไม่ได้" ไม่พัง และใช้งานต่อได้เมื่อเปิด backend กลับมา)

---

## 4. DSA เชิงลึก

| DSA | อยู่ฝั่ง | ใช้ตรงไหน (ผลต่อ UX) | Big-O / เทียบก่อน-หลัง |
|---|---|---|---|
| **Graph + BFS** | React | สร้างเมนู + breadcrumb ([Graph.js](frontend/src/Graph.js)) | neighbors O(deg), BFS O(V+E) |
| **Trie** (ใหม่) | Express | ค้นหาเรซแบบ autocomplete ข้ามทุกปี ([Trie.js](backend/lib/Trie.js)) | ดูด้านล่าง |
| **Merge sort** | ทั้งสองฝั่ง | รวม 3 แหล่ง event เป็นไทม์ไลน์ (server), เรียงไทม์ไลน์/ตาราง/ผลค้นหาทันทีโดยไม่ยิง API (client) | O(n log n), merge 2 ชุดที่เรียงแล้ว O(n+m) |
| **HashTable** (chaining) | ทั้งสองฝั่ง | lookup นักขับ/meeting, cache, children ของ Trie node, ไฮไลต์นักขับ O(1) ต่อการ์ด | O(1) เฉลี่ย แทน `.find()` O(n) |
| **Queue** (circular buffer) | ทั้งสองฝั่ง | คิว rate limiter (server), บัฟเฟอร์ก้อนพิกัดรถ (client), คิวของ BFS | enqueue/dequeue O(1) แทน `shift()` O(n) |
| **Binary search** | React | หาเหตุการณ์ปัจจุบันตามเวลาแผนที่ทุกเฟรม, หาตำแหน่งรถระหว่าง 2 จุด | O(log n) ต่อเฟรม แทน O(n) |

### Trie — ทำไม และเทียบก่อน-หลัง

- **ก่อน (งานแรก)**: ผู้ใช้ต้องรู้ปีก่อน เลือกปี → เปิด dropdown เรซ ~24 รายการ → เลื่อนหา (3–4 การกระทำ ข้ามปีไม่ได้)
- **หลัง**: พิมพ์ "suz" → เห็น Suzuka ทุกปี → Enter (คำค้นหลายคำได้ เช่น `las 2024`, ไม่สนตัวพิมพ์/เครื่องหมาย `são` = `sao`)
- **ถ้าค้นแบบ linear** (วนทุกเรซแล้ว `.includes()`): O(N × L) ต่อการค้น 1 ครั้ง (N = เรซทุกปี ~100+, L = ความยาวข้อความ)
- **Trie**: เดินตามตัวอักษรของคำค้น O(P) แล้วอ่านรายการ id ที่ node นั้นเก็บไว้ล่วงหน้า O(k) — ไม่ขึ้นกับ N
  หลายคำ intersect ด้วย HashTable นับจำนวนคำที่ตรง เริ่มจากคำที่ผลน้อยสุด
- **แลกกับ**: memory O(จำนวนตัวอักษรรวมของทุกคำ) + เวลาสร้างครั้งเดียว ~ms (ดึงรายชื่อเรซ 4 ปีครั้งแรก ~3 วินาที แล้ว cache 10 นาที — วัดจริง: ค้นครั้งแรก 2959ms, ครั้งต่อไป 0ms)
- **ทำไมฝั่ง Express**: ต้องใช้รายชื่อเรซทุกปี (8 request ไป OpenF1) — ทำที่ server ครั้งเดียวแชร์ให้ผู้ใช้ทุกคน ดีกว่าให้ทุก browser โหลดเองแล้วสร้าง Trie เอง
- **ทำไมไม่ใช้วิธีอื่น**: sorted array + binary search หา prefix ได้ O(P log N) แต่ต้องทำต่อคำ และค้น "คำที่อยู่กลางชื่อ" (เช่น "vegas" ใน "Las Vegas Grand Prix") ต้องเก็บทุกคำแยกอยู่ดี — Trie ตอบโจทย์ prefix ตรงตัวกว่า

### ตารางคะแนน + บัตรนักขับ/ทีม — ประมวลผลที่ Express

[backend/lib/standings.js](backend/lib/standings.js)

- **ถ้ายิงทีละเรซ**: `/session_result` ~30 request ต่อฤดูกาล (2024 มี 24 Race + 6 Sprint) แต่ OpenF1 ให้ 30 req/นาที
  ผู้ใช้ต้องรอนาน และกินโควตาของผู้ใช้คนอื่นหมด
- **ที่ทำ**: OpenF1 กรองด้วยช่วง `session_key>=…&session_key<=…` ได้ → ดึงผล + นักขับทั้งปีใน **2 request** (~1.7 วินาที วัดจริงปี 2024)
  แล้วกรองเหลือ Race/Sprint ด้วย HashTable `sessionKey → เรซ` O(1) ต่อแถว
- **รวมคะแนน**: วนผลทุกแถวครั้งเดียว O(R) (R ≈ 2,000 แถว) สะสมลง HashTable `driverNumber → สถิติ` และ `teamName → สถิติ`
  ทีมของนักขับใช้ข้อมูล "ของเรซนั้น" (`sessionKey:driverNumber`) เพราะย้ายทีมกลางปีได้ (เช่น 2025 Tsunoda: Racing Bulls → Red Bull Racing)
  คะแนนจึงถูกนับให้ทีมที่ขับจริงในเรซนั้น
- **จัดอันดับ**: mergeSort ด้วย `compareStanding` — คะแนนมากก่อน ถ้าเท่ากันใช้ **countback แบบ F1** (ชนะมากกว่า → ที่ 2 มากกว่า → …)
  O(n log n · P) โดย n ≤ ~25, P ≤ 30 — merge sort เป็น stable sort ถ้าเท่ากันทุกอย่างลำดับไม่สลับไปมา
- **ตรวจผล**: ปี 2024 ได้ VER 437, NOR 374, LEC 356 และ McLaren 666, Ferrari 652, Red Bull 589 ตรงกับผลชิงแชมป์จริง
- **ฝั่ง React**: ส่งผลรายสนามของทุกคนมาครั้งเดียว (~260KB ก่อนบีบอัด) → เปิด/สลับบัตรนักขับ ↔ ทีม **ไม่ต้องยิง API เลย**
  หาคน/ทีมจาก URL ด้วย HashTable (`useMemo` สร้างครั้งเดียวต่อปี) O(1)

### หน้านักแข่ง, โลโก้ทีม, โปรไฟล์ย่อ — ฝั่ง React

- **หน้านักแข่ง** (`/drivers`) ใช้ข้อมูลชุดเดียวกับตารางคะแนน (ไม่มี endpoint ใหม่) จัดกลุ่มตามทีมเรียงตามอันดับทีม กรองด้วยชื่อ/เบอร์/ทีมใน memory ทันที
- **โลโก้ทีม**: OpenF1 ไม่มีโลโก้ จึงใช้ไฟล์จากคลังภาพของ formula1.com (`/teams/<ปี>/<slug>-logo.png`, ตรวจแล้วว่ามีปี 2023–2025)
  ลองตามลำดับ ปีที่ดูอยู่ → ปีก่อนหน้า → slug อื่นของทีม (เช่น Haas ใช้ `haas-f1-team` ปี 2023–24 แต่ `haas` ปี 2025) ถ้าไม่เจอเลย
  (ทีมใหม่ปี 2026 เช่น Cadillac) แสดงป้ายตัวย่อสีทีมแทน — ผลที่หาเจอ/ไม่เจอจำไว้ใน HashTable ระดับ module ไม่ลองซ้ำทุก render
  (โลโก้เป็นเครื่องหมายการค้าของแต่ละทีม ใช้เพื่อระบุทีมในงานการศึกษาเท่านั้น)
- **โปรไฟล์ย่อตอนชี้เมาส์** (`DriverHover`): ใช้ได้ทุกที่ที่มีชื่อนักแข่ง (ตารางคะแนน, หน้านักแข่ง, บัตรทีม, ตารางผลเรซ, พิทเร็วสุด, ชิปในไทม์ไลน์, หน้าเจาะนักขับ)
  ข้อมูลมาจาก `seasonCache` — เก็บ Promise ของตารางคะแนนต่อปีใน HashTable ทุกป๊อปอัปรอ Promise ตัวเดียวกัน (ชี้ชื่อแรก = โหลด 1 ครั้ง, ชื่อต่อไป O(1))
  ป๊อปอัป render ผ่าน `createPortal` ไปที่ `<body>` แบบ `position: fixed` จึงไม่ถูกตัดขอบเมื่อชื่ออยู่ในตาราง/บัตรที่เลื่อนได้

### Driver story — ประมวลผลที่ Express

[backend/lib/driverStory.js](backend/lib/driverStory.js) วนไทม์ไลน์ครั้งเดียว O(E) นับแซง/โดนแซง, HashTable นับคู่ปรับ,
หาอันดับพิทจากลิสต์ที่ mergeSort ไว้แล้ว O(P) — ส่งเฉพาะ event ของนักขับคนนั้น (~10–60 รายการ) แทนทั้งไทม์ไลน์ (~300–700)

---

## 2.3 flow หลักสั้นลงอย่างไร

| งาน | งานแรก | งานนี้ |
|---|---|---|
| ดูเรซที่รู้ชื่อสนาม | เลือกปี → เปิด dropdown → เลื่อนหา → เลือก (4) | พิมพ์ 3 ตัว → Enter (2) |
| กลับมาดูเรซเดิม | เลือกปี → หาเรซใหม่ | การ์ด "ดูต่อจากครั้งก่อน" / เมนู "เรซที่ดูล่าสุด" (1) หรือเปิดลิงก์เดิม |
| ดูผลงานนักขับคนเดียว | เลือก dropdown นักขับ → ไล่อ่าน/นับเอง | คลิกชื่อในตารางผล (1) → เห็นสรุปทันที |
| ดูว่านักแข่งในเรซคือใคร อันดับเท่าไรในฤดูกาล | ไม่มี | ชี้เมาส์ที่ชื่อ (0) → โปรไฟล์ย่อ |
| ดูคะแนนทั้งฤดูกาลของนักขับ/ทีม | ไม่มี (ต้องเปิดทีละเรซ ~30 เรซ) | เมนู 🏆 ตารางคะแนน → คลิกชื่อ (2) → บัตรมีผลทุกสนาม |
| แชร์เรซให้เพื่อน | ทำไม่ได้ (URL เดียว) | คัดลอก URL |

## สถานะ loading / empty / error / success

ทุกจุดที่โหลดข้อมูลใช้ `useAsync` + `StatusViews` ชุดเดียวกัน: skeleton ระหว่างโหลด, empty state ที่บอกเหตุผลและสิ่งที่ทำต่อได้
(เช่น "ไม่มีเหตุการณ์ตามตัวกรองนี้" + ปุ่มล้างตัวกรอง), error state ที่แสดงข้อความจาก server + ปุ่มลองใหม่ (ซ่อนปุ่มถ้าเป็น 404),
และหน้า "ไม่พบเรซนี้" สำหรับลิงก์ผิด

## ข้อจำกัด / สิ่งที่จะทำต่อ

- OpenF1 จำกัด 30 req/นาที — เล่นแผนที่ความเร็ว x10 นาน ๆ อาจต้องรอโหลด (ตัวเล่นหยุดรอแทนการกระตุก)
- ปี 2023 OpenF1 ไม่มีข้อมูลการแซง หน้าเจาะนักขับจึงมีข้อมูลน้อยกว่า
- ดัชนีค้นหาสร้างใน memory ของ instance — บน serverless จะสร้างใหม่ทุกครั้งที่ instance เย็นลง
- ถัดไป: เทียบนักขับ 2 คนในหน้าเดียว, deploy frontend + backend บน Vercel
