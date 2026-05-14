# ERPNext LAN & Remote Access Configuration Guide

## Role
Senior System Administrator and Network Engineer

## Goal
Configure localhost ERPNext site running on laptop which should be accessible to any device connected with same WiFi or via LAN cable.

---

# Part 1 — Access ERPNext Over LAN/WiFi

## Step 1 — Find Laptop IP Address

Run:

```bash
ip a
```

Look for:

```text
inet 192.168.1.25/24
```

Your LAN IP would be:

```text
192.168.1.25
```

---

## Step 2 — Run Bench on All Interfaces

By default, ERPNext binds to localhost only.

Run:

```bash
bench start --host 0.0.0.0
```

This allows ERPNext to listen on LAN network interfaces.

---

## Step 3 — Access ERPNext from Another Device

From another laptop/mobile connected to same WiFi:

```text
http://192.168.1.25:8000
```

---

## Step 4 — Configure Firewall

Check firewall status:

```bash
sudo ufw status
```

Allow port 8000:

```bash
sudo ufw allow 8000
```

Or allow only local subnet:

```bash
sudo ufw allow from 192.168.1.0/24 to any port 8000
```

---

## Step 5 — Configure Production Mode (Recommended)

Enable production setup:

```bash
sudo bench setup production <your-user>
```

This configures:
- Nginx
- Supervisor
- Gunicorn

---

## Step 6 — Configure Nginx

Edit:

```bash
sudo nano /etc/nginx/conf.d/frappe-bench.conf
```

Ensure:

```nginx
listen 80;
server_name 192.168.1.25;
```

Reload Nginx:

```bash
sudo service nginx reload
```

Access:

```text
http://192.168.1.25
```

---

# Troubleshooting

## Check Listening Port

```bash
ss -tulnp | grep 8000
```

Expected:

```text
0.0.0.0:8000
```

---

## Temporarily Disable Firewall for Testing

```bash
sudo ufw disable
```

---

# Pro Recommendations

## Configure Static IP

Edit netplan:

```bash
sudo nano /etc/netplan/*.yaml
```

Assign static LAN IP.

---

## Use Local DNS Name

Edit hosts file on client device:

```text
192.168.1.25 erp.local
```

Access:

```text
http://erp.local:8000
```

---

# Part 2 — Secure Remote Access Outside Local Network

## Option 1 — Tailscale (Recommended)

### What is Tailscale?

Tailscale creates a secure private VPN network using WireGuard.

### Why Recommended?

- No port forwarding
- End-to-end encryption
- Very secure
- Works behind NAT/CGNAT
- Excellent free plan

---

## Install Tailscale

```bash
curl -fsSL https://tailscale.com/install.sh | sh
```

Start:

```bash
sudo tailscale up
```

---

## Get Tailscale IP

```bash
tailscale ip -4
```

Example:

```text
100.64.12.34
```

---

## Access ERPNext via Tailscale

Run ERPNext:

```bash
bench start --host 0.0.0.0
```

Access:

```text
http://100.64.12.34:8000
```

---

# Option 2 — Cloudflare Tunnel

## What is Cloudflare Tunnel?

Cloudflare Tunnel securely exposes local service over HTTPS without port forwarding.

---

## Install cloudflared

```bash
sudo apt install cloudflared
```

---

## Login

```bash
cloudflared tunnel login
```

---

## Create Tunnel

```bash
cloudflared tunnel create erpnext
```

---

## Create Config

```bash
nano ~/.cloudflared/config.yml
```

Example:

```yaml
tunnel: erpnext
credentials-file: /home/ubuntu/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: erp.yourdomain.com
    service: http://localhost:8000
  - service: http_status:404
```

---

## Run Tunnel

```bash
cloudflared tunnel run erpnext
```

Access:

```text
https://erp.yourdomain.com
```

---

# Tailscale vs Cloudflare Tunnel

| Feature | Tailscale | Cloudflare Tunnel |
|---|---|---|
| Access Type | Private VPN | Public URL |
| Security | Highest | Strong |
| Exposure | Private | Public |
| Setup Complexity | Easy | Medium |
| Requires Domain | No | Usually Yes |
| Free Plan | Excellent | Excellent |
| Best For | Admin/Internal Access | Public Access |

---

# Security Analysis

## Tailscale Security

- End-to-end encrypted
- WireGuard-based
- No inbound ports
- Minimal attack surface

Recommended for:
- ERPNext admin access
- Development access
- Internal business systems

---

## Cloudflare Tunnel Security

- HTTPS by default
- No open ports
- DDoS protection
- Web Application Firewall

Recommended for:
- Public demos
- External client access

---

# Recommended Architecture

```text
Admin Access  -> Tailscale
Client Access -> Cloudflare Tunnel
```

This is modern Zero Trust architecture.

---

# Final Recommendation

For ERPNext hosted on a laptop:

1. Use Tailscale for secure private access
2. Use Cloudflare Tunnel only if public access is required
3. Avoid direct router port forwarding

---

# Conclusion

This guide covered:

- LAN access configuration
- Firewall setup
- Production Nginx configuration
- Secure VPN access using Tailscale
- Public HTTPS exposure using Cloudflare Tunnel
- Security comparison and architecture recommendations

