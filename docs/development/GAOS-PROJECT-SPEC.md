# GAMS Project Specification

> ข้อกำหนดและ business rules ของระบบ — สำหรับ tech stack/API ดู `README.md`

---

## 1. Overview

GAMS เป็นระบบประเมินผลแบบกลุ่มสำหรับรายวิชาระดับมหาวิทยาลัย รองรับ 3 บทบาท และรันผ่าน Docker Compose

---

## 2. Authentication

- ผู้ใช้ login ด้วย Username + Password → Backend ตรวจสอบกับ **MySQL** โดยตรง
- เมื่อผ่านการตรวจสอบ → Backend ออก JWT + โหลด role/profile/nickname จาก MySQL
- Frontend เก็บ JWT และส่งทุก request ผ่าน `Authorization: Bearer <token>`

| Role    | Username        | Password        |
| ------- | --------------- | --------------- |
| Student | studentId       | citizenId       |
| Teacher | email           | citizenId       |
| Admin   | ตามที่ seed ไว้ | ตามที่ seed ไว้ |

> Role, status, และ profile เก็บใน MySQL ไม่ใช่ใน FreeRADIUS

---

## 3. Roles & Permissions

| Role        | สิ่งที่ทำได้                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------------- |
| **Admin**   | จัดการนักศึกษา/อาจารย์ (CRUD), เลื่อนชั้นปีทั้งหมด, ลบทั้งหมด                                   |
| **Teacher** | สร้างกิจกรรม, กำหนดเกณฑ์, เพิ่มผู้ร่วมให้คะแนน, ให้เกรดทีละกลุ่ม, ดูรายชื่อนักศึกษา (read-only) |
| **Student** | สร้าง/แก้ไข/ลบกลุ่ม, ดูกิจกรรมที่เปิดรับ, ดูคะแนน/เกรด/ความคิดเห็น                              |

---

## 4. Admin Features

### จัดการนักศึกษา

- ข้อมูล: fullName, nickname, studentId, citizenId, yearLevel (1-4), entryYear
- แสดงตามชั้นปี (paginated) + ส่วน "จบการศึกษา" แยก
- ค้นหาด้วย studentId หรือ fullName
- **เพิ่ม / แก้ไข / ลบ** นักศึกษารายคน
- ลบทั้งหมด หรือ **ลบเฉพาะชั้นปี** (รวมถึง "จบการศึกษา")
- เลื่อนชั้นปีทั้งหมด หรือ **เลื่อนชั้นเฉพาะปี** (ปี 1-4 → +1, ปี 4 → จบ)

### จัดการอาจารย์

- ข้อมูล: fullName, nickname, citizenId, email (ใช้เป็น username)
- ค้นหาด้วย email หรือ fullName
- **เพิ่ม / แก้ไข / ลบ** อาจารย์รายคน (แก้ไข email จะ sync username ใน users table)

### ภาพรวมกิจกรรม (Read-only)

- ดูกิจกรรมทั้งหมดในระบบ (paginated)
- ค้นหาตามชื่อกิจกรรม หรือกรองตาม teacherId
- ดูรายละเอียด: criteria, graders, groups + members ของแต่ละกิจกรรม

### Bulk Actions & Constraints

- ทุก destructive action ต้องมี confirm modal ก่อนดำเนินการ
- Admin ไม่มีสิทธิ์สร้าง แก้ไข หรือลบกิจกรรม

---

## 5. Teacher Workflow

### สร้างกิจกรรม

- ข้อมูล: title, description, startDate, endDate
- targetYearLevels: กำหนดว่านักศึกษาปีไหนเห็นกิจกรรมนี้ (JSON array)
- เกณฑ์การให้คะแนน (criteria): เพิ่ม/ลบได้หลายเกณฑ์ แต่ละเกณฑ์มี name + weight
- ผู้ร่วมให้คะแนน (graders): เลือกอาจารย์ท่านอื่นให้ช่วยให้คะแนน

### ให้คะแนน (Grading)

