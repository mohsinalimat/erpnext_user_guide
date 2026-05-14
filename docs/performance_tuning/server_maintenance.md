# Server Maintenance & Production Optimization Guide

## System Review, Performance Tuning, ERPNext Optimization, Docker, Redis & MariaDB Production Configuration

---

# 📌 Overview

This document compiles the complete discussion, recommendations, optimizations, and production-grade maintenance procedures for a Linux workstation/server running:

* Ubuntu 24.04
* ERPNext / Frappe
* Docker
* Redis
* MariaDB
* AI / Python workloads

System reviewed:

* Lenovo IdeaPad Slim 5 13ARP10
* AMD Ryzen 5 7535HS (6C/12T)
* 12 GB RAM
* UEFI BIOS
* GNOME Desktop

---

# 🔍 Initial System Assessment

## Hardware Summary

| Component       | Details            |
| --------------- | ------------------ |
| CPU             | AMD Ryzen 5 7535HS |
| Cores / Threads | 6C / 12T           |
| Max Frequency   | 4.6 GHz            |
| RAM             | 12 GB              |
| Swap            | 4 GB               |
| BIOS            | Lenovo PYCN28WW    |
| Virtualization  | AMD-V Supported    |

---

## Memory Analysis

```bash
Mem: 12Gi
Used: 4.7Gi
Available: 8.0Gi
Swap Used: 0
```

### Interpretation

* No memory pressure
* Healthy Linux caching
* System not under stress

---

# ⚠️ Identified Risks & Issues

## Residual Packages

Found partially removed packages:

```bash
apache2
libapache2-mod-php8.3
```

### Recommendation

```bash
sudo apt purge apache2 libapache2-mod-php8.3 -y
sudo apt autoremove --purge -y
```

---

## Unnecessary Services

Potentially unnecessary services consuming resources:

* avahi-daemon
* cups
* gnome-remote-desktop

### Disable Unused Services

```bash
sudo systemctl disable --now avahi-daemon
sudo systemctl disable --now cups
sudo systemctl disable --now gnome-remote-desktop
```

---

# 🔐 Security Hardening

## Enable Firewall

```bash
sudo ufw enable
sudo ufw default deny incoming
sudo ufw allow OpenSSH
```

---

## Enable Fail2Ban

```bash
sudo systemctl enable --now fail2ban
```

---

# ⚙️ Swap Optimization

## Reduce Swappiness

```bash
sudo sysctl vm.swappiness=10
```

Persist:

```bash
echo "vm.swappiness=10" | sudo tee -a /etc/sysctl.conf
```

---

# 🧾 Log Cleanup

```bash
sudo journalctl --vacuum-time=7d
```

---

# 🛠️ Useful Administration Tools

```bash
sudo apt install htop iotop ncdu net-tools -y
```

---

# ⚡ GNOME Performance Optimization

Disable animations:

```bash
gsettings set org.gnome.desktop.interface enable-animations false
```

---

# 🚀 Production Maintenance Script

## File: sys-maintenance.sh

```bash
#!/bin/bash

set -e

LOG_FILE="/var/log/sys_maintenance.log"
DATE=$(date +"%Y-%m-%d %H:%M:%S")

echo "==================================================" | tee -a $LOG_FILE
echo "🚀 Maintenance Started at $DATE" | tee -a $LOG_FILE
echo "==================================================" | tee -a $LOG_FILE

if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root"
  exit 1
fi

apt update -y && apt upgrade -y
apt autoremove --purge -y
apt autoclean

journalctl --vacuum-time=7d

if command -v docker &> /dev/null; then
  docker system prune -af --volumes
fi

if systemctl is-active --quiet redis-server; then
  redis-cli CONFIG SET maxmemory 1500000000
  redis-cli CONFIG SET maxmemory-policy allkeys-lru
fi

if systemctl is-active --quiet mariadb; then
  mysqladmin ping
fi

if command -v bench &> /dev/null; then
  cd ~/frappe-bench || exit

  bench --site all clear-cache
  bench --site all clear-website-cache
  bench --site all cleanup
  bench --site all doctor

  bench restart
fi

systemctl is-active fail2ban
ufw status

echo "✅ Maintenance Completed"
```

---

# ⏱️ Automate via Cron

```bash
sudo crontab -e
```

Add:

