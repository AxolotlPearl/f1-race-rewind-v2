// api/index.js — จุดเข้า Vercel Serverless Function: ใช้ Express app ตัวเดียวกับตอนรันในเครื่อง
// (server.js ไม่เรียก app.listen เมื่อรันบน Vercel)
export { default } from "../backend/server.js";
