import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
  const [sortKey, setSortKey] = useState(SORTS.APPROVED);
  const [asc, setAsc] = useState(true);

  const [updatingId, setUpdatingId] = useState(null);

  // ✅ 전체 승인 진행 상태
  const [bulkApproving, setBulkApproving] = useState(false);

  // ✅ teacher 권한 부여 모달
  const [grantTarget, setGrantTarget] = useState(null); // profiles row
  const [grantingId, setGrantingId] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      // ✅ role 조건 제거(teacher/기타가 있어도 화면에서는 student만 보여주면 됨)
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, name, grade, class_no, student_no, approved, role, is_hidden"
        );

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

  // ✅ 화면에 보여줄 "학생"만 (DB에는 teacher도 있을 수 있으니 여기서 필터)
  const filtered = useMemo(() => {
    let list = students.filter(
      (s) => (s.role ?? "student") === "student" && !s.is_hidden
    );

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

  // ✅ 현재 필터 결과 중 "미승인"만
  const pendingInFiltered = useMemo(() => {
    return filtered.filter((s) => !s.approved);
  }, [filtered]);

  // ✅ 캘린더 뷰어 order 쿼리 결정
  const calendarOrder = useMemo(() => {
    if (sortKey === SORTS.CLASS_NO) return "class";
    return "student_no";
  }, [sortKey]);

  const hideStudent = async (student) => {
    const ok = window.confirm(
      `숨길 시 대기자 명단에서 ${
        student.name ?? "학생"
      } 이(가) 영구적으로 사라집니다.\n진행하시겠습니까?`
    );
    if (!ok) return;

    try {
      setUpdatingId(student.id);

      const { error } = await supabase
        .from("profiles")
        .update({ is_hidden: true })
        .eq("id", student.id);

      if (error) throw error;

      // 로컬 상태 업데이트 (목록에서 즉시 제거됨)
      setStudents((prev) =>
        prev.map((s) => (s.id === student.id ? { ...s, is_hidden: true } : s))
      );
    } catch (err) {
      window.alert(`숨기기 실패: ${err?.message ?? String(err)}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleApproved = async (student) => {
    if (student.approved) {
      const ok = window.confirm(
        `${
          student.name ?? "학생"
        }의 승인을 취소할까요?\n취소하면 학생은 /pending 상태로 돌아갑니다.`
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

  // ✅ 전체 승인(필터된 목록 기준, 미승인만)
  const approveAllFiltered = async () => {
    if (pendingInFiltered.length === 0) return;

    const ok = window.confirm(
      `현재 목록에서 대기 중인 ${pendingInFiltered.length}명을 모두 승인할까요?\n(숨긴 학생은 승인하지 않습니다)`
    );
    if (!ok) return;

    const ids = pendingInFiltered.map((s) => s.id);

    try {
      setBulkApproving(true);

      const { data, error } = await supabase
        .from("profiles")
        .update({ approved: true })
        .in("id", ids)
        .eq("approved", false)
        .eq("is_hidden", false)
        .select("id, name, grade, class_no, student_no, approved, role");

      if (error) throw error;

      const updated = data ?? [];
      const updatedMap = new Map(updated.map((s) => [s.id, s]));

      setStudents((prev) => prev.map((s) => updatedMap.get(s.id) ?? s));
    } catch (err) {
      window.alert(`전체 승인 실패: ${err?.message ?? String(err)}`);
    } finally {
      setBulkApproving(false);
    }
  };

  // =========================
  // ✅ 선생님 권한 부여 (role=teacher, approved=true)
  // =========================
  const openGrantModal = (student) => setGrantTarget(student);

  const closeGrantModal = () => {
    if (grantingId) return; // 처리중엔 닫기 막음
    setGrantTarget(null);
  };

  const grantTeacherRole = async () => {
    if (!grantTarget) return;

    const s = grantTarget;

    // ✅ 모달(1차) + confirm(2차)
    const ok = window.confirm(
      `진짜로 "${
        s.name ?? "사용자"
      }"에게 선생님 권한을 부여할까요?\n(role=teacher, approved=true)`
    );
    if (!ok) return;

    try {
      setGrantingId(s.id);

      const { data, error } = await supabase
        .from("profiles")
        .update({ role: "teacher", approved: true })
        .eq("id", s.id)
        .select("id, name, grade, class_no, student_no, approved, role")
        .single();

      if (error) throw error;

      // 로컬 업데이트
      setStudents((prev) => prev.map((p) => (p.id === s.id ? data : p)));

      // student 목록 화면이므로, 승격되면 자동으로 목록에서 사라짐(role 필터 때문에)
      setGrantTarget(null);
      window.alert(`완료: ${data.name ?? "사용자"} → 선생님 권한 부여됨`);
    } catch (err) {
      window.alert(`선생님 권한 부여 실패: ${err?.message ?? String(err)}`);
    } finally {
      setGrantingId(null);
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "flex-start",
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>학생 관리</div>
            <div
              style={{ marginTop: 4, fontSize: 13, color: "var(--text-muted)" }}
            >
              학생 승인 상태를 조회/변경합니다. (이름 클릭 → 캘린더)
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              alignItems: "flex-end",
            }}
          >
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              총 <b style={{ color: "var(--text-1)" }}>{filtered.length}</b>명 /
              전체 <b style={{ color: "var(--text-1)" }}>{students.length}</b>명
            </div>

            <button
              type="button"
              className="c-ctl c-btn"
              onClick={approveAllFiltered}
              disabled={
                bulkApproving ||
                pendingInFiltered.length === 0 ||
                updatingId != null ||
                grantingId != null
              }
              title="현재 목록에서 대기 중인 학생을 모두 승인"
              style={{
                fontWeight: 900,
                opacity:
                  bulkApproving ||
                  pendingInFiltered.length === 0 ||
                  updatingId != null ||
                  grantingId != null
                    ? 0.6
                    : 1,
              }}
            >
              {bulkApproving
                ? "전체 승인 중..."
                : `전체 승인 (${pendingInFiltered.length}명)`}
            </button>
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
              <button
                type="button"
                className="c-ctl c-btn"
                onClick={() => setAsc((v) => !v)}
              >
                {asc ? "오름차순 ↑" : "내림차순 ↓"}
              </button>
            </div>
          </div>

          <div className="f-hint">
            * 승인 취소는 확인창이 뜹니다. 승인 처리(대기 → 승인)는 즉시
            반영됩니다.
            <br />* 전체 승인은 현재 목록(검색/정렬 반영)에서 <b>
              대기 중
            </b>{" "}
            학생만 승인합니다.
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="u-panel" style={{ overflowX: "auto" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}
        >
          <thead>
            <tr style={{ background: "var(--bg-2)" }}>
              <Th>이름</Th>
              <Th>기수</Th>
              <Th>반</Th>
              <Th>번호</Th>
              <Th>승인</Th>
              <Th>권한</Th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((s) => {
              const busy =
                updatingId === s.id || bulkApproving || grantingId != null;

              const statusText = s.approved ? "승인됨" : "대기";
              const statusColor = s.approved
                ? "var(--text-1)"
                : "var(--text-muted)";
              const actionText = s.approved ? "취소" : "승인";

              const calTo = `/teacher/calendar/${s.id}?order=${calendarOrder}`;

              return (
                <tr
                  key={s.id}
                  style={{
                    borderTop: `1px solid var(--border-subtle)`,
                    background: "var(--bg-1)",
                  }}
                >
                  {/* ✅ 이름을 링크로 */}
                  <Td strong>
                    <Link
                      to={calTo}
                      className="c-ctl c-btn"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        minHeight: 36,
                        padding: "6px 10px",
                        fontWeight: 900,
                        background: "var(--bg-1)",
                        borderColor: "var(--border-subtle)",
                      }}
                      title="캘린더 보기"
                    >
                      {s.name ?? "-"}
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--text-muted)",
                          fontWeight: 900,
                        }}
                      >
                        보기 →
                      </span>
                    </Link>
                  </Td>

                  <Td>{s.grade ?? "-"}</Td>
                  <Td>{s.class_no ?? "-"}</Td>
                  <Td>{s.student_no ?? "-"}</Td>

                  {/* 승인 */}
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
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: statusColor,
                        }}
                      >
                        {statusText}
                      </span>

                      <button
                        type="button"
                        className={`c-ctl c-btn ${
                          s.approved ? "c-btn--danger" : ""
                        }`}
                        disabled={busy}
                        onClick={() => toggleApproved(s)}
                        title={s.approved ? "승인 취소" : "승인 처리"}
                        style={{
                          fontWeight: 900,
                          opacity: busy ? 0.6 : 1,
                        }}
                      >
                        {updatingId === s.id ? "처리중..." : actionText}
                      </button>
                    </div>
                  </Td>

                  {/* 권한(선생님 권한 주기 버튼) */}
                  <Td>
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                      }}
                    >

                      <button
                        type="button"
                        className="c-ctl c-btn"
                        disabled={busy}
                        onClick={() => openGrantModal(s)}
                        title="선생님 권한 부여"
                        style={{
                          fontWeight: 900,
                          opacity: busy ? 0.6 : 1,

                          // ✅ CSS 파일 안 건드리고 '악센트' 느낌만 inline로 줌
                          borderColor: "var(--accent-danger)",
                          color: "var(--accent-danger)",
                          background: "var(--bg-2)",
                        }}
                      >
                        선생님 권한 주기
                      </button>

                      {!s.approved && (
                        <button
                          type="button"
                          className="c-ctl c-btn"
                          disabled={busy}
                          onClick={() => hideStudent(s)}
                          style={{
                            fontWeight: 900,
                            opacity: busy ? 0.6 : 1,
                            fontSize: 12,
                          }}
                        >
                          숨기기
                        </button>
                      )}
                    </div>
                  </Td>
                </tr>
              );
            })}

            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    padding: 18,
                    textAlign: "center",
                    color: "var(--text-muted)",
                  }}
                >
                  검색 결과가 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* ✅ Modal (CSS는 이미 있음: m-overlay/m-backdrop/m-box/...) */}
      {grantTarget ? (
        <div className="m-overlay" role="dialog" aria-modal="true">
          <button
            className="m-backdrop"
            onClick={closeGrantModal}
            aria-label="닫기"
          />

          <div className="m-box">
            <div className="m-header">
              <div className="m-title">선생님 권한 부여</div>

              <button
                type="button"
                className="c-ctl c-btn"
                onClick={closeGrantModal}
                disabled={grantingId != null}
              >
                닫기
              </button>
            </div>

            <div className="m-body">
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-2)",
                  fontWeight: 800,
                }}
              >
                아래 사용자에게 선생님 권한을 부여할까요?
              </div>

              <div
                style={{
                  marginTop: 10,
                  padding: 12,
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 10,
                }}
              >
                <div style={{ fontWeight: 900 }}>{grantTarget.name ?? "-"}</div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    color: "var(--text-muted)",
                    fontWeight: 800,
                  }}
                >
                  id: {grantTarget.id}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    color: "var(--text-muted)",
                    fontWeight: 800,
                  }}
                >
                  변경 내용: role = teacher, approved = true
                </div>
              </div>

              <div className="u-alert u-alert--error" style={{ marginTop: 12 }}>
                주의: 선생님 권한은 전체 학생 조회/승인/결석 처리 권한을
                포함합니다.
              </div>
            </div>

            <div className="m-footer">
              <button
                type="button"
                className="c-ctl c-btn"
                onClick={closeGrantModal}
                disabled={grantingId != null}
              >
                취소
              </button>

              <button
                type="button"
                className="c-ctl c-btn"
                onClick={grantTeacherRole}
                disabled={grantingId != null}
                style={{
                  fontWeight: 900,

                  // ✅ 악센트 inline
                  borderColor: "var(--border-focus)",
                  background: "var(--bg-2)",
                }}
              >
                {grantingId ? "부여 중..." : "확인하고 부여"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
