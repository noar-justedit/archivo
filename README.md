# archivo

**Catalogue your archive drives once, search them all offline.**

archivo scans a hard drive into a single browsable index, so you can find any
file in seconds even when the drive is sitting on a shelf, unplugged. It is a
desktop app built for video editors and anyone juggling a wall of external
archive disks.

Built with Electron. Runs on macOS and Windows.

---

## Features

- Scan any mounted volume into a fast, browsable file index
- Full offline search across every catalogued disk
- File-tree browser with name, size, kind, date and free-space columns
- Volume-type icons for USB, network and system drives
- Duplicate detection: update an existing disk or add a separate entry
- Right-click a catalogued disk to re-scan and update it from the live drive
- Live scan progress with percentage and estimated time, cancellable
- Path bar showing the disk and full location of any selected file
- Compressed catalog files (`.archivo`), up to ~90% smaller than raw JSON
- Document-based: open, save and close catalogs like any other file
- Optional update check against a version file hosted in this repo

## Install (from a release)

Grab the latest build from the
[Releases page](https://github.com/noar-justedit/archivo/releases):

- **macOS**: download the `.dmg`, open it, drag archivo to Applications.
- **Windows**: download the installer (`archivo Setup x.y.z.exe`) or the
  portable `.exe`.

## Build from source

Requires [Node.js](https://nodejs.org) (LTS).

```bash
git clone https://github.com/noar-justedit/archivo.git
cd archivo
npm install
npm start          # run in dev
```

### Packaging

```bash
# macOS (Apple Silicon) — DMG + zip
./build-mac.sh

# Windows installer + portable, from a Windows machine
./build-win.bat        # or: npm run build:win

# Windows build cross-compiled from macOS (uses Wine)
./build-win-from-mac.sh
```

Building the Windows target from macOS requires Homebrew and Wine; the
`build-win-from-mac.sh` script checks for them and guides the install.

## Project structure

```
archivo/
├── src/
│   ├── main.js        Electron main process (windows, IPC, volume scan, update check)
│   ├── preload.js     Context-isolated bridge (window.archivo API)
│   ├── index.html     Renderer: full UI, styles and app logic
│   ├── assets/        App icon
│   └── fonts/         Poppins (OFL)
├── build/             Packaging icons (icon.icns, icon.ico)
├── build-mac.sh       macOS build
├── build-win.bat      Windows build (on Windows)
├── build-win-from-mac.sh  Windows build from macOS via Wine
├── version.json       Update manifest read by the app
└── package.json       electron-builder config
```

## Update manifest

The app checks `version.json` in this repo on launch. To publish an update,
bump the version there after cutting a release:

```json
{ "archivo": { "version": "1.0.2", "url": "https://github.com/noar-justedit/archivo/releases" } }
```

The check fails silently offline and never blocks startup. A newer version
shows a dismissible notice; a dismissed version is not shown again.

## Data format

A catalog is JSON: a list of disks, each with metadata and a nested file
tree. Saved catalogs are gzip-compressed with an `.archivo` extension; plain
`.json` catalogs are also read. Everything stays local, there is no account
and no telemetry.

## License

archivo is free software, released under the
[GNU General Public License v3.0](LICENSE).

Fonts: [Poppins](https://github.com/itfoundry/Poppins) under the SIL Open Font
License (see `src/fonts/OFL-Poppins.txt`). The application icon is the author's
own work.
