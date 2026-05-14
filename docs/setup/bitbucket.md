# Ultimate Bitbucket SSH Setup & Troubleshooting Guide

## Overview

This guide compiles the complete troubleshooting and setup discussion for configuring SSH authentication with Bitbucket on Linux/Ubuntu systems.

Topics covered:
- Removing old SSH keys
- Creating new SSH keys
- Correct SSH configuration
- Fixing `Permission denied (publickey)`
- Multi-account SSH setup
- DevOps best practices
- Advanced debugging

---

# 1. Problem Statement

Error encountered:

```bash
Permission denied (publickey)
```

while testing:

```bash
ssh -T git@bitbucket.org
```

---

# 2. Original Commands Used

```bash
cd ~/.ssh

ssh-keygen -R "bitbucket.org"

ssh-keygen -t ed25519 -b 4096 -C "your-email" -f bitbucket

ssh-add bitbucket

# ~/.ssh/config
Host bitbucket.org
AddKeysToAgent yes
IdentityFile ~/.ssh/bitbucket

sudo systemctl restart ssh

cat bitbucket.pub

ssh -T git@bitbucket.org
```

---

# 3. Root Cause Analysis

## Issues Identified

### Missing Required SSH Config

```ini
User git
```

### Incorrect Key Generation Option

```bash
ssh-keygen -t ed25519 -b 4096
```

`ed25519` does not require `-b`.

### SSH Agent Issues

Key was possibly not loaded correctly.

### Wrong SSH Key Being Used

Missing:

```ini
IdentitiesOnly yes
```

---

# 4. Recommended Clean Setup

## Remove Old Keys

```bash
cd ~/.ssh

rm -f bitbucket bitbucket.pub

ssh-keygen -R bitbucket.org
```

---

## Generate New SSH Key

```bash
ssh-keygen -t ed25519 -C "sanjay.kumar001@gmail.com" -f ~/.ssh/bitbucket
```

---

## Start SSH Agent

```bash
eval "$(ssh-agent -s)"
```

---

## Add Key

```bash
ssh-add ~/.ssh/bitbucket
```

Verify:

```bash
ssh-add -l
```

---

# 5. Correct SSH Configuration

Edit:

```bash
nano ~/.ssh/config
```

Add:

```ini
Host bitbucket.org
    HostName bitbucket.org
    User git
    IdentityFile ~/.ssh/bitbucket
    IdentitiesOnly yes
```

---

# 6. Correct Permissions

```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/bitbucket
chmod 644 ~/.ssh/bitbucket.pub
chmod 600 ~/.ssh/config
```

---

# 7. Add Public Key to Bitbucket

```bash
cat ~/.ssh/bitbucket.pub
```

Then:
- Open Bitbucket
- Personal Settings
- SSH Keys
- Add Key

---

# 8. Test Connection

```bash
ssh -T git@bitbucket.org
```

Expected:

```text
authenticated via ssh key.
```

---

# 9. Advanced Debugging

```bash
ssh -vT git@bitbucket.org
```

Look for:

```text
Offering public key: ~/.ssh/bitbucket
```

---

# 10. Verify Effective SSH Config

```bash
ssh -G git@bitbucket.org
```

---

# 11. Multi-Account SSH Setup

```ini
Host bitbucket-work
    HostName bitbucket.org
    User git
    IdentityFile ~/.ssh/work_key

Host bitbucket-personal
    HostName bitbucket.org
    User git
    IdentityFile ~/.ssh/personal_key
```

---

# 12. DevOps & ERPNext Recommendations

## Recommended For

- ERPNext deployment servers
- CI/CD pipelines
- Production automation

## Best Practices

### Use Dedicated Deployment Keys

### Restrict Permissions

```bash
chmod 600 ~/.ssh/*
```

### Rotate Keys Periodically

### Secure Backups

---

# 13. Common Mistakes

| Mistake | Problem |
|---|---|
| Missing `User git` | Auth failure |
| Wrong permissions | SSH ignores keys |
| Multiple keys | Wrong key selected |
| Key not in agent | Authentication failure |

---

# 14. Minimal Guaranteed Working Setup

```bash
rm -rf ~/.ssh/bitbucket*

ssh-keygen -t ed25519 -C "your-email" -f ~/.ssh/bitbucket

eval "$(ssh-agent -s)"

ssh-add ~/.ssh/bitbucket

echo "
Host bitbucket.org
  HostName bitbucket.org
  User git
  IdentityFile ~/.ssh/bitbucket
  IdentitiesOnly yes
" > ~/.ssh/config

chmod 600 ~/.ssh/config
```

---

# End of Document
