/*
 * archivo — offline hard-disk catalog · interface logic
 * Copyright (C) 2026 Noar (just edit) — GPL-3.0-or-later
 *
 * Loaded as an external file (not inline) so the page can carry a strict
 * Content-Security-Policy: no inline script is allowed to run, which blocks
 * any HTML injected from a catalog file even if an escape is ever missed.
 */
'use strict';

/* Icônes Lucide (ISC, lucide.dev), chemins repris tels quels de lucide-static 0.460.0.
   Ne jamais redessiner une icône à la main : en ajouter une = copier son contenu SVG ici. */
const LUCIDE = {
  "plus": "<path d=\"M5 12h14\" /> <path d=\"M12 5v14\" />",
  "folder-open": "<path d=\"m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2\" />",
  "save": "<path d=\"M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z\" /> <path d=\"M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7\" /> <path d=\"M7 3v4a1 1 0 0 0 1 1h7\" />",
  "x": "<path d=\"M18 6 6 18\" /> <path d=\"m6 6 12 12\" />",
  "download": "<path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /> <polyline points=\"7 10 12 15 17 10\" /> <line x1=\"12\" x2=\"12\" y1=\"15\" y2=\"3\" />",
  "trash-2": "<path d=\"M3 6h18\" /> <path d=\"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6\" /> <path d=\"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2\" /> <line x1=\"10\" x2=\"10\" y1=\"11\" y2=\"17\" /> <line x1=\"14\" x2=\"14\" y1=\"11\" y2=\"17\" />",
  "panel-right": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" /> <path d=\"M15 3v18\" />",
  "search": "<circle cx=\"11\" cy=\"11\" r=\"8\" /> <path d=\"m21 21-4.3-4.3\" />",
  "film": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" /> <path d=\"M7 3v18\" /> <path d=\"M3 7.5h4\" /> <path d=\"M3 12h18\" /> <path d=\"M3 16.5h4\" /> <path d=\"M17 3v18\" /> <path d=\"M17 7.5h4\" /> <path d=\"M17 16.5h4\" />",
  "image": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" ry=\"2\" /> <circle cx=\"9\" cy=\"9\" r=\"2\" /> <path d=\"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21\" />",
  "music": "<path d=\"M9 18V5l12-2v13\" /> <circle cx=\"6\" cy=\"18\" r=\"3\" /> <circle cx=\"18\" cy=\"16\" r=\"3\" />",
  "file-archive": "<path d=\"M10 12v-1\" /> <path d=\"M10 18v-2\" /> <path d=\"M10 7V6\" /> <path d=\"M14 2v4a2 2 0 0 0 2 2h4\" /> <path d=\"M15.5 22H18a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v16a2 2 0 0 0 .274 1.01\" /> <circle cx=\"10\" cy=\"20\" r=\"2\" />",
  "file-text": "<path d=\"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z\" /> <path d=\"M14 2v4a2 2 0 0 0 2 2h4\" /> <path d=\"M10 9H8\" /> <path d=\"M16 13H8\" /> <path d=\"M16 17H8\" />",
  "file": "<path d=\"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z\" /> <path d=\"M14 2v4a2 2 0 0 0 2 2h4\" />",
  "folder": "<path d=\"M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z\" />",
  "archive": "<rect width=\"20\" height=\"5\" x=\"2\" y=\"3\" rx=\"1\" /> <path d=\"M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8\" /> <path d=\"M10 12h4\" />",
  "globe": "<circle cx=\"12\" cy=\"12\" r=\"10\" /> <path d=\"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20\" /> <path d=\"M2 12h20\" />",
  "info": "<circle cx=\"12\" cy=\"12\" r=\"10\" /> <path d=\"M12 16v-4\" /> <path d=\"M12 8h.01\" />",
  "chevron-right": "<path d=\"m9 18 6-6-6-6\" />",
  "chevron-down": "<path d=\"m6 9 6 6 6-6\" />",
  "refresh-cw": "<path d=\"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8\" /> <path d=\"M21 3v5h-5\" /> <path d=\"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16\" /> <path d=\"M8 16H3v5\" />",
  "pencil": "<path d=\"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z\" /> <path d=\"m15 5 4 4\" />",
  "message-square": "<path d=\"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z\" />",
  "external-link": "<path d=\"M15 3h6v6\" /> <path d=\"M10 14 21 3\" /> <path d=\"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6\" />",
  "circle-x": "<circle cx=\"12\" cy=\"12\" r=\"10\" /> <path d=\"m15 9-6 6\" /> <path d=\"m9 9 6 6\" />",
  "hard-drive": "<line x1=\"22\" x2=\"2\" y1=\"12\" y2=\"12\" /> <path d=\"M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z\" /> <line x1=\"6\" x2=\"6.01\" y1=\"16\" y2=\"16\" /> <line x1=\"10\" x2=\"10.01\" y1=\"16\" y2=\"16\" />",
  "file-spreadsheet": "<path d=\"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z\" /> <path d=\"M14 2v4a2 2 0 0 0 2 2h4\" /> <path d=\"M8 13h2\" /> <path d=\"M14 13h2\" /> <path d=\"M8 17h2\" /> <path d=\"M14 17h2\" />",
  "folder-search": "<path d=\"M10.7 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v4.1\" /> <path d=\"m21 21-1.9-1.9\" /> <circle cx=\"17\" cy=\"17\" r=\"3\" />"
  };
function ico(name, size){
  const s = size || 16;
  return '<span class="ico"><svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(LUCIDE[name]||'')+'</svg></span>';
}
function paintIcons(root){
  (root||document).querySelectorAll('[data-ico]').forEach(el => {
    el.innerHTML = ico(el.dataset.ico, +el.dataset.size || 16);
  });
}

/* ════════════════════════════════════════════════
   STATE
════════════════════════════════════════════════ */
let DB          = { disks: [] };
let expanded    = new Set();
let selected    = null;   // {type:'disk'|'node', disk, node?, key?}
let appVersion  = '';
let dismissedUpdateVersion = '';
let ctxTarget   = null;
let sortK       = 'name';
let sortAsc     = true;
let srchTimer   = null;
let srchFilter  = 'all';
let inspOpen    = true;
let pendingVol  = null;
let hideSystem  = false; // filter toggles in Add Disk modal
let hideNetwork = false;

// ── Document state ──
let docPath     = null;  // file the catalog was opened from / saved to (null = never saved)
let docOpen     = false; // a catalog is open (vs. the welcome screen)
let dirty       = false; // unsaved changes since the last save

const V  = new Set(['mp4','mov','avi','mkv','mxf','r3d','braw','mts','m2ts','wmv','prproj','drp','fcpbundle','aaf']);
const I  = new Set(['jpg','jpeg','png','tif','tiff','raw','cr2','nef','arw','psd','ai','eps','svg','gif','webp','dpx','exr','heic']);
const A  = new Set(['mp3','wav','aiff','aif','flac','aac','m4a','ogg']);
const D  = new Set(['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','md','rtf','csv','xml','json']);
const AR = new Set(['zip','rar','7z','tar','gz','bz2','tgz','tbz','sit','sitx','lha','lzh','z','cpgz','dmg']);


/* ════════════════════════════════════════════════
   TREE EVENT DELEGATION
   Rows are drawn on the fly (see TREE RENDER): events are caught once on the
   scrolling container, and each row carries its index in ROWS.
════════════════════════════════════════════════ */
function getRow(e) { return e.target.closest('.tr'); }
function rowAt(el) { const i = +el.dataset.i; return Number.isInteger(i) ? ROWS[i] : null; }

function treeClick(e) {
  const el = getRow(e); if (!el) return;
  const r = rowAt(el); if (!r) return;
  if (e.target.closest('.tr-tog') && (!r.node || r.node.type === 'dir')) {
    e.stopPropagation();
    selectRow(r);
    togExp(r.key);
    return;
  }
  selectRow(r);
}

function treeDblClick(e) {
  const el = getRow(e); if (!el) return;
  const r = rowAt(el);
  if (r && (!r.node || r.node.type === 'dir')) togExp(r.key);
}

function treeCtx(e) {
  const el = getRow(e); if (!el) return;
  const r = rowAt(el); if (!r) return;
  selectRow(r);
  showCtx(e, r.node ? 'node' : 'disk', r.disk.id, r.key);
}


/* ════════════════════════════════════════════════
   KEYBOARD
   The file tree takes the keyboard focus (Tab, or a click): arrows move and
   open/close, Enter opens a folder, the context-menu key (or Shift+F10)
   opens the menu on the selection.
════════════════════════════════════════════════ */
function wireKeyboard() {
  // Échap ferme ce qui ne fait qu'informer : À propos, Export, menu contextuel.
  // Les fenêtres qui portent une décision (enregistrer ou non, mise à jour) gardent leurs boutons.
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (g('about-ov').classList.contains('open')) { g('about-ov').classList.remove('open'); e.preventDefault(); return; }
    if (g('exp-ov').classList.contains('open'))   { g('exp-ov').classList.remove('open');   e.preventDefault(); return; }
    if (g('ctx').style.display === 'block')       { hideCtx(true); e.preventDefault(); }
  });

  const tree = g('tree-scroll');
  // First focus with nothing selected: select the first row, so the arrows
  // work straight away without a mouse click.
  tree.addEventListener('focus', () => {
    if (!selected && ROWS.length) selectRow(ROWS[0]);
  });
  tree.addEventListener('keydown', e => {
    if (!ROWS.length) return;
    let idx = selectedIndex();
    const cur = idx >= 0 ? ROWS[idx] : null;
    const isOpenable = r => r && (!r.node || r.node.type === 'dir');
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); selectRow(ROWS[Math.min(ROWS.length - 1, idx + 1)]); break;
      case 'ArrowUp':   e.preventDefault(); selectRow(ROWS[Math.max(0, idx - 1)]); break;
      case 'Home':      e.preventDefault(); selectRow(ROWS[0]); break;
      case 'End':       e.preventDefault(); selectRow(ROWS[ROWS.length - 1]); break;
      case 'PageDown':  e.preventDefault(); selectRow(ROWS[Math.min(ROWS.length - 1, idx + pageRows())]); break;
      case 'PageUp':    e.preventDefault(); selectRow(ROWS[Math.max(0, idx - pageRows())]); break;
      case 'ArrowRight':
        e.preventDefault();
        if (isOpenable(cur) && !expanded.has(cur.key)) togExp(cur.key);
        else if (isOpenable(cur) && ROWS[idx + 1] && ROWS[idx + 1].depth > cur.depth) selectRow(ROWS[idx + 1]);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (isOpenable(cur) && expanded.has(cur.key)) togExp(cur.key);
        else if (cur && cur.depth > 0) {                     // go up to the parent
          for (let i = idx - 1; i >= 0; i--) if (ROWS[i].depth < cur.depth) { selectRow(ROWS[i]); break; }
        }
        break;
      case 'Enter':
        if (isOpenable(cur)) { e.preventDefault(); togExp(cur.key); }
        break;
      case 'ContextMenu':
      case 'F10':
        if (e.key === 'F10' && !e.shiftKey) return;
        if (!cur) return;
        e.preventDefault();
        openCtxOnRow(cur);
        break;
    }
  });
}
function pageRows() { return Math.max(1, Math.floor(g('tree-scroll').clientHeight / rowH) - 1); }

