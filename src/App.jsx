import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import StudentCalendar from "./pages/StudentCalendar";
import StudentAbsence from "./pages/StudentAbsence";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import NotFound from "./pages/NotFound";
import AuthCallback from "./pages/AuthCallback";

import ProtectedRoute from "./components/ProtectedRoute";
import Pending from "./pages/Pending";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* 공개 */}
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/pending" element={<Pending />} />

      {/* 학생 (승인 + role=student 필요) */}
      <Route
        path="/student/calendar"
        element={
          <ProtectedRoute allowRole="student">
            <StudentCalendar />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/absence"
        element={
          <ProtectedRoute allowRole="student">
            <StudentAbsence />
          </ProtectedRoute>
        }
      />

      {/* 교사 (승인 + role=teacher 필요) */}
      <Route
        path="/teacher"
        element={
          <ProtectedRoute allowRole="teacher">
            <TeacherDashboard />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
