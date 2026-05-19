# MariaDB 11.8.6 — Startup Failure
## Troubleshooting Report & Resolution Guide

> **Date:** April 10, 2026
> **Server:** kevin82
> **OS:** Ubuntu 24.04 LTS

---

## Executive Summary

MariaDB 11.8.6 on a 1.9 GB RAM server failed to start due to three stacked issues. The **root cause** was InnoDB being configured to allocate **4.6 GB** of buffer pool memory — far exceeding available RAM. Two secondary issues (Galera recovery script and an invalid systemd key) masked the real error by crashing the process before any log files were written.

---

## Environment

| Component | Detail |
|---|---|
| MariaDB Version | 11.8.6-MariaDB-ubu2404 |
| Operating System | Ubuntu 24.04 LTS |
| Hostname | kevin82 |
| Total RAM | 1.9 GB |
| Available RAM | ~1.3 GB |
| Swap | 1.9 GB (353 MB used) |
| Data Directory | /var/lib/mysql (5.1 GB used) |
| Disk Space | 98 GB total, 82 GB used, 11 GB free |

---

## Issue 1 — Invalid systemd Key in `limits.conf`

### Symptom

systemd logged a warning about an unknown configuration key, causing the `LimitNOFILE` override to be partially ignored.

```
Apr 09 16:55:06 kevin82 systemd[1]: /etc/systemd/system/mariadb.service.d/limits.conf:3:
Unknown key name 'LimitNOFILESoft' in section 'Service', ignoring.
```

### Root Cause

`LimitNOFILESoft` is **not a valid systemd unit key**. The correct key is only `LimitNOFILE`. Additionally, the main service file had `LimitNOFILE=32768` which was too low for MariaDB's request of 164,372 file descriptors.

### Fix Applied

**File:** `/etc/systemd/system/mariadb.service.d/limits.conf`

```ini
[Service]
LimitNOFILE=infinity
ExecStartPre=
```

> **Note:** `ExecStartPre=` (empty) was added to address Issue 2.
> `LimitNOFILE=infinity` overrides the hardcoded `32768` in the main service file.

---

## Issue 2 — `galera_recovery` Pre-Start Script Crashing

### Symptom

MariaDB crashed silently in under 325ms with **zero output** from mariadbd itself. The process was dying in the `ExecStartPre` phase before MariaDB even launched.

```
Process: 1335312 ExecStartPre=/bin/sh -c [ ! -e /usr/bin/galera_recovery ] && VAR= ||
         VAR=`/usr/bin/galera_recovery`
Process: 1336107 ExecStart=/usr/sbin/mariadbd (code=exited, status=1/FAILURE)
```

### Root Cause

The MariaDB service file includes a Galera Cluster recovery script (`galera_recovery`) as a pre-start hook. On this single-node setup, Galera was not properly configured — `wsrep_cluster_address = gcomm://` was active with no cluster nodes, causing `galera_recovery` to fail silently and abort the entire startup sequence.

### Galera Config Found

**File:** `/etc/mysql/mariadb.conf.d/60-galera.cnf`

```ini
wsrep_cluster_address = gcomm://   # was uncommented — caused silent failure
```

### Fix Applied

**1. Clear ExecStartPre in systemd drop-in:**

**File:** `/etc/systemd/system/mariadb.service.d/limits.conf`

```ini
[Service]
LimitNOFILE=infinity
ExecStartPre=
```

**2. Disable Galera in custom config:**

**File:** `/etc/mysql/mariadb.conf.d/99-erp-custom.cnf`

```ini
[mariadbd]
wsrep_on = OFF
```

**3. Comment out `wsrep_cluster_address` in `60-galera.cnf`:**

```ini
#wsrep_cluster_address = gcomm://
```

---

## Issue 3 — InnoDB Buffer Pool Exceeds Available RAM *(Root Cause)*

### Symptom

After bypassing Issue 1 and Issue 2, running the MariaDB binary directly finally revealed the real crash error that had been hidden all along:

```
2026-04-10 5:15:07 0 [Note] InnoDB: innodb_buffer_pool_size_max=4664m, innodb_buffer_pool_size=4659m
2026-04-10 5:15:07 0 [ERROR] mariadbd: Out of memory (Needed 2635356248 bytes)
2026-04-10 5:15:07 0 [ERROR] InnoDB: Cannot map innodb_buffer_pool_size_max=4664m
2026-04-10 5:15:07 0 [ERROR] InnoDB: Plugin initialization aborted with error Generic error
2026-04-10 5:15:07 0 [ERROR] Plugin 'InnoDB' registration as a STORAGE ENGINE failed.
2026-04-10 5:15:07 0 [ERROR] Aborting
```

### Root Cause

