import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import StudentCalendar from "./pages/student/StudentCalendar";
import StudentAbsence from "./pages/student/StudentAbsence";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import NotFound from "./pages/NotFound";
import AuthCallback from "./pages/AuthCallback";
import MyProfile from "./pages/MyProfile";
import MyProfileEdit from "./pages/MyProfileEdit";

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
      <Route
        path="/student/profile"
        element={
          <ProtectedRoute role="student">
            <MyProfile />
          </ProtectedRoute>
        }
      />

      <Route
        path="/student/profile/edit"
        element={
          <ProtectedRoute role="student">
            <MyProfileEdit />
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
      <Route
        path="/teacher/profile"
        element={
          <ProtectedRoute role="teacher">
            <MyProfile />
          </ProtectedRoute>
        }
      />

      <Route
        path="/teacher/profile/edit"
        element={
          <ProtectedRoute role="teacher">
            <MyProfileEdit />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
