# Ubuntu Cache Management Guide

## Overview

This document summarizes the discussion about Ubuntu `~/.cache` directory management, what it contains, and how to safely clear it.

---

# What `~/.cache` Contains

`~/.cache` is the user-level application cache directory in Ubuntu/Linux systems.

Applications store temporary or reusable files here to improve performance.

Typical contents include:

- Browser cache
  - Google Chrome
  - Mozilla Firefox
- Package manager cache
  - pip
  - npm
  - yarn
- Thumbnail previews for images/videos
- IDE/editor cache
  - Visual Studio Code
- AI/ML model cache
  - Hugging Face
  - PaddleOCR
  - PyTorch
- Temporary web assets
- Font cache
- GPU shader cache
- ERPNext/Frappe development caches

A cache size of 2.4 GB is considered normal on active development systems.

---

# Is It Safe to Delete?

Generally: **Yes**

Most cache files can be deleted safely because applications recreate them automatically.

Possible temporary effects after clearing cache:

- Applications may launch slightly slower the first time
- Browsers may reload assets
- Thumbnails regenerate
- Some applications may rebuild indexes/models

Personal files and documents are normally unaffected.

---

# Recommended Inspection Commands

## Check Individual Cache Folder Sizes

```bash
du -sh ~/.cache/*
```

## Sort Cache Folders by Size

```bash
du -sh ~/.cache/* | sort -hr | head -20
```

---

# Clear Entire User Cache

```bash
rm -rf ~/.cache/*
```

This clears only the current user's cache files.

---

# Selective Cleanup Methods

## Browser Cache

### Google Chrome

```bash
rm -rf ~/.cache/google-chrome
```

### Mozilla Firefox

```bash
rm -rf ~/.cache/mozilla
```

---

# Python pip Cache

## Check pip Cache Size

```bash
pip cache info
```

## Clear pip Cache

```bash
pip cache purge
```

---

# npm Cache

```bash
npm cache clean --force
```

---

# Thumbnail Cache

```bash
rm -rf ~/.cache/thumbnails/*
```

---

# System-Wide Package Cache

APT package cache is separate from `~/.cache`.

## Check APT Cache Size

```bash
du -sh /var/cache/apt
```

## Clear APT Cache

```bash
sudo apt clean
```

---

# ERPNext / OCR Development Environment Notes

Development environments using:

- ERPNext
- PaddleOCR
- Python ML libraries

may accumulate large cache directories such as:

```bash
~/.cache/pip
~/.cache/huggingface
~/.cache/torch
~/.cache/paddle
```

These may consume significant disk space over time.

---

# Recommended Safe Cleanup

```bash
pip cache purge
sudo apt clean
rm -rf ~/.cache/thumbnails/*
```

Then verify remaining cache size:

```bash
du -sh ~/.cache
```

---

# Important Warnings

Avoid deleting cache while applications are running, especially:

- Browsers
- Docker
- Databases
- ERPNext workers

Also avoid deleting the following directories:

```bash
~/.config
~/.local/share
```

These contain actual settings and user data rather than temporary cache files.

---

# Best Practice Recommendation

Recommended maintenance schedule:

- Clear thumbnail cache occasionally
- Purge pip/npm cache periodically
- Run `sudo apt clean` after large package installations
- Inspect `~/.cache` monthly on development systems

This helps maintain disk space and system responsiveness.