/* ════════════════════════════════════════════════
   BOOT — called from the very last line of this file, once every
   declaration below exists (the script sits at the end of <body>)
════════════════════════════════════════════════ */
function boot() {
  // Platform class: 'mac' keeps room for traffic lights; others use a native frame.
  try {
    const plat = (window.archivo && window.archivo.platform) || 'darwin';
    document.body.classList.add(plat === 'darwin' ? 'plat-mac' : 'plat-other');
  } catch (e) { document.body.classList.add('plat-mac'); }
  paintIcons();
  wireButtons();
  wireSearch();
  wireSearchFilters();
  wireModals();
  wireColSort();
  wireColResize();
  wireCtxMenu();
  wireKeyboard();
  wireMenu();
  wireDragDrop();
  // Row height comes from the stylesheet (--row), so the virtual tree and
  // the CSS can never disagree.
  rowH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--row')) || 30;
  // Window resized, inspector toggled: refit the columns, redraw the rows.
  try {
    const ro = new ResizeObserver(() => { fitColumns(); schedulePaint(); });
    ro.observe(g('cat'));
    ro.observe(g('tree-scroll'));
  } catch (e) {}
  const rl = g('ctx-reveal-lb'); if (rl) rl.textContent = 'Reveal in ' + fileManager();
  updateUiState();
  startApp();
  initUpdatesAndPrefs();
}

async function initUpdatesAndPrefs() {
  try {
    if (window.archivo) {
      appVersion = await window.archivo.appVersion();
      const vtxt = 'v' + (appVersion || '');
      const sv = g('sb-ver'); if (sv) sv.textContent = vtxt;
      const av = g('about-ver'); if (av) av.textContent = vtxt;
      const wv = g('welcome-ver'); if (wv) wv.textContent = vtxt + ' · Hard Disk Catalog';
      const prefs = await window.archivo.loadPrefs();
      dismissedUpdateVersion = (prefs && prefs.dismissedUpdateVersion) || '';
      window.archivo.onUpdateAvailable(showUpdateNotice);
    }
  } catch (e) {}
}

function openAbout() {
  g('about-ov').classList.add('open');
}

// CSV field: only quote when needed (comma, quote, newline) — keeps output small.
// A text starting with = + - @ (or a tab / carriage return) would be read as
// a formula by Excel or Google Sheets: a folder named =HYPERLINK(...) became
// a live link. Such fields get a leading apostrophe, the spreadsheet
// convention for "this is text".
function csvField(v) {
  let s = String(v ?? '');
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// Flat CSV of every file across all disks: Disk, Path, Size, Modified.
// Directories are skipped on purpose — the smallest useful export for a
// team to search/filter in Google Sheets.
async function exportCsv() {
  const rows = ['Disk,Path,Size,Modified'];
  for (const d of DB.disks) {
    (function walk(nodes, prefix) {
      for (const n of nodes) {
        const full = prefix ? prefix + '/' + n.name : n.name;
        if (n.type === 'file') {
          rows.push([csvField(d.label), csvField(full), csvField(n.size || ''), csvField(n.modified || '')].join(','));
        } else {
          walk(n.children || [], full);
        }
      }
    })(d.tree || [], '');
  }
  const content = rows.join('\n');
  try {
    const filePath = await window.archivo.exportText({
      content, defaultName: 'archivo_export.csv', filterName: 'CSV', extensions: ['csv']
    });
    if (filePath) toast('CSV exported — ' + (rows.length - 1).toLocaleString() + ' files.', 'ok');
  } catch (e) { toast('Export error: ' + e, 'err'); }
}

// Standalone searchable HTML viewer. Only the fields the viewer needs are
// kept (id/source/mount path dropped) to keep the exported file small.
async function exportHtmlViewer() {
  // Make sure every folder's size is computed (not just the ones the user
  // has expanded in-app) so the exported viewer shows sizes everywhere.
  for (const d of DB.disks) for (const n of (d.tree || [])) getDirSize(n);
  const payload = DB.disks.map(d => ({
    label: d.label, model: d.model, serial: d.serial, total: d.total, free: d.free,
    iface: d.iface, scanned: d.scanned, note: d.note || '', tree: d.tree || []
  }));
  try {
    const filePath = await window.archivo.exportHtml({
      json: JSON.stringify(payload), defaultName: 'archivo_export.html'
    });
    if (filePath) toast('HTML export saved.', 'ok');
  } catch (e) { toast('Export error: ' + e, 'err'); }
}

function showUpdateNotice({ version, url }) {
  if (!version || version === dismissedUpdateVersion) return;
  if (document.getElementById('update-ov')) return;
  const ov = document.createElement('div');
  ov.id = 'update-ov'; ov.className = 'open';
  ov.innerHTML =
    '<div class="upd-card">' +
      '<div class="upd-h">New version available</div>' +
      '<div class="upd-sub">archivo v' + esc(version) + ' is available. You\u2019re on v' + esc(appVersion || '') + '.</div>' +
      '<div class="upd-actions">' +
        '<button class="upd-later" id="upd-later">Later</button>' +
        '<button class="upd-go" id="upd-go">Get it</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(ov);
  const dismiss = () => {
    dismissedUpdateVersion = version;
    try { window.archivo.savePrefs({ dismissedUpdateVersion: version }); } catch (e) {}
    ov.remove();
  };
  ov.querySelector('#upd-later').onclick = dismiss;
  ov.querySelector('#upd-go').onclick = () => { try { window.archivo.openExternal(url); } catch (e) {} dismiss(); };
  ov.onclick = (e) => { if (e.target === ov) dismiss(); };
}

/* ════════════════════════════════════════════════
   WIRE — all event listeners attached here,
   no inline onclick anywhere (the page's security policy forbids them)
════════════════════════════════════════════════ */
// Makes a non-button element behave like one for the keyboard: reachable
// with Tab, activated with Enter or Space.
function keyActivate(el, fn) {
  if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
  if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(e); }
  });
}

function wireButtons() {
  // Welcome
  g('btn-load-db').addEventListener('click',     () => openCatalog());
  g('btn-start-empty').addEventListener('click', () => newCatalog());
  // Toolbar
  g('btn-add-disk').addEventListener('click',   () => showAddDisk());
  g('btn-import').addEventListener('click',     () => openCatalog());
  g('btn-export').addEventListener('click',     () => saveCatalog());
  g('btn-close').addEventListener('click',      () => closeDatabase());

  // Footer: GitHub link + About modal
  const REPO_URL = 'https://github.com/noar-justedit/archivo';
  g('sb-github').addEventListener('click', () => { try { window.archivo.openExternal(REPO_URL); } catch(e){} });
  g('sb-about').addEventListener('click', openAbout);
  g('about-close').addEventListener('click', () => g('about-ov').classList.remove('open'));
  g('about-ov').addEventListener('click', e => { if (e.target === g('about-ov')) g('about-ov').classList.remove('open'); });
  g('about-repo').addEventListener('click', () => { try { window.archivo.openExternal(REPO_URL); } catch(e){} });
  g('about-license').addEventListener('click', () => { try { window.archivo.openExternal(REPO_URL + '/blob/main/LICENSE'); } catch(e){} });
  ['sb-github','sb-about','about-repo','about-license'].forEach(id => keyActivate(g(id), () => g(id).click()));

  // Export (CSV / HTML)
  g('btn-export-data').addEventListener('click', () => openExport());
  g('exp-cancel').addEventListener('click', () => g('exp-ov').classList.remove('open'));
  g('exp-ov').addEventListener('click', e => { if (e.target === g('exp-ov')) g('exp-ov').classList.remove('open'); });
  g('exp-csv').addEventListener('click', async () => { g('exp-ov').classList.remove('open'); await exportCsv(); });
  g('exp-html').addEventListener('click', async () => { g('exp-ov').classList.remove('open'); await exportHtmlViewer(); });
  g('btn-delete').addEventListener('click',     deleteSelected);
  g('btn-inspector').addEventListener('click',  toggleInspector);
  // Add disk modal
  g('btn-refresh-vols').addEventListener('click', refreshVols);
  g('btn-hide-system').addEventListener('click', () => {
    hideSystem = !hideSystem;
    g('btn-hide-system').classList.toggle('active', hideSystem);
    g('btn-hide-system').setAttribute('aria-pressed', hideSystem);
    refreshVols();
  });
  g('btn-hide-network').addEventListener('click', () => {
    hideNetwork = !hideNetwork;
    g('btn-hide-network').classList.toggle('active', hideNetwork);
    g('btn-hide-network').setAttribute('aria-pressed', hideNetwork);
    refreshVols();
  });
  g('btn-cancel-add').addEventListener('click',   hideAddDisk);
  g('btn-cancel-scan').addEventListener('click',  cancelScan);
  g('btn-confirm-add').addEventListener('click',  confirmAddDisk);
  // Search clear
  g('search-clear').addEventListener('click', () => { clearSearch(); g('search-inp').focus(); });
  g('btn-srch-close').addEventListener('click', clearSearch);
  // Context menu items (buttons: Enter and Space work by themselves)
  g('ctx-update').addEventListener('click', ctxUpdate);
  g('ctx-rename').addEventListener('click', ctxRename);
  g('ctx-note').addEventListener('click',   ctxNote);
  g('ctx-reveal').addEventListener('click', ctxReveal);
  g('ctx-del').addEventListener('click',    ctxDelete);

  // Tree event delegation on #tree-scroll (stable parent — never replaced by innerHTML)
  const treeScroll = g('tree-scroll');
  treeScroll.addEventListener('click',       treeClick);
  treeScroll.addEventListener('dblclick',    treeDblClick);
  treeScroll.addEventListener('contextmenu', treeCtx);
  treeScroll.addEventListener('scroll',      schedulePaint, { passive: true });

  // Search results: one listener for the whole list, rows carry their index.
  const sl = g('srch-list');
  sl.addEventListener('click', e => { const el = e.target.closest('.sr'); if (el) openResult(+el.dataset.i); });
  sl.addEventListener('keydown', e => {
    const el = e.target.closest('.sr'); if (!el) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openResult(+el.dataset.i); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); const n = nextResult(el, 1);  if (n) n.focus(); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); const p = nextResult(el, -1); if (p) p.focus(); else g('search-inp').focus(); }
  });
}

// Next / previous result row, skipping the per-disk group headers.
function nextResult(el, dir) {
  const all = Array.from(g('srch-list').querySelectorAll('.sr'));
  const i = all.indexOf(el) + dir;
  return all[i] || null;
}

function wireSearch() {
  const inp  = g('search-inp');
  const zone = g('search-zone');
  // Prevent ctx-close listener from swallowing search zone clicks
  zone.addEventListener('click',     e => e.stopPropagation());
  zone.addEventListener('mousedown', e => e.stopPropagation());
  inp.addEventListener('input',   e => onSearch(e.target.value));
  inp.addEventListener('keydown', e => {
    if (e.key === 'Escape') clearSearch();
    // Down arrow from the field jumps into the results.
    if (e.key === 'ArrowDown') { const f = g('srch-list').querySelector('.sr'); if (f) { e.preventDefault(); f.focus(); } }
  });
}

function wireSearchFilters() {
  document.querySelectorAll('.sf').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.sf').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); });
      el.classList.add('on');
      el.setAttribute('aria-pressed', 'true');
      srchFilter = el.dataset.f;
      const q = g('search-inp').value;
      if (q.trim().length >= 2) execSearch(q);
    });
  });
}

function wireModals() {
  g('mw').addEventListener('click', e => { if (e.target === g('mw')) hideModal(); });
  g('add-modal').addEventListener('click', e => { if (e.target === g('add-modal') && !scanning) hideAddDisk(); });
}

