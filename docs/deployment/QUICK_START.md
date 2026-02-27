# GAMS Quick Start Guide

> คู่มือ Deploy และ Operate ระบบ — สำหรับ Feature ของระบบดู `docs/user/USER_GUIDE.md`

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

# หยุด (ข้อมูล DB ยังอยู่)
docker compose down

# หยุด + ลบ DB ทั้งหมด (reset)
docker compose down -v
```

---

## URLs & Credentials

### Local Development

| Service     | URL                       |
| ----------- | ------------------------- |
| Frontend    | http://localhost:4300     |
| Backend API | http://localhost:3000/api |
| phpMyAdmin  | http://localhost:8888     |

### Production Server (172.16.10.201)

| Service     | URL                                                                      |
| ----------- | ------------------------------------------------------------------------ |
| Frontend    | https://172.16.10.201                                                    |
| Backend API | https://172.16.10.201/api (ผ่าน nginx reverse proxy)                    |
| phpMyAdmin  | https://172.16.10.201/db-gaos-kmitl-2026/ (subnet มหาวิทยาลัยเท่านั้น) |

### Test Credentials

| Role    | Username                   | Password        |
| ------- | -------------------------- | --------------- |
| Admin   | `Admin`                    | `p@ssw0rd`      |
| Teacher | `testTeacher123@gmail.com` | `1111111111111` |
| Student | `1234568`                  | `2222222222222` |

> Login: **นักศึกษา** ใช้ studentId + citizenId | **อาจารย์** ใช้ email + citizenId

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

> คู่มือฉบับสมบูรณ์พร้อม SSL, Firewall, SSH Hardening, Backup ดูที่ [docs/deployment/SERVER_SETUP.md](SERVER_SETUP.md)

**ขั้นตอนย่อ:**

```bash
# 1. ติดตั้ง Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER && newgrp docker

# 2. Clone โปรเจคขึ้น server
git clone <repo-url> ~/www/GAMS-Project
cd ~/www/GAMS-Project

# 3. สร้าง .env จาก template แล้วแก้ให้ครบ (สำคัญมาก!)
cp .env.example .env
nano .env

# 4. ตั้งค่า SSL Certificate (เลือก Option ตาม server)
# Option A: มี domain จริง → ./scripts/init-letsencrypt.sh
# Option B: Internal IP เช่น 172.16.10.201 → ดู SERVER_SETUP.md ขั้นตอนที่ 4

# 5. ติดตั้ง logrotate config สำหรับ nginx
sudo cp nginx/logrotate.conf /etc/logrotate.d/gams-nginx

# 6. Build + Start
docker compose up -d --build
```

---

## Security Checklist ก่อนขึ้น Server

| รายการ | ค่าที่ต้องเปลี่ยน | ตัวแปรใน .env |
| ------ | --------------- | ------------- |
| **MySQL Root Password** | รหัสผ่านที่ปลอดภัย (ไม่ใช้ค่า default) | `MYSQL_ROOT_PASSWORD` |
| **MySQL App Password** | รหัสผ่านแยกสำหรับ gams_app user | `MYSQL_APP_PASSWORD` |
| **JWT Secret** | random string ยาว 64+ ตัวอักษร | `JWT_SECRET` |
| **Domain** | hostname หรือ IP ของ server | `DOMAIN` |
| **Admin IP Range** | subnet ที่อนุญาตเข้า phpMyAdmin | `ADMIN_IP_RANGE` |
| **phpMyAdmin Path** | URL path คาดเดายาก | `PMA_SECRET_PATH` |

---

## Log Commands (Production)

```bash
# ดู nginx access log
docker exec gams-frontend tail -f /var/log/nginx/gams-access.log

# ดู nginx error log
docker exec gams-frontend tail -f /var/log/nginx/gams-error.log

# ดู MySQL slow query log
docker exec gams-mysql tail -f /var/log/mysql/slow-query.log

# ดู backend log
docker compose logs -f backend
```

---

## Troubleshooting

**MySQL Exited:**
```bash
docker compose logs mysql
docker compose down -v && docker compose up -d --build
```

**Frontend แสดงข้อมูลเก่า / โค้ดใหม่ไม่ขึ้น:**
```bash
docker compose build --no-cache frontend && docker compose up -d frontend
```

**Frontend Exited:**
```bash
docker compose logs frontend
docker compose build --no-cache frontend && docker compose up -d frontend
```

**Login ไม่ผ่าน "User not found":** รอ 30-60 วิให้ DB initialize แล้ว refresh

**คะแนนไม่แสดง:** อาจารย์ต้องกด "ส่งเพื่ออนุมัติ" ก่อน (draft ไม่แสดงให้นักศึกษา)

**phpMyAdmin 403 Forbidden:** ตรวจสอบว่า IP ของเครื่องอยู่ใน `ADMIN_IP_RANGE` ที่กำหนดใน `.env`

---

## Development Mode (ไม่ใช้ Docker)

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend
cd frontend && npm install && npm start
```

---

Last Updated: February 28, 2026
