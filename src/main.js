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
    if (semverGt(info.version, app.getVersion())) {
      say('update-available', { version: info.version, url: info.url || REPO_URL + '/releases' });
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
    minWidth: 900,
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
ipcMain.handle('prefs:save', (_, prefs) => writePrefs(prefs));

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
    if (u.protocol === 'https:' || u.protocol === 'http:') shell.openExternal(u.toString());
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
  const buf = fs.readFileSync(filePath);
  const raw = (buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b)
    ? zlib.gunzipSync(buf).toString('utf8')
    : buf.toString('utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data.disks)) throw new Error('Invalid catalog format');
  return data;
}

// Write through a temp file in the same folder, then rename: an interrupted
// save can never truncate the catalog you already had on disk.
function writeCatalogFile(filePath, catalog) {
  const json = JSON.stringify(catalog);
  const body = filePath.toLowerCase().endsWith('.json')
    ? Buffer.from(json, 'utf8')
    : zlib.gzipSync(Buffer.from(json, 'utf8'), { level: 9 });
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
    try {
      const raw = execFileSync('powershell.exe',
        ['-NoProfile','-Command','Get-CimInstance Win32_DiskDrive | Select-Object Model,SerialNumber | ConvertTo-Json'],
        { encoding: 'utf8' });
      let data = JSON.parse(raw);
      if (!Array.isArray(data)) data = [data];
      if (data.length) {
        return { model: String(data[0].Model||'').trim(), serial: String(data[0].SerialNumber||'').trim(), iface: 'USB / SATA' };
      }
    } catch {}
  }
  return { model: '—', serial: '—', iface: '—' };
});

// ─────────────────────────────────────────────────────────────
// SCAN — walk filesystem, emit progress events
// ─────────────────────────────────────────────────────────────
let scanCancelled = false;

ipcMain.handle('volumes:cancel-scan', () => { scanCancelled = true; return true; });