- เลือก letter grade (A, B+, B, C+, C, D+, D, F) ต่อกลุ่มต่อเกณฑ์
- เขียน comment ต่อกลุ่ม (optional)
- บันทึกเป็น **Draft** ได้ตลอด (นักศึกษาไม่เห็น)
- กด **ส่งเพื่ออนุมัติ** → บันทึกทุกกลุ่มอัตโนมัติแล้ว submit → ล็อคและแสดงให้นักศึกษา
- ปุ่ม "ส่งเพื่ออนุมัติ" หายไปหลัง submit สำเร็จ

### สิทธิ์

- ลบกิจกรรม: เฉพาะอาจารย์ที่สร้างกิจกรรม
- แต่ละ grader ให้คะแนนอิสระของตนเอง (แยก status ต่อ teacher)
- ดูรายชื่อนักศึกษา: read-only ทุก teacher

---

## 6. Student Workflow

### ดูกิจกรรม

- แสดงเฉพาะกิจกรรมที่ตรงกับ yearLevel ของนักศึกษา
- เรียงตาม createdAt DESC โดย **กิจกรรมที่ยังไม่มีกลุ่มขึ้นมาก่อน**
- ปุ่ม "สร้างกลุ่ม" หายไปถ้ามีกลุ่มในกิจกรรมนั้นแล้ว

### จัดการกลุ่ม

- สร้างกลุ่ม: ต้องเลือกกิจกรรม + ตั้งชื่อกลุ่ม + description + สมาชิก
- **นักศึกษาอยู่ได้เพียง 1 กลุ่มต่อ 1 กิจกรรม** (backend enforce)
- แก้ไข/ลบกลุ่ม: เฉพาะคนที่สร้างกลุ่ม
- ทุก destructive action ต้องมี confirm modal

### ดูคะแนน (Dashboard)

- แสดงเฉพาะเกรดที่ **Submitted** แล้ว (Draft ไม่แสดง)
- Stats: จำนวนกิจกรรม, กิจกรรมที่ได้รับคะแนน, GPA เฉลี่ย
- ตารางสรุป: กิจกรรม, กลุ่ม, GPA, เกรด, สถานะ
- รายละเอียดต่อกิจกรรม: คะแนนรายเกณฑ์, ความคิดเห็นอาจารย์

---

## 7. Grade System

Grades are stored as letter strings (`A`, `B+`, `B`, `C+`, `C`, `D+`, `D`, `F`).

| Grade | GPA Points | Threshold (for averages) |
| ----- | ---------- | ------------------------ |
| A     | 4.00       | >= 3.75                  |
| B+    | 3.50       | >= 3.25                  |
| B     | 3.00       | >= 2.75                  |
| C+    | 2.50       | >= 2.25                  |
| C     | 2.00       | >= 1.75                  |
| D+    | 1.50       | >= 1.25                  |
| D     | 1.00       | >= 0.50                  |
| F     | 0.00       | < 0.50                   |

**การคำนวณ GPA:**

1. Letter grade → GPA point
2. เฉลี่ย GPA ต่อเกณฑ์ (จากทุก teacher ที่ submit)
3. GPA รวม = weighted average ทุกเกณฑ์
4. GPA รวม → letter grade (ตาม threshold)

---

## 8. Business Rules & Constraints

- ทุก action ที่ลบหรือ submit ต้องมี **confirm modal**
- Grade ที่ยัง draft ไม่แสดงให้นักศึกษาเห็น
- RADIUS ตั้งค่า Cleartext สำหรับ development (ต้องเปลี่ยนใน production)
- ต้องเปลี่ยน `JWT_SECRET` และ `MYSQL_ROOT_PASSWORD` ก่อน deploy production
- ระบบใช้ Thai GPA standard เท่านั้น (ไม่มี S, A+, หรือคะแนนเป็นตัวเลข)
- `grades.score` เก็บเป็น VARCHAR(10) ไม่ใช่ตัวเลข
- `activities.targetYearLevels` เป็น JSON column
- ทุก foreign key ใช้ `ON DELETE CASCADE`

---

Last Updated: February 25, 2026
