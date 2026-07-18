#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# ARCHIVO — Build Script (macOS · Windows)
# ─────────────────────────────────────────────────────────────────────────────
# Usage:
#   chmod +x build.sh
#   ./build.sh              → macOS Apple Silicon (arm64) DMG
#   ./build.sh --universal  → macOS Universal (arm64 + x86_64)
#   ./build.sh --win        → Windows x64 installer (NSIS)
#   ./build.sh --all        → macOS + Windows
#   ./build.sh --dev        → Dev mode (hot reload, no build)
# ─────────────────────────────────────────────────────────────────────────────

set -e
cd "$(dirname "${BASH_SOURCE[0]}")"

APP="ARCHIVO"
VERSION=$(node -e "console.log(require('./package.json').version)" 2>/dev/null || echo "?")

echo ""
echo "  ▶ ${APP} v${VERSION} — Build"
echo "  ─────────────────────────────"
echo ""

if ! command -v node &>/dev/null; then
  echo "  ✗ Node.js not found. Install from https://nodejs.org"; exit 1
fi
echo "  ✓ Node.js $(node -v)"

# Générer les icônes si absentes
if [ ! -f "build/icon.icns" ]; then
  echo "  ▶ Generating icons…"
  python3 - << 'PYEOF'
import struct, zlib, os

def write_png(path, w, h, r, g, b):
    def chunk(t, d):
        c = zlib.crc32(t + d) & 0xffffffff
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', c)
    hdr  = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
    raw  = b''.join(b'\x00' + bytes([r, g, b] * w) for _ in range(h))
    idat = chunk(b'IDAT', zlib.compress(raw))
    iend = chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(hdr + ihdr + idat + iend)

os.makedirs('build', exist_ok=True)
for s in [16, 32, 64, 128, 256, 512]:
    write_png(f'build/tmp_{s}.png', s, s, 89, 54, 216)
print('  ✓ PNG icons generated')
PYEOF

  mkdir -p build/icon.iconset
  for s in 16 32 64 128 256 512; do
    cp "build/tmp_${s}.png" "build/icon.iconset/icon_${s}x${s}.png"
    s2=$((s * 2))
    src_file="build/tmp_${s2}.png"
    [ -f "$src_file" ] && cp "$src_file" "build/icon.iconset/icon_${s}x${s}@2x.png" \
                       || cp "build/tmp_${s}.png" "build/icon.iconset/icon_${s}x${s}@2x.png"
  done
  iconutil -c icns build/icon.iconset -o build/icon.icns
  rm -rf build/icon.iconset build/tmp_*.png
  # ICO pour Windows
  cp build/icon.icns build/icon.ico 2>/dev/null || true
  echo "  ✓ Icons ready"
fi

if [[ "$1" == "--dev" ]]; then
  echo "  ▶ Starting dev mode…"
  npm install --silent 2>&1 | tail -2
  npx electron .
  exit 0
fi

echo "  ▶ Installing dependencies…"
npm install 2>&1 | tail -3
echo "  ✓ Dependencies ready"
echo ""

case "$1" in
  --universal) echo "  ▶ Building macOS Universal…"; npx electron-builder --mac --universal ;;
  --win)       echo "  ▶ Building Windows x64…";    npx electron-builder --win --x64 ;;
  --all)       echo "  ▶ Building all platforms…";  npx electron-builder --mac --win ;;
  *)           echo "  ▶ Building macOS arm64…";    npx electron-builder --mac --arm64 ;;
esac

echo ""
echo "  ✓ Build complete → dist/"
ls -lh dist/ 2>/dev/null | grep -v "^total" || true
echo ""
