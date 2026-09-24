/*
 * Headless smoke test for archivo's document model.
 *
 *   npm test                       (macOS / Windows)
 *   xvfb-run -a npm test           (Linux / CI)
 *
 * It builds a throwaway catalog, hands it to the app the way the OS does
 * when you double-click a .archivo file, then drives open / edit / save /
 * guard / close and reports what worked. Exit code 1 on any failure.
 */
'use strict';
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const zlib = require('zlib');

// Build the fixture BEFORE requiring main.js, and put it on argv so the app
// picks it up exactly like an OS "open with" at launch.
const CATALOG = process.argv.find(a => /\.archivo$/.test(a)) ||
                path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'archivo-test-')), 'test-catalog.archivo');
if (!fs.existsSync(CATALOG)) {
  const fixture = { disks: [
    { id:'disk_1', label:'RUSHES 2024', model:'LaCie', serial:'ABC123', total:'4 TB', free:'1,2 TB',
      iface:'exfat', note:'test', scanned:new Date().toISOString(), file_count:2,
      tree:[{ type:'dir', name:'DAY01', size:2048, modified:'2024-05-01', children:[
        { type:'file', name:'A001.mxf', size:1024, modified:'2024-05-01' },
        { type:'file', name:'A002.mxf', size:1024, modified:'2024-05-01' }]}]},
    { id:'disk_2', label:'ARCHIVE B', model:'WD', serial:'ZZZ999', total:'8 TB', free:'0,5 TB',
      iface:'apfs', note:'', scanned:new Date().toISOString(), file_count:1,
      tree:[{ type:'file', name:'master.mov', size:5000, modified:'2023-01-01' }]},
  ]};
  fs.writeFileSync(CATALOG, zlib.gzipSync(Buffer.from(JSON.stringify(fixture), 'utf8'), { level: 9 }));
  process.argv.push(CATALOG);
}

const MAIN = require('../src/main.js');
const { app, BrowserWindow, Menu } = require('electron');
const results = [];
let failed = 0;

function check(name, cond, extra) {
  results.push((cond ? 'PASS  ' : 'FAIL  ') + name + (extra !== undefined ? '   → ' + extra : ''));
  if (!cond) failed++;
}
const wait = ms => new Promise(r => setTimeout(r, ms));

