# Complete Removal & Reinstallation of Claude Desktop on Ubuntu 24.04

## Overview

This guide provides step-by-step instructions to:

1. Completely remove Claude Desktop from Ubuntu 24.04
2. Clean all residual files, caches, and configurations
3. Reinstall Claude Desktop cleanly
4. Fix common Electron/Wayland issues on Ubuntu 24.04

---

# Step 1 — Stop Claude Desktop Completely

Close Claude Desktop if it is currently running.

Then terminate all related processes:

```bash
pkill -f claude
pkill -f electron
```

Verify whether any processes are still running:

```bash
ps aux | grep -Ei 'claude|electron'
```

---

# Step 2 — Remove Installed Package

## 2.1 Check Installed Claude Packages

```bash
dpkg -l | grep -i claude
```

---

## 2.2 Remove APT / DEB Installation

If Claude Desktop was installed using a `.deb` package:

```bash
sudo apt purge claude-desktop -y
sudo apt autoremove -y
```

If package name differs:

```bash
sudo dpkg -r claude-desktop
```

---

## 2.3 Remove Snap Installation (If Installed)

Check snap packages:

```bash
snap list | grep -i claude
```

Remove snap package:

```bash
sudo snap remove claudeai-desktop
```

---

## 2.4 Remove AppImage Installation (If Used)

Delete AppImage files manually:

```bash
rm -f ~/Applications/Claude*.AppImage
rm -f ~/Downloads/Claude*.AppImage
```

---

# Step 3 — Remove Desktop Launchers & Symlinks

Delete launcher files:

```bash
sudo rm -f /usr/share/applications/claude-desktop.desktop
sudo rm -f ~/.local/share/applications/claude-desktop.desktop
```

Delete executable symlinks:

```bash
sudo rm -f /usr/bin/claude-desktop
sudo rm -f /usr/local/bin/claude-desktop
```

---

# Step 4 — Remove User Configuration & Cache

This removes:

- Application settings
- Login sessions
- Electron cache
- Temporary data
- Local storage

Run:

```bash
rm -rf ~/.config/Claude
rm -rf ~/.cache/Claude
rm -rf ~/.local/share/Claude
rm -rf ~/.config/claude-desktop
rm -rf ~/.cache/claude-desktop
```

---

## 4.1 Remove Additional Electron Cache (Optional)

```bash
rm -rf ~/.config/Code/Cache
rm -rf ~/.config/Code/CachedData
```

---

# Step 5 — Remove Previous Custom Electron Flags

If you previously modified launcher flags:

```bash
sudo nano /usr/share/applications/claude-desktop.desktop
```

Remove flags such as:

```ini
--disable-gpu
--ozone-platform=wayland
```

Or simply delete the launcher file completely:

```bash
sudo rm -f /usr/share/applications/claude-desktop.desktop
```

---

# Step 6 — Verify Complete Removal

Check whether Claude Desktop still exists:

```bash
which claude-desktop
```

Expected output:

```text
command not found
```

---

## 6.1 Search for Leftover Files

```bash
find ~ -iname "*claude*" 2>/dev/null
```

Delete any remaining files or folders manually if required.

---

# Step 7 — Reinstall Claude Desktop

There are two installation methods available:

1. Recommended APT Repository Installation (Preferred)
2. Manual `.deb` Package Installation

---

# Method 1 — Recommended APT Repository Installation

This is the recommended installation method for Ubuntu 24.04.

Benefits:

- Easier installation
- Automatic updates through `apt upgrade`
- Cleaner dependency management
- Simpler maintenance
- Proper package integration with Ubuntu

---

## 7.1 Add Repository GPG Key

```bash
curl -fsSL https://pkg.claude-desktop-debian.dev/KEY.gpg | \
sudo gpg --dearmor -o /usr/share/keyrings/claude-desktop.gpg
```

---

## 7.2 Add Claude Desktop Repository

