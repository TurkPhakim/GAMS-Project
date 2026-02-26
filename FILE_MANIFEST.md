# GAMS Project - Complete File List

## Project Root

- **docker-compose.yml** - Full stack orchestration with 5 services
- **README.md** - Comprehensive project documentation
- **IMPLEMENTATION_SUMMARY.md** - What's done, what's remaining, and recommendations
- **API_DOCUMENTATION.md** - Complete API reference with examples
- **FILE_MANIFEST.md** - This file; complete listing of all project files
- **GAOS-PROJECT-SPEC.md** - Project specification and requirements
- **USER_GUIDE.md** - User manual in Thai (คู่มือการใช้งาน)

---

## Database Directory (`database/`)

### Configuration

- **schema.sql** - Complete database schema with 12 tables
- **seed.sql** - Initial data: admin user, grading scale

---

## Docker Directory (`docker/`)

### FreeRADIUS Configuration

- **freeradius/users/users** - RADIUS user authentication file with test accounts

---

## Backend (`backend/`)

### Configuration

- **package.json** - Dependencies and scripts
- **Dockerfile** - Docker image for backend
- **.env.example** - Environment variables template

### Source Code (`src/`)

#### Main

- **server.js** - Express server setup and route mounting

#### Configuration (`config/`)

- **database.js** - MySQL connection pool setup
- **jwt.js** - JWT token generation and verification
- **radius.js** - RADIUS server configuration

#### Middleware (`middleware/`)

- **auth.js** - JWT authentication middleware
- **rbac.js** - Role-based access control middleware

#### Routes (`routes/`)

- **auth.js** - Authentication endpoints (1 endpoint)
- **admin.js** - Admin API routes (17 endpoints)
- **teacher.js** - Teacher API routes (12 endpoints)
- **student.js** - Student API routes (8 endpoints)

#### Controllers (`controllers/`)

- **auth.js** - Login logic with RADIUS integration + nickname query
- **admin.js** - Student/teacher management (Add, Update, Delete, Search, Bulk operations, promote by year, delete by year, read-only activity overview)
- **teacher.js** - Activity creation, grading (letter grades), group management, submission for approval, deletion, activity progress dashboard
- **student.js** - Group creation/deletion, score aggregation with letter-grade-to-numeric conversion, dashboard logic

#### Services (`services/`)

- **radius.js** - RADIUS authentication service

#### Utilities (`utils/`)

- **user.js** - User profile helper functions

---

## Frontend (`frontend/`)

### Configuration

- **package.json** - Angular dependencies
- **Dockerfile** - Docker image for frontend
- **angular.json** - Angular CLI configuration
- **tsconfig.base.json** - TypeScript base configuration
- **tsconfig.app.json** - TypeScript app configuration
- **.angular.gitignore** - Build artifacts to ignore

### Source Files (`src/`)

#### Index

- **index.html** - HTML entry point with Tailwind CSS CDN
- **main.ts** - Bootstrap Angular application

#### App Module (`app/`)

##### Root

- **app.module.ts** - Module declarations and providers
- **app.component.ts** - Root component
- **app.component.html** - Root template (contains `<router-outlet>` and global `<app-modal>`)
- **app-routing.module.ts** - Route definitions with role-based guards

##### Core Services (`core/`)

- **auth.service.ts** - Authentication, JWT storage, user state management (with nickname)
- **auth.interceptor.ts** - Automatic JWT injection into HTTP requests
- **admin.service.ts** - API calls for admin operations
- **teacher.service.ts** - API calls for teacher activities, grading, submissions
- **student.service.ts** - API calls for student groups, activities, dashboard
- **modal.service.ts** - Centralized modal system (showSuccess, showError, showConfirm with RxJS)
- **breadcrumb.service.ts** - Dynamic breadcrumb navigation service

##### Route Guards (`guards/`)

- **auth.guard.ts** - Enforces login requirement
- **role.guard.ts** - Enforces role-based access control

##### Shared Components (`components/`)

- **header.component.ts** - Global header with user info (nickname display), logout
- **header.component.html** - Header template
- **modal.component.ts** - Global modal component (success/error/confirm dialogs, inline template)

##### Pages (`pages/`)

**Authentication:**

- **login.component.ts** - Login form with credential submission + success modal
- **login.component.html** - Login page template

**Admin:**

- **admin-home.component.ts** - Admin dashboard with navigation cards
- **admin-home.component.html** - Admin dashboard template
- **admin-manage.component.ts** - Full student/teacher/activity management (list, search, add, edit, delete, promote, delete-by-year, activity overview)
- **admin-manage.component.html** - Admin manage template (3 sections: students / teachers / ภาพรวมกิจกรรม)
- **student-add-form.component.ts** - Add/edit student form component (create & edit mode)
- **student-add-form.component.html** - Add/edit student form template
- **teacher-add-form.component.ts** - Add/edit teacher form component (create & edit mode)
- **teacher-add-form.component.html** - Add/edit teacher form template

**Teacher:**

- **teacher-home.component.ts** - Teacher dashboard with navigation
- **teacher-home.component.html** - Teacher dashboard template
- **teacher-activities-list.component.ts** - Activity list with search, pagination (10/page), eye icon for progress, delete (confirm modal)
- **teacher-activities-list.component.html** - Activity list template with search bar and pagination controls
- **teacher-activity-progress.component.ts** - Activity progress dashboard (stats, grader progress, per-group grades)
- **teacher-activity-progress.component.html** - Activity progress template with expandable group cards
- **teacher-create-activity.component.ts** - Activity creation with dynamic criteria and grader selection
- **teacher-create-activity.component.html** - Activity creation form template
- **teacher-grading.component.ts** - Grading interface with letter grade dropdowns, comments, submit for approval
- **teacher-grading.component.html** - Grading interface template
- **teacher-students.component.ts** - Read-only student list by year level with search
- **teacher-students.component.html** - Student list template

**Student:**

- **student-home.component.ts** - Student dashboard with navigation
- **student-home.component.html** - Student dashboard template
- **student-activities.component.ts** - Available activities list for students
- **student-activities.component.html** - Activities list template
- **student-groups.component.ts** - Group management with create/edit dialog, delete (confirm modal)
- **student-groups.component.html** - Groups list template with inline dialog overlay
- **student-create-group.component.ts** - Group create/edit dialog form (inline in groups page)
- **student-create-group.component.html** - Group create/edit form template
- **student-dashboard.component.ts** - Score dashboard (stats, grade table, detailed scores, comments)
- **student-dashboard.component.html** - Score dashboard template

---

Last Generated: February 25, 2026
