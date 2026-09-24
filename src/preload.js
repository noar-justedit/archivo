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
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('archivo', {
  // ── Document: open / save / save as ──
  // openCatalog() with no path shows the file dialog; with a path it opens
  // straight away (double-click, Open Recent, drag & drop).
  openCatalog:    p        => ipcRenderer.invoke('catalog:open', p),
  saveCatalog:    catalog  => ipcRenderer.invoke('catalog:save', catalog),
  saveCatalogAs:  opts     => ipcRenderer.invoke('catalog:save-as', opts),
  newDocument:    ()       => ipcRenderer.invoke('doc:new'),
  closeDocument:  ()       => ipcRenderer.invoke('doc:close'),
  setDirty:       d        => ipcRenderer.invoke('doc:set-dirty', d),
  // What the native menu should grey out: { open, disks, scanning }.
  uiState:        st       => ipcRenderer.invoke('doc:ui-state', st),
  docReady:       ()       => ipcRenderer.invoke('doc:ready'),
  forceClose:     ok       => ipcRenderer.invoke('window:force-close', ok),

  recents:        ()       => ipcRenderer.invoke('recents:list'),
  clearRecents:   ()       => ipcRenderer.invoke('recents:clear'),

  // Electron 32+ removed File.path — this is the sanctioned replacement.
  pathForFile:    file     => { try { return webUtils.getPathForFile(file) || ''; } catch (e) { return ''; } },

  onMenuCommand:  cb       => ipcRenderer.on('menu:command',     (_, d) => cb(d)),
  onOpenRequest:  cb       => ipcRenderer.on('doc:open-request', (_, p) => cb(p)),

  exportText:     opts     => ipcRenderer.invoke('export:text', opts),
  exportHtml:     opts     => ipcRenderer.invoke('export:html', opts),

  listVolumes:    ()       => ipcRenderer.invoke('volumes:list'),
  getDiskInfo:    mount    => ipcRenderer.invoke('volumes:info', mount),
  scanVolume:     mount    => ipcRenderer.invoke('volumes:scan', mount),
  cancelScan:     ()       => ipcRenderer.invoke('volumes:cancel-scan'),

  // Shows an item in Finder / Explorer (never opens it). Returns false if
  // the path does not exist.
  revealInFinder: p        => ipcRenderer.invoke('shell:reveal', p),

  onScanProgress: cb       => ipcRenderer.on('scan:progress', (_, d) => cb(d)),
  offScanProgress: ()      => ipcRenderer.removeAllListeners('scan:progress'),

  appVersion:     ()       => ipcRenderer.invoke('app:version'),
  loadPrefs:      ()       => ipcRenderer.invoke('prefs:load'),
  savePrefs:      prefs    => ipcRenderer.invoke('prefs:save', prefs),
  openExternal:   url      => ipcRenderer.invoke('shell:external', url),
  onUpdateAvailable: cb    => { ipcRenderer.on('update-available', (_, d) => cb(d)); return () => ipcRenderer.removeAllListeners('update-available'); },
  onUpdateNone:      cb    => ipcRenderer.on('update-none', (_, d) => cb(d)),

  platform: process.platform,
});