app.whenReady().then(async () => {
  try {
    await wait(3000);
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) { console.log('NO WINDOW'); app.exit(1); return; }
    const js = code => win.webContents.executeJavaScript(code, true);

    // Collect renderer errors
    await js(`window.__errs = [];
      window.addEventListener('error', e => window.__errs.push('error: ' + e.message));
      window.addEventListener('unhandledrejection', e => window.__errs.push('rejection: ' + String((e.reason && e.reason.message) || e.reason)));
      true`);

    // 1 — the catalog handed over on the command line was opened
    check('opens the catalog passed by the OS', await js('docOpen === true'));
    check('docPath points at the file', await js(`String(docPath||'').endsWith('test-catalog.archivo')`), await js('String(docPath)'));
    check('both disks loaded', (await js('DB.disks.length')) === 2, await js('DB.disks.length'));
    check('welcome screen hidden', (await js(`getComputedStyle(g('welcome')).display`)) === 'none');
    check('title bar shows the file name', (await js(`g('tb-dbname').textContent`)).includes('test-catalog.archivo'),
          await js(`g('tb-dbname').textContent`));
    check('window title shows the document', win.getTitle().includes('test-catalog.archivo'), win.getTitle());
    check('clean document has no Edited marker', !win.getTitle().includes('Edited'));

    // 2 — native menu
    const menu = Menu.getApplicationMenu();
    const file = menu && menu.items.find(i => i.label === 'File');
    const labels = file ? file.submenu.items.map(i => i.label) : [];
    check('File menu exists', !!file);
    check('File menu has Save + Save As + Open Recent',
          labels.includes('Save') && labels.includes('Save As…') && labels.includes('Open Recent'), labels.join(' | '));
    const saveItem = file && file.submenu.items.find(i => i.label === 'Save');
    check('Save is bound to Cmd/Ctrl+S', saveItem && saveItem.accelerator === 'CmdOrCtrl+S', saveItem && saveItem.accelerator);
    const recent = file && file.submenu.items.find(i => i.label === 'Open Recent');
    check('Open Recent lists the file just opened',
          !!recent && recent.submenu.items.some(i => i.label === 'test-catalog.archivo'),
          recent ? recent.submenu.items.map(i => i.label).join(' | ') : '—');

    // 2b — charte UI Noar : ce que la charte promet et qui peut régresser en silence
    const cssVar = async n => (await js(`getComputedStyle(document.documentElement).getPropertyValue('${n}').trim()`));
    check('charte: surface tokens', (await cssVar('--page')) === '#0a0b0e' && (await cssVar('--card')) === '#14161c'
          && (await cssVar('--ins')) === '#0e1014', [await cssVar('--page'), await cssVar('--card'), await cssVar('--ins')].join(' '));
    check('charte: state tokens', (await cssVar('--green')) === '#35c98b' && (await cssVar('--red')) === '#f2555a'
          && (await cssVar('--blue')) === '#4d90f0' && (await cssVar('--orange')) === '#f2a03d');
    const borders = await js(`['#titlebar','#toolbar','#col-hdr','#insp','#sb','.tr.disk-row','#ctx','.modal','.add-box','.add-in','#search-zone']
      .map(sel => { const el = document.querySelector(sel); if (!el) return sel + ':absent';
        const c = getComputedStyle(el);
        const w = ['Top','Right','Bottom','Left'].map(k => parseFloat(c['border'+k+'Width'])||0).reduce((a,b)=>a+b,0);
        return w ? sel + ':' + w + 'px' : ''; }).filter(Boolean)`);
    check('charte: no structural borders', borders.length === 0, JSON.stringify(borders));
    const iconBtns = await js(`Array.from(document.querySelectorAll('button,[role=button]'))
      .filter(b => !b.textContent.trim() && b.querySelector('svg'))
      .filter(b => !b.getAttribute('aria-label') || !b.getAttribute('title')).map(b => b.id || b.className)`);
    check('charte: every icon-only button has aria-label + title', iconBtns.length === 0, JSON.stringify(iconBtns));
    const emoji = await js(`(document.getElementById('toolbar').textContent + document.getElementById('ctx').textContent
      + document.getElementById('welcome').textContent).match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FF0B}]/gu) || []`);
    check('charte: no emoji left in toolbar, menu, welcome', emoji.length === 0, emoji.join(' '));
    check('charte: accent reserved to the brand (never a state)', await js(`Array.from(document.styleSheets).every(sh =>
      Array.from(sh.cssRules).every(r => !r.cssText.includes('var(--accent)') || r.selectorText === ':root'))`));
    check('charte: scan progress is neutral information (blue)',
          (await js(`getComputedStyle(document.getElementById('sp-fill')).backgroundColor`)) === 'rgb(77, 144, 240)',
          await js(`getComputedStyle(document.getElementById('sp-fill')).backgroundColor`));
    check('charte: main action tinted green',
          (await js(`getComputedStyle(document.getElementById('btn-confirm-add')).color`)) === 'rgb(53, 201, 139)');

    // Colonnes alignées quelle que soit la profondeur (défaut corrigé au portage)
    await js(`expanded.add('disk_1'); expanded.add('disk_1/DAY01'); renderTree(); true`);
    const kindX = await js(`(() => { const x = r => r.querySelector('.tr-kd').getBoundingClientRect().left;
      const at = k => document.querySelector('.tr[data-i="' + ROWS.findIndex(r => r.key === k) + '"]');
      const disk = at('disk_1');
      const deep = at('disk_1/DAY01/A001.mxf');
      return deep ? [x(disk), x(deep)] : null; })()`);
    check('charte: Kind column aligned on disk and nested file rows', !!kindX && Math.abs(kindX[0] - kindX[1]) < 1, JSON.stringify(kindX));
    await js(`expanded.clear(); renderTree(); true`);

    // Échap ferme ce qui informe, jamais ce qui porte une décision
    const esc = () => js(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true})); true`);
    await js(`openAbout(); true`); await esc(); await wait(100);
    check('charte: Escape closes About', !(await js(`g('about-ov').classList.contains('open')`)));
    await js(`markDirty(); newCatalog(); true`); await wait(200); await esc(); await wait(100);
    check('charte: Escape leaves the unsaved-changes decision open', (await js(`g('mw').style.display`)) === 'flex');
    await js(`Array.from(g('ma').querySelectorAll('button')).find(b=>b.textContent==='Cancel').click(); markClean(); true`);
    await wait(150);

    // 3 — mutating marks the document dirty
    await js(`DB.disks.push({id:'disk_3',label:'SMOKE TEST',total:'1 TB',free:'0,5 TB',file_count:0,tree:[],scanned:new Date().toISOString()}); markDirty(); refreshAll(); true`);
    await wait(200);
    check('dirty flag set', await js('dirty === true'));
    check('title bar shows the edited dot', (await js(`g('tb-dbname').innerHTML`)).includes('dot'));
    check('window title shows Edited', win.getTitle().includes('Edited'), win.getTitle());
    check('macOS documentEdited flag follows', process.platform !== 'darwin' || win.isDocumentEdited() === true);

    // 4 — Save writes in place, no dialog
    const before = fs.statSync(CATALOG).size;
    const saved = await js('saveCatalog()');
    await wait(400);
    check('saveCatalog() returned true', saved === true);
    check('dirty cleared after save', await js('dirty === false'));
    check('window title no longer Edited', !win.getTitle().includes('Edited'), win.getTitle());
    const reread = JSON.parse(zlib.gunzipSync(fs.readFileSync(CATALOG)).toString('utf8'));
    check('file on disk has the new disk', reread.disks.length === 3, reread.disks.length + ' disks, was ' + before + ' bytes');
    check('no leftover temp file',
          !fs.readdirSync(path.dirname(CATALOG)).some(f => f.startsWith(path.basename(CATALOG) + '.tmp')));

    // 5 — unsaved-changes guard blocks New Catalog
    await js(`markDirty(); newCatalog(); true`);
    await wait(300);
    check('guard modal shown on New with unsaved changes', (await js(`g('mw').style.display`)) === 'flex');
    check('catalog untouched while the guard is up', (await js('DB.disks.length')) === 3);
    // Cancel → nothing happens
    await js(`Array.from(g('ma').querySelectorAll('button')).find(b=>b.textContent==='Cancel').click(); true`);
    await wait(200);
    check('Cancel keeps the document open', await js('docOpen === true && dirty === true'));
    // Don't Save → new empty catalog
    await js(`newCatalog(); true`); await wait(200);
    await js(`Array.from(g('ma').querySelectorAll('button')).find(b=>b.textContent==="Don't save").click(); true`);
    await wait(300);
    check('Don\'t Save starts a clean empty catalog', await js('docOpen === true && dirty === false && DB.disks.length === 0'));
    check('new catalog has no path', await js('docPath === null'));
    check('window title back to Untitled', win.getTitle().includes('Untitled'), win.getTitle());

    // 6 — reopening by path (Open Recent / drag & drop route)
    await js(`openCatalog(${JSON.stringify(CATALOG)}); true`);
    await wait(600);
    check('reopen by path works', (await js('DB.disks.length')) === 3 && (await js('dirty === false')));

    // 7 — close guard + welcome recents
    await js(`closeDatabase(); true`); await wait(300);
    check('close returns to the welcome screen', (await js(`getComputedStyle(g('welcome')).display`)) !== 'none');
    check('recents rendered on welcome', (await js(`g('recent-list').innerHTML`)).includes('test-catalog.archivo'));

    // ═══════════ 1.4.0 — every fix of the audit ═══════════
    await js(`newCatalog(); true`); await wait(300);

    // — Security: a trapped catalog must stay text —
    const { sanitizeCatalog, MAX_DEPTH } = require('../src/catalog');
    const trapDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archivo-trap-'));
    const TRAP = path.join(trapDir, 'trap.archivo');
    const x = '<img src=x onerror=window.__p=1>';
    fs.writeFileSync(TRAP, zlib.gzipSync(Buffer.from(JSON.stringify({ disks: [
      { id: 'a" onmouseover="window.__p=1', label: x, model: x, serial: 'S1', total: x, free: x, note: x, scanned: x,
        file_count: 1, tree: [{ type: 'dir', name: x, size: x, modified: x, children: [
          { type: 'file', name: x + '.mov', size: x, modified: x }] }] },
    ] }))));
    await js(`openCatalog(${JSON.stringify(TRAP)}); true`); await wait(600);
    await js(`expanded.add(DB.disks[0].id); expanded.add(DB.disks[0].id + '/' + DB.disks[0].tree[0].name); renderTree();
      selectRow(ROWS[1]); updateInsp(); true`);
    await js(`selectRow(ROWS[0]); deleteSelected(); true`); await wait(100);
    await js(`g('search-inp').value = 'img'; execSearch('img'); true`);
    const inj = await js(`['tree-body','ib','mb','srch-list','pathbar'].map(id => g(id).querySelectorAll('img').length).reduce((a,b)=>a+b,0)`);
    check('sécu: trapped catalog renders as text (tree, inspector, dialog, search)', inj === 0, inj + ' <img> injected');
    check('sécu: no code ran from the catalog', !(await js('window.__p')));
    check('sécu: forged disk id replaced', await js(`/^[A-Za-z0-9_-]+$/.test(DB.disks[0].id)`), await js('DB.disks[0].id'));
    await js(`hideModal(); clearSearch(); true`);
    const csp = await js(`(document.querySelector('meta[http-equiv="Content-Security-Policy"]')||{}).content||''`);
    const scriptSrc = (csp.split('script-src')[1] || '').split(';')[0].trim();
    check('sécu: page carries a strict CSP (no inline script)', scriptSrc === "'self'", scriptSrc);
    check('sécu: openPath removed from the bridge', await js(`typeof window.archivo.openPath === 'undefined'`));
    check('sécu: "Open" removed from the context menu', await js(`!document.getElementById('ctx-open')`));
    // sanitizer unit checks
    let threw = false; try { sanitizeCatalog({ nope: 1 }); } catch (e) { threw = true; }
    check('sécu: a non-catalog file is refused', threw);
    let deep = { type: 'dir', name: 'd', children: [] }, root = deep;
    for (let i = 0; i < 5000; i++) { const c = { type: 'dir', name: 'd' + i, children: [] }; deep.children.push(c); deep = c; }
    const clean = sanitizeCatalog({ disks: [{ id: 'x', label: 'L', tree: [root] }] });
    let depth = 0; for (let n = clean.disks[0].tree[0]; n && n.children && n.children.length; n = n.children[0]) depth++;
    check('sécu: absurdly deep tree capped, no crash', depth < MAX_DEPTH, depth);
    check('sécu: "/" inside a name neutralised', sanitizeCatalog({ disks: [{ id: 'x', label: 'L', tree: [{ type: 'file', name: 'a/b' }] }] }).disks[0].tree[0].name === 'a∕b');
    check('sécu: update link limited to the archivo repo',
          MAIN.safeReleaseUrl('https://evil.example/archivo') === 'https://github.com/noar-justedit/archivo/releases' &&
          MAIN.safeReleaseUrl('https://github.com/noar-justedit/archivo/releases/tag/v9.9.9').includes('/v9.9.9'));
    // CSV formula injection
    check('sécu: CSV neutralises formulas', await js(`csvField('=1+1') === "'=1+1" && csvField('@x') === "'@x" && csvField(12) === '12' && csvField('RUSHES') === 'RUSHES'`));
    // HTML export: payload with a closing script tag stays data
    const { buildExportHtml } = require('../src/export-viewer');
    const payload = [{ label: 'D', tree: [{ type: 'file', name: '</script><script>window.__p=1</script>', size: 1, modified: '' }] }];
    const html = buildExportHtml(zlib.gzipSync(Buffer.from(JSON.stringify(payload))).toString('base64'));
    const expFile = path.join(trapDir, 'export.html'); fs.writeFileSync(expFile, html);
    const ev = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } });
    await ev.loadFile(expFile); await wait(800);
    const evRes = await ev.webContents.executeJavaScript(`({ p: !!window.__p, csp: !!document.querySelector('meta[http-equiv="Content-Security-Policy"]'),
      text: document.body.innerText.includes('</script><script>') })`, true);
    ev.destroy();
    check('sécu: HTML export shows hostile names as text', evRes.text && !evRes.p, JSON.stringify(evRes));
    check('sécu: HTML export carries its own CSP', evRes.csp);
    // prefs: dismissing an update no longer wipes the recents
    const recBefore = (await js(`window.archivo.recents()`)).length;
    await js(`window.archivo.savePrefs({ dismissedUpdateVersion: '9.9.9' })`);
    const recAfter = (await js(`window.archivo.recents()`)).length;
    check('données: "Later" on an update keeps the recent catalogs', recBefore > 0 && recAfter === recBefore, recBefore + ' → ' + recAfter);

    // — Data: serial "—" is not a serial —
    await js(`DB = { disks: [
      { id:'s1', label:'RUSHES A', serial:'—', total:'1 TB', free:'0,5 TB', tree:[] },
      { id:'s2', label:'MASTER',   serial:'WD-111', total:'1 TB', free:'0,5 TB', tree:[] } ] }; refreshAll(); true`);
    check('données: "—" never matches another disk', await js(`findExistingDisk('—', 'OTHER DISK') === null && findExistingDisk('Detecting…', 'X') === null`));
    check('données: a real serial still finds its disk', await js(`findExistingDisk('WD-111', 'renamed')?.id === 's2'`));
    check('données: same name, different real serials = different disks', await js(`findExistingDisk('WD-222', 'MASTER') === null`));
    check('données: same name, unknown serial = asked to the user', await js(`findExistingDisk('', 'rushes a')?.id === 's1'`));

    // — Scan lock —
    await js(`setScanning(true); true`); await wait(150);
    const docBefore = await js('JSON.stringify(DB.disks.map(d=>d.id))');
    await js(`newCatalog(); openCatalog(${JSON.stringify(CATALOG)}); closeDatabase(); true`); await wait(300);
    check('scan: catalog cannot change during a scan', (await js('JSON.stringify(DB.disks.map(d=>d.id))')) === docBefore && await js('docOpen'));
    check('scan: toolbar greys out', await js(`g('btn-add-disk').disabled && g('btn-close').disabled && g('btn-import').disabled`));
    const fileMenu = () => Menu.getApplicationMenu().items.find(i => i.label === 'File').submenu.items;
    check('scan: native menu greys out New / Open / Close', ['New Catalog', 'Open Catalog…', 'Close Catalog'].every(l => fileMenu().find(i => i.label === l).enabled === false));
    await js(`setScanning(false); true`); await wait(150);
    check('scan: menu back after the scan', fileMenu().find(i => i.label === 'New Catalog').enabled === true);
    // main-process lock: a second scan is refused
    const scanDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archivo-scan-'));
    for (let i = 0; i < 3000; i++) fs.writeFileSync(path.join(scanDir, 'f' + i), '');
    const two = await js(`(async () => {
      const a = window.archivo.scanVolume(${JSON.stringify(scanDir)});
      let refused = '';
      try { await window.archivo.scanVolume(${JSON.stringify(scanDir)}); } catch (e) { refused = String(e.message || e); }
      const r = await a; return { refused, files: r.fileCount };
    })()`);
    check('scan: a second simultaneous scan is refused', /already running/.test(two.refused), two.refused);
    check('scan: the first scan completes normally', two.files === 3000, two.files);

    // — Tree: virtualised, sorted inside folders —
    await js(`(() => { const kids = []; for (let i = 0; i < 50000; i++) kids.push({ type:'file', name:'C' + String(i).padStart(5,'0') + '.mov', size: (i * 7919) % 100000, modified:'2024-01-01' });
      DB = { disks: [{ id:'big', label:'BIG', total:'4 TB', free:'0,2 TB', tree:[{ type:'dir', name:'PROXY', size: 0, children: kids }] }] };
      expanded.clear(); selected = null; refreshAll(); expanded.add('big'); renderTree(); return true; })()`);
    const t = await js(`(() => { const t0 = performance.now(); togExp('big/PROXY'); const t1 = performance.now();
      selectRow(ROWS[100]); const t2 = performance.now(); return [t1 - t0, t2 - t1, document.querySelectorAll('#tree-body .tr').length, ROWS.length]; })()`);
    check('perf: open a 50 000-file folder < 150 ms', t[0] < 150, Math.round(t[0]) + ' ms (was 2067)');
    check('perf: click after that < 30 ms', t[1] < 30, Math.round(t[1]) + ' ms (was 1892)');
    check('perf: only the visible rows are drawn', t[2] < 200 && t[3] === 50002, t[2] + ' rows in the page for ' + t[3]);
    await js(`sortK = 'name'; sortAsc = true; sortBy('size'); true`);
    check('tri: Size sorts the content of folders too', await js(`(() => { const s = ROWS.filter(r => r.node && r.node.type === 'file').slice(0, 50).map(r => r.node.size);
      return s.every((v, i) => !i || s[i - 1] <= v); })()`));
    await js(`sortK = 'size'; sortBy('name'); true`);
    // scroll draws the right rows
    await js(`g('tree-scroll').scrollTop = 30 * 20000; paintRows(); true`);
    check('perf: scrolling draws the rows in view, and only those', await js(`!!document.querySelector('#tree-body .tr[data-i="20005"]') && document.querySelectorAll('#tree-body .tr').length < 200`));

    // — Search: no index, empty state, filters, highlight escaped —
    check('search: no more index in memory', await js(`typeof srchIndex === 'undefined' && typeof buildIndex === 'undefined'`));
    const ts = await js(`(() => { g('search-inp').value = 'C4999'; const t0 = performance.now(); execSearch('C4999'); return [performance.now() - t0, srchResults.length]; })()`);
    check('search: finds without an index', ts[1] === 10, ts[1] + ' results in ' + Math.round(ts[0]) + ' ms');
    await js(`openResult(0); true`); await wait(100);
    check('search: a result opens, selects and shows its row', await js(`selected && selected.node && selected.node.name === 'C49990.mov' && !!document.querySelector('#tree-body .tr.sel')`));
    await js(`execSearch('zzzz-nothing'); true`);
    check('search: "no result" says so', await js(`!!g('srch-list').querySelector('.srch-empty')`));
    await js(`DB.disks[0].tree.push({ type:'dir', name:'clip.mov', children:[] }, { type:'file', name:'a<b>clip</b>.mov', size:1 }); true`);
    await js(`srchFilter = 'video'; execSearch('clip'); true`);
    check('search: Video filter skips folders', await js(`srchResults.every(r => r.node.type === 'file') && srchResults.length === 1`));
    await js(`execSearch('<b>clip'); true`);
    check('search: highlight cannot inject markup', await js(`srchResults.length === 1 && !g('srch-list').querySelector('.sr-nm b') && g('srch-list').querySelector('.sr-nm em') !== null`));
    await js(`srchFilter = 'all'; clearSearch(); true`);
    check('search: clear button is a real button', await js(`g('search-clear').tagName === 'BUTTON'`));

    // — Keyboard —
    await js(`DB = { disks: [
      { id:'k1', label:'ONE', total:'1 TB', free:'0,05 TB', tree:[{ type:'dir', name:'D', size:1, children:[{ type:'file', name:'f.mov', size:1 }] }] },
      { id:'k2', label:'TWO', total:'1 TB', free:'0,5 TB', tree:[] } ] };
      expanded.clear(); selected = null; refreshAll(); g('tree-scroll').scrollTop = 0; true`);
    const key = (k, extra) => js(`g('tree-scroll').dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: ${JSON.stringify(k)}, bubbles: true }, ${JSON.stringify(extra || {})}))); true`);
    await js(`g('tree-scroll').focus(); true`);
    check('clavier: the tree takes the focus and selects the first row', await js(`document.activeElement === g('tree-scroll') && selected && selected.disk.id === 'k1'`));
    await key('ArrowRight'); await key('ArrowDown');
    check('clavier: arrows open and move', await js(`selected.type === 'node' && selected.node.name === 'D'`));
    await key('Enter'); await key('ArrowDown');
    check('clavier: Enter opens a folder', await js(`selected.node && selected.node.name === 'f.mov'`));
    await key('ArrowLeft');
    check('clavier: Left goes up to the parent', await js(`selected.node && selected.node.name === 'D'`));
    await key('F10', { shiftKey: true });
    check('clavier: Shift+F10 opens the menu, focus inside', await js(`g('ctx').style.display === 'block' && g('ctx').contains(document.activeElement)`));
    await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true`);
    check('clavier: Escape closes it and gives the focus back', await js(`g('ctx').style.display === 'none' && document.activeElement === g('tree-scroll')`));
    check('clavier: toolbar and menu items are buttons', await js(`[...document.querySelectorAll('#toolbar .btn, #ctx .cx, .sf, .exp-opt')].every(b => b.tagName === 'BUTTON')`));

    // — Interface —
    check('ui: one colour rule for bar and Free figure (95 % used → red)', await js(`(() => { const r = document.querySelector('#tree-body .tr.disk-row');
      return r.querySelector('.dfill-in').classList.contains('fc90') && r.querySelector('.tr-fr').style.color === 'var(--red)'; })()`));
    await js(`selectRow(ROWS[0]); DB.disks[0].label = '<b>x</b>'; deleteSelected(); true`); await wait(50);
    check('ui: Remove dialog escapes the name, focus on Cancel', await js(`!g('mb').querySelector('b') && document.activeElement && document.activeElement.textContent === 'Cancel' && g('mt').textContent === 'Remove disk'`));
    await js(`hideModal(); DB.disks[0].skipped = { count: 3, sample: ['/Volumes/ONE/private'] }; selectRow(ROWS[0]); true`);
    check('ui: unreadable items shown in the Inspector', await js(`!!g('ib').querySelector('.iv.warn')`));
    check('ui: Delete greyed when no disk is selected', await js(`(() => { selected = null; updateSB(); return g('btn-delete').disabled; })()`));
    check('ui: (A) badges have a tooltip and use the charter green', await js(`[...document.querySelectorAll('.auto-ic')].every(s => s.querySelector('title') && getComputedStyle(s).color === 'rgb(53, 201, 139)') && document.querySelectorAll('.auto-ic').length === 4`));
    check('ui: "Update existing" is orange', await js(`(() => { const b = g('btn-confirm-add'); b.classList.add('is-update'); const c = getComputedStyle(b).color; b.classList.remove('is-update'); return c === 'rgb(242, 160, 61)'; })()`));
    check('ui: Reveal path cannot leave the volume', await js(`joinOnVolume('/Volumes/ONE', ['..', 'etc']) === null && joinOnVolume('/Volumes/ONE', ['D', 'f.mov']) === '/Volumes/ONE/D/f.mov'`));
    check('ui: minimum window width 1100', win.getMinimumSize()[0] === 1100, win.getMinimumSize()[0]);
    win.setSize(1100, 700); await wait(400);
    const cols = await js(`(() => { const cat = g('cat').getBoundingClientRect(); const nt = document.querySelector('.ch-nt').getBoundingClientRect();
      return [Math.round(nt.right), Math.round(cat.right), Math.round(nt.width)]; })()`);
    check('ui: at 1100 px every column stays on screen', cols[0] <= cols[1] && cols[2] >= 60, JSON.stringify(cols));
    win.setSize(1280, 820); await wait(200);

    // 8 — no uncaught renderer errors
    const errs = await js('window.__errs');
    check('no renderer errors', !errs || errs.length === 0, JSON.stringify(errs));
  } catch (e) {
    results.push('FAIL  harness threw → ' + (e && e.stack || e));
    failed++;
  }
  console.log('\n────── SMOKE TEST ──────');
  results.forEach(r => console.log(r));
  console.log('────── ' + (failed ? failed + ' FAILURE(S)' : 'ALL PASS') + ' ──────\n');
  app.exit(failed ? 1 : 0);
});
