/*
 * archivo — offline hard-disk catalog · catalog file validation
 * Copyright (C) 2026 Noar (just edit) — GPL-3.0-or-later
 *
 * A .archivo file can come from anyone: a colleague, a client, a shared
 * drive. Before the interface sees it, every catalog is rebuilt here from
 * scratch, keeping only fields of the expected type:
 *
 *  - disk ids must look like ids (letters, digits, - and _), otherwise a new
 *    one is generated — an id is written into the page as an attribute;
 *  - text fields are forced to text and capped in length;
 *  - sizes are numbers, or short text for catalogs imported from other tools
 *    ("1,9 MB"); anything else becomes 0;
 *  - folder nesting is capped, so a forged, absurdly deep tree cannot crash
 *    the app; the walk is iterative for the same reason;
 *  - a "/" inside a name (impossible on a real disk, possible in a forged
 *    file) is replaced, because "/" separates path levels inside archivo.
 *
 * The interface still escapes everything it displays: this is the second lock.
 */
'use strict';

const crypto = require('crypto');

const MAX_DEPTH   = 256;
const ID_RE       = /^[A-Za-z0-9_-]{1,64}$/;
const VOL_TYPES   = new Set(['usb', 'network', 'system', 'unknown']);
const CONTROL_RE  = /[\u0000-\u001f\u007f]/g;

function text(v, max) {
  if (typeof v === 'number' && isFinite(v)) v = String(v);
  if (typeof v !== 'string') return '';
  v = v.replace(CONTROL_RE, ' ');
  return v.length > max ? v.slice(0, max) : v;
}

function size(v) {
  if (typeof v === 'number') return isFinite(v) && v > 0 ? v : 0;
  if (typeof v === 'string') return text(v.trim(), 32);
  return 0;
}

function name(v) {
  const n = text(v, 1024).replace(/\//g, '∕');
  return n || '(unnamed)';
}

function cleanNode(n) {
  const isDir = n.type === 'dir';
  const out = { type: isDir ? 'dir' : 'file', name: name(n.name), size: size(n.size), modified: text(n.modified, 32) };
  if (isDir) out.children = [];
  return out;
}

// Iterative copy of a tree, so depth can never overflow the call stack.
function cleanTree(tree) {
  const root = [];
  if (!Array.isArray(tree)) return root;
  const stack = [{ src: tree, dst: root, depth: 0 }];
  while (stack.length) {
    const { src, dst, depth } = stack.pop();
    for (const n of src) {
      if (!n || typeof n !== 'object') continue;
      const c = cleanNode(n);
      dst.push(c);
      if (c.type === 'dir' && Array.isArray(n.children) && depth + 1 < MAX_DEPTH) {
        stack.push({ src: n.children, dst: c.children, depth: depth + 1 });
      }
    }
  }
  return root;
}

function countFiles(tree) {
  let count = 0;
  const stack = [tree];
  while (stack.length) {
    for (const n of stack.pop()) {
      if (n.type === 'dir') stack.push(n.children);
      else count++;
    }
  }
  return count;
}

/**
 * @param {any} data  parsed JSON
 * @returns {{disks: Array}} a clean catalog
 * @throws if data is not a catalog at all
 */
function sanitizeCatalog(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.disks)) {
    throw new Error('This file is not an archivo catalog.');
  }
  const used = new Set();
  const disks = [];
  for (const d of data.disks) {
    if (!d || typeof d !== 'object') continue;
    let id = typeof d.id === 'string' && ID_RE.test(d.id) && !used.has(d.id)
      ? d.id : 'disk_' + crypto.randomBytes(6).toString('hex');
    used.add(id);
    const tree = cleanTree(d.tree);
    const disk = {
      id,
      label:   text(d.label, 256) || 'Untitled disk',
      model:   text(d.model, 256),
      serial:  text(d.serial, 128),
      total:   text(d.total, 32),
      free:    text(d.free, 32),
      iface:   text(d.iface, 64),
      note:    text(d.note, 10000),
      scanned: text(d.scanned, 40),
      file_count: typeof d.file_count === 'number' && isFinite(d.file_count) && d.file_count >= 0
        ? Math.floor(d.file_count) : countFiles(tree),
      tree,
    };
    if (VOL_TYPES.has(d.vol_type)) disk.vol_type = d.vol_type;
    if (d.skipped && typeof d.skipped.count === 'number' && d.skipped.count > 0) {
      disk.skipped = { count: Math.floor(d.skipped.count),
                       sample: Array.isArray(d.skipped.sample) ? d.skipped.sample.slice(0, 20).map(s => text(s, 1024)) : [] };
    }
    disks.push(disk);
  }
  return { disks };
}

module.exports = { sanitizeCatalog, MAX_DEPTH };