```bash
0 2 * * * /usr/local/bin/sys-maintenance.sh
```

---

# 🐳 Docker Optimization

## daemon.json

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m",
    "max-file": "3"
  },
  "storage-driver": "overlay2",
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 1048576,
      "Soft": 1048576
    }
  }
}
```

Restart Docker:

```bash
sudo systemctl restart docker
```

---

# 🧠 Redis Production Optimization

## Recommended Redis Memory

For this 12GB RAM system:

| Use Case         | Recommended |
| ---------------- | ----------- |
| ERPNext only     | 1–1.5 GB    |
| ERPNext + Docker | 1.5–2 GB    |
| ERPNext + AI     | 1–1.5 GB    |

---

## Redis Configuration

Edit:

```bash
sudo nano /etc/redis/redis.conf
```

Add:

```conf
maxmemory 1.5gb
maxmemory-policy allkeys-lru
```

Restart:

```bash
sudo systemctl restart redis-server
```

Verify:

```bash
redis-cli INFO memory | grep maxmemory
```

---

# 🗄️ MariaDB Production Tuning

## Recommended File

```bash
/etc/mysql/mariadb.conf.d/99-erpnext.cnf
```

---

## Production Configuration

```ini
[mysqld]

innodb_buffer_pool_size = 4G
innodb_buffer_pool_instances = 4
innodb_log_file_size = 1G
innodb_log_buffer_size = 256M

max_connections = 150
thread_cache_size = 100

innodb_flush_method = O_DIRECT
innodb_flush_log_at_trx_commit = 2
innodb_file_per_table = 1
innodb_io_capacity = 1000
innodb_io_capacity_max = 2000

query_cache_type = 0
query_cache_size = 0

tmp_table_size = 256M
max_heap_table_size = 256M

table_open_cache = 4000
table_definition_cache = 2000

slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 2

open_files_limit = 65535

character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci
```

Restart MariaDB:

```bash
sudo systemctl restart mariadb
```

---

# 📁 Why Use `99-erpnext.cnf`?

MariaDB loads config files alphabetically.

Example:

```bash
50-server.cnf
60-galera.cnf
99-erpnext.cnf
```

### Why `99-`?

* Loads last
* Overrides previous configs
* Safer upgrades
* Avoids modifying system defaults

---

# 📂 Difference Between `conf.d` and `mariadb.conf.d`

## `/etc/mysql/conf.d`

* Generic MySQL-compatible configs
* Client-side or shared configs

## `/etc/mysql/mariadb.conf.d`

* MariaDB server-specific tuning
* Main location for production DB tuning

### Best Practice

Use:

```bash
/etc/mysql/mariadb.conf.d/99-erpnext.cnf
```

---

# 🚀 ERPNext Optimization

## common_site_config.json

```json
{
  "workers": 4,
  "gunicorn_workers": 3,
  "background_workers": 2
}
```

---

# 🤖 AI Workload Optimization

## Install Essentials

```bash
sudo apt install python3-pip python3-venv -y
pip install --upgrade pip
```

---

## CPU Thread Tuning

```bash
export OMP_NUM_THREADS=6
export MKL_NUM_THREADS=6
```

---

# 📊 Final Recommended Resource Allocation

| Component       | RAM      |
| --------------- | -------- |
| OS + GNOME      | 2 GB     |
| Redis           | 1–1.5 GB |
| ERPNext Workers | 2–3 GB   |
| Docker / AI     | 2–3 GB   |
| MariaDB         | 4 GB     |

---

# 🔥 Final SysAdmin Recommendations

## Recommended Structure

```bash
/etc/mysql/mariadb.conf.d/
 ├── 50-server.cnf
 ├── 60-galera.cnf
 ├── 90-tuning.cnf
 └── 99-erpnext.cnf
```

---

# ✅ Final Verdict

The system is:

* Modern
* Production-capable
* Suitable for ERPNext + Docker + AI workloads

After optimization:

* Better stability
* Reduced RAM waste
* Improved database performance
* Faster ERPNext responsiveness
* Safer production environment

---

# 📌 Recommended Next Improvements

Future enhancements:

* Nginx reverse proxy optimization
* Supervisor tuning
* Grafana + Prometheus monitoring
* Redis multi-instance setup
* MariaDB slow query analysis
* Automated backup strategy
* Local LLM inference server tuning

---

# End of Document
