// src/player/MapPlayer.js
// เครื่องเล่นตำแหน่งรถบนแผนที่ (ย้ายมาจาก public/app.js ของงานแรก แยกเป็น class ที่ไม่ผูกกับ DOM ทั้งหน้า)
//
// ทำไมไม่เก็บ "เวลาปัจจุบัน/ตำแหน่งรถ" เป็น React state:
//   ตอนเล่นต้องอัปเดตตำแหน่งรถ 20 คัน ~60 ครั้ง/วินาที ถ้า setState ทุกเฟรม React ต้อง re-render
//   component ทั้งต้นไม้ 60 ครั้ง/วินาที → กระตุก. จึงให้ class นี้เขียน SVG ตรงผ่าน ref (นอก render cycle)
//   แล้วแจ้ง React เฉพาะสิ่งที่เปลี่ยน "นาน ๆ ครั้ง" ผ่าน callback:
//     onStatus({ playing, statusText, speed })  — ตอนกดเล่น/หยุด/กำลังโหลด
//     onEventChange(eventId)                     — ตอนเวลาเดินข้ามไปเหตุการณ์ถัดไปในไทม์ไลน์ (ไม่กี่วินาทีครั้ง)
//     onTime(ms)                                 — เวลาปัจจุบัน ไม่เกิน 4 ครั้ง/วินาที (ให้ Race Leaderboard อัปเดตตาม)
//
// การทำงานเหมือนเครื่องเล่นวิดีโอ: "เก็บข้อมูลล่วงหน้าก่อนแล้วค่อยวิ่ง"
//   - พิกัดรถถูกโหลดเป็นก้อน ๆ ละ CHUNK_MS ต่อท้ายคิว (Queue เขียนเอง) ไว้ล่วงหน้า
//   - ข้อมูลล่วงหน้าไม่พอ → หยุดนาฬิการอ (แสดง %) แทนที่เวลาเดินแต่รถค้าง
//   - ก้อนที่เล่นผ่านไปแล้ว dequeue ออกจากหัวคิว O(1) memory ไม่บวมแม้เล่นทั้งเรซ

import { HashTable } from "../dsa/HashTable.js";
import { Queue } from "../dsa/Queue.js";
import { api } from "../api.js";

const CHUNK_MS = 50000; // ต้อง ≤ 60 วินาที (ข้อจำกัดของ /api/positions)
const BACK_BUFFER_MS = 15000; // เก็บย้อนหลังไว้ ให้กด ⏪ 10s ได้ทันที
const PIT_WINDOW_PADDING_MS = 1500;
const TIME_EMIT_INTERVAL_MS = 250;
const SVG_NS = "http://www.w3.org/2000/svg";

const clockFormat = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
export const formatClock = (ms) => clockFormat.format(ms);

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const alignToChunk = (ms) => Math.floor(ms / CHUNK_MS) * CHUNK_MS;

function applyTrackTransform(t, p) {
  return { x: t.padding + (p.x - t.minX) * t.scale, y: t.padding + (p.y - t.minY) * t.scale };
}

/**
 * upperBound - index สุดท้ายที่ times[i] <= target ด้วย binary search (คืน -1 ถ้าไม่มี)
 * O(log n) — เรียกทุกเฟรมเพื่อหา "เหตุการณ์ปัจจุบัน" (ถ้าวนหาแบบ linear จะเป็น O(n) ทุกเฟรม)
 */
export function upperBound(times, target) {
  let lo = 0;
  let hi = times.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= target) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

/** parseChunk - parse วันที่เป็นตัวเลขครั้งเดียวตอนโหลด + แยกตามนักขับใน HashTable (หา O(1) ทุกเฟรม) */
function parseChunk(fromMs, toMs, positions) {
  const series = new HashTable(32);
  for (const key of Object.keys(positions)) {
    const samples = positions[key];
    const n = samples.length;
    if (n === 0) continue;
    const t = new Float64Array(n);
    const x = new Float64Array(n);
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      t[i] = Date.parse(samples[i].date);
      x[i] = samples[i].x;
      y[i] = samples[i].y;
    }
    series.set(Number(key), { t, x, y });
  }
  return { fromMs, toMs, series };
}