The server's MariaDB configuration (likely migrated from a larger server) had `innodb_buffer_pool_size` set to **4.6 GB**. The server only has **1.9 GB total RAM** with ~1.3 GB available. InnoDB failed to allocate the memory during plugin initialization and aborted — before writing anything to the error log file.

### Why It Was Hard to Find

MariaDB crashed before the error log was initialized, so **no log files were written**. The crash was also hidden behind the `galera_recovery` failure (Issue 2) which aborted startup even earlier. Only by directly running the binary with `--console` flag was the real error visible.

### Fix Applied

**File:** `/etc/mysql/mariadb.conf.d/99-erp-custom.cnf`

```ini
[mariadbd]
wsrep_on               = OFF
open_files_limit       = 65535
innodb_buffer_pool_size     = 512M
innodb_buffer_pool_size_max = 512M
innodb_log_buffer_size      = 16M
tmp_table_size              = 64M
max_heap_table_size         = 64M
```

---

## Key Diagnostic Commands Used

| Command | Purpose |
|---|---|
| `systemctl status mariadb` | Initial status check |
| `journalctl -u mariadb -n 50 --no-pager` | Full systemd journal for mariadb |
| `systemctl show mariadb \| grep -i limitnofile` | Verify effective file descriptor limit |
| `cat /usr/lib/systemd/system/mariadb.service \| grep -i limit` | Check hardcoded limits in service file |
| `sudo -u mysql /usr/bin/galera_recovery 2>&1` | Run galera_recovery directly to expose errors |
| `sudo grep -r "wsrep" /etc/mysql/ 2>/dev/null` | Find all Galera/wsrep configuration |
| `free -h` | Check available RAM vs configured buffer pool |
| `sudo -u mysql /usr/sbin/mariadbd --user=mysql --wsrep-on=OFF --console --log-error=/dev/stderr 2>&1` | **THE KEY COMMAND** — runs binary directly, forces all output to terminal |

---

## Final Working Configuration

### File 1: `/etc/systemd/system/mariadb.service.d/limits.conf`

```ini
[Service]
LimitNOFILE=infinity
ExecStartPre=
```

### File 2: `/etc/mysql/mariadb.conf.d/99-erp-custom.cnf`

```ini
[mariadbd]
wsrep_on               = OFF
open_files_limit       = 65535
innodb_buffer_pool_size     = 512M
innodb_buffer_pool_size_max = 512M
innodb_log_buffer_size      = 16M
tmp_table_size              = 64M
max_heap_table_size         = 64M
```

### File 3: `/etc/mysql/mariadb.conf.d/60-galera.cnf` *(relevant section)*

```ini
#wsrep_on                 = ON
#wsrep_cluster_name       = "MariaDB Galera Cluster"
#wsrep_cluster_address    = gcomm://   ← must stay commented out
#binlog_format            = row
#default_storage_engine   = InnoDB
#innodb_autoinc_lock_mode = 2
```

---

## Resolution Summary

| # | Issue | Impact | Fix |
|---|---|---|---|
| 1 | Invalid `LimitNOFILESoft` key in `limits.conf` | File descriptor limit not properly raised | Removed invalid key, set `LimitNOFILE=infinity` |
| 2 | `galera_recovery` pre-start script failing | MariaDB process killed before startup | Cleared `ExecStartPre=`, set `wsrep_on=OFF` |
| **3** | **InnoDB buffer pool 4.6 GB on 1.9 GB RAM** | **Out of memory — real root cause** | **Set `innodb_buffer_pool_size = 512M`** |

---

## 🔑 Golden Debugging Command — Save This!

When MariaDB crashes silently with no logs, run the binary directly as the `mysql` user with `--console` to force all output to the terminal:

```bash
sudo -u mysql /usr/sbin/mariadbd --user=mysql \
  --wsrep-on=OFF --console --log-error=/dev/stderr 2>&1 | head -50
```

**Why this works:**

| Flag | Effect |
|---|---|
| `--console` | Forces errors to terminal, bypasses log file |
| `--log-error=/dev/stderr` | Redirects errors to stderr |
| `2>&1` | Merges stderr into stdout |
| `-u mysql` | Runs as mysql user — mirrors exact service conditions |
| `--wsrep-on=OFF` | Skips Galera to reach InnoDB initialization |

---

## Key Lessons

| Lesson | Takeaway |
|---|---|
| **Warnings ≠ Errors** | `max_open_files` warning looked scary but wasn't the killer |
| **systemd hides crashes** | Always run the binary directly when logs are empty |
| **`--console` is your best friend** | Forces output when log files aren't initialized yet |
| **Check RAM vs config** | Always verify `innodb_buffer_pool_size` fits actual RAM |
| **Galera needs bootstrapping** | Single-node setups should have `wsrep_on=OFF` |

---

*Generated on April 10, 2026 | MariaDB 11.8.6 on Ubuntu 24.04 | ERPNext/Frappe Environment*