function wireColSort() {
  [['ch-name','name'],['ch-size','size'],['ch-free','free'],['ch-date','date']].forEach(([id,k]) => {
    const el = g(id);
    el.addEventListener('click', e => {
      if (!e.target.classList.contains('crh')) sortBy(k);
    });
    keyActivate(el, () => sortBy(k));
  });
}

/* Column widths.
   The name column follows the user's choice (drag its edge), but gives way
   when the window is too narrow, down to 160 px, so Kind, Date and Comments
   never fall off the right edge (at the old minimum width, 339 px of
   columns were cut off and unreachable). */
let userNameW = 340;
const NAME_MIN = 160, NOTE_MIN = 80;
function colVar(v) { return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(v)) || 0; }
function colAvail() {
  const hdr = g('col-hdr');
  if (!hdr || !hdr.clientWidth) return 0;
  const cs = getComputedStyle(hdr);
  const sp = hdr.querySelector('.ch-hdr-spacer');
  // 20 px of slack: the tree's side padding and its scrollbar.
  return hdr.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - (sp ? sp.offsetWidth : 0) - 20;
}
function fitColumns() {
  const avail = colAvail();
  if (!avail) return;
  const others = colVar('--ws') + colVar('--wf') + colVar('--wk') + colVar('--wd') + NOTE_MIN;
  const nm = Math.max(NAME_MIN, Math.min(userNameW, avail - others));
  document.documentElement.style.setProperty('--wnm', Math.round(nm) + 'px');
}

function wireColResize() {
  userNameW = colVar('--wnm') || 340;
  const map = { 'crh-name':'--wnm', 'crh-size':'--ws','crh-free':'--wf','crh-kind':'--wk','crh-date':'--wd' };
  let rz = null;
  Object.entries(map).forEach(([id, cssVar]) => {
    const handle = g(id);
    if (!handle) return;
    handle.addEventListener('mousedown', e => {
      e.preventDefault(); e.stopPropagation();
      rz = { cssVar, sx: e.clientX, sw: colVar(cssVar) || 120 };
      handle.classList.add('dragging');
    });
  });
  document.addEventListener('mousemove', e => {
    if (!rz) return;
    let nw = Math.max(60, rz.sw + (e.clientX - rz.sx));
    if (rz.cssVar === '--wnm') {
      userNameW = Math.max(NAME_MIN, nw);
      fitColumns();
      return;
    }
    // Another column can only grow as long as the name column keeps its minimum.
    const avail = colAvail();
    if (avail) {
      const rest = ['--ws','--wf','--wk','--wd'].filter(v => v !== rz.cssVar).reduce((s, v) => s + colVar(v), 0);
      nw = Math.min(nw, Math.max(60, avail - rest - NOTE_MIN - NAME_MIN));
    }
    document.documentElement.style.setProperty(rz.cssVar, nw + 'px');
    fitColumns();
  });
  document.addEventListener('mouseup', () => {
    if (rz) { document.querySelectorAll('.crh').forEach(c => c.classList.remove('dragging')); rz = null; }
  });
}

/* ════════════════════════════════════════════════
   APPLICATION MENU BRIDGE
   Keyboard shortcuts live in the native menu (main.js); every command
   lands here so the renderer keeps ownership of the catalog.
════════════════════════════════════════════════ */
function wireMenu() {
  if (!window.archivo || !window.archivo.onMenuCommand) return;
  window.archivo.onMenuCommand(async ({ cmd, arg }) => {
    switch (cmd) {
      case 'new':       newCatalog(); break;
      case 'open':      openCatalog(); break;
      case 'open-path': openCatalog(arg); break;
      case 'save':      saveCatalog(); break;
      case 'save-as':   saveCatalogAs(); break;
      case 'close-doc': closeDatabase(); break;
      case 'add-disk':  showAddDisk(); break;
      case 'export':    openExport(); break;
      case 'about':     openAbout(); break;
      case 'toggle-inspector': if (docOpen) toggleInspector(); break;
      case 'focus-search':     { const i = g('search-inp'); if (i) { i.focus(); i.select(); } break; }
      // The window is closing and the catalog is dirty: save, then let go.
      case 'save-and-close': {
        const ok = await saveCatalog();
        try { await window.archivo.forceClose(ok); } catch (e) {}
        break;
      }
    }
  });
  if (window.archivo.onUpdateNone) {
    window.archivo.onUpdateNone(d => {
      toast(d && d.failed ? 'Update check failed — check your connection.'
                          : 'archivo is up to date (v' + (appVersion || '') + ').',
            d && d.failed ? 'err' : 'ok');
    });
  }
}

/* ════════════════════════════════════════════════
   DRAG & DROP — drop a .archivo file anywhere to open it
════════════════════════════════════════════════ */
function wireDragDrop() {
  let depth = 0;
  const isFileDrag = e => Array.from(e.dataTransfer?.types || []).includes('Files');

  document.addEventListener('dragenter', e => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    depth++;
    document.body.classList.add('dragging');
  });
  document.addEventListener('dragover', e => { if (isFileDrag(e)) e.preventDefault(); });
  document.addEventListener('dragleave', e => {
    if (!isFileDrag(e)) return;
    if (--depth <= 0) { depth = 0; document.body.classList.remove('dragging'); }
  });
  document.addEventListener('drop', e => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    depth = 0;
    document.body.classList.remove('dragging');
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;
    let p = '';
    try { p = window.archivo.pathForFile(file) || ''; } catch (err) {}
    if (!p) { toast('Could not read the dropped file.', 'err'); return; }
    if (!/\.(archivo|json|gz)$/i.test(p)) { toast('Drop an .archivo catalog file.', 'err'); return; }
    openCatalog(p);
  });
}


/* ════════════════════════════════════════════════
   APP START
════════════════════════════════════════════════ */
async function startApp() {
  if (!window.archivo) {
    await delay(100);
    if (!window.archivo) {
      showWelcome();
      toast('Electron preload not found. Try rebuilding.', 'err');
      return;
    }
  }
  // Always start on the welcome screen — unless the OS handed us a file to
  // open (double-clicked .archivo, "Open With", drag onto the app icon).
  DB = { disks: [] };
  docPath = null; docOpen = false; dirty = false;
  showWelcome();
  refreshRecents();

  // Scan progress events
  window.archivo.onScanProgress(p => {
    updateScanProgress(p);
  });

  // Files the OS asks us to open, now and later.
  window.archivo.onOpenRequest(p => { if (p) openCatalog(p); });
  let launchFile = null;
  try { launchFile = await window.archivo.docReady(); } catch (e) {}
  if (launchFile) openCatalog(launchFile);
}

/* ════════════════════════════════════════════════
   WELCOME
════════════════════════════════════════════════ */
function showWelcome() { g('welcome').style.display = 'flex'; refreshRecents(); }
function hideWelcome() { g('welcome').style.display = 'none'; }

async function refreshRecents() {
  const el = g('recent-list');
  if (!el || !window.archivo || !window.archivo.recents) return;
  let list = [];
  try { list = await window.archivo.recents(); } catch (e) { list = []; }
  if (!list.length) { el.innerHTML = ''; return; }
  el.innerHTML = '<div class="rc-h">Recent</div>' +
    list.slice(0, 5).map(p =>
      '<button type="button" class="rc" data-p="' + esc(p) + '" title="' + esc(p) + '">' +
        '<span class="rc-n">' + esc(p.split(/[\\/]/).pop()) + '</span>' +
        '<span class="rc-p">' + esc(p) + '</span>' +
      '</button>').join('') +
    '<button class="rc-clear" id="rc-clear">Clear list</button>';
  el.querySelectorAll('.rc').forEach(x =>
    x.addEventListener('click', () => openCatalog(x.dataset.p)));
  const cl = g('rc-clear');
  if (cl) cl.addEventListener('click', async () => {
    try { await window.archivo.clearRecents(); } catch (e) {}
    refreshRecents();
  });
}

/* ════════════════════════════════════════════════
   DOCUMENT — new / open / save / save as / close
   One catalog is open at a time. `dirty` tracks unsaved changes; every
   mutation calls markDirty(), and anything that would throw the catalog
   away goes through guardUnsaved() first.
════════════════════════════════════════════════ */
function docName() { return docPath ? docPath.split(/[\\/]/).pop() : 'Untitled catalog'; }

function updateTitleBar() {
  const el = g('tb-dbname');
  if (!el) return;
  if (!docOpen) { el.textContent = 'No catalog loaded'; return; }
  const n = DB.disks.length;
  el.innerHTML = (dirty ? '<span class="dot">●</span>' : '') +
    esc(docName()) + ' · ' + n + ' disk' + (n !== 1 ? 's' : '');
}

function markDirty() {
  if (!dirty) { dirty = true; try { window.archivo.setDirty(true); } catch (e) {} }
  updateTitleBar();
}
function markClean() {
  dirty = false;
  try { window.archivo.setDirty(false); } catch (e) {}
  updateTitleBar();
}

// Run `next` only once the user has dealt with unsaved changes.
function guardUnsaved(next) {
  if (!dirty) { next(); return; }
  showModal('Unsaved changes',
    'Save changes to <strong>' + esc(docName()) + '</strong> before continuing?<br>' +
    '<span style="color:var(--dm);font-size:12px;">If you don\'t save, your changes will be lost.</span>',
    [
      { label:"Don't save", cls:'btn-r', fn:()=>{ hideModal(); markClean(); next(); } },
      { label:'Cancel',     cls:'btn-g', fn:hideModal },
      { label:'Save',       cls:'btn-p', fn:async()=>{ hideModal(); if (await saveCatalog()) next(); } },
    ]);
}

function newCatalog() {
  if (busy()) return;
  guardUnsaved(async () => {
    try { await window.archivo.newDocument(); } catch (e) {}
    DB = { disks: [] };
    docPath = null; docOpen = true;
    selected = null; expanded.clear(); clearSearch();
    hideWelcome(); refreshAll(); updatePathBar(); markClean();
    toast('New catalog. Add a disk to begin.', 'info');
  });
}

// filePath omitted → file dialog. Given → opens straight away.
function openCatalog(filePath) {
  if (busy()) return;
  guardUnsaved(async () => {
    try {
      const res = await window.archivo.openCatalog(filePath || undefined);
      if (!res) return;
      DB = res.data;
      docPath = res.path; docOpen = true;
      selected = null; expanded.clear(); clearSearch();
      hideWelcome(); refreshAll(); updatePathBar(); markClean();
      toast('Opened ' + DB.disks.length + ' disk(s).', 'ok');
    } catch (e) { toast('Open error: ' + e, 'err'); }
  });
}

// Save in place when the catalog has a file; otherwise fall through to Save As.
async function saveCatalog() {
  if (!docOpen) { toast('No catalog open.', 'err'); return false; }
  try {
    const res = await window.archivo.saveCatalog(DB);
    if (res && res.needsPath) return await saveCatalogAs();
    if (!res || !res.path) return false;
    docPath = res.path; markClean(); refreshRecents();
    toast('Saved · ' + docName(), 'ok');
    return true;
  } catch (e) { toast('Save error: ' + e, 'err'); return false; }
}

