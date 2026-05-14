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
# Features
# --------
# ✅ Auto-generate README.md documentation index
# ✅ Group by folders/sub-folders
# ✅ Human readable titles
# ✅ Extract description from first markdown header
# ✅ Last modified date
# ✅ Category emojis
# ✅ Alphabetical sorting
# ✅ Ignore unwanted files
# ✅ GitHub Actions compatible
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

set -euo pipefail

DOCS_DIR="docs"
README_FILE="README.md"

TEMP_FILE=$(mktemp)

# ------------------------------------------------------------------------------
# Validation
# ------------------------------------------------------------------------------

if [ ! -d "$DOCS_DIR" ]; then
    echo "ERROR: '$DOCS_DIR' directory not found."
    exit 1
fi

if [ ! -f "$README_FILE" ]; then
    echo "ERROR: '$README_FILE' not found."
    exit 1
fi

# ------------------------------------------------------------------------------
# Ensure README markers exist
# ------------------------------------------------------------------------------

if ! grep -q "<!-- DOCS_INDEX_START -->" "$README_FILE"; then
    echo "ERROR: DOCS_INDEX_START marker missing in README.md"
    exit 1
fi

if ! grep -q "<!-- DOCS_INDEX_END -->" "$README_FILE"; then
    echo "ERROR: DOCS_INDEX_END marker missing in README.md"
    exit 1
fi

# ------------------------------------------------------------------------------
# Category Emoji Mapping
# ------------------------------------------------------------------------------

get_category_emoji() {
    case "$1" in
        installation) echo "🚀" ;;
        setup) echo "🔧" ;;
        how_to) echo "🛠" ;;
        networking) echo "🌐" ;;
        security) echo "🔐" ;;
        troubleshooting) echo "🚑" ;;
        performance_tuning) echo "⚡" ;;
        git) echo "📦" ;;
        *) echo "📁" ;;
    esac
}

# ------------------------------------------------------------------------------
# Convert text to title case
# ------------------------------------------------------------------------------

to_title_case() {
    echo "$1" \
        | tr '_' ' ' \
        | tr '-' ' ' \
        | sed 's/\b\(.\)/\u\1/g'
}

# ------------------------------------------------------------------------------
# Generate Header
# ------------------------------------------------------------------------------

{
    echo "## 📚 Documentation Index"
    echo ""

} > "$TEMP_FILE"

# ------------------------------------------------------------------------------
# Collect Categories
# ------------------------------------------------------------------------------

declare -A categories

while IFS= read -r file; do

    rel_path="${file#./}"

    # Extract first-level category after docs/
    category=$(echo "$rel_path" | cut -d'/' -f2)

    categories["$category"]=1

done < <(
    find "$DOCS_DIR" -type f -name "*.md" \
    ! -name "README.md" \
    | sort
)

# ------------------------------------------------------------------------------
# Generate Sections
# ------------------------------------------------------------------------------

for category in $(printf "%s\n" "${!categories[@]}" | sort); do

    emoji=$(get_category_emoji "$category")

    category_title=$(to_title_case "$category")

    {
        echo "### ${emoji} ${category_title}"
        echo ""
        echo "| Document | Description | Updated |"
        echo "|---|---|---|"

    } >> "$TEMP_FILE"

    # --------------------------------------------------------------------------
    # Process Files In Category
    # --------------------------------------------------------------------------

    while IFS= read -r file; do

        rel_path="${file#./}"

        filename=$(basename "$file" .md)

        title=$(to_title_case "$filename")

        # ----------------------------------------------------------------------
        # Extract Description From First Markdown Header
        # ----------------------------------------------------------------------

        description=$(grep -m 1 '^# ' "$file" | sed 's/^# //')

        if [ -z "$description" ]; then
            description="Documentation"
        fi

        # ----------------------------------------------------------------------
        # Last Modified Date
        # ----------------------------------------------------------------------

        updated=$(date -r "$file" '+%Y-%m-%d')

        echo "| [${title}](${rel_path}) | ${description} | ${updated} |" \
            >> "$TEMP_FILE"

    done < <(
        find "$DOCS_DIR/$category" -type f -name "*.md" \
        ! -name "README.md" \
        | sort
    )

    {
        echo ""
        echo "---"
        echo ""

    } >> "$TEMP_FILE"

done

# ------------------------------------------------------------------------------
# Footer
# ------------------------------------------------------------------------------

{
    echo "_Last generated: $(date '+%Y-%m-%d %H:%M:%S')_"
    echo ""

} >> "$TEMP_FILE"

# ------------------------------------------------------------------------------
# Update README.md
# ------------------------------------------------------------------------------

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