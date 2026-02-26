#!/bin/bash
# 03-create-app-user.sh
#
# รันอัตโนมัติโดย MySQL Docker image ตอน first-init (ครั้งแรกที่ container สร้าง volume ใหม่)
# สร้าง user เฉพาะสำหรับ backend โดยจำกัดสิทธิ์แค่ที่จำเป็น
# ไม่ให้ backend ต่อ MySQL ด้วย root

set -e

mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" "${MYSQL_DATABASE}" <<EOF
CREATE USER IF NOT EXISTS '${MYSQL_APP_USER}'@'%' IDENTIFIED BY '${MYSQL_APP_PASSWORD}';

-- จำกัดสิทธิ์เฉพาะ operation ที่ application ต้องใช้จริง
GRANT SELECT, INSERT, UPDATE, DELETE ON \`${MYSQL_DATABASE}\`.* TO '${MYSQL_APP_USER}'@'%';

FLUSH PRIVILEGES;
EOF

echo "[GAMS] App user '${MYSQL_APP_USER}' created with SELECT/INSERT/UPDATE/DELETE on ${MYSQL_DATABASE}"
