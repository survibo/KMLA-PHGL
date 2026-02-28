import { useNavigate } from "react-router-dom";
import { useMyProfile } from "../hooks/useMyProfile";
import StudentGoCalendar from "../components/StudentGoCalendar";

function InfoRow({ label, value }) {
  return (
    <div
      className="u-panel"
      style={{
        padding: 12,
        background: "var(--bg-2)",
        borderRadius: "var(--radius-2)",
        display: "grid",
        gridTemplateColumns: "80px 1fr",
        gap: 12,
        alignItems: "center",
      }}
    >
      <div
        style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 800 }}
      >
        {label}
      </div>
      <div style={{ fontWeight: 900 }}>{value ?? "-"}</div>
    </div>
  );
}

export default function MyProfile() {
  const navigate = useNavigate();
  const { loading, profile } = useMyProfile();

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
        <div className="u-alert u-alert--error">
          프로필을 불러올 수 없습니다.
        </div>
      </div>
    );
  }

  const editPath =
    profile.role === "teacher"
      ? "/teacher/profile/edit"
      : "/student/profile/edit";

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
            <div style={{ fontSize: 18, fontWeight: 900 }}>내 정보</div>
            <div
              style={{
                marginTop: 4,
                fontSize: 13,
                color: "var(--accent-danger)",
              }}
            >
              자신의 이름, 기수, 행정반, 학번을 입력해주세요.
            </div>
          </div>

          {/* 나중에 닫는거 고려 */}
          <button
            type="button"
            className="c-ctl c-btn"
            onClick={() => navigate(editPath)}
            style={{ fontWeight: 800 }}
          >
            정보 수정
          </button>
        </div>

        <div className="l-section" style={{ marginTop: 12 }}>
          <InfoRow label="이름" value={profile.name} />
          <InfoRow label="기수" value={profile.grade} />
          <InfoRow label="행정반" value={profile.class_no} />
          <InfoRow label="학번" value={profile.student_no} />
        </div>

        <div style={{ marginTop: 12 }}>
          <StudentGoCalendar />
        </div>
      </div>
    </div>
  );
}
