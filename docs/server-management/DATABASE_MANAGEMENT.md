# มิติที่ 4: Database Management
## ระบบ GAMS — Grade Activity Management System

ระบบ GAMS ใช้ **MySQL** เป็น Database หลักสำหรับเก็บข้อมูลนักศึกษา, คะแนน, กิจกรรม
และใช้ **phpMyAdmin** สำหรับ admin จัดการ database ผ่าน Web UI

---

## สารบัญ

**MySQL Server**
1. [Performance — ปรับจูน innodb_buffer_pool_size และ max_connections](#1-performance--ปรับจูน-innodb_buffer_pool_size-และ-max_connections)
2. [Security — App User สิทธิ์จำกัด (ไม่ใช้ root)](#2-security--app-user-สิทธิ์จำกัด-ไม่ใช้-root)
3. [Optimization — Slow Query Log](#3-optimization--slow-query-log)

**phpMyAdmin Security**
4. [Obfuscation — URL คาดเดายาก](#4-obfuscation--url-คาดเดายาก)
5. [Access Control — ปิด Root Login](#5-access-control--ปิด-root-login)
6. [Protection — จำกัด IP](#6-protection--จำกัด-ip)
7. [สรุปไฟล์ที่เกี่ยวข้อง](#7-สรุปไฟล์ที่เกี่ยวข้อง)

---

## MySQL Server

## 1. Performance — ปรับจูน innodb_buffer_pool_size และ max_connections

### ทำอะไร

ตั้งค่า MySQL ผ่าน flags ใน [docker-compose.yml](../../docker-compose.yml):

```yaml
command: >
  --innodb-buffer-pool-size=512M
  --max-connections=100
  --slow-query-log=1
  --slow-query-log-file=/var/log/mysql/slow-query.log
  --long-query-time=1
```

### ทำไมถึงสำคัญ

**innodb_buffer_pool_size** คือ cache หลักของ MySQL สำหรับเก็บ data และ index ไว้ใน RAM
ถ้าค่านี้ต่ำเกิน MySQL ต้องอ่าน disk ทุกครั้งที่ query → ช้ามาก
ค่า 512MB ≈ 50% ของ RAM ที่ใช้งานได้บน server นี้ เป็นค่าที่เหมาะสม

**max_connections** กำหนดจำนวน connection พร้อมกันสูงสุด
ค่า 100 เพียงพอสำหรับระบบ GAMS และป้องกันไม่ให้มีการเชื่อมต่อเกินจนระบบล่ม

### ผลลัพธ์ที่ได้

```bash
source .env && docker exec gams-mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" \
  -e "SHOW VARIABLES LIKE 'innodb_buffer_pool_size'; SHOW VARIABLES LIKE 'max_connections';"

# innodb_buffer_pool_size = 536870912  (= 512MB)
# max_connections         = 100
```

### ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | สิ่งที่ทำ |
|------|---------|
| [docker-compose.yml](../../docker-compose.yml) | MySQL command flags สำหรับ performance tuning |
| [.env.example](../../.env.example) | `MYSQL_INNODB_BUFFER_POOL_SIZE`, `MYSQL_MAX_CONNECTIONS` |

---

## 2. Security — App User สิทธิ์จำกัด (ไม่ใช้ root)

### ทำอะไร

- สร้าง MySQL user ชื่อ `gams_app` ที่มีสิทธิ์เฉพาะ `SELECT, INSERT, UPDATE, DELETE` บน `gams_db` เท่านั้น
- backend เชื่อมต่อ MySQL ด้วย `gams_app` แทน root
- script [database/03-create-app-user.sh](../../database/03-create-app-user.sh) สร้าง user อัตโนมัติตอน MySQL first-init

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON `gams_db`.* TO 'gams_app'@'%';
```

### ทำไมถึงสำคัญ

นี่คือหลักการ **Principle of Least Privilege** — ให้สิทธิ์เท่าที่จำเป็นจริงๆ เท่านั้น

ถ้า backend โดน SQL Injection หรือ compromise:
- **root** → ผู้โจมตีทำได้ทุกอย่าง: DROP DATABASE, สร้าง user ใหม่, อ่านทุก database
- **gams_app** → ทำได้แค่ SELECT/INSERT/UPDATE/DELETE บน `gams_db` เท่านั้น ความเสียหายถูกจำกัด

### ผลลัพธ์ที่ได้

```bash
source .env && docker exec gams-mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" \
  -e "SHOW GRANTS FOR 'gams_app'@'%';"

# GRANT USAGE ON *.* TO `gams_app`@`%`
# GRANT SELECT, INSERT, UPDATE, DELETE ON `gams_db`.* TO `gams_app`@`%`
# (ไม่มี ALL PRIVILEGES หรือ GRANT OPTION)
```

### ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | สิ่งที่ทำ |
|------|---------|
| [database/03-create-app-user.sh](../../database/03-create-app-user.sh) | script สร้าง MySQL app user สิทธิ์จำกัด ตอน first-init |
| [docker-compose.yml](../../docker-compose.yml) | `DB_USER: ${MYSQL_APP_USER}` ใน backend service |

> **หมายเหตุ:** ถ้า MySQL volume มีอยู่แล้ว (เคย start แล้ว) script init จะไม่รันอีก
> ต้องสร้าง user ด้วยตนเอง หรือลบ volume แล้ว init ใหม่

---

## 3. Optimization — Slow Query Log

### ทำอะไร

- เปิด `slow_query_log=1` บันทึก query ที่ใช้เวลา > 1 วินาที
- บันทึกไว้ที่ `/var/log/mysql/slow-query.log`
- volume `mysql-logs` mount ออกมาให้เข้าถึงได้จาก host

### ทำไมถึงสำคัญ

ถ้าในอนาคตระบบช้า (เช่น หน้าดูคะแนนโหลดนาน) เปิดไฟล์นี้จะรู้ทันทีว่า query ไหนมีปัญหา
แก้ได้ตรงจุดด้วยการเพิ่ม index หรือปรับ SQL โดยไม่ต้องเดา

### ผลลัพธ์ที่ได้

```bash
source .env && docker exec gams-mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" \
  -e "SHOW VARIABLES LIKE 'slow_query_log'; SHOW VARIABLES LIKE 'slow_query_log_file'; SHOW VARIABLES LIKE 'long_query_time';"

# slow_query_log      = ON
# slow_query_log_file = /var/log/mysql/slow-query.log
# long_query_time     = 1.000000
```

### ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | สิ่งที่ทำ |
|------|---------|
| [docker-compose.yml](../../docker-compose.yml) | MySQL flags: `--slow-query-log`, `--long-query-time` |

---

## phpMyAdmin Security

## 4. Obfuscation — URL คาดเดายาก

### ทำอะไร

- phpMyAdmin ไม่ expose port โดยตรง (ไม่มี `ports: 8888:80`)
- เข้าได้เฉพาะผ่าน nginx ที่ path ที่คาดเดายาก: `/db-gaos-kmitl-2026/`
- กำหนดผ่าน environment variable `PMA_SECRET_PATH` ใน `.env`

### ทำไมถึงสำคัญ

Bot ที่สแกนหา phpMyAdmin จะลอง URL ทั่วไปเช่น `/phpmyadmin/`, `/pma/`, `/mysql/`
การเปลี่ยนเป็นชื่อสุ่มทำให้ bot ไม่เจอ phpMyAdmin เลย ลดโอกาสถูกโจมตีโดยไม่ต้องทำอะไรเพิ่ม

### ผลลัพธ์ที่ได้

```bash
# URL ปกติได้ Angular HTML (ไม่ใช่ phpMyAdmin)
curl -k -s https://172.16.10.201/phpmyadmin/ | head -3
# <!doctype html>
# <html lang="th" data-critters-container>   ← หน้า GAMS ปกติ ไม่ใช่ phpMyAdmin

# URL จริงเข้าได้
curl -k -o /dev/null -w "HTTP Status: %{http_code}\n" https://172.16.10.201/db-gaos-kmitl-2026/
# HTTP Status: 200
```

### ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | สิ่งที่ทำ |
|------|---------|
| [frontend/nginx.conf](../../frontend/nginx.conf) | location `^~ /${PMA_SECRET_PATH}/` |
| [.env.example](../../.env.example) | `PMA_SECRET_PATH=db-gaos-kmitl-2026` |

---

## 5. Access Control — ปิด Root Login

### ทำอะไร

สร้างไฟล์ [phpmyadmin/config.user.inc.php](../../phpmyadmin/config.user.inc.php) และ mount เข้า container:

```php
$cfg['Servers'][1]['AllowRoot']       = false;  // ปิด root login
$cfg['Servers'][1]['AllowNoPassword'] = false;  // บังคับมีรหัสผ่าน
```

### ทำไมถึงสำคัญ

`root` คือ account แรกที่ bot และ attacker พยายาม brute force เพราะรู้ว่ามีแน่นอน
การปิด root login บังคับให้ต้อง login ด้วย user อื่น ซึ่ง attacker ไม่รู้ชื่อ

### ผลลัพธ์ที่ได้

```bash
cat phpmyadmin/config.user.inc.php
# $cfg['Servers'][1]['AllowRoot']       = false;
# $cfg['Servers'][1]['AllowNoPassword'] = false;
```

ทดสอบ: เปิด browser → `https://172.16.10.201/db-gaos-kmitl-2026/`
ลอง login ด้วย `root` → ต้องเห็น error "Access denied for user 'root'"

### ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | สิ่งที่ทำ |
|------|---------|
| [phpmyadmin/config.user.inc.php](../../phpmyadmin/config.user.inc.php) | AllowRoot=false, AllowNoPassword=false |
| [docker-compose.yml](../../docker-compose.yml) | mount config file เข้า container |

---

## 6. Protection — จำกัด IP

### ทำอะไร

nginx กำหนด IP allowlist สำหรับ phpMyAdmin location:

```nginx
location ^~ /db-gaos-kmitl-2026/ {
    allow 172.16.0.0/20;   # เฉพาะ subnet มหาวิทยาลัย
    deny all;              # ปฏิเสธทุก IP อื่น
    ...
}
```

### ทำไมถึงสำคัญ

แม้รู้ URL จริงแล้ว ก็ยังเข้าได้เฉพาะจาก IP ที่อยู่ใน subnet มหาวิทยาลัย (172.16.0.0/20) เท่านั้น
คนนอกมหาวิทยาลัยจะได้ 403 Forbidden ทันที ก่อนถึงหน้า login ของ phpMyAdmin เลย

การป้องกันทำงานเป็นชั้น (Defense in Depth):
1. ไม่รู้ URL → ไม่เจอ phpMyAdmin
2. รู้ URL แต่ IP นอก subnet → ได้ 403 ทันที
3. IP ถูกต้องแต่ใช้ root → login ไม่ได้

### ผลลัพธ์ที่ได้

```bash
docker exec gams-frontend nginx -T 2>/dev/null | grep -A 10 "db-gaos-kmitl-2026"
# location ^~ /db-gaos-kmitl-2026/ {
#     allow 172.16.0.0/20;
#     deny all;
#     ...
# }
```

### ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | สิ่งที่ทำ |
|------|---------|
| [frontend/nginx.conf](../../frontend/nginx.conf) | `allow ${ADMIN_IP_RANGE}; deny all;` ใน phpMyAdmin location |
| [.env.example](../../.env.example) | `ADMIN_IP_RANGE=172.16.0.0/20` |

---

## 7. สรุปไฟล์ที่เกี่ยวข้อง

| ไฟล์ | สถานะ | สิ่งที่ทำ |
|------|-------|---------|
| [docker-compose.yml](../../docker-compose.yml) | แก้ไข | MySQL tuning flags, app user env vars, phpMyAdmin ไม่ expose port, nginx env vars |
| [database/03-create-app-user.sh](../../database/03-create-app-user.sh) | สร้างใหม่ | script สร้าง MySQL app user สิทธิ์จำกัด (SELECT/INSERT/UPDATE/DELETE) |
| [phpmyadmin/config.user.inc.php](../../phpmyadmin/config.user.inc.php) | สร้างใหม่ | AllowRoot=false, AllowNoPassword=false |
| [frontend/nginx.conf](../../frontend/nginx.conf) | แก้ไข | phpMyAdmin location พร้อม IP allowlist และ URL obfuscation |
| [frontend/Dockerfile](../../frontend/Dockerfile) | แก้ไข | envsubst เพิ่ม `ADMIN_IP_RANGE` และ `PMA_SECRET_PATH` |
| [.env.example](../../.env.example) | แก้ไข | เพิ่ม `MYSQL_APP_USER`, `MYSQL_APP_PASSWORD`, `MYSQL_INNODB_BUFFER_POOL_SIZE`, `ADMIN_IP_RANGE`, `PMA_SECRET_PATH` |
