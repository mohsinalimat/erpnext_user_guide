#!/usr/bin/env bash

# =========================================================
# Auto Generate Documentation Index in README.md
# =========================================================
# Author : Sanjay Kumar
# Purpose:
#   - Scan all markdown files inside docs/
#   - Generate documentation index
#   - Automatically update README.md section
#
# Requirements:
#   README.md must contain:
#
#   <!-- DOCS_INDEX_START -->
#   <!-- DOCS_INDEX_END -->
#
# Usage:
#   chmod +x scripts/generate_docs_index.sh
#   ./scripts/generate_docs_index.sh
# =========================================================

set -e

DOCS_DIR="docs"
README_FILE="README.md"
TEMP_FILE=$(mktemp)

# ---------------------------------------------------------
# Validate required files/directories
# ---------------------------------------------------------

if [ ! -d "$DOCS_DIR" ]; then
    echo "ERROR: '$DOCS_DIR' directory not found."
    exit 1
fi

if [ ! -f "$README_FILE" ]; then
    echo "ERROR: '$README_FILE' not found."
    exit 1
fi

# ---------------------------------------------------------
# Generate documentation index
# ---------------------------------------------------------

echo "## 📚 Documentation Index" > "$TEMP_FILE"
echo "" >> "$TEMP_FILE"

# Process all markdown files
find "$DOCS_DIR" -type f -name "*.md" | sort | while read -r file; do

    # Remove leading ./ if exists
    rel_path="${file#./}"

    # Extract filename without extension
    filename=$(basename "$file" .md)

    # Convert filename to readable title
    # Example:
    # server-maintenance-guide -> Server Maintenance Guide
    title=$(echo "$filename" \
        | tr '-' ' ' \
        | sed 's/\b\(.\)/\u\1/g')

    echo "- [${title}](${rel_path})" >> "$TEMP_FILE"

done

echo "" >> "$TEMP_FILE"
echo "_Last updated: $(date '+%Y-%m-%d %H:%M:%S')_" >> "$TEMP_FILE"

# ---------------------------------------------------------
# Ensure markers exist in README.md
# ---------------------------------------------------------

if ! grep -q "<!-- DOCS_INDEX_START -->" "$README_FILE"; then
    echo "ERROR: DOCS_INDEX_START marker missing in README.md"
    exit 1
fi

if ! grep -q "<!-- DOCS_INDEX_END -->" "$README_FILE"; then
    echo "ERROR: DOCS_INDEX_END marker missing in README.md"
    exit 1
fi

# ---------------------------------------------------------
# Replace section inside README.md
# ---------------------------------------------------------

awk '
BEGIN { skip=0 }

/<!-- DOCS_INDEX_START -->/ {
    print
    while ((getline line < "'"$TEMP_FILE"'") > 0)
        print line
    skip=1
    next
}

/<!-- DOCS_INDEX_END -->/ {
    skip=0
}

!skip
' "$README_FILE" > README.tmp

mv README.tmp "$README_FILE"

rm -f "$TEMP_FILE"

echo "✅ README.md documentation index updated successfully."