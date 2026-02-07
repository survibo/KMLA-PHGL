import { Link } from "react-router-dom";
import { useMyProfile } from "../hooks/useMyProfile";

export default function NotFound() {
  const { session, profile, loading } = useMyProfile();

  if (loading) return null;

  let homePath = "/login";
  if (session) {
    if (!profile?.approved) homePath = "/pending";
    else if (profile?.role === "teacher") homePath = "/teacher";
    else homePath = "/student/calendar";
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>404</h1>
      <p>존재하지 않는 페이지입니다.</p>
      <Link to={homePath}>메인으로</Link>
    </div>
  );
}
