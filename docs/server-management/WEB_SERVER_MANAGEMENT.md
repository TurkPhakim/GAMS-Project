# มิติที่ 3: Web Server Management

## ระบบ GAMS — Grade Activity Management System

ระบบ GAMS ใช้ **nginx** เป็น Web Server หลัก ทำหน้าที่รับ request จากผู้ใช้ทุกคน
และกระจายไปยัง service ที่เหมาะสม (Angular frontend, Express backend, phpMyAdmin)

---

## สารบัญ

1. [HTTPS + SSL/TLS Certificate](#1-https--ssltls-certificate)
2. [Logging และ Logrotate](#2-logging-และ-logrotate)
3. [Server Blocks](#3-server-blocks)
4. [Reverse Proxy](#4-reverse-proxy)
5. [Proxy Cache สำหรับ Static Assets](#5-proxy-cache-สำหรับ-static-assets)
6. [Worker Processes Tuning](#6-worker-processes-tuning)
7. [Security Headers](#7-security-headers)
8. [สรุปไฟล์ที่เกี่ยวข้อง](#8-สรุปไฟล์ที่เกี่ยวข้อง)

---

## 1. HTTPS + SSL/TLS Certificate

### ทำอะไร

- nginx บังคับ redirect ทุก request จาก HTTP (port 80) → HTTPS (port 443) อัตโนมัติ
- ติดตั้ง SSL Certificate เพื่อเข้ารหัส traffic ทั้งหมด
- ใช้ Certbot (Let's Encrypt) สำหรับ certificate พร้อม auto-renewal ทุก 12 ชั่วโมง
- รองรับเฉพาะ TLS 1.2 และ 1.3

### ทำไมถึงสำคัญ

การส่งข้อมูลผ่าน HTTP ทำให้ข้อมูลเดินทางเป็น plaintext คนที่อยู่ใน network เดียวกัน
(เช่น Wi-Fi มหาวิทยาลัย) สามารถดักอ่าน JWT token, รหัสผ่าน, คะแนนนักศึกษาได้ทันที

HTTPS เข้ารหัสข้อมูลด้วย TLS ทำให้แม้ถูกดักจับก็อ่านไม่ออก

### ผลลัพธ์ที่ได้

```bash
curl -I http://172.16.10.201
# HTTP/1.1 301 Moved Permanently
# Location: https://172.16.10.201/   ← redirect ไป HTTPS อัตโนมัติ
```

### ไฟล์ที่เกี่ยวข้อง

| ไฟล์                                                          | สิ่งที่ทำ                                                       |
| ------------------------------------------------------------- | --------------------------------------------------------------- |
| [frontend/nginx.conf](../../frontend/nginx.conf)                 | server block port 80 (redirect) + port 443 (HTTPS + SSL config) |
| [scripts/init-letsencrypt.sh](../../scripts/init-letsencrypt.sh) | script สำหรับขอ certificate ครั้งแรก                            |
| [docker-compose.yml](../../docker-compose.yml)                   | certbot service พร้อม auto-renewal loop                         |

> **หมายเหตุปัจจุบัน:** ใช้ self-signed certificate เพราะ Let's Encrypt ต้องการ domain จริง
> และ port 80 เปิดจาก internet ซึ่งยังรอ IT มหาวิทยาลัยเปิด port forwarding อยู่

---

## 2. Logging และ Logrotate

### ทำอะไร

- nginx บันทึก access log ทุก request ไว้ที่ `/var/log/nginx/gams-access.log`
- บันทึก error log ไว้ที่ `/var/log/nginx/gams-error.log`
- ตั้งค่า Logrotate บน host ที่ `/etc/logrotate.d/gams-nginx` หมุนเวียน log ทุกวัน เก็บ 14 วัน พร้อมบีบอัดไฟล์เก่า

### ทำไมถึงสำคัญ

Log บันทึกข้อมูลสำคัญทุก request เช่น IP ผู้เข้าใช้, เวลา, request ที่ทำ, status code
ใช้สำหรับ:

- **ตรวจสอบย้อนหลัง (Audit)** — ดูว่าใครเข้ามาทำอะไร เมื่อไหร่
- **รับมือเหตุการณ์ (Incident Response)** — ถ้าโดน attack มีหลักฐานให้สืบสวน
- **Debug** — ดู error ที่เกิดจริงบน production

ถ้าไม่มี Logrotate → log ไฟล์โตไม่หยุด → disk เต็ม → server crash

### ผลลัพธ์ที่ได้

```bash
docker exec gams-frontend tail -5 /var/log/nginx/gams-access.log
# 172.16.10.201 - - [27/Feb/2026:08:17:03 +0000] "GET / HTTP/2.0" 200 11676 ...

cat /etc/logrotate.d/gams-nginx
# daily, rotate 14, compress, postrotate: nginx -s reopen
```

### ไฟล์ที่เกี่ยวข้อง

| ไฟล์                                            | สิ่งที่ทำ                                                 |
| ----------------------------------------------- | --------------------------------------------------------- |
| [frontend/nginx.conf](../../frontend/nginx.conf)   | กำหนด access_log และ error_log path + format              |
| [nginx/logrotate.conf](../../nginx/logrotate.conf) | config สำหรับวางบน host ที่ `/etc/logrotate.d/gams-nginx` |

---

## 3. Server Blocks

### ทำอะไร

nginx แบ่งการทำงานออกเป็น 2 server block:

- **HTTP Server Block (port 80):** รับ ACME challenge path สำหรับ Let's Encrypt และ redirect ทุก request → HTTPS
- **HTTPS Server Block (port 443):** ให้บริการหลักทั้งหมด — Angular SPA, API backend, phpMyAdmin

### ทำไมถึงสำคัญ

ผู้ใช้เข้า port เดียว nginx จัดการแยก service และบังคับ HTTPS ให้เองอัตโนมัติ
ไม่ต้องเปิด port หลายๆ อันให้สับสน

### ผลลัพธ์ที่ได้

```bash
curl -k -I https://172.16.10.201
# HTTP/2 200  ← HTTPS ใช้งานได้ปกติ
```

### ไฟล์ที่เกี่ยวข้อง

| ไฟล์                                          | สิ่งที่ทำ                       |
| --------------------------------------------- | ------------------------------- |
| [frontend/nginx.conf](../../frontend/nginx.conf) | server block port 80 + port 443 |

---

## 4. Reverse Proxy

### ทำอะไร

nginx ทำหน้าที่รับ request จากผู้ใช้แล้วส่งต่อไปยัง service ที่ถูกต้อง:

- `/api/` → ส่งต่อไปยัง backend (Express.js) ที่ `gams-backend:3000`
- `/db-gaos-kmitl-2026/` → ส่งต่อไปยัง phpMyAdmin ที่ `gams-phpmyadmin:80`
- `/` → ให้บริการ Angular SPA โดยตรง

### ทำไมถึงสำคัญ

ผู้ใช้ไม่รู้ว่า backend อยู่ที่ port ไหน หรือมี service อะไรอยู่บ้าง
nginx ซ่อน architecture จริงของระบบไว้ ลดช่องทางที่ผู้โจมตีจะใช้เจาะระบบ

### ผลลัพธ์ที่ได้

```bash
curl -k https://172.16.10.201/api/health
# {"status":"ok"}  ← request ผ่าน nginx ไปถึง backend ได้
```

### ไฟล์ที่เกี่ยวข้อง

| ไฟล์                                          | สิ่งที่ทำ                                            |
| --------------------------------------------- | ---------------------------------------------------- |
| [frontend/nginx.conf](../../frontend/nginx.conf) | location `/api/` และ location `/${PMA_SECRET_PATH}/` |

---

## 5. Proxy Cache สำหรับ Static Assets

### ทำอะไร

- กำหนด cache zone ชื่อ `static_cache` ขนาดสูงสุด 500MB
- ไฟล์ static ทุกชนิด (JS, CSS, รูปภาพ, fonts) กำหนด `Cache-Control: public, immutable` และ `expires 1y`
- browser cache ไฟล์เหล่านี้ไว้ 1 ปี ไม่ต้องโหลดซ้ำ

### ทำไมถึงสำคัญ

ไฟล์ Angular ของ GAMS มีขนาด ~650KB ถ้าทุก request ต้องโหลดใหม่จาก server
ทำให้เว็บช้าและสิ้นเปลือง bandwidth โดยไม่จำเป็น

เมื่อ cache แล้ว browser เปิดเว็บครั้งแรกโหลดปกติ ครั้งต่อไปใช้ไฟล์ที่มีอยู่เลย
เว็บเปิดเร็วขึ้นอย่างเห็นได้ชัด

### ผลลัพธ์ที่ได้

```bash
curl -k -I https://172.16.10.201/main.ab80e85ce6a802d9.js
# expires: Sat, 27 Feb 2027 08:20:38 GMT   ← cache 1 ปี
# cache-control: public, immutable          ← browser ไม่ต้องตรวจสอบซ้ำ
```

### ไฟล์ที่เกี่ยวข้อง

| ไฟล์                                          | สิ่งที่ทำ                                            |
| --------------------------------------------- | ---------------------------------------------------- |
| [frontend/nginx.conf](../../frontend/nginx.conf) | `proxy_cache_path` + location `~* \.(js\|css\|...)$` |

---

## 6. Worker Processes Tuning

### ทำอะไร

```nginx
worker_processes auto;        # ใช้ทุก CPU core ที่มี
worker_rlimit_nofile 65536;   # เพิ่ม file descriptor limit

events {
    worker_connections 1024;  # รับ connection พร้อมกันสูงสุด 1024 ต่อ worker
    use epoll;                # I/O model ที่มีประสิทธิภาพสูงสุดบน Linux
    multi_accept on;          # รับหลาย connection พร้อมกันแทนทีละอัน
}
```

### ทำไมถึงสำคัญ

| ค่า                       | ความหมาย                                                      |
| ------------------------- | ------------------------------------------------------------- |
| `worker_processes auto`   | nginx ใช้ CPU core เท่าที่ server มี แทนที่จะใช้แค่ 1 process |
| `worker_connections 1024` | แต่ละ worker รองรับ connection พร้อมกันได้ 1024               |
| `use epoll`               | Linux I/O model ที่เหมาะกับ concurrent connections จำนวนมาก   |
| `multi_accept on`         | รับ connection หลายอันพร้อมกันได้ ไม่ต้องรอทีละอัน            |

รองรับผู้ใช้หลายร้อยคนพร้อมกันได้ โดยไม่ช้าลง เหมาะสำหรับช่วงที่นักศึกษาส่งงานพร้อมกัน

### ผลลัพธ์ที่ได้

```bash
docker exec gams-frontend cat /etc/nginx/nginx.conf | grep -E "worker|epoll|multi_accept"
# worker_processes auto;
# worker_rlimit_nofile 65536;
# worker_connections 1024;
# use epoll;
# multi_accept on;
```

### ไฟล์ที่เกี่ยวข้อง

| ไฟล์                                          | สิ่งที่ทำ                   |
| --------------------------------------------- | --------------------------- |
| [frontend/nginx.conf](../../frontend/nginx.conf) | main context + events block |

---

## 7. Security Headers

### ทำอะไร

เพิ่ม HTTP security headers ใน HTTPS server block ทุก response:

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options DENY always;
add_header X-Content-Type-Options nosniff always;
```

### ทำไมถึงสำคัญ

| Header                             | ป้องกัน                                                                                |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| `Strict-Transport-Security` (HSTS) | บังคับ browser ใช้ HTTPS ตลอด 1 ปี แม้พิมพ์ `http://` เอง ป้องกัน SSL stripping attack |
| `X-Frame-Options: DENY`            | ป้องกัน Clickjacking — ไม่ให้เว็บอื่น embed หน้าของเราใน `<iframe>`                    |
| `X-Content-Type-Options: nosniff`  | ป้องกัน MIME sniffing — browser ต้องใช้ Content-Type ที่ server กำหนดเท่านั้น          |

### ผลลัพธ์ที่ได้

```bash
curl -k -I https://172.16.10.201
# strict-transport-security: max-age=31536000; includeSubDomains
# x-frame-options: DENY
# x-content-type-options: nosniff
```

### ไฟล์ที่เกี่ยวข้อง

| ไฟล์                                          | สิ่งที่ทำ                          |
| --------------------------------------------- | ---------------------------------- |
| [frontend/nginx.conf](../../frontend/nginx.conf) | `add_header` ใน HTTPS server block |

---

## 8. สรุปไฟล์ที่เกี่ยวข้อง

| ไฟล์                                                          | สถานะ     | สิ่งที่ทำ                                                                                  |
| ------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------ |
| [frontend/nginx.conf](../../frontend/nginx.conf)                 | แก้ไข     | Worker tuning, HTTPS, Server Blocks, Reverse Proxy, Proxy Cache, Security Headers, Logging |
| [frontend/Dockerfile](../../frontend/Dockerfile)                 | แก้ไข     | ใช้ envsubst แทน `${DOMAIN}`, `${ADMIN_IP_RANGE}`, `${PMA_SECRET_PATH}` ตอน start          |
| [nginx/logrotate.conf](../../nginx/logrotate.conf)               | สร้างใหม่ | หมุนเวียน nginx log ทุกวัน เก็บ 14 วัน บีบอัดไฟล์เก่า                                      |
| [scripts/init-letsencrypt.sh](../../scripts/init-letsencrypt.sh) | สร้างใหม่ | Bootstrap SSL certificate ครั้งแรก (self-signed → Let's Encrypt)                           |
| [docker-compose.yml](../../docker-compose.yml)                   | แก้ไข     | certbot service, port 443, volumes สำหรับ cert และ logs                                    |
| [.env.example](../../.env.example)                               | แก้ไข     | เพิ่ม `DOMAIN`, `CERTBOT_EMAIL`, `ADMIN_IP_RANGE`, `PMA_SECRET_PATH`                       |
