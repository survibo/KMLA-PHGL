import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

const SORTS = {
  STUDENT_NO: "student_no",
  CLASS_NO: "class_no",
  APPROVED: "approved",
};

export default function TeacherStudents() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState(SORTS.STUDENT_NO);
  const [asc, setAsc] = useState(true);

  // row별 업데이트 중 표시용
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, grade, class_no, student_no, approved, role")
        .eq("role", "student");

      if (error) {
        setError(error.message);
        setStudents([]);
      } else {
        setStudents(data ?? []);
      }

      setLoading(false);
    };

    load();
  }, []);

  const filtered = useMemo(() => {
    let list = students;

    // 1) 이름 검색
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((s) => (s.name ?? "").toLowerCase().includes(q));
    }

    // 2) 정렬
    list = [...list].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];

      if (sortKey === SORTS.APPROVED) {
        return asc ? Number(va) - Number(vb) : Number(vb) - Number(va);
      }

      if (va == null && vb == null) return 0;
      if (va == null) return asc ? 1 : -1;
      if (vb == null) return asc ? -1 : 1;

      return asc ? va - vb : vb - va;
    });

    return list;
  }, [students, search, sortKey, asc]);

  const toggleApproved = async (student) => {
    // ✅ 승인 취소할 때만 경고
    if (student.approved) {
      const ok = window.confirm(
        `${student.name ?? "학생"}의 승인을 취소할까요?\n취소하면 학생은 /pending 상태로 돌아갑니다.`
      );
      if (!ok) return;
    }

    const nextApproved = !student.approved;

    try {
      setUpdatingId(student.id);

      const { data, error } = await supabase
        .from("profiles")
        .update({ approved: nextApproved })
        .eq("id", student.id)
        .select("id, name, grade, class_no, student_no, approved, role")
        .single();

      if (error) throw error;

      // 로컬 상태 업데이트
      setStudents((prev) =>
        prev.map((s) => (s.id === student.id ? data : s))
      );
    } catch (err) {
      window.alert(`승인 상태 변경 실패: ${err?.message ?? String(err)}`);
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) return <div className="p-6 text-gray-500">불러오는 중…</div>;
  if (error) return <div className="p-6 text-red-600">오류: {error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">학생 관리</h1>

      {/* Controls */}
      <div className="flex items-center gap-4 mb-4">
        <input
          className="border rounded px-3 py-2 w-64"
          placeholder="이름 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="border rounded px-3 py-2"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value)}
        >
          <option value={SORTS.STUDENT_NO}>학번</option>
          <option value={SORTS.CLASS_NO}>반</option>
          <option value={SORTS.APPROVED}>승인 여부</option>
        </select>

        <button
          className="border rounded px-3 py-2"
          onClick={() => setAsc((v) => !v)}
        >
          {asc ? "오름차순 ↑" : "내림차순 ↓"}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <Th>이름</Th>
              <Th>기수</Th>
              <Th>반</Th>
              <Th>번호</Th>
              <Th>승인</Th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((s) => {
              const busy = updatingId === s.id;

              return (
                <tr key={s.id} className="border-t hover:bg-gray-50">
                  <Td className="font-medium">{s.name}</Td>
                  <Td>{s.grade ?? "-"}</Td>
                  <Td>{s.class_no ?? "-"}</Td>
                  <Td>{s.student_no ?? "-"}</Td>

                  <Td>
                    <div className="flex items-center gap-3">
                      {s.approved ? (
                        <span className="text-green-600 font-semibold">
                          승인됨
                        </span>
                      ) : (
                        <span className="text-gray-400">대기</span>
                      )}

                      <button
                        className={`px-3 py-1.5 rounded border text-sm font-semibold ${
                          s.approved
                            ? "border-red-300 text-red-600 hover:bg-red-50"
                            : "border-green-300 text-green-700 hover:bg-green-50"
                        } ${busy ? "opacity-60 cursor-not-allowed" : ""}`}
                        disabled={busy}
                        onClick={() => toggleApproved(s)}
                        title={
                          s.approved ? "승인 취소" : "승인 처리"
                        }
                      >
                        {busy ? "처리중..." : s.approved ? "취소" : "승인"}
                      </button>
                    </div>
                  </Td>
                </tr>
              );
            })}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-400">
                  검색 결과가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-gray-500">
        총 {filtered.length}명 / 전체 {students.length}명
      </div>
    </div>
  );
}

function Th({ children }) {
  return (
    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">
      {children}
    </th>
  );
}

function Td({ children, className = "" }) {
  return <td className={`px-4 py-3 text-sm ${className}`}>{children}</td>;
}
