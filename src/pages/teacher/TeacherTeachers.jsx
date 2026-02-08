import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

const SORTS = {
  CREATED: "created_at",
  NAME: "name",
  APPROVED: "approved",
  ROLE: "role",
  REVOKED_AT: "role_updated_at",
};

function formatYmdHm(iso) {
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

// "권한 박탈" 정의: teacher였다가 student로 내려간 기록이 남아있는 케이스를 보여주려면
// 최소한 role=student AND role_updated_at 존재 → 박탈로 간주
function isRevoked(p) {
  return (p.role ?? "student") === "student" && !!p.role_updated_at;
}

export default function TeacherTeachers() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]); // profiles + actor
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [approved, setApproved] = useState("all"); // all | approved | pending

  // ✅ 박탈 포함 표시 토글
  const [includeRevoked, setIncludeRevoked] = useState(true);

  // ✅ 기본: 최근 생성(가입) 순
  const [sortKey, setSortKey] = useState(SORTS.CREATED);
  const [asc, setAsc] = useState(false);

  async function load() {
    setLoading(true);
    setError("");

    // 1) profiles 기본 조회 (actor join 없이)
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, name, role, approved, created_at, role_updated_by, role_updated_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const list = data ?? [];

    // 2) 마지막 처리자(권한 박탈/변경자) 프로필 같이 조회
    const actorIds = list.map((p) => p.role_updated_by).filter(Boolean);
    const ids = Array.from(new Set(actorIds));

    let map = new Map();
    if (ids.length > 0) {
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", ids);

      if (pErr) {
        setError(pErr.message);
        setRows([]);
        setLoading(false);
        return;
      }

      map = new Map((profiles ?? []).map((p) => [p.id, p]));
    }

    setRows(
      list.map((p) => ({
        ...p,
        actor: p.role_updated_by ? map.get(p.role_updated_by) ?? null : null,
      }))
    );

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // ✅ teacher 목록 + (토글 시) 박탈된 teacher(현재 student, role_updated_at 있음) 포함
  const teacherCandidates = useMemo(() => {
    if (!includeRevoked) {
      return rows.filter((p) => (p.role ?? "student") === "teacher");
    }
    return rows.filter((p) => (p.role ?? "student") === "teacher" || isRevoked(p));
  }, [rows, includeRevoked]);

  const counts = useMemo(() => {
    const total = teacherCandidates.length;
    const ok = teacherCandidates.filter((p) => p.approved).length;
    const revoked = teacherCandidates.filter((p) => isRevoked(p)).length;
    return { total, approved: ok, revoked };
  }, [teacherCandidates]);

  const filtered = useMemo(() => {
    let list = teacherCandidates;

    if (approved === "approved") list = list.filter((p) => p.approved === true);
    if (approved === "pending") list = list.filter((p) => p.approved === false);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => (p.name ?? "").toLowerCase().includes(q));
    }

    list = [...list].sort((a, b) => {
      if (sortKey === SORTS.APPROVED) {
        const va = Number(!!a.approved);
        const vb = Number(!!b.approved);
        return asc ? va - vb : vb - va;
      }

      if (sortKey === SORTS.CREATED) {
        const va = a.created_at ?? "";
        const vb = b.created_at ?? "";
        return asc ? va.localeCompare(vb) : vb.localeCompare(va);
      }

      if (sortKey === SORTS.REVOKED_AT) {
        const va = a.role_updated_at ?? "";
        const vb = b.role_updated_at ?? "";
        return asc ? va.localeCompare(vb) : vb.localeCompare(va);
      }

      if (sortKey === SORTS.ROLE) {
        const va = a.role ?? "";
        const vb = b.role ?? "";
        return asc ? va.localeCompare(vb) : vb.localeCompare(va);
      }

      const na = String(a.name ?? "");
      const nb = String(b.name ?? "");
      return asc ? na.localeCompare(nb) : nb.localeCompare(na);
    });

    return list;
  }, [teacherCandidates, approved, search, sortKey, asc]);

  if (loading) {
    return (
      <div className="l-page">
        <div className="u-panel" style={{ padding: 14 }}>불러오는 중…</div>
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
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>선생님 목록</div>

            <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={includeRevoked}
                  onChange={(e) => setIncludeRevoked(e.target.checked)}
                />
                <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-2)" }}>
                  권한 박탈 포함
                </span>
              </label>

              <div className="f-hint" style={{ marginTop: 2 }}>
                총 <b style={{ color: "var(--text-1)" }}>{filtered.length}</b>명 /
                표시 <b style={{ color: "var(--text-1)" }}>{counts.total}</b>명 /
                승인 <b style={{ color: "var(--text-1)" }}>{counts.approved}</b>명 /
                박탈 <b style={{ color: "var(--text-1)" }}>{counts.revoked}</b>명
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
            <button className="c-ctl c-btn" type="button" onClick={load} style={{ fontWeight: 900 }}>
              새로고침
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
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
              <div className="f-label">승인 상태</div>
              <select
                className="c-ctl c-input"
                value={approved}
                onChange={(e) => setApproved(e.target.value)}
              >
                <option value="all">전체</option>
                <option value="approved">승인됨</option>
                <option value="pending">미승인</option>
              </select>
            </div>

            <div className="f-field">
              <div className="f-label">정렬</div>
              <select
                className="c-ctl c-input"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
              >
                <option value={SORTS.CREATED}>생성일</option>
                <option value={SORTS.NAME}>이름</option>
                <option value={SORTS.APPROVED}>승인</option>
                <option value={SORTS.ROLE}>권한(ROLE)</option>
                <option value={SORTS.REVOKED_AT}>박탈/변경일</option>
              </select>
            </div>
          </div>

          <div className="f-field">
            <div className="f-label">정렬 방향</div>
            <button className="c-ctl c-btn" type="button" onClick={() => setAsc((v) => !v)}>
              {asc ? "오름차순 ↑" : "내림차순 ↓"}
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="u-panel" style={{ overflowX: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "18%" }} /> {/* 이름 */}
            <col style={{ width: "12%" }} /> {/* 승인 */}
            <col style={{ width: "14%" }} /> {/* 현재 ROLE */}
            <col style={{ width: "18%" }} /> {/* 권한 박탈/변경자 */}
            <col style={{ width: "18%" }} /> {/* 권한 박탈/변경일 */}
            <col style={{ width: "20%" }} /> {/* ID */}
          </colgroup>

          <thead>
            <tr style={{ background: "var(--bg-2)" }}>
              <Th>이름</Th>
              <Th>승인</Th>
              <Th>현재 권한</Th>
              <Th>권한 박탈/변경자</Th>
              <Th>권한 박탈/변경일</Th>
              <Th>ID</Th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((t) => {
              const role = t.role ?? "student";
              const revoked = isRevoked(t);

              const actorName = t.actor?.name ?? "-";
              const actorTip = t.role_updated_at ? `${actorName} / ${formatYmdHm(t.role_updated_at)}` : actorName;

              return (
                <tr key={t.id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  <Td strong>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={t.name ?? ""}>
                      {t.name ?? "-"}
                    </div>
                  </Td>

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
                        color: t.approved ? "var(--text-1)" : "var(--text-muted)",
                      }}
                      title={t.approved ? "승인됨" : "미승인"}
                    >
                      {t.approved ? "승인" : "미승인"}
                    </span>
                  </Td>

                  <Td>
                    <div style={{ fontWeight: 900 }}>
                      {role === "teacher" ? "TEACHER" : "STUDENT"}
                      {revoked ? " (권한 박탈)" : ""}
                    </div>
                  </Td>

                  <Td>
                    <div
                      style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      title={actorTip}
                    >
                      {revoked || t.role_updated_at ? actorName : "-"}
                    </div>
                  </Td>

                  <Td>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                      {t.role_updated_at ? formatYmdHm(t.role_updated_at) : "-"}
                    </div>
                  </Td>

                  <Td>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", wordBreak: "break-all" }}>
                      {t.id}
                    </div>
                  </Td>
                </tr>
              );
            })}

            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
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
