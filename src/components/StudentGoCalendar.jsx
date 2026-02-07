import { useNavigate } from "react-router-dom";

export default function StudentGoCalendar({
  label = "캘린더로 이동",
  fullWidth = true,
}) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate("/student/calendar")}
      style={{
        width: fullWidth ? "100%" : "auto",
        padding: "10px 12px",
        borderRadius: 8,
        border: "1px solid #ccc",
        background: "#fff",
        cursor: "pointer",
        fontWeight: 600,
      }}
    >
      {label}
    </button>
  );
}