/** sampleAt - ตำแหน่งที่เวลา ms แบบ linear interpolation หาจุดครอบด้วย binary search O(log n) ต่อคัน */
function sampleAt(s, ms, nextSeries) {
  const n = s.t.length;
  if (ms <= s.t[0]) return { x: s.x[0], y: s.y[0] };
  if (ms >= s.t[n - 1]) {
    if (nextSeries && nextSeries.t[0] > s.t[n - 1]) {
      const r = Math.min(1, (ms - s.t[n - 1]) / (nextSeries.t[0] - s.t[n - 1]));
      return { x: s.x[n - 1] + (nextSeries.x[0] - s.x[n - 1]) * r, y: s.y[n - 1] + (nextSeries.y[0] - s.y[n - 1]) * r };
    }
    return { x: s.x[n - 1], y: s.y[n - 1] };
  }
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (s.t[mid] <= ms) lo = mid;
    else hi = mid;
  }
  const r = (ms - s.t[lo]) / (s.t[hi] - s.t[lo] || 1);
  return { x: s.x[lo] + (s.x[hi] - s.x[lo]) * r, y: s.y[lo] + (s.y[hi] - s.y[lo]) * r };
}

/** buildPitWindowIndex - HashTable: driverNumber -> ช่วงเวลาที่กำลังเข้าพิท (โชว์ป้าย PIT บนจุดรถ) */
function buildPitWindowIndex(events) {
  const index = new HashTable(16);
  for (const e of events) {
    if (e.type !== "pit" || e.pitDuration == null) continue;
    const startMs = Date.parse(e.date) - PIT_WINDOW_PADDING_MS;
    const endMs = startMs + e.pitDuration * 1000 + PIT_WINDOW_PADDING_MS * 2;
    for (const num of e.driverNumbers) {
      if (!index.has(num)) index.set(num, []);
      index.get(num).push({ startMs, endMs });
    }
  }
  return index;
}

export class MapPlayer {
  /**
   * @param {{ dotsGroup: SVGGElement, scrubber: HTMLInputElement, clockLabel: HTMLElement, bufferFill: HTMLElement }} dom
   * @param {{ onStatus: Function, onEventChange: Function, onTime?: Function }} callbacks
   */
  constructor(dom, { onStatus, onEventChange, onTime }) {
    this.dom = dom;
    this.onStatus = onStatus;
    this.onEventChange = onEventChange;
    this.onTime = onTime;
    this.lastTimeEmit = 0;
    this.focus = null; // HashTable ของนักขับที่ผู้ใช้เลือกจาก leaderboard (null = ไม่เลือก)
    this.sessionKey = null;
    this.track = null;
    this.events = [];
    this.eventTimes = [];
    this.pitWindows = null;
    this.dots = [];
    this.bounds = { min: 0, max: 1 };
    this.playing = false;
    this.waiting = false;
    this.speed = 1;
    this.currentMs = null;
    this.chunks = new Queue(8);
    this.bufferedUntilMs = null;
    this.bufferGen = 0; // เพิ่มทุกครั้งที่ล้างบัฟเฟอร์ ผลของ request รุ่นเก่าที่มาช้าจะถูกทิ้ง
    this.fetchingGen = null;
    this.abort = null;
    this.loadError = false;
    this.clip = null;
    this.rafHandle = null;
    this.lastFrameTime = null;
    this.lastClockSecond = null;
    this.lastEventId = null;
    this.lastStatusKey = "";
    this.destroyed = false;
  }

