# คู่มือ Deploy GAMS บน Ubuntu Server (Production)

> คู่มือฉบับสมบูรณ์สำหรับ server จริง — QUICK_START.md มีคำสั่งหลักย่อๆ ไฟล์นี้อธิบายทุกขั้นตอนพร้อมเหตุผล

---

## ข้อกำหนดเบื้องต้น

| รายการ | ขั้นต่ำ |
|--------|---------|
| OS | Ubuntu Server 22.04 LTS |
| RAM | 4GB |
| Disk | 20GB |
| Network | Static IP — internal (172.16.x.x) หรือ domain จริง |
| Ports เปิดจาก IT | 22 (SSH), 80 (HTTP), 443 (HTTPS) |

---

## ขั้นตอนที่ 1: ติดตั้ง Docker Engine

```bash
# เพิ่ม Docker repository
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# ติดตั้ง Docker Engine + Compose Plugin
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# เพิ่ม user ปัจจุบันเข้า docker group
sudo usermod -aG docker $USER
newgrp docker

# ตรวจสอบ
docker --version
docker compose version
```

---

## ขั้นตอนที่ 2: ตั้งค่า UFW Firewall (มิติที่ 2)

```bash
# นโยบาย default: ปิดทุก incoming, เปิดทุก outgoing
sudo ufw default deny incoming
sudo ufw default allow outgoing

# เปิดเฉพาะ port ที่จำเป็น
sudo ufw allow 22/tcp comment 'SSH admin'
sudo ufw allow 80/tcp comment 'HTTP → redirect HTTPS'
sudo ufw allow 443/tcp comment 'HTTPS'

# เปิดใช้งาน
sudo ufw enable

# ตรวจสอบ
sudo ufw status verbose
```

**หมายเหตุ Docker + UFW:** Docker ใช้ iptables โดยตรง ทำให้ port ที่ map ออกมา (เช่น 3306) อาจ bypass UFW ได้
→ ดูขั้นตอนที่ 5 เพื่อปิด MySQL port อย่างถูกต้อง

---

## ขั้นตอนที่ 3: Clone โปรเจคและตั้งค่า .env

```bash
# Clone โปรเจค
git clone <repo-url> ~/www/GAMS-Project
cd ~/www/GAMS-Project

# สร้าง .env
cp .env.example .env
nano .env
```

ค่าสำคัญที่ต้องแก้ใน `.env`:

| ตัวแปร | ค่าที่ต้องแก้ | ตัวอย่าง |
|--------|-------------|---------|
| `DOMAIN` | IP หรือ domain ของ server | `172.16.10.201` |
| `CERTBOT_EMAIL` | email รับแจ้ง cert หมดอายุ | `admin@kmitl.ac.th` |
| `MYSQL_ROOT_PASSWORD` | รหัสผ่าน MySQL root | ดูคำสั่งสร้างด้านล่าง |
| `MYSQL_APP_PASSWORD` | รหัสผ่าน app user | ดูคำสั่งสร้างด้านล่าง |
| `JWT_SECRET` | secret ≥ 64 ตัวอักษร | ดูคำสั่งสร้างด้านล่าง |
| `ADMIN_IP_RANGE` | subnet เข้า phpMyAdmin | `172.16.0.0/20` |
| `PMA_SECRET_PATH` | URL path ของ phpMyAdmin | `db-gaos-kmitl-2026` |

สร้าง random secrets:

```bash
# MYSQL_ROOT_PASSWORD
openssl rand -base64 32

# MYSQL_APP_PASSWORD
openssl rand -base64 32

# JWT_SECRET (ต้องการ 64+ ตัวอักษร)
openssl rand -hex 32
```

---

## ขั้นตอนที่ 4: ตั้งค่า SSL Certificate

### Option A: มี Domain จริง + port 80 เปิดจาก internet (Let's Encrypt)

