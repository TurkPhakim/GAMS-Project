# GAMS Implementation Summary

> Developer architecture notes — สำหรับ API reference ดู `README.md`, สำหรับ file listing ดู `FILE_MANIFEST.md`

---

## What's Built

### Backend (Express.js)

- **Auth**: RADIUS + JWT login, loads nickname from students/teachers table
- **Admin**: Student/teacher full CRUD (add, update, delete), bulk delete, delete-by-year, promote-all and promote-by-year, paginated search, read-only activity overview (search/filter by teacher)
- **Teacher**: Activity management, multi-teacher grading (letter grades → GPA), submission, progress dashboard
- **Student**: Group CRUD, available activities (smart sort), score dashboard (GPA calculation)

### Frontend (Angular 17)

- **Core services**: AuthService (JWT), AdminService, TeacherService, StudentService, ModalService (confirm/success/error), BreadcrumbService
- **Route guards**: AuthGuard, RoleGuard
- **Shared components**: HeaderComponent (nickname display), ModalComponent (global)
- **19 page components** across Admin, Teacher, Student roles
- **Admin manage** has 3 sections: จัดการนักศึกษา / จัดการอาจารย์ / ภาพรวมกิจกรรม (read-only)
- **Inline edit dialogs** for student and teacher (student-add-form, teacher-add-form support create & edit mode)
- **Teacher student list**: per-year pagination (same as Admin, read-only — no edit/delete actions)
- **Teacher activities list**: page title header + ชั้นปี column (parsed from `targetYearLevels` JSON) + paginated 10/page
- **Student activities**: "ดูคะแนน" opens inline score dialog (overall GPA + per-criterion + teacher comments) instead of navigating to dashboard
- **Teacher grading**: groups added after submission remain gradeable (`gradedGroupIds` tracks pre-submission groups); badge shows "รอให้คะแนน"/"ให้คะแนนแล้ว" based on actual grading completion; form fully reloads after submit
- **Login error**: uses `modalService.showError()` — no inline error div binding

### Infrastructure

- 5 Docker services: MySQL, phpMyAdmin, FreeRADIUS, Backend, Frontend
- Database auto-initializes from `schema.sql` + `seed.sql` on first run
- nginx reverse proxy routes `/api/` to backend — no CORS issues, single port exposure

---

## Grade Calculation (Technical)

1. Teacher selects letter grade per criterion per group
2. Letter grade → GPA point (from `grading_scale` table)
3. If multiple teachers submitted: average GPA points per criterion
4. Weighted average across criteria = overall GPA
5. Overall GPA → final letter grade (threshold table)

```
GPA >= 3.75 → A   |   >= 2.75 → B   |   >= 1.75 → C   |   >= 0.50 → D
GPA >= 3.25 → B+  |   >= 2.25 → C+  |   >= 1.25 → D+  |   < 0.50  → F
```

**Key detail:** `mysql2` returns DECIMAL as strings — use `parseFloat()` when calculating weighted totals.

---

## Key Implementation Notes

- **Auto-save on submit**: `submitForApproval()` calls `forkJoin(saveRequests)` first, then submits; uses `of([])` for empty groups; after success calls `loadGradingData()` to reload full state
- **Breadcrumb submit button**: `updateBreadcrumbButtons()` shows "ส่งเพื่ออนุมัติ" if `submissionStatus !== 'submitted' || hasUnlockedGroups()` — button reappears when new groups are added after submission
- **Smart activity sort**: `ORDER BY CASE WHEN (has_group subquery) IS NULL THEN 0 ELSE 1 END ASC, createdAt DESC`
- **Multi-teacher grading**: `getActivities()` JOINs `activity_graders` so non-creator graders see assigned activities
- **Conditional create button**: `student-activities` hides "สร้างกลุ่ม" when `activity.hasGroup === true`
- **Post-submit grading**: `gradedGroupIds: Set<number>` populated from `existingGrades` (score !== ''); `isGroupLocked(groupId)` = `submitted && gradedGroupIds.has(id)` — new groups remain editable; textarea and select use `isGroupLocked()` not global `submissionStatus`
- **Grading badge**: `isAllGraded()` checks every group has all criteria filled — shows "ให้คะแนนแล้ว" (green) / "รอให้คะแนน" (white/orange) — independent of submission status
- **Score dialog**: `getDashboardByActivity(activityId)` → `GET /api/student/dashboard/:activityId`; comments JOIN teachers for `teacherName`
- **Year levels column**: `getYearLevels(activity)` parses `targetYearLevels` JSON field (handles string or array); displays "ปี x" badges or "ทุกชั้นปี"
- **Login error modal**: error callback calls `modalService.showError()` — no `this.error` property in template
- **Docker rebuild**: must use `--no-cache` flag — `docker compose build --no-cache frontend && docker compose up -d frontend`

Last Updated: February 25, 2026
