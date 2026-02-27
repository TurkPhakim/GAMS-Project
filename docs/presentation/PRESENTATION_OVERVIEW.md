# สรุปการดำเนินงานทุกมิติ

## ระบบ GAMS — Grade Activity Management System

---

## มิติที่ 1: การจัดการผู้ใช้งาน (User Management)

ระบบ GAMS แบ่งผู้ใช้งานออกเป็น 2 บทบาทหลักตามหลักการ **Least Privilege**
ผู้ใช้แต่ละคนเห็นและทำได้เฉพาะสิ่งที่จำเป็นเท่านั้น — ทั้งในระดับ Web Application และระดับ Server

---

### หลักการ Least Privilege

**แนวคิด:** ให้สิทธิ์น้อยที่สุดเท่าที่จำเป็น ลดความเสียหายถ้าบัญชีถูก compromise

#### ระดับ Web / Application

ระบบแบ่งสิทธิ์ตามบทบาทผ่าน JWT token ที่เก็บ role ไว้:

| บทบาท        | ทำได้                                      | ทำไม่ได้                                     |
| ------------ | ------------------------------------------ | -------------------------------------------- |
| **นักศึกษา** | ดูกิจกรรม, ดูคะแนนตัวเอง, ส่งงานกลุ่ม      | ดูคะแนนคนอื่น, ให้คะแนน, จัดการกิจกรรม       |
| **อาจารย์**  | สร้าง/แก้ไขกิจกรรม, ให้คะแนน, ดูคะแนนทุกคน | แก้ไขข้อมูลนักศึกษา, เข้าถึง database โดยตรง |

Backend ตรวจสอบ role ทุก API request ก่อนอนุญาต
ถ้า token ไม่มี role ที่ถูกต้อง → ได้ 401 Unauthorized ทันที

#### ระดับ Server

แบ่ง Linux Group ตามหน้าที่ บนเครื่อง Ubuntu Server:

| Group      | สมาชิก         | สิทธิ์ที่ได้                                         |
| ---------- | -------------- | ---------------------------------------------------- |
| `sysadmin` | ผู้ดูแล server | sudo เต็มรูปแบบ                                      |
| `webdev`   | ทีม developer  | จัดการไฟล์ web directory, restart frontend container |
| `dbadmin`  | ทีม DBA        | เข้าถึง MySQL container เท่านั้น                     |

แต่ละ group มีสิทธิ์เฉพาะที่ตัวเองรับผิดชอบ ไม่มี user ทั่วไปที่ได้ sudo root เต็มๆ

---

### การจัดการสิทธิ์ระดับ Web Directory

**แนวคิด:** ไฟล์บน server ควรมีเจ้าของและสิทธิ์ที่ชัดเจน

#### ระดับ Web / Application

ใช้ Docker containers แยก process แต่ละ service ออกจากกัน:

- **gams-frontend** — ให้บริการแค่ไฟล์ static ของ Angular (อ่านอย่างเดียว)
- **gams-backend** — รัน Node.js เฉพาะ backend logic ไม่สามารถแก้ไขไฟล์ frontend ได้
- **gams-mysql** — เข้าถึงได้เฉพาะ container ใน network เดียวกัน ไม่เปิด port สู่ภายนอก

แต่ละ container รันด้วย user ของตัวเอง ไม่ใช่ root

#### ระดับ Server

โฟลเดอร์โปรเจค (`/home/ubuntu/www/GAMS-Project`) ตั้งค่าสิทธิ์ดังนี้:

```bash
chown -R www-data:webdev /home/ubuntu/www/GAMS-Project
chmod 2775 /home/ubuntu/www/GAMS-Project   # SGID
```

- `chmod 2775` (SGID) — ไฟล์ใหม่ที่สร้างในโฟลเดอร์ inherit group `webdev` โดยอัตโนมัติ
- สมาชิก group `webdev` แก้ไขไฟล์ได้ บุคคลภายนอก group อ่านได้อย่างเดียว
- ทำให้ทีม developer ทำงานร่วมกันได้โดยไม่ต้องใช้ root

---

### การตั้งค่า Sudoers แบบจำกัด

**แนวคิด:** Dev และ DBA ไม่ควรต้องใช้ root password ทุกครั้ง แต่ก็ไม่ควรได้ root เต็มๆ

#### ระดับ Web / Application