async function saveCatalogAs() {
  if (!docOpen) { toast('No catalog open.', 'err'); return false; }
  try {
    const base = docName().replace(/\.(archivo|json|gz)$/i, '');
    const res  = await window.archivo.saveCatalogAs({
      catalog: DB,
      suggestedName: (base === 'Untitled catalog' ? 'archivo_catalog' : base) + '.archivo',
    });
    if (!res || !res.path) return false;
    docPath = res.path; markClean(); refreshRecents();
    toast('Saved · ' + docName(), 'ok');
    return true;
  } catch (e) { toast('Save error: ' + e, 'err'); return false; }
}

function closeDatabase() {
  if (!docOpen || busy()) return;
  guardUnsaved(async () => {
    try { await window.archivo.closeDocument(); } catch (e) {}
    DB = { disks: [] };
    docPath = null; docOpen = false;
    selected = null; expanded.clear(); clearSearch();
    renderTree(); updateInsp(); updateSB(); updatePathBar(); markClean();
    showWelcome();
  });
}
/* ════════════════════════════════════════════════
   REFRESH
════════════════════════════════════════════════ */
function refreshAll() {
  renderTree();
  updateSB();
  updateInsp();
  updateTitleBar();
  updateUiState();
}

/* ════════════════════════════════════════════════
   SORT
   The column sort applies to the disks AND to the content of every open
   folder (before 1.4.0 only the disk list moved). Folders always stay above
   files, as in Finder's default view.
════════════════════════════════════════════════ */
function sortBy(k) {
  if (sortK === k) sortAsc = !sortAsc; else { sortK = k; sortAsc = true; }
  ['name','size','free','date'].forEach(x => {
    const el = g('sa-' + x);
    if (el) el.textContent = sortK === x ? (sortAsc ? ' ↑' : ' ↓') : '';
  });
  renderTree();
}
function sorted() {
  const d = [...DB.disks], dir = sortAsc ? 1 : -1;
  switch(sortK) {
    case 'size': return d.sort((a,b)=>(pgb(a.total)-pgb(b.total))*dir);
    case 'free': return d.sort((a,b)=>(pgb(a.free)-pgb(b.free))*dir);
    case 'date': return d.sort((a,b)=>(a.scanned||'').localeCompare(b.scanned||'')*dir);
    default:     return d.sort((a,b)=>a.label.localeCompare(b.label)*dir);
  }
}
// Sorted copy of a folder's content, remembered per folder and per sort, so a
// folder of 50 000 files is sorted once, not on every redraw.
const sortCache = new WeakMap();
function sortNodes(nodes) {
  const sig = sortK + (sortAsc ? '+' : '-');
  const hit = sortCache.get(nodes);
  if (hit && hit.sig === sig) return hit.list;
  const dir = sortAsc ? 1 : -1;
  const byName = (a, b) => String(a.name).toLowerCase().localeCompare(String(b.name).toLowerCase());
  let cmp;
  switch (sortK) {
    case 'size': cmp = (a, b) => ((a.type === 'dir' ? getDirSize(a) : toBytes(a.size)) - (b.type === 'dir' ? getDirSize(b) : toBytes(b.size))) * dir || byName(a, b); break;
    case 'date': cmp = (a, b) => String(a.modified || '').localeCompare(String(b.modified || '')) * dir || byName(a, b); break;
    default:     cmp = (a, b) => byName(a, b) * (sortK === 'name' ? dir : 1);
  }
  const list = nodes.slice().sort((a, b) => (a.type === b.type ? cmp(a, b) : (a.type === 'dir' ? -1 : 1)));
  sortCache.set(nodes, { sig, list });
  return list;
}

/* ════════════════════════════════════════════════
   TREE RENDER — virtualised
   ROWS is the flat list of every row currently visible in the tree (disks,
   plus the content of open folders). Only the rows on screen, with a margin,
   are actually drawn; scrolling redraws that window. Opening a folder of
   50 000 files used to freeze the app for two seconds while it drew 50 000
   rows, and every later click redrew all of them again.
════════════════════════════════════════════════ */
let ROWS = [];              // [{ disk, node|null, key, depth }]
let rowH = 30;              // measured from --row at boot
const OVERSCAN = 12;        // rows drawn above and below the visible area

function renderTree() {
  const body = g('tree-body');
  if (!DB.disks.length) {
    ROWS = [];
    body.style.height = '';
    body.innerHTML = '<div class="empty"><div class="empty-ic">' + ico('archive', 34) + '</div><div>No disks in this catalog yet</div><div style="display:flex;gap:8px;margin-top:6px;"><button class="cta" id="et-add">Add a disk</button><button class="cta2" id="et-import">Open a catalog</button></div></div>';
    g('et-add').addEventListener('click', () => showAddDisk());
    g('et-import').addEventListener('click', () => openCatalog());
    return;
  }
  buildRows();
  paintRows();
}

function buildRows() {
  ROWS = [];
  for (const disk of sorted()) {
    ROWS.push({ disk, node: null, key: disk.id, depth: 0 });
    if (!expanded.has(disk.id)) continue;
    // Iterative walk of the open folders (no recursion: no depth limit).
    const stack = [{ list: sortNodes(disk.tree || []), i: 0, key: disk.id, depth: 1 }];
    while (stack.length) {
      const top = stack[stack.length - 1];
      if (top.i >= top.list.length) { stack.pop(); continue; }
      const n = top.list[top.i++];
      const key = top.key + '/' + n.name;
      ROWS.push({ disk, node: n, key, depth: top.depth });
      if (n.type === 'dir' && n.children && n.children.length && expanded.has(key)) {
        stack.push({ list: sortNodes(n.children), i: 0, key, depth: top.depth + 1 });
      }
    }
  }
}

function paintRows() {
  const body = g('tree-body'), scroll = g('tree-scroll');
  if (!ROWS.length) return;
  const total = ROWS.length;
  body.style.position = 'relative';
  body.style.height = (total * rowH) + 'px';
  const first = Math.max(0, Math.floor(scroll.scrollTop / rowH) - OVERSCAN);
  const last  = Math.min(total, Math.ceil((scroll.scrollTop + scroll.clientHeight) / rowH) + OVERSCAN);
  let html = '';
  for (let i = first; i < last; i++) html += rowHtml(ROWS[i], i);
  body.innerHTML = '<div class="tr-win" style="position:absolute;left:0;right:0;top:' + (first * rowH) + 'px">' + html + '</div>';
  // Safety net: if a stylesheet change ever makes rows taller or shorter
  // than --row, follow the real height instead of drifting.
  const f = body.querySelector('.tr');
  if (f && f.offsetHeight && f.offsetHeight !== rowH) { rowH = f.offsetHeight; paintRows(); }
}
let paintQueued = false;
function schedulePaint() {
  if (paintQueued) return;
  paintQueued = true;
  requestAnimationFrame(() => { paintQueued = false; paintRows(); });
}

function isSel(r) {
  if (!selected) return false;
  return r.node ? (selected.type === 'node' && selected.key === r.key)
                : (selected.type === 'disk' && selected.disk.id === r.disk.id);
}
function rowHtml(r, i) { return r.node ? nodeRow(r, i) : diskRow(r.disk, i); }

function pctN(d) { const t=pgb(d.total),f=pgb(d.free); return t&&f?Math.min(100,Math.round((t-f)/t*100)):0; }
function fcC(p)  { return p>=90?'fc90':p>=80?'fc80':p>=50?'fc50':'fc0'; }
// One scale for the fill bar AND the free-space figure next to it (they used
// to follow two different rules and could disagree on the same line):
// neutral below 80 % used, orange from 80 %, red from 90 %.
function freeColor(p, neutral) { return p >= 90 ? 'var(--red)' : p >= 80 ? 'var(--orange)' : neutral; }

function diskRow(disk, i) {
  const p = pctN(disk), exp = expanded.has(disk.id), sel = isSel({ disk, node: null });
  return '<div class="tr disk-row' + (sel ? ' sel' : '') + '" data-i="' + i + '" data-type="disk" aria-selected="' + sel + '">' +
    '<div class="tr-tog">' + ico(exp ? 'chevron-down' : 'chevron-right', 13) + '</div>' +
    '<div class="tr-ic vol-svg">' + volSvg(diskIconName(disk)) + '</div>' +
    '<div class="tr-nm disk">' + esc(disk.label) + '</div>' +
    '<div class="dfill-wrap"><div class="dfill-txt">' + esc(disk.total || '?') + '</div><div class="dfill-bar"><div class="dfill-in ' + fcC(p) + '" style="width:' + p + '%"></div></div></div>' +
    '<div class="tr-fr" style="color:' + freeColor(p, 'var(--mu)') + '">' + esc(disk.free || '?') + '</div>' +
    '<div class="tr-kd">disk</div>' +
    '<div class="tr-dt">' + esc(disk.scanned ? String(disk.scanned).slice(0, 10) : '') + '</div>' +
    '<div class="tr-nt">' + esc(disk.note || '') + '</div>' +
  '</div>';
}

function nodeRow(r, i) {
  const n = r.node, isDir = n.type === 'dir', exp = isDir && expanded.has(r.key), sel = isSel(r);
  const pad = (r.depth) * 16;
  const icon = isDir ? ico(exp ? 'folder-open' : 'folder', 15) : fileIcon(n.name);
  // Indentation is a spacer taken off the name column, so Size / Kind / Date
  // stay aligned whatever the depth.
  return '<div class="tr' + (sel ? ' sel' : '') + '" data-i="' + i + '" data-type="node"' + (isDir ? '' : ' data-file="1"') + ' aria-selected="' + sel + '">' +
    '<div style="width:' + pad + 'px;flex-shrink:0"></div>' +
    '<div class="tr-tog">' + (isDir ? ico(exp ? 'chevron-down' : 'chevron-right', 13) : '') + '</div>' +
    '<div class="tr-ic">' + icon + '</div>' +
    '<div class="tr-nm" style="width:calc(var(--wnm) - ' + pad + 'px)">' + esc(n.name) + '</div>' +
    '<div class="tr-sz">' + esc(fmtB(isDir ? getDirSize(n) : (n.size || 0))) + '</div>' +
    '<div class="tr-fr"></div>' +
    '<div class="tr-kd">' + (isDir ? 'folder' : 'file') + '</div>' +
    '<div class="tr-dt">' + esc(n.modified || '') + '</div>' +
    '<div class="tr-nt"></div>' +
  '</div>';
}

// Parse a size value into raw bytes, whether it's already a number (new
// scans) or a preformatted string like "66 KB" / "1,9 MB" (legacy catalogs,
// e.g. DiskCatalogMaker imports) — needed so folder totals can be summed.
function toBytes(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  if (typeof v !== 'string') return 0;
  const s = v.trim();
  if (!s) return 0;
  const m = s.match(/^([\d.,]+)\s*([a-zA-Z]+)$/);
  if (!m) { const f = parseFloat(s.replace(',', '.')); return isFinite(f) ? f : 0; }
  const num = parseFloat(m[1].replace(',', '.'));
  if (!isFinite(num)) return 0;
  const mult = { b:1, byte:1, bytes:1, kb:1024, mb:1024**2, gb:1024**3, tb:1024**4 }[m[2].toLowerCase()];
  return mult ? num * mult : num;
}