  /** load - เริ่มเรซใหม่: วาดจุดรถ ตั้งช่วงเวลา แล้วเลื่อนไปเหตุการณ์แรก (preload รอไว้) */
  load({ sessionKey, track, drivers, events, dateStart, dateEnd }) {
    this.pause();
    this.sessionKey = sessionKey;
    this.track = track;
    this.events = events;
    this.eventTimes = events.map((e) => Date.parse(e.date));
    this.pitWindows = buildPitWindowIndex(events);
    this.initDots(drivers);

    const startMs = Date.parse(dateStart);
    const endMs = Date.parse(dateEnd ?? dateStart);
    this.bounds = { min: startMs, max: endMs > startMs ? endMs : startMs + 3600 * 1000 };
    this.dom.scrubber.min = String(this.bounds.min);
    this.dom.scrubber.max = String(this.bounds.max);

    this.resetBuffer(null);
    this.seekTo(this.eventTimes.length > 0 ? this.eventTimes[0] : startMs);
  }

  destroy() {
    this.destroyed = true;
    this.pause();
    this.resetBuffer(null);
  }

  initDots(drivers) {
    const group = this.dom.dotsGroup;
    group.replaceChildren();
    this.dots = drivers.map((d) => {
      const g = document.createElementNS(SVG_NS, "g");
      g.setAttribute("class", "car-dot");
      g.style.opacity = "0";
      const circle = document.createElementNS(SVG_NS, "circle");
      circle.setAttribute("r", "7");
      circle.setAttribute("fill", `#${d.teamColour}`);
      const label = document.createElementNS(SVG_NS, "text");
      label.setAttribute("y", "-11");
      label.textContent = d.acronym;
      const badge = document.createElementNS(SVG_NS, "text");
      badge.setAttribute("class", "pit-badge");
      badge.setAttribute("y", "18");
      badge.setAttribute("opacity", "0");
      badge.textContent = "🔧 PIT";
      g.append(circle, label, badge);
      group.append(g);
      return { driverNumber: d.driverNumber, acronym: d.acronym, el: g, badge, lastTransform: null, lastOpacity: "0", lastBadge: "0" };
    });
  }

  // ---------- buffer ----------

  bufferAheadTargetMs() {
    return Math.max(100000, 25000 * this.speed);
  }

  startReadyMs() {
    return Math.max(30000, 10000 * this.speed);
  }

  resetBuffer(fromMs) {
    this.bufferGen++;
    this.abort?.abort();
    this.abort = null;
    this.fetchingGen = null;
    this.chunks.clear();
    this.bufferedUntilMs = fromMs == null ? null : alignToChunk(fromMs);
    this.loadError = false;
    this.updateBufferBar();
  }

  trimBackBuffer() {
    while (this.chunks.size > 1 && this.chunks.peek().toMs < this.currentMs - BACK_BUFFER_MS) this.chunks.dequeue();
  }

  /** fillBuffer - โหลดก้อนต่อท้ายคิวทีละ request (เคารพ rate limit) จนข้อมูลล่วงหน้าถึงเป้า */
  async fillBuffer() {
    const gen = this.bufferGen;
    if (this.destroyed || this.fetchingGen === gen || this.sessionKey == null || this.currentMs == null || this.bufferedUntilMs == null) return;
    this.fetchingGen = gen;
    const controller = new AbortController();
    this.abort = controller;

    try {
      while (gen === this.bufferGen) {
        const { max } = this.bounds;
        // ตอนหยุด โหลดแค่พอกดเล่นได้ทันที ตอนเล่นจริงค่อยเก็บล่วงหน้าเต็มที่ (ประหยัดโควตา OpenF1)
        const target = this.playing ? this.bufferAheadTargetMs() : this.startReadyMs();
        if (this.bufferedUntilMs >= max || this.bufferedUntilMs - this.currentMs >= target) break;

        const fromMs = this.bufferedUntilMs;
        const toMs = fromMs + CHUNK_MS;
        const prefetch = this.bufferedUntilMs - this.currentMs >= this.startReadyMs();
        const { positions } = await api.positions(this.sessionKey, fromMs, toMs, { signal: controller.signal, prefetch });
        if (gen !== this.bufferGen) return;

        this.chunks.enqueue(parseChunk(fromMs, toMs, positions));
        this.bufferedUntilMs = toMs;
        this.loadError = false;
        this.trimBackBuffer();
        this.updateBufferBar();
        if (!this.playing) this.renderFrame();
      }
    } catch (err) {
      if (err.name === "AbortError" || gen !== this.bufferGen) return;
      console.error(err);
      this.loadError = true;
      this.emitStatus();
      // ลองใหม่เองอัตโนมัติ — เน็ตหลุดชั่วคราวไม่ควรทำให้ผู้ใช้ต้องกดเล่นใหม่
      setTimeout(() => {
        if (gen === this.bufferGen) this.fillBuffer();
      }, 2000);
    } finally {
      if (this.fetchingGen === gen) {
        this.fetchingGen = null;
        if (this.abort === controller) this.abort = null;
      }
    }
  }

