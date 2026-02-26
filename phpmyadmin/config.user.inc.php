<?php
// phpMyAdmin user configuration
// Mount ไว้ที่ /etc/phpmyadmin/config.user.inc.php ใน container

// ปิดการ login ด้วย root — ลด attack surface ของ brute force
$cfg['Servers'][1]['AllowRoot'] = false;

// ไม่อนุญาต login โดยไม่มีรหัสผ่าน
$cfg['Servers'][1]['AllowNoPassword'] = false;

// ป้องกัน login เฉพาะ user ที่อยู่ใน allowlist (whitelist mode)
// หากต้องการเพิ่ม user ที่อนุญาต ให้เพิ่มใน array นี้
$cfg['Servers'][1]['AllowDeny']['order'] = 'deny,allow';
$cfg['Servers'][1]['AllowDeny']['rules'] = [
    'deny % from all',
    'allow % from localhost',
];