สิทธิ์ระดับ Application จัดการด้วย JWT + RBAC middleware แยกออกมาเรียบร้อยแล้ว
ไม่จำเป็นต้องแตะ sudoers จากฝั่ง Application

#### ระดับ Server

ตั้งค่า `/etc/sudoers.d/gams` แยกสิทธิ์ตาม group:

- Group `webdev` → รัน `docker compose restart frontend` ได้ ไม่สามารถรันคำสั่ง docker อื่นได้
- Group `dbadmin` → รัน `docker exec gams-mysql mysql ...` ได้ เพื่อจัดการ database
- ไม่มี group ใดได้ `sudo su` หรือ `sudo bash` — จำกัดเฉพาะคำสั่งที่จำเป็นเท่านั้น

```bash
# ตัวอย่างใน /etc/sudoers.d/gams
%webdev ALL=(ALL) NOPASSWD: /usr/bin/docker compose restart frontend
%dbadmin ALL=(ALL) NOPASSWD: /usr/bin/docker exec gams-mysql mysql *
```

---

## มิติที่ 2: โครงสร้างพื้นฐาน (OS & Infra)

ระบบ GAMS รันบน Ubuntu Server ใน Docker Compose environment
มีการจัดการทั้งระดับ Application และระดับ OS เพื่อให้ระบบมั่นคงและปลอดภัย

---

### Patch & Monitoring

#### Patch Management

**แนวคิด:** OS และ packages ที่ไม่อัพเดตมีช่องโหว่ที่รู้จักและถูก exploit ได้ง่าย

**ระดับ Web / Application:**

- Docker images ใช้ base image เวอร์ชันล่าสุด (`nginx:stable-alpine`, `mysql:8.0`, `node:20-alpine`)
- rebuild image ใหม่เมื่อ base image มี security patch เพื่อดึง patch ล่าสุดเข้ามา

**ระดับ Server:**

- ติดตั้ง `unattended-upgrades` บน Ubuntu — อัพเดต security patch อัตโนมัติทุกวัน
- OS-level patch ไม่ต้องรอให้คน manual upgrade ลดโอกาสที่ช่องโหว่จะถูกทิ้งไว้โดยไม่ตั้งใจ

```bash
# ตรวจสอบ unattended-upgrades
systemctl status unattended-upgrades
```

#### Resource Monitoring

**แนวคิด:** รู้ก่อนล่ม ดีกว่ารู้หลังล่ม

**ระดับ Web / Application:**

Docker มี health check สำหรับทุก container:

- **gams-backend** — ตรวจสอบทุก 30 วินาที ว่า API ยังตอบกลับได้
- **gams-mysql** — ตรวจสอบด้วย `mysqladmin ping` ว่า database พร้อมใช้งาน
- **gams-frontend** — ตรวจสอบว่า nginx process ยังทำงานอยู่

ถ้า container ไม่ healthy → Docker รายงาน unhealthy → admin รับรู้และแก้ไขได้ทันที

**ระดับ Server:**

ใช้ `htop` และ `docker stats` ดู resource usage แบบ real-time:

- CPU, RAM, Disk ของ container แต่ละตัว
- ตรวจสอบว่า service ใดกินทรัพยากรผิดปกติก่อนที่ระบบจะช้าหรือล่ม

```bash
docker stats   # CPU/RAM ของทุก container แบบ real-time
htop           # resource ระดับ OS ทั้งหมด
```

---

### Network & Firewall

#### UFW — เปิดเฉพาะ port ที่จำเป็น

**แนวคิด:** port ที่ไม่เปิดคือ port ที่โจมตีไม่ได้

**ระดับ Server:**

| Port              | สถานะ     | เหตุผล                                            |
| ----------------- | --------- | ------------------------------------------------- |
| 80 (HTTP)         | เปิด      | รับ request แล้ว redirect → HTTPS                 |
| 443 (HTTPS)       | เปิด      | ให้บริการหลักทั้งหมด                              |
| 22 (SSH)          | เปิดจำกัด | เฉพาะ admin เข้า server                           |
| 3000 (Backend)    | ปิด       | เข้าได้เฉพาะผ่าน nginx ใน Docker network          |
| 3306 (MySQL)      | ปิด       | เข้าได้เฉพาะ container ใน Docker network เท่านั้น |
| 8080 (phpMyAdmin) | ปิด       | เข้าได้เฉพาะผ่าน nginx ที่ URL ซ่อนอยู่           |

ผู้ใช้ภายนอกเห็นแค่ port 80 และ 443 เท่านั้น service อื่นทั้งหมดซ่อนอยู่ใน Docker network

#### เหตุผลทาง Tech ที่เลือก Port เหล่านี้

Port ที่ใช้ในระบบ GAMS ไม่ได้เลือกแบบสุ่ม แต่อิงตามมาตรฐาน IANA และ RFC ที่กำหนดไว้สำหรับแต่ละ protocol:

| Port | Protocol | มาตรฐานอ้างอิง | เหตุผลที่เลือก |
|------|----------|--------------|--------------|
| **22** | SSH (TCP) | RFC 4251 | IANA assigned สำหรับ Secure Shell — browser และ firewall ทั่วโลกรู้จัก เหมาะสำหรับ remote administration |
| **80** | HTTP (TCP) | RFC 2616 | IANA assigned สำหรับ HTTP — browser ทุกตัว default มาที่ port นี้ เปิดไว้เพื่อ redirect เท่านั้น |
| **443** | HTTPS (TCP) | RFC 2818 | IANA assigned สำหรับ HTTP over TLS — browser default สำหรับ HTTPS ทุก request ที่ผ่านจะถูกเข้ารหัส |
| **3000** | Express.js (TCP) | ไม่มี RFC | Node.js/Express.js community convention — ใช้กันแพร่หลาย ทำให้ทีม dev เข้าใจได้ทันที |
| **3306** | MySQL (TCP) | IANA assigned | MySQL default port — เครื่องมือ DBA (Workbench, phpMyAdmin) รู้จักโดยอัตโนมัติ |
| **80** (internal) | phpMyAdmin (TCP) | HTTP | รัน container ภายใน Docker network เข้าถึงได้ผ่าน nginx proxy เท่านั้น ไม่ expose สู่ภายนอก |
| **1812** | RADIUS (UDP) | RFC 2865 | IANA assigned สำหรับ RADIUS Authentication — FreeRADIUS รันภายใน Docker network เท่านั้น |

**หลักการสำคัญ:** port ที่ไม่ต้องใช้จากภายนอก (**3000, 3306, 1812, phpMyAdmin**) ไม่มีการ map ออกมาใน docker-compose.yml
(ยกเว้น 3306 ที่ map ไว้สำหรับ local development แต่ต้อง block ด้วย UFW บน production)

---

## มิติที่ 3: Web Server Management

ระบบ GAMS ใช้ **nginx** เป็น Web Server หลัก ทำหน้าที่รับ request จากผู้ใช้และกระจายไปยัง service ต่างๆ ภายใน

---

### มาตรฐานที่ต้องมีเหมือนกัน

#### 1. บังคับใช้ HTTPS ด้วย SSL/TLS Certificate

**สิ่งที่ทำ:**

- ติดตั้ง SSL Certificate บน nginx
- บังคับ redirect ทุก request จาก HTTP (port 80) → HTTPS (port 443) อัตโนมัติ
- ใช้ TLS 1.2 และ 1.3 เท่านั้น ปิด version เก่าที่ไม่ปลอดภัย

**ผลที่ได้:**

- ข้อมูลทุกอย่างที่รับส่งระหว่าง browser กับ server ถูกเข้ารหัสทั้งหมด
- รหัสผ่านนักศึกษา คะแนน และ JWT token ไม่สามารถถูกดักอ่านได้

**หลักฐาน:**

```
HTTP/1.1 301 Moved Permanently
Location: https://172.16.10.201/
```

---

#### 2. จัดการ Log สม่ำเสมอ (access/error) พร้อมตั้งค่า Logrotate

**สิ่งที่ทำ:**

- nginx บันทึก access log ทุก request ไว้ที่ `/var/log/nginx/gams-access.log`
- บันทึก error log ไว้ที่ `/var/log/nginx/gams-error.log`
- ตั้งค่า Logrotate หมุนเวียน log ทุกวัน เก็บย้อนหลัง 14 วัน และบีบอัดไฟล์เก่า

**ผลที่ได้:**

- มีบันทึกว่า IP ไหน เข้ามาเมื่อไหร่ ทำอะไร
- ถ้าเกิดปัญหาหรือถูก attack สามารถย้อนดู log เพื่อหาสาเหตุได้
- Log ไม่สะสมจนเต็ม disk เพราะมีการหมุนเวียนอัตโนมัติ

**หลักฐาน:**

```
172.16.10.201 - - [27/Feb/2026:08:17:03 +0000] "GET / HTTP/2.0" 200 11676
```

---

### กรณีใช้ NGINX

#### 3. ใช้ Server Blocks

**สิ่งที่ทำ:**

- **HTTP Server Block (port 80):** รับ request และ redirect ไป HTTPS ทันที
- **HTTPS Server Block (port 443):** ให้บริการหลักทั้งหมด ได้แก่ Angular SPA, API, phpMyAdmin

**ผลที่ได้:**

- ผู้ใช้เข้า port เดียว nginx จัดการแยก service ให้เองอัตโนมัติ

---

#### 4. ตั้งค่าเป็น Reverse Proxy คู่กับ Cache เพื่อลดโหลด

**สิ่งที่ทำ:**

- `/api/` → ส่งต่อไปยัง backend (Express.js) port 3000
- `/db-gaos-kmitl-2026/` → ส่งต่อไปยัง phpMyAdmin
- ไฟล์ static (JS, CSS, รูปภาพ) กำหนด cache ที่ browser 1 ปี

**ผลที่ได้:**

- ผู้ใช้ไม่รู้ว่า backend อยู่ที่ port ไหน ซ่อน architecture จริงของระบบ
- ไฟล์ Angular ขนาด ~650KB โหลดครั้งเดียว ครั้งต่อไป browser ใช้ของที่ cache ไว้เลย เว็บเปิดเร็วขึ้นมาก

**หลักฐาน:**

```
cache-control: public, immutable
expires: Sat, 27 Feb 2027 08:20:38 GMT
```

---

#### 5. จูน Worker Processes

**สิ่งที่ทำ:**

- `worker_processes auto` — nginx ใช้ทุก CPU core ที่มี
- `worker_connections 1024` — รับ connection พร้อมกันสูงสุด 1,024 ต่อ core
- `use epoll` + `multi_accept on` — ประสิทธิภาพสูงสุดบน Linux

**ผลที่ได้:**

- รองรับผู้ใช้หลายร้อยคนพร้อมกันได้ โดยไม่ช้าลง
- เหมาะสำหรับช่วงที่นักศึกษาส่งงานพร้อมกัน

**หลักฐาน:**

```
worker_processes auto;
use epoll;
multi_accept on;
```

---

#### 6. Security Headers

**สิ่งที่ทำ:**

- `Strict-Transport-Security` — บังคับ browser ใช้ HTTPS ตลอด 1 ปี
- `X-Frame-Options: DENY` — ป้องกันการฝังหน้าเว็บใน iframe (clickjacking)
- `X-Content-Type-Options: nosniff` — ป้องกัน browser เดา file type ผิด

**หลักฐาน:**

```
strict-transport-security: max-age=31536000; includeSubDomains
x-frame-options: DENY
x-content-type-options: nosniff
```

---

## มิติที่ 4: Database Management

ระบบ GAMS ใช้ **MySQL** เป็น Database หลัก และ **phpMyAdmin** สำหรับ admin จัดการ database

---

### MySQL Server

#### 1. Performance — ปรับจูนค่า innodb_buffer_pool_size และ max_connections

**สิ่งที่ทำ:**

- `innodb_buffer_pool_size = 512MB` (50% ของ RAM ที่ใช้งานได้)
- `max_connections = 100`

**ผลที่ได้:**

- MySQL เก็บข้อมูลที่ใช้บ่อย (คะแนน, กิจกรรม, นักศึกษา) ไว้ใน RAM แทนการอ่าน disk ทุกครั้ง query ตอบกลับเร็วขึ้นมาก
- จำกัด connection ป้องกัน server ล่มถ้ามีการเชื่อมต่อผิดปกติจำนวนมาก

**หลักฐาน:**

```
innodb_buffer_pool_size = 536870912  (= 512MB)
max_connections         = 100
```

---

#### 2. Security — ห้าม Web App ต่อด้วยสิทธิ์ root

**สิ่งที่ทำ:**

- สร้าง user `gams_app` ที่มีสิทธิ์เฉพาะ `SELECT, INSERT, UPDATE, DELETE` บน `gams_db` เท่านั้น
- backend เชื่อมต่อ MySQL ด้วย `gams_app` แทน root

