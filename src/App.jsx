import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import StudentCalendar from "./pages/student/StudentCalendar";
import StudentAbsence from "./pages/student/StudentAbsence";
import NotFound from "./pages/error/NotFound";
import AuthCallback from "./pages/AuthCallback";
import MyProfile from "./pages/MyProfile";
import MyProfileEdit from "./pages/MyProfileEdit";
import TeacherStudents from "./pages/teacher/TeacherStudents";
import TeacherCalendar from "./pages/teacher/TeacherCalendar";
import TeacherAbsences from "./pages/teacher/TeacherAbsence";
import TeacherTeachers from "./pages/teacher/TeacherTeachers";
import TeacherWeeklyAudit from "./pages/teacher/TeacherWeeklyAudit";

import ProtectedRoute from "./components/ProtectedRoute";
import Pending from "./pages/student/Pending";
import StudentLayout from "./components/StudentLayout";
import TeacherLayout from "./components/TeacherLayout";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* 공개 */}
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/pending" element={<Pending />} />

      {/* 학생 */}
      <Route
        path="/student/calendar"
        element={
          <ProtectedRoute allowRole="student">
            <StudentLayout>
              <StudentCalendar />
            </StudentLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/absence"
        element={
          <ProtectedRoute allowRole="student">
            <StudentLayout>
              <StudentAbsence />
            </StudentLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/profile"
        element={
          <ProtectedRoute allowRole="student">
            <StudentLayout>
              <MyProfile />
            </StudentLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/profile/edit"
        element={
          <ProtectedRoute allowRole="student">
            <StudentLayout>
              <MyProfileEdit />
            </StudentLayout>
          </ProtectedRoute>
        }
      />

      {/* 교사 */}
      <Route
        path="/teacher"
        element={
          <ProtectedRoute allowRole="teacher">
            <TeacherLayout>
              <TeacherStudents />
            </TeacherLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/profile"
        element={
          <ProtectedRoute allowRole="teacher">
            <TeacherLayout>
              <MyProfile />
            </TeacherLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/profile/edit"
        element={
          <ProtectedRoute allowRole="teacher">
            <TeacherLayout>
              <MyProfileEdit />
            </TeacherLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/students"
        element={
          <ProtectedRoute allowRole="teacher">
            <TeacherLayout>
              <TeacherStudents />
            </TeacherLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/teacher/teachers"
        element={
          <ProtectedRoute allowRole="teacher">
            <TeacherLayout>
              <TeacherTeachers />
            </TeacherLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/teacher/calendar/:studentId"
        element={
          <ProtectedRoute allowRole="teacher">
            <TeacherLayout>
              <TeacherCalendar />
            </TeacherLayout>
          </ProtectedRoute>
        }
      />

       <Route
        path="/teacher/absences"
        element={
          <ProtectedRoute allowRole="teacher">
            <TeacherLayout>
              <TeacherAbsences />
            </TeacherLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/teacher/weeklyaudit"
        element={
          <ProtectedRoute allowRole="teacher">
            <TeacherLayout>
              <TeacherWeeklyAudit />
            </TeacherLayout>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
