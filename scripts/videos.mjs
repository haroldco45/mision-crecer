// Robot de videos de Misión Crecer al Día — corre junto al robot de noticias cada 30 minutos.
// Busca videos reales en YouTube y guarda data/videos.json. Solo escribe si hay videos nuevos.
import { readFile, writeFile } from 'node:fs/promises';

const FILE = 'data/videos.json';
const QUERIES = ['Misión Crecer', 'Milagro Week', 'Milagro Week Nueva York', 'Misión Crecer vicepresidente Restrepo', 'Misión Crecer desde las regiones', 'MinAgricultura Misión Crecer'];
const RELEVANT = /misi[oó]n\s*crecer|milagro\s*week|week\s*milagro|milagroweek|semana milagro|crecer al 6|crecer 6/i;
const MAX = 60;

async function get(url) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept-Language': 'es-CO,es;q=0.9',
        'Cookie': 'CONSENT=YES+cb; SOCS=CAI'
      }
    });
    return r.ok ? await r.text() : '';
  } catch { return ''; } finally { clearTimeout(t); }
}

function* walk(o) {
  if (!o || typeof o !== 'object') return;
  if (o.videoRenderer) yield o.videoRenderer;
  for (const v of Object.values(o)) yield* walk(v);
}

const txt = x => x?.simpleText || (x?.runs || []).map(r => r.text).join('') || '';

async function buscar(q) {
  // sp=CAI%3D ordena por fecha de subida
  const html = await get('https://www.youtube.com/results?hl=es&gl=CO&sp=CAI%253D&search_query=' + encodeURIComponent(q));
  const m = html.match(/var ytInitialData = (\{[\s\S]*?\});<\/script>/) || html.match(/ytInitialData"\]\s*=\s*(\{[\s\S]*?\});/);
  if (!m) return [];
  let data; try { data = JSON.parse(m[1]); } catch { return []; }
  const out = [];
  for (const v of walk(data)) {
    const titulo = txt(v.title);
    const desc = (v.detailedMetadataSnippets || []).map(s => txt(s.snippetText)).join(' ');
    if (!v.videoId || !RELEVANT.test(titulo + ' ' + desc)) continue;
    out.push({
      id: v.videoId,
      titulo,
      canal: txt(v.ownerText) || txt(v.longBylineText),
      publicado: txt(v.publishedTimeText),
      duracion: txt(v.lengthText),
      imagen: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`
    });
  }
  return out;
}

const actual = JSON.parse(await readFile(FILE, 'utf8').catch(() => '{"videos":[]}'));
const mapa = new Map(actual.videos.map(v => [v.id, v]));
const antes = mapa.size;
const ahora = new Date().toISOString();

for (const q of QUERIES) {
  for (const v of await buscar(q)) {
    if (mapa.has(v.id)) { Object.assign(mapa.get(v.id), { publicado: v.publicado || mapa.get(v.id).publicado }); continue; }
    // La primera carga no se marca como "nueva"; desde ahí cada video lleva la hora en que apareció
    mapa.set(v.id, { ...v, visto: antes === 0 ? null : ahora });
  }
}

const nuevos = mapa.size - antes;
if (nuevos > 0) {
  const videos = [...mapa.values()].sort((a, b) => (b.visto ? Date.parse(b.visto) : 0) - (a.visto ? Date.parse(a.visto) : 0)).slice(0, MAX);
  await writeFile(FILE, JSON.stringify({ revisado: ahora, videos }, null, 2) + '\n');
  console.log(`Listo: ${nuevos} videos nuevos (${videos.length} en total).`);
} else {
  console.log(`Sin videos nuevos (${mapa.size} guardados).`);
}
