import { Link } from "react-router-dom";

export default function Login() {
  return (
    <div style={{ padding: 24 }}>
      <h1>Login</h1>
      <div style={{ display: "flex", gap: 12 }}>
        <Link to="/student/calendar">학생 캘린더</Link>
        <Link to="/student/absence">결석 제출</Link>
        <Link to="/teacher">교사</Link>
      </div>
    </div>
  );
}
