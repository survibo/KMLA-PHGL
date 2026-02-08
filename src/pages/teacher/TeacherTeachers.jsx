import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

const SORTS = {
  CREATED: "created_at",
  NAME: "name",
  APPROVED: "approved",
};

export default function TeacherTeachers() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]); // profiles
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [approved, setApproved] = useState("all"); // all | approved | pending

  // ✅ 박탈(teacher->student) 포함 표시
  const [includeRevoked, setIncludeRevoked] = useState(false);

  // ✅ 기본: 최근 생성(가입) 순
  const [sortKey, setSortKey] = useState(SORTS.CREATED);
  const [asc, setAsc] = useState(false);

  async function load() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("profiles")
      .select(`
        id,
        name,
        role,
        approved,
        created_at,
        role_updated_at,
        role_updated_by:profiles!profiles_role_updated_by_fkey (
          id,
          name
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // 기본은 teacher만
  // includeRevoked면 "student인데 role_updated_at이 있는 사람"도 포함(=박탈된 선생님으로 간주)
  const teacherCandidates = useMemo(() => {
    if (!includeRevoked) {
      return rows.filter((p) => (p.role ?? "student") === "teacher");
    }

    return rows.filter((p) => {
      const role = p.role ?? "student";
      const revokedLike = role === "student" && !!p.role_updated_at;
      return role === "teacher" || revokedLike;
    });
  }, [rows, includeRevoked]);

  const counts = useMemo(() => {
    const totalShown = teacherCandidates.length;
    const revoked = teacherCandidates.filter(
      (p) => (p.role ?? "student") === "student" && !!p.role_updated_at
    ).length;
    return { totalShown, revoked };
  }, [teacherCandidates]);

  const filtered = useMemo(() => {
    let list = teacherCandidates;

    // 승인 필터는 teacher일 때만 의미 있음(박탈 student는 자동으로 pending로 분류될 수 있음)
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

            <label style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={includeRevoked}
                onChange={(e) => setIncludeRevoked(e.target.checked)}
              />
              <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-2)" }}>
                권한 박탈(teacher→student) 포함
              </span>
            </label>

            <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
              표시 중: {counts.totalShown}명 / 박탈: {counts.revoked}명
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
      </div>

      {/* Table */}
      <div className="u-panel" style={{ overflowX: "hidden" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed",
          }}
        >
          <colgroup>
            <col style={{ width: "20%" }} /> {/* 이름 */}
            <col style={{ width: "14%" }} /> {/* 현재 권한 */}
            <col style={{ width: "18%" }} /> {/* 박탈자 */}
            <col style={{ width: "16%" }} /> {/* 박탈일 */}
            <col style={{ width: "16%" }} /> {/* 생성일 */}
            <col style={{ width: "16%" }} /> {/* ID */}
          </colgroup>

          <thead>
            <tr style={{ background: "var(--bg-2)" }}>
              <Th>이름</Th>
              <Th>현재 권한</Th>
              <Th>박탈자</Th>
              <Th>박탈일</Th>
              <Th>생성일</Th>
              <Th>ID</Th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((t) => {
              const role = t.role ?? "student";
              const revoked = role === "student" && !!t.role_updated_at;

              const revokedByName = t?.role_updated_by?.name ?? "-";
              const revokedById = t?.role_updated_by?.id ?? null;

              return (
                <tr
                  key={t.id}
                  style={{ borderTop: "1px solid var(--border-subtle)" }}
                >
                  <Td strong>{t.name ?? "-"}</Td>

                  <Td>
                    <div style={{ fontWeight: 900 }}>
                      {role === "teacher" ? "TEACHER" : "STUDENT"}
                      {revoked ? " (권한 박탈)" : ""}
                    </div>
                  </Td>

                  <Td>
                    {revoked ? (
                      <>
                        <div style={{ fontSize: 13, fontWeight: 800 }}>
                          {revokedByName}
                        </div>
                        {revokedById ? (
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--text-muted)",
                              wordBreak: "break-all",
                            }}
                          >
                            {revokedById}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      "-"
                    )}
                  </Td>

                  <Td>{revoked ? formatYmdHm(t.role_updated_at) : "-"}</Td>
                  <Td>{formatYmdHm(t.created_at)}</Td>

                  <Td>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-muted)",
                        wordBreak: "break-all",
                      }}
                    >
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
