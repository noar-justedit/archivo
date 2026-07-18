#!/bin/bash
# ╔══════════════════════════════════════════════════════════════╗
# ║     ARCHIVO — Build macOS Apple Silicon (arm64)             ║
# ╚══════════════════════════════════════════════════════════════╝

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

VERSION=$(node -e "console.log(require('./package.json').version)" 2>/dev/null || echo "?")

echo ""
echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${CYAN}     ARCHIVO v${VERSION} — Build macOS     ${NC}"
echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ── 1. Node.js ──────────────────────────────────────────────────
echo -e "${BLUE}[1/4]${NC} Checking Node.js…"
if ! command -v node &>/dev/null; then
  echo -e "${RED}✗ Node.js not found. Install from https://nodejs.org${NC}"
  read -p "Press Enter to exit..."; exit 1
fi
echo -e "${GREEN}✓ Node.js $(node --version)${NC}"

# ── 2. Icône ────────────────────────────────────────────────────
echo -e "${BLUE}[2/4]${NC} Checking icon…"
if [ ! -f "build/icon.icns" ]; then
  echo -e "${RED}✗ build/icon.icns not found.${NC}"; exit 1
fi
echo -e "${GREEN}✓ icon.icns ready${NC}"

# ── 3. Dépendances ──────────────────────────────────────────────
echo -e "${BLUE}[3/4]${NC} Installing dependencies…"
npm install --silent 2>&1 | grep -v "^npm warn" || true
echo -e "${GREEN}✓ Dependencies installed${NC}"

# ── 4. Build ────────────────────────────────────────────────────
echo -e "${BLUE}[4/4]${NC} Building ARCHIVO for macOS arm64…"
echo ""
npm run build:mac 2>&1 | grep -v "^>" | tail -20

# ── Résultat ────────────────────────────────────────────────────
DMG=$(find dist -name "*.dmg" 2>/dev/null | head -1)
APP=$(find dist -name "ARCHIVO.app" -maxdepth 5 2>/dev/null | head -1)

echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${GREEN}              BUILD SUCCESSFUL! 🎉                    ${NC}"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -n "$DMG" ]; then
  SIZE=$(du -sh "$DMG" 2>/dev/null | cut -f1)
  echo -e "${BOLD}DMG installer:${NC}"
  echo -e "  ${GREEN}→${NC} $DMG  (${SIZE})"
fi
if [ -n "$APP" ]; then
  echo -e "${BOLD}App bundle:${NC}"
  echo -e "  ${GREEN}→${NC} $APP"
fi

echo ""
echo -e "${CYAN}To install:${NC}"
echo -e "  Drag ARCHIVO.app to /Applications"
echo -e "  Or double-click the .dmg"
echo ""

read -p "Open the dist folder? (y/n): " OPEN_DIST
[[ "$OPEN_DIST" =~ ^[Yy] ]] && open dist/
echo ""
echo -e "${CYAN}ARCHIVO — by just edit${NC}"
echo ""
