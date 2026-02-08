import TeacherHeader from "./TeacherHeader";

export default function TeacherLayout({ children }) {
  return (
    <>
      <TeacherHeader />
      <main className="l-page">{children}</main>
    </>
  );
}