**ข้อกำหนด:**
- `DOMAIN` ใน .env ต้องเป็น domain จริง เช่น `gams.kmitl.ac.th`
- DNS A record ของ domain ต้องชี้มาที่ IP ของ server
- Port 80 ต้องเปิดรับ request จาก internet (Let's Encrypt verification)

```bash
chmod +x scripts/init-letsencrypt.sh
./scripts/init-letsencrypt.sh
```

Script จะทำ 4 ขั้นตอนอัตโนมัติ:
1. สร้าง self-signed cert ชั่วคราว → nginx start ได้
2. Start nginx container
3. ขอ Let's Encrypt certificate จริง (ผ่าน ACME HTTP challenge)
4. Reload nginx ด้วย cert จริง

certbot service ใน Docker จะ auto-renew ทุก 12 ชั่วโมงโดยอัตโนมัติ

---

### Option B: Internal IP — ไม่มี domain จริง (Self-signed)

ใช้สำหรับ server ที่ IP ภายใน เช่น **172.16.10.201** ของมหาวิทยาลัย
ซึ่ง Let's Encrypt ไม่รองรับ IP address โดยตรง

ตรวจสอบว่า `DOMAIN=172.16.10.201` ใน `.env` แล้วรัน:

```bash
source .env

docker compose run --rm --entrypoint "" certbot sh -c "
    mkdir -p /etc/letsencrypt/live/$DOMAIN && \
    openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
        -keyout /etc/letsencrypt/live/$DOMAIN/privkey.pem \
        -out    /etc/letsencrypt/live/$DOMAIN/fullchain.pem \
        -subj '/CN=$DOMAIN'
"

echo "Self-signed certificate created (valid 10 years)"
```

**ผลที่ได้:** browser จะแสดง "Your connection is not private" เพราะ cert ไม่ได้รับรองโดย CA
ต้องกด Advanced → Proceed เพื่อเข้าใช้งาน — ข้อมูลยังคงถูกเข้ารหัสด้วย TLS

---

## ขั้นตอนที่ 5: Production Override — ปิด MySQL Port

ป้องกัน MySQL port 3306 ไม่ให้ถูก expose ออกมา (Docker bypass UFW ได้)

สร้าง `docker-compose.override.yml` ในโฟลเดอร์โปรเจค:

```yaml
# docker-compose.override.yml — production only
# ปิด MySQL external port (accessible ผ่าน Docker network เท่านั้น)
services:
  mysql:
    ports: []
```

```bash
# ตรวจสอบว่าไฟล์ถูกสร้างแล้ว
cat docker-compose.override.yml

# Docker Compose จะ merge ไฟล์นี้อัตโนมัติตอน up
```

> **หมายเหตุ:** ไม่ต้อง commit ไฟล์นี้ขึ้น git — เป็น production-only config

---

## ขั้นตอนที่ 6: Build + Start

```bash
cd ~/www/GAMS-Project

docker compose up -d --build

# ตรวจสอบสถานะ — ควรเป็น Up / healthy ทุก service
docker compose ps

# ดู logs ถ้ามี error
docker compose logs -f
```

รอ 30-60 วินาทีให้ MySQL initialize แล้วทดสอบ:

```bash
curl -k https://172.16.10.201/api/health
# {"status":"ok"}
```

---

## ขั้นตอนที่ 7: ติดตั้ง Logrotate (มิติที่ 3)

```bash
sudo cp nginx/logrotate.conf /etc/logrotate.d/gams-nginx

# ทดสอบ config (dry-run ไม่แตะไฟล์จริง)
sudo logrotate -d /etc/logrotate.d/gams-nginx

# ตรวจสอบว่า config ถูกต้อง
cat /etc/logrotate.d/gams-nginx
```

---

## ขั้นตอนที่ 8: SSH Hardening (มิติที่ 5)

> **สำคัญ:** ต้องตั้งค่า SSH Key และทดสอบให้ login ได้ก่อนปิด password login

### 8.1 สร้างและ copy SSH Key (บนเครื่อง local ของ admin)

```bash
# สร้าง key pair ถ้ายังไม่มี
ssh-keygen -t ed25519 -C "gams-admin"

# Copy public key ขึ้น server
ssh-copy-id ubuntu@172.16.10.201

# ทดสอบ login ด้วย key ก่อน (ยังอย่าปิด password login)
ssh -i ~/.ssh/id_ed25519 ubuntu@172.16.10.201
```

### 8.2 ปิด Password Login (หลังยืนยัน key login ได้แล้ว)

```bash
sudo nano /etc/ssh/sshd_config
```

แก้ค่าดังนี้ (ถ้ามี `#` นำหน้าให้เอาออก):

```
PasswordAuthentication no
PermitRootLogin no
```

```bash
sudo systemctl restart sshd

# ทดสอบใน terminal ใหม่ว่า SSH ยังใช้งานได้ก่อนปิด terminal เดิม
ssh ubuntu@172.16.10.201

# ตรวจสอบ
sudo sshd -T | grep -E "passwordauthentication|permitrootlogin"
# passwordauthentication no
# permitrootlogin no
```

---

## ขั้นตอนที่ 9: ติดตั้ง Fail2Ban (มิติที่ 5)

```bash
sudo apt-get install -y fail2ban

# สร้าง local config (ไม่แก้ไฟล์หลักเพื่อไม่ให้หายตอน update)
sudo tee /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port    = 22
logpath = /var/log/auth.log
EOF

sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# ตรวจสอบ
sudo fail2ban-client status
sudo fail2ban-client status sshd
```

---

## ขั้นตอนที่ 10: User Management (มิติที่ 1 Server)

### 10.1 สร้าง Linux Groups

```bash
sudo groupadd sysadmin
sudo groupadd webdev
sudo groupadd dbadmin

# เพิ่มสมาชิกตามบทบาท (แทนที่ <username> ด้วย username จริง)
sudo usermod -aG sysadmin <admin_username>
sudo usermod -aG webdev <developer_username>
sudo usermod -aG dbadmin <dba_username>

# Dev ต้องการ docker access ด้วย
sudo usermod -aG docker <developer_username>
sudo usermod -aG docker <dba_username>

# ตรวจสอบ
getent group sysadmin webdev dbadmin
```

### 10.2 Web Directory Permissions (SGID)

```bash
# กำหนด owner:group และ permission ของโฟลเดอร์โปรเจค
sudo chown -R ubuntu:webdev ~/www/GAMS-Project
sudo chmod -R 2775 ~/www/GAMS-Project

# 2775 = SGID (2) + rwxrwxr-x (775)
# SGID: ไฟล์ใหม่ที่สร้างใน directory inherit group webdev โดยอัตโนมัติ
# webdev members: อ่าน+เขียน | others: อ่านอย่างเดียว

# ตรวจสอบ
ls -la ~/www/GAMS-Project
# drwxrwsr-x ... ubuntu webdev GAMS-Project   ← s = SGID
```

### 10.3 Sudoers แบบจำกัด

```bash
# สร้าง wrapper scripts สำหรับ restricted commands
sudo tee /usr/local/bin/gams-restart-frontend << 'EOF'
#!/bin/bash
cd /home/ubuntu/www/GAMS-Project && docker compose restart frontend
EOF
sudo chmod +x /usr/local/bin/gams-restart-frontend

# ตั้งค่า sudoers
sudo tee /etc/sudoers.d/gams << 'EOF'
# webdev: restart frontend container เท่านั้น
%webdev ALL=(ALL) NOPASSWD: /usr/local/bin/gams-restart-frontend

# dbadmin: เข้าถึง MySQL container เท่านั้น
%dbadmin ALL=(ALL) NOPASSWD: /usr/bin/docker exec gams-mysql mysql *
EOF

sudo chmod 440 /etc/sudoers.d/gams

# ตรวจสอบ syntax (ห้ามมี error)
sudo visudo -c -f /etc/sudoers.d/gams
```

---

## ขั้นตอนที่ 11: Auto-updates (มิติที่ 2 Server)

```bash
sudo apt-get install -y unattended-upgrades

# เปิดใช้งาน auto-updates
sudo dpkg-reconfigure -plow unattended-upgrades
# เลือก "Yes" เมื่อถาม

# ตรวจสอบ
sudo systemctl status unattended-upgrades
```

---

## ขั้นตอนที่ 12: ตั้งค่า Auto Backup (DR)

### 12.1 สร้าง Backup Directory และ Script

```bash
# สร้าง directory
sudo mkdir -p /backup/gams/daily
sudo chown ubuntu:ubuntu /backup/gams
chmod 700 /backup/gams

# สร้าง backup script
sudo tee /opt/gams-backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backup/gams"
DATE=$(date +%Y%m%d_%H%M%S)
COMPOSE_DIR="/home/ubuntu/www/GAMS-Project"

mkdir -p $BACKUP_DIR/daily

# Dump database ผ่าน Docker container (ไม่ต้อง expose MySQL port)
# ใช้ environment variable ที่ตั้งไว้ใน MySQL container โดยตรง
docker exec gams-mysql sh -c \
  'exec mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers gams_db' \
  | gzip > $BACKUP_DIR/daily/gams_${DATE}.sql.gz

# ลบ backup รายวันที่เก่ากว่า 7 วัน
find $BACKUP_DIR/daily -name "*.sql.gz" -mtime +7 -delete

echo "$(date): Backup completed → gams_${DATE}.sql.gz ($(du -sh $BACKUP_DIR/daily/gams_${DATE}.sql.gz | cut -f1))"
EOF

sudo chmod +x /opt/gams-backup.sh
```

### 12.2 ตั้ง Cron Job

```bash
# รัน backup ทุกคืน 02:00
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/gams-backup.sh >> /var/log/gams-backup.log 2>&1") | crontab -

# ตรวจสอบ
crontab -l
```

### 12.3 ทดสอบ Backup ทันที

```bash
sudo /opt/gams-backup.sh
ls -lh /backup/gams/daily/
# -rw-r--r-- ... gams_20260228_020000.sql.gz
```

---

## Checklist ก่อน Go-Live

ตรวจสอบทุกข้อก่อนเปิดใช้งานจริง:

| # | รายการ | คำสั่งตรวจสอบ |
|---|--------|--------------|
| 1 | Docker services ทั้งหมด Up/Healthy | `docker compose ps` |
| 2 | HTTPS ทำงาน, HTTP redirect | `curl -I http://172.16.10.201` |
| 3 | API ตอบกลับได้ | `curl -k https://172.16.10.201/api/health` |
| 4 | Login ทุก role ทำได้ | ทดสอบผ่าน browser |
| 5 | phpMyAdmin เข้าได้เฉพาะ subnet ที่กำหนด | ทดสอบจาก IP นอก subnet |
| 6 | phpMyAdmin: root login ถูก reject | ลองล็อกอินด้วย username `root` |
| 7 | UFW เปิดเฉพาะ port 80, 443, 22 | `sudo ufw status` |
| 8 | MySQL port 3306 ไม่เปิดสู่ภายนอก | `sudo ss -tlnp \| grep 3306` (ไม่ควรเห็น) |
| 9 | SSH key login ทำงาน | ทดสอบ SSH ด้วย key |
| 10 | SSH password login ถูก reject | `ssh -o PreferredAuthentications=password ...` |
| 11 | Fail2Ban รันอยู่ | `sudo fail2ban-client status` |
| 12 | unattended-upgrades active | `systemctl status unattended-upgrades` |
| 13 | Logrotate config ถูกต้อง | `sudo logrotate -d /etc/logrotate.d/gams-nginx` |
| 14 | Backup script รันได้ | `ls -lh /backup/gams/daily/` |
| 15 | nginx access log บันทึกได้ | `docker exec gams-frontend tail -5 /var/log/nginx/gams-access.log` |

---

## แผนผังสรุปสิ่งที่ตั้งค่าบน Server

```
Ubuntu Server (172.16.10.201)
│
├── UFW Firewall
│   ├── Allow: 22 (SSH), 80 (HTTP), 443 (HTTPS)
│   └── Deny: ทุกอย่างที่เหลือ
│
├── SSH
│   ├── PasswordAuthentication no
│   ├── PermitRootLogin no
│   └── Key-based login only
│
├── Fail2Ban
│   └── SSH brute force → ban 1 ชั่วโมง
│
├── Linux Groups
│   ├── sysadmin → sudo เต็มรูปแบบ
│   ├── webdev → docker group + restart frontend
│   └── dbadmin → docker group + exec mysql
│
├── Auto-updates (unattended-upgrades)
│   └── Security patches อัตโนมัติทุกวัน
│
├── Cron Jobs
│   └── 02:00 → /opt/gams-backup.sh → /backup/gams/daily/
│
└── Docker Compose (GAMS Stack)
    ├── gams-frontend (nginx: port 80, 443)
    ├── gams-backend (Express: port 3000 internal)
    ├── gams-mysql (MySQL: ไม่เปิด port ออกนอก)
    ├── gams-phpmyadmin (port 80 internal)
    ├── gams-freeradius (port 1812 internal)
    └── gams-certbot (auto-renew SSL)
```

---

Last Updated: February 28, 2026