// Folder size: sum of all descendant files. New scans already carry this on
// dir nodes (as a number); for catalogs saved before that — or with legacy
// preformatted-string sizes — compute it once here and memoize it onto the
// node as a number. Iterative, so a very deep tree cannot overflow the stack.
function getDirSize(n) {
  if (n.type !== 'dir') return toBytes(n.size);
  if (typeof n.size === 'number' && n.size > 0) return n.size;
  const order = [], stack = [n];
  while (stack.length) {
    const d = stack.pop();
    order.push(d);
    for (const c of (d.children || [])) if (c.type === 'dir' && !(typeof c.size === 'number' && c.size > 0)) stack.push(c);
  }
  for (let k = order.length - 1; k >= 0; k--) {
    const d = order[k];
    let total = 0;
    for (const c of (d.children || [])) total += c.type === 'dir' ? (typeof c.size === 'number' ? c.size : 0) : toBytes(c.size);
    d.size = total;
  }
  return n.size;
}

/* ════════════════════════════════════════════════
   EXPAND / SELECT
════════════════════════════════════════════════ */
function togExp(key) {
  if (expanded.has(key)) expanded.delete(key); else expanded.add(key);
  buildRows();
  paintRows();
}

function selectedIndex() {
  if (!selected) return -1;
  return ROWS.findIndex(isSel);
}

// Brings row i into view (only scrolls when needed).
function ensureVisible(i, center) {
  const sc = g('tree-scroll'), top = i * rowH, bottom = top + rowH;
  if (center) sc.scrollTop = Math.max(0, top - sc.clientHeight / 2 + rowH / 2);
  else if (top < sc.scrollTop) sc.scrollTop = top;
  else if (bottom > sc.scrollTop + sc.clientHeight) sc.scrollTop = bottom - sc.clientHeight;
}

function selectRow(r, center) {
  if (!r) return;
  if (r.node) selected = { type: 'node', disk: r.disk, node: r.node, key: r.key };
  else        selected = { type: 'disk', disk: r.disk, key: r.disk.id };
  const i = selectedIndex();
  if (i >= 0) ensureVisible(i, center);
  paintRows();
  updateInsp();
  updateSB();
  updatePathBar();
}

function selDisk(id) {
  const disk = DB.disks.find(d => d.id === id);
  if (!disk) return;
  selectRow({ disk, node: null, key: disk.id });
}

function selNode(diskId, key) {
  const disk = DB.disks.find(d => d.id === diskId);
  if (!disk) return;
  // key = disk.id + '/' + name1 + '/' + name2 ... — walk the path
  const segs = key.split('/').slice(1);
  let nodes = disk.tree || [], node = null;
  for (const s of segs) {
    node = nodes.find(n => n.name === s);
    if (!node) return;
    nodes = node.children || [];
  }
  selectRow({ disk, node, key });
}

function updatePathBar() {
  const bar = g('pathbar');
  if (!selected) { bar.classList.remove('on'); bar.innerHTML = ''; return; }
  let html = '<span class="pb-ic">' + ico('hard-drive', 14) + '</span><span class="pb-disk">' + esc(selected.disk.label) + '</span>';
  if (selected.type === 'node') {
    const segs = selected.key.split('/').slice(1);
    segs.forEach((s, i) => {
      html += '<span class="pb-sep">›</span><span class="pb-seg' + (i === segs.length - 1 ? ' last' : '') + '">' + esc(s) + '</span>';
    });
  }
  bar.innerHTML = html;
  bar.classList.add('on');
}

// Kept under its old name for callers: redraws the visible rows.
function highlightSelected() { paintRows(); }

/* ════════════════════════════════════════════════
   INSPECTOR
════════════════════════════════════════════════ */
function updateInsp() {
  const body = g('ib');
  if (!inspOpen || !body) return;
  if (!selected) { body.innerHTML='<div class="ie">' + ico('info', 26) + 'Select an item</div>'; return; }

  if (selected.type === 'disk') {
    const d=selected.disk, p=pctN(d), fc=fcC(p);
    const freeCol=freeColor(p,'var(--tx)');
    const sk=d.skipped&&d.skipped.count>0?d.skipped:null;
    body.innerHTML=`
      <div class="ithumb vol-svg-lg">${volSvg(diskIconName(d))}</div>
      <div class="is">
        <div class="ist">General</div>
        <div class="ir"><span class="ik">Name</span><input class="iv-e" id="in-name" value="${esc(d.label)}" /></div>
        <div class="ir"><span class="ik">Kind</span><span class="iv">disk</span></div>
        <div class="ir"><span class="ik">Model</span><span class="iv">${esc(d.model||'—')}</span></div>
        <div class="ir"><span class="ik">Serial</span><span class="iv">${esc(d.serial||'—')}</span></div>
        <div class="ir"><span class="ik">Interface</span><span class="iv">${esc(d.iface||'—')}</span></div>
        <div class="ir"><span class="ik">Files</span><span class="iv">${(d.file_count||0).toLocaleString()}</span></div>
        <div class="ir"><span class="ik">Scanned</span><span class="iv">${esc(d.scanned?String(d.scanned).slice(0,10):'—')}</span></div>
        ${sk?`<div class="ir" title="${esc('Could not be read during the scan (permission refused or read error):\n'+sk.sample.join('\n')+(sk.count>sk.sample.length?'\n…':''))}"><span class="ik">Unreadable</span><span class="iv warn">${sk.count.toLocaleString()} item${sk.count!==1?'s':''}</span></div>`:''}
      </div>
      <div class="is">
        <div class="ist">Storage</div>
        <div class="ir"><span class="ik">Total</span><span class="iv v">${esc(d.total||'—')}</span></div>
        <div class="ir"><span class="ik">Free</span><span class="iv" style="color:${freeCol}">${esc(d.free||'—')}</span></div>
        <div class="ir"><span class="ik">Used</span><span class="iv">${p}%</span></div>
        <div class="ibar"><div class="ibfi ${fc}" style="width:${p}%"></div></div>
      </div>
      <div class="is">
        <div class="ist">Comments</div>
        <textarea class="inta" id="in-note" placeholder="Add a note…">${esc(d.note||'')}</textarea>
        <button class="insv" id="btn-save-note">Save note</button>
      </div>`;
    g('in-name').addEventListener('blur',  () => saveName(d.id));
    g('in-name').addEventListener('keydown', e => { if(e.key==='Enter') e.target.blur(); });
    g('btn-save-note').addEventListener('click', () => saveNote(d.id));
  } else {
    const n=selected.node;
    if (!n) { body.innerHTML='<div class="ie">' + ico('info', 26) + 'Select an item</div>'; return; }
    const isDir=n.type==='dir', ext=isDir?'':(n.name.split('.').pop()||'').toLowerCase();
    body.innerHTML=`
      <div class="ithumb">${isDir?ico('folder',34):fileIcon(n.name,34)}</div>
      <div class="is">
        <div class="ist">General</div>
        <div class="ir"><span class="ik">Name</span><span class="iv">${esc(n.name)}</span></div>
        <div class="ir"><span class="ik">Kind</span><span class="iv">${esc(isDir?'folder':typeStr(ext))}</span></div>
        ${(isDir ? getDirSize(n) : n.size) ? `<div class="ir"><span class="ik">Size</span><span class="iv v">${esc(fmtB(isDir ? getDirSize(n) : n.size))}</span></div>` : ''}
        ${isDir&&n.children?`<div class="ir"><span class="ik">Items</span><span class="iv">${n.children.length}</span></div>`:''}
        ${ext?`<div class="ir"><span class="ik">Extension</span><span class="iv">.${esc(ext)}</span></div>`:''}
        <div class="ir"><span class="ik">Modified</span><span class="iv">${esc(n.modified||'—')}</span></div>
        <div class="ir"><span class="ik">Disk</span><span class="iv v">${esc(selected.disk.label)}</span></div>
      </div>`;
  }
}

async function saveName(diskId) {
  const d=DB.disks.find(x=>x.id===diskId); if(!d)return;
  const v=g('in-name')?.value.trim();
  if(v&&v!==d.label){d.label=v;markDirty();renderTree();toast('Renamed.','ok');}
}
async function saveNote(diskId) {
  const d=DB.disks.find(x=>x.id===diskId); if(!d)return;
  d.note=g('in-note')?.value||'';
  markDirty();
  renderTree(); toast('Note saved.','ok');
}
function toggleInspector() {
  inspOpen=!inspOpen;
  g('insp').classList.toggle('col',!inspOpen);
}

/* ════════════════════════════════════════════════
   ADD DISK
════════════════════════════════════════════════ */
let scanning    = false;  // a scan is running: document commands are locked
let pendingInfo = null;   // promise of { model, serial } for the selected volume

// A serial number the system could not read comes back as "—" (or empty,
// or "Detecting…" if Scan was clicked before the answer arrived). None of
// these identify a disk: two unrelated disks both showing "—" used to be
// taken for the same disk, and "Update" overwrote the first with the second.
const NO_SERIAL = new Set(['', '—', '–', '-', '?', 'detecting…', 'detecting...', 'unknown', 'n/a', 'none', 'null']);
function realSerial(s) {
  const t = String(s == null ? '' : s).trim();
  return NO_SERIAL.has(t.toLowerCase()) ? '' : t;
}
function realModel(s) { return realSerial(s); }   // same rule: "—" means unknown

async function showAddDisk() {
  if (!docOpen || busy()) return;
  pendingVol = null; pendingInfo = null;
  ['add-label','add-note','add-model','add-serial','add-total','add-free'].forEach(id=>{g(id).value='';});
  g('btn-confirm-add').disabled = true;
  g('btn-confirm-add').textContent = 'Scan & add';
  g('btn-confirm-add').classList.remove('is-update');
  g('scan-prog').style.display = 'none';
  g('sp-fill').style.width = '0%';
  g('sp-det').textContent = '';
  g('add-modal').style.display = 'flex';
  await refreshVols();
}
function hideAddDisk() { if (scanning) return; g('add-modal').style.display = 'none'; }

async function refreshVols() {
  if (scanning) return;
  const list = g('vol-list');
  const msg = (t, err) => '<div style="padding:16px;text-align:center;font-family:var(--mono);font-size:10px;color:' + (err ? 'var(--red)' : 'var(--dm)') + ';">' + esc(t) + '</div>';
  list.innerHTML = msg('Detecting volumes…');
  try {
    const vols = await window.archivo.listVolumes();
    if (!vols.length) { list.innerHTML = msg('No volumes detected.'); return; }
    const filtered = vols.filter(v => {
      if (hideSystem  && v.vol_type === 'system')  return false;
      if (hideNetwork && v.vol_type === 'network') return false;
      return true;
    });
    if (!filtered.length) { list.innerHTML = msg('No volumes match the current filters.'); return; }
    list.innerHTML = '';
    filtered.forEach(v => {
      const p = v.total_bytes > 0 ? Math.round((v.total_bytes - v.free_bytes) / v.total_bytes * 100) : 0;
      const el = document.createElement('div');
      el.className = 'vol-item';
      const archived = findExistingDisk('', v.name); // match by name (auto)
      if (archived) el.classList.add('archived');
      el.innerHTML =
        '<div class="vol-ic vol-svg-md">' + volSvg(volIcon(v)) + '</div>' +
        '<div class="vol-info">' +
          '<div class="vol-name">' + esc(v.name) + (archived ? '<span class="vol-badge">Already archived</span>' : '') + '</div>' +
          '<div class="vol-meta">' + esc(v.mount_point) + ' · ' + esc(v.file_system || '') + '</div>' +
        '</div>' +
        '<div class="vol-right">' +
          '<div class="vol-free">' + esc(fmtB(v.free_bytes)) + ' free</div>' +
          '<div class="vol-total">' + esc(fmtB(v.total_bytes)) + '</div>' +
          '<div class="vol-bar"><div class="vol-bfi ' + fcC(p) + '" style="width:' + p + '%"></div></div>' +
        '</div>';
      el.setAttribute('aria-label', String(v.name || ''));
      el.addEventListener('click', () => selectVol(el, v));
      keyActivate(el, () => selectVol(el, v));
      list.appendChild(el);
    });
  } catch(e) {
    list.innerHTML = msg('Error: ' + e, true);
  }
}

