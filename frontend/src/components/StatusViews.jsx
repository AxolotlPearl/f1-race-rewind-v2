// src/components/StatusViews.jsx
// ส่วนแสดงสถานะที่ทุกหน้าใช้ร่วมกัน: loading (skeleton) / empty / error
// แยกเป็น component เดียวเพื่อให้ข้อความและหน้าตาของแต่ละสถานะเหมือนกันทั้งเว็บ (ผู้ใช้เรียนรู้ครั้งเดียว)

/** Skeleton - กล่องเทาวิบวับแทนเนื้อหาระหว่างโหลด บอกผู้ใช้ว่า "กำลังมา" และกันหน้ากระโดดตอนข้อมูลมาถึง */
export function Skeleton({ variant = "card", count = 1 }) {
  return (
    <div className={`skeleton-group skeleton-${variant}`} aria-busy="true" aria-label="กำลังโหลด">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`skel skel-${variant}`} />
      ))}
    </div>
  );
}

/** EmptyState - โหลดสำเร็จแต่ไม่มีข้อมูล — บอกเหตุผลและสิ่งที่ทำต่อได้ (ไม่ปล่อยหน้าว่าง) */
export function EmptyState({ title, hint, children }) {
  return (
    <div className="empty-state" role="status">
      <p className="state-title">📭 {title}</p>
      {hint && <p className="state-hint">{hint}</p>}
      {children}
    </div>
  );
}

/** ErrorState - โหลดไม่สำเร็จ — แสดงข้อความจาก server (ภาษาคน) + ปุ่มลองใหม่ */
export function ErrorState({ error, onRetry, title = "โหลดข้อมูลไม่สำเร็จ" }) {
  const notFound = error?.status === 404;
  return (
    <div className="error-state" role="alert">
      <p className="state-title">{notFound ? "🔎" : "⚠️"} {title}</p>
      {error?.message && <p className="state-hint">{error.message}</p>}
      {onRetry && !notFound && (
        <button type="button" onClick={onRetry}>
          ลองใหม่
        </button>
      )}
    </div>
  );
}
