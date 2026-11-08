import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ตอน dev: React รันที่ :5173 ส่วน Express รันที่ :3001 — proxy /api ไปหา Express
// frontend จึงเรียก "/api/..." แบบ relative ได้เหมือนกันทั้งตอน dev และตอน production
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
