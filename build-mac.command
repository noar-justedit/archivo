#!/bin/bash
# ╔══════════════════════════════════════════════════════════════╗
# ║   archivo — Build macOS (Apple Silicon, arm64)               ║
# ║   Signs, notarizes, staples and verifies. Nothing else to do.║
# ╚══════════════════════════════════════════════════════════════╝
#
#   ./build-mac.command              the release build: signed + notarized
#   ./build-mac.command --quick      signed only, no notarization (fast, local)
#   ./build-mac.command --unsigned   neither (fastest, local)
#   ./build-mac.command --setup      re-enter the Apple credentials, then build
#
# The first run asks for your Apple ID and an app-specific password and stores
# them in the macOS keychain. Every run after that needs nothing from you.
# No password, key or certificate is ever written into this project folder.

set -e
trap 'echo; read -r -p "Press Enter to close this window..." _' EXIT
set -o pipefail

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
NOTARY_PROFILE="${NOTARY_PROFILE:-archivo-notarization}"
LOG="build-mac.log"

SIGN=1
NOTARIZE=1
FORCE_SETUP=0
case "$1" in
  "")         ;;
  --quick)    NOTARIZE=0 ;;
  --unsigned) NOTARIZE=0; SIGN=0 ;;
  --setup)    FORCE_SETUP=1 ;;
  *) echo "Unknown option: $1   (--quick | --unsigned | --setup)"; exit 1 ;;
esac

echo ""
echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${CYAN}     archivo v${VERSION} — Build macOS (arm64)${NC}"
echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ─────────────────────────────────────────────────────────────────
# 1. Node.js
# ─────────────────────────────────────────────────────────────────
echo -e "${BLUE}[1/6]${NC} Node.js"
if ! command -v node &>/dev/null; then
  echo -e "${RED}  X Node.js not found. Install the LTS from https://nodejs.org${NC}"
  exit 1
fi
echo -e "${GREEN}  OK $(node --version)${NC}"

# ─────────────────────────────────────────────────────────────────
# 2. Icon
# ─────────────────────────────────────────────────────────────────
echo -e "${BLUE}[2/6]${NC} Icon"
if [ ! -f "build/icon.icns" ]; then
  echo -e "${RED}  X build/icon.icns not found.${NC}"; exit 1
fi
echo -e "${GREEN}  OK icon.icns${NC}"

# ─────────────────────────────────────────────────────────────────
# 3. Signing certificate
#    Apple only notarizes apps already signed with a Developer ID
#    Application certificate, so this is checked before anything else.
#    The Team ID is read straight out of the certificate name.
# ─────────────────────────────────────────────────────────────────
echo -e "${BLUE}[3/6]${NC} Signing certificate"
TEAM_ID=""
if [ "$SIGN" -eq 0 ]; then
  export CSC_IDENTITY_AUTO_DISCOVERY=false
  echo -e "${YELLOW}  ! Skipped (--unsigned). Local testing only.${NC}"
else
  # `|| true`: with `set -e` a failing substitution would abort the script
  # before the helpful message below ever prints.
  IDENTITY=$(security find-identity -v -p codesigning 2>/dev/null \
             | grep "Developer ID Application" | head -1 | sed -E 's/.*"(.+)".*/\1/' || true)
  if [ -z "$IDENTITY" ]; then
    echo -e "${RED}  X No \"Developer ID Application\" certificate in your keychain.${NC}"
    echo ""
    echo -e "  Get one — five minutes, once:"
    echo -e "    1. ${BOLD}developer.apple.com/account/resources/certificates${NC} → +"
    echo -e "    2. Choose ${BOLD}Developer ID Application${NC}"
    echo -e "       (not \"Apple Development\", not \"Mac App Distribution\")"
    echo -e "    3. Follow the steps, download the .cer, double-click to install"
    echo ""
    echo -e "  Meanwhile you can build for yourself: ${BOLD}./build-mac.command --unsigned${NC}"
    exit 1
  fi
  # electron-builder finds this same certificate on its own (it picks the first
  # Developer ID Application identity, exactly like the search above), so we
  # deliberately do NOT set CSC_NAME — passing it wrong breaks the build.
  TEAM_ID=$(echo "$IDENTITY" | sed -E 's/.*\(([A-Z0-9]{10})\).*/\1/')
  echo -e "${GREEN}  OK ${IDENTITY}${NC}"
