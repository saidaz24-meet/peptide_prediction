#!/bin/bash
# Idempotent repo cleanup script.
# Implements actions from docs/CLEANUP_PLAN.md.
# Dry-run by default; use --apply to execute.

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory (repo root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# Flags
DRY_RUN=true
ONLY_MD=false
ONLY_CACHE=false

# Parse flags
while [[ $# -gt 0 ]]; do
    case $1 in
        --apply)
            DRY_RUN=false
            shift
            ;;
        --only-md)
            ONLY_MD=true
            shift
            ;;
        --only-cache)
            ONLY_CACHE=true
            shift
            ;;
        *)
            echo "Unknown flag: $1"
            echo "Usage: $0 [--apply] [--only-md] [--only-cache]"
            exit 1
            ;;
    esac
done

if [ "$DRY_RUN" = true ]; then
    echo -e "${BLUE}🔍 DRY RUN MODE${NC} (use --apply to execute)"
    echo ""
fi

ACTIONS=0

# Function to perform action
do_action() {
    local action=$1
    local source=$2
    local target=$3
    local description=$4
    
    ACTIONS=$((ACTIONS + 1))
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}[DRY RUN]${NC} $action: $source → $target"
        echo "  → $description"
    else
        echo -e "${GREEN}[EXECUTE]${NC} $action: $source → $target"
        case $action in
            "MOVE")
                mkdir -p "$(dirname "$target")"
                mv "$source" "$target" 2>/dev/null || {
                    echo "  ⚠️  Warning: Failed to move $source to $target"
                }
                ;;
            "DELETE")
                rm -f "$source"
                ;;
            "MKDIR")
                mkdir -p "$source"
                ;;
            *)
                echo "Unknown action: $action"
                ;;
        esac
    fi
    echo ""
}

# Archive MD files
if [ "$ONLY_CACHE" = false ]; then
    echo "📄 Processing Markdown Files..."
    echo ""
    
    # Create legacy directory
    if [ ! -d "docs/legacy" ]; then
        do_action "MKDIR" "docs/legacy" "" "Create legacy docs directory"
    fi
    
    # Root-level historical files → archive
    for file in \
        "CHANGES_CSV_PARSING_FIX.md" \
        "CHANGES_RESULT_ALIGNMENT_FIX.md" \
        "CHANGES_UI_NUMERIC_NORMALIZATION_FIX.md" \
        "CODEBASE_ANALYSIS.md" \
        "SEMANTIC_CORRECTNESS_ISSUES.md" \
        "FILE_INVENTORY.md" \
        "PRINCIPLES_IMPLEMENTATION.md" \
        "PRINCIPLES_IMPLEMENTATION_STATUS.md"; do
        if [ -f "$file" ]; then
            do_action "MOVE" "$file" "docs/legacy/$file" "Archive historical file: $file"
        fi
    done
    
    # Delete REPO_TREE.txt
    if [ -f "REPO_TREE.txt" ]; then
        do_action "DELETE" "REPO_TREE.txt" "" "Delete auto-generated file"
    fi
    
    # Docs-level overlapping files → archive (strip docs/ prefix)
    for file in \
        "docs/DEV_ERGONOMICS.md" \
        "docs/CONTINUATION_PLAN.md" \
        "docs/uniprot-flow.md" \
        "docs/providers.md" \
        "docs/provider-fixes-summary.md"; do
        if [ -f "$file" ]; then
            basename_file=$(basename "$file")
            do_action "MOVE" "$file" "docs/legacy/$basename_file" "Archive overlapping doc: $file"
        fi
    done
fi

# Clean cache directories
if [ "$ONLY_MD" = false ]; then
    echo "🗑️  Processing Cache/Temp Directories..."
    echo ""
    
    # Runtime caches (should be in .gitignore, but clean if present)
    for dir in \
        "backend/.run_cache" \
        "backend/Tango/out" \
        "backend/Tango/work" \
        "backend/Psipred/out" \
        "backend/Psipred/work" \
        "ui/dist"; do
        if [ -d "$dir" ]; then
            file_count=$(find "$dir" -type f 2>/dev/null | wc -l | tr -d ' ')
            if [ "$file_count" -gt 0 ]; then
                if [ "$DRY_RUN" = true ]; then
                    echo -e "${YELLOW}[DRY RUN]${NC} CLEAN: $dir ($file_count files)"
                    echo "  → Would remove runtime cache directory"
                else
                    echo -e "${GREEN}[EXECUTE]${NC} CLEAN: $dir ($file_count files)"
                    rm -rf "$dir"/*
                    ACTIONS=$((ACTIONS + 1))
                fi
                echo ""
            fi
        fi
    done
fi

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$DRY_RUN" = true ]; then
    echo -e "${BLUE}📋 Summary:${NC} $ACTIONS actions planned (dry run)"
    echo ""
    echo "To execute these actions, run:"
    echo "  $0 --apply"
    echo ""
    echo "Or run specific cleanup:"
    echo "  $0 --only-md --apply    # Archive MD files only"
    echo "  $0 --only-cache --apply # Clean cache dirs only"
else
    echo -e "${GREEN}✅ Summary:${NC} $ACTIONS actions executed"
    echo ""
    echo "Cleanup complete! Verify:"
    echo "  - Archived files in docs/legacy/"
    echo "  - Cache directories cleaned"
    echo "  - .gitignore updated (if needed)"
fi