**ผลที่ได้:**

- ถ้าแฮกเกอร์เจาะ backend ได้ ทำได้แค่อ่าน/แก้ข้อมูล
- ไม่สามารถ DROP TABLE, สร้าง user ใหม่, หรือแก้ไข schema ได้เลย
- ความเสียหายถูกจำกัดไว้ในวงแคบ

**หลักฐาน:**

```
GRANT SELECT, INSERT, UPDATE, DELETE ON `gams_db`.* TO `gams_app`@`%`
```

---

#### 3. Optimization — เปิด Slow Query Log

**สิ่งที่ทำ:**

- เปิด `slow_query_log = ON`
- บันทึก query ที่ใช้เวลา > 1 วินาที ไว้ที่ `/var/log/mysql/slow-query.log`

**ผลที่ได้:**

- ถ้าระบบช้าในอนาคต เปิดไฟล์นี้จะรู้ทันทีว่า query ไหนมีปัญหา
- แก้ได้ตรงจุดด้วยการเพิ่ม index หรือปรับ SQL โดยไม่ต้องเดา

**หลักฐาน:**

```
slow_query_log      = ON
slow_query_log_file = /var/log/mysql/slow-query.log
long_query_time     = 1.000000
```

---

### phpMyAdmin Security

#### 4. Obfuscation — เปลี่ยน URL เป็นชื่อที่คาดเดายาก

**สิ่งที่ทำ:**

- URL จริงของ phpMyAdmin คือ `/db-gaos-kmitl-2026/` (คาดเดายาก)
- `/phpmyadmin/` และ `/pma/` ไม่มี phpMyAdmin อยู่ เจอแค่หน้า GAMS ปกติ

**ผลที่ได้:**

- Bot ที่สแกนหา `/phpmyadmin/` จะไม่เจออะไรเลย
- ลดโอกาสถูก brute force โดยไม่ต้องทำอะไรเพิ่ม

**หลักฐาน:**

```
curl /phpmyadmin/ → <!doctype html> (หน้า Angular ไม่ใช่ phpMyAdmin)
curl /db-gaos-kmitl-2026/ → HTTP Status: 200 (phpMyAdmin จริง)
```

---

#### 5. Access Control — ปิดการล็อกอินด้วย root

**สิ่งที่ทำ:**

- ตั้งค่า `AllowRoot = false` ใน phpMyAdmin config
- ตั้งค่า `AllowNoPassword = false`

**ผลที่ได้:**

- ถึงแม้จะรู้ URL จริงและ IP ถูก subnet แล้ว ถ้าใช้ username `root` จะถูกปฏิเสธทันที
- บังคับให้ต้องรู้ทั้ง URL + IP ถูก + username ที่ถูกต้อง ครบทั้งสามชั้น

**หลักฐาน:**

```php
$cfg['Servers'][1]['AllowRoot']       = false;
$cfg['Servers'][1]['AllowNoPassword'] = false;
```

---

#### 6. Protection — จำกัด IP ที่สามารถเข้าถึงได้

**สิ่งที่ทำ:**

- nginx กำหนด IP allowlist เฉพาะ subnet มหาวิทยาลัย `172.16.0.0/20`
- IP นอก subnet ได้ 403 Forbidden ทันที ก่อนถึง phpMyAdmin

**ผลที่ได้:**

- คนนอกมหาวิทยาลัยไม่สามารถเข้าหน้า phpMyAdmin ได้เลย แม้จะรู้ URL จริง

**หลักฐาน:**

```nginx
location ^~ /db-gaos-kmitl-2026/ {
    allow 172.16.0.0/20;
    deny all;
}
```

---

## มิติที่ 5: Server Hardening

เสริมความแข็งแกร่งให้ server เพื่อป้องกันการเจาะจากภายนอก — ทั้งในระดับ Application และระดับ OS

---

### การป้องกันระดับ OS

#### SSH Security — ปิด Password Login บังคับใช้ SSH Key

**แนวคิด:** Password สามารถ brute force ได้ SSH Key ทำไม่ได้

**ระดับ Web / Application:**

- JWT token หมดอายุอัตโนมัติ ลดโอกาส session hijacking
- ผู้ใช้ต้อง login ใหม่หลังหมดเวลา ไม่มี token ที่ใช้ได้ตลอดไป

