import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

const SORTS = {
  DATE: "date",
  STATUS: "status",
  CLASS_STUDENT: "class_student",
  CREATED: "created_at",
};

const STATUS_LABEL = {
  pending: "대기",
  approved: "승인",
  rejected: "거절",
};

export default function TeacherAbsences() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [rows, setRows] = useState([]); // {absence + student}
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [sortKey, setSortKey] = useState(SORTS.DATE);
  const [asc, setAsc] = useState(false);

  const [updatingId, setUpdatingId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");

    const { data: absences, error: aErr } = await supabase
      .from("absences")
      .select("id, student_id, date, reason, status, created_at")
      .order("created_at", { ascending: false });

    if (aErr) {
      setError(aErr.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const list = absences ?? [];
    const ids = Array.from(
      new Set(list.map((a) => a.student_id).filter(Boolean))
    );

    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("id, name, grade, class_no, student_no")
      .in("id", ids);

    if (pErr) {
      setError(pErr.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const map = new Map((profiles ?? []).map((p) => [p.id, p]));

    setRows(
      list.map((a) => ({
        ...a,
        student: map.get(a.student_id) ?? null,
      }))
    );

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatusForAbsence(absenceId, nextStatus) {
    try {
      setUpdatingId(absenceId);

      // ✅ status만 업데이트 (다른 컬럼 포함 금지)
      const { error } = await supabase
        .from("absences")
        .update({ status: nextStatus })
        .eq("id", absenceId);

      if (error) throw error;

      // 로컬 즉시 반영
      setRows((prev) =>
        prev.map((r) => (r.id === absenceId ? { ...r, status: nextStatus } : r))
      );
    } catch (err) {
      window.alert(`상태 변경 실패: ${err?.message ?? String(err)}`);
    } finally {
      setUpdatingId(null);
    }
  }

  const filtered = useMemo(() => {
    let list = rows;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) =>
        (r.student?.name ?? "").toLowerCase().includes(q)
      );
    }

    if (status !== "all") {
      list = list.filter((r) => (r.status ?? "") === status);
    }

    if (fromDate) {
      list = list.filter((r) => (r.date ?? "") >= fromDate);
    }
    if (toDate) {
      list = list.filter((r) => (r.date ?? "") <= toDate);
    }

    list = [...list].sort((a, b) => {
      if (sortKey === SORTS.DATE) {
        const va = a.date ?? "";
        const vb = b.date ?? "";
        return asc ? va.localeCompare(vb) : vb.localeCompare(va);
      }

      if (sortKey === SORTS.STATUS) {
        const va = a.status ?? "";
        const vb = b.status ?? "";
        return asc ? va.localeCompare(vb) : vb.localeCompare(va);
      }

      if (sortKey === SORTS.CREATED) {
        const va = a.created_at ?? "";
        const vb = b.created_at ?? "";
        return asc ? va.localeCompare(vb) : vb.localeCompare(va);
      }

      // 반순(학생 식별): class_no -> student_no
      const ca = a.student?.class_no ?? 9999;
      const cb = b.student?.class_no ?? 9999;
      if (ca !== cb) return asc ? ca - cb : cb - ca;

      const sa = a.student?.student_no ?? 9999;
      const sb = b.student?.student_no ?? 9999;
      if (sa !== sb) return asc ? sa - sb : sb - sa;

      const na = String(a.student?.name ?? "");
      const nb = String(b.student?.name ?? "");
      return asc ? na.localeCompare(nb) : nb.localeCompare(na);
    });

    return list;
  }, [rows, search, status, fromDate, toDate, sortKey, asc]);

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
      <div className="u-panel" style={{ padding: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>결석 확인</div>
            <div
              style={{ marginTop: 4, fontSize: 13, color: "var(--text-muted)" }}
            >
              학생 결석 제출을 조회/처리합니다.
            </div>
          </div>

          <button
            className="c-ctl c-btn"
            type="button"
            onClick={load}
            style={{ fontWeight: 900 }}
          >
            새로고침
          </button>
        </div>
      </div>

      <div className="u-panel" style={{ padding: 14 }}>
        <div className="l-section">
          <div className="f-field">
            <div className="f-label">이름 검색</div>
            <input
              className="c-ctl c-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="r-split">
            <div className="f-field">
              <div className="f-label">상태</div>
              <select
                className="c-ctl c-input"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="all">전체</option>
                <option value="pending">대기</option>
                <option value="approved">승인</option>
                <option value="rejected">거절</option>
              </select>
            </div>

            <div className="f-field">
              <div className="f-label">정렬</div>
              <select
                className="c-ctl c-input"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
              >
                <option value={SORTS.DATE}>날짜</option>
                <option value={SORTS.STATUS}>상태</option>
                <option value={SORTS.CLASS_STUDENT}>학생(반/번호)</option>
                <option value={SORTS.CREATED}>제출일(생성일)</option>
              </select>
            </div>
          </div>

          <div className="r-split">
            <div className="f-field">
              <div className="f-label">시작 날짜</div>
              <input
                className="c-ctl c-input"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="f-field">
              <div className="f-label">끝 날짜</div>
              <input
                className="c-ctl c-input"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>

          <div className="f-field">
            <div className="f-label">정렬 방향</div>
            <button
              className="c-ctl c-btn"
              type="button"
              onClick={() => setAsc((v) => !v)}
            >
              {asc ? "오름차순 ↑" : "내림차순 ↓"}
            </button>
          </div>

          <div className="f-hint">
            * 처리 버튼은 상태만 변경합니다. (되돌리기 = 대기로 변경)
          </div>
        </div>
      </div>

      <div className="u-panel" style={{ overflowX: "auto" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}
        >
          <thead>
            <tr style={{ background: "var(--bg-2)" }}>
              <Th>학생</Th>
              <Th>반</Th>
              <Th>번호</Th>
              <Th>날짜</Th>
              <Th>상태</Th>
              <Th>처리</Th>
              <Th style={{width:"280px"}}>사유</Th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((r) => {
              const busy = updatingId === r.id;

              return (
                <tr
                  key={r.id}
                  style={{ borderTop: `1px solid var(--border-subtle)` }}
                >
                  <Td strong>{r.student?.name ?? "(알 수 없음)"}</Td>
                  <Td>{r.student?.class_no ?? "-"}</Td>
                  <Td>{r.student?.student_no ?? "-"}</Td>
                  <Td>{r.date ?? "-"}</Td>

                  {/* ✅ 현재 상태를 명확히(내가 뭘 선택했는지) */}
                  <Td>
                    <span
                      className="c-ctl"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        minHeight: 34,
                        padding: "6px 10px",
                        fontSize: 13,
                        fontWeight: 900,
                        borderRadius: 999,
                        background: "var(--bg-2)",
                        borderColor: "var(--border-subtle)",
                        color:
                          r.status === "pending"
                            ? "var(--text-muted)"
                            : "var(--text-1)",
                        opacity: busy ? 0.6 : 1,
                      }}
                      title={`현재 상태: ${
                        STATUS_LABEL[r.status] ?? r.status ?? "-"
                      }`}
                    >
                      {STATUS_LABEL[r.status] ?? r.status ?? "-"}
                    </span>
                  </Td>

                  {/* ✅ 수락/거절 + 되돌리기/수정 */}
                  <Td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <ActionBtn
                        label="승인"
                        active={r.status === "approved"}
                        disabled={busy || r.status === "approved"}
                        onClick={() => setStatusForAbsence(r.id, "approved")}
                      />

                      <ActionBtn
                        label="거절"
                        danger
                        active={r.status === "rejected"}
                        disabled={busy || r.status === "rejected"}
                        onClick={() => setStatusForAbsence(r.id, "rejected")}
                      />

                      <ActionBtn
                        label="대기로"
                        muted
                        active={r.status === "pending"}
                        disabled={busy || r.status === "pending"}
                        onClick={() => setStatusForAbsence(r.id, "pending")}
                      />
                    </div>

                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 12,
                        color: "var(--text-muted)",
                      }}
                    >
                      {r.status === "pending"
                        ? "대기 → 승인/거절 선택"
                        : "수정 가능 (승인↔거절, 또는 대기로 되돌리기)"}
                    </div>
                  </Td>

                  <Td>
                    <div
                      style={{
                        width: 280, // ✅ 컬럼 폭 고정
                        whiteSpace: "pre-wrap", // 줄바꿈 허용
                        wordBreak: "break-word", // 긴 단어 대비
                        fontSize: 13,
                        color: "var(--text-2)",
                      }}
                    >
                      {r.reason ?? "-"}
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
                  결과가 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActionBtn({
  label,
  onClick,
  disabled,
  danger = false,
  muted = false,
  active = false,
}) {
  // ✅ active: "내가 선택한 것"을 버튼에서도 보이게
  const bg = active ? "var(--bg-2)" : "var(--bg-1)";
  const border = active ? "var(--border-focus)" : "var(--border-subtle)";

  const cls = ["c-ctl", "c-btn"];
  if (danger) cls.push("c-btn--danger");

  return (
    <button
      type="button"
      className={cls.join(" ")}
      onClick={onClick}
      disabled={disabled}
      style={{
        minHeight: 38,
        padding: "8px 10px",
        fontWeight: 900,
        background: muted ? "var(--bg-1)" : bg,
        borderColor: muted ? "var(--border-subtle)" : border,
        opacity: disabled ? 0.55 : 1,
      }}
      title={active ? `현재 선택: ${label}` : label}
    >
      {active ? `✓ ${label}` : label}
    </button>
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
        verticalAlign: "top",
      }}
    >
      {children}
    </td>
  );
}