function selectVol(el, vol) {
  if (scanning) return;
  document.querySelectorAll('.vol-item').forEach(x => { x.classList.remove('sel'); x.setAttribute('aria-pressed', 'false'); });
  el.classList.add('sel');
  el.setAttribute('aria-pressed', 'true');
  pendingVol = vol;
  g('add-label').value  = vol.name;
  g('add-total').value  = fmtB(vol.total_bytes);
  g('add-free').value   = fmtB(vol.free_bytes);
  g('add-model').value  = 'Detecting…';
  g('add-serial').value = 'Detecting…';
  g('btn-confirm-add').disabled = false;
  // If this volume is already archived, reflect it on the confirm button.
  const archived = findExistingDisk('', vol.name);
  g('btn-confirm-add').textContent = archived ? 'Update existing' : 'Scan & add';
  g('btn-confirm-add').classList.toggle('is-update', !!archived);
  // The hardware answer is kept as a promise: if Scan is clicked before it
  // arrives, the scan waits for it instead of saving "Detecting…".
  const info = Promise.resolve()
    .then(() => window.archivo.getDiskInfo(vol.mount_point))
    .then(hw => ({ model: realModel(hw && hw.model), serial: realSerial(hw && hw.serial) }))
    .catch(() => ({ model: '', serial: '' }));
  pendingInfo = info;
  info.then(hw => {
    if (pendingInfo !== info) return;        // another volume was picked meanwhile
    g('add-model').value  = hw.model  || '—';
    g('add-serial').value = hw.serial || '—';
  });
  return info;
}

function fmtETA(sec) {
  if (!sec || sec <= 0) return '';
  if (sec < 60) return '~' + sec + 's remaining';
  const m = Math.floor(sec / 60), s = sec % 60;
  if (m < 60) return '~' + m + 'm ' + s + 's remaining';
  const h = Math.floor(m / 60);
  return '~' + h + 'h ' + (m % 60) + 'm remaining';
}

function updateScanProgress(p) {
  if (p.cancelled) {
    g('sp-stat').textContent = 'Cancelled.';
    g('sp-pct').textContent = '';
    g('sp-eta').textContent = '';
    return;
  }
  if (p.phase === 'counting') {
    g('sp-stat').textContent = p.files ? 'Counting… ' + p.files.toLocaleString() : 'Counting files…';
    g('sp-pct').textContent  = '';
    g('sp-eta').textContent  = '';
    g('sp-fill').style.width = '0%';
    return;
  }
  // Indeterminate (huge volume — total unknown)
  if (p.pct === -1) {
    g('sp-stat').textContent = (p.files || 0).toLocaleString() + ' files scanned';
    g('sp-pct').textContent  = '';
    g('sp-eta').textContent  = 'Large volume · estimating not available';
    g('sp-fill').style.width = '100%';
    g('sp-fill').style.opacity = '0.4';
    if (p.path) g('sp-det').textContent = p.path;
    return;
  }
  g('sp-fill').style.opacity = '1';
  const pct = p.pct != null ? p.pct : 0;
  g('sp-fill').style.width = pct + '%';
  g('sp-pct').textContent  = pct + '%';
  g('sp-stat').textContent = p.done ? 'Done.' : (p.files || 0).toLocaleString() + ' / ' + (p.total || 0).toLocaleString() + ' files';
  g('sp-eta').textContent  = p.done ? '' : fmtETA(p.eta);
  if (p.path) g('sp-det').textContent = p.path;
}

// Locks the Add Disk window (and the document commands) while a scan runs.
function setScanning(on) {
  scanning = on;
  g('scan-prog').style.display = on ? 'block' : 'none';
  ['btn-confirm-add','btn-cancel-add','btn-refresh-vols','btn-hide-system','btn-hide-network']
    .forEach(id => { const b = g(id); if (b) b.disabled = on; });
  g('add-label').readOnly = on;
  g('add-note').readOnly  = on;
  g('vol-list').classList.toggle('locked', on);
  if (on) {
    g('sp-fill').style.width = '0%';
    g('sp-fill').style.opacity = '1';
    g('sp-pct').textContent  = '0%';
    g('sp-stat').textContent = 'Counting files…';
    g('sp-eta').textContent  = '';
    g('sp-det').textContent  = '';
  }
  updateUiState();
}

function skippedOf(res) {
  const s = res && res.skipped;
  return s && s.count > 0 ? { count: s.count, sample: (s.sample || []).slice(0, 20) } : null;
}
function doneToast(verb, label, fileCount, skipped) {
  const base = '"' + label + '" ' + verb + ' — ' + fileCount.toLocaleString() + ' files.';
  if (skipped) toast(base + ' ' + skipped.count.toLocaleString() + ' item' + (skipped.count !== 1 ? 's' : '') +
                     ' could not be read (see the Inspector).', 'warn', 7000);
  else toast(base, 'ok');
}

async function confirmAddDisk() {
  if (scanning) return;
  if (!pendingVol) { toast('Select a volume first.','err'); return; }
  const label = g('add-label').value.trim();
  if (!label)     { toast('Label required.','err'); return; }
  // Everything the scan result will be filed with is captured now, before
  // the first wait: nothing typed or picked during the scan can leak in.
  const vol  = pendingVol;
  const info = pendingInfo || Promise.resolve({ model: '', serial: '' });
  const note = g('add-note').value.trim();
  const total = fmtB(vol.total_bytes), free = fmtB(vol.free_bytes);
  setScanning(true);
  let res;
  try {
    res = await window.archivo.scanVolume(vol.mount_point);
  } catch (e) {
    setScanning(false);
    toast('Scan error: ' + (e && e.message ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : e), 'err');
    return;
  }
  const hw = await info;
  setScanning(false);
  if (res.cancelled) { toast('Scan cancelled.', 'info'); return; }

  const scanData = {
    label, note, total, free,
    model:      hw.model,
    serial:     hw.serial,
    iface:      vol.file_system || '',
    file_count: res.fileCount,
    tree:       res.tree,
    skipped:    skippedOf(res),
  };

  // ── Duplicate detection: match by serial (if present) else by label ──
  const existing = findExistingDisk(scanData.serial, scanData.label);
  if (existing) {
    const bySerial = scanData.serial && realSerial(existing.serial) === scanData.serial;
    showModal('Disk already in catalog',
      '<strong>' + esc(existing.label) + '</strong> is already in your catalog (' + (bySerial ? 'same serial number' : 'same name') + ').<br><br>' +
      'Update it with the new scan (' + res.fileCount.toLocaleString() + ' files), or add a separate entry?',
      [
        { label:'Cancel',     cls:'btn-g', fn:hideModal },
        { label:'Add anyway', cls:'btn-g', fn:()=>{ hideModal(); commitNewDisk(scanData); } },
        { label:'Update',     cls:'btn-p', fn:()=>{ hideModal(); commitUpdateDisk(existing, scanData); } },
      ]);
    return;
  }
  commitNewDisk(scanData);
}

// Find a disk already in the catalog matching this scan.
// A real serial number decides on its own. The name is only a hint, used
// when one of the two disks has no readable serial: two disks with
// different real serials are different disks, whatever their names.
function findExistingDisk(serial, label) {
  const s = realSerial(serial);
  if (s) {
    const bySerial = DB.disks.find(d => realSerial(d.serial) === s);
    if (bySerial) return bySerial;
  }
  const l = String(label || '').trim().toLowerCase();
  if (!l) return null;
  return DB.disks.find(d => String(d.label || '').trim().toLowerCase() === l &&
                            !(s && realSerial(d.serial))) || null;
}

function commitNewDisk(scanData) {
  const disk = {
    id:         'disk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    label:      scanData.label,
    model:      scanData.model  || '',
    serial:     scanData.serial || '',
    total:      scanData.total,
    free:       scanData.free,
    iface:      scanData.iface,
    note:       scanData.note,
    scanned:    new Date().toISOString(),
    file_count: scanData.file_count,
    tree:       scanData.tree,
  };
  if (scanData.skipped) disk.skipped = scanData.skipped;
  DB.disks.push(disk);
  markDirty();
  hideAddDisk();
  expanded.add(disk.id);
  refreshAll();
  selDisk(disk.id);
  doneToast('added', disk.label, disk.file_count, scanData.skipped);
}

function commitUpdateDisk(existing, scanData) {
  // Keep the same id (preserves selection/expansion history). Keep the
  // existing note unless the user typed a new one in the Add Disk form.
  existing.label      = scanData.label;
  existing.model      = scanData.model  || realModel(existing.model);
  existing.serial     = scanData.serial || realSerial(existing.serial);
  existing.total      = scanData.total;
  existing.free       = scanData.free;
  existing.iface      = scanData.iface  || existing.iface;
  existing.note       = scanData.note   || existing.note;
  existing.scanned    = new Date().toISOString();
  existing.file_count = scanData.file_count;
  existing.tree       = scanData.tree;
  if (scanData.skipped) existing.skipped = scanData.skipped; else delete existing.skipped;
  markDirty();
  hideAddDisk();
  expanded.add(existing.id);
  refreshAll();
  selDisk(existing.id);
  doneToast('updated', existing.label, existing.file_count, scanData.skipped);
}

/* ────────────────────────────────────────────────
   UPDATE AN ARCHIVED DISK FROM THE MOUNTED VOLUME
   Match is automatic by name (label) only.
──────────────────────────────────────────────── */
async function ctxUpdate() {
  if (ctxTarget?.type !== 'disk' || busy()) return;
  const disk = DB.disks.find(d => d.id === ctxTarget.diskId);
  if (!disk) return;
  await tryUpdateArchivedDisk(disk);
}

// Look for a mounted volume whose name/label matches the archived disk (by name only).
async function findMountedVolumeFor(disk) {
  let vols = [];
  try { vols = await window.archivo.listVolumes(); } catch { vols = []; }
  const target = (disk.label || '').trim().toLowerCase();
  if (!target) return null;
  return vols.find(v =>
    (v.name || '').trim().toLowerCase() === target ||
    (v.mount_point || '').split(/[\\/]/).filter(Boolean).pop()?.toLowerCase() === target
  ) || null;
}

async function tryUpdateArchivedDisk(disk) {
  if (busy()) return;
  const vol = await findMountedVolumeFor(disk);
  if (!vol) {
    // Volume not mounted → ask the user to connect it, offer Retry.
    showModal('Volume not mounted',
      'To update <strong>' + esc(disk.label) + '</strong>, connect and mount the drive named ' +
      '<strong>' + esc(disk.label) + '</strong>, then click Retry.<br><br>' +
      '<span style="color:var(--dm);font-size:12px;">archivo matches the mounted volume by name.</span>',
      [
        { label:'Cancel', cls:'btn-g', fn:hideModal },
        { label:'Retry',  cls:'btn-p', fn:async()=>{ hideModal(); await tryUpdateArchivedDisk(disk); } },
      ]);
    return;
  }
  runUpdateScan(disk, vol);
}

