// Robot de Misión Crecer al Día — corre en GitHub Actions cada 30 minutos.
// Busca noticias reales (Bing News y Google News), saca la foto de cada nota
// y actualiza data/noticias.json. Solo escribe si hay noticias nuevas.
import { readFile, writeFile } from 'node:fs/promises';

const FILE = 'data/noticias.json';
const QUERIES = ['"Misión Crecer"', '"Milagro Week"', '"Week Milagro"', 'MilagroWeek Nueva York', 'Misión Crecer vicepresidente Restrepo', 'Milagro Week proyectos inversión'];
const RELEVANT = /misi[oó]n\s*crecer|milagro\s*week|week\s*milagro|milagroweek|patria milagro.*inversi|crecer al 6/i;
const UA = 'Mozilla/5.0 (compatible; MisionCrecerBot/1.0; +https://vibraspositivashm.com)';
const MAX = 120;

const keyOf = t => (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 70);
const decode = s => (s || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim();
const tag = (xml, t) => { const m = xml.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, 'i')); return m ? decode(m[1]) : ''; };

async function get(url, ms = 10000) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
  try { const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-CO,es;q=0.9' }, signal: ctrl.signal, redirect: 'follow' }); return r.ok ? await r.text() : ''; }
  catch { return ''; } finally { clearTimeout(t); }
}

function parse(xml, origen) {
  return (xml.match(/<item>[\s\S]*?<\/item>/g) || []).map(it => {
    let link = tag(it, 'link');
    const m = link.match(/[?&]url=([^&]+)/); if (m) link = decodeURIComponent(m[1]);
    let titulo = tag(it, 'title'), fuente = tag(it, 'source');
    if (origen === 'google') { const d = titulo.lastIndexOf(' - '); if (d > 20) { fuente = fuente || titulo.slice(d + 3); titulo = titulo.slice(0, d); } }
    const resumen = origen === 'google' ? '' : tag(it, 'description').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
    let imagen = tag(it, 'News:Image');
    if (!/^https?:/.test(imagen)) imagen = '';
    const pub = new Date(tag(it, 'pubDate') || Date.now());
    return { titulo, link, fuente, imagen, resumen, fecha: isNaN(pub) ? new Date().toISOString() : pub.toISOString() };
  }).filter(n => n.titulo && n.link && RELEVANT.test(n.titulo + ' ' + n.resumen));
}

async function ogImage(url) {
  if (/news\.google\.com/.test(url)) return '';
  const html = await get(url, 8000);
  const m = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/i)
         || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/i);
  return m && /^https?:/.test(m[1]) ? decode(m[1]) : '';
}

const actual = JSON.parse(await readFile(FILE, 'utf8').catch(() => '{"noticias":[]}'));
const mapa = new Map(actual.noticias.map(n => [keyOf(n.titulo), n]));
const antes = mapa.size;

for (const q of QUERIES) {
  const bing = await get('https://www.bing.com/news/search?format=rss&setlang=es&cc=CO&q=' + encodeURIComponent(q));
  const goo = await get('https://news.google.com/rss/search?hl=es-419&gl=CO&ceid=CO:es-419&q=' + encodeURIComponent(q));
  for (const n of [...parse(bing, 'bing'), ...parse(goo, 'google')]) {
    const k = keyOf(n.titulo);
    if (!mapa.has(k)) mapa.set(k, n);
    else if (!mapa.get(k).imagen && n.imagen) mapa.get(k).imagen = n.imagen;
  }
}

// Fotos reales: busca la imagen principal de las notas que aún no tienen
let intentos = 0;
for (const n of mapa.values()) {
  if (n.imagen || n.sinFoto || intentos >= 25) continue;
  intentos++;
  n.imagen = await ogImage(n.link);
  if (!n.imagen) n.sinFoto = true;
}

const noticias = [...mapa.values()].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, MAX);
const nuevas = mapa.size - antes;
const conFotoAntes = actual.noticias.filter(n => n.imagen).length;
const conFotoAhora = noticias.filter(n => n.imagen).length;

if (nuevas > 0 || conFotoAhora > conFotoAntes) {
  await writeFile(FILE, JSON.stringify({ revisado: new Date().toISOString(), noticias }, null, 2) + '\n');
  console.log(`Listo: ${nuevas} noticias nuevas, ${conFotoAhora} con foto.`);
} else {
  console.log('Sin noticias nuevas. No se cambia nada.');
}
