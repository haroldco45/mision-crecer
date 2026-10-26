/* Misión Crecer al Día — Vibras Positivas HM
   Hora real de Colombia (America/Bogota, UTC-5) en todo. */
const TZ = 'America/Bogota';
const MILAGRO_WEEK = new Date('2026-11-16T09:00:00-05:00'); // Nueva York, misma hora que Colombia en noviembre
const DATA_URL = 'data/noticias.json';
const RAW_URL = 'https://raw.githubusercontent.com/haroldco45/mision-crecer/main/data/noticias.json';
const QUERIES = ['"Misión Crecer"', '"Milagro Week"', '"Week Milagro"', 'MilagroWeek Nueva York', 'Misión Crecer vicepresidente Restrepo'];
const RELEVANT = /misi[oó]n\s*crecer|milagro\s*week|week\s*milagro|milagroweek|patria milagro.*inversi|crecer al 6/i;
const PROXIES = [
  u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
  u => 'https://corsproxy.io/?url=' + encodeURIComponent(u)
];

let ALL = [];
let shown = 12;
const $ = s => document.querySelector(s);

/* ---------- utilidades ---------- */
const fmtDate = d => new Intl.DateTimeFormat('es-CO', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
const fmtShort = d => new Intl.DateTimeFormat('es-CO', { timeZone: TZ, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(d);
const keyOf = t => (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 70);
const esc = s => (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function ago(d) {
  const m = Math.round((Date.now() - d) / 60000);
  if (m < 60) return `hace ${Math.max(m, 1)} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const dd = Math.round(h / 24);
  return dd === 1 ? 'ayer' : `hace ${dd} días`;
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ---------- cuenta regresiva ---------- */
function tick() {
  let ms = MILAGRO_WEEK - Date.now();
  if (ms <= 0) {
    const end = new Date('2026-11-19T23:59:00-05:00');
    $('#countCap').textContent = Date.now() < end ? 'La Milagro Week está pasando ahora mismo en Nueva York' : 'La Milagro Week ya pasó. Ahora toca ver cuánta inversión llega.';
    ms = 0;
  }
  const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
  $('#cd-d').textContent = d; $('#cd-h').textContent = String(h).padStart(2, '0');
  $('#cd-m').textContent = String(m).padStart(2, '0'); $('#cd-s').textContent = String(s).padStart(2, '0');
}

/* ---------- contadores animados ---------- */
function animateNumbers() {
  document.querySelectorAll('[data-to]').forEach(el => {
    if (el._done) return;
    const r = el.getBoundingClientRect();
    if (r.top > innerHeight) return;
    el._done = true;
    const to = +el.dataset.to, pre = el.dataset.pre || '', suf = el.dataset.suf || '';
    const t0 = performance.now(), dur = 1800;
    const step = now => {
      const p = Math.min((now - t0) / dur, 1), e = 1 - Math.pow(1 - p, 3);
      el.textContent = pre + Math.round(to * e).toLocaleString('es-CO') + suf;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 });

/* ---------- tarjetas ---------- */
function card(n, big) {
  const d = new Date(n.fecha);
  const fresh = Date.now() - d < 864e5;
  const img = n.imagen
    ? `<img src="${esc(n.imagen)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`
    : `<div class="noimg">${esc(n.fuente || 'Misión Crecer')}</div>`;
  return `<a class="news${big ? ' big' : ''}" href="${esc(n.link)}" target="_blank" rel="noopener">
    <div class="ph">${img}<span class="src">${esc(n.fuente || 'Noticia')}</span>${fresh ? '<span class="new">NUEVO</span>' : ''}</div>
    <div class="bd"><h3>${esc(n.titulo)}</h3>${n.resumen ? `<p style="color:var(--mut);font-size:14px">${esc(n.resumen).slice(0, 180)}</p>` : ''}
    <div class="meta">${fmtShort(d)} · ${ago(d)}</div></div></a>`;
}
function observeCards(box) { box.querySelectorAll('.news').forEach(c => io.observe(c)); }

function renderToday() {
  $('#todayDate').textContent = 'Hoy, ' + fmtDate(new Date());
  const day = ALL.filter(n => Date.now() - new Date(n.fecha) < 864e5);
  const box = $('#todayBox');
  if (day.length) {
    $('#todayInfo').textContent = `${day.length} ${day.length === 1 ? 'noticia nueva' : 'noticias nuevas'} en las últimas 24 horas.`;
    box.innerHTML = `<div class="grid">${day.slice(0, 6).map((n, i) => card(n, i === 0)).join('')}</div>`;
  } else {
    const last = ALL.slice(0, 3);
    $('#todayInfo').textContent = 'Lo nuevo de las últimas 24 horas. Se revisa cada vez que entras.';
    box.innerHTML = `<div class="today-empty">Hoy todavía no sale nada nuevo sobre la Misión Crecer. Esto es lo más reciente:</div>
      <div class="grid">${last.map((n, i) => card(n, i === 0)).join('')}</div>`;
  }
  observeCards(box);
}

function renderList() {
  const q = keyOf($('#q').value);
  const list = q ? ALL.filter(n => keyOf(n.titulo + ' ' + (n.resumen || '') + ' ' + (n.fuente || '')).includes(q)) : ALL;
  const box = $('#list');
  box.innerHTML = list.length ? list.slice(0, shown).map(n => card(n)).join('') : '<p style="color:var(--mut)">No hay noticias con esa palabra. Prueba "Buscar en vivo".</p>';
  $('#more').hidden = list.length <= shown;
  observeCards(box);
}

function renderTicker() {
  const items = ALL.slice(0, 10).map(n => `<span>${esc(n.titulo)}</span>`).join('');
  if (items) $('#ticker').innerHTML = items + items;
}

function renderHero() {
  const withImg = ALL.filter(n => n.imagen).slice(0, 5);
  if (!withImg.length) return;
  let i = 0;
  const set = () => { $('#heroBg').style.backgroundImage = `url("${withImg[i % withImg.length].imagen}")`; i++; };
  set();
  clearInterval(renderHero._t);
  if (withImg.length > 1) renderHero._t = setInterval(set, 9000);
}

function renderAll() {
  ALL.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  renderHero(); renderTicker(); renderToday(); renderList();
}

/* ---------- datos ---------- */
function merge(items) {
  const seen = new Map(ALL.map(n => [keyOf(n.titulo), n]));
  let nuevos = 0;
  for (const n of items) {
    if (!n.titulo || !n.link) continue;
    const k = keyOf(n.titulo);
    if (seen.has(k)) { const o = seen.get(k); if (!o.imagen && n.imagen) o.imagen = n.imagen; continue; }
    seen.set(k, n); ALL.push(n); nuevos++;
  }
  return nuevos;
}

async function loadRobot() {
  const bust = '?t=' + Date.now();
  for (const url of [RAW_URL + bust, DATA_URL + bust]) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) continue;
      const j = await r.json();
      merge(j.noticias || []);
      if (j.revisado) $('#robotInfo').textContent = 'El robot revisó las noticias por última vez el ' + fmtShort(new Date(j.revisado)) + ' (hora de Colombia).';
      return true;
    } catch (e) { /* sigue con la otra fuente */ }
  }
  return false;
}

function parseRss(xml, fuenteDefault) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  return [...doc.querySelectorAll('item')].map(it => {
    const g = s => it.querySelector(s)?.textContent?.trim() || '';
    let link = g('link');
    const m = link.match(/[?&]url=([^&]+)/); if (m) link = decodeURIComponent(m[1]);
    let titulo = g('title'), fuente = g('source') || fuenteDefault;
    const dash = titulo.lastIndexOf(' - ');
    if (fuenteDefault === 'Google' && dash > 20) { fuente = titulo.slice(dash + 3); titulo = titulo.slice(0, dash); }
    const imgEl = it.getElementsByTagName('News:Image')[0] || it.getElementsByTagName('media:content')[0];
    let imagen = imgEl ? (imgEl.textContent || imgEl.getAttribute('url') || '').trim() : '';
    if (imagen && !/^https?:/.test(imagen)) imagen = '';
    const resumen = g('description').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const fecha = new Date(g('pubDate') || Date.now()).toISOString();
    return { titulo, link, fuente: fuente === 'Google' ? '' : (fuente === 'Bing' ? (()=>{ try { return new URL(link).hostname.replace(/^www\./,'').split('.')[0].replace(/^./,c=>c.toUpperCase()); } catch(e){ return ''; } })() : fuente), imagen, resumen: fuenteDefault === 'Google' ? '' : resumen, fecha };
  }).filter(n => RELEVANT.test(n.titulo + ' ' + n.resumen));
}