**ระดับ Server:**

ตั้งค่า SSH daemon บนเครื่อง Ubuntu:

- `PasswordAuthentication no` — ปิดการ login ด้วย password ทั้งหมด
- `PermitRootLogin no` — ปิด root login ผ่าน SSH โดยตรง
- admin ต้องใช้ SSH Key เท่านั้น และต้อง login ด้วย user ปกติก่อน แล้ว sudo ต่อ

สอดคล้องกับที่ระบบ GAMS ทำใน phpMyAdmin — ปิด root login เช่นกัน ทั้งระดับ OS และ Database

**หลักฐาน:**

```bash
# /etc/ssh/sshd_config
PasswordAuthentication no
PermitRootLogin no
```

---

#### Intrusion Prevention — Fail2Ban

**แนวคิด:** ถ้ามีการลอง login ผิดซ้ำๆ → block IP นั้นอัตโนมัติ

**ระดับ Web / Application:**

- Backend มี rate limiting บน API endpoint เพื่อจำกัดความถี่ request
- JWT token ที่หมดอายุหรือไม่ถูกต้องถูก reject ทันที ไม่มี session ค้างอยู่

**ระดับ Server:**

Fail2Ban ติดตั้งบน Ubuntu Server ป้องกัน 2 จุดหลัก:

**1. SSH Brute Force**
ถ้ามีการลอง login ผ่าน SSH ผิดเกิน N ครั้ง → block IP นั้นอัตโนมัติที่ UFW firewall

**2. nginx HTTP Brute Force**
ถ้า IP หนึ่งส่ง request ผิดปกติจำนวนมาก (เช่น scan หา phpMyAdmin)
→ Fail2Ban อ่าน nginx access log (`gams-access.log`) และ block IP นั้นที่ firewall ระดับ OS

```bash
# ตรวจสอบ Fail2Ban
sudo fail2ban-client status sshd
sudo fail2ban-client status nginx-http-auth
```

---

## Backup & Disaster Recovery (DR)

ป้องกันข้อมูลสูญหายจากเหตุการณ์ที่ไม่คาดคิด เช่น server พัง, ลบข้อมูลผิด, ถูก ransomware

---

### ข้อมูลอะไรใน GAMS ที่ต้อง Backup

ระบบ GAMS เก็บข้อมูลทั้งหมดไว้ใน MySQL database ชื่อ `gams_db` ประกอบด้วย 12 tables:

| กลุ่ม | Tables | ความสำคัญ |
|-------|--------|----------|
| **ผู้ใช้งาน** | `users`, `students`, `teachers` | ถ้าหายต้องกรอกข้อมูลนักศึกษาทั้งหมดใหม่ |
| **กิจกรรม** | `activities`, `criteria`, `activity_graders` | ข้อมูลกิจกรรมและเกณฑ์การประเมิน |
| **กลุ่ม** | `groups`, `group_members` | กลุ่มที่นักศึกษาสร้างไว้ |
| **คะแนน** | `grades`, `grader_comments`, `grader_submission_status` | ข้อมูลสำคัญที่สุด — คะแนนและ feedback จากอาจารย์ |
| **ระบบ** | `grading_scale` | ตาราง GPA ที่ใช้คำนวณเกรด |

**ไม่ต้อง backup:** Docker image, Angular build files — สร้างใหม่ได้จาก source code ตลอดเวลา

---

### แผนการ Backup สำหรับ GAMS

#### เป้าหมาย (RPO / RTO)

| ตัวชี้วัด | ความหมาย | เป้าหมาย GAMS |
|----------|----------|--------------|
| **RPO** (Recovery Point Objective) | ข้อมูลสูญหายได้มากสุดแค่ไหน | ≤ 24 ชั่วโมง (backup ทุกคืน) |
| **RTO** (Recovery Time Objective) | ใช้เวลา restore นานแค่ไหน | ≤ 15 นาที (database ขนาดเล็ก) |

#### กระบวนการ Backup

```
[Production Server]
       │
       ├── MySQL container (gams_db)
       │         │
       │    mysqldump ทุกคืน 02:00
       │         │
       ├── /backup/gams/daily/gams_YYYYMMDD.sql.gz
       │
       └── sync ไป External Storage (Cloud / NAS)
```

