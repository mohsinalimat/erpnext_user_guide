# SSH Permission Denied (publickey) Troubleshooting Guide

## Overview

This guide documents the troubleshooting steps for resolving the SSH error:

```bash
Permission denied (publickey)
```

This issue occurred even after adding the public key into the `authorized_keys` file.

---

# Problem Statement

While connecting to a remote server using:

```bash
ssh user@12.123.23.32
```

the following error appeared:

```bash
Permission denied (publickey)
```

---

# Root Cause Analysis

This error generally indicates that the SSH server rejected the authentication key.

Common reasons include:

- Incorrect private key being used
- Wrong file permissions
- Incorrect SSH user
- Invalid SSH server configuration
- Corrupted or improperly formatted public key
- SSH agent not loaded with the key

---

# Troubleshooting Steps

## 1. Verify Correct Private Key Usage

If the SSH key is not the default key (`~/.ssh/id_rsa`), specify it explicitly:

```bash
ssh -i ~/.ssh/your_private_key user@12.123.23.32
```

Check loaded SSH keys:

```bash
ssh-add -l
```

If no keys are loaded:

```bash
ssh-add ~/.ssh/your_private_key
```

---

## 2. Fix SSH Permissions (Most Common Issue)

On the remote server, execute:

```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
chown -R user:user ~/.ssh
```

### Why This Matters

SSH refuses authentication if:

- `.ssh` directory is writable by others
- `authorized_keys` has overly permissive permissions

---

## 3. Verify Correct User

Ensure:

- Public key is added under the correct user's home directory
- SSH connection uses the same username

### Example Mistake

Public key stored at:

```bash
/home/ubuntu/.ssh/authorized_keys
```

But connecting using:

```bash
ssh user@12.123.23.32
```

### Correct Command

```bash
ssh ubuntu@12.123.23.32
```

---

## 4. Check SSH Server Configuration

Edit SSH daemon configuration:

```bash
sudo nano /etc/ssh/sshd_config
```

Verify these settings:

```text
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
PasswordAuthentication no
```

Restart SSH service:

```bash
sudo systemctl restart ssh
```

---

## 5. Debug SSH Connection Verbosely

Run:

```bash
ssh -v user@12.123.23.32
```

Look for messages such as:

```text
Offering public key
Authentication refused
```

This helps identify:

- Wrong key usage
- Permission problems
- Unsupported algorithms
- Key rejection reasons

---

## 6. Inspect SSH Authentication Logs

On the server:

```bash
sudo tail -f /var/log/auth.log
```

Attempt SSH login again and observe logs.

Common messages:

```text
Authentication refused: bad ownership
Invalid user
Failed publickey
```

---

## 7. Additional Hidden Issues

### Windows Line Endings

Convert file format if edited on Windows:

```bash
dos2unix ~/.ssh/authorized_keys
```

### Corrupted Public Key

Ensure:

- Public key is a single uninterrupted line
- No extra spaces or line breaks
- Full key copied correctly

---

# Quick Verification Checklist

| Check | Status |
|---|---|
| Correct SSH user | ✔ |
| Correct private key | ✔ |
| Proper `.ssh` permissions | ✔ |
| Proper `authorized_keys` permissions | ✔ |
| SSH daemon allows public key auth | ✔ |
| SSH service restarted | ✔ |
| Key formatting verified | ✔ |

---

# Recommended Diagnostic Workflow

1. Verify user
2. Verify key path
3. Fix permissions
4. Run verbose SSH
5. Inspect auth logs
6. Validate key formatting
7. Restart SSH daemon

---

# Conclusion

The `Permission denied (publickey)` error is usually caused by:

- Incorrect permissions
- Wrong SSH user
- Invalid or unloaded key
- SSH configuration issues

Using verbose SSH output and authentication logs is the fastest way to identify the exact failure reason.

---

# Useful Commands Summary

```bash
# Connect with specific key
ssh -i ~/.ssh/private_key user@host

# View loaded SSH keys
ssh-add -l

# Load SSH key
ssh-add ~/.ssh/private_key

# Fix permissions
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys

# Restart SSH service
sudo systemctl restart ssh

# Verbose SSH debug
ssh -v user@host

# Watch auth logs
sudo tail -f /var/log/auth.log
```