async function viaProxy(url) {
  for (const p of PROXIES) {
    try {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 9000);
      const r = await fetch(p(url), { signal: ctrl.signal }); clearTimeout(t);
      if (r.ok) { const tx = await r.text(); if (tx.includes('<item')) return tx; }
    } catch (e) { /* prueba el siguiente */ }
  }
  return '';
}

async function liveSearch(extra) {
  const qs = extra ? [extra + ' Misión Crecer'] : QUERIES;
  let found = [];
  await Promise.all(qs.map(async q => {
    const bing = await viaProxy('https://www.bing.com/news/search?format=rss&setlang=es&cc=CO&q=' + encodeURIComponent(q));
    if (bing) found = found.concat(parseRss(bing, 'Bing'));
    const goo = await viaProxy('https://news.google.com/rss/search?hl=es-419&gl=CO&ceid=CO:es-419&q=' + encodeURIComponent(q));
    if (goo) found = found.concat(parseRss(goo, 'Google'));
  }));
  return merge(found);
}

async function update(manual) {
  const b = $('#refresh');
  b.classList.add('spin'); b.textContent = 'Buscando...';
  $('#status').textContent = 'Buscando noticias nuevas en este momento...';
  await loadRobot();
  renderAll();
  const nuevos = await liveSearch();
  renderAll();
  b.classList.remove('spin'); b.textContent = 'Actualizar';
  $('#status').textContent = `${ALL.length} noticias reunidas · revisado ${fmtShort(new Date())}`;
  if (manual || nuevos) toast(nuevos ? `${nuevos} ${nuevos === 1 ? 'noticia nueva' : 'noticias nuevas'}` : 'Ya estás al día');
}

/* ---------- arranque ---------- */
document.addEventListener('DOMContentLoaded', () => {
  tick(); setInterval(tick, 1000);
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
  setTimeout(() => { $('#fill').style.width = '100%'; }, 400);
  addEventListener('scroll', animateNumbers, { passive: true }); animateNumbers();
  $('#refresh').onclick = () => update(true);
  $('#q').oninput = () => { shown = 12; renderList(); };
  $('#more').onclick = () => { shown += 12; renderList(); };
  $('#liveBtn').onclick = async () => {
    const q = $('#q').value.trim();
    $('#status').textContent = 'Buscando en vivo' + (q ? ` "${q}"` : '') + '...';
    const n = await liveSearch(q || null); renderAll();
    $('#status').textContent = n ? `${n} resultados nuevos agregados` : 'No aparecieron resultados nuevos';
  };
  update(false);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) update(false); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
});