fi

# ─────────────────────────────────────────────────────────────────
# 4. Notarization credentials
#    Stored once in the macOS keychain under a named profile. The check
#    below is a real round-trip to Apple, so a bad or missing profile is
#    caught in two seconds instead of after a ten-minute build.
# ─────────────────────────────────────────────────────────────────
setup_credentials() {
  echo ""
  echo -e "${BOLD}${CYAN}  ── Apple credentials setup (once) ──${NC}"
  echo -e "  Stored in the macOS keychain as \"${NOTARY_PROFILE}\"."
  echo -e "  Nothing is written into the project folder."
  echo ""
  read -r -p "  Apple ID (your developer account email): " ASK_ID
  if [ -z "$ASK_ID" ]; then echo -e "${RED}  X Cancelled.${NC}"; exit 1; fi

  ASK_TEAM="$TEAM_ID"
  if [ -n "$TEAM_ID" ]; then
    echo -e "  Team ID from your certificate: ${BOLD}${TEAM_ID}${NC}"
    read -r -p "  Press Enter to use it, or type another: " OVERRIDE
    [ -n "$OVERRIDE" ] && ASK_TEAM="$OVERRIDE"
  else
    read -r -p "  Team ID: " ASK_TEAM
  fi

  echo ""
  echo -e "  An ${BOLD}app-specific password${NC} is needed — not your Apple password."
  echo -e "  Create one at ${BOLD}appleid.apple.com${NC} → Sign-In and Security"
  echo -e "  → App-Specific Passwords → +   (name it whatever you like)"
  echo ""
  read -r -s -p "  Paste it here (hidden, format xxxx-xxxx-xxxx-xxxx): " ASK_PW
  echo ""
  if [ -z "$ASK_PW" ]; then echo -e "${RED}  X Cancelled.${NC}"; exit 1; fi

  echo -e "  Checking with Apple…"
  if xcrun notarytool store-credentials "$NOTARY_PROFILE" \
       --apple-id "$ASK_ID" --team-id "$ASK_TEAM" --password "$ASK_PW" >/dev/null 2>&1; then
    echo -e "${GREEN}  OK credentials saved. You will not be asked again.${NC}"
  else
    echo -e "${RED}  X Apple rejected those credentials.${NC}"
    echo -e "  Usual causes: a typo in the password, an Apple ID that is not on"
    echo -e "  the developer account, or the wrong Team ID."
    echo -e "  Run ${BOLD}./build-mac.command --setup${NC} to try again."
    exit 1
  fi
}

echo -e "${BLUE}[4/6]${NC} Notarization credentials"
if [ "$NOTARIZE" -eq 0 ]; then
  unset APPLE_KEYCHAIN_PROFILE
  echo -e "${YELLOW}  ! Skipped. This build is not for distribution.${NC}"
else
  export APPLE_KEYCHAIN_PROFILE="$NOTARY_PROFILE"
  if [ "$FORCE_SETUP" -eq 1 ]; then
    setup_credentials
  elif xcrun notarytool history --keychain-profile "$NOTARY_PROFILE" >/dev/null 2>&1; then
    echo -e "${GREEN}  OK profile \"${NOTARY_PROFILE}\" accepted by Apple${NC}"
  else
    echo -e "${YELLOW}  ! No usable profile named \"${NOTARY_PROFILE}\".${NC}"
    echo -e "    (this check also needs an internet connection)"
    setup_credentials
  fi
fi

# ─────────────────────────────────────────────────────────────────
# 5. Dependencies
# ─────────────────────────────────────────────────────────────────
echo -e "${BLUE}[5/6]${NC} Dependencies"
npm install --silent 2>&1 | grep -v "^npm warn" || true
echo -e "${GREEN}  OK${NC}"

