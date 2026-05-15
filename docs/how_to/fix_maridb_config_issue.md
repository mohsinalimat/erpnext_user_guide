# MariaDB Configuration Issue Troubleshooting Guide
## ERPNext / Frappe Development Environment

---

# 1. Initial Issue

MariaDB server failed to start on Ubuntu system running ERPNext/Frappe environment.

Commands used for diagnosis:

```bash
systemctl status mariadb.service
journalctl -xeu mariadb.service
```

---

# 2. Initial Root Cause

The logs showed:

```text
Referenced but unset environment variable evaluates to a
```

MariaDB service contained:

```bash
ExecStart=/usr/sbin/mariadbd $MYSQLD_OPTS $_WSREP_NEW_CLUSTER $_WSREP_START_POSITION
```

Undefined variables caused MariaDB startup failure.

---

# 3. Fix for systemd Environment Variables

```bash
sudo systemctl edit mariadb
```

Added:

```ini
[Service]
ExecStart=
ExecStart=/usr/sbin/mariadbd
```

Reloaded systemd:

```bash
sudo systemctl daemon-reexec
sudo systemctl daemon-reload
```

---

# 4. File Limit Issue

MariaDB later failed with:

```text
Could not increase number of max_open_files
```

Fix applied:

```bash
sudo systemctl edit mariadb
```

Added:

```ini
[Service]
LimitNOFILE=200000
```

---

# 5. MySQL Configuration Fixes

Edited:

```bash
sudo nano /etc/mysql/mariadb.conf.d/50-server.cnf
```

Changed:

```ini
open_files_limit = 164372
```

to:

```ini
open_files_limit = 65535
```

---

# 6. Missing Log Directory

Error:

```text
tail: cannot open '/var/log/mysql/error.log'
```

Fix:

```bash
sudo mkdir -p /var/log/mysql
sudo chown -R mysql:mysql /var/log/mysql
```

---

# 7. Final Root Cause

Critical MariaDB error:

```text
[ERROR] mariadbd: Out of memory (Needed 2635356248 bytes)
[ERROR] InnoDB: Cannot map innodb_buffer_pool_size_max=4664m
[ERROR] InnoDB: Plugin initialization aborted with error Generic error
[ERROR] Plugin 'InnoDB' registration as a STORAGE ENGINE failed.
[ERROR] Aborting
```

---

# 8. Actual Problem

System RAM:

```text
~1.9 GB
```

Configured buffer pool:

```ini
innodb_buffer_pool_size = 4664M
```

MariaDB attempted to allocate more RAM than available.

---

# 9. Final Resolution

Updated configuration:

```ini
innodb_buffer_pool_size = 768M
```

MariaDB started successfully afterward.

---

# 10. Recommended MariaDB Configuration for 2GB RAM

```ini
[mysqld]

innodb_buffer_pool_size = 768M
innodb_buffer_pool_instances = 1
innodb_log_file_size = 128M
innodb_flush_method = O_DIRECT

max_connections = 100
table_open_cache = 2000
tmp_table_size = 64M
max_heap_table_size = 64M

character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci
```

---

# 11. Useful Commands

## Validate Config

```bash
sudo mariadbd --validate-config
```

## Check Status

```bash
sudo systemctl status mariadb
```

## View Logs

```bash
sudo journalctl -u mariadb.service -n 50 --no-pager
```

## Check RAM Usage

```bash
free -h
```

---

# End of Document
