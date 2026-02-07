import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useMyProfile } from "../hooks/useMyProfile";
import { useNavigate } from "react-router-dom";

function parseRequiredInt(label, raw) {
  const v = String(raw ?? "").trim();
  if (v === "") return { ok: false, msg: `${label}을(를) 입력하세요.` };
  if (!/^\d+$/.test(v))
    return { ok: false, msg: `${label}은(는) 숫자만 입력하세요.` };

  const n = Number(v);
  if (!Number.isSafeInteger(n))
    return { ok: false, msg: `${label} 값이 올바르지 않습니다.` };

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
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name ?? "");
    setGrade(profile.grade ?? "");
    setClassNo(profile.class_no ?? "");
    setStudentNo(profile.student_no ?? "");
  }, [profile]);

  if (loading) return <div className="card">Loading...</div>;
  if (!profile) return <div className="card">프로필을 불러올 수 없습니다.</div>;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("이름을 입력하세요.");
      return;
    }

    const g = parseRequiredInt("기수", grade);
    if (!g.ok) return setError(g.msg);

    const c = parseRequiredInt("반", classNo);
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

      const to =
        profile.role === "teacher" ? "/teacher/profile" : "/student/profile";
      navigate(to, { replace: true });
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <h2>내 정보 수정</h2>

      <form onSubmit={onSubmit} className="container profile-form">
        <div className="field">
          <div className="label">이름</div>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름"
          />
        </div>

        <div
          style={{
            width: "100%",
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "14px",
          }}
        >
          <div className="field">
            <div className="label">기수</div>
            <input
              className="input"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              inputMode="numeric"
              placeholder="숫자"
            />
          </div>

          <div className="field">
            <div className="label">반</div>
            <input
              className="input"
              value={classNo}
              onChange={(e) => setClassNo(e.target.value)}
              inputMode="numeric"
              placeholder="숫자"
            />
          </div>

          <div className="field">
            <div className="label">학번</div>
            <input
              className="input"
              value={studentNo}
              onChange={(e) => setStudentNo(e.target.value)}
              inputMode="numeric"
              placeholder="숫자"
            />
          </div>
        </div>

        <div className="hint">
          * 기수/반/학번은 저장 전에 반드시 숫자로 입력해야 합니다.
        </div>

        {error && <div className="alert alert--error">에러: {error}</div>}
        {saved && <div className="alert">저장 완료</div>}

        <button type="submit" disabled={saving} className="button">
          {saving ? "저장 중..." : "저장"}
        </button>
      </form>
    </div>
  );
}
