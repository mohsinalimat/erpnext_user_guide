# NGINX Permission Denied Error Guide

## Overview
This document provides troubleshooting steps for resolving the NGINX `Permission denied` error for site paths on Ubuntu/Debian systems.

---

# Problem Statement

User reported:

> nginx error "Permission denied" for site path

This error usually indicates that the NGINX worker process does not have sufficient operating system permissions to access files or directories defined in the site root path.

---

# Step 1: Check NGINX Error Logs

Run the following command to inspect detailed errors:

```bash
sudo tail -f /var/log/nginx/error.log
```

Typical errors:

- `permission denied`
- `stat() failed (13: Permission denied)`
- `open() ".../index.html" failed (13: Permission denied)`

---

# Step 2: Identify NGINX User

Check which user NGINX runs as:

```bash
ps aux | grep nginx
```

Common users:

- `www-data` (Ubuntu/Debian)
- `nginx` (RHEL/CentOS)

---

# Step 3: Fix Directory Permissions (Most Common Cause)

NGINX requires execute (`x`) permission on every parent directory.

Example site path:

```text
/home/$USER/myapp/public
```

## Incorrect Permissions

```bash
drwx------ $USER $USER /home/$USER
```

NGINX cannot traverse the directory.

## Correct Permissions

```bash
sudo chmod o+x /home/$USER
sudo chmod o+x /home/$USER/myapp
sudo chmod o+x /home/$USER/myapp/public
```

### Safer Group-Based Approach

```bash
sudo usermod -aG $USER www-data
sudo chmod 750 /home/$USER
sudo chmod 750 /home/$USER/myapp
sudo chmod 750 /home/$USER/myapp/public
```

---

# Step 4: Fix File Permissions

Ensure files are readable:

```bash
sudo find /home/$USER/myapp/public -type f -exec chmod 644 {} \;
sudo find /home/$USER/myapp/public -type d -exec chmod 755 {} \;
```

---

# Step 5: Check SELinux (RHEL/CentOS Only)

Verify SELinux status:

```bash
getenforce
```

If SELinux is enabled (`Enforcing`):

```bash
sudo setsebool -P httpd_read_user_content 1
```

Or relabel content:

```bash
sudo chcon -R -t httpd_sys_content_t /path/to/site
```

Note:
SELinux configuration is generally not required on Ubuntu.

---

# Step 6: Verify NGINX Root Directive

Check active root paths:

```bash
sudo nginx -T | grep root
```

Example configuration:

```nginx
server {
    root /home/$USER/myapp/public;
    index index.html index.htm;
}
```

Ensure the path exists and is correct.

---

# Step 7: Application-Specific Fixes

## Laravel

```bash
sudo chown -R www-data:www-data storage bootstrap/cache
sudo chmod -R 775 storage bootstrap/cache
```

## Frappe / ERPNext

```bash
sudo chown -R frappe:frappe /home/frappe/frappe-bench
sudo chmod -R 755 /home/frappe
```

NGINX must be able to read:

- `sites/assets`
- `sites/site_name/public`

---

# Step 8: Reload NGINX

After making changes:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

# Quick Safe Fix for /var/www

If your website is hosted under `/var/www`:

```bash
sudo chown -R www-data:www-data /var/www/my-site
sudo chmod -R 755 /var/www/my-site
```

---


# End of Document
