# มิติที่ 4: Database Management

เอกสารนี้อธิบายสิ่งที่ได้ดำเนินการตามมาตรฐาน Database Management สำหรับระบบ GAMS

---

## Quick Deploy

```bash
# ก่อน start stack ครั้งแรก ตั้งค่าใน .env:
MYSQL_ROOT_PASSWORD=รหัสผ่านแข็งแกร่ง
MYSQL_APP_USER=gams_app
MYSQL_APP_PASSWORD=รหัสผ่านแยกสำหรับ app
MYSQL_INNODB_BUFFER_POOL_SIZE=512M   # ปรับตาม RAM server
ADMIN_IP_RANGE=161.200.xxx.xxx       # IP ทีม admin เท่านั้น
PMA_SECRET_PATH=ชื่อที่คาดเดายาก    # เช่น db-x7k9-admin

# App user สร้างอัตโนมัติตอน MySQL first-init
# ไม่ต้องทำอะไรเพิ่ม — แค่ start stack ปกติ
docker compose up -d
```

---

## สารบัญ

1. [MySQL Performance Tuning](#1-mysql-performance-tuning)
2. [MySQL App User — ไม่ใช้ root](#2-mysql-app-user--ไมใช-root)
3. [MySQL Slow Query Log](#3-mysql-slow-query-log)
4. [phpMyAdmin: ปิด Root Login](#4-phpmyadmin-ปด-root-login)
5. [phpMyAdmin: URL Obfuscation](#5-phpmyadmin-url-obfuscation)
6. [phpMyAdmin: จำกัด IP](#6-phpmyadmin-จำกด-ip)
7. [วิธีตรวจสอบบน Server](#7-วธตรวจสอบบน-server)
8. [สรุปไฟล์ที่เปลี่ยนแปลง](#8-สรปไฟลทเปลยนแปลง)

---

## 1. MySQL Performance Tuning

### ทำอะไร

เพิ่ม flags ใน MySQL command ใน [docker-compose.yml](../docker-compose.yml):

```yaml
command: >
  --innodb-buffer-pool-size=${MYSQL_INNODB_BUFFER_POOL_SIZE:-512M}
  --max-connections=${MYSQL_MAX_CONNECTIONS:-150}
```

### เพราะอะไร

**innodb_buffer_pool_size** คือ cache หลักของ MySQL สำหรับ data และ index
หาก RAM มีพอแต่ค่านี้ต่ำเกิน MySQL อ่าน disk ทุกครั้งที่ query → ช้ามาก

| RAM ของ server | ค่าที่แนะนำ |
|---------------|-----------|
| 2 GB | 1G |
| 4 GB | 2G |
| 8 GB | 4G |
| 16 GB | 8G |

**max_connections** กำหนดจำนวน connection พร้อมกันสูงสุด
ต่ำเกิน → user เห็น "Too many connections" ช่วง peak
สูงเกิน → แต่ละ connection กิน RAM → server พัง

### วิธีตั้งค่า

แก้ใน `.env`:
```bash
MYSQL_INNODB_BUFFER_POOL_SIZE=2G   # สำหรับ server 4GB RAM
MYSQL_MAX_CONNECTIONS=150
```

---

## 2. MySQL App User — ไม่ใช้ root

### ทำอะไร

- สร้างไฟล์ [database/03-create-app-user.sh](../database/03-create-app-user.sh) ที่รันอัตโนมัติตอน MySQL first-init
- Backend เปลี่ยนจาก `DB_USER: root` เป็น `DB_USER: ${MYSQL_APP_USER}` ใน [docker-compose.yml](../docker-compose.yml)

Script สร้าง user พร้อมกำหนดสิทธิ์เฉพาะที่จำเป็น:
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON `gams_db`.* TO 'gams_app'@'%';
```

### เพราะอะไร

ตอนนี้ถ้า backend โดน SQL Injection หรือ compromise:
- **root** → ผู้โจมตีสามารถ DROP DATABASE, สร้าง user ใหม่, อ่านทุก database บน server ได้
- **gams_app** → ทำได้แค่ SELECT/INSERT/UPDATE/DELETE บน `gams_db` เท่านั้น ความเสียหายจำกัด

นี่คือ **Principle of Least Privilege** — ให้สิทธิ์เท่าที่จำเป็นจริงๆ เท่านั้น

### วิธีตั้งค่า

แก้ใน `.env`:
```bash
MYSQL_APP_USER=gams_app
MYSQL_APP_PASSWORD=รหัสผ่านที่แข็งแกร่ง
```

**หมายเหตุสำคัญ:** ถ้า MySQL container เคย start แล้ว (มี volume อยู่แล้ว) script init จะไม่รันอีก
ต้องลบ volume และ init ใหม่:
```bash
docker compose down -v   # ลบ volume ทั้งหมด (ข้อมูลหายหมด)
docker compose up -d     # init ใหม่
```
หรือสร้าง user ด้วยตนเอง:
```bash
docker exec -it gams-mysql mysql -uroot -p
# ใน MySQL shell:
CREATE USER 'gams_app'@'%' IDENTIFIED BY 'รหัสผ่าน';
GRANT SELECT, INSERT, UPDATE, DELETE ON `gams_db`.* TO 'gams_app'@'%';
FLUSH PRIVILEGES;
```

---

## 3. MySQL Slow Query Log

### ทำอะไร

เพิ่ม flags ใน MySQL command:
```yaml
--slow-query-log=1
--slow-query-log-file=/var/log/mysql/slow-query.log
--long-query-time=1
```

Volume `mysql-logs` mount ออกมาให้เข้าถึงได้จาก host

### เพราะอะไร

Query ที่ใช้เวลา > 1 วินาทีจะถูก log ไว้ ตัวอย่าง log ที่จะเห็น:
```
# Time: 2026-02-26T10:23:11
# Query_time: 3.241  Lock_time: 0.001  Rows_examined: 50000
SELECT * FROM activities JOIN enrollments ON ...;
```

Dev นำ query นี้ไปวิเคราะห์ด้วย `EXPLAIN` เพื่อหาว่าขาด index ตรงไหน

### วิธีดู Slow Query Log

```bash
# ดู log แบบ real-time
docker exec gams-mysql tail -f /var/log/mysql/slow-query.log

# ดูผ่าน volume บน host
docker volume inspect gams-project_mysql-logs
```

---

## 4. phpMyAdmin: ปิด Root Login

### ทำอะไร

สร้างไฟล์ [phpmyadmin/config.user.inc.php](../phpmyadmin/config.user.inc.php) และ mount เข้า container:

```php
$cfg['Servers'][1]['AllowRoot'] = false;
$cfg['Servers'][1]['AllowNoPassword'] = false;
```

### เพราะอะไร

`root` คือ account แรกที่ bot และ attacker พยายาม brute force เพราะรู้ว่ามีแน่นอน
การปิด root login บังคับให้ต้อง login ด้วย user อื่น ซึ่ง attacker ไม่รู้ชื่อ

หาก root login ได้ผ่าน phpMyAdmin → เข้าถึงข้อมูลทั้งหมดในระบบได้

### วิธีตรวจสอบ

```bash
# เปิด phpMyAdmin และลอง login ด้วย root
# ต้องเห็น error: "Access denied for user 'root'"
```

---

## 5. phpMyAdmin: URL Obfuscation

### ทำอะไร

- phpMyAdmin **ไม่ expose port โดยตรง** อีกต่อไป (ไม่มี `ports: 8888:80`)
- เข้าผ่าน nginx ที่ path ที่กำหนดใน `.env` ตัวแปร `PMA_SECRET_PATH`
- กำหนดใน [frontend/nginx.conf:87-101](../frontend/nginx.conf)

```nginx
location /${PMA_SECRET_PATH}/ {
    allow ${ADMIN_IP_RANGE};
    deny all;
    proxy_pass http://gams-phpmyadmin:80/;
    ...
}
```

### เพราะอะไร

Bot scan หา phpMyAdmin โดย request URL ทั่วไป เช่น:
```
/phpmyadmin/
/pma/
/phpMyAdmin/
/mysql/
```

การเปลี่ยน path เป็นชื่อสุ่ม เช่น `/db-x7k9-manage/` ทำให้ bot scan ไม่เจอ
และการไม่ expose port ตรงๆ ทำให้ไม่สามารถเข้าถึง phpMyAdmin ได้เลย นอกจากผ่าน nginx

### วิธีตั้งค่า

แก้ใน `.env` — เปลี่ยนเป็นชื่อที่คาดเดายาก:
```bash
PMA_SECRET_PATH=db-x7k9-manage-2026
```

URL ที่ใช้เข้า phpMyAdmin จะเป็น:
```
https://gams.youruniversity.ac.th/db-x7k9-manage-2026/
```

---

## 6. phpMyAdmin: จำกัด IP

### ทำอะไร

nginx location ของ phpMyAdmin มี IP allowlist:

```nginx
location /${PMA_SECRET_PATH}/ {
    allow ${ADMIN_IP_RANGE};   # IP ที่อนุญาต
    deny all;                   # ปฏิเสธทุก IP อื่น
    ...
}
```

### เพราะอะไร

แม้รู้ URL ที่ซ่อนไว้ ก็เข้าได้เฉพาะจาก IP ที่กำหนดเท่านั้น
ทีม admin ที่ทำงานนอก network มหาวิทยาลัยต้อง VPN เข้ามาก่อน

### วิธีตั้งค่า

ค้นหา IP ของ network มหาวิทยาลัย แล้วใส่ใน `.env`:
```bash
# IP เดียว
ADMIN_IP_RANGE=161.200.xxx.xxx

# หลาย IP (nginx allow syntax หลายบรรทัดไม่ได้ผ่าน env var เดียว)
# กรณีนี้ให้แก้ nginx.conf โดยตรง:
# allow 161.200.xxx.xxx;
# allow 10.0.0.0/8;

# subnet ของมหาวิทยาลัย
ADMIN_IP_RANGE=161.200.0.0/16
```

---

## 7. วิธีตรวจสอบบน Server

### ตรวจ MySQL App User

```bash
# เข้า MySQL ด้วย root
docker exec -it gams-mysql mysql -uroot -p

# ตรวจสิทธิ์ของ app user
SHOW GRANTS FOR 'gams_app'@'%';
# ต้องเห็น: GRANT SELECT, INSERT, UPDATE, DELETE ON `gams_db`.* TO `gams_app`@`%`
# ต้องไม่เห็น: ALL PRIVILEGES หรือ GRANT OPTION
```

### ตรวจ Slow Query Log

```bash
# ดูว่า slow query log เปิดอยู่
docker exec gams-mysql mysql -uroot -p -e "SHOW VARIABLES LIKE 'slow_query%';"
# slow_query_log        | ON
# slow_query_log_file   | /var/log/mysql/slow-query.log
# long_query_time       | 1.000000

# ดู log
docker exec gams-mysql tail -20 /var/log/mysql/slow-query.log
```

### ตรวจ innodb_buffer_pool_size

```bash
docker exec gams-mysql mysql -uroot -p -e "SHOW VARIABLES LIKE 'innodb_buffer_pool_size';"
# ค่าที่ได้ต้องตรงกับที่ตั้งใน .env (หน่วยเป็น bytes)
# 512M = 536870912
```

### ตรวจ phpMyAdmin root login ปิดอยู่

```bash
# เปิด browser ไปที่ https://DOMAIN/PMA_SECRET_PATH/
# ลอง login ด้วย root
# ต้องเห็น error — login ไม่ได้
```

### ตรวจ IP restriction

```bash
# จาก IP ที่ไม่ได้รับอนุญาต (เช่น เครื่อง local ของนักศึกษา)
curl -I https://gams.youruniversity.ac.th/db-manage-app/
# ต้องเห็น: 403 Forbidden

# จาก IP ที่อนุญาต (admin)
curl -I https://gams.youruniversity.ac.th/db-manage-app/
# ต้องเห็น: 200 OK
```

---

## 8. สรุปไฟล์ที่เปลี่ยนแปลง

| ไฟล์ | สถานะ | สิ่งที่ทำ |
|------|-------|---------|
| [docker-compose.yml](../docker-compose.yml) | แก้ไข | MySQL tuning flags, app user env vars, phpMyAdmin ไม่ expose port, nginx env vars |
| [database/03-create-app-user.sh](../database/03-create-app-user.sh) | สร้างใหม่ | Script สร้าง MySQL app user สิทธิ์จำกัด (SELECT/INSERT/UPDATE/DELETE) |
| [phpmyadmin/config.user.inc.php](../phpmyadmin/config.user.inc.php) | สร้างใหม่ | AllowRoot=false, AllowNoPassword=false |
| [frontend/nginx.conf](../frontend/nginx.conf) | แก้ไข | เพิ่ม location phpMyAdmin พร้อม IP allowlist |
| [frontend/Dockerfile](../frontend/Dockerfile) | แก้ไข | envsubst เพิ่ม ADMIN_IP_RANGE และ PMA_SECRET_PATH |
| [.env.example](../.env.example) | แก้ไข | เพิ่ม MYSQL_APP_USER, MYSQL_APP_PASSWORD, MYSQL_INNODB_BUFFER_POOL_SIZE, ADMIN_IP_RANGE, PMA_SECRET_PATH |
