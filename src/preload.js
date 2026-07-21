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
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('archivo', {
  exportCatalog:  (catalog) => ipcRenderer.invoke('catalog:export', catalog),
  importCatalog:  ()       => ipcRenderer.invoke('catalog:import'),

  listVolumes:    ()       => ipcRenderer.invoke('volumes:list'),
  getDiskInfo:    mount    => ipcRenderer.invoke('volumes:info', mount),
  scanVolume:     mount    => ipcRenderer.invoke('volumes:scan', mount),
  cancelScan:     ()       => ipcRenderer.invoke('volumes:cancel-scan'),

  revealInFinder: p        => ipcRenderer.invoke('shell:reveal', p),
  openPath:       p        => ipcRenderer.invoke('shell:open',   p),

  onScanProgress: cb       => ipcRenderer.on('scan:progress', (_, d) => cb(d)),
  offScanProgress: ()      => ipcRenderer.removeAllListeners('scan:progress'),

  appVersion:     ()       => ipcRenderer.invoke('app:version'),
  loadPrefs:      ()       => ipcRenderer.invoke('prefs:load'),
  savePrefs:      prefs    => ipcRenderer.invoke('prefs:save', prefs),
  openExternal:   url      => ipcRenderer.invoke('shell:external', url),
  onUpdateAvailable: cb    => { ipcRenderer.on('update-available', (_, d) => cb(d)); return () => ipcRenderer.removeAllListeners('update-available'); },

  platform: process.platform,
});
