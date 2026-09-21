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

require('../src/main.js');
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
      const disk = document.querySelector('.tr.disk-row[data-did="disk_1"]');
      const deep = document.querySelector('.tr[data-key="disk_1/DAY01/A001.mxf"]');
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
    await js(`Array.from(g('ma').querySelectorAll('button')).find(b=>b.textContent==="Don't Save").click(); true`);
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
