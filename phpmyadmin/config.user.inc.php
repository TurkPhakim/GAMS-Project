<?php
// phpMyAdmin user configuration
// Mount ไว้ที่ /etc/phpmyadmin/config.user.inc.php ใน container

// ปิดการ login ด้วย root — ลด attack surface ของ brute force
$cfg['Servers'][1]['AllowRoot'] = false;

// ไม่อนุญาต login โดยไม่มีรหัสผ่าน
$cfg['Servers'][1]['AllowNoPassword'] = false;

