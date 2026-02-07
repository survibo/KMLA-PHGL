import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useMyProfile } from "../hooks/useMyProfile";
import { useNavigate } from "react-router-dom";

function parseRequiredInt(label, raw) {
  const v = String(raw ?? "").trim();
  if (v === "") return { ok: false, msg: `${label}을(를) 입력하세요.` };
  // 숫자만 허용 (음수/소수 방지)
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

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (!profile)
    return <div style={{ padding: 24 }}>프로필을 불러올 수 없습니다.</div>;

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
      // role/approved 절대 포함 금지
    };

    try {
      setSaving(true);

      const { data, error: updateError } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", profile.id)
        .select("id, role, approved, name, grade, class_no, student_no")
        .single();

      if (updateError) throw updateError;

      // ✅ 저장 성공 → 프로필 보기로 이동
      const to =
        profile.role === "teacher" ? "/teacher/profile" : "/student/profile";
      navigate(to, { replace: true });

      // (원하면 setSaved(true)는 제거해도 됨. 이동하니까 보일 틈이 없음)
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: "100%",
    padding: 10,
    borderRadius: 8,
    border: "1px solid #ddd",
  };

  return (
    <div style={{ padding: 24, maxWidth: 420 }}>
      <h2 style={{ marginTop: 0 }}>내 정보 수정</h2>

      <form
        onSubmit={onSubmit}
        style={{ border: "1px solid #ddd", borderRadius: 10, padding: 14 }}
      >
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
            이름
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
        >
          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
              기수
            </div>
            <input
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              inputMode="numeric"
              style={inputStyle}
              placeholder="숫자"
            />
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
              반
            </div>
            <input
              value={classNo}
              onChange={(e) => setClassNo(e.target.value)}
              inputMode="numeric"
              style={inputStyle}
              placeholder="숫자"
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
              학번
            </div>
            <input
              value={studentNo}
              onChange={(e) => setStudentNo(e.target.value)}
              inputMode="numeric"
              style={inputStyle}
              placeholder="숫자"
            />
          </div>
        </div>

        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
          * 기수/반/학번은 저장 전에 반드시 숫자로 입력해야 합니다.
        </div>

        {error && (
          <div style={{ marginTop: 10, color: "crimson" }}>에러: {error}</div>
        )}
        {saved && (
          <div style={{ marginTop: 10, color: "green" }}>저장 완료</div>
        )}

        <button
          type="submit"
          disabled={saving}
          style={{
            marginTop: 12,
            width: "100%",
            padding: 10,
            borderRadius: 8,
            border: "1px solid #ddd",
          }}
        >
          {saving ? "저장 중..." : "저장"}
        </button>
      </form>
    </div>
  );
}
