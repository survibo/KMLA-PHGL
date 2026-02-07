import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div style={{ padding: 24 }}>
      <h1>404</h1>
      <Link to="/login">로그인으로</Link>
    </div>
  );
}