```bash
echo "deb [signed-by=/usr/share/keyrings/claude-desktop.gpg arch=amd64,arm64] \
https://pkg.claude-desktop-debian.dev stable main" | \
sudo tee /etc/apt/sources.list.d/claude-desktop.list
```

---

## 7.3 Update Package Index

```bash
sudo apt update
```

---

## 7.4 Install Claude Desktop

```bash
sudo apt install claude-desktop
```

---

## 7.5 Verify Installation

```bash
dpkg -l | grep claude
```

Expected output:

```text
ii  claude-desktop ...
```

---

## 7.6 Future Updates

Update all packages:

```bash
sudo apt update
sudo apt upgrade
```

Or update only Claude Desktop:

```bash
sudo apt upgrade claude-desktop
```

---

## 7.7 Remove Repository Later (Optional)

If you want to completely remove repository configuration later:

```bash
sudo rm -f /etc/apt/sources.list.d/claude-desktop.list
sudo rm -f /usr/share/keyrings/claude-desktop.gpg
```

---

# Method 2 — Manual `.deb` Installation

## 7.8 Download Latest Debian Package

Recommended community Debian build:

- Repository:
  https://github.com/aaddrick/claude-desktop-debian

- Releases:
  https://github.com/aaddrick/claude-desktop-debian/releases

Download the latest `.deb` package suitable for Ubuntu 24.04.

---

## 7.9 Install Downloaded Package

Example installation:

```bash
cd ~/Downloads

sudo dpkg -i claude-desktop*.deb
sudo apt --fix-broken install -y
```

---

# Step 8 — Launch Claude Desktop

Launch from terminal:

```bash
claude-desktop
```

Or launch from Ubuntu application menu.

---

# Step 9 — Fix Common Ubuntu 24.04 Electron Issues

Ubuntu 24.04 uses Wayland by default.
Electron applications may sometimes:

- Open blank windows
- Crash on startup
- Show white screen
- Freeze randomly
- Fail GPU rendering

---

## 9.1 Test Launch With GPU Disabled

```bash
claude-desktop --disable-gpu
```

If this fixes the issue, make it permanent.

---

## 9.2 Permanently Disable GPU in Launcher

Edit launcher:

```bash
sudo nano /usr/share/applications/claude-desktop.desktop
```

Change:

```ini
Exec=/usr/bin/claude-desktop %u
```

To:

```ini
Exec=/usr/bin/claude-desktop --disable-gpu %u
```

Save and exit.

---

# Step 10 — Disable Wayland Completely (Optional)

If Electron applications continue to behave incorrectly, switching to X11 often improves compatibility.

---

## 10.1 Edit GDM Configuration

```bash
sudo nano /etc/gdm3/custom.conf
```

Find:

```ini
#WaylandEnable=false
```

Change to:

```ini
WaylandEnable=false
```

Save and exit.

---

## 10.2 Reboot System

```bash
sudo reboot
```

---

## 10.3 Verify Session Type

After reboot:

```bash
echo $XDG_SESSION_TYPE
```

Expected output:

```text
x11
```

---

# Additional Troubleshooting

## Clear GNOME Desktop Cache

```bash
rm -rf ~/.cache/thumbnails/*
```

---

## Rebuild Desktop Database

```bash
sudo update-desktop-database
```

---

## Reload GNOME Shell (X11 Only)

Press:

```text
Alt + F2
```

Then type:

```text
r
```

Press Enter.

---

# Useful Diagnostic Commands

## Check Current Session Type

```bash
echo $XDG_SESSION_TYPE
```

---

## Check GPU Information

```bash
lspci | grep -i vga
```

---

## Check Installed Electron Apps

```bash
find /usr/share/applications -iname "*.desktop" | grep -i electron
```

---

# Conclusion

You now have a complete clean reinstallation process for Claude Desktop on Ubuntu 24.04, including:

- Full package removal
- Cache cleanup
- Configuration cleanup
- Launcher cleanup
- Clean reinstall
- Electron compatibility fixes
- Wayland to X11 migration guidance