ipcMain.handle('volumes:scan', async (event, mountPoint) => {
  if (!fs.existsSync(mountPoint)) throw new Error(`Path not found: ${mountPoint}`);
  scanCancelled = false;

  const SKIP = new Set(['.Spotlight-V100','.fseventsd','.Trashes','.DocumentRevisions-V100',
                        'System Volume Information','$RECYCLE.BIN','lost+found',
                        'node_modules','.git','.cache','Caches']);

  // When scanning a system root volume, skip the big OS trees that would
  // otherwise mean millions of files and a frozen scan.
  // System root volume detection: macOS '/' or a Windows drive root like 'C:\'
  const isWin  = process.platform === 'win32';
  const isRoot = mountPoint === '/' ||
                 (isWin && /^[A-Za-z]:\\?$/.test(mountPoint));
  const ROOT_SKIP = new Set([
    // macOS
    'System','Library','private','Applications','usr','bin','sbin',
    'opt','cores','dev','Volumes','tmp','var','etc','Network',
    // Windows
    'Windows','Program Files','Program Files (x86)','ProgramData',
    '$Recycle.Bin','System Volume Information','Recovery','PerfLogs',
    'AppData','MSOCache'
  ]);
  const shouldSkip = (name, depth) => {
    if (name.startsWith('.') || SKIP.has(name)) return true;
    if (isRoot && depth === 0 && ROOT_SKIP.has(name)) return true;
    return false;
  };

  const send = (payload) => {
    if (event.sender && !event.sender.isDestroyed()) event.sender.send('scan:progress', payload);
  };
  const yieldToLoop = () => new Promise(r => setImmediate(r));

  // ── PHASE 1: count files with a budget so huge volumes don't freeze ──
  const COUNT_TIME_BUDGET = 3000;   // ms
  const COUNT_FILE_BUDGET = 300000; // files
  let total = 0;
  let indeterminate = false;
  const countStart = Date.now();
  let countCheck = 0;

  async function countFiles(dirPath, depth) {
    if (depth > 128 || scanCancelled || indeterminate) return;
    let entries;
    try { entries = fs.readdirSync(dirPath, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (scanCancelled || indeterminate) return;
      if (shouldSkip(e.name, depth)) continue;
      if (e.isDirectory()) {
        await countFiles(path.join(dirPath, e.name), depth + 1);
      } else if (e.isFile()) {
        total++;
        if ((++countCheck & 0x3FF) === 0) { // every 1024 files: check budget + yield
          if (total > COUNT_FILE_BUDGET || (Date.now() - countStart) > COUNT_TIME_BUDGET) {
            indeterminate = true;
            return;
          }
          send({ phase: 'counting', files: total, total: 0, pct: 0, eta: 0, path: 'Counting files…', done: false });
          await yieldToLoop();
        }
      }
    }
  }
  send({ phase: 'counting', files: 0, total: 0, pct: 0, eta: 0, path: 'Counting files…', done: false });
  await countFiles(mountPoint, 0);
  if (scanCancelled) { send({ cancelled: true, done: true }); return { cancelled: true }; }

  // ── PHASE 2: build tree, emit progress with %, ETA ──
  let done = 0;
  const startTime = Date.now();
  let lastEmit = 0;

  async function walk(dirPath, depth) {
    if (depth > 128 || scanCancelled) return [];
    let entries;
    try { entries = fs.readdirSync(dirPath, { withFileTypes: true }); } catch { return []; }
    const nodes = [];
    for (const e of entries) {
      if (scanCancelled) return nodes;
      if (shouldSkip(e.name, depth)) continue;
      const full = path.join(dirPath, e.name);
      let stat;
      try { stat = fs.statSync(full); } catch { continue; }
      if (e.isDirectory()) {
        const children = await walk(full, depth+1);
        const dirSize  = children.reduce((sum, c) => sum + (c.size || 0), 0);
        nodes.push({ type:'dir', name:e.name, size:dirSize, modified:stat.mtime.toISOString().slice(0,10), children });
      } else if (e.isFile()) {
        done++;
        nodes.push({ type:'file', name:e.name, size:stat.size, modified:stat.mtime.toISOString().slice(0,10) });
        const now = Date.now();
        if (now - lastEmit > 60) {
          lastEmit = now;
          if (indeterminate) {
            send({ phase:'scanning', files: done, total: 0, pct: -1, eta: 0, path: full, done: false });
          } else {
            const pct     = total > 0 ? Math.min(99, Math.round(done / total * 100)) : 0;
            const elapsed = (now - startTime) / 1000;
            const rate    = done / Math.max(elapsed, 0.001);
            const remain  = Math.max(0, total - done);
            const eta     = rate > 0 ? Math.round(remain / rate) : 0;
            send({ phase:'scanning', files: done, total, pct, eta, path: full, done: false });
          }
          await yieldToLoop();
        }
      }
    }
    nodes.sort((a,b) => { if(a.type!==b.type) return a.type==='dir'?-1:1; return a.name.toLowerCase().localeCompare(b.name.toLowerCase()); });
    return nodes;
  }

  const tree = await walk(mountPoint, 0);
  if (scanCancelled) { send({ cancelled: true, done: true }); return { cancelled: true }; }
  send({ phase:'done', files: done, total: indeterminate ? done : total, pct: 100, eta: 0, path: '', done: true });
  return { tree, fileCount: done };
});

// ─────────────────────────────────────────────────────────────
// EXPORT — CSV (plain text) and standalone HTML viewer (gzip-embedded)
// ─────────────────────────────────────────────────────────────
ipcMain.handle('export:text', async (_, { content, defaultName, filterName, extensions }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title:       'Export',
    defaultPath: path.join(os.homedir(), 'Desktop', defaultName || 'export.txt'),
    filters:     [{ name: filterName || 'File', extensions: extensions || ['txt'] }]
  });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
});

ipcMain.handle('export:html', async (_, { json, defaultName }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title:       'Export as HTML',
    defaultPath: path.join(os.homedir(), 'Desktop', defaultName || 'archivo_export.html'),
    filters:     [{ name: 'HTML', extensions: ['html'] }]
  });
  if (canceled || !filePath) return null;
  // Gzip the catalog JSON and embed it as base64. The exported file's own
  // script decompresses it client-side with the browser's native
  // DecompressionStream — no bundled libraries, smallest possible output.
  const gz  = zlib.gzipSync(Buffer.from(json, 'utf8'), { level: 9 });
  const b64 = gz.toString('base64');
  const html = buildExportHtml(b64);
  fs.writeFileSync(filePath, html, 'utf8');
  return filePath;
});