  updateBufferBar() {
    const { min, max } = this.bounds;
    const front = this.chunks.peek();
    const fill = this.dom.bufferFill;
    if (!front || max <= min) {
      fill.style.width = "0%";
      return;
    }
    const from = clamp(front.fromMs, min, max);
    const to = clamp(this.bufferedUntilMs, min, max);
    fill.style.left = `${((from - min) / (max - min)) * 100}%`;
    fill.style.width = `${((to - from) / (max - min)) * 100}%`;
  }

  // ---------- rendering ----------

  findChunkIndex(ms) {
    for (let i = 0; i < this.chunks.size; i++) {
      const c = this.chunks.at(i);
      if (ms >= c.fromMs && ms < c.toMs) return i;
    }
    const last = this.chunks.peekLast();
    return last && ms === last.toMs ? this.chunks.size - 1 : -1;
  }

  isInPit(driverNumber, ms) {
    const windows = this.pitWindows?.get(driverNumber);
    return windows ? windows.some((w) => ms >= w.startMs && ms <= w.endMs) : false;
  }

  renderDots(ms) {
    if (!this.track) return;
    const idx = this.findChunkIndex(ms);
    if (idx < 0) return;
    const chunk = this.chunks.at(idx);
    const nextChunk = this.chunks.at(idx + 1);
    const highlight = this.clip?.highlight ?? this.focus;
    const inPit = [];

    for (const dot of this.dots) {
      const s = chunk.series.get(dot.driverNumber);
      let transform = dot.lastTransform;
      let opacity = "0";
      let badge = "0";
      if (s) {
        const { x, y } = applyTrackTransform(this.track.transform, sampleAt(s, ms, nextChunk?.series.get(dot.driverNumber)));
        transform = `translate(${x.toFixed(1)}, ${y.toFixed(1)})`;
        opacity = !highlight || highlight.has(dot.driverNumber) ? "1" : "0.25";
        badge = this.isInPit(dot.driverNumber, ms) ? "1" : "0";
        if (badge === "1") inPit.push(dot.acronym);
      }
      // เขียน DOM เฉพาะค่าที่เปลี่ยนจริง ลดงาน layout/paint ต่อเฟรม
      if (transform !== dot.lastTransform) {
        dot.el.setAttribute("transform", transform);
        dot.lastTransform = transform;
      }
      if (opacity !== dot.lastOpacity) {
        dot.el.style.opacity = opacity;
        dot.lastOpacity = opacity;
      }
      if (badge !== dot.lastBadge) {
        dot.badge.setAttribute("opacity", badge);
        dot.lastBadge = badge;
      }
    }
    this.renderPitLane(inPit);
  }

