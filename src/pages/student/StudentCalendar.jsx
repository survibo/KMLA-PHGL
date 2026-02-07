import { useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useMyProfile } from "../../hooks/useMyProfile";

export default function StudentCalendar() {
  const { loading, session, profile } = useMyProfile();

  useEffect(() => {
    if (loading) return;

    supabase.auth.getSession().then(console.log);
  }, [loading]);

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;

  return (
    <div style={{ padding: 24 }}>
      <h1>Student Calendar</h1>
      <pre>{JSON.stringify({ hasSession: !!session, profile }, null, 2)}</pre>
    </div>
  );
}
