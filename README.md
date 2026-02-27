# GAMS - Group-Based Grading Web Application

ระบบจัดการการประเมินผลแบบกลุ่มสำหรับรายวิชาระดับมหาวิทยาลัย รองรับ 3 บทบาท: **Admin** (จัดการผู้ใช้), **Teacher** (สร้างกิจกรรม + ให้คะแนน), **Student** (สร้างกลุ่ม + ดูเกรด)

## Tech Stack

| Layer    | Technology                |
| -------- | ------------------------- |
| Frontend | Angular 17 + Tailwind CSS |
| Backend  | Node.js + Express.js      |
| Database | MySQL 8.0                 |
| Auth     | MySQL + JWT               |
| DevOps   | Docker Compose + nginx    |

## Quick Setup (Local Development)

```bash
cd "GAMS Project"
docker compose up -d --build
```

- Frontend: http://localhost:4300
- Backend API: http://localhost:3000/api
- phpMyAdmin: http://localhost:8888

## Production (Server มหาวิทยาลัย)

- URL: https://172.16.10.201
- phpMyAdmin: https://172.16.10.201/db-gaos-kmitl-2026/ (เฉพาะ subnet 172.16.0.0/20)
- nginx reverse proxy: port 80/443 เท่านั้น (backend และ MySQL ไม่เปิด port สู่ภายนอก)

> ดูรายละเอียดการ deploy ที่ `docs/deployment/QUICK_START.md`

---

## API Endpoints

### Auth

| Method | Path              | Description                           |
| ------ | ----------------- | ------------------------------------- |
| POST   | `/api/auth/login` | Login (returns JWT + role + nickname) |

### Admin (`role: admin`)

| Method | Path                                     | Description                           |
| ------ | ---------------------------------------- | ------------------------------------- |
| GET    | `/api/admin/students`                    | Students grouped by year (paginated)  |
| GET    | `/api/admin/students/graduated`          | Graduated students (paginated)        |
| GET    | `/api/admin/students/search`             | Search students                       |
| POST   | `/api/admin/students`                    | Add student                           |
| PUT    | `/api/admin/students/:id`                | Update student                        |
| DELETE | `/api/admin/students/:id`                | Delete student                        |
| DELETE | `/api/admin/students`                    | Delete all students                   |
| DELETE | `/api/admin/students/year/:yearLevel`    | Delete all students by year level     |
| POST   | `/api/admin/students/promote`            | Promote all students one year         |
| POST   | `/api/admin/students/promote/:yearLevel` | Promote students of specific year     |
| GET    | `/api/admin/teachers`                    | All teachers                          |
| GET    | `/api/admin/teachers/search`             | Search teachers                       |
| POST   | `/api/admin/teachers`                    | Add teacher                           |
| PUT    | `/api/admin/teachers/:id`                | Update teacher                        |
| DELETE | `/api/admin/teachers/:id`                | Delete teacher                        |
| GET    | `/api/admin/activities`                  | All activities (read-only, paginated) |
| GET    | `/api/admin/activities/search`           | Search activities by title / teacher  |

### Teacher (`role: teacher`)

| Method | Path                                   | Description                         |
| ------ | -------------------------------------- | ----------------------------------- |
| GET    | `/api/teacher/activities`              | Own activities (paginated, search)  |
| POST   | `/api/teacher/activities`              | Create activity                     |
| GET    | `/api/teacher/activities/:id`          | Activity detail                     |
| DELETE | `/api/teacher/activities/:id`          | Delete activity (creator only)      |
| GET    | `/api/teacher/activities/:id/groups`   | Groups for an activity              |
| GET    | `/api/teacher/activities/:id/progress` | Activity progress dashboard         |
| GET    | `/api/teacher/activities/:id/grading`  | Grading data                        |
| POST   | `/api/teacher/activities/:id/grades`   | Save grades (draft)                 |
| POST   | `/api/teacher/activities/:id/submit`   | Submit grades for approval          |
| GET    | `/api/teacher/teachers`                | All teachers (for grader selection) |
| GET    | `/api/teacher/students`                | Students by year (read-only)        |
| GET    | `/api/teacher/students/search`         | Search students                     |

### Student (`role: student`)

