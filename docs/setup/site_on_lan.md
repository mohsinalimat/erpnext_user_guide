# ERPNext LAN Production Deployment Guide
## Secure ERPNext Access on Local Network with SSL, Firewall, NGINX, and MariaDB Tuning

---

# System Information

| Component | Details |
|---|---|
| Laptop | Dell (2014 Model) |
| OS | Ubuntu 24.04 |
| RAM | 8GB DDR4 |
| CPU | Intel 8 Cores |
| GPU | Nvidia |
| VRAM | 4GB |
| Storage | 500GB HDD |

---

# Objective

Configure localhost ERPNext site named `erpnext.local` running on a laptop so it can be securely accessed:

- From devices connected on same WiFi
- Via LAN cable
- Using HTTPS/SSL
- With production-ready NGINX + MariaDB configuration
- With firewall hardening
- With backup automation

---

# 1. Network Setup (LAN Accessibility)

## Check Local IP Address

```bash
ip a | grep inet
```

Example:
```bash
192.168.1.10
```

---

## Configure Static IP

Edit netplan:

```bash
sudo nano /etc/netplan/01-network-manager-all.yaml
```

Example configuration:

```yaml
network:
  version: 2
  renderer: NetworkManager
  ethernets:
    enp3s0:
      dhcp4: no
      addresses:
        - 192.168.1.10/24
      gateway4: 192.168.1.1
      nameservers:
        addresses: [8.8.8.8, 1.1.1.1]
```

Apply configuration:

```bash
sudo netplan apply
```

---

# 2. Local Domain Setup

## Configure Hosts File on Client Devices

### Windows

Edit:

```text
C:\Windows\System32\drivers\etc\hosts
```

### Linux/Mac

```bash
sudo nano /etc/hosts
```

Add:

```text
192.168.1.10   erpnext.local
```

---

# 3. SSL Setup Using Self-Signed Certificate Authority

## Important Notes

A normal self-signed certificate alone will NOT work correctly in Chrome or modern browsers.

To avoid browser security warnings:

- Create your own Root CA
- Install CA into trusted store
- Generate certificate with SAN (Subject Alternative Name)

---

# 4. Create Root CA

```bash
openssl genrsa -out rootCA.key 2048

openssl req -x509 -new -nodes \
-key rootCA.key \
-sha256 \
-days 1024 \
-out rootCA.pem
```

---

# 5. Generate Certificate for erpnext.local

## Generate Private Key

```bash
openssl genrsa -out erpnext.local.key 2048
```

## Generate CSR

```bash
openssl req -new \
-key erpnext.local.key \
-out erpnext.local.csr
```

---

## Create SAN Extension File

```bash
nano v3.ext
```

Content:

```ini
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
subjectAltName = @alt_names

[alt_names]
DNS.1 = erpnext.local
```

---

## Generate Final Certificate

```bash
openssl x509 -req \
-in erpnext.local.csr \
-CA rootCA.pem \
-CAkey rootCA.key \
-CAcreateserial \
-out erpnext.local.crt \
-days 500 \
-sha256 \
-extfile v3.ext
```

---

# 6. Trust CA on Client Devices

## Windows

Import `rootCA.pem` into:

```text
Trusted Root Certification Authorities
```

---

## Linux

```bash
sudo cp rootCA.pem /usr/local/share/ca-certificates/
sudo update-ca-certificates
```

---

## Android

Settings → Security → Install Certificate

---

# 7. ERPNext Production Setup

Install required services:

```bash
sudo apt install nginx supervisor redis-server -y
```

---

## Setup Bench Production

```bash
cd ~/frappe-bench

sudo bench setup production $USER
```

---

## Set Default Site

```bash
bench use erpnext.local
```

---

## Enable Scheduler

```bash
bench enable-scheduler
```

---

# 8. NGINX Configuration

Edit:

```bash
sudo nano /etc/nginx/sites-available/frappe-bench
```

Example:

```nginx
server {
    listen 80;
    server_name erpnext.local;

    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name erpnext.local;

    ssl_certificate /etc/ssl/erpnext.local.crt;
    ssl_certificate_key /etc/ssl/erpnext.local.key;

    root /home/your-user/frappe-bench/sites;

    location / {
        try_files $uri @proxy_to_app;
    }

    location @proxy_to_app {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
    }
}
```

