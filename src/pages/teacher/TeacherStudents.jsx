import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

const SORTS = {
  STUDENT_NO: "student_no",
  CLASS_NO: "class_no",
  APPROVED: "approved",
};

export default function TeacherStudents() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState(SORTS.STUDENT_NO);
  const [asc, setAsc] = useState(true);

  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, grade, class_no, student_no, approved, role")
        .eq("role", "student");

      if (error) {
        setError(error.message);
        setStudents([]);
      } else {
        setStudents(data ?? []);
      }

      setLoading(false);
    };

    load();
  }, []);

  const filtered = useMemo(() => {
    let list = students;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((s) => (s.name ?? "").toLowerCase().includes(q));
    }

    list = [...list].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];

      if (sortKey === SORTS.APPROVED) {
        return asc ? Number(va) - Number(vb) : Number(vb) - Number(va);
      }

      if (va == null && vb == null) return 0;
      if (va == null) return asc ? 1 : -1;
      if (vb == null) return asc ? -1 : 1;

      return asc ? va - vb : vb - va;
    });

    return list;
  }, [students, search, sortKey, asc]);

  const toggleApproved = async (student) => {
    if (student.approved) {
      const ok = window.confirm(
        `${student.name ?? "학생"}의 승인을 취소할까요?\n취소하면 학생은 /pending 상태로 돌아갑니다.`
      );
      if (!ok) return;
    }

    const nextApproved = !student.approved;

    try {
      setUpdatingId(student.id);

      const { data, error } = await supabase
        .from("profiles")
        .update({ approved: nextApproved })
        .eq("id", student.id)
        .select("id, name, grade, class_no, student_no, approved, role")
        .single();

      if (error) throw error;

      setStudents((prev) => prev.map((s) => (s.id === student.id ? data : s)));
    } catch (err) {
      window.alert(`승인 상태 변경 실패: ${err?.message ?? String(err)}`);
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="l-page">
        <div className="u-panel" style={{ padding: 14 }}>
          불러오는 중…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="l-page">
        <div className="u-alert u-alert--error">오류: {error}</div>
      </div>
    );
  }

  return (
    <div className="l-page">
      {/* Header */}
      <div className="u-panel" style={{ padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>학생 관리</div>
            <div style={{ marginTop: 4, fontSize: 13, color: "var(--text-muted)" }}>
              학생 승인 상태를 조회/변경합니다.
            </div>
          </div>

          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            총 <b style={{ color: "var(--text-1)" }}>{filtered.length}</b>명 / 전체{" "}
            <b style={{ color: "var(--text-1)" }}>{students.length}</b>명
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="u-panel" style={{ padding: 14 }}>
        <div className="l-section">
          <div className="f-field">
            <div className="f-label">이름 검색</div>
            <input
              className="c-ctl c-input"
              placeholder="이름 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="r-split">
            <div className="f-field">
              <div className="f-label">정렬 기준</div>
              <select
                className="c-ctl c-input"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
              >
                <option value={SORTS.STUDENT_NO}>학번</option>
                <option value={SORTS.CLASS_NO}>반</option>
                <option value={SORTS.APPROVED}>승인 여부</option>
              </select>
            </div>

            <div className="f-field">
              <div className="f-label">정렬 방향</div>
              <button type="button" className="c-ctl c-btn" onClick={() => setAsc((v) => !v)}>
                {asc ? "오름차순 ↑" : "내림차순 ↓"}
              </button>
            </div>
          </div>

          <div className="f-hint">
            * 승인 취소는 확인창이 뜹니다. 승인 처리(대기 → 승인)는 즉시 반영됩니다.
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="u-panel" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
          <thead>
            <tr style={{ background: "var(--bg-2)" }}>
              <Th>이름</Th>
              <Th>기수</Th>
              <Th>반</Th>
              <Th>번호</Th>
              <Th>승인</Th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((s) => {
              const busy = updatingId === s.id;

              const statusText = s.approved ? "승인됨" : "대기";
              const statusColor = s.approved ? "var(--text-1)" : "var(--text-muted)";
              const action示 = s.approved ? "취소" : "승인";

              return (
                <tr
                  key={s.id}
                  style={{
                    borderTop: `1px solid var(--border-subtle)`,
                    background: "var(--bg-1)",
                  }}
                >
                  <Td strong>{s.name ?? "-"}</Td>
                  <Td>{s.grade ?? "-"}</Td>
                  <Td>{s.class_no ?? "-"}</Td>
                  <Td>{s.student_no ?? "-"}</Td>

                  <Td>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 800, color: statusColor }}>
                        {statusText}
                      </span>

                      <button
                        type="button"
                        className={`c-ctl c-btn ${s.approved ? "c-btn--danger" : ""}`}
                        disabled={busy}
                        onClick={() => toggleApproved(s)}
                        title={s.approved ? "승인 취소" : "승인 처리"}
                        style={{
                          fontWeight: 900,
                          opacity: busy ? 0.6 : 1,
                        }}
                      >
                        {busy ? "처리중..." : action示}
                      </button>
                    </div>
                  </Td>
                </tr>
              );
            })}

            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 18, textAlign: "center", color: "var(--text-muted)" }}>
                  검색 결과가 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }) {
  return (
    <th
      style={{
        textAlign: "left",
        fontSize: 13,
        fontWeight: 900,
        color: "var(--text-2)",
        padding: "12px 14px",
        borderBottom: "1px solid var(--border-subtle)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, strong = false }) {
  return (
    <td
      style={{
        padding: "12px 14px",
        fontSize: 13,
        fontWeight: strong ? 900 : 700,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}
