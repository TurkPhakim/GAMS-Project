# มิติที่ 3: Web Server Management

เอกสารนี้อธิบายสิ่งที่ได้ดำเนินการตามมาตรฐาน Web Server Management สำหรับระบบ GAMS
เพื่อให้พร้อมขึ้น Server ของมหาวิทยาลัยได้อย่างมีมาตรฐาน

---

## Quick Deploy

ขั้นตอนสำหรับนำขึ้น Server จริง (รายละเอียดอยู่ใน [ส่วนที่ 7](#7-ขนตอนการ-deploy-บน-server-จรง)):

```bash
# 1. ตั้งค่า environment
cp .env.example .env
# แก้ DOMAIN, CERTBOT_EMAIL, MYSQL_ROOT_PASSWORD, JWT_SECRET ใน .env

# 2. ขอ SSL certificate จาก Let's Encrypt (ทำครั้งเดียวก่อน deploy ครั้งแรก)
#    ต้องทำก่อน: เปิด port 80/443 บน firewall และตั้ง DNS ให้ชี้มาที่ server
chmod +x scripts/init-letsencrypt.sh
./scripts/init-letsencrypt.sh

# 3. Start stack
docker compose up -d

# 4. ติดตั้ง Logrotate บน host
sudo cp nginx/logrotate.conf /etc/logrotate.d/gams-nginx
```

---

## สารบัญ

1. [HTTPS + SSL/TLS ด้วย Let's Encrypt](#1-https--ssltls-ดวย-lets-encrypt)
2. [Logging และ Logrotate](#2-logging-และ-logrotate)
3. [Worker Processes Tuning](#3-worker-processes-tuning)
4. [Reverse Proxy (เดิมมีแล้ว — ปรับปรุงเพิ่มเติม)](#4-reverse-proxy)
5. [Proxy Cache สำหรับ Static Assets](#5-proxy-cache-สำหรบ-static-assets)
6. [Security Headers](#6-security-headers)
7. [ขั้นตอนการ Deploy บน Server จริง](#7-ขนตอนการ-deploy-บน-server-จรง)

---

## 1. HTTPS + SSL/TLS ด้วย Let's Encrypt

### ทำอะไร

- เพิ่ม HTTPS server block (port 443) ใน [frontend/nginx.conf](../frontend/nginx.conf)
- เพิ่ม HTTP server block ที่ redirect ทุก request ไป HTTPS (ยกเว้น ACME challenge path)
- ใช้ Certbot (Let's Encrypt) เป็น certificate provider ผ่าน Docker service ชื่อ `certbot`
- เพิ่ม `certbot` service ใน [docker-compose.yml](../docker-compose.yml) พร้อม auto-renewal loop
- สร้าง [scripts/init-letsencrypt.sh](../scripts/init-letsencrypt.sh) สำหรับ bootstrap certificate ครั้งแรก

### เพราะอะไร

การส่งข้อมูลผ่าน HTTP (port 80) ทำให้ JWT token, รหัสผ่าน, และข้อมูลนักศึกษาถูกส่งเป็น plaintext
ใครที่อยู่บน network เดียวกัน (เช่น Wi-Fi มหาวิทยาลัย) สามารถดักอ่านได้ทันที

HTTPS เข้ารหัส traffic ด้วย TLS ทำให้ข้อมูลระหว่างทางอ่านไม่ได้ แม้ถูกดักจับ

### ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | การเปลี่ยนแปลง |
|------|---------------|
| [frontend/nginx.conf](../frontend/nginx.conf) | เพิ่ม server block port 80 (redirect) และ port 443 (HTTPS + SSL config) |
| [frontend/Dockerfile](../frontend/Dockerfile) | ใช้ `envsubst` แทน `${DOMAIN}` ใน nginx.conf ตอน container start |
| [docker-compose.yml](../docker-compose.yml) | เพิ่ม `certbot` service, port 443, volumes `certbot-conf` และ `certbot-www` |
| [scripts/init-letsencrypt.sh](../scripts/init-letsencrypt.sh) | Script สำหรับ bootstrap cert ครั้งแรก |
| [.env.example](../.env.example) | เพิ่ม `DOMAIN` และ `CERTBOT_EMAIL` |

### SSL Configuration ที่ใช้

```nginx
ssl_protocols     TLSv1.2 TLSv1.3;
ssl_ciphers       ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:...;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
```

- รองรับเฉพาะ TLS 1.2 และ 1.3 (ปิด TLS 1.0 / 1.1 ที่ถือว่า deprecated แล้ว)
- ใช้ cipher suites ที่แนะนำโดย Mozilla Modern compatibility

---

## 2. Logging และ Logrotate

### ทำอะไร

- กำหนด `access_log` และ `error_log` ใน nginx.conf พร้อม format ที่ระบุ IP, timestamp, status code, user agent
- Mount volume `nginx-logs` ออกมาที่ host เพื่อให้ logrotate เข้าถึงได้
- เพิ่ม Docker log rotation (`max-size: 10m`, `max-file: 7`) สำหรับ container stdout/stderr
- สร้าง [nginx/logrotate.conf](../nginx/logrotate.conf) สำหรับวาง host logrotate

### เพราะอะไร

Log format ที่กำหนด (`main`) บันทึก:
```
IP ลูกค้า - user - [เวลา] "request" status bytes "referer" "user_agent" "x-forwarded-for"
```

ข้อมูลนี้ใช้สำหรับ:
- **Audit trail** — ตรวจสอบว่าใคร access อะไรเมื่อไหร่
- **Incident response** — ถ้าโดน attack มีหลักฐานให้สืบสวน
- **Debugging** — ดู 4xx/5xx errors จริงที่เกิดบน production

หาก log ไม่มี Logrotate → ไฟล์โตไม่หยุด → disk เต็ม → server crash

### ขั้นตอนติดตั้ง Logrotate บน Server

```bash
# คัดลอก config ไปยัง logrotate.d
sudo cp nginx/logrotate.conf /etc/logrotate.d/gams-nginx

# ทดสอบว่า config ถูกต้อง
sudo logrotate --debug /etc/logrotate.d/gams-nginx

# ทดสอบ rotate จริง (dry-run)
sudo logrotate --force --dry-run /etc/logrotate.d/gams-nginx
```

Logrotate จะรัน daily (ผ่าน cron ของระบบ) หมุนเวียน log 14 วัน และ compress ด้วย gzip

---

## 3. Worker Processes Tuning

### ทำอะไร

เปลี่ยน nginx.conf จาก server block ล้วน เป็น full config ที่มี main context:

```nginx
worker_processes auto;
worker_rlimit_nofile 65536;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}
```

### เพราะอะไร

| ค่า | ความหมาย |
|-----|---------|
| `worker_processes auto` | nginx ใช้ CPU core เท่าที่ server มี แทนที่จะใช้แค่ 1 process (default) |
| `worker_rlimit_nofile 65536` | เพิ่ม file descriptor limit ให้รองรับ connection จำนวนมาก |
| `worker_connections 1024` | แต่ละ worker process รองรับ connection พร้อมกันได้ 1024 |
| `use epoll` | ใช้ Linux epoll I/O model ที่มีประสิทธิภาพกว่า select/poll |
| `multi_accept on` | worker รับ connection หลายอันพร้อมกันได้ แทนที่จะรับทีละอัน |

ผลลัพธ์: server 4 core → nginx มี 4 worker process → รองรับได้ถึง 4 × 1024 = 4,096 concurrent connections

---

## 4. Reverse Proxy

เดิมมีแล้ว — ปรับปรุงเพิ่ม header สำหรับ WebSocket support:

```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection 'upgrade';
proxy_cache_bypass $http_upgrade;
```

ทำให้รองรับ WebSocket connections ได้ในอนาคต หาก backend มีการใช้งาน

---

## 5. Proxy Cache สำหรับ Static Assets

### ทำอะไร

เพิ่ม proxy_cache_path และใช้ cache กับ static files:

```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=static_cache:10m
                 max_size=500m inactive=24h use_temp_path=off;
```

และใช้ cache ใน location block ของ static assets:

```nginx
proxy_cache static_cache;
proxy_cache_valid 200 24h;
```

### เพราะอะไร

Static files (JS, CSS, รูปภาพ) ไม่เปลี่ยนแปลงบ่อย การ cache ไว้ใน nginx memory/disk
ทำให้ไม่ต้อง read จาก container filesystem ทุกครั้ง ลด latency และ CPU load

---

## 6. Security Headers

เพิ่ม HTTP security headers ใน HTTPS server block:

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options DENY always;
add_header X-Content-Type-Options nosniff always;
```

| Header | ป้องกัน |
|--------|--------|
| `Strict-Transport-Security` (HSTS) | Browser บังคับใช้ HTTPS ตลอด 1 ปี ป้องกัน SSL stripping attack |
| `X-Frame-Options: DENY` | ป้องกัน Clickjacking — ไม่ให้เว็บอื่น embed หน้าของเราใน iframe |
| `X-Content-Type-Options: nosniff` | ป้องกัน MIME sniffing attack ใน browser |

---

## 7. ขั้นตอนการ Deploy บน Server จริง

### ก่อน Deploy (ทำครั้งเดียว)

1. ตั้งค่า DNS A record ของ domain ให้ชี้ไปที่ IP ของ server
2. เปิด port 80 และ 443 บน firewall ของ server
3. คัดลอกและแก้ไข `.env`:

```bash
cp .env.example .env
# แก้ DOMAIN, CERTBOT_EMAIL, MYSQL_ROOT_PASSWORD, JWT_SECRET
```

4. รัน init script เพื่อขอ SSL certificate ครั้งแรก:

```bash
chmod +x scripts/init-letsencrypt.sh
./scripts/init-letsencrypt.sh
```

### Start Stack

```bash
docker compose up -d
```

### ติดตั้ง Logrotate

```bash
sudo cp nginx/logrotate.conf /etc/logrotate.d/gams-nginx
```

### ตรวจสอบ Certificate

```bash
# ดูข้อมูล certificate ที่ได้
docker compose run --rm certbot certbot certificates

# ทดสอบ auto-renewal (dry-run)
docker compose run --rm certbot certbot renew --dry-run
```

### ดู Nginx Logs

```bash
# Access log แบบ real-time
docker exec gams-frontend tail -f /var/log/nginx/access.log

# Error log
docker exec gams-frontend tail -f /var/log/nginx/error.log
```

---

## สรุปไฟล์ที่เปลี่ยนแปลง

| ไฟล์ | สถานะ | สิ่งที่ทำ |
|------|-------|---------|
| [frontend/nginx.conf](../frontend/nginx.conf) | แก้ไข | Full config: worker tuning, HTTPS, logging, proxy_cache, security headers |
| [frontend/Dockerfile](../frontend/Dockerfile) | แก้ไข | ติดตั้ง `gettext` (envsubst), expose port 443, CMD ใช้ envsubst |
| [docker-compose.yml](../docker-compose.yml) | แก้ไข | certbot service, port 443, volumes สำหรับ cert และ logs, log rotation |
| [nginx/logrotate.conf](../nginx/logrotate.conf) | สร้างใหม่ | Config สำหรับวางบน host ที่ `/etc/logrotate.d/gams-nginx` |
| [scripts/init-letsencrypt.sh](../scripts/init-letsencrypt.sh) | สร้างใหม่ | Bootstrap certificate ครั้งแรก |
| [.env.example](../.env.example) | แก้ไข | เพิ่ม `DOMAIN` และ `CERTBOT_EMAIL` |