| Method | Path                                 | Description                                         |
| ------ | ------------------------------------ | --------------------------------------------------- |
| GET    | `/api/student/activities`            | Available activities (no-group first, newest first) |
| GET    | `/api/student/students`              | Students list (for group member selection)          |
| GET    | `/api/student/groups`                | Own groups                                          |
| POST   | `/api/student/groups`                | Create group                                        |
| PUT    | `/api/student/groups/:id`            | Update group                                        |
| DELETE | `/api/student/groups/:id`            | Delete group                                        |
| GET    | `/api/student/dashboard`             | Score dashboard (all activities)                    |
| GET    | `/api/student/dashboard/:activityId` | Scores for specific activity                        |

---

## Database Schema (12 Tables)

| Table                      | Description                                           |
| -------------------------- | ----------------------------------------------------- |
| `users`                    | Auth identity (admin/teacher/student)                 |
| `students`                 | Student profiles (studentId, yearLevel, nickname)     |
| `teachers`                 | Teacher profiles (email used as username)             |
| `activities`               | Grading activities (title, dates, target year levels) |
| `criteria`                 | Grading criteria per activity (with weight)           |
| `activity_graders`         | Teachers assigned to grade each activity              |
| `groups`                   | Student groups per activity                           |
| `group_members`            | Members in each group                                 |
| `grades`                   | Letter grade per criterion per group per teacher      |
| `grader_comments`          | Teacher feedback per group                            |
| `grader_submission_status` | Draft/Submitted state per teacher per activity        |
| `grading_scale`            | Letter grade ↔ GPA point mapping                      |

---

## Grade System (Thai University Standard)

| Grade | GPA  | Threshold for averages |
| ----- | ---- | ---------------------- |
| A     | 4.00 | >= 3.75                |
| B+    | 3.50 | >= 3.25                |
| B     | 3.00 | >= 2.75                |
| C+    | 2.50 | >= 2.25                |
| C     | 2.00 | >= 1.75                |
| D+    | 1.50 | >= 1.25                |
| D     | 1.00 | >= 0.50                |
| F     | 0.00 | < 0.50                 |

**Calculation:** Letter grades → GPA points → weighted average per criterion → overall GPA → final letter grade. When multiple teachers grade, their GPA values are averaged before converting back to a letter grade.

**Grading workflow:** Teacher selects grades per group → saves as draft → clicks **ส่งเพื่ออนุมัติ** (auto-saves all groups then submits in one step) → button disappears after submission → students see results.

---

## Architecture

```
[Browser] → nginx (port 443 HTTPS)
              ├── /         → Angular 17 SPA (static files)
              ├── /api/     → Express.js backend (port 3000, internal)
              └── /db-gaos-kmitl-2026/ → phpMyAdmin (internal, IP restricted)

Backend (Express.js)        Database (MySQL 8.0)
├── Auth (MySQL + JWT)      └── 12 tables
├── Admin (17 endpoints)        DB user: gams_app (SELECT/INSERT/UPDATE/DELETE only)
├── Teacher (12 endpoints)
└── Student (8 endpoints)
```

**Local development:** Frontend port 4300, Backend port 3000, phpMyAdmin port 8888 (ไม่ผ่าน nginx)

---

## Documentation

| หมวดหมู่ | ไฟล์ |
| -------- | ---- |
| Deploy & Operate | [docs/deployment/QUICK_START.md](docs/deployment/QUICK_START.md) |
| Production Server Setup | [docs/deployment/SERVER_SETUP.md](docs/deployment/SERVER_SETUP.md) |
| File Listing | [docs/deployment/FILE_MANIFEST.md](docs/deployment/FILE_MANIFEST.md) |
| API Reference | [docs/development/API_DOCUMENTATION.md](docs/development/API_DOCUMENTATION.md) |
| Developer Notes | [docs/development/IMPLEMENTATION_SUMMARY.md](docs/development/IMPLEMENTATION_SUMMARY.md) |
| Project Spec | [docs/development/GAOS-PROJECT-SPEC.md](docs/development/GAOS-PROJECT-SPEC.md) |
| Web Server (มิติ 3) | [docs/server-management/WEB_SERVER_MANAGEMENT.md](docs/server-management/WEB_SERVER_MANAGEMENT.md) |
| Database (มิติ 4) | [docs/server-management/DATABASE_MANAGEMENT.md](docs/server-management/DATABASE_MANAGEMENT.md) |
| Presentation (ทุกมิติ) | [docs/presentation/PRESENTATION_OVERVIEW.md](docs/presentation/PRESENTATION_OVERVIEW.md) |
| User Manual (Thai) | [docs/user/USER_GUIDE.md](docs/user/USER_GUIDE.md) |

---

Last Updated: February 28, 2026
