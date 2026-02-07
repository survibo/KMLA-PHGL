import { useEffect, useState } from "react";
import { listPendingStudents, approveStudent } from "../../features/approvals.api";

export default function TeacherDashboard() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState(null);

  async function refresh() {
    setErr("");
    setLoading(true);
    try {
      const rows = await listPendingStudents();
      setPending(rows);
    } catch (e) {
      setErr(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onApprove(id) {
    setErr("");
    setBusyId(id);
    try {
      await approveStudent(id);
      // 승인 성공하면 목록에서 제거 (refresh 없이도 가능하지만, 일단 안전하게 refresh)
      await refresh();
    } catch (e) {
      setErr(e.message ?? String(e));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;

  return (
    <div style={{ padding: 24 }}>
      <h1>Teacher Dashboard</h1>

      {err && <div style={{ color: "red", marginBottom: 12 }}>{err}</div>}

      <h2>승인 대기: {pending.length}명</h2>

      {pending.length === 0 ? (
        <div>승인 대기 학생이 없습니다.</div>
      ) : (
        <ul style={{ paddingLeft: 16 }}>
          {pending.map((p) => (
            <li key={p.id} style={{ marginBottom: 10 }}>
              <b>
                {p.grade ?? "?"}-{p.class_no ?? "?"} {p.student_no ?? "?"}{" "}
                {p.name ?? "(no name)"}
              </b>
              <button
                onClick={() => onApprove(p.id)}
                disabled={busyId === p.id}
                style={{ marginLeft: 12 }}
              >
                {busyId === p.id ? "승인 중..." : "승인"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
