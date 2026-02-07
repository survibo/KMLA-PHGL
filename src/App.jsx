import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import StudentCalendar from "./pages/StudentCalendar";
import StudentAbsence from "./pages/StudentAbsence";
import TeacherDashboard from "./pages/TeacherDashboard";
import NotFound from "./pages/NotFound";
import AuthCallback from "./pages/AuthCallback";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      <Route path="/login" element={<Login />} />

      <Route path="/student/calendar" element={<StudentCalendar />} />
      <Route path="/student/absence" element={<StudentAbsence />} />

      <Route path="/teacher" element={<TeacherDashboard />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