// Scan a mounted volume and replace the archived disk's tree (keeps id + note).
async function runUpdateScan(disk, vol) {
  // Open the Add Disk modal purely to reuse its progress UI.
  await showAddDisk();
  if (g('add-modal').style.display !== 'flex') return;
  pendingVol = vol;
  g('add-label').value  = disk.label;
  g('add-total').value  = fmtB(vol.total_bytes);
  g('add-free').value   = fmtB(vol.free_bytes);
  g('add-model').value  = disk.model  || '—';
  g('add-serial').value = disk.serial || '—';
  g('add-note').value   = disk.note   || '';
  setScanning(true);
  let res;
  try {
    res = await window.archivo.scanVolume(vol.mount_point);
  } catch (e) {
    setScanning(false);
    hideAddDisk();
    toast('Update error: ' + (e && e.message ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : e), 'err');
    return;
  }
  setScanning(false);
  if (res.cancelled) { hideAddDisk(); toast('Update cancelled.', 'info'); return; }
  // The disk may have been removed from the catalog meanwhile (it cannot:
  // removing is locked during a scan — but never write into a ghost).
  if (!DB.disks.includes(disk)) { hideAddDisk(); return; }
  commitUpdateDisk(disk, {
    label:      disk.label,
    model:      disk.model,
    serial:     disk.serial,
    total:      fmtB(vol.total_bytes),
    free:       fmtB(vol.free_bytes),
    iface:      vol.file_system || disk.iface,
    note:       '', // keep the existing note (commitUpdateDisk preserves it when empty)
    file_count: res.fileCount,
    tree:       res.tree,
    skipped:    skippedOf(res),
  });
}

async function cancelScan() {
  if (!scanning) return;
  await window.archivo.cancelScan();
  g('sp-stat').textContent = 'Cancelling…';
}

/* ════════════════════════════════════════════════
   DELETE
════════════════════════════════════════════════ */
function deleteSelected() {
  if (busy()) return;
  if (!selected||selected.type!=='disk') { toast('Select a disk first.','err'); return; }
  const d=selected.disk;
  showModal('Remove disk','Remove <strong>'+esc(d.label)+'</strong> from the catalog?<br>The physical disk is not affected.',[
    {label:'Cancel',cls:'btn-g',fn:hideModal},
    {label:'Remove',cls:'btn-r',fn:()=>{
      DB.disks=DB.disks.filter(x=>x.id!==d.id);
      expanded.delete(d.id); selected=null;
      markDirty();
      refreshAll(); updatePathBar(); hideModal();
      toast('"'+d.label+'" removed.','ok');
    }},
  ]);
}

/* ════════════════════════════════════════════════
   SEARCH
   No index any more: the index copied every file's full path and the list
   of its parent folders (65 MB for 300 000 files, two and a half times the
   catalog itself). The search now walks the tree directly and builds a path
   only for the results it shows. Same speed in practice, a fraction of the
   memory.
════════════════════════════════════════════════ */
const SRCH_CAP = 600;
let srchResults = [];     // results on screen: [{ disk, node|null, pp:[names] }]

function extOf(name) { const s = String(name), i = s.lastIndexOf('.'); return i > 0 ? s.slice(i + 1).toLowerCase() : ''; }

// Category filters apply to files only (a folder called "clips.mov" is not
// a video); "Folders" lists folders only.
function matchesFilter(n) {
  if (srchFilter === 'all')    return true;
  if (srchFilter === 'folder') return n.type === 'dir';
  if (n.type === 'dir')        return false;
  const ext = extOf(n.name);
  switch (srchFilter) {
    case 'video':   return V.has(ext);
    case 'image':   return I.has(ext);
    case 'audio':   return A.has(ext);
    case 'archive': return AR.has(ext);
    case 'doc':     return D.has(ext);
  }
  return true;
}

function onSearch(q) {
  clearTimeout(srchTimer);
  g('search-clear').style.display = q.trim() ? 'inline-flex' : 'none';
  if (!q.trim() || q.trim().length < 2) {
    // Too short — just hide results panel, but DO NOT touch the input value
    hideSearchPanel();
    return;
  }
  srchTimer = setTimeout(() => execSearch(q), 150);
}

function execSearch(q) {
  const raw = q.trim(), ql = raw.toLowerCase();
  if (!docOpen || ql.length < 2) return;
  g('tree-scroll').style.display = 'none';
  g('srch-panel').classList.add('on');

  const res = [];
  let total = 0;
  for (const disk of DB.disks) {
    if (srchFilter === 'all' && String(disk.label).toLowerCase().includes(ql)) {
      total++;
      if (res.length < SRCH_CAP) res.push({ disk, node: null, pp: [] });
    }
    // Depth-first walk; `names` holds the folders above the current node.
    const names = [], stack = [{ list: disk.tree || [], i: 0 }];
    while (stack.length) {
      const top = stack[stack.length - 1];
      if (top.i >= top.list.length) { stack.pop(); names.pop(); continue; }
      const n = top.list[top.i++];
      if (String(n.name).toLowerCase().includes(ql) && matchesFilter(n)) {
        total++;
        if (res.length < SRCH_CAP) res.push({ disk, node: n, pp: names.concat(n.name) });
      }
      if (n.type === 'dir' && n.children && n.children.length) {
        names.push(n.name);
        stack.push({ list: n.children, i: 0 });
      }
    }
  }
  srchResults = res;
  g('sc').textContent = total > SRCH_CAP
    ? total.toLocaleString() + ' results (showing ' + SRCH_CAP + ')'
    : total.toLocaleString() + ' result' + (total !== 1 ? 's' : '');

  if (!res.length) {
    g('srch-list').innerHTML =
      '<div class="srch-empty">' + ico('search', 26) +
        '<div>No results for “' + esc(raw) + '”</div>' +
        '<div class="srch-empty-s">' + (srchFilter !== 'all' ? 'Try the All filter, or part of the name.' : 'Check the spelling, or try part of the name.') + '</div>' +
      '</div>';
    return;
  }

  // Results arrive disk by disk: one group per disk, in catalog order.
  const groups = [];
  res.forEach((r, i) => {
    if (!groups.length || groups[groups.length - 1].disk !== r.disk) groups.push({ disk: r.disk, rows: [] });
    const nm = r.node ? r.node.name : r.disk.label;
    const ic = !r.node ? ico('hard-drive', 15) : r.node.type === 'dir' ? ico('folder', 15) : fileIcon(r.node.name);
    const sz = r.node ? fmtB(r.node.type === 'dir' ? getDirSize(r.node) : (r.node.size || 0)) : '';
    const dt = r.node ? (r.node.modified || '') : String(r.disk.scanned || '').slice(0, 10);
    const path = [r.disk.label].concat(r.pp).join('/');
    groups[groups.length - 1].rows.push('<div class="sr" tabindex="0" role="button" data-i="' + i + '">' +
      '<div class="sr-ic">' + ic + '</div><div class="sr-nm">' + hlMatch(nm, raw) + '</div>' +
      '<div class="sr-dk">' + esc(r.disk.label) + '</div>' +
      '<div class="sr-pt" title="' + esc(path) + '">' + esc(path) + '</div>' +
      '<div class="sr-sz">' + esc(sz) + '</div><div class="sr-dt">' + esc(dt) + '</div>' +
    '</div>');
  });
  g('srch-list').innerHTML = groups.map(gr => grpHead(gr.disk, gr.rows.length) + gr.rows.join('')).join('');
}
function grpHead(disk, n) { return '<div class="sr-grp">' + ico('hard-drive', 13) + ' ' + esc(disk.label) + ' · ' + n + '</div>'; }

// Highlight the match: cut the raw name first, escape each piece after, so
// a name can never inject markup through the highlighting.
function hlMatch(name, q) {
  const s = String(name), low = s.toLowerCase(), ql = String(q).toLowerCase();
  if (!ql) return esc(s);
  let out = '', i = 0, j;
  while ((j = low.indexOf(ql, i)) !== -1) {
    out += esc(s.slice(i, j)) + '<em>' + esc(s.slice(j, j + ql.length)) + '</em>';
    i = j + ql.length;
  }
  return out + esc(s.slice(i));
}

function openResult(i) {
  const r = srchResults[i];
  if (r) goTo(r.disk.id, r.pp);
}

function hideSearchPanel() {
  const wasOn = g('srch-panel').classList.contains('on');
  g('srch-panel').classList.remove('on');
  g('tree-scroll').style.display = '';
  g('sc').textContent = '';
  if (wasOn && ROWS.length) paintRows();
}

function clearSearch() {
  clearTimeout(srchTimer);
  g('search-inp').value = '';
  g('search-clear').style.display = 'none';
  srchResults = [];
  g('srch-list').innerHTML = '';
  hideSearchPanel();
}

// Opens the folders down to a search result, selects it and centres it.
function goTo(diskId, pp) {
  clearSearch();
  const disk = DB.disks.find(d => d.id === diskId); if (!disk) return;
  let key = disk.id, nodes = disk.tree || [];
  expanded.add(key);
  for (let i = 0; i < pp.length - 1; i++) {
    const nd = nodes.find(n => n.name === pp[i]);
    if (!nd) break;
    key += '/' + pp[i];
    expanded.add(key);
    nodes = nd.children || [];
  }
  buildRows();
  const target = pp.length ? disk.id + '/' + pp.join('/') : disk.id;
  const r = ROWS.find(x => x.disk === disk && x.key === target);
  if (r) selectRow(r, true); else paintRows();
  g('tree-scroll').focus({ preventScroll: true });
}


/* ════════════════════════════════════════════════
   CONTEXT MENU
   Right-click, the context-menu key or Shift+F10 on a row. Real buttons:
   arrows move between them, Enter runs, Escape closes and gives the focus
   back to the tree.
════════════════════════════════════════════════ */
function showCtx(e, type, diskId, key) {
  e.preventDefault(); e.stopPropagation();
  openCtxAt(e.clientX, e.clientY, type, diskId, key, false);
}

// Keyboard version: opens the menu under the row instead of at the mouse.
function openCtxOnRow(r) {
  const i = ROWS.indexOf(r);
  if (i < 0) return;
  ensureVisible(i);
  const sc = g('tree-scroll'), box = sc.getBoundingClientRect();
  const y = box.top + (i + 1) * rowH - sc.scrollTop;
  const x = box.left + 40 + r.depth * 16;
  openCtxAt(x, y, r.node ? 'node' : 'disk', r.disk.id, r.key, true);
}

function openCtxAt(x, y, type, diskId, key, focusFirst) {
  ctxTarget = { type, diskId, key };
  const isDisk = type === 'disk';
  ['ctx-update','ctx-sep-upd','ctx-rename','ctx-note','ctx-sep','ctx-sep-del','ctx-del']
    .forEach(id => { const el = g(id); if (el) el.style.display = isDisk ? '' : 'none'; });
  g('ctx-update').disabled = scanning;
  g('ctx-del').disabled    = scanning;
  const ctx = g('ctx');
  ctx.style.display = 'block';
  const w = ctx.offsetWidth, h = ctx.offsetHeight;
  ctx.style.left = Math.max(4, Math.min(x, window.innerWidth  - w - 4)) + 'px';
  ctx.style.top  = Math.max(4, Math.min(y, window.innerHeight - h - 4)) + 'px';
  if (focusFirst) { const f = ctxItems()[0]; if (f) f.focus(); }
}

function ctxItems() {
  return Array.from(g('ctx').querySelectorAll('.cx')).filter(b => b.style.display !== 'none' && !b.disabled);
}