  /** พิทเลน: ว่าง = หดมืด, มีรถอยู่ = ขยายสว่าง + ป้ายบอกว่าใครอยู่ในพิท (เขียน DOM เฉพาะตอนรายชื่อเปลี่ยน) */
  renderPitLane(inPit) {
    const lane = this.dom.pitLane;
    if (!lane) return;
    const key = inPit.join(",");
    if (key === this.lastPitKey) return;
    this.lastPitKey = key;
    lane.classList.toggle("active", inPit.length > 0);
    if (this.dom.pitLabel) this.dom.pitLabel.textContent = inPit.length > 0 ? `PIT · ${inPit.join(" ")}` : "PIT";
  }

  /** อัปเดต scrubber + นาฬิกาเฉพาะตอนวินาทีเปลี่ยน (เขียนค่า <input range> แพง ไม่ต้องทำทุกเฟรม) */
  renderClock(ms) {
    const second = Math.floor(ms / 1000);
    if (second === this.lastClockSecond) return;
    this.dom.scrubber.value = String(Math.round(ms));
    this.dom.clockLabel.textContent = formatClock(ms);
    this.lastClockSecond = second;
  }

  /** แจ้ง React เฉพาะตอนเหตุการณ์ปัจจุบันเปลี่ยน (หาเหตุการณ์ด้วย binary search O(log n)) */
  syncEvent(ms) {
    const i = upperBound(this.eventTimes, ms);
    const id = this.events[Math.max(0, i)]?.id ?? null;
    if (id !== this.lastEventId) {
      this.lastEventId = id;
      this.onEventChange?.(id);
    }
  }

  /** ส่งเวลาให้ React ไม่เกิน 4 ครั้ง/วินาทีตอนเล่น (ทุกเฟรมจะทำให้ re-render 60 ครั้ง/วินาที) ตอนหยุด/กระโดดส่งทันที */
  emitTime(ms, force = false) {
    const now = performance.now();
    if (!force && this.playing && now - this.lastTimeEmit < TIME_EMIT_INTERVAL_MS) return;
    this.lastTimeEmit = now;
    this.onTime?.(ms);
  }

  renderFrame(forceTime = false) {
    const ms = this.currentMs;
    if (ms == null) return;
    this.renderDots(ms);
    this.renderClock(ms);
    this.syncEvent(ms);
    this.emitTime(ms, forceTime);
  }

  /** setFocus - เลือกนักขับจาก leaderboard: คันนั้นสว่าง คันอื่นจาง และยกจุดขึ้นมาอยู่บนสุด (null = ยกเลิก) */
  setFocus(driverNumber) {
    if (driverNumber == null) this.focus = null;
    else {
      this.focus = new HashTable(4);
      this.focus.set(driverNumber, true);
      const dot = this.dots.find((d) => d.driverNumber === driverNumber);
      if (dot) this.dom.dotsGroup.append(dot.el);
    }
    if (this.currentMs != null) this.renderDots(this.currentMs);
  }

  emitStatus() {
    let statusText = "";
    if (this.loadError) statusText = "โหลดตำแหน่งรถไม่สำเร็จ — กำลังลองใหม่";
    else if (this.playing && this.waiting) {
      const need = Math.min(this.startReadyMs(), this.bounds.max - this.currentMs) || 1;
      const ahead = Math.max(0, (this.bufferedUntilMs ?? this.currentMs) - this.currentMs);
      statusText = `⏳ กำลังโหลดข้อมูลล่วงหน้า ${Math.min(99, Math.floor((ahead / need) * 100))}%`;
    } else if (this.clip) statusText = "▶ กำลังเล่นเหตุการณ์ที่เลือก";
    const key = `${this.playing}|${this.speed}|${statusText}`;
    if (key === this.lastStatusKey) return; // ไม่เปลี่ยน ไม่ต้องให้ React re-render
    this.lastStatusKey = key;
    this.onStatus?.({ playing: this.playing, speed: this.speed, statusText });
  }

  // ---------- controls ----------