---

### 1. Automation — สำรองข้อมูลอัตโนมัติทุกวัน

**แนวคิด:** backup ที่ดีต้องทำอัตโนมัติ ไม่พึ่งคนกด

**Script สำหรับ GAMS** (`/opt/gams-backup.sh`):

```bash
#!/bin/bash
BACKUP_DIR="/backup/gams"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR/daily

# Dump database ผ่าน Docker (ไม่ต้อง expose MySQL port)
docker exec gams-mysql mysqldump \
  -u root -p"${MYSQL_ROOT_PASSWORD}" \
  --single-transaction \
  --routines \
  --triggers \
  gams_db | gzip > $BACKUP_DIR/daily/gams_${DATE}.sql.gz

# ลบ backup รายวันที่เก่ากว่า 7 วัน
find $BACKUP_DIR/daily -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: gams_${DATE}.sql.gz"
```

ตั้งให้รันทุกคืน 02:00 ผ่าน cron:

```bash
0 2 * * * /opt/gams-backup.sh >> /var/log/gams-backup.log 2>&1
```

**ข้อดีของวิธีนี้:**

- `--single-transaction` — dump ข้อมูล consistent โดยไม่ต้อง lock table ระหว่าง backup
- ทำงานผ่าน Docker โดยตรง ไม่ต้อง expose MySQL port 3306 สู่ภายนอก
- บีบอัดด้วย gzip ลดขนาดไฟล์ ~80%

---

### 2. Retention Policy — นโยบายการเก็บ backup

**แนวคิด:** เก็บให้พอ ไม่เก็บจนเต็ม disk

| ความถี่ | เก็บนานแค่ไหน | ใช้แก้ปัญหาอะไร |
|---------|-------------|----------------|
| รายวัน | 7 วันย้อนหลัง | ลบข้อมูลผิดเมื่อวาน, คะแนนหายระหว่างสัปดาห์ |
| รายสัปดาห์ | 4 สัปดาห์ | ปัญหาที่พบหลังสัปดาห์ที่ผ่านมา |
| รายเดือน | 6 เดือน | ข้อมูลเริ่มผิดพลาดมาตั้งแต่เดือนก่อน |

สอดคล้องกับ Logrotate ของ nginx ที่เก็บ log ย้อนหลัง 14 วัน — แนวคิดเดียวกัน: เก็บให้พอใช้ ไม่เก็บจนเต็ม disk

---

### 3. Test Restore — ทดสอบ restore อย่างน้อยไตรมาสละ 1 ครั้ง

**แนวคิด:** backup ที่ restore ไม่ได้ ไม่ใช่ backup จริง

**ขั้นตอน Restore สำหรับ GAMS:**

```bash
# 1. หยุด backend ก่อน (ไม่ให้มี write ระหว่าง restore)
docker compose stop backend

# 2. Restore ข้อมูลจาก backup
gunzip -c /backup/gams/daily/gams_YYYYMMDD.sql.gz | \
  docker exec -i gams-mysql mysql \
  -u root -p"${MYSQL_ROOT_PASSWORD}" \
  gams_db

# 3. ตรวจสอบว่าข้อมูลครบ
docker exec gams-mysql mysql -u root -p"${MYSQL_ROOT_PASSWORD}" gams_db \
  -e "SELECT 'students' as tbl, COUNT(*) as rows FROM students
      UNION ALL SELECT 'activities', COUNT(*) FROM activities
      UNION ALL SELECT 'grades', COUNT(*) FROM grades;"

# 4. Start backend กลับมา
docker compose start backend
```

**ทดสอบบน environment แยก (ไม่ใช่ production):**

```bash
# รัน MySQL container ชั่วคราว แล้ว restore เข้าไป
docker run --rm --name test-restore \
  -e MYSQL_ROOT_PASSWORD=test \
  -e MYSQL_DATABASE=gams_db \
  -d mysql:8.0

gunzip -c gams_backup.sql.gz | \
  docker exec -i test-restore mysql -u root -ptest gams_db

# ตรวจสอบแล้วลบ container ทิ้ง
docker stop test-restore
```

ถ้า restore แล้วข้อมูลไม่ครบ หรือ database ใช้งานไม่ได้ → แก้ไข backup process ทันที
ก่อนที่จะเกิดเหตุการณ์จริงที่ต้องใช้ backup