function hideCtx(returnFocus) {
  const ctx = g('ctx');
  if (ctx.style.display !== 'block') return;
  ctx.style.display = 'none';
  if (returnFocus) g('tree-scroll').focus({ preventScroll: true });
}

function wireCtxMenu() {
  // Close ctx menu on any click outside it — but never intercept input clicks
  document.body.addEventListener('click', e => {
    const ctx = g('ctx');
    if (ctx && !ctx.contains(e.target)) hideCtx(false);
  }, true); // capture phase so it runs first but doesn't preventDefault
  // A click on an item runs it (its own listener), then the menu closes.
  g('ctx').addEventListener('click', e => { if (e.target.closest('.cx')) hideCtx(true); });
  g('ctx').addEventListener('keydown', e => {
    const items = ctxItems();
    if (!items.length) return;
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
    else if (e.key === 'End')  { e.preventDefault(); items[items.length - 1].focus(); }
    else if (e.key === 'Tab')  { e.preventDefault(); hideCtx(true); }
  });
  window.addEventListener('blur',   () => hideCtx(false));
  window.addEventListener('resize', () => hideCtx(false));
}

function ctxRename() {
  if(ctxTarget?.type!=='disk')return;
  selDisk(ctxTarget.diskId);
  if(!inspOpen)toggleInspector();
  setTimeout(()=>{const el=g('in-name');if(el){el.focus();el.select();}},80);
}
function ctxNote() {
  if(ctxTarget?.type!=='disk')return;
  selDisk(ctxTarget.diskId);
  if(!inspOpen)toggleInspector();
  setTimeout(()=>{const el=g('in-note');if(el)el.focus();},80);
}
function ctxDelete() { if(ctxTarget?.type==='disk'){selDisk(ctxTarget.diskId);deleteSelected();} }

function isWin() { return !!(window.archivo && window.archivo.platform === 'win32'); }
function fileManager() { return isWin() ? 'Explorer' : 'Finder'; }

// Rebuilds the item's path on the connected disk. Names come from the
// catalog, so "." / ".." and separators are refused: the path can only go
// down from the volume, never out of it.
function joinOnVolume(mount, segs) {
  const sep = isWin() ? '\\' : '/';
  for (const s of segs) {
    if (!s || s === '.' || s === '..' || /[\\/]/.test(s) || (isWin() && /[:]/.test(s))) return null;
  }
  const base = String(mount || '').replace(/[\\/]+$/, '');
  return segs.length ? base + sep + segs.join(sep) : (base || sep) + (isWin() ? sep : '');
}

// Reveal in Finder / Explorer: only works while the disk is connected.
// Shows the item, never opens it.
async function ctxReveal() {
  const t = ctxTarget; if (!t) return;
  const disk = DB.disks.find(d => d.id === t.diskId); if (!disk) return;
  const vol = await findMountedVolumeFor(disk);
  if (!vol) { toast('Connect "' + disk.label + '" to reveal it in ' + fileManager() + '.', 'info'); return; }
  const segs = t.type === 'node' ? t.key.split('/').slice(1) : [];
  const p = joinOnVolume(vol.mount_point, segs);
  let ok = false;
  if (p) { try { ok = await window.archivo.revealInFinder(p); } catch (e) { ok = false; } }
  if (!ok) toast(segs.length
    ? 'Not found on "' + disk.label + '" — it may have been moved or deleted since the scan.'
    : 'Could not reveal "' + disk.label + '".', 'err');
}

/* ════════════════════════════════════════════════
   UI STATE
   Greys out what makes no sense right now, in the toolbar and in the
   native menu: no catalog open, nothing to export, no disk selected, or a
   scan running (switching catalogs during a scan used to file the scanned
   disk into the other catalog).
════════════════════════════════════════════════ */
function busy() {
  if (!scanning) return false;
  toast('A scan is running — wait for it to finish, or cancel it.', 'warn');
  return true;
}

let lastUiSig = '';
function updateUiState() {
  const open = docOpen, n = DB.disks.length;
  const set = (id, on) => { const b = g(id); if (b) b.disabled = !on; };
  set('btn-add-disk',    open && !scanning);
  set('btn-import',      !scanning);
  set('btn-export',      open);
  set('btn-close',       open && !scanning);
  set('btn-export-data', open && n > 0);
  set('btn-delete',      open && !scanning && !!selected && selected.type === 'disk');
  set('btn-inspector',   open);
  const sig = open + '|' + n + '|' + scanning;
  if (sig !== lastUiSig) {
    lastUiSig = sig;
    try { window.archivo.uiState({ open, disks: n, scanning }); } catch (e) {}
  }
}

function openExport() {
  if (!docOpen) return;
  if (!DB.disks.length) { toast('Nothing to export yet.', 'info'); return; }
  g('exp-ov').classList.add('open');
  setTimeout(() => g('exp-csv').focus(), 0);
}

/* ════════════════════════════════════════════════
   STATUS BAR
════════════════════════════════════════════════ */
function updateSB() {
  let files=0,bytes=0;
  DB.disks.forEach(d=>{files+=(d.file_count||0);bytes+=pgb(d.total)*1073741824;});
  g('sb-tot').textContent=files.toLocaleString()+' items · '+DB.disks.length+' disk'+(DB.disks.length!==1?'s':'')+' · '+fmtB(bytes);
  if(selected){
    const n=selected.type==='disk'?selected.disk.label:(selected.node?.name||'—');
    g('sb-sel').textContent='"'+n+'" selected';
  } else {
    g('sb-sel').textContent='No selection';
  }
  updateUiState();
}

/* ════════════════════════════════════════════════
   MODAL
════════════════════════════════════════════════ */
function showModal(t,b,actions) {
  g('mt').textContent=t;
  g('mb').innerHTML=b;
  const ma=g('ma'); ma.innerHTML='';
  actions.forEach(a=>{
    const btn=document.createElement('button');
    btn.className=a.cls; btn.textContent=a.label;
    btn.addEventListener('click',a.fn);
    ma.appendChild(btn);
  });
  g('mw').style.display='flex';
  // Keyboard: focus the main action, or Cancel when the main action is
  // destructive (Remove), so Enter never deletes by accident.
  const main=ma.querySelector('.btn-p')||ma.querySelector('.btn-g');
  if(main) setTimeout(()=>main.focus(),0);
}
function hideModal() { g('mw').style.display='none'; }

/* ════════════════════════════════════════════════
   TOAST
════════════════════════════════════════════════ */
function toast(msg,type='',ms) {
  const el=document.createElement('div');
  el.className='toast '+(type||'');
  el.setAttribute('role', type==='err'||type==='warn' ? 'alert' : 'status');
  el.textContent=msg;
  g('toasts').appendChild(el);
  setTimeout(()=>el.remove(),ms||(type==='warn'||type==='err'?5000:3200));
}

/* ════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════ */

function volIcon(v) {
  if (!v) return 'unknown';
  if (v.vol_type === 'network') return 'network';
  if (v.vol_type === 'system')  return 'system';
  if (v.vol_type === 'usb')     return 'USB';
  return 'unknown';
}
function diskIconName(disk) {
  // Catalogued disk: derive icon from vol_type or iface; archive disks default to USB
  if (disk.vol_type === 'network') return 'network';
  if (disk.vol_type === 'system')  return 'system';
  if (disk.vol_type === 'unknown') return 'unknown';
  const ifc = (disk.iface || '').toLowerCase();
  if (ifc.includes('network') || ifc.includes('smb') || ifc.includes('nfs') || ifc.includes('afp')) return 'network';
  return 'USB';
}

// Inline SVG icons (line style, colour via currentColor). Mapping:
//   USB/unknown → disk, system → OS, network → network
const VOL_SVG = {
  disk: '<svg viewBox="0 0 22 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9,13h0"/><path d="M1.2,8.6c-.1.3-.2.6-.2.9v5.5c0,1.1.9,2,2,2h16c1.1,0,2-.9,2-2v-5.5c0-.3,0-.6-.2-.9l-3.2-6.5c-.3-.7-1-1.1-1.8-1.1H6.2c-.8,0-1.5.4-1.8,1.1l-3.2,6.5Z"/><path d="M20.9,9H1.1"/><path d="M5,13h0"/></svg>',
  OS:   '<svg viewBox="0 0 22 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.2,8.6c-.1.3-.2.6-.2.9v5.5c0,1.1.9,2,2,2h16c1.1,0,2-.9,2-2v-5.5c0-.3,0-.6-.2-.9l-3.2-6.5c-.3-.7-1-1.1-1.8-1.1H6.2c-.8,0-1.5.4-1.8,1.1l-3.2,6.5Z"/><path d="M20.9,9H1.1"/><rect x="4.5" y="10.6" width="3.3" height="1.9" rx=".9"/><rect x="3.8" y="13.5" width="4.7" height="1.9" rx=".9"/></svg>',
  network: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/></svg>',
};
// Map a volume-type name to an SVG key
function svgKeyFor(name) {
  if (name === 'network') return 'network';
  if (name === 'system')  return 'OS';
  return 'disk'; // USB + unknown
}
function volSvg(name) {
  return VOL_SVG[svgKeyFor(name)] || VOL_SVG.disk;
}


function g(id)   { return document.getElementById(id); }
function delay(ms){ return new Promise(r=>setTimeout(r,ms)); }
function pgb(s)  {
  if(!s)return 0;
  const m=String(s).match(/([\d.,]+)\s*(TB|GB|MB|B)?/i);
  if(!m)return 0;
  const v=parseFloat(m[1].replace(',','.')), u=(m[2]||'GB').toUpperCase();
  return u==='TB'?v*1024:u==='MB'?v/1024:u==='B'?v/1073741824:v;
}
function fmtB(b) {
  // Always returns plain text: callers escape it before writing it into the page.
  // Real catalogs (DiskCatalogMaker export) store sizes as preformatted
  // strings like "66 KB" or "1,9 MB". Pass those through unchanged.
  if (typeof b === 'string') {
    const t = b.trim();
    if (!t) return '';
    // If it's a plain numeric string, convert; otherwise return as-is
    if (/^\d+(\.\d+)?$/.test(t)) { b = parseFloat(t); }
    else return t;
  }
  if (typeof b !== 'number' || !isFinite(b) || b <= 0) return '';
  const u = ['B','KB','MB','GB','TB']; let i = 0;
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return b.toFixed(i > 1 ? 1 : 0) + ' ' + u[i];
}
function esc(s)    { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function escRe(s)  { return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
function typeStr(ext){
  if(V.has(ext)) return'Video ('+ext.toUpperCase()+')';
  if(I.has(ext)) return'Image ('+ext.toUpperCase()+')';
  if(A.has(ext)) return'Audio ('+ext.toUpperCase()+')';
  if(AR.has(ext))return'Archive ('+ext.toUpperCase()+')';
  if(D.has(ext)) return'Document ('+ext.toUpperCase()+')';
  return ext?ext.toUpperCase()+' file':'file';
}
function fileIcon(name, size){
  const ext=(name.split('.').pop()||'').toLowerCase(), s=size||15;
  if(V.has(ext)) return ico('film',s);    if(I.has(ext)) return ico('image',s);
  if(A.has(ext)) return ico('music',s);   if(AR.has(ext))return ico('file-archive',s);
  if(D.has(ext)) return ico('file-text',s); return ico('file',s);
}

// Last line on purpose: everything above is declared before the app starts.
boot();
