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

  // ✅ 기본: 최근 생성(가입) 순
  const [sortKey, setSortKey] = useState(SORTS.CREATED);
  const [asc, setAsc] = useState(false);

  async function load() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, role, approved, created_at")
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

  const teachersOnly = useMemo(() => {
    return rows.filter((p) => (p.role ?? "student") === "teacher");
  }, [rows]);

  const counts = useMemo(() => {
    const total = teachersOnly.length;
    const ok = teachersOnly.filter((p) => p.approved).length;
    return { total, approved: ok };
  }, [teachersOnly]);

  const filtered = useMemo(() => {
    let list = teachersOnly;

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
  }, [teachersOnly, approved, search, sortKey, asc]);

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
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>선생님 목록</div>
            <div className="f-hint" style={{ marginTop: 4 }}>
              profiles에서 role=teacher만 조회합니다. (조회 전용)
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
            <div className="f-hint">
              총 <b style={{ color: "var(--text-1)" }}>{filtered.length}</b>명 / 전체 선생님{" "}
              <b style={{ color: "var(--text-1)" }}>{counts.total}</b>명 (승인{" "}
              <b style={{ color: "var(--text-1)" }}>{counts.approved}</b>)
            </div>

            <button className="c-ctl c-btn" type="button" onClick={load} style={{ fontWeight: 900 }}>
              새로고침
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
              <div className="f-label">정렬 기준</div>
              <select
                className="c-ctl c-input"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
              >
                <option value={SORTS.CREATED}>생성일</option>
                <option value={SORTS.NAME}>이름</option>
                <option value={SORTS.APPROVED}>승인 여부</option>
              </select>
            </div>
          </div>

          <div className="f-field">
            <div className="f-label">정렬 방향</div>
            <button className="c-ctl c-btn" type="button" onClick={() => setAsc((v) => !v)}>
              {asc ? "오름차순 ↑" : "내림차순 ↓"}
            </button>
          </div>

          <div className="f-hint">* 이 페이지는 조회 전용입니다.</div>
        </div>
      </div>

      {/* Table */}
      <div className="u-panel" style={{ overflowX: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "26%" }} /> {/* 이름 */}
            <col style={{ width: "16%" }} /> {/* 승인 */}
            <col style={{ width: "22%" }} /> {/* 생성일 */}
            <col style={{ width: "36%" }} /> {/* id */}
          </colgroup>

          <thead>
            <tr style={{ background: "var(--bg-2)" }}>
              <Th>이름</Th>
              <Th>승인</Th>
              <Th>생성일</Th>
              <Th>ID</Th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <Td strong>{t.name ?? "-"}</Td>
                <Td>
                  <span style={{ fontWeight: 900, color: t.approved ? "var(--text-1)" : "var(--text-muted)" }}>
                    {t.approved ? "승인됨" : "미승인"}
                  </span>
                </Td>
                <Td>{formatYmdHm(t.created_at)}</Td>
                <Td>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", wordBreak: "break-all" }}>
                    {t.id}
                  </div>
                </Td>
              </tr>
            ))}

            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 18, textAlign: "center", color: "var(--text-muted)" }}>
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
