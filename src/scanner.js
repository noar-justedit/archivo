/*
 * archivo — offline hard-disk catalog · volume scanner
 * Copyright (C) 2026 Noar (just edit) — GPL-3.0-or-later
 *
 * Walks a mounted volume and returns its file tree. Plain Node, no Electron:
 * the main process calls it, and the tests can run it on their own.
 *
 * Two passes, as before: a quick count with a budget (3 s / 300 000 files) so
 * the progress bar can show a percentage, then the real walk with one stat()
 * per entry for size and date.
 *
 * What changed in 1.4.0: a folder or file that cannot be read (permission
 * refused, drive unplugged mid-scan, I/O error) is no longer silently treated
 * as empty. It is counted and reported, so a partial catalog is never
 * announced as complete. An unreadable volume root is an error, not an empty
 * disk.
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const SKIP = new Set(['.Spotlight-V100','.fseventsd','.Trashes','.DocumentRevisions-V100',
                      'System Volume Information','$RECYCLE.BIN','lost+found',
                      'node_modules','.git','.cache','Caches']);

// When scanning a system root volume, skip the big OS trees that would
// otherwise mean millions of files and a frozen scan.
const ROOT_SKIP = new Set([
  // macOS
  'System','Library','private','Applications','usr','bin','sbin',
  'opt','cores','dev','Volumes','tmp','var','etc','Network',
  // Windows
  'Windows','Program Files','Program Files (x86)','ProgramData',
  '$Recycle.Bin','System Volume Information','Recovery','PerfLogs',
  'AppData','MSOCache'
]);

const MAX_DEPTH          = 128;
const COUNT_TIME_BUDGET  = 3000;    // ms
const COUNT_FILE_BUDGET  = 300000;  // files
const MAX_SKIPPED_SAMPLE = 20;      // unreadable paths kept for the report

/**
 * @param {string} mountPoint
 * @param {object} opts
 * @param {(p:object)=>void} [opts.send]        progress callback
 * @param {()=>boolean}      [opts.isCancelled]
 * @param {string}           [opts.platform]    defaults to process.platform
 * @returns {Promise<{tree:Array, fileCount:number, skipped:{count:number, sample:string[]}} | {cancelled:true}>}
 */
async function scanVolume(mountPoint, opts = {}) {
  const send        = opts.send || (() => {});
  const isCancelled = opts.isCancelled || (() => false);
  const platform    = opts.platform || process.platform;

  // An unreadable root is an error: an empty disk would be a lie.
  try { fs.readdirSync(mountPoint); }
  catch (e) { throw new Error(`Cannot read ${mountPoint}: ${e.code || e.message}`); }

  const isWin  = platform === 'win32';
  const isRoot = mountPoint === '/' || (isWin && /^[A-Za-z]:\\?$/.test(mountPoint));
  const shouldSkip = (name, depth) => {
    if (name.startsWith('.') || SKIP.has(name)) return true;
    if (isRoot && depth === 0 && ROOT_SKIP.has(name)) return true;
    return false;
  };
  const yieldToLoop = () => new Promise(r => setImmediate(r));

  // Everything we could not read, for the end-of-scan report.
  const skipped = { count: 0, sample: [] };
  const noteSkipped = p => {
    skipped.count++;
    if (skipped.sample.length < MAX_SKIPPED_SAMPLE) skipped.sample.push(p);
  };

  // ── PHASE 1: count files with a budget so huge volumes don't freeze ──
  let total = 0, indeterminate = false, countCheck = 0;
  const countStart = Date.now();

  async function countFiles(dirPath, depth) {
    if (depth > MAX_DEPTH || isCancelled() || indeterminate) return;
    let entries;
    try { entries = fs.readdirSync(dirPath, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (isCancelled() || indeterminate) return;
      if (shouldSkip(e.name, depth)) continue;
      if (e.isDirectory()) {
        await countFiles(path.join(dirPath, e.name), depth + 1);
      } else if (e.isFile()) {
        total++;
        if ((++countCheck & 0x3FF) === 0) {        // every 1024 files: check budget + yield
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
  if (isCancelled()) { send({ cancelled: true, done: true }); return { cancelled: true }; }

  // ── PHASE 2: build tree, emit progress with %, ETA ──
  let done = 0, lastEmit = 0;
  const startTime = Date.now();

  async function walk(dirPath, depth) {
    if (depth > MAX_DEPTH || isCancelled()) return [];
    let entries;
    try { entries = fs.readdirSync(dirPath, { withFileTypes: true }); }
    catch { noteSkipped(dirPath); return []; }
    const nodes = [];
    for (const e of entries) {
      if (isCancelled()) return nodes;
      if (shouldSkip(e.name, depth)) continue;
      // Symbolic links are neither files nor folders here: skipped on purpose,
      // so a link pointing back up the tree can never loop the scan.
      if (!e.isDirectory() && !e.isFile()) continue;
      const full = path.join(dirPath, e.name);
      let stat;
      try { stat = fs.statSync(full); }
      catch { noteSkipped(full); continue; }
      if (e.isDirectory()) {
        const children = await walk(full, depth + 1);
        const dirSize  = children.reduce((sum, c) => sum + (c.size || 0), 0);
        nodes.push({ type:'dir', name:e.name, size:dirSize, modified:stat.mtime.toISOString().slice(0,10), children });
      } else {
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
    nodes.sort((a,b) => { if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
                          return a.name.toLowerCase().localeCompare(b.name.toLowerCase()); });
    return nodes;
  }

  const tree = await walk(mountPoint, 0);
  if (isCancelled()) { send({ cancelled: true, done: true }); return { cancelled: true }; }
  send({ phase:'done', files: done, total: indeterminate ? done : total, pct: 100, eta: 0, path: '', done: true,
         skipped: skipped.count });
  return { tree, fileCount: done, skipped };
}

module.exports = { scanVolume };