  seekTo(targetMs) {
    if (this.destroyed) return;
    const ms = clamp(targetMs, this.bounds.min, this.bounds.max);
    this.currentMs = ms;
    this.lastClockSecond = null;
    const front = this.chunks.peek();
    const inBuffer = front && ms >= front.fromMs && ms < this.bufferedUntilMs;
    if (!inBuffer) {
      this.resetBuffer(ms);
      if (this.playing) this.waiting = true;
    }
    this.fillBuffer();
    this.renderFrame(true);
    this.emitStatus();
  }

  startLoop() {
    this.stopLoop();
    this.lastFrameTime = performance.now();
    const tick = (now) => {
      if (!this.playing || this.destroyed) {
        this.rafHandle = null;
        return;
      }
      const dt = Math.min(now - this.lastFrameTime, 250); // กันเวลากระโดดตอนสลับแท็บกลับมา
      this.lastFrameTime = now;
      const { max } = this.bounds;
      const dataEnd = Math.min(this.bufferedUntilMs ?? this.currentMs, max);
      const ahead = dataEnd - this.currentMs;

      if (this.waiting) {
        if (ahead >= Math.min(this.startReadyMs(), max - this.currentMs)) this.waiting = false;
      } else if (ahead <= 0 && this.currentMs < max) {
        this.waiting = true;
      }
      if (!this.waiting) {
        const rate = this.clip ? 1 : this.speed;
        this.currentMs = Math.min(this.currentMs + dt * rate, dataEnd);
      }

      this.trimBackBuffer();
      this.fillBuffer();
      this.renderFrame();
      this.emitStatus();

      if ((this.clip && this.currentMs >= this.clip.endMs) || this.currentMs >= max) {
        this.pause();
        return;
      }
      this.rafHandle = requestAnimationFrame(tick);
    };
    this.rafHandle = requestAnimationFrame(tick);
  }

  stopLoop() {
    if (this.rafHandle != null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }

  play() {
    if (!this.track || this.currentMs == null) return;
    if (this.currentMs >= this.bounds.max) this.seekTo(this.bounds.min);
    const ahead = (this.bufferedUntilMs ?? this.currentMs) - this.currentMs;
    this.playing = true;
    this.waiting = ahead < Math.min(this.startReadyMs(), this.bounds.max - this.currentMs);
    this.fillBuffer();
    this.emitStatus();
    this.startLoop();
  }

  pause() {
    this.playing = false;
    this.waiting = false;
    this.clip = null;
    this.stopLoop();
    this.emitStatus();
  }

  toggle() {
    if (this.playing) this.pause();
    else {
      this.clip = null;
      this.play();
    }
  }

  skipBy(deltaMs) {
    if (this.currentMs == null) return;
    this.clip = null;
    this.seekTo(this.currentMs + deltaMs);
  }

  setSpeed(speed) {
    this.speed = speed;
    this.fillBuffer();
    this.emitStatus();
  }

  /** playEvent - เล่นช่วง ±5 วินาทีรอบเหตุการณ์ที่ความเร็วจริง นักขับที่เกี่ยวข้องสว่าง คนอื่นจาง */
  playEvent(event) {
    if (!this.track || this.currentMs == null) return;
    const centerMs = Date.parse(event.date);
    let highlight = null;
    if (event.driverNumbers.length > 0) {
      highlight = new HashTable(8);
      for (const n of event.driverNumbers) highlight.set(n, true);
    }
    this.playing = false;
    this.clip = { endMs: centerMs + 5000, highlight };
    this.seekTo(centerMs - 5000);
    this.play();
  }

  /** scrubTo - ลาก scrubber: หยุดเล่น อัปเดตนาฬิกาทันที แต่โหลดจริงหลังหยุดลาก (debounce ฝั่ง component) */
  previewScrub(ms) {
    if (this.playing) this.pause();
    this.clip = null;
    this.dom.clockLabel.textContent = formatClock(ms);
  }
}