# ─────────────────────────────────────────────────────────────────
# 6. Build
# ─────────────────────────────────────────────────────────────────
echo -e "${BLUE}[6/6]${NC} Building archivo ${VERSION}"
if [ "$NOTARIZE" -eq 1 ]; then
  echo -e "${YELLOW}  Apple has to scan the app and answer, then again for the disk image.${NC}"
  echo -e "${YELLOW}  Expect two quiet stretches of a few minutes each. Let it run.${NC}"
fi
echo ""

# Live output AND a full log, with the real exit status of npm (not of tee).
set +e
set +o pipefail
npm run build:mac 2>&1 | tee "$LOG"
BUILD_STATUS=${PIPESTATUS[0]}
set -e
set -o pipefail

if [ "$BUILD_STATUS" -ne 0 ]; then
  echo ""
  echo -e "${RED}X Build failed. Full output kept in ${BOLD}${LOG}${NC}"
  # Ask Apple only about a submission that belongs to THIS app and to THIS run.
  # Without that filter the newest entry in the history is whatever else you
  # notarized recently, and its log is worse than no log at all.
  if [ "$NOTARIZE" -eq 1 ]; then
    echo -e "${BLUE}▶${NC} Asking Apple why…"
    # Most recent submission for THIS app, uploaded in the last two hours.
    SUB=$(xcrun notarytool history --keychain-profile "$NOTARY_PROFILE" --output-format json 2>/dev/null \
          | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{
              const cutoff=Date.now()-2*3600*1000;
              const h=(JSON.parse(s).history||[]).find(e=>/archivo/i.test(e.name||'')&&Date.parse(e.createdDate)>cutoff);
              if(h)console.log(h.id);
            }catch(e){}})" || true)
    if [ -n "$SUB" ]; then
      # Verdict and issues only — the full ticket runs to hundreds of lines.
      # An "Accepted" verdict means notarization was never the problem, and
      # saying so plainly beats dumping a log that shows nothing wrong.
      xcrun notarytool log "$SUB" --keychain-profile "$NOTARY_PROFILE" 2>/dev/null \
        | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{
            const j=JSON.parse(s);
            if(j.status==='Accepted'){
              console.log('  Apple accepted '+(j.archiveFilename||'the app')+' — notarization is not the problem.');
              console.log('  The build broke after that step. The cause is the error above.');
            } else {
              console.log('  archive : '+(j.archiveFilename||'?'));
              console.log('  status  : '+j.status+' — '+(j.statusSummary||''));
              (j.issues||[]).slice(0,10).forEach(i=>console.log('  • ['+i.severity+'] '+i.message+(i.path?'\\n      '+i.path:'')));
              if(!j.issues||!j.issues.length)console.log('  (no specific issue reported)');
            }
          }catch(e){console.log('  (could not read the log)')}})" || true
    else
      echo -e "  Apple never saw this build — it failed before the upload."
      echo -e "  The real cause is the last error above, and in ${BOLD}${LOG}${NC}."
    fi
  fi
  exit 1
fi

DMG=$(find dist -maxdepth 1 -name "*.dmg" 2>/dev/null | head -1 || true)
APP=$(find dist -maxdepth 3 -name "archivo.app" 2>/dev/null | head -1 || true)
if [ -z "$DMG" ]; then
  echo -e "${RED}X No .dmg produced. See ${LOG}.${NC}"
  exit 1
fi

