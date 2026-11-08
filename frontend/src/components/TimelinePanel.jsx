// src/components/TimelinePanel.jsx
// ไทม์ไลน์เหตุการณ์ + เครื่องมือเรียง/กรอง/ไฮไลต์
//
// state ที่อยู่ "ใน component นี้" (มีแค่ไทม์ไลน์ที่ใช้ ไม่ต้องยกขึ้นไป):
//   sortKey           : "time" | "lap" | "driver"   — เปลี่ยนเมื่อกดปุ่มเรียง
//   driverFilter      : หมายเลขนักขับที่กรอง ("" = ทุกคน)
//   typeFilter        : ประเภทเหตุการณ์ที่กรอง ("" = ทุกประเภท)
//   highlightedDriver : นักขับที่คลิกชิปเพื่อไฮไลต์ (null = ไม่ไฮไลต์)
// props จากแม่ (RacePage):
//   events, drivers, currentEventId (มาจาก TrackMap ผ่านแม่), onSelectEvent (callback กลับขึ้นไปให้แม่สั่ง TrackMap เล่น)
//
// ค่าที่ "คำนวณได้" ไม่เก็บเป็น state: visibleEvents (กรอง+เรียง) และ driverEventIndex คำนวณด้วย useMemo
// — ถ้าเก็บเป็น state ซ้ำ ต้องคอยอัปเดตให้ตรงกับ filter ทุกครั้ง เสี่ยงข้อมูลไม่ตรงกัน

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mergeSort } from "../dsa/sort.js";
import { HashTable } from "../dsa/HashTable.js";
import TimelineCard, { TYPE_LABEL } from "./TimelineCard.jsx";
import { EmptyState } from "./StatusViews.jsx";

const compareByTime = (a, b) => Date.parse(a.date) - Date.parse(b.date);
const SORT_COMPARATORS = {
  time: compareByTime,
  lap: (a, b) => (a.lap ?? -1) - (b.lap ?? -1) || compareByTime(a, b),
  driver: (a, b) => {
    const da = a.drivers[0]?.acronym ?? "";
    const db = b.drivers[0]?.acronym ?? "";
    return da !== db ? (da < db ? -1 : 1) : compareByTime(a, b);
  },
};
const SORT_LABEL = { time: "ตามเวลา", lap: "ตามรอบ", driver: "ตามนักขับ" };

/** driverNumber -> HashTable(eventId -> true): เช็คว่าการ์ดเกี่ยวกับนักขับที่ไฮไลต์ไหมแบบ O(1) ต่อการ์ด */
function buildDriverEventIndex(events) {
  const index = new HashTable(32);
  for (const e of events) {
    for (const num of e.driverNumbers) {
      if (!index.has(num)) index.set(num, new HashTable(64));
      index.get(num).set(e.id, true);
    }
  }
  return index;
}

export default function TimelinePanel({ events, drivers, currentEventId, onSelectEvent, year }) {
  const [sortKey, setSortKey] = useState("time");
  const [driverFilter, setDriverFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [highlightedDriver, setHighlightedDriver] = useState(null);
  const listRef = useRef(null); // กล่อง <ul> ของไทม์ไลน์ — ใช้สั่ง scroll (ref ไม่ทำให้ re-render)

  const driverEventIndex = useMemo(() => buildDriverEventIndex(events), [events]);

  // กรองแล้วเรียงด้วย mergeSort เอง (ใน memory ไม่ยิง API ใหม่) — คำนวณใหม่เฉพาะเมื่อ input เปลี่ยน
  const visibleEvents = useMemo(() => {
    let list = events;
    if (driverFilter) {
      const num = Number(driverFilter);
      list = list.filter((e) => e.driverNumbers.length === 0 || e.driverNumbers.includes(num));
    }
    if (typeFilter) list = list.filter((e) => e.type === typeFilter);
    return mergeSort(list, SORT_COMPARATORS[sortKey]);
  }, [events, sortKey, driverFilter, typeFilter]);

  // effect: เหตุการณ์ปัจจุบัน (ตามเวลาบนแผนที่) เปลี่ยน → เลื่อนเฉพาะกล่องไทม์ไลน์ให้การ์ดนั้นอยู่บนสุด
  // dependency = [currentEventId] เท่านั้น: ทำงานแค่ตอนเวลาข้ามไปเหตุการณ์ใหม่ (ไม่กี่วินาทีครั้ง) ไม่ใช่ทุกเฟรม
  // effect นี้ไม่ setState เลย จึงไม่มีทางวนลูป
  useEffect(() => {
    const list = listRef.current;
    const card = currentEventId && list ? list.querySelector(`[data-id="${CSS.escape(currentEventId)}"]`) : null;
    if (!card || !list) return;
    // .timeline-list ตั้ง position: relative ไว้ → offsetTop ของการ์ดเทียบกับกล่องนี้โดยตรง
    list.scrollTo({ top: card.offsetTop, behavior: "smooth" });
  }, [currentEventId]);

  // useCallback: ฟังก์ชันเดิมทุก render → TimelineCard (memo) ไม่ re-render ทั้งร้อยใบเพราะ prop ฟังก์ชันเปลี่ยน
  const toggleHighlight = useCallback((num) => setHighlightedDriver((cur) => (cur === num ? null : num)), []);

  const highlightSet = highlightedDriver != null ? driverEventIndex.get(highlightedDriver) : null;

  return (
    <div className="timeline-panel">
      <div className="panel-toolbar">
        <div className="sort-group" role="group" aria-label="เรียงไทม์ไลน์">
          <span className="toolbar-label">เรียง:</span>
          {Object.keys(SORT_LABEL).map((key) => (
            <button key={key} type="button" className={`sort-btn ${sortKey === key ? "active" : ""}`} onClick={() => setSortKey(key)}>
              {SORT_LABEL[key]}
            </button>
          ))}
        </div>
        <div className="filter-group">
          <label>
            นักขับ
            <select value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)}>
              <option value="">ทุกคน</option>
              {drivers.map((d) => (
                <option key={d.driverNumber} value={d.driverNumber}>
                  {d.acronym} — {d.teamName}
                </option>
              ))}
            </select>
          </label>
          <label>
            ประเภท
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">ทุกประเภท</option>
              {Object.entries(TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <p className="panel-hint">
        {visibleEvents.length} เหตุการณ์ · คลิกการ์ดเพื่อเล่นบนแผนที่ · คลิกชื่อย่อนักขับเพื่อไฮไลต์
        {highlightedDriver != null && (
          <button type="button" className="link-btn" onClick={() => setHighlightedDriver(null)}>
            ล้างไฮไลต์
          </button>
        )}
      </p>

      {visibleEvents.length === 0 ? (
        <EmptyState title="ไม่มีเหตุการณ์ตามตัวกรองนี้" hint="ลองเปลี่ยนนักขับหรือประเภท">
          <button
            type="button"
            onClick={() => {
              setDriverFilter("");
              setTypeFilter("");
            }}
          >
            ล้างตัวกรอง
          </button>
        </EmptyState>
      ) : (
        <ul className="timeline-list" ref={listRef}>
          {visibleEvents.map((e) => {
            const belongs = highlightSet ? e.driverNumbers.length === 0 || highlightSet.has(e.id) : false;
            return (
              <TimelineCard
                key={e.id}
                event={e}
                isCurrent={e.id === currentEventId}
                highlight={highlightSet != null && belongs}
                dim={highlightSet != null && !belongs}
                onSelect={onSelectEvent}
                onDriverClick={toggleHighlight}
                year={year}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
