// src/photo.js — รูปนักแข่งจาก formula1.com มีหลายขนาดใน path (".../image.png.transform/1col/image.png")
// OpenF1 ให้ขนาด 1col มา (~90px) ขยายแล้วเบลอ จึงสลับเป็นขนาดที่พอดีกับที่แสดง
//   2col ≈ 180px (การ์ด/โปรไฟล์ย่อ), 4col ≈ 360px (รูปใหญ่ เช่นผู้นำตารางคะแนน)
export function headshot(url, size = "2col") {
  return url ? url.replace(/\/\dcol\//, `/${size}/`) : url;
}
