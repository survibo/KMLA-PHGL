import StudentHeader from "./StudentHeader";

export default function StudentLayout({ children }) {
  return (
    <>
      <StudentHeader />
      <main className="l-page">{children}</main>
    </>
  );
}
