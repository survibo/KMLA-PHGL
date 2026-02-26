import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

const SORTS = {
  DATE: "date",
  STATUS: "status",
  CREATED: "created_at",
};

const STATUS_LABEL = {
  pending: "대기",
  approved: "승인",
  rejected: "거절",
};

const STATUS_ORDER = {
  pending: 0, // 대기
  rejected: 1, // 거절
  approved: 2, // 승인
};
function formatRequestedAt(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

export default function TeacherAbsences() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [rows, setRows] = useState([]); // {absence + student + actor}
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // ✅ 최초 접속 시 "요청일(생성일)" 최신순 보장
  const [sortKey, setSortKey] = useState(SORTS.STATUS);
  const [asc, setAsc] = useState(true);

  const [updatingId, setUpdatingId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");

    const { data: absences, error: aErr } = await supabase
      .from("absences")
      .select(
        "id, student_id, date, reason, status, created_at, status_updated_by, status_updated_at"
      )
      .order("created_at", { ascending: false });

    if (aErr) {
      setError(aErr.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const list = absences ?? [];

    // 학생 + 마지막 처리자(teacher) 프로필을 같이 조회
    const studentIds = list.map((a) => a.student_id).filter(Boolean);
    const actorIds = list.map((a) => a.status_updated_by).filter(Boolean);

    const ids = Array.from(new Set([...studentIds, ...actorIds]));

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
        actor: a.status_updated_by
          ? map.get(a.status_updated_by) ?? null
          : null,
      }))
    );

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // ✅ 상태 변경 + 확인창(학생 이름 포함)
  async function setStatusForAbsence(absenceId, studentName, nextStatus) {
    const name = studentName ?? "해당 학생";

    const actionText =
      nextStatus === "approved"
        ? "승인"
        : nextStatus === "rejected"
        ? "거절"
        : "대기";

    const ok = window.confirm(
      `${name} 학생의 결석 처리를 "${actionText}"로 하시겠습니까?`
    );
    if (!ok) return;

    try {
      setUpdatingId(absenceId);

      const { error } = await supabase
        .from("absences")
        .update({ status: nextStatus })
        .eq("id", absenceId);

      if (error) throw error;

      await load();
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
        const va = STATUS_ORDER[a.status] ?? 9999;
        const vb = STATUS_ORDER[b.status] ?? 9999;
        return asc ? va - vb : vb - va;
      }

      if (sortKey === SORTS.CREATED) {
        const va = a.created_at ?? "";
        const vb = b.created_at ?? "";
        return asc ? va.localeCompare(vb) : vb.localeCompare(va);
      }

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

          <div className="f-hint">* 요청 삭제는 불가능합니다</div>
        </div>
      </div>

      <div className="u-panel" style={{ overflowX: "hidden", }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed",
          }}
        >
          <colgroup>
            <col style={{ width: "14%" }} /> {/* 학생 */}
            <col style={{ width: "6%" }} /> {/* 반 */}
            <col style={{ width: "9%" }} /> {/* 번호 */}
            <col style={{ width: "13%" }} /> {/* 날짜 */}
            <col style={{ width: "16%" }} /> {/* 요청일 */}
            <col style={{ width: "16%" }} /> {/* 마지막 처리자 */}
            <col style={{ width: "26%" }} /> {/* 처리 */}
          </colgroup>

          <thead>
            <tr style={{ background: "var(--bg-2)" }}>
              <Th>학생</Th>
              <Th>반</Th>
              <Th>번호</Th>
              <Th>날짜</Th>
              <Th>요청일</Th>
              <Th>마지막 처리자</Th>
              <Th>처리</Th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((r) => {
              const busy = updatingId === r.id;

              const actorName = r.actor?.name ?? "-";
              const actorTip = r.status_updated_at
                ? `${actorName} / ${formatRequestedAt(r.status_updated_at)}`
                : actorName;

              return (
                <>
                  <tr
                    key={r.id}
                    style={{ borderTop: `1px solid var(--border-focus)` }}
                  >
                    <Td strong>
                      <div
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={r.student?.name ?? ""}
                      >
                        {r.student?.name ?? "(알 수 없음)"}
                      </div>
                    </Td>

                    <Td>
                      <div
                        style={{ overflow: "hidden", textOverflow: "ellipsis" }}
                      >
                        {r.student?.class_no ?? "-"}
                      </div>
                    </Td>
                    <Td>
                      <div
                        style={{ overflow: "hidden", textOverflow: "ellipsis" }}
                      >
                        {r.student?.student_no ?? "-"}
                      </div>
                    </Td>
                    <Td>
                      <div
                        style={{ overflow: "hidden", textOverflow: "ellipsis" }}
                      >
                        {r.date ?? "-"}
                      </div>
                    </Td>

                    <Td>
                      <div
                        style={{ overflow: "hidden", textOverflow: "ellipsis" }}
                        title={r.created_at ?? ""}
                      >
                        {formatRequestedAt(r.created_at)}
                      </div>
                    </Td>

                 

                    <Td>
                      <div
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={actorTip}
                      >
                        {actorName}
                      </div>
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 12,
                          color: "var(--text-muted)",
                          lineHeight: 1.2,
                        }}
                      >
                        {r.status_updated_at
                          ? formatRequestedAt(r.status_updated_at)
                          : "-"}
                      </div>
                    </Td>

                    <Td>
                      <div
                        style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: 'center' }}
                      >
                        <ActionBtn
                          label="승인"
                          active={r.status === "approved"}
                          disabled={busy || r.status === "approved"}
                          onClick={() =>
                            setStatusForAbsence(
                              r.id,
                              r.student?.name,
                              "approved"
                            )
                          }
                        />

                        <ActionBtn
                          label="거절"
                          danger
                          active={r.status === "rejected"}
                          disabled={busy || r.status === "rejected"}
                          onClick={() =>
                            setStatusForAbsence(
                              r.id,
                              r.student?.name,
                              "rejected"
                            )
                          }
                        />

                        <ActionBtn
                          label="대기"
                          muted
                          active={r.status === "pending"}
                          disabled={busy || r.status === "pending"}
                          onClick={() =>
                            setStatusForAbsence(
                              r.id,
                              r.student?.name,
                              "pending"
                            )
                          }
                        />
                      </div>

                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 12,
                          color: "var(--text-muted)",
                          lineHeight: 1.25,
                          whiteSpace: "normal",
                        }}
                      >
                      </div>
                    </Td>
                  </tr>

                  <tr key={`${r.id}-reason`}>
                    <td
                      colSpan={8}
                      style={{
                        padding: "10px 14px 14px",
                        borderTop: "1px dashed var(--border-subtle)",
                        background: "var(--bg-1)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 900,
                          color: "var(--text-muted)",
                        }}
                      >
                        사유
                      </div>
                      <div
                        style={{
                          marginTop: 6,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          fontSize: 13,
                          color: "var(--text-2)",
                          lineHeight: 1.45,
                        }}
                      >
                        {r.reason ?? "-"}
                      </div>
                    </td>
                  </tr>
                </>
              );
            })}

            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
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
        minHeight: 34,
        padding: "6px 8px",
        fontWeight: 900,
        background: muted ? "var(--bg-1)" : bg,
        borderColor: muted ? "var(--border-subtle)" : border,
        opacity: disabled ? 0.55 : 1,
        whiteSpace: "nowrap",
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
        borderBottom: "1px solid var(--border-focus)",
        whiteSpace: "normal",
        lineHeight: 1.2,
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
        overflow: "hidden",
      }}
    >
      {children}
    </td>
  );
}
