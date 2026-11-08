// src/components/SearchBox.jsx
// ช่องค้นหาเรซแบบ autocomplete — พิมพ์ "suz", "monaco 2024", "sprint" แล้วเลือกได้ทันที (ค้นข้ามทุกปี)
// ฝั่ง Express ค้นด้วย Trie (backend/lib/Trie.js) ฝั่งนี้ทำแค่ debounce + แสดงผล + คีย์บอร์ด
//
// state:
//   query       : ข้อความที่พิมพ์ (controlled input)
//   debounced   : query ที่ "นิ่งแล้ว" 250ms — ใช้ยิง API จริง ไม่ยิงทุกการกดแป้น
//   activeIndex : แถวที่ไฮไลต์ด้วยลูกศรขึ้น/ลง
//   open        : เปิด/ปิด dropdown ผลลัพธ์
// props:
//   onPick(race) : callback ขึ้นไปหาแม่ (HomePage) เมื่อผู้ใช้เลือกเรซ — SearchBox ไม่ต้องรู้ว่าแม่จะพาไปไหน

import { useEffect, useId, useState } from "react";
import { api } from "../api.js";
import { useAsync } from "../hooks/useAsync.js";

const MIN_CHARS = 2;
const DEBOUNCE_MS = 250;

export default function SearchBox({ onPick }) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const listId = useId();

  // debounce: ตั้งเวลาใหม่ทุกครั้งที่ query เปลี่ยน — cleanup ยกเลิกตัวเก่า จึงยิงจริงแค่ตอนหยุดพิมพ์ 250ms
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  const enabled = debounced.length >= MIN_CHARS;
  const search = useAsync((signal) => api.search(debounced, signal), [debounced], {
    enabled,
    isEmpty: (d) => d.results.length === 0,
  });
  const results = search.status === "success" ? search.data.results : [];

  // ผลชุดใหม่มา → ไฮไลต์แถวแรกเสมอ (กด Enter ได้ทันที)
  useEffect(() => {
    setActiveIndex(0);
  }, [debounced]);

  function pick(race) {
    setOpen(false);
    setQuery("");
    onPick(race);
  }

  function handleKeyDown(e) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(results[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const typing = query.trim() !== debounced; // ยังพิมพ์อยู่ ยังไม่ได้ยิง
  const showPanel = open && query.trim().length > 0;

  return (
    <div className="search-box">
      <label htmlFor={`${listId}-input`} className="search-label">
        ค้นหาเรซ (ทุกฤดูกาล)
      </label>
      <input
        id={`${listId}-input`}
        type="search"
        className="search-input"
        placeholder="พิมพ์ชื่อสนาม ประเทศ หรือปี เช่น suzuka, monaco 2024, sprint"
        value={query}
        autoComplete="off"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
      />

      {showPanel && (
        <div className="search-panel" id={listId} role="listbox">
          {query.trim().length < MIN_CHARS && <p className="search-hint">พิมพ์อย่างน้อย {MIN_CHARS} ตัวอักษร</p>}
          {query.trim().length >= MIN_CHARS && (typing || search.status === "loading") && <p className="search-hint">⏳ กำลังค้นหา...</p>}
          {!typing && search.status === "empty" && (
            <p className="search-hint">ไม่พบเรซที่ตรงกับ “{debounced}” — ลองชื่อเมือง/ประเทศภาษาอังกฤษ เช่น “japan”</p>
          )}
          {!typing && search.status === "error" && <p className="search-hint error-text">⚠️ {search.error.message}</p>}
          {!typing &&
            results.map((r, i) => (
              <button
                type="button"
                key={r.sessionKey}
                role="option"
                aria-selected={i === activeIndex}
                className={`search-result ${i === activeIndex ? "active" : ""}`}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => e.preventDefault()} // กัน blur ปิด panel ก่อน click ทำงาน
                onClick={() => pick(r)}
              >
                <span className="result-title">
                  {r.meetingName} {r.sessionName === "Sprint" && <span className="sprint-tag">Sprint</span>}
                </span>
                <span className="result-meta">
                  {r.year} · {r.circuitShortName}, {r.countryName}
                </span>
              </button>
            ))}
          {!typing && search.status === "success" && search.data.total > results.length && (
            <p className="search-hint">แสดง {results.length} จาก {search.data.total} รายการ — พิมพ์เพิ่มเพื่อให้แคบลง</p>
          )}
        </div>
      )}
    </div>
  );
}
