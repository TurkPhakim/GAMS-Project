# GAMS Project - Complete File List

## Project Root

- **docker-compose.yml** - Full stack orchestration (5 services: mysql, phpmyadmin, freeradius, backend, frontend) — ใช้บน Production Server
- **docker-compose.local.yml** - Override สำหรับรันในเครื่องตัวเอง: HTTP-only nginx, disable certbot — ใช้ร่วมกับ `docker-compose.yml` ผ่าน `-f` flag
- **README.md** - Project overview, API endpoints, database schema, architecture
- **.env.example** - Environment variables template
- **nginx/logrotate.conf** - Logrotate config สำหรับวางบน host ที่ `/etc/logrotate.d/gams-nginx`
- **scripts/init-letsencrypt.sh** - Bootstrap SSL certificate ครั้งแรก

---

## Documentation (`docs/`)

### deployment/
- **QUICK_START.md** - คู่มือ deploy และ operate พร้อม production URLs และ troubleshooting
- **SERVER_SETUP.md** - คู่มือ deploy บน Ubuntu Server ฉบับสมบูรณ์ (UFW, SSL, SSH hardening, Fail2Ban, Linux Groups, Backup)
- **FILE_MANIFEST.md** - ไฟล์นี้ รายการไฟล์ทั้งหมดในโปรเจค

### development/
- **API_DOCUMENTATION.md** - API reference ครบถ้วนพร้อมตัวอย่าง request/response
- **IMPLEMENTATION_SUMMARY.md** - Developer architecture notes และ key implementation details
- **GAOS-PROJECT-SPEC.md** - Project specification และ business requirements

### server-management/
- **WEB_SERVER_MANAGEMENT.md** - มิติที่ 3: nginx configuration (HTTPS, logging, reverse proxy, cache, security headers)
- **DATABASE_MANAGEMENT.md** - มิติที่ 4: MySQL tuning, app user, slow query log, phpMyAdmin security

### presentation/
- **PRESENTATION_OVERVIEW.md** - สรุปทุกมิติ (1-5 + Backup & DR) สำหรับนำเสนอ

### user/
- **USER_GUIDE.md** - คู่มือการใช้งานระบบ GAMS (ภาษาไทย)

---

## Database (`database/`)

- **schema.sql** - Complete database schema (12 tables)
- **seed.sql** - Initial data: admin user, grading scale
- **03-create-app-user.sh** - Script สร้าง MySQL app user `gams_app` สิทธิ์จำกัด (รันอัตโนมัติตอน MySQL first-init)

---

## Backend (`backend/`)

### Configuration
- **package.json** - Dependencies and scripts
- **Dockerfile** - Docker image for backend

### Source Code (`src/`)

#### Main
- **server.js** - Express server setup and route mounting

#### Configuration (`config/`)
- **database.js** - MySQL connection pool (ใช้ `gams_app` user ไม่ใช่ root)
- **jwt.js** - JWT token generation and verification

#### Middleware (`middleware/`)
- **auth.js** - JWT authentication middleware
- **rbac.js** - Role-based access control middleware

#### Routes (`routes/`)
- **auth.js** - Authentication endpoints (1 endpoint)
- **admin.js** - Admin API routes (17 endpoints)
- **teacher.js** - Teacher API routes (12 endpoints)
- **student.js** - Student API routes (8 endpoints)

#### Controllers (`controllers/`)
- **auth.js** - Login logic: MySQL validation → JWT + role + nickname
- **admin.js** - Student/teacher management (CRUD, bulk ops, promote by year, activity overview)
- **teacher.js** - Activity creation, grading, group management, submission, progress dashboard
- **student.js** - Group CRUD, score aggregation, GPA calculation, dashboard

#### Services (`services/`)
- **radius.js** - FreeRADIUS service (container สำหรับ compatibility — auth จริงใช้ MySQL)

#### Utilities (`utils/`)
- **user.js** - User profile helper functions

---

## Frontend (`frontend/`)

### Configuration
- **package.json** - Dependencies (Angular 17, Tailwind CSS)
- **Dockerfile** - Multi-stage build: Node.js compile → nginx serve
- **nginx.conf** - nginx config สำหรับ Production: HTTPS, reverse proxy, proxy cache, worker tuning, security headers, logging
- **nginx.local.conf** - nginx config สำหรับ Local Development: HTTP-only (ไม่มี SSL), ไม่มี IP restriction สำหรับ phpMyAdmin

### Source Code (`src/app/`)

#### Core (`core/`)
- **auth.service.ts** - JWT management, login, logout, role checking
- **admin.service.ts** - Admin API calls
- **teacher.service.ts** - Teacher API calls
- **student.service.ts** - Student API calls
- **modal.service.ts** - Global modal (confirm, success, error)
- **breadcrumb.service.ts** - Dynamic breadcrumb + action buttons

#### Guards (`guards/`)
- **auth.guard.ts** - Redirect to login if not authenticated
- **role.guard.ts** - Redirect if wrong role

#### Pages (`pages/`) — 19 components
- **login.component** - Login page (studentId/citizenId หรือ email/citizenId)
- **admin-dashboard.component** - Admin home
- **admin-manage.component** - จัดการนักศึกษา / อาจารย์ / ภาพรวมกิจกรรม
- **teacher-dashboard.component** - Teacher home
- **teacher-activities-list.component** - รายการกิจกรรมของอาจารย์
- **teacher-activity-detail.component** - รายละเอียดกิจกรรม
- **teacher-create-activity.component** - สร้างกิจกรรมใหม่
- **teacher-grading.component** - ให้คะแนนกลุ่ม
- **teacher-progress.component** - Dashboard ความคืบหน้า
- **teacher-students.component** - รายชื่อนักศึกษา (read-only)
- **student-dashboard.component** - Student home
- **student-activities.component** - กิจกรรมที่เปิดรับ
- **student-groups.component** - กลุ่มของนักศึกษา
- **student-score-dashboard.component** - ดูคะแนนและเกรด

#### Shared (`shared/`)
- **header.component** - Navbar พร้อม nickname และ logout
- **modal.component** - Global modal dialog

---

## nginx (`nginx/`)

- **logrotate.conf** - Logrotate config: หมุนเวียน gams-access.log + gams-error.log ทุกวัน เก็บ 14 วัน บีบอัดไฟล์เก่า

---

## phpMyAdmin (`phpmyadmin/`)

- **config.user.inc.php** - phpMyAdmin config: `AllowRoot=false`, `AllowNoPassword=false`

---

Last Updated: February 28, 2026
