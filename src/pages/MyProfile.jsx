import { useMyProfile } from "../hooks/useMyProfile";

function row(label, value) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "70px 1fr",
        gap: 12,
        padding: "6px 0",
      }}
    >
      <div style={{ opacity: 0.7 }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value ?? "-"}</div>
    </div>
  );
}

export default function MyProfile() {
  const { loading, profile } = useMyProfile();

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (!profile) return <div style={{ padding: 24 }}>프로필을 불러올 수 없습니다.</div>;

  return (
    <div style={{ padding: 24, maxWidth: 360 }}>
      <h2 style={{ marginTop: 0 }}>내 정보</h2>

      <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 14 }}>
        {row("이름", profile.name)}
        {row("기수", profile.grade)}
        {row("반", profile.class_no)}
        {row("학번", profile.student_no)}
      </div>
    </div>
  );
}
