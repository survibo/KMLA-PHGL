import { useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useMyProfile } from "../hooks/useMyProfile";

export default function StudentCalendar() {
  const { loading, session, profile } = useMyProfile();

  // ✅ Hook은 조건부 return보다 위에서 "항상" 호출되어야 함
  useEffect(() => {
    // loading 중엔 굳이 안 돌려도 되면 guard
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
