#!/bin/bash
# ============================================================
#    archivo - Build Windows (x64) FROM macOS
#    Cross-compiles the Windows installer + portable .exe
#    using electron-builder + Wine.
# ============================================================

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

VERSION=$(node -e "console.log(require('./package.json').version)" 2>/dev/null || echo "?")

echo ""
echo -e "${BOLD}${CYAN}===================================================${NC}"
echo -e "${BOLD}${CYAN}   archivo v${VERSION} - Build Windows from macOS${NC}"
echo -e "${BOLD}${CYAN}===================================================${NC}"
echo ""

# -- 1. Node.js ----------------------------------------------
echo -e "${BLUE}[1/5]${NC} Checking Node.js..."
if ! command -v node &>/dev/null; then
  echo -e "${RED}X Node.js not found. Install the LTS from https://nodejs.org${NC}"
  exit 1
fi
echo -e "${GREEN}OK Node.js $(node --version)${NC}"

# -- 2. Homebrew (needed to install Wine) --------------------
echo -e "${BLUE}[2/5]${NC} Checking Homebrew..."
if ! command -v brew &>/dev/null; then
  echo -e "${YELLOW}! Homebrew not found.${NC}"
  echo -e "  Homebrew is needed to install Wine. Install it with:"
  echo -e "  ${BOLD}/bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"${NC}"
  echo -e "  Then re-run this script."
  exit 1
fi
echo -e "${GREEN}OK Homebrew $(brew --version | head -1)${NC}"

# -- 3. Wine (cross-build engine) ----------------------------
echo -e "${BLUE}[3/5]${NC} Checking Wine..."
if ! command -v wine64 &>/dev/null && ! command -v wine &>/dev/null; then
  echo -e "${YELLOW}! Wine not found. Installing wine-stable via Homebrew...${NC}"
  echo -e "  (This is a large download and can take several minutes.)"
  brew install --cask wine-stable
else
  WINE_BIN=$(command -v wine64 || command -v wine)
  echo -e "${GREEN}OK Wine present ($("$WINE_BIN" --version 2>/dev/null || echo 'installed'))${NC}"
fi

# Apple Silicon note: Wine runs through Rosetta 2. Make sure it's available.
if [ "$(uname -m)" = "arm64" ]; then
  if ! /usr/bin/pgrep oahd &>/dev/null; then
    echo -e "${YELLOW}! Apple Silicon detected. Rosetta 2 may be required for Wine.${NC}"
    echo -e "  If the build fails, install it with: ${BOLD}softwareupdate --install-rosetta --agree-to-license${NC}"
  fi
fi

# -- 4. Dependencies -----------------------------------------
echo -e "${BLUE}[4/5]${NC} Installing dependencies..."
if [ -d "node_modules" ]; then
  echo -e "  node_modules present, skipping. Delete it to force a clean install."
else
  npm install
fi
echo -e "${GREEN}OK dependencies ready${NC}"

# -- 5. Icon -------------------------------------------------
if [ ! -f "build/icon.ico" ]; then
  echo -e "${RED}X build/icon.ico not found.${NC}"; exit 1
fi

# -- Build ---------------------------------------------------
echo -e "${BLUE}[5/5]${NC} Cross-building Windows installer + portable..."
echo ""
npm run build:win

echo ""
echo -e "${BOLD}${CYAN}===================================================${NC}"
echo -e "${GREEN}Done. Find your Windows build in  dist/ :${NC}"
echo -e "  - ${BOLD}archivo Setup ${VERSION}.exe${NC}   (installer)"
echo -e "  - ${BOLD}archivo ${VERSION}.exe${NC}         (portable, no install)"
echo -e "${BOLD}${CYAN}===================================================${NC}"
echo ""
echo -e "${YELLOW}Note:${NC} test the .exe on a real Windows machine before distributing."
