/*
 * archivo — offline hard-disk catalog
 * Copyright (C) 2026 Noar (just edit)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
'use strict';

const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path   = require('path');
const fs     = require('fs');
const os     = require('os');
const zlib   = require('zlib');
const https  = require('https');
const { execSync, execFileSync } = require('child_process');
const { scanVolume } = require('./scanner');
const { buildExportHtml } = require('./export-viewer');
const { sanitizeCatalog } = require('./catalog');

// gzip level for .archivo files and HTML exports. 6 compresses as well as 9
// on catalog data (measured: same size) in half the time.
const GZIP_LEVEL = 6;
// Largest catalog we accept once decompressed. Also stops a tiny forged
// file from inflating into gigabytes (a "zip bomb") and taking the app down.
const MAX_CATALOG_BYTES = 512 * 1024 * 1024;

let mainWindow;

const REPO_URL = 'https://github.com/noar-justedit/archivo';

// ─────────────────────────────────────────────────────────────
// DOCUMENT STATE — archivo behaves like a document-based app:
// one catalog is "open" at a time, it has a file path once saved,
// and an edited flag that drives the title bar and the quit guard.
// ─────────────────────────────────────────────────────────────
let currentPath     = null;  // path of the open .archivo file (null = never saved)
let docDirty        = false; // unsaved changes?
let forceClose      = false; // set once the user has decided, so close() goes through
let rendererReady   = false;
let pendingOpenPath = null;  // file handed over by the OS before the UI was ready

// A catalog path passed on the command line (Windows/Linux double-click).
function argvCatalog(argv) {
  return (argv || []).slice(1).find(a =>
    typeof a === 'string' && /\.(archivo|json)$/i.test(a) && fs.existsSync(a)
  ) || null;
}

// Only one instance: a second double-click hands its file to the running app.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    const p = argvCatalog(argv);
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    if (p) requestOpen(p);
  });
}

// macOS hands over double-clicked documents through this event, which can
// fire before the app is ready — so it must be registered at module level.
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  requestOpen(filePath);
});

// Ask the renderer to open a file (it owns the unsaved-changes guard).
function requestOpen(filePath) {
  if (rendererReady && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('doc:open-request', filePath);
    mainWindow.focus();
  } else {
    pendingOpenPath = filePath;
  }
}

// ── Update check — reads version.json hosted in the GitHub repo ──
// Never blocks startup, fails silently on any network issue.
const UPDATE_URL = 'https://raw.githubusercontent.com/noar-justedit/archivo/main/version.json';
function semverGt(a, b) {
  const pa = String(a).split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}
// GET a URL following up to 3 redirects (https.get does NOT follow them itself).
function fetchFollow(url, hops, cb) {
  if (hops > 3) return cb(null);
  try {
    const req = https.get(url, { timeout: 4000 }, (res) => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        let next; try { next = new URL(res.headers.location, url).toString(); } catch (e) { return cb(null); }
        return fetchFollow(next, hops + 1, cb);
      }
      if (res.statusCode !== 200) { res.resume(); return cb(null); }
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => cb(body));
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => cb(null));
  } catch (e) { cb(null); }
}
// The update manifest is fetched from the network: its link is only honoured
// if it points at archivo's own repository on GitHub, otherwise the fixed
// Releases page is used. A tampered manifest cannot send users elsewhere.
function safeReleaseUrl(u) {
  try {
    const x = new URL(String(u));
    if (x.protocol === 'https:' && x.hostname === 'github.com' && x.pathname.startsWith('/noar-justedit/archivo')) return x.toString();
  } catch (e) {}
  return REPO_URL + '/releases';
}
// interactive = triggered from the Help menu, so report "up to date" / "failed"
// as well. The silent launch check stays silent.
function checkForUpdate(interactive) {
  const say = (channel, payload) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
  };
  fetchFollow(UPDATE_URL, 0, (body) => {
    if (!body) { if (interactive) say('update-none', { failed: true }); return; }
    let data; try { data = JSON.parse(body); } catch (e) { if (interactive) say('update-none', { failed: true }); return; }
    const info = data.archivo;
    if (!info || !info.version) { if (interactive) say('update-none', { failed: true }); return; }
    if (!/^\d+\.\d+\.\d+$/.test(String(info.version))) { if (interactive) say('update-none', { failed: true }); return; }
    if (semverGt(info.version, app.getVersion())) {
      say('update-available', { version: String(info.version), url: safeReleaseUrl(info.url) });
    } else if (interactive) {
      say('update-none', { failed: false, version: app.getVersion() });
    }
  });
}

// ─────────────────────────────────────────────────────────────
// WINDOW
// ─────────────────────────────────────────────────────────────
function createWindow() {
  const isMac = process.platform === 'darwin';
  mainWindow = new BrowserWindow({
    width:    1280,
    height:   820,
    // 1100: below this, with the inspector open, the name column would have
    // to shrink under its 160 px floor to keep every column on screen.
    minWidth: 1100,
    minHeight:580,
    backgroundColor: '#0d0d11',
    // macOS: hidden inset title bar (traffic lights over our custom bar).
    // Windows/Linux: standard native frame.
    ...(isMac ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 14, y: 14 } } : {}),
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
      sandbox:          true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '..', 'build', isMac ? 'icon.icns' : 'icon.ico')
  });

  // Security: never open popups; never navigate away from the local app file.
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) e.preventDefault();
  });

  // Unsaved-changes guard. Closing the window is also what quitting does,
  // so this covers Cmd+Q / Alt+F4 / the red button in one place.
  mainWindow.on('close', (e) => {
    if (forceClose || !docDirty) return;
    e.preventDefault();
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type:      'warning',
      buttons:   ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId:  2,
      message:   `Save changes to "${docBaseName()}" before closing?`,
      detail:    "If you don't save, your changes will be lost.",
    });
    if (choice === 2) return;                       // Cancel
    if (choice === 1) { forceClose = true; mainWindow.close(); return; }  // Don't Save
    // Save: the renderer owns the catalog, so it saves then calls back.
    mainWindow.webContents.send('menu:command', { cmd: 'save-and-close' });
  });

  // A scan left running would keep walking a disk for nothing.
  mainWindow.on('closed', () => { if (activeScan) activeScan.cancelled = true; });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.webContents.once('did-finish-load', () => {
    applyDocState();
    setTimeout(() => checkForUpdate(false), 1500);
  });
}

// ── Title bar / proxy icon / edited dot ──
function docBaseName() {
  return currentPath ? path.basename(currentPath) : 'Untitled catalog';
}
function applyDocState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.setTitle('archivo — ' + docBaseName() + (docDirty ? ' — Edited' : ''));
  if (process.platform === 'darwin') {
    try { mainWindow.setRepresentedFilename(currentPath || ''); } catch (e) {}
    try { mainWindow.setDocumentEdited(docDirty); } catch (e) {}
  }
}

app.whenReady().then(() => {
  if (!pendingOpenPath) pendingOpenPath = argvCatalog(process.argv);
  buildMenu();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ─────────────────────────────────────────────────────────────
// PREFERENCES — small local file for app settings (e.g. dismissed
// update notice). The catalog itself is never auto-saved here; it
// only lives in the .archivo files the user explicitly saves.
// ─────────────────────────────────────────────────────────────
const PREFS_FILE = path.join(app.getPath('userData'), 'archivo_prefs.json');

function readPrefs() {
  try { return JSON.parse(fs.readFileSync(PREFS_FILE, 'utf8')) || {}; }
  catch { return {}; }
}
function writePrefs(prefs) {
  try {
    fs.mkdirSync(path.dirname(PREFS_FILE), { recursive: true });
    fs.writeFileSync(PREFS_FILE, JSON.stringify(prefs || {}, null, 2), 'utf8');
  } catch {}
  return true;
}

ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('prefs:load', () => readPrefs());
// The interface may only set its own keys, merged into the file. It used to
// replace the whole file, which wiped the recent catalogs list every time an
// update notice was dismissed.
const RENDERER_PREF_KEYS = ['dismissedUpdateVersion'];
ipcMain.handle('prefs:save', (_, prefs) => {
  const merged = readPrefs();
  for (const k of RENDERER_PREF_KEYS) {
    if (prefs && typeof prefs[k] === 'string') merged[k] = prefs[k].slice(0, 32);
  }
  return writePrefs(merged);
});

// ── RECENT CATALOGS ──
// Kept in our own prefs file (so the welcome screen can show them) and
// mirrored into the OS list (macOS "Open Recent", Windows jump list).
const MAX_RECENTS = 10;

function getRecents() {
  const list = readPrefs().recents;
  if (!Array.isArray(list)) return [];
  return list.filter(p => typeof p === 'string' && fs.existsSync(p)).slice(0, MAX_RECENTS);
}
function addRecent(filePath) {
  if (!filePath) return;
  const prefs = readPrefs();
  const list  = (Array.isArray(prefs.recents) ? prefs.recents : []).filter(p => p !== filePath);
  list.unshift(filePath);
  prefs.recents = list.slice(0, MAX_RECENTS);
  writePrefs(prefs);
  try { app.addRecentDocument(filePath); } catch (e) {}
  buildMenu();
}
function clearRecents() {
  const prefs = readPrefs();
  prefs.recents = [];
  writePrefs(prefs);
  try { app.clearRecentDocuments(); } catch (e) {}
  buildMenu();
  return [];
}

ipcMain.handle('recents:list',  () => getRecents());
ipcMain.handle('recents:clear', () => clearRecents());

// ── DOCUMENT LIFECYCLE ──
// The renderer tells us when the catalog becomes dirty/clean and when it
// starts a new or closes the current document; we own the path and title.
ipcMain.handle('doc:set-dirty', (_, d) => { docDirty = !!d; applyDocState(); return true; });
ipcMain.handle('doc:new',   () => { currentPath = null; docDirty = false; applyDocState(); return true; });
ipcMain.handle('doc:close', () => { currentPath = null; docDirty = false; applyDocState(); return true; });

// What the menu needs to know to grey out what makes no sense right now:
// no catalog open, no disk to export, a scan running.
let docUi = { open: false, disks: 0, scanning: false };
ipcMain.handle('doc:ui-state', (_, st) => {
  const next = { open: !!(st && st.open), disks: Math.max(0, Number(st && st.disks) || 0), scanning: !!(st && st.scanning) };
  if (next.open !== docUi.open || next.disks !== docUi.disks || next.scanning !== docUi.scanning) {
    docUi = next;
    buildMenu();
  }
  return true;
});

// Called once the UI is wired: returns a file the OS asked us to open, if any.
ipcMain.handle('doc:ready', () => {
  rendererReady = true;
  const p = pendingOpenPath;
  pendingOpenPath = null;
  return p;
});

// The renderer has finished saving on the way out (or gave up).
ipcMain.handle('window:force-close', (_, ok) => {
  if (ok === false) return true;   // save failed/cancelled → stay open
  forceClose = true;
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
  return true;
});
ipcMain.handle('shell:external', (_, url) => {
  try {
    const u = new URL(String(url));
    if (u.protocol === 'https:' && u.hostname === 'github.com') shell.openExternal(u.toString());
  } catch {}
  return true;
});

// ─────────────────────────────────────────────────────────────
// CATALOG FILES — open / save / save as
// .archivo is gzip-compressed JSON; a plain .json catalog is read
// transparently (gzip magic bytes) and written uncompressed if the
// user explicitly picks the .json filter.
// ─────────────────────────────────────────────────────────────
function readCatalogFile(filePath) {
  const tooBig = () => new Error('This catalog is too large to open (over 512 MB once decompressed).');
  if (fs.statSync(filePath).size > MAX_CATALOG_BYTES) throw tooBig();
  const buf = fs.readFileSync(filePath);
  let raw;
  if (buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    try { raw = zlib.gunzipSync(buf, { maxOutputLength: MAX_CATALOG_BYTES }).toString('utf8'); }
    catch (e) {
      if (e && (e.code === 'ERR_BUFFER_TOO_LARGE' || e instanceof RangeError)) throw tooBig();
      throw new Error('This file is damaged or is not an archivo catalog.');
    }
  } else {
    raw = buf.toString('utf8');
  }
  let data;
  try { data = JSON.parse(raw); }
  catch (e) { throw new Error('This file is damaged or is not an archivo catalog.'); }
  // Rebuilt field by field: a catalog from someone else is untrusted input.
  return sanitizeCatalog(data);
}

// Write through a temp file in the same folder, then rename: an interrupted
// save can never truncate the catalog you already had on disk.
function writeCatalogFile(filePath, catalog) {
  const json = JSON.stringify(catalog);
  const body = filePath.toLowerCase().endsWith('.json')
    ? Buffer.from(json, 'utf8')
    : zlib.gzipSync(Buffer.from(json, 'utf8'), { level: GZIP_LEVEL });
  const tmp = filePath + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, body);
  fs.renameSync(tmp, filePath);
  return filePath;
}

function defaultSaveDir() {
  try {
    const d = app.getPath('documents');
    if (d && fs.existsSync(d)) return d;
  } catch (e) {}
  return os.homedir();
}

// path optional: when given (double-click, recents, drag & drop) no dialog.
ipcMain.handle('catalog:open', async (_, filePath) => {
  let fp = filePath;
  if (!fp) {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title:      'Open archivo Catalog',
      filters:    [{ name: 'archivo Catalog', extensions: ['archivo','json','gz'] }],
      properties: ['openFile']
    });
    if (canceled || !filePaths.length) return null;
    fp = filePaths[0];
  }
  const data = readCatalogFile(fp);
  currentPath = fp;
  docDirty    = false;
  applyDocState();
  addRecent(fp);
  return { path: fp, data };
});

// Save in place. Returns { needsPath:true } when the catalog was never saved.
ipcMain.handle('catalog:save', async (_, catalog) => {
  if (!currentPath) return { needsPath: true };
  writeCatalogFile(currentPath, catalog);
  docDirty = false;
  applyDocState();
  addRecent(currentPath);
  return { path: currentPath };
});

ipcMain.handle('catalog:save-as', async (_, { catalog, suggestedName }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title:       'Save archivo Catalog',
    defaultPath: currentPath || path.join(defaultSaveDir(), suggestedName || 'archivo_catalog.archivo'),
    filters:     [
      { name: 'archivo Catalog (compressed)', extensions: ['archivo'] },
      { name: 'JSON (uncompressed)', extensions: ['json'] },
    ]
  });
  if (canceled || !filePath) return null;
  writeCatalogFile(filePath, catalog);
  currentPath = filePath;
  docDirty    = false;
  applyDocState();
  addRecent(filePath);
  return { path: filePath };
});

// ─────────────────────────────────────────────────────────────
// VOLUMES — df (macOS) / PowerShell + wmic fallback (Windows)
// ─────────────────────────────────────────────────────────────
ipcMain.handle('volumes:list', () => {
  if (process.platform === 'win32') return listVolumesWin();
  return listVolumesMac();
});

function listVolumesMac() {
  try {
    const raw   = execSync('df -Pk', { encoding: 'utf8' });
    const lines = raw.trim().split('\n').slice(1);
    const seen  = new Set(); // deduplicate by mount point
    const vols  = [];

    for (const line of lines) {
      const p = line.trim().split(/\s+/);
      if (p.length < 6) continue;
      const fs_type = p[0], mount = p[5];

      // Skip pseudo filesystems
      if (fs_type === 'devfs') continue;
      if (fs_type.startsWith('map ') || fs_type === 'map') continue;
      if (fs_type === 'nullfs') continue;
      if (mount === '/dev') continue;

      // Skip system internal volumes (keep only / and /Volumes/*)
      if (mount.startsWith('/System/Volumes/')) continue;
      if (mount.startsWith('/private/')) continue;
      if (mount.startsWith('/Library/')) continue;

      // Deduplicate
      if (seen.has(mount)) continue;
      seen.add(mount);

      const total = parseInt(p[1]) * 1024;
      const free  = parseInt(p[3]) * 1024;
      if (total === 0) continue; // skip zero-size pseudo volumes

      const name = mount === '/' ? 'Macintosh HD'
                 : path.basename(mount) || mount;

      // Determine volume type for icon
      const isUSB     = mount.startsWith('/Volumes/') && !mount.includes('NetDisk');
      const isNetwork = fs_type.includes('nfs') || fs_type.includes('smb') || fs_type.includes('afp')
                     || fs_type.includes('webdav') || mount.includes('NetDisk');
      const isSystem  = mount === '/';
      const volType   = isNetwork ? 'network' : isSystem ? 'system' : isUSB ? 'usb' : 'unknown';

      vols.push({
        name,
        mount_point: mount,
        total_bytes: total,
        free_bytes:  free,
        file_system: fs_type,
        removable:   isUSB,
        vol_type:    volType,
      });
    }
    return vols;
  } catch(e) { return []; }
}

function listVolumesWin() {
  // Preferred: PowerShell CIM with JSON output. Robust to commas in names,
  // and works on Windows 11 24H2+ where wmic has been removed.
  try {
    const raw = execFileSync('powershell.exe',
      ['-NoProfile','-Command',
       'Get-CimInstance Win32_LogicalDisk | Select-Object Caption,FreeSpace,Size,FileSystem,VolumeName,DriveType | ConvertTo-Json'],
      { encoding: 'utf8' });
    let data = JSON.parse(raw);
    if (!Array.isArray(data)) data = [data];
    const vols = data.map(o => {
      const total = parseInt(o.Size || '0'), free = parseInt(o.FreeSpace || '0');
      if (!total) return null;
      const dt = parseInt(o.DriveType || '0');
      const caption = String(o.Caption || '').toUpperCase();
      let volType = 'unknown';
      if (dt === 4) volType = 'network';
      else if (dt === 2) volType = 'usb';
      else if (dt === 3) volType = (caption === 'C:') ? 'system' : 'unknown';
      return {
        name: String(o.VolumeName || o.Caption || ''),
        mount_point: caption.endsWith('\\') ? caption : caption + '\\',
        total_bytes: total, free_bytes: free,
        file_system: String(o.FileSystem || ''),
        removable: dt === 2,
        vol_type: volType,
      };
    }).filter(Boolean);
    if (vols.length) return vols;
  } catch {}
  // Fallback: wmic (older Windows only)
  try {
    const raw   = execSync('wmic logicaldisk get Caption,FreeSpace,Size,FileSystem,VolumeName,DriveType /format:csv', { encoding: 'utf8' });
    const lines = raw.trim().split('\n').map(l => l.trim()).filter(Boolean);
    const headerIdx = lines.findIndex(l => l.startsWith('Node,'));
    if (headerIdx < 0 || lines.length < headerIdx + 2) return [];
    const header = lines[headerIdx].split(',');
    return lines.slice(headerIdx + 1).map(line => {
      const row = line.split(',');
      const o   = Object.fromEntries(header.map((h, i) => [h.trim(), (row[i]||'').trim()]));
      const total = parseInt(o['Size']||'0'), free = parseInt(o['FreeSpace']||'0');
      if (!total) return null;
      const dt = parseInt(o['DriveType']||'0');
      const caption = (o['Caption']||'').toUpperCase();
      let volType = 'unknown';
      if (dt === 4) volType = 'network';
      else if (dt === 2) volType = 'usb';
      else if (dt === 3) volType = (caption === 'C:') ? 'system' : 'unknown';
      return {
        name: o['VolumeName'] || o['Caption'],
        mount_point: caption.endsWith('\\') ? caption : caption + '\\',
        total_bytes: total, free_bytes: free,
        file_system: o['FileSystem'] || '',
        removable: dt === 2,
        vol_type: volType,
      };
    }).filter(Boolean);
  } catch { return []; }
}

// ─────────────────────────────────────────────────────────────
// DISK INFO — diskutil (macOS) / PowerShell (Windows)
// ─────────────────────────────────────────────────────────────
ipcMain.handle('volumes:info', (_, mountPoint) => {
  if (process.platform === 'darwin') {
    try {
      // execFileSync with an args array: no shell, no injection via volume names
      const raw = execFileSync('diskutil', ['info', String(mountPoint)], { encoding: 'utf8' });
      const get = key => { const m = raw.match(new RegExp(`${key}\\s*:\\s*(.+)`, 'i')); return m ? m[1].trim() : '—'; };
      return { model: get('Media Name'), serial: get('Media Serial Number'), iface: get('Protocol') };
    } catch { return { model: '—', serial: '—', iface: '—' }; }
  }
  if (process.platform === 'win32') {
    // Before 1.4.0 this returned the FIRST physical disk of the PC whatever
    // the volume (usually the system disk): every disk added on Windows got
    // the same serial number, and all looked like duplicates of each other.
    // Now: drive letter → its partition → its physical disk. If that fails,
    // "unknown" — never another disk's serial.
    const m = /^([A-Za-z]):/.exec(String(mountPoint || ''));
    if (m) {
      try {
        const raw = execFileSync('powershell.exe',
          ['-NoProfile','-NonInteractive','-Command',
           // [string] turns the bus type into its name ("USB"), not a number.
           `$d = Get-Partition -DriveLetter ${m[1].toUpperCase()} | Get-Disk | Select-Object -First 1; ` +
           `if ($d) { @{ model = [string]$d.FriendlyName; serial = [string]$d.SerialNumber; bus = [string]$d.BusType } | ConvertTo-Json -Compress }`],
          { encoding: 'utf8', timeout: 8000, windowsHide: true });
        const data = raw.trim() ? JSON.parse(raw) : null;
        if (data) {
          return { model:  String(data.model  || '').trim() || '—',
                   serial: String(data.serial || '').trim() || '—',
                   iface:  String(data.bus    || '').trim() || '—' };
        }
      } catch {}
    }
    return { model: '—', serial: '—', iface: '—' };
  }
  return { model: '—', serial: '—', iface: '—' };
});

// ─────────────────────────────────────────────────────────────
// SCAN — the walk itself lives in scanner.js
// One scan at a time: a second request is refused instead of sharing the
// cancel flag with the first (which let two scans cancel each other and mix
// their results).
// ─────────────────────────────────────────────────────────────
let activeScan = null;   // { cancelled:boolean } while a scan runs

ipcMain.handle('volumes:cancel-scan', () => { if (activeScan) activeScan.cancelled = true; return true; });

ipcMain.handle('volumes:scan', async (event, mountPoint) => {
  if (activeScan) throw new Error('A scan is already running.');
  if (typeof mountPoint !== 'string' || !fs.existsSync(mountPoint)) throw new Error(`Path not found: ${mountPoint}`);
  const job = { cancelled: false };
  activeScan = job;
  const send = (payload) => {
    if (event.sender && !event.sender.isDestroyed()) event.sender.send('scan:progress', payload);
  };
  try {
    return await scanVolume(mountPoint, { send, isCancelled: () => job.cancelled });
  } finally {
    if (activeScan === job) activeScan = null;
  }
});

// ─────────────────────────────────────────────────────────────
// EXPORT — CSV (plain text) and standalone HTML viewer (gzip-embedded)
// ─────────────────────────────────────────────────────────────
ipcMain.handle('export:text', async (_, { content, defaultName, filterName, extensions }) => {
  // Only plain-text formats: the interface cannot ask the main process to
  // write, say, an executable script under an innocent name.
  const ALLOWED = ['csv', 'txt'];
  const exts = (Array.isArray(extensions) ? extensions : ['txt']).filter(e => ALLOWED.includes(String(e).toLowerCase()));
  if (!exts.length || typeof content !== 'string') return null;
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title:       'Export',
    defaultPath: path.join(defaultSaveDir(), path.basename(String(defaultName || 'export.' + exts[0]))),
    filters:     [{ name: String(filterName || 'File'), extensions: exts }]
  });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
});

ipcMain.handle('export:html', async (_, { json, defaultName }) => {
  if (typeof json !== 'string') return null;
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title:       'Export as HTML',
    defaultPath: path.join(defaultSaveDir(), path.basename(String(defaultName || 'archivo_export.html'))),
    filters:     [{ name: 'HTML', extensions: ['html'] }]
  });
  if (canceled || !filePath) return null;
  // Gzip the catalog JSON and embed it as base64. The exported file's own
  // script decompresses it client-side with the browser's native
  // DecompressionStream — no bundled libraries, smallest possible output.
  const gz  = zlib.gzipSync(Buffer.from(json, 'utf8'), { level: GZIP_LEVEL });
  fs.writeFileSync(filePath, buildExportHtml(gz.toString('base64')), 'utf8');
  return filePath;
});

// ─────────────────────────────────────────────────────────────
// SHELL
// ─────────────────────────────────────────────────────────────
// Reveal only: shows the item selected in Finder / Explorer, never opens or
// runs it. (The former shell:open channel could launch any file, and the
// interface never used it: removed.)
ipcMain.handle('shell:reveal', (_, filePath) => {
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) return false;
  const p = path.normalize(filePath);
  if (!fs.existsSync(p)) return false;
  shell.showItemInFolder(p);
  return true;
});

// ─────────────────────────────────────────────────────────────
// APPLICATION MENU
// Every command is forwarded to the renderer, which owns the catalog
// and the unsaved-changes guard. Rebuilt whenever the recents change.
// ─────────────────────────────────────────────────────────────
function sendMenu(cmd, arg) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('menu:command', { cmd, arg });
  }
}

function buildMenu() {
  const isMac   = process.platform === 'darwin';
  const recents = getRecents();

  const recentItems = recents.length
    ? recents.map(p => ({
        label:   path.basename(p),
        toolTip: p,
        enabled: !docUi.scanning,
        click:   () => requestOpen(p),
      })).concat([
        { type: 'separator' },
        { label: 'Clear Menu', click: () => clearRecents() },
      ])
    : [{ label: 'No Recent Catalogs', enabled: false }];

  const template = [
    ...(isMac ? [{
      label: 'archivo',
      submenu: [
        { label: 'About archivo', click: () => sendMenu('about') },
        { label: 'Check for Updates…', click: () => checkForUpdate(true) },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Catalog',   accelerator: 'CmdOrCtrl+N', enabled: !docUi.scanning, click: () => sendMenu('new') },
        { label: 'Open Catalog…', accelerator: 'CmdOrCtrl+O', enabled: !docUi.scanning, click: () => sendMenu('open') },
        { label: 'Open Recent', submenu: recentItems },
        { type: 'separator' },
        { label: 'Add Disk…', accelerator: 'CmdOrCtrl+D', enabled: docUi.open && !docUi.scanning, click: () => sendMenu('add-disk') },
        { type: 'separator' },
        { label: 'Save',     accelerator: 'CmdOrCtrl+S',       enabled: docUi.open, click: () => sendMenu('save') },
        { label: 'Save As…', accelerator: 'Shift+CmdOrCtrl+S', enabled: docUi.open, click: () => sendMenu('save-as') },
        { type: 'separator' },
        { label: 'Export…', accelerator: 'CmdOrCtrl+E', enabled: docUi.open && docUi.disks > 0, click: () => sendMenu('export') },
        { type: 'separator' },
        { label: 'Close Catalog', accelerator: 'Shift+CmdOrCtrl+W', enabled: docUi.open && !docUi.scanning, click: () => sendMenu('close-doc') },
        isMac ? { role: 'close', label: 'Close Window' } : { role: 'quit', label: 'Quit archivo' },
      ]
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { label: 'Find',             accelerator: 'CmdOrCtrl+F', enabled: docUi.open, click: () => sendMenu('focus-search') },
        { label: 'Toggle Inspector', accelerator: 'CmdOrCtrl+I', enabled: docUi.open, click: () => sendMenu('toggle-inspector') },
        { type: 'separator' },
        // Reload wiped an unsaved catalog without warning (⌘R): development
        // builds only, together with the developer tools.
        ...(app.isPackaged ? [] : [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }]),
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ]
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        { label: 'archivo on GitHub', click: () => shell.openExternal(REPO_URL) },
        { label: 'Report an Issue',   click: () => shell.openExternal(REPO_URL + '/issues') },
        ...(isMac ? [] : [
          { type: 'separator' },
          { label: 'Check for Updates…', click: () => checkForUpdate(true) },
          { label: 'About archivo',      click: () => sendMenu('about') },
        ]),
      ]
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// For the test suite only (test/smoke.js): the app itself never imports main.js.
module.exports = { safeReleaseUrl };
