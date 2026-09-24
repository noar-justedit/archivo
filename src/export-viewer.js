/*
 * archivo — offline hard-disk catalog · standalone HTML viewer (export)
 * Copyright (C) 2026 Noar (just edit) — GPL-3.0-or-later
 *
 * Builds the single-file web page produced by Export → HTML. The catalog is
 * gzipped and embedded as base64; the page decompresses it in the browser
 * with the native DecompressionStream, so it needs no library and no network.
 *
 * Security, since this file is meant to be sent to other people and opened in
 * their browser:
 *  - every piece of catalog data is written with textContent, never innerHTML,
 *    so a file or folder name (or a size or date forged in a catalog) can
 *    never become markup;
 *  - the page carries a Content-Security-Policy that only allows the one
 *    script below, identified by its SHA-256 hash. Even if markup were ever
 *    injected, no event handler or foreign script could run.
 *
 * Look: the shared just edit UI charter (surfaces, no borders, state colours),
 * archivo's brick accent on the brand mark only.
 */
'use strict';

const crypto = require('crypto');

// archivo's icon, same drawing as build/icon.svg, used as the brand mark.
const ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="22" height="22" aria-hidden="true">' +
  '<rect x="9" y="106" width="494" height="133" fill="#d75f46"/><rect x="9" y="239" width="494" height="140" fill="#c4482e"/>' +
  '<rect x="9" y="379" width="494" height="133" fill="#b73c22"/><polygon points="123,0 389,0 503,106 9,106" fill="#ab3015"/>' +
  '<path d="M169.7,106 A88.3,88.3 0 0 0 342.3,106 Z" fill="#ab3015"/><path d="M169.7,239 A88.3,88.3 0 0 0 342.3,239 Z" fill="#7e1800"/>' +
  '<path d="M169.7,379 A88.3,88.3 0 0 0 342.3,379 Z" fill="#7e1800"/></svg>';

const CSS = `
:root{--page:#0a0b0e;--card:#14161c;--ins:#0e1014;--raise:#1b1d24;
--text:#e8eaf0;--text2:#aeb3bd;--text3:#8b909b;--text4:#6f757f;
--green:#35c98b;--red:#f2555a;--blue:#4d90f0;--orange:#f2a03d;--accent:#c4482e;
--font:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',system-ui,sans-serif;
--mono:ui-monospace,'SF Mono','JetBrains Mono',Menlo,Consolas,monospace}
*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;background:var(--page);color:var(--text);font:13px/1.45 var(--font);
  -webkit-font-smoothing:antialiased;display:flex;flex-direction:column;overflow:hidden}
header{display:flex;align-items:center;gap:10px;padding:14px 18px 10px;flex-shrink:0}
header svg{display:block}
.brand{font-weight:600;font-size:16px;letter-spacing:-.2px}
.sub{color:var(--text3);font-size:11.5px;margin-left:auto;font-family:var(--mono)}
main{flex:1;display:flex;gap:12px;padding:0 12px 12px;min-height:0}
aside,section{background:var(--card);border-radius:14px;min-height:0;display:flex;flex-direction:column}
aside{width:260px;flex-shrink:0;padding:12px}
section{flex:1;padding:12px 12px 6px;min-width:0}
.lbl{display:flex;align-items:center;height:12px;line-height:12px;font-size:10px;font-weight:700;
  letter-spacing:.14em;color:var(--text3);margin:2px 4px 10px;text-transform:uppercase}
#disks{overflow-y:auto;display:flex;flex-direction:column;gap:3px}
.dk{display:block;width:100%;text-align:left;background:none;border:none;border-radius:10px;
  padding:9px 11px;color:var(--text2);font:inherit;cursor:pointer}
.dk:hover{background:rgba(255,255,255,.03)}
.dk.sel{background:var(--ins);color:var(--text);box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}
.dk .n{display:block;font-family:var(--mono);font-size:12.5px;font-weight:600}
.dk .m{display:block;font-family:var(--mono);font-size:10.5px;color:var(--text4);margin-top:3px}
#search{width:100%;background:var(--ins);border:none;border-radius:8px;padding:9px 10px;color:var(--text);
  font:14px var(--font);margin-bottom:10px;outline:none}
#search:focus{box-shadow:inset 0 0 0 1px rgba(255,255,255,.18)}
#search::placeholder{color:var(--text4)}
#tree{flex:1;overflow:auto;padding-bottom:8px}
.row{display:flex;align-items:center;gap:8px;height:28px;padding:0 8px;border-radius:8px;white-space:nowrap}
.row:hover{background:rgba(255,255,255,.03)}
button.row{width:100%;background:none;border:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
.tog{width:12px;color:var(--text4);flex-shrink:0;font-size:10px}
.nm{font-family:var(--mono);font-size:12.5px;overflow:hidden;text-overflow:ellipsis}
.dir .nm{color:var(--text)}
.file .nm{color:var(--text2)}
.sz{margin-left:auto;padding-left:14px;font-family:var(--mono);font-size:11.5px;color:var(--text3);flex-shrink:0}
.dt{width:92px;font-family:var(--mono);font-size:11.5px;color:var(--text4);flex-shrink:0;text-align:right}
.more{color:var(--blue);font-size:12px}
.hit{display:flex;flex-direction:column;justify-content:center;height:auto;padding:7px 8px}
.hit .p{font-family:var(--mono);font-size:10.5px;color:var(--text4);margin-top:2px;overflow:hidden;text-overflow:ellipsis}
.count{font-size:11.5px;color:var(--text3);margin:0 4px 8px}
.empty{color:var(--text3);font-size:12.5px;padding:40px 10px;text-align:center}
::-webkit-scrollbar{width:8px;height:8px}::-webkit-scrollbar-thumb{background:#2a2d36;border-radius:8px}
@media (max-width:720px){main{flex-direction:column}aside{width:auto;max-height:34vh}}
`;

