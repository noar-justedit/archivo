/*
 * Scanner test — plain Node, no Electron:   node test/scanner.test.js
 *
 * Builds a small folder tree with an unreadable folder and a symbolic link
 * pointing back up, scans it, and checks that nothing is silently lost:
 * the unreadable folder is reported, the link does not loop, and a volume
 * that cannot be read at all is an error, not an empty disk.
 * (Permissions are ignored for the root user: that part is skipped then.)
 */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const { scanVolume } = require('../src/scanner');

let failed = 0;
const check = (name, ok, extra) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (extra !== undefined ? '   → ' + extra : '')); if (!ok) failed++; };

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'archivo-scan-'));
  fs.mkdirSync(path.join(root, 'DAY01'));
  fs.writeFileSync(path.join(root, 'DAY01', 'A001.mxf'), 'x'.repeat(100));
  fs.writeFileSync(path.join(root, 'DAY01', 'A002.mxf'), 'x'.repeat(50));
  fs.mkdirSync(path.join(root, 'LOCKED'));
  fs.writeFileSync(path.join(root, 'LOCKED', 'secret.mov'), 'x');
  fs.symlinkSync(root, path.join(root, 'loop'));
  fs.chmodSync(path.join(root, 'LOCKED'), 0o000);
  const asRoot = typeof process.getuid === 'function' && process.getuid() === 0;

  try {
    const events = [];
    const res = await scanVolume(root, { send: p => events.push(p) });
    const day = res.tree.find(n => n.name === 'DAY01');
    check('files counted', res.fileCount === (asRoot ? 3 : 2), res.fileCount);
    check('folder size is the sum of its files', day && day.size === 150, day && day.size);
    check('symbolic link skipped, no loop', !res.tree.some(n => n.name === 'loop'));
    if (asRoot) console.log('SKIP  unreadable folder (running as root: permissions do not apply)');
    else {
      check('unreadable folder reported', res.skipped.count === 1 && res.skipped.sample[0].endsWith('LOCKED'), JSON.stringify(res.skipped));
      check('"done" event carries the skipped count', events[events.length - 1].skipped === 1);
    }
    const job = { c: false };
    const p = scanVolume(root, { isCancelled: () => job.c });
    job.c = true;
    check('cancel works', (await p).cancelled === true);
    if (!asRoot) {
      let err = '';
      try { await scanVolume(path.join(root, 'LOCKED')); } catch (e) { err = e.message; }
      check('an unreadable volume is an error, not an empty disk', /Cannot read/.test(err), err);
    }
  } finally {
    fs.chmodSync(path.join(root, 'LOCKED'), 0o755);
    fs.rmSync(root, { recursive: true, force: true });
  }
  console.log(failed ? failed + ' FAILURE(S)' : 'ALL PASS');
  process.exit(failed ? 1 : 0);
})();
