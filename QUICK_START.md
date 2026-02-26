# GAMS Quick Start Guide

> คู่มือ Deploy และ Operate ระบบ — สำหรับ Feature ของระบบดู `USER_GUIDE.md`

---

## Prerequisites

- Docker Desktop (Windows/Mac) หรือ Docker Engine (Linux)
- RAM อย่างน้อย 4GB
- ใช้คำสั่ง `docker compose` (เว้นวรรค) ไม่ใช่ `docker-compose` (ขีด)

---

## Start / Stop

```bash
# ครั้งแรก (build + start)
docker compose up -d --build

# ครั้งถัดไป (ไม่ได้แก้โค้ด)
docker compose up -d

# หลังแก้โค้ด — ต้องใช้ --no-cache เสมอ (ไม่งั้น Docker ใช้ cache เก่าไม่ compile ใหม่)
docker compose build --no-cache frontend && docker compose up -d frontend
docker compose build --no-cache backend && docker compose up -d backend

# rebuild พร้อมกันทั้งสองอย่าง
docker compose build --no-cache frontend backend && docker compose up -d frontend backend

# หยุด (ข้อมูล DB ยังอยู่)
docker compose down

# หยุด + ลบ DB ทั้งหมด (reset)
docker compose down -v
```

---

## URLs & Credentials

| Service     | URL                       |
| ----------- | ------------------------- |
| Frontend    | http://localhost:4300     |
| Backend API | http://localhost:3000/api |
| phpMyAdmin  | http://localhost:8888     |

| Role    | Username                   | Password        |
| ------- | -------------------------- | --------------- |
| Admin   | `Admin`                    | `p@ssw0rd`      |
| Teacher | `testTeacher123@gmail.com` | `1111111111111` |
| Student | `1234568`                  | `2222222222222` |

> Port สามารถเปลี่ยนได้ผ่านไฟล์ `.env` (เช่น `FRONTEND_PORT=80`)

---

## Common Commands

```bash
# เช็คสถานะ service ทั้งหมด (ควรเป็น Up / healthy)
docker compose ps

# ดู logs
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f mysql

# Restart เฉพาะ service
docker compose restart backend

# เช็ค resource usage
docker stats
```

---

## Deploy บน Ubuntu Server (มหาวิทยาลัย)

```bash
# 1. ติดตั้ง Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER && newgrp docker

# 2. Copy โปรเจคขึ้น server
scp -r "GAMS Project" user@server-ip:/home/user/gams-project

# 3. สร้าง .env จาก template แล้วแก้ให้ครบ (สำคัญมาก!)
cd /home/user/gams-project
cp .env.example .env
nano .env

# 4. Build + Start
docker compose up -d --build
```

### Security Checklist ก่อนขึ้น Server

| รายการ             | ค่าที่ต้องเปลี่ยน                                                             | ตัวแปรใน .env         |
| ------------------ | ----------------------------------------------------------------------------- | --------------------- |
| **MySQL Password** | รหัสผ่านที่ปลอดภัย (ไม่ใช้ค่า default)                                        | `MYSQL_ROOT_PASSWORD` |
| **JWT Secret**     | random string ยาว 64+ ตัวอักษร                                                | `JWT_SECRET`          |
| **RADIUS Secret**  | ต้องตรงกับ RADIUS server ของมหาวิทยาลัย                                       | `RADIUS_SECRET`       |
| **Frontend Port**  | ถ้าใช้ port 80 ตั้ง `FRONTEND_PORT=80`                                        | `FRONTEND_PORT`       |
| **phpMyAdmin**     | comment service ออกใน `docker-compose.yml` หากไม่ต้องการ expose บน production | -                     |

> **หมายเหตุ FreeRADIUS**: ค่าเริ่มต้นในระบบใช้ `freeradius/freeradius-server` image (config ทดสอบ, secret = `testing123`) สำหรับ production ต้องแก้ไขไฟล์ใน `docker/freeradius/` ให้ชี้ไปที่ RADIUS server จริงของมหาวิทยาลัย หรือเปลี่ยน `RADIUS_SECRET` ให้ตรงกัน

---

## Troubleshooting

**MySQL Exited:**

```bash
docker compose logs mysql
docker compose down -v && docker compose up -d --build
```

**Frontend แสดงข้อมูลเก่า / โค้ดใหม่ไม่ขึ้น:**

```bash
# Docker cache ทำให้ Angular ไม่ recompile — ต้องใช้ --no-cache เสมอ
docker compose build --no-cache frontend && docker compose up -d frontend
```

**Frontend Exited:**

```bash
docker compose logs frontend
docker compose build --no-cache frontend && docker compose up -d frontend
```

**Port ถูกใช้งานแล้ว:**

```bash
sudo lsof -i :4300   # เช็คว่า process ไหนใช้ port อยู่
# แก้ port ใน .env แทน
```

**Login ไม่ผ่าน "User not found":** รอ 30-60 วิให้ DB initialize แล้ว refresh

**คะแนนไม่แสดง:** อาจารย์ต้องกด "ส่งเพื่ออนุมัติ" ก่อน (draft ไม่แสดงให้นักศึกษา)

---

## Development Mode (ไม่ใช้ Docker)

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend
cd frontend && npm install && npm start
```

---

Last Updated: February 25, 2026 (v2)
