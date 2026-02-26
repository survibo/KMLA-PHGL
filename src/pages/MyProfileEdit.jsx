import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useMyProfile } from "../hooks/useMyProfile";
import { useNavigate } from "react-router-dom";

function parseRequiredInt(label, raw) {
  const v = String(raw ?? "").trim();
  if (v === "") return { ok: false, msg: `${label}을(를) 입력하세요.` };
  if (!/^\d+$/.test(v)) return { ok: false, msg: `${label}은(는) 숫자만 입력하세요.` };

  const n = Number(v);
  if (!Number.isSafeInteger(n)) return { ok: false, msg: `${label} 값이 올바르지 않습니다.` };

  return { ok: true, value: n };
}

export default function MyProfileEdit() {
  const { loading, profile } = useMyProfile();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [classNo, setClassNo] = useState("");
  const [studentNo, setStudentNo] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile) return;
    setName(profile.name ?? "");
    setGrade(profile.grade ?? "");
    setClassNo(profile.class_no ?? "");
    setStudentNo(profile.student_no ?? "");
  }, [profile]);

  if (loading) {
    return (
      <div className="l-page">
        <div className="u-panel" style={{ padding: 14 }}>
          Loading...
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="l-page">
        <div className="u-alert u-alert--error">프로필을 불러올 수 없습니다.</div>
      </div>
    );
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("이름을 입력하세요.");
      return;
    }

    const g = parseRequiredInt("기수", grade);
    if (!g.ok) return setError(g.msg);

    const c = parseRequiredInt("행정반", classNo);
    if (!c.ok) return setError(c.msg);

    const s = parseRequiredInt("학번", studentNo);
    if (!s.ok) return setError(s.msg);

    const payload = {
      name: trimmedName,
      grade: g.value,
      class_no: c.value,
      student_no: s.value,
    };

    try {
      setSaving(true);

      const { error: updateError } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", profile.id)
        .select("id, role, approved, name, grade, class_no, student_no")
        .single();

      if (updateError) throw updateError;

      const to = profile.role === "teacher" ? "/teacher/profile" : "/student/profile";
      navigate(to, { replace: true });
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="l-page">
      <div className="u-panel" style={{ padding: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>내 정보 수정</div>
            <div style={{ marginTop: 4, fontSize: 13, color: "var(--text-muted)" }}>
              이름, 기수, 행정반, 학번을 수정할 수 있습니다.
            </div>
          </div>

          <button
            type="button"
            className="c-ctl c-btn"
            onClick={() =>
              navigate(profile.role === "teacher" ? "/teacher/profile" : "/student/profile")
            }
            disabled={saving}
          >
            취소
          </button>
        </div>

        <form onSubmit={onSubmit} className="l-section" style={{ marginTop: 12 }}>
          <div className="f-field">
            <div className="f-label">이름(A, B표시)</div>
            <input
              className="c-ctl c-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름"
              autoComplete="name"
            />
          </div>

          {/* 숫자 3개: 모바일에서는 자동 1열로 내려가도록 r-split 재사용 */}
          <div className="r-split">
            <div className="f-field">
              <div className="f-label">기수</div>
              <input
                className="c-ctl c-input"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                inputMode="numeric"
                placeholder="31"
              />
            </div>

            <div className="f-field">
              <div className="f-label">행정반</div>
              <input
                className="c-ctl c-input"
                value={classNo}
                onChange={(e) => setClassNo(e.target.value)}
                inputMode="numeric"
                placeholder="1-10"
              />
            </div>
          </div>

          {/* 3개를 2열로만 처리하면 학번이 애매해서 단독 패널로 분리 */}
          <div className="f-field">
            <div className="f-label">학번</div>
            <input
              className="c-ctl c-input"
              value={studentNo}
              onChange={(e) => setStudentNo(e.target.value)}
              inputMode="numeric"
              placeholder="261000"
            />
          </div>

            <a style={{ fontSize: 12, color: "var(--text-muted)" }}>
              * 기수/행정반/학번은 숫자로 입력해야 합니다.
            </a>

          {error ? <div className="u-alert u-alert--error">{error}</div> : null}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
            <button type="submit" className="c-ctl c-btn" disabled={saving}>
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
