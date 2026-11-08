import { Link } from "react-router-dom";
import { EmptyState } from "../components/StatusViews.jsx";

export default function NotFoundPage() {
  return (
    <EmptyState title="ไม่พบหน้านี้" hint="ลิงก์อาจผิด หรือหน้าถูกย้ายไปแล้ว">
      <Link to="/">กลับหน้าแรก</Link>
    </EmptyState>
  );
}