---

## Restart Services

```bash
sudo systemctl restart nginx
sudo supervisorctl restart all
```

---

# 9. Firewall Hardening (UFW)

Enable firewall:

```bash
sudo ufw enable
```

Allow required ports:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

Restrict to LAN:

```bash
sudo ufw allow from 192.168.1.0/24 to any port 80
sudo ufw allow from 192.168.1.0/24 to any port 443
```

---

# 10. MariaDB Production Tuning

Create custom config:

```bash
sudo nano /etc/mysql/mariadb.conf.d/99-erpnext.cnf
```

Configuration:

```ini
[mysqld]

innodb_buffer_pool_size = 4G
innodb_log_file_size = 512M
innodb_flush_method = O_DIRECT

max_connections = 150

query_cache_type = 0
query_cache_size = 0

tmp_table_size = 256M
max_heap_table_size = 256M

table_open_cache = 4000

innodb_io_capacity = 1000
innodb_read_io_threads = 4
innodb_write_io_threads = 4

slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 2
```

Restart MariaDB:

```bash
sudo systemctl restart mariadb
```

---

# 11. Redis Optimization

Edit:

```bash
sudo nano /etc/redis/redis.conf
```

Add:

```ini
maxmemory 1gb
maxmemory-policy allkeys-lru
```

Restart:

```bash
sudo systemctl restart redis
```

---

# 12. Backup Automation

## Create Backup Script

```bash
nano ~/erpnext-backup.sh
```

Content:

```bash
#!/bin/bash

SITE="erpnext.local"
BACKUP_DIR="/home/$USER/backups"
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
LOG_FILE="$BACKUP_DIR/backup.log"

mkdir -p $BACKUP_DIR

echo "[$(date)] Starting backup..." >> $LOG_FILE

cd ~/frappe-bench

bench --site $SITE backup --with-files

mv sites/$SITE/private/backups/* $BACKUP_DIR/

find $BACKUP_DIR -type f -mtime +7 -delete

echo "[$(date)] Backup completed." >> $LOG_FILE
```

---

## Make Script Executable

```bash
chmod +x ~/erpnext-backup.sh
```

---

## Add Cron Job

```bash
crontab -e
```

Add:

```bash
0 2 * * * /home/your-user/erpnext-backup.sh
```

---

# 13. Remote Access Options

## Recommended: Tailscale

Benefits:

- Secure WireGuard VPN
- No port forwarding
- Encrypted communication
- Works behind NAT/firewalls

Install:

```bash
curl -fsSL https://tailscale.com/install.sh | sh

sudo tailscale up
```

---

## Restrict ERPNext Only to Tailscale

NGINX:

```nginx
allow 100.64.0.0/10;
deny all;
```

---

# 14. Additional Security

## Install Fail2Ban

```bash
sudo apt install fail2ban -y

sudo systemctl enable fail2ban
```

---

# 15. Browser SSL Trust Clarification

## Why Normal Self-Signed Certificates Fail

Modern browsers reject certificates if:

- CA is not trusted
- SAN is missing
- Certificate is improperly generated

---

## Requirements for Chrome Trust

### 1. Install Root CA

Import Root CA into OS trust store.

---

### 2. SAN Must Exist

```ini
subjectAltName = @alt_names

[alt_names]
DNS.1 = erpnext.local
```

---

### 3. Access Using Domain

Correct:

```text
https://erpnext.local
```

Incorrect:

```text
https://192.168.1.10
```

Unless IP SAN is added.

---

# 16. Recommended Alternative: mkcert

Install:

```bash
sudo apt install libnss3-tools

curl -LO https://dl.filippo.io/mkcert/latest?for=linux/amd64

chmod +x mkcert

sudo mv mkcert /usr/local/bin/
```

Generate certificates:

```bash
mkcert -install

mkcert erpnext.local
```

Benefits:

- Automatically trusted
- Browser compatible
- Simplifies SSL setup

---

# Final Recommendations

This setup provides:

- Secure LAN ERPNext deployment
- HTTPS encryption
- Firewall isolation
- Production-ready NGINX
- MariaDB performance tuning
- Automated backups
- Secure remote access capability

---

# Recommended Future Improvements

- Grafana + Prometheus monitoring
- Dockerized ERPNext
- Offsite backup replication
- Load testing
- High availability architecture

