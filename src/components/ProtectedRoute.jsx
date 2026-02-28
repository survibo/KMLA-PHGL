import { Navigate } from "react-router-dom";
import { useMyProfile } from "../hooks/useMyProfile";

export default function ProtectedRoute({ allowRole, children }) {
  const { loading, session, profile } = useMyProfile();

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;

  // 로그인 안 됨
  if (!session) return <Navigate to="/login" replace />;

  // 프로필 없음(보통 DB 문제)
  if (!profile) return <Navigate to="/login" replace />;

  // 승인 대기
  if (!profile.approved) return <Navigate to="/pending" replace />;

  // 역할 불일치면 역할별 홈으로 튕김
  if (allowRole && profile.role !== allowRole) {
    return profile.role === "teacher" ? (
      <Navigate to="/teacher/students" replace />
    ) : (
      <Navigate to="/student/calendar" replace />
    );
  }

  return children;
}
