# ERPNext Gmail Personal Account Configuration Guide

## Overview
This document provides a production-ready guide to configure a personal Gmail account in ERPNext for sending emails using SMTP authentication.

---

# 1. Prerequisites

Before configuring ERPNext, prepare your Gmail account properly.

## Enable 2-Step Verification

1. Open your Google Account settings
2. Navigate to:
   - Security → 2-Step Verification
3. Enable 2-Step Verification

---

## Generate Gmail App Password

Google no longer allows normal Gmail passwords for SMTP authentication.

### Steps

1. Open:
   - Google Account → Security → App Passwords
2. Select:
   - App: Mail
   - Device: Other (ERPNext)
3. Generate password
4. Copy the generated 16-character password

> IMPORTANT:
> This App Password must be used in ERPNext instead of your Gmail login password.

---

# 2. Configure Email Account in ERPNext

Navigate to:

ERPNext → Settings → Email Account → New

---

## Basic Configuration

| Field | Value |
|-------|-------|
| Email Account Name | Gmail SMTP |
| Email ID | yourname@gmail.com |
| Default Outgoing | Enabled |
| Enable Outgoing | Enabled |

---

# 3. SMTP Configuration

Configure the following SMTP settings:

| Field | Value |
|-------|-------|
| Email Server | smtp.gmail.com |
| Port | 587 |
| Use TLS | Enabled |
| Use SSL | Disabled |
| Login ID | yourname@gmail.com |
| Password | Gmail App Password |

---

# 4. Advanced Settings

Recommended settings:

| Setting | Recommendation |
|---------|----------------|
| Always Use Account Email ID as Sender | Enabled |
| Enable Incoming | Optional |

---

# 5. Testing Email Configuration

After saving the Email Account:

1. Click:
   - Send Test Email
2. Verify:
   - Email delivery success
   - No SMTP authentication errors

---

# 6. Common Issues and Solutions

## Authentication Failed

### Cause
Using Gmail account password instead of App Password.

### Solution
Always use the generated Gmail App Password.

---

## SMTP Connection Timeout

### Possible Causes
- Firewall blocking port 587
- VPS provider restrictions
- ISP SMTP restrictions

### Solution
Ensure outbound SMTP traffic on port 587 is allowed.

---

## Emails Going to Spam

### Recommendations
- Configure SPF records
- Configure DKIM records
- Use professional sender name
- Avoid bulk mailing through personal Gmail

---

## “Less Secure Apps” Error

Google deprecated Less Secure Apps support.

### Solution
Ignore older tutorials recommending it.

Use:
- 2FA
- App Password

---

# 7. ERPNext Best Practices

## Suitable Usage for Gmail

Recommended for:
- Development environments
- Small office notifications
- Testing environments

---

## Avoid Gmail For

Not recommended for:
- Bulk emailing
- Production ERP notification systems
- Marketing campaigns

---

# 8. Recommended Alternatives for Production

Consider using dedicated email providers:

- SendGrid
- Amazon SES
- Zoho Mail

These providers offer:
- Better deliverability
- Higher sending limits
- Professional email infrastructure

---

# 9. Security Recommendations

## Recommended Security Measures

- Never store your real Gmail password
- Rotate App Password periodically
- Restrict server access where possible
- Use HTTPS for ERPNext deployment

---

# 10. ERPNext Background Worker Notes

ERPNext email queue processing depends on background workers.

## Useful Commands

```bash
bench worker
bench restart
```

---

## Troubleshooting Areas

Check:
- Email Queue
- Error Log
- Scheduler status
- Worker status

---

# 11. Optional Incoming Email Configuration (IMAP)

If ERPNext should receive emails:

| Field | Value |
|-------|-------|
| IMAP Server | imap.gmail.com |
| Port | 993 |
| Use SSL | Enabled |

---

# 12. Final Checklist

- 2FA enabled in Gmail
- Gmail App Password generated
- SMTP configured correctly
- Test email successful
- ERPNext workers running
- Firewall allowing SMTP traffic

---

# Conclusion

This configuration is suitable for lightweight ERPNext email sending scenarios using a personal Gmail account. For enterprise-grade production environments, dedicated transactional email providers are strongly recommended.

