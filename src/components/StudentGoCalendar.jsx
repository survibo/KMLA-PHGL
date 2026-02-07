import { useNavigate } from "react-router-dom";

export default function StudentGoCalendar({
  label = "캘린더로 이동",
  fullWidth = true,
}) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate("/student/calendar")}
      className="button"
    >
      {label}
    </button>
  );
}
