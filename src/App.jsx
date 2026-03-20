import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import StudentCalendar from "./pages/student/StudentCalendar";
import StudentAbsence from "./pages/student/StudentAbsence";
import StudentSettings from "./pages/student/StudentSettings";
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
import Pending from "./pages/Pending";
import StudentLayout from "./components/StudentLayout";
import TeacherLayout from "./components/TeacherLayout";

function StudentPage({ children }) {
  return (
    <ProtectedRoute allowRole="student">
      <StudentLayout>{children}</StudentLayout>
    </ProtectedRoute>
  );
}

function TeacherPage({ children }) {
  return (
    <ProtectedRoute allowRole="teacher">
      <TeacherLayout>{children}</TeacherLayout>
    </ProtectedRoute>
  );
}

const studentRoutes = [
  { path: "/student/calendar", element: <StudentCalendar /> },
  { path: "/student/absence", element: <StudentAbsence /> },
  { path: "/student/settings", element: <StudentSettings /> },
  { path: "/student/profile", element: <MyProfile /> },
  { path: "/student/profile/edit", element: <MyProfileEdit /> },
];

const teacherRoutes = [
  { path: "/teacher", element: <TeacherStudents /> },
  { path: "/teacher/profile", element: <MyProfile /> },
  { path: "/teacher/profile/edit", element: <MyProfileEdit /> },
  { path: "/teacher/students", element: <TeacherStudents /> },
  { path: "/teacher/teachers", element: <TeacherTeachers /> },
  { path: "/teacher/calendar/:studentId", element: <TeacherCalendar /> },
  { path: "/teacher/absences", element: <TeacherAbsences /> },
  { path: "/teacher/weeklyaudit", element: <TeacherWeeklyAudit /> },
];

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/pending" element={<Pending />} />

      {studentRoutes.map(({ path, element }) => (
        <Route
          key={path}
          path={path}
          element={<StudentPage>{element}</StudentPage>}
        />
      ))}

      {teacherRoutes.map(({ path, element }) => (
        <Route
          key={path}
          path={path}
          element={<TeacherPage>{element}</TeacherPage>}
        />
      ))}

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