function buildExportHtml(b64) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>archivo export</title>
<style>
:root{--bg:#0d0d11;--pn:#16161c;--bd:#242430;--tx:#e8e8ee;--mu:#9090a0;--v:#6e56e3}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--tx);font:14px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:flex;height:100vh;overflow:hidden}
#side{width:260px;flex:none;background:var(--pn);border-right:1px solid var(--bd);overflow-y:auto;padding:10px}
#side h1{font-size:15px;margin:4px 8px 12px;font-weight:600}
.dk{padding:8px 10px;border-radius:6px;cursor:pointer;font-size:13px}
.dk:hover{background:var(--bd)}
.dk.sel{background:var(--v);color:#fff}
.dk .m{font-size:11px;color:var(--mu);display:block}
.dk.sel .m{color:#d8d2fb}
#main{flex:1;overflow-y:auto;padding:16px 20px}
#search{width:100%;padding:9px 12px;border-radius:6px;border:1px solid var(--bd);background:var(--pn);color:var(--tx);font-size:13px;margin-bottom:14px}
.node{padding:3px 0 3px 18px;font-size:13px;white-space:nowrap;cursor:pointer;user-select:none}
.node.file{cursor:default;color:var(--mu)}
.node .nm{color:var(--tx)}
.node .sz{color:var(--mu);font-size:11px;margin-left:8px}
.kids{margin-left:14px;border-left:1px solid var(--bd)}
.hidden{display:none}
.hit{padding:6px 4px;border-bottom:1px solid var(--bd);font-size:12px}
.hit .p{color:var(--mu)}
#empty{color:var(--mu);padding:40px;text-align:center}
</style></head>
<body>
<div id="side"><h1>archivo export</h1><div id="disklist"></div></div>
<div id="main">
  <input id="search" placeholder="Search files…" oninput="doSearch(this.value)">
  <div id="tree"></div>
</div>
<script>
const GZ = "${b64}";
function b64ToBytes(b64){const bin=atob(b64);const arr=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);return arr;}
async function inflate(b64){
  const bytes = b64ToBytes(b64);
  const ds = new DecompressionStream('gzip');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  const buf = await new Response(stream).arrayBuffer();
  return new TextDecoder().decode(buf);
}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function fmtB(b){
  if(typeof b!=='number'||!isFinite(b)||b<=0) return String(b||'');
  const u=['B','KB','MB','GB','TB'];let i=0;
  while(b>=1024&&i<u.length-1){b/=1024;i++;}
  return b.toFixed(i>1?1:0)+' '+u[i];
}
let DATA=[], FLAT=null, curDisk=0;
function renderDiskList(){
  const el=document.getElementById('disklist');
  el.innerHTML = DATA.map((d,i)=>\`<div class="dk\${i===curDisk?' sel':''}" onclick="selectDisk(\${i})">\${esc(d.label)}<span class="m">\${esc(d.total||'')}</span></div>\`).join('');
}
function selectDisk(i){
  curDisk=i;
  renderDiskList();
  document.getElementById('search').value='';
  const t=document.getElementById('tree');
  t.innerHTML='';
  t.appendChild(renderNodes(DATA[i].tree||[]));
}
function renderNodes(nodes){
  const frag=document.createDocumentFragment();
  for(const n of nodes){
    const row=document.createElement('div');
    row.className='node'+(n.type==='file'?' file':'');
    if(n.type==='dir'){
      row.innerHTML='<span class="nm">▸ '+esc(n.name)+'</span><span class="sz">'+fmtB(n.size)+'</span>';
      const kids=document.createElement('div');
      kids.className='kids hidden';
      let built=false;
      row.onclick=(e)=>{e.stopPropagation();
        if(!built){kids.appendChild(renderNodes(n.children||[]));built=true;}
        kids.classList.toggle('hidden');
        row.querySelector('.nm').textContent=(kids.classList.contains('hidden')?'▸ ':'▾ ')+n.name;
      };
      const wrap=document.createElement('div');
      wrap.appendChild(row); wrap.appendChild(kids);
      frag.appendChild(wrap);
    } else {
      row.innerHTML='<span class="nm">'+esc(n.name)+'</span><span class="sz">'+fmtB(n.size)+'</span>';
      frag.appendChild(row);
    }
  }
  return frag;
}
function buildFlat(){
  FLAT=[];
  DATA.forEach(d=>{
    (function walk(nodes,p){
      for(const n of nodes){
        const full=p?p+'/'+n.name:n.name;
        if(n.type==='file') FLAT.push({disk:d.label,path:full,size:n.size||''});
        else walk(n.children||[],full);
      }
    })(d.tree||[],'');
  });
}
let searchTimer=null;
function doSearch(q){
  clearTimeout(searchTimer);
  searchTimer=setTimeout(()=>{
    const t=document.getElementById('tree');
    q=q.trim().toLowerCase();
    if(!q){ selectDisk(curDisk); return; }
    if(!FLAT) buildFlat();
    const hits=FLAT.filter(f=>f.path.toLowerCase().includes(q)).slice(0,500);
    t.innerHTML = hits.length
      ? hits.map(h=>\`<div class="hit"><div>\${esc(h.path.split('/').pop())} <span class="sz">\${fmtB(h.size)}</span></div><div class="p">\${esc(h.disk)} / \${esc(h.path)}</div></div>\`).join('')
      : '<div id="empty">No matches</div>';
  },120);
}
inflate(GZ).then(txt=>{
  DATA=JSON.parse(txt);
  if(!DATA.length){document.getElementById('main').innerHTML='<div id="empty">Empty catalog</div>';return;}
  renderDiskList();
  selectDisk(0);
}).catch(()=>{
  document.body.innerHTML='<div style="padding:40px;font-family:sans-serif;color:#e8e8ee;background:#0d0d11">This export needs a modern browser (Chrome, Edge, Firefox 113+, Safari 16.4+) to open.</div>';
});
</script>
</body></html>`;
}

// ─────────────────────────────────────────────────────────────
// SHELL
// ─────────────────────────────────────────────────────────────
ipcMain.handle('shell:reveal', (_, filePath) => {
  if (fs.existsSync(filePath)) shell.showItemInFolder(filePath);
});
ipcMain.handle('shell:open', (_, filePath) => {
  shell.openPath(filePath);
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
        { label: 'New Catalog',   accelerator: 'CmdOrCtrl+N', click: () => sendMenu('new') },
        { label: 'Open Catalog…', accelerator: 'CmdOrCtrl+O', click: () => sendMenu('open') },
        { label: 'Open Recent', submenu: recentItems },
        { type: 'separator' },
        { label: 'Add Disk…', accelerator: 'CmdOrCtrl+D', click: () => sendMenu('add-disk') },
        { type: 'separator' },
        { label: 'Save',     accelerator: 'CmdOrCtrl+S',       click: () => sendMenu('save') },
        { label: 'Save As…', accelerator: 'Shift+CmdOrCtrl+S', click: () => sendMenu('save-as') },
        { type: 'separator' },
        { label: 'Export…', accelerator: 'CmdOrCtrl+E', click: () => sendMenu('export') },
        { type: 'separator' },
        { label: 'Close Catalog', accelerator: 'Shift+CmdOrCtrl+W', click: () => sendMenu('close-doc') },
        isMac ? { role: 'close', label: 'Close Window' } : { role: 'quit', label: 'Quit archivo' },
      ]
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { label: 'Find',             accelerator: 'CmdOrCtrl+F', click: () => sendMenu('focus-search') },
        { label: 'Toggle Inspector', accelerator: 'CmdOrCtrl+I', click: () => sendMenu('toggle-inspector') },
        { type: 'separator' },
        { role: 'reload' }, { role: 'toggleDevTools' },
        { type: 'separator' },
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