# ─────────────────────────────────────────────────────────────────
# Verify the app, then notarize the disk image
#
# electron-builder notarizes the .app and staples its ticket, then builds the
# DMG around it. So the app is already good to go — that ticket is what
# Gatekeeper reads when a user launches archivo, online or not.
#
# The DMG itself was never sent to Apple, so it has no ticket of its own and
# cannot simply be stapled. We submit it separately: it costs one more upload
# but it means macOS is happy from the moment the user double-clicks the disk
# image, not only when they launch the app.
# ─────────────────────────────────────────────────────────────────
if [ "$NOTARIZE" -eq 1 ]; then
  echo ""
  echo -e "${BLUE}▶${NC} Checking the app — this is what Gatekeeper reads on launch…"
  APP_OK=1
  codesign --verify --deep --strict "$APP" 2>/dev/null || APP_OK=0
  xcrun stapler validate "$APP" >/dev/null 2>&1 || APP_OK=0
  spctl -a -t exec "$APP" 2>/dev/null || APP_OK=0
  if [ "$APP_OK" -eq 1 ]; then
    echo -e "${GREEN}  OK signed, notarized, ticket attached${NC}"
  else
    echo -e "${RED}  X The app itself did not pass. Do not distribute this build.${NC}"
    codesign --verify --deep --strict --verbose=2 "$APP" 2>&1 | tail -5 || true
    spctl -a -vvv -t exec "$APP" 2>&1 | tail -5 || true
    exit 1
  fi

  echo -e "${BLUE}▶${NC} Notarizing the disk image (second upload, 1 to 5 minutes)…"
  DMG_OK=0
  SUBOUT=$(xcrun notarytool submit "$DMG" --keychain-profile "$NOTARY_PROFILE" \
           --wait --output-format json 2>/dev/null || true)
  DMG_STATUS=$(echo "$SUBOUT" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).status||'')}catch(e){}})" || true)
  DMG_SUB=$(echo "$SUBOUT" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).id||'')}catch(e){}})" || true)

  if [ "$DMG_STATUS" = "Accepted" ]; then
    if xcrun stapler staple "$DMG" >/dev/null 2>&1 && xcrun stapler validate "$DMG" >/dev/null 2>&1; then
      DMG_OK=1
      echo -e "${GREEN}  OK disk image notarized and ticket attached${NC}"
    else
      echo -e "${YELLOW}  ! Apple accepted the disk image but the ticket could not be attached.${NC}"
    fi
  else
    echo -e "${YELLOW}  ! The disk image was not notarized (status: ${DMG_STATUS:-unknown}).${NC}"
    if [ -n "$DMG_SUB" ]; then
      xcrun notarytool log "$DMG_SUB" --keychain-profile "$NOTARY_PROFILE" 2>/dev/null \
        | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{
            const j=JSON.parse(s);(j.issues||[]).slice(0,5).forEach(i=>console.log('    • '+i.message));
          }catch(e){}})" || true
    fi
    echo -e "    The app inside is notarized and stapled, so archivo launches with no"
    echo -e "    warning. macOS may still question the disk image itself on download."
  fi
fi

# ─────────────────────────────────────────────────────────────────
# Done
# ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ "$NOTARIZE" -eq 1 ] && [ "${DMG_OK:-0}" -eq 1 ]; then
  echo -e "${BOLD}${GREEN}       READY TO SHIP — signed and notarized${NC}"
elif [ "$NOTARIZE" -eq 1 ]; then
  echo -e "${BOLD}${YELLOW}   READY TO SHIP — app notarized, disk image not${NC}"
else
  echo -e "${BOLD}${YELLOW}       LOCAL BUILD — not for distribution${NC}"
fi
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BOLD}DMG:${NC} $DMG  ($(du -sh "$DMG" 2>/dev/null | cut -f1))"
[ -n "$APP" ] && echo -e "${BOLD}App:${NC} $APP"
echo ""
if [ "$NOTARIZE" -eq 1 ] && [ "${DMG_OK:-0}" -eq 1 ]; then
  echo -e "${CYAN}Opens on any Mac with no Gatekeeper warning. Upload it as is.${NC}"
elif [ "$NOTARIZE" -eq 1 ]; then
  echo -e "${CYAN}archivo itself launches with no warning — its ticket is attached.${NC}"
  echo -e "${YELLOW}The disk image has no ticket of its own: macOS may question the DMG${NC}"
  echo -e "${YELLOW}on download. Usable, but worth re-running before a public release.${NC}"
else
  echo -e "${YELLOW}Users would get a Gatekeeper warning. Run without options to ship.${NC}"
fi
echo ""

# Only ask when there is a real terminal: piped or scripted runs must not
# fail here. And exit 0 explicitly, so answering "n" is not read as a failure.
if [ -t 0 ]; then
  read -r -p "Open the dist folder? (y/n): " OPEN_DIST || OPEN_DIST=""
  if [[ "$OPEN_DIST" =~ ^[Yy] ]]; then open dist/; fi
fi
echo ""
echo -e "${CYAN}archivo — by just edit${NC}"
echo ""
exit 0
