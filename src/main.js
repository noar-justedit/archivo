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

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path   = require('path');
const fs     = require('fs');
const os     = require('os');
const zlib   = require('zlib');
const https  = require('https');
const { execSync, execFileSync } = require('child_process');

let mainWindow;

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
function checkForUpdate() {
  fetchFollow(UPDATE_URL, 0, (body) => {
    if (!body) return;
    let data; try { data = JSON.parse(body); } catch (e) { return; }
    const info = data.archivo;
    if (!info || !info.version) return;
    if (semverGt(info.version, app.getVersion()) && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-available', { version: info.version, url: info.url || 'https://github.com/noar-justedit/archivo/releases' });
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

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.webContents.once('did-finish-load', () => { setTimeout(checkForUpdate, 1500); });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ─────────────────────────────────────────────────────────────
// CATALOG — stocké dans userData (même principe que Projecto)
// ─────────────────────────────────────────────────────────────
const PREFS_FILE = path.join(app.getPath('userData'), 'archivo_prefs.json');

ipcMain.handle('app:version', () => app.getVersion());

ipcMain.handle('prefs:load', () => {
  try { return JSON.parse(fs.readFileSync(PREFS_FILE, 'utf8')); }
  catch { return {}; }
});
ipcMain.handle('prefs:save', (_, prefs) => {
  try {
    fs.mkdirSync(path.dirname(PREFS_FILE), { recursive: true });
    fs.writeFileSync(PREFS_FILE, JSON.stringify(prefs || {}, null, 2), 'utf8');
  } catch {}
  return true;
});
ipcMain.handle('shell:external', (_, url) => {
  try {
    const u = new URL(String(url));
    if (u.protocol === 'https:' || u.protocol === 'http:') shell.openExternal(u.toString());
  } catch {}
  return true;
});

ipcMain.handle('catalog:export', async (_, catalog) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title:       'Save archivo Database',
    defaultPath: path.join(os.homedir(), 'Desktop', 'archivo_catalog.archivo'),
    filters:     [
      { name: 'archivo Database (compressed)', extensions: ['archivo'] },
      { name: 'JSON (uncompressed)', extensions: ['json'] },
    ]
  });
  if (canceled || !filePath) return null;
  const json = JSON.stringify(catalog);
  if (filePath.toLowerCase().endsWith('.json')) {
    // Plain JSON if the user explicitly chose .json
    fs.writeFileSync(filePath, json, 'utf8');
  } else {
    // Default: gzip-compressed .archivo
    const gz = zlib.gzipSync(Buffer.from(json, 'utf8'), { level: 9 });
    fs.writeFileSync(filePath, gz);
  }
  return filePath;
});

ipcMain.handle('catalog:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title:      'Open archivo Database',
    filters:    [{ name: 'archivo Database', extensions: ['archivo','json','gz'] }],
    properties: ['openFile']
  });
  if (canceled || !filePaths.length) return null;
  const buf = fs.readFileSync(filePaths[0]);
  let raw;
  // gzip magic bytes: 0x1f 0x8b
  if (buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    raw = zlib.gunzipSync(buf).toString('utf8');
  } else {
    raw = buf.toString('utf8');
  }
  const data = JSON.parse(raw);
  if (!Array.isArray(data.disks)) throw new Error('Invalid catalog format');
  return data;
});

// ─────────────────────────────────────────────────────────────
// VOLUMES — df (macOS) / wmic (Windows)
// ─────────────────────────────────────────────────────────────
ipcMain.handle('volumes:list', () => {
  if (process.platform === 'win32') return listVolumesWin();
  return listVolumesMac();
});

function listVolumesMac() {
  try {
    // Use diskutil list for better volume info, fall back to df
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
// DISK INFO — diskutil (macOS) / wmic (Windows)
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
        nodes.push({ type:'dir', name:e.name, modified:stat.mtime.toISOString().slice(0,10), children: await walk(full, depth+1) });
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
// SHELL
// ─────────────────────────────────────────────────────────────
ipcMain.handle('shell:reveal', (_, filePath) => {
  if (fs.existsSync(filePath)) shell.showItemInFolder(filePath);
});
ipcMain.handle('shell:open', (_, filePath) => {
  shell.openPath(filePath);
});
