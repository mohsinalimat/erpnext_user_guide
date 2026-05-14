# WireGuard VPN Setup & Troubleshooting Guide (Ubuntu 24.04)

## Overview
This document compiles the complete WireGuard VPN setup, GUI configuration, CLI usage, troubleshooting, and debugging process discussed during the conversation.

---

# 1. Adding WireGuard VPN via GNOME Settings

## Method 1: Using GNOME Settings (Recommended)

### Steps
1. Open **Settings**
2. Go to **Network**
3. Scroll to **VPN**
4. Click **Add VPN**
5. Select **WireGuard**
6. Import configuration file OR configure manually

---

# 2. Required Packages

## GUI Support
```bash
sudo apt update
sudo apt install wireguard-tools
```

> Ubuntu 24.04 may already include WireGuard support in NetworkManager.

---

# 3. Sample WireGuard Client Config (`wg0.conf`)

```ini
[Interface]
PrivateKey = CLIENT_PRIVATE_KEY
Address = 192.168.3.9/32
DNS = 192.168.3.1

[Peer]
PublicKey = SERVER_PUBLIC_KEY
Endpoint = 207.245.117.234:51280
AllowedIPs = 192.168.1.108/32, 192.168.1.110/32, 192.168.3.1/32
PersistentKeepalive = 25
```

---

# 4. GNOME Manual Entry Mapping

## WireGuard Tab

| Field | Value |
|---|---|
| Connection Name | wg0 |
| Interface Name | wg0 |
| Private Key | CLIENT_PRIVATE_KEY |
| Listen Port | Leave empty or 0 |

---

## Peer Settings

| Field | Value |
|---|---|
| Public Key | SERVER_PUBLIC_KEY |
| Endpoint | 207.245.117.234:51280 |
| Allowed IPs | 192.168.1.108/32,192.168.1.110/32,192.168.3.1/32 |
| Persistent Keepalive | 25 |

---

## IPv4 Tab

| Field | Value |
|---|---|
| Method | Manual |
| Address | 192.168.3.9 |
| Netmask | 32 |
| Gateway | Leave empty |
| DNS | 192.168.3.1 |

---

# 5. CLI Commands

## Bring Tunnel Up
```bash
sudo wg-quick up wg0
```

## Bring Tunnel Down
```bash
sudo wg-quick down wg0
```

## Show WireGuard Status
```bash
sudo wg show
```

## Check Routes
```bash
ip route
```

## Check Interface
```bash
ip a show wg0
```

---

# 6. Using NetworkManager CLI (`nmcli`)

## List Connections
```bash
nmcli connection show
```

## Show Active Connections
```bash
nmcli connection show --active
```

## Bring VPN Up
```bash
nmcli connection up "wg0"
```

## Bring VPN Down
```bash
nmcli connection down "wg0"
```

---

# 7. Common Mistakes Identified

## Wrong SSH Key Usage

### Incorrect
```bash
ssh -i ~/.ssh/sanjay_pub.pub ubuntu@192.168.1.108
```

### Correct
```bash
ssh -i ~/.ssh/sanjay_pub ubuntu@192.168.1.108
```

---

## Invalid Endpoint IP

### Incorrect
```ini
Endpoint = 312.345.277.267:51280
```

### Correct
```ini
Endpoint = 207.245.117.234:51280
```

---

# 8. Main Problem Diagnosed

## Symptom
```bash
transfer: 0 B received, XXX B sent
```

## Meaning
- Client sends packets
- Server never replies
- No handshake established

---

# 9. Root Cause

The server was NOT listening on UDP port `51280`.

Verification command:
```bash
sudo ss -tulnp | grep 51280
```

Returned:
```bash
nothing
```

---

# 10. Required Server Configuration

## `/etc/wireguard/wg0.conf`

```ini
[Interface]
PrivateKey = SERVER_PRIVATE_KEY
Address = 192.168.3.1/24
ListenPort = 51280

[Peer]
PublicKey = CLIENT_PUBLIC_KEY
AllowedIPs = 192.168.3.9/32
```

---

# 11. Start WireGuard on Server

```bash
sudo wg-quick up wg0
```

---

# 12. Verify Server Listening

```bash
sudo ss -tulnp | grep 51280
```

Expected:
```bash
udp   UNCONN   0.0.0.0:51280
```

---

# 13. Open Firewall

## UFW
```bash
sudo ufw allow 51280/udp
```

---

# 14. Enable IP Forwarding

```bash
sudo sysctl -w net.ipv4.ip_forward=1
```

---

# 15. Add NAT Rule

```bash
sudo iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
```

---

# 16. Connectivity Testing

## Test Handshake
```bash
sudo wg show
```

Expected:
```bash
latest handshake: X seconds ago
transfer: X received, Y sent
```

---

## Ping VPN Server
```bash
ping 192.168.3.1
```

---

## Ping Internal Server
```bash
ping 192.168.1.108
```

---

## SSH Access
```bash
ssh -i ~/.ssh/sanjay_pub ubuntu@192.168.1.108
```

---

# 17. Key Troubleshooting Logic

| Symptom | Cause |
|---|---|
| 0 B received | Server not responding |
| No handshake | Firewall / WireGuard not running |
| Ping fails | Routing issue |
| SSH fails | Wrong key or VPN not connected |

---

# 18. Final Conclusion

The client configuration was mostly correct.

The primary issue was:
- WireGuard server not running properly
- UDP port 51280 not listening
- No handshake established

Once the server:
- Starts WireGuard
- Listens on 51280
- Opens firewall
- Adds correct peer config

The VPN tunnel and SSH access should work correctly.

---

# End of Document