// The viewer's script. Kept as a function body so it can be hashed for the CSP.
const SCRIPT = `
'use strict';
const PAGE = 1000;   // rows added at a time when a folder is opened
const $ = id => document.getElementById(id);
function el(tag, cls, text){ const e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=String(text); return e; }
function fmtB(b){
  if (typeof b === 'string') return b.trim();          // legacy catalogs: preformatted text, shown as text
  if (typeof b !== 'number' || !isFinite(b) || b <= 0) return '';
  const u=['B','KB','MB','GB','TB']; let i=0;
  while (b >= 1024 && i < u.length-1) { b /= 1024; i++; }
  return b.toFixed(i>1?1:0)+' '+u[i];
}
function b64ToBytes(s){ const bin=atob(s); const a=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) a[i]=bin.charCodeAt(i); return a; }
async function inflate(s){
  const stream = new Blob([b64ToBytes(s)]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new TextDecoder().decode(await new Response(stream).arrayBuffer());
}
let DATA=[], FLAT=null, cur=0;

function renderDisks(){
  const box=$('disks'); box.textContent='';
  DATA.forEach((d,i)=>{
    const b=el('button','dk'+(i===cur?' sel':''));
    b.appendChild(el('span','n',d.label||'Untitled disk'));
    b.appendChild(el('span','m',[d.total, d.scanned ? 'scanned '+String(d.scanned).slice(0,10) : ''].filter(Boolean).join(' · ')));
    b.addEventListener('click',()=>selectDisk(i));
    box.appendChild(b);
  });
}
function selectDisk(i){
  cur=i; renderDisks(); $('search').value='';
  const t=$('tree'); t.textContent='';
  const nodes=(DATA[i]&&DATA[i].tree)||[];
  if(!nodes.length){ t.appendChild(el('div','empty','This disk has no files in the catalog.')); return; }
  appendNodes(t, nodes, 0);
}
// Adds rows for nodes[start..start+PAGE], then a "show more" row if needed:
// a folder of 50 000 files opens instantly instead of freezing the page.
function appendNodes(container, nodes, depth, start=0){
  const end=Math.min(nodes.length, start+PAGE);
  for(let k=start;k<end;k++) container.appendChild(nodeRow(nodes[k], depth));
  if(end<nodes.length){
    const more=el('button','row more','Show '+Math.min(PAGE,nodes.length-end).toLocaleString('en')+' more of '+(nodes.length-end).toLocaleString('en')+' remaining');
    more.style.paddingLeft=(8+depth*16)+'px';
    more.addEventListener('click',()=>{ more.remove(); appendNodes(container,nodes,depth,end); });
    container.appendChild(more);
  }
}
function nodeRow(n, depth){
  const isDir=n.type==='dir';
  const wrap=el('div');
  const row=el(isDir?'button':'div','row '+(isDir?'dir':'file'));
  row.style.paddingLeft=(8+depth*16)+'px';
  const tog=el('span','tog',isDir?'\\u25B8':'');
  row.appendChild(tog);
  row.appendChild(el('span','nm',n.name));
  row.appendChild(el('span','sz',fmtB(n.size)));
  row.appendChild(el('span','dt',n.modified?String(n.modified).slice(0,10):''));
  wrap.appendChild(row);
  if(isDir){
    const kids=el('div'); kids.hidden=true; let built=false;
    row.addEventListener('click',()=>{
      if(!built){ appendNodes(kids, n.children||[], depth+1); built=true; }
      kids.hidden=!kids.hidden; tog.textContent=kids.hidden?'\\u25B8':'\\u25BE';
    });
    wrap.appendChild(kids);
  }
  return wrap;
}
function buildFlat(){
  FLAT=[];
  DATA.forEach(d=>{
    const stack=[{nodes:d.tree||[],p:''}];
    while(stack.length){
      const {nodes,p}=stack.pop();
      for(const n of nodes){
        const full=p?p+'/'+n.name:String(n.name);
        FLAT.push({disk:d.label,path:full,name:String(n.name),lower:String(n.name).toLowerCase(),size:n.size,dir:n.type==='dir'});
        if(n.type==='dir'&&n.children) stack.push({nodes:n.children,p:full});
      }
    }
  });
}
let timer=null;
function doSearch(q){
  clearTimeout(timer);
  timer=setTimeout(()=>{
    q=q.trim().toLowerCase();
    if(!q){ selectDisk(cur); return; }
    if(!FLAT) buildFlat();
    const all=FLAT.filter(f=>f.lower.includes(q));
    const t=$('tree'); t.textContent='';
    t.appendChild(el('div','count', all.length ? (all.length>500 ? 'First 500 of '+all.length.toLocaleString('en')+' results' : all.length+' result'+(all.length>1?'s':'')) : ''));
    if(!all.length){ t.appendChild(el('div','empty','No file or folder name contains \\u201C'+q+'\\u201D.')); return; }
    for(const h of all.slice(0,500)){
      const r=el('div','row hit');
      const top=el('div'); top.style.display='flex'; top.style.alignItems='center';
      top.appendChild(el('span','nm',h.name)); top.appendChild(el('span','sz',fmtB(h.size)));
      r.appendChild(top); r.appendChild(el('span','p',h.disk+' / '+h.path));
      t.appendChild(r);
    }
  },120);
}
$('search').addEventListener('input',e=>doSearch(e.target.value));
inflate(document.getElementById('data').textContent.trim()).then(txt=>{
  const parsed=JSON.parse(txt);
  DATA=Array.isArray(parsed)?parsed:[];
  if(!DATA.length){ $('tree').appendChild(el('div','empty','This catalog is empty.')); return; }
  $('sub').textContent=DATA.length+' disk'+(DATA.length>1?'s':'');
  renderDisks(); selectDisk(0);
}).catch(()=>{
  document.body.textContent='This export needs a recent browser (Chrome, Edge, Firefox 113+, Safari 16.4+).';
});
`;

/**
 * @param {string} b64  base64 of the gzipped catalog JSON
 * @returns {string}    the complete HTML page
 */
function buildExportHtml(b64) {
  // base64 only contains [A-Za-z0-9+/=]; checked anyway, since it is written
  // raw into the page.
  if (!/^[A-Za-z0-9+/=]*$/.test(b64)) throw new Error('Invalid export payload');
  const hash = crypto.createHash('sha256').update(SCRIPT, 'utf8').digest('base64');
  const csp = `default-src 'none'; script-src 'sha256-${hash}'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'`;
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>archivo catalog</title>
<style>${CSS}</style></head>
<body>
<header>${ICON_SVG}<span class="brand">archivo</span><span class="sub" id="sub"></span></header>
<main>
  <aside><div class="lbl">Disks</div><div id="disks"></div></aside>
  <section><input id="search" placeholder="Search every disk…" autocomplete="off" aria-label="Search every disk"><div id="tree"></div></section>
</main>
<script type="application/octet-stream" id="data">${b64}</script>
<script>${SCRIPT}</script>
</body></html>`;
}

module.exports = { buildExportHtml, SCRIPT };
