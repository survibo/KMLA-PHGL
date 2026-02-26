import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useMyProfile } from "../../hooks/useMyProfile";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";

const STATUS_LABEL = {
  pending: "대기",
  approved: "승인",
  rejected: "거절",
};

const STATUS_COLOR = {
  approved: "green",
  rejected: "var(--accent-danger)",
  pending: "var(--text-1)",
};

// ✅ 제출시각 표시용 (KST 기준 브라우저 로컬타임)
function formatSubmittedAt(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

export default function StudentAbsence() {
  const isOnline = useNetworkStatus();
  const { loading, session } = useMyProfile();
  const uid = session?.user?.id;

  const [listLoading, setListLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ date: "", reason: "" });

  async function fetchMine() {
    if (!uid) return;
    setListLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("absences")
      .select("id, student_id, date, reason, status, created_at")
      .eq("student_id", uid)
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      setItems([]);
      setListLoading(false);
      return;
    }

    setItems(data ?? []);
    setListLoading(false);
  }

  useEffect(() => {
    if (!loading && uid) fetchMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, uid]);

  const canSubmit = useMemo(() => {
    return draft.date && draft.reason.trim().length > 0;
  }, [draft.date, draft.reason]);

  async function submit() {
    if (!uid) return;

    if (!draft.date) {
      setError("날짜를 선택하세요.");
      return;
    }
    if (!draft.reason.trim()) {
      setError("사유를 입력하세요.");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      student_id: uid,
      date: draft.date,
      reason: draft.reason.trim(),
      status: "pending",
    };

    const { error } = await supabase.from("absences").insert(payload);

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    setDraft({ date: "", reason: "" });
    setSaving(false);
    await fetchMine();
  }

  if (loading) {
    return (
      <div className="l-page">
        <div className="u-panel" style={{ padding: 14 }}>
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="l-page">
      <div className="u-panel" style={{ padding: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 900 }}>결석 제출</div>
        <div style={{ marginTop: 4, fontSize: 13, color: "var(--text-muted)" }}>
          날짜와 사유를 제출하면 선생님이 확인합니다.
        </div>
      </div>

      {!isOnline && (
        <div className="u-alert u-alert--error">
          인터넷 연결이 끊겼습니다. 와이파이를 확인해주세요.
        </div>
      )}

      {error ? <div className="u-alert u-alert--error">{error}</div> : null}

      <div className="u-panel" style={{ padding: 14 }}>
        <div className="l-section">
          <div className="f-field">
            <div className="f-label">날짜</div>
            <input
              className="c-ctl c-input"
              type="date"
              value={draft.date}
              onChange={(e) =>
                setDraft((p) => ({ ...p, date: e.target.value }))
              }
            />
          </div>

          <div className="f-field">
            <div className="f-label">사유</div>
            <textarea
              className="c-ctl c-textarea"
              value={draft.reason}
              onChange={(e) =>
                setDraft((p) => ({ ...p, reason: e.target.value }))
              }
              placeholder="결석 사유"
              rows={3}
            />
            <div className="f-hint">
              * 제출 후 상태(대기/승인/거절)는 목록에서 확인
            </div>
            <div className="f-hint" style={{ color: "var(--accent-danger)" }}>
              * 수정 및 삭제가 불가능하니, 신중하게 제출하세요.
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              type="button"
              className="c-ctl c-btn"
              disabled={saving || !canSubmit}
              onClick={submit}
              style={{
                fontWeight: 900,
                opacity: saving || !canSubmit ? 0.6 : 1,
              }}
            >
              {saving ? "제출중..." : "제출"}
            </button>
          </div>
        </div>
      </div>

      <div className="u-panel" style={{ padding: 14 }}>
        <div style={{ fontWeight: 900 }}>내 결석 목록</div>
        <div style={{ marginTop: 10 }}>
          {listLoading ? (
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
              불러오는 중...
            </div>
          ) : items.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
              제출한 결석이 없습니다.
            </div>
          ) : (
            <div className="l-section">
              {items.map((a) => (
                <div
                  key={a.id}
                  className="u-panel"
                  style={{ padding: 12, background: "var(--bg-2)" }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                      alignItems: "baseline",
                    }}
                  >
                    {/* ✅ 날짜 + 제출시각 */}
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: 'center'}}>
                      <div style={{ fontWeight: 900 }}>{a.date}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {formatSubmittedAt(a.created_at)}
                      </div>
                    </div>

                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 900,
                        color: STATUS_COLOR[a.status] ?? "var(--text-muted)",
                      }}
                    >
                      {STATUS_LABEL[a.status] ?? a.status ?? "-"}
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 13,
                      whiteSpace: "pre-wrap",
                      color: "var(--text-2)",
                    }}
                  >
                    {a.reason ?? "-"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
