import { useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function StudentCalendar() {
  useEffect(() => {
    supabase.auth.getSession().then(console.log);
  }, []);

  return <div style={{ padding: 24 }}><h1>Student Calendar</h1></div>;
}
