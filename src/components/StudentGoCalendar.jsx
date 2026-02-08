import { useNavigate } from "react-router-dom";

export default function StudentGoCalendar({ label = "캘린더로 이동", fullWidth = true }) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      className="c-ctl c-btn"
      onClick={() => navigate("/student/calendar")}
      style={{
        width: fullWidth ? "100%" : "auto",
        fontWeight: 800,
      }}
    >
      {label}
    </button>
  );
}