---

## สรุปภาพรวมทุกมิติ

| มิติ | หัวข้อ                | ระดับ      | สิ่งที่ทำ                                     | ผลลัพธ์                                     |
| ---- | --------------------- | ---------- | --------------------------------------------- | ------------------------------------------- |
| 1    | Least Privilege       | Web        | JWT role นักศึกษา/อาจารย์ + RBAC middleware   | เห็นและทำได้เฉพาะที่จำเป็น                  |
| 1    | Least Privilege       | Server     | Linux Groups (sysadmin/webdev/dbadmin)        | แต่ละทีมได้สิทธิ์เฉพาะงานตัวเอง             |
| 1    | Web Directory         | Web        | Docker แยก container แต่ละ service            | service หนึ่งเข้า service อื่นไม่ได้        |
| 1    | Web Directory         | Server     | chmod 2775 (SGID), chown webdev               | ทีม dev แก้ไขได้ คนนอก group อ่านอย่างเดียว |
| 1    | Sudoers               | Server     | sudoers.d/gams — จำกัดคำสั่งเฉพาะที่จำเป็น    | ไม่ต้องให้ root password แก่ Dev/DBA        |
| 2    | Patch Management      | Web        | Docker image เวอร์ชันล่าสุด                   | ลดช่องโหว่จาก outdated packages             |
| 2    | Patch Management      | Server     | unattended-upgrades อัตโนมัติ                 | OS patch โดยไม่ต้องรอ manual                |
| 2    | Monitoring            | Web        | Docker health check ทุก container             | รู้ทันทีถ้า service มีปัญหา                 |
| 2    | Monitoring            | Server     | htop + docker stats                           | ดู resource usage real-time                 |
| 2    | Firewall              | Server     | UFW เปิดเฉพาะ port 80, 443, 22                | MySQL/Backend ไม่เปิดสู่ภายนอก              |
| 3    | HTTPS                 | Web/Server | SSL + redirect HTTP→HTTPS                     | ข้อมูลเข้ารหัสทั้งหมด                       |
| 3    | Log + Logrotate       | Web/Server | access/error log + หมุน 14 วัน                | ตรวจสอบย้อนหลังได้                          |
| 3    | Reverse Proxy + Cache | Web/Server | `/api/` → backend, static cache 1y            | ซ่อน backend, เว็บเร็วขึ้น                  |
| 3    | Worker Processes      | Web/Server | auto core, epoll, 1024 conn                   | รองรับผู้ใช้พร้อมกันได้มาก                  |
| 4    | innodb + max_conn     | Server     | 512MB buffer, 100 connections                 | MySQL ตอบสนองเร็ว                           |
| 4    | App User              | Web/Server | SELECT/INSERT/UPDATE/DELETE only              | จำกัดความเสียหายถ้าถูกเจาะ                  |
| 4    | Slow Query Log        | Server     | ON, threshold 1 วินาที                        | หา query ที่มีปัญหาได้ง่าย                  |
| 4    | URL Obfuscation       | Server     | `/db-gaos-kmitl-2026/`                        | bot scan ไม่เจอ phpMyAdmin                  |
| 4    | IP Restriction        | Server     | 172.16.0.0/20 only                            | คนนอก subnet เข้าไม่ได้                     |
| 5    | SSH Key Only          | Web        | JWT หมดอายุอัตโนมัติ                          | ไม่มี token ที่ใช้ได้ตลอดไป                 |
| 5    | SSH Key Only          | Server     | PasswordAuthentication no, PermitRootLogin no | brute force SSH ไม่ได้                      |
| 5    | Fail2Ban              | Web        | Rate limiting บน API                          | จำกัดความถี่ request ผิดปกติ                |
| 5    | Fail2Ban              | Server     | block IP ที่ลอง login SSH/HTTP ผิดซ้ำ         | ลดโอกาสถูก brute force                      |
| DR   | Auto Backup           | Server     | mysqldump รายวัน                              | ข้อมูลไม่สูญหายถ้า server พัง               |
| DR   | Retention Policy      | Server     | 7วัน/4สัปดาห์/6เดือน                          | ย้อนหลังได้ตามความจำเป็น                    |
| DR   | Test Restore          | Server     | ทดสอบไตรมาสละ 1 ครั้ง                         | มั่นใจว่า backup ใช้งานได้จริง              |
