import { supabase } from "../lib/supabase";

// 승인 대기 학생 목록
export async function listPendingStudents() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, grade, class_no, student_no, role, approved")
    .eq("role", "student")
    .eq("approved", false)
    .order("grade", { ascending: true })
    .order("class_no", { ascending: true })
    .order("student_no", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// 승인 처리
export async function approveStudent(profileId) {
  const { data, error } = await supabase
    .from("profiles")
    .update({ approved: true })
    .eq("id", profileId)
    .select("id, approved")
    .single();

  if (error) throw error;
  return data;
}

// (옵션) 승인 취소까지 필요하면
export async function revokeApproval(profileId) {
  const { data, error } = await supabase
    .from("profiles")
    .update({ approved: false })
    .eq("id", profileId)
    .select("id, approved")
    .single();

  if (error) throw error;
  return data;
}
