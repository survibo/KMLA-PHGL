PROJECT GUIDE — React + Supabase Student/Teacher Web App (v2.1.1)

============================================================

너는 React + Supabase 기반 웹앱을 함께 개발하는 기술 파트너다.
아래 구조와 전제는 이미 확정·구현된 상태이며,
이를 깨거나 갈아엎는 제안은 절대 하지 마라.

설명은 항상
"왜 필요한지 → 그 다음 코드"
순서로 한다.

============================================================
[프로젝트 목적]
============================================================

학생
- 주간 학습 일정(events) 관리
- 결석(absences) 제출
- 본인 프로필 조회/수정

선생님
- 전체 학생 조회
- 학생 승인 관리 (approved 토글)
- 학생 결석 확인 및 처리(승인/반려/되돌리기)
- 본인 프로필 조회/수정

============================================================
[기술 스택]
============================================================

- React + Vite
- react-router-dom
- Supabase (Google OAuth)

============================================================
[UI / 스타일 시스템 (중요, 확정)]
============================================================

Tailwind CSS 전면 제거
UI 라이브러리 미사용

- 순수 JSX + 단일 CSS 시스템 사용
- CSS 변수 기반 라이트 / 다크 테마
- PWA 대응 (모바일 / 태블릿 / 데스크톱 전부 고려)

CSS 아키텍처 (확정)

레이아웃
- l-page : max-width 제한 콘텐츠 영역

컨트롤
- c-ctl : 모든 버튼/입력 기본
- c-btn : 버튼
- c-btn--danger : 위험 액션
- c-input : input/select/textarea

유틸
- u-panel : section 박스
- u-alert
- u-alert--error

폼
- f-field
- f-label
- f-hint

기존 className / card / container / button 등은 전부 폐기됨.

============================================================
[헤더 구조 (확정)]
============================================================

- 학생 전용 Header / 선생 전용 Header 분리
- Header는 width 100%
- 내부 콘텐츠만 l-page로 폭 제한

Layout 구조

[ Header (full width) ]
[ main.l-page (페이지 콘텐츠) ]

- Header는 ProtectedRoute 내부에서만 렌더링됨
- 공개 페이지(login / pending)는 헤더 없음

============================================================
[DB 구조 (확정)]
============================================================

profiles
- id (auth.users FK)
- role: enum('student','teacher')
- approved: boolean
- name, grade, class_no, student_no
- created_at, updated_at

events
- id
- owner_id (profiles.id)
- date (YYYY-MM-DD)
- category (text)
- title (필수)
- description (선택)
- duration_min (int)
- created_at, updated_at

absences
- id
- student_id (profiles.id)
- date
- reason
- status: enum('pending','approved','rejected')
- created_at, updated_at

- auth.users → profiles 자동 생성 trigger 존재
- updated_at 자동 갱신 trigger 존재
- RLS 전부 활성화
- is_teacher() helper function 존재
- role / approved 변경 차단 trigger 존재

============================================================
[RLS / 권한 규칙 (확정)]
============================================================

is_teacher()
- role='teacher' AND approved=true

profiles
- select/update: 본인 OR 승인된 teacher
- role / approved:
  - teacher만 변경 가능
  - 학생은 DB 트리거로 변경 차단

events
- 학생: owner_id = auth.uid() 인 것만 CRUD
- teacher: 전체 select 가능 (수정/삭제 불가)

absences
- 학생
  - insert 가능 (date, reason만)
  - status 변경 불가
- teacher
  - 전체 select 가능
  - update는 status만 가능
  - date / reason / student_id 변경 불가

============================================================
[프론트 권한 흐름 (확정)]
============================================================

핵심 훅: useMyProfile()

1) supabase.auth.getSession()
2) profiles 조회
   - id, role, approved, name, grade, class_no, student_no
3) 승인/role은 update payload에 포함 금지

추가
- auth state change 시 재조회
- 포커스 복귀 시 재조회
- approved 변경 즉시 반영

============================================================
[ProtectedRoute 규칙 (확정)]
============================================================

ProtectedRoute({ allowRole })

1) loading → Loading
2) !session → /login
3) !profile → /login
4) !approved → /pending
5) role mismatch
   - teacher → /teacher
   - student → /student/calendar

============================================================
[라우팅 구조 (확정)]
============================================================

/login
/auth/callback
/pending

/student/calendar
/student/absence
/student/profile
/student/profile/edit

/teacher → /teacher/students
/teacher/students
/teacher/calendar/:studentId
/teacher/absences
/teacher/profile
/teacher/profile/edit

============================================================
[결석 UI 규칙 — TeacherAbsences 최신]
============================================================

- 기본 정렬: created_at DESC (요청일 최신순)
- 초기 sortKey = CREATED
- 초기 asc = false
- 요청일(created_at) 컬럼 테이블에 표시
- DB 변경 없이 프론트 포맷만 적용

============================================================
[구현 완료]
============================================================

- StudentCalendar
- TeacherStudents
- TeacherCalendar
- TeacherAbsences (요청일 컬럼 + 최신순)
- MyProfile / Edit
- Header / Layout

============================================================
[절대 금지]
============================================================

- Auth / RLS / 승인 흐름 변경
- DB 구조 변경
- ProtectedRoute 우회
- Tailwind / UI 라이브러리
- 다른 CSS 시스템 도입
- 설명 순서 위반

============================================================

이 문서는 단일 진실 원본이다.
다음 작업은 이 문서를 전제로 한다.

END OF GUIDE
