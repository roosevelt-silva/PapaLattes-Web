'use strict';

const DEFAULT_FILES = {
  qualis: 'data/qualis_periodicos.csv',
  sjr: 'data/sjr.csv',
  jcr: 'data/jcr_2026.csv',
  events: 'data/qualis_eventos.csv',
  articleWeights: 'data/pesos_artigos.csv',
  generalWeights: 'data/pesos_producao_geral.csv',
  fellows: 'data/bolsistas_produtividade.csv'
};

const state = {
  overrides: {},
  defaultTexts: {},
  results: null,
  activeTab: 'total',
  selectedResearcher: 'ALL',
  profileResearcher: '',
  profileView: 'INDIVIDUAL',
  downloadUrl: '',
  logLines: []
};

const $ = (id) => document.getElementById(id);
const els = {};

function cacheElements() {
  [
    'yearStart', 'yearEnd', 'scoreMode', 'lattesFiles', 'dropZone',
    'fileSummary', 'toggleRefs', 'referencePanel', 'qualisFile', 'sjrFile', 'jcrFile',
    'eventsFile', 'articleWeightsFile', 'generalWeightsFile', 'fellowsFile',
    'processBtn', 'downloadLink', 'downloadLinkResults', 'progressSection', 'progressLabel',
    'progressPercent', 'progressBar', 'logBox', 'resultsSection', 'summaryCards',
    'resultsMeta', 'rankingChart', 'annualChart', 'productionMixChart',
    'qualityCapesChart', 'qualityMetricPanel', 'qualityMetricTitle', 'qualityMetricDescription', 'qualityMetricChart',
    'qualityJcrQuartilePanel', 'qualityJcrQuartileChart',
    'scatterChart', 'concentrationPanel', 'journalsChart', 'collaborationChart',
    'researcherProfile', 'profileResearcher', 'profileResearcherLabel', 'profileAnalysisMode',
    'individualProfilePanels', 'comparisonProfilePanels', 'profileAnnualChart', 'profileProductionMixChart',
    'profileQualityCapesChart', 'profileQualityMetricPanel', 'profileQualityMetricTitle', 'profileQualityMetricChart',
    'profileTopArticlesChart', 'comparisonSummary', 'top10ScoreChart', 'top10AverageChart',
    'top10CapesChart', 'top10MetricPanel', 'top10MetricTitle', 'top10MetricChart',
    'tabControls', 'tableContainer'
  ].forEach((id) => { els[id] = $(id); });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeHeader(value) {
  return normalizeText(value).replaceAll(' ', '');
}

function normalizeIssn(value) {
  return String(value ?? '').toUpperCase().replace(/[^0-9X]/g, '');
}

function safeFileName(value) {
  return String(value ?? 'arquivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNumber(value, fallback = 0) {
  const text = String(value ?? '').trim();
  if (!text) return fallback;
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : fallback;
}

function formatNumber(value, decimals = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value ?? '');
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: Number.isInteger(number) ? 0 : Math.min(1, decimals)
  }).format(number);
}

function scoreModeLabel(value) {
  return {
    MELHOR: 'MELHOR — CAPES + SJR',
    MELHOR_JCR: 'MELHOR — CAPES + JCR',
    CAPES: 'Somente CAPES',
    SJR: 'Somente SJR',
    JCR: 'Somente JCR'
  }[value] || String(value ?? '');
}

function setProgress(percent, label) {
  const bounded = Math.max(0, Math.min(100, Math.round(percent)));
  els.progressBar.style.width = `${bounded}%`;
  els.progressPercent.textContent = `${bounded}%`;
  if (label) els.progressLabel.textContent = label;
}

function log(message) {
  const stamp = new Date().toLocaleTimeString('pt-BR', { hour12: false });
  state.logLines.push(`[${stamp}] ${message}`);
  els.logBox.textContent = state.logLines.join('\n');
  els.logBox.scrollTop = els.logBox.scrollHeight;
}

function resetProgress() {
  state.logLines = [];
  els.logBox.textContent = '';
  setProgress(0, 'Preparando...');
  els.progressSection.classList.remove('hidden');
}

function detectDelimiter(text) {
  const firstLine = String(text).replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] || '';
  let comma = 0;
  let semicolon = 0;
  let quoted = false;
  for (let i = 0; i < firstLine.length; i += 1) {
    const ch = firstLine[i];
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch === ',') comma += 1;
    else if (!quoted && ch === ';') semicolon += 1;
  }
  return semicolon >= comma ? ';' : ',';
}

function parseCsv(text, delimiter = null) {
  const source = String(text ?? '').replace(/^\uFEFF/, '');
  const sep = delimiter || detectDelimiter(source);
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === sep) {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field.replace(/\r$/, ''));
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  row.push(field.replace(/\r$/, ''));
  if (row.some((cell) => cell !== '')) rows.push(row);
  if (!rows.length) return { headers: [], rows: [] };

  const headers = rows[0].map((header) => String(header).trim());
  const objects = rows.slice(1).map((cells) => {
    const object = {};
    headers.forEach((header, index) => { object[header] = cells[index] ?? ''; });
    return object;
  });
  return { headers, rows: objects };
}

function findColumn(headers, candidates, required = true) {
  const map = new Map(headers.map((header) => [normalizeHeader(header), header]));
  for (const candidate of candidates) {
    const found = map.get(normalizeHeader(candidate));
    if (found) return found;
  }
  if (required) throw new Error(`Coluna não encontrada: ${candidates.join(' / ')}`);
  return null;
}

async function readFileAsText(file) {
  return file.text();
}

async function getReferenceText(key) {
  const override = state.overrides[key];
  if (override) return readFileAsText(override);
  if (state.defaultTexts[key]) return state.defaultTexts[key];

  // Em páginas hospedadas, lê primeiro o CSV da pasta data/. Assim, uma
  // atualização publicada no GitHub passa a valer sem recompilar o projeto.
  if (window.location.protocol !== 'file:') {
    try {
      const response = await fetch(DEFAULT_FILES[key], { cache: 'no-store' });
      if (response.ok) {
        const text = await response.text();
        state.defaultTexts[key] = text;
        return text;
      }
    } catch (error) {
      console.warn(`Falha ao carregar ${DEFAULT_FILES[key]} pelo site; usando cópia integrada.`, error);
    }
  }

  // Ao abrir index.html por duplo clique (file://), navegadores bloqueiam fetch
  // de arquivos locais. A cópia integrada evita que o usuário precise indicar
  // manualmente cada tabela ou iniciar um servidor local.
  const embedded = window.PAPALATTES_REFERENCE_DATA?.[key];
  if (typeof embedded === 'string') {
    state.defaultTexts[key] = embedded;
    return embedded;
  }

  throw new Error(
    `Não foi possível carregar ${DEFAULT_FILES[key]}. ` +
    'Verifique se js/reference-data.js está junto do projeto.'
  );
}

function markReferenceStatus(key, mode = 'ready') {
  const dot = document.querySelector(`[data-ref-status="${key}"]`);
  if (!dot) return;
  dot.classList.remove('ready', 'override');
  dot.classList.add(mode);
  dot.title = mode === 'override' ? 'Arquivo selecionado pelo usuário' : (window.location.protocol === 'file:' ? 'Tabela padrão integrada ao projeto' : 'Arquivo padrão do site');
}

function bindReferenceInput(element, key) {
  element.addEventListener('change', () => {
    if (element.files?.[0]) {
      state.overrides[key] = element.files[0];
      markReferenceStatus(key, 'override');
    } else {
      delete state.overrides[key];
      markReferenceStatus(key, 'ready');
    }
  });
}

// -----------------------------------------------------------------------------
// Leitura e escrita de ZIP sem bibliotecas externas
// -----------------------------------------------------------------------------

function u16(view, offset) { return view.getUint16(offset, true); }
function u32(view, offset) { return view.getUint32(offset, true); }

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Este navegador não oferece descompactação ZIP. Use uma versão recente do Chrome, Edge, Firefox ou Safari.');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readZipEntries(inputBytes) {
  const bytes = inputBytes instanceof Uint8Array ? inputBytes : new Uint8Array(inputBytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minOffset = Math.max(0, bytes.length - 65557);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= minOffset; i -= 1) {
    if (u32(view, i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Arquivo ZIP inválido: diretório central não encontrado.');

  const totalEntries = u16(view, eocd + 10);
  const centralOffset = u32(view, eocd + 16);
  const decoderUtf8 = new TextDecoder('utf-8');
  const decoderLatin = new TextDecoder('iso-8859-1');
  const entries = [];
  let offset = centralOffset;
  let totalExpanded = 0;

  for (let index = 0; index < totalEntries; index += 1) {
    if (u32(view, offset) !== 0x02014b50) throw new Error('ZIP inválido: entrada do diretório central corrompida.');
    const flags = u16(view, offset + 8);
    const method = u16(view, offset + 10);
    const compressedSize = u32(view, offset + 20);
    const uncompressedSize = u32(view, offset + 24);
    const nameLength = u16(view, offset + 28);
    const extraLength = u16(view, offset + 30);
    const commentLength = u16(view, offset + 32);
    const localOffset = u32(view, offset + 42);
    const nameBytes = bytes.slice(offset + 46, offset + 46 + nameLength);
    const name = (flags & 0x0800 ? decoderUtf8 : decoderLatin).decode(nameBytes);

    if (!name.endsWith('/')) {
      if (u32(view, localOffset) !== 0x04034b50) throw new Error(`ZIP inválido na entrada ${name}.`);
      const localNameLength = u16(view, localOffset + 26);
      const localExtraLength = u16(view, localOffset + 28);
      const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.slice(dataOffset, dataOffset + compressedSize);
      let data;
      if (method === 0) data = compressed;
      else if (method === 8) data = await inflateRaw(compressed);
      else throw new Error(`Método de compactação não suportado (${method}) em ${name}.`);
      if (uncompressedSize && data.length !== uncompressedSize) {
        throw new Error(`Tamanho descompactado inesperado em ${name}.`);
      }
      totalExpanded += data.length;
      if (totalExpanded > 600 * 1024 * 1024) throw new Error('O conjunto ZIP ultrapassa o limite de segurança de 600 MB descompactados.');
      entries.push({ name, data });
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function concatBytes(parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
}

function zipStore(entries) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  const now = new Date();
  const dosTime = ((now.getHours() & 31) << 11) | ((now.getMinutes() & 63) << 5) | ((Math.floor(now.getSeconds() / 2)) & 31);
  const dosDate = (((now.getFullYear() - 1980) & 127) << 9) | (((now.getMonth() + 1) & 15) << 5) | (now.getDate() & 31);

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name.replaceAll('\\', '/'));
    const data = typeof entry.data === 'string' ? encoder.encode(entry.data) : new Uint8Array(entry.data);
    const crc = crc32(data);

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    localParts.push(local, data);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, localOffset, true);
    central.set(nameBytes, 46);
    centralParts.push(central);
    localOffset += local.length + data.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralDirectory.length, true);
  ev.setUint32(16, localOffset, true);
  ev.setUint16(20, 0, true);
  return concatBytes([...localParts, centralDirectory, eocd]);
}

function decodeXmlBytes(bytes) {
  const head = new TextDecoder('ascii').decode(bytes.slice(0, 160));
  const encodingMatch = head.match(/encoding=["']([^"']+)["']/i);
  const declared = (encodingMatch?.[1] || 'ISO-8859-1').toLowerCase();
  const encoding = declared.includes('utf') ? 'utf-8' : 'iso-8859-1';
  return new TextDecoder(encoding).decode(bytes);
}

async function extractXmlFromZip(bytes, sourceName, depth = 0) {
  if (depth > 3) throw new Error(`Muitos níveis de ZIP em ${sourceName}.`);
  const entries = await readZipEntries(bytes);
  const documents = [];
  for (const entry of entries) {
    const lower = entry.name.toLowerCase();
    if (lower.endsWith('.xml')) {
      documents.push({ source: `${sourceName}/${entry.name}`, xmlText: decodeXmlBytes(entry.data) });
    } else if (lower.endsWith('.zip')) {
      const nested = await extractXmlFromZip(entry.data, `${sourceName}/${entry.name}`, depth + 1);
      documents.push(...nested);
    }
    if (documents.length > 1500) throw new Error('Mais de 1.500 currículos encontrados; divida a análise em lotes.');
  }
  return documents;
}

async function loadCurricula(files) {
  const documents = [];
  for (const file of files) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.xml')) {
      documents.push({ source: file.name, xmlText: decodeXmlBytes(new Uint8Array(await file.arrayBuffer())) });
    } else if (lower.endsWith('.zip')) {
      documents.push(...await extractXmlFromZip(new Uint8Array(await file.arrayBuffer()), file.name));
    }
  }
  return documents;
}

// -----------------------------------------------------------------------------
// Preparação das tabelas de referência
// -----------------------------------------------------------------------------

function quantileType7(sorted, probability) {
  if (!sorted.length) return 0;
  if (probability <= 0) return sorted[0];
  if (probability >= 1) return sorted[sorted.length - 1];
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const fraction = position - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * fraction;
}

async function prepareReferences() {
  log('Carregando tabelas de referência...');
  const keys = ['articleWeights', 'generalWeights', 'qualis', 'events', 'fellows', 'sjr', 'jcr'];
  const texts = {};
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    setProgress(5 + i * 5, `Carregando ${key}...`);
    texts[key] = await getReferenceText(key);
  }

  const articleParsed = parseCsv(texts.articleWeights);
  const articleCols = {
    capes: findColumn(articleParsed.headers, ['TipoCAPES']),
    sjr: findColumn(articleParsed.headers, ['TipoSJR']),
    weight: findColumn(articleParsed.headers, ['Pesos', 'Peso']),
    max: findColumn(articleParsed.headers, ['Maximo', 'Máximo'], false)
  };
  const articleWeights = articleParsed.rows.map((row) => ({
    capes: String(row[articleCols.capes] ?? '').trim(),
    sjr: String(row[articleCols.sjr] ?? '').trim(),
    weight: parseNumber(row[articleCols.weight]),
    max: articleCols.max && String(row[articleCols.max] ?? '').trim() !== '' ? parseNumber(row[articleCols.max]) : null
  })).filter((row) => row.capes || row.sjr);
  if (articleWeights.length < 2) throw new Error('A tabela de pesos de artigos precisa ter pelo menos duas linhas.');

  const generalParsed = parseCsv(texts.generalWeights);
  const generalCols = {
    type: findColumn(generalParsed.headers, ['TIPOPRODUTO', 'Tipo', 'Produto']),
    weight: findColumn(generalParsed.headers, ['PESOS', 'Peso', 'Pesos']),
    max: findColumn(generalParsed.headers, ['MAXIMO', 'Máximo', 'Maximo'], false)
  };
  const generalWeights = generalParsed.rows.map((row) => ({
    type: String(row[generalCols.type] ?? '').trim(),
    weight: parseNumber(row[generalCols.weight]),
    max: generalCols.max && String(row[generalCols.max] ?? '').trim() !== '' ? parseNumber(row[generalCols.max]) : null
  })).filter((row) => row.type);
  const generalMap = new Map(generalWeights.map((row) => [row.type, row]));

  setProgress(38, 'Preparando Qualis CAPES...');
  const qualisParsed = parseCsv(texts.qualis);
  const qualisIssn = findColumn(qualisParsed.headers, ['ISSN']);
  const qualisStratum = findColumn(qualisParsed.headers, ['Estrato', 'Qualis']);
  const qualisMap = new Map();
  for (const row of qualisParsed.rows) {
    const issn = normalizeIssn(row[qualisIssn]);
    const stratum = String(row[qualisStratum] ?? '').trim();
    if (!issn || !stratum) continue;
    const previous = qualisMap.get(issn);
    if (!previous) qualisMap.set(issn, stratum);
    else {
      const oldWeight = articleWeights.find((item) => item.capes === previous)?.weight ?? -Infinity;
      const newWeight = articleWeights.find((item) => item.capes === stratum)?.weight ?? -Infinity;
      if (newWeight > oldWeight) qualisMap.set(issn, stratum);
    }
  }

  setProgress(44, 'Preparando Qualis de eventos...');
  const eventsParsed = parseCsv(texts.events);
  const eventTitle = findColumn(eventsParsed.headers, ['Conferencia', 'Conferência', 'Evento']);
  const eventQualis = findColumn(eventsParsed.headers, ['Qualis', 'Estrato']);
  const eventAcronym = findColumn(eventsParsed.headers, ['Siglas', 'Sigla'], false);
  const eventList = eventsParsed.rows.map((row) => ({
    title: String(row[eventTitle] ?? '').trim(),
    norm: normalizeText(row[eventTitle]),
    acronym: eventAcronym ? normalizeText(row[eventAcronym]).replaceAll(' ', '') : '',
    qualis: String(row[eventQualis] ?? '').trim()
  })).filter((row) => row.title && row.qualis);

  const fellowsParsed = parseCsv(texts.fellows);
  const fellowsId = findColumn(fellowsParsed.headers, ['IDLattes', 'ID Lattes', 'NumeroIdentificador'], false);
  const fellowsSet = new Set(fellowsId ? fellowsParsed.rows.map((row) => String(row[fellowsId] ?? '').replace(/\D/g, '')).filter(Boolean) : []);

  setProgress(48, 'Lendo e indexando a tabela SJR...');
  const sjrParsed = parseCsv(texts.sjr);
  const sjrType = findColumn(sjrParsed.headers, ['Type', 'Tipo']);
  const sjrIssn = findColumn(sjrParsed.headers, ['Issn', 'ISSN']);
  const sjrValue = findColumn(sjrParsed.headers, ['SJR']);
  const sjrMap = new Map();
  const sjrValues = [];
  for (const row of sjrParsed.rows) {
    if (String(row[sjrType] ?? '').trim().toLowerCase() !== 'journal') continue;
    const value = parseNumber(row[sjrValue], -99);
    if (value >= 0) sjrValues.push(value);
    for (const rawIssn of String(row[sjrIssn] ?? '').split(',')) {
      const issn = normalizeIssn(rawIssn);
      if (issn) sjrMap.set(issn, value);
    }
  }
  sjrValues.sort((a, b) => a - b);

  const intervalCount = articleWeights.length - 1;
  const sjrBounds = [0];
  for (let k = 1; k <= intervalCount; k += 1) sjrBounds.push(quantileType7(sjrValues, k / intervalCount));
  const sjrPercentiles = articleWeights.slice(1).map((row, index) => ({
    TipoSJR: row.sjr,
    SJRmin: sjrBounds[index],
    SJRmax: sjrBounds[index + 1],
    Pesos: row.weight
  }));

  setProgress(54, 'Lendo e indexando a tabela JCR...');
  const jcrParsed = parseCsv(texts.jcr);
  const jcrIssn = findColumn(jcrParsed.headers, ['ISSN']);
  const jcrEissn = findColumn(jcrParsed.headers, ['eISSN', 'EISSN', 'ISSNOnline'], false);
  const jcrJif = findColumn(jcrParsed.headers, ['JIF_2025', 'JIF', 'JCR', 'FatorImpacto', 'ImpactFactor']);
  const jcrQuartile = findColumn(jcrParsed.headers, ['QuartilMelhor', 'Quartil', 'JCRQuartil'], false);
  const jcrCategories = findColumn(jcrParsed.headers, ['Categorias', 'Categoria', 'WosCategorias'], false);
  const jcrTitle = findColumn(jcrParsed.headers, ['Titulo', 'Título', 'Title', 'Journal'], false);
  const jcrMap = new Map();
  const jcrValues = [];
  const jcrSeenJournals = new Set();
  for (const row of jcrParsed.rows) {
    const value = parseNumber(row[jcrJif], -99);
    const identifiers = [row[jcrIssn], jcrEissn ? row[jcrEissn] : '']
      .map(normalizeIssn).filter((value, index, array) => value && array.indexOf(value) === index);
    if (!identifiers.length) continue;
    const record = {
      value,
      quartile: jcrQuartile ? String(row[jcrQuartile] ?? '').trim() || 'N/A' : 'N/A',
      categories: jcrCategories ? String(row[jcrCategories] ?? '').trim() : '',
      title: jcrTitle ? String(row[jcrTitle] ?? '').trim() : ''
    };
    identifiers.forEach((issn) => {
      const previous = jcrMap.get(issn);
      if (!previous || value > previous.value) jcrMap.set(issn, record);
    });
    const journalKey = identifiers.sort().join('|');
    if (value >= 0 && !jcrSeenJournals.has(journalKey)) {
      jcrValues.push(value);
      jcrSeenJournals.add(journalKey);
    }
  }
  jcrValues.sort((a, b) => a - b);
  const jcrBounds = [0];
  for (let k = 1; k <= intervalCount; k += 1) jcrBounds.push(quantileType7(jcrValues, k / intervalCount));
  const jcrPercentiles = articleWeights.slice(1).map((row, index) => ({
    TipoJCR: row.sjr,
    JCRmin: jcrBounds[index],
    JCRmax: jcrBounds[index + 1],
    Pesos: row.weight
  }));

  log(`Referências prontas: ${qualisMap.size.toLocaleString('pt-BR')} ISSNs CAPES, ${sjrMap.size.toLocaleString('pt-BR')} ISSNs SJR e ${jcrMap.size.toLocaleString('pt-BR')} identificadores JCR.`);
  return {
    articleWeights, generalWeights, generalMap, qualisMap, eventList, fellowsSet,
    sjrMap, sjrValues, percentiles: sjrPercentiles, sjrPercentiles,
    jcrMap, jcrValues, jcrPercentiles
  };
}

// -----------------------------------------------------------------------------
// Extração, pontuação e análises dos currículos Lattes — regras corrigidas
// -----------------------------------------------------------------------------

const PRODUCT_LABELS = {
  Artigos: 'Artigos', Livros: 'Livros', CapLivros: 'Capítulos de livros',
  ResumoSimples: 'Resumos simples', ResumoExpandido: 'Resumos expandidos',
  TrabCompleto: 'Trabalhos completos', SoftwaresReg: 'Softwares registrados',
  SoftwaresSemReg: 'Softwares sem registro', Patentes: 'Patentes',
  CultivarProt: 'Cultivares protegidas', CultivarReg: 'Cultivares registradas',
  Maquetes: 'Maquetes', MapasCartas: 'Mapas e cartas', OutrosTrabTec: 'Outros trabalhos técnicos',
  OrientMestConc: 'Orientações de mestrado concluídas', CoOrientMestConc: 'Coorientações de mestrado concluídas',
  OrientDoutConc: 'Orientações de doutorado concluídas', CoOrientDoutConc: 'Coorientações de doutorado concluídas',
  OrientPosDoutConc: 'Orientações de pós-doutorado concluídas', OrientICConc: 'Orientações de IC concluídas',
  OrientTCCConc: 'Orientações de TCC concluídas', OrientMonConc: 'Orientações de especialização concluídas',
  OrientICAnd: 'Orientações de IC em andamento', OrientTCCAnd: 'Orientações de TCC em andamento',
  OrientMonAnd: 'Orientações de especialização em andamento', OrientMestAnd: 'Orientações de mestrado em andamento',
  CoOrientMestAnd: 'Coorientações de mestrado em andamento', OrientDoutAnd: 'Orientações de doutorado em andamento',
  CoOrientDoutAnd: 'Coorientações de doutorado em andamento', OrientPosDoutAnd: 'Orientações de pós-doutorado em andamento',
  BancaMonogEsp: 'Bancas de especialização', BancaTCC: 'Bancas de graduação',
  BancaMestrado: 'Bancas de mestrado', BancaDout: 'Bancas de doutorado',
  ProdArtesVisuais: 'Produção em artes visuais', ProdArtesCenicas: 'Produção em artes cênicas',
  ProdMusicas: 'Produção musical', ProdutividadeCNPq: 'Produtividade CNPq'
};

const CHART_COLORS = ['#1557a0', '#2f7cc1', '#19704a', '#d58b1d', '#6c5bb5', '#9d4d7c'];

function allByTag(root, tag) { return Array.from(root.getElementsByTagName(tag)); }
function directChild(element, tag) {
  if (!element) return null;
  return Array.from(element.children).find((child) => child.tagName === tag) || null;
}
function yearIn(element, attribute, start, end) {
  if (!element) return false;
  const year = Number(element.getAttribute(attribute));
  return Number.isFinite(year) && year >= start && year <= end;
}
function countTagYear(root, tag, attribute, start, end, predicate = null) {
  return allByTag(root, tag).filter((element) => yearIn(element, attribute, start, end) && (!predicate || predicate(element))).length;
}
function blankYears(start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) => ({
    Ano: start + index, Artigos: 0, Livros: 0, CapLivros: 0, TrabCompleto: 0,
    OrientacoesConcluidas: 0, OrientacoesAndamento: 0, Bancas: 0, ProducaoTecnicaInovacao: 0
  }));
}
function incrementYear(rows, year, field, amount = 1) {
  const row = rows.find((item) => item.Ano === Number(year));
  if (row) row[field] += amount;
}
function countElementsByYear(doc, tags, attribute, start, end, field, rows, predicate = null) {
  for (const tag of tags) {
    for (const element of allByTag(doc, tag)) {
      const year = Number(element.getAttribute(attribute));
      if (year >= start && year <= end && (!predicate || predicate(element))) incrementYear(rows, year, field);
    }
  }
}

function getGeneralPoints(refs, type, quantity) {
  const rule = refs.generalMap.get(type);
  if (!rule || quantity <= 0) return 0;
  const points = rule.weight * quantity;
  return rule.max == null ? points : Math.min(points, rule.max);
}

function articleRowForWeight(refs, weight) {
  return refs.articleWeights.findIndex((row) => row.weight === weight);
}

function applyArticleCap(refs, accumulated, weight) {
  const index = articleRowForWeight(refs, weight);
  const safeIndex = index >= 0 ? index : 0;
  const rule = refs.articleWeights[safeIndex];
  if (rule.max != null && accumulated[safeIndex] + weight > rule.max) return 0;
  accumulated[safeIndex] += weight;
  return weight;
}

function noIndexWeight(refs, doi) {
  if (String(doi ?? '').trim()) {
    return refs.articleWeights.find((row) => row.sjr === 'ArtigoCOMDOI')?.weight
      ?? refs.articleWeights.find((row) => row.capes === 'ArtigoCOMDOI')?.weight
      ?? refs.articleWeights[0].weight;
  }
  return refs.articleWeights.find((row) => row.sjr === 'ArtigoSEMDOI')?.weight ?? refs.articleWeights[0].weight;
}

function sjrBand(refs, value) {
  for (let i = 0; i < refs.sjrPercentiles.length; i += 1) {
    const row = refs.sjrPercentiles[i];
    const isLast = i === refs.sjrPercentiles.length - 1;
    if (value >= row.SJRmin && (value < row.SJRmax || (isLast && value <= row.SJRmax))) return row;
  }
  return refs.sjrPercentiles.at(-1) || { TipoSJR: 'SemSJR', Pesos: refs.articleWeights.at(-1).weight };
}

function jcrBand(refs, value) {
  for (let i = 0; i < refs.jcrPercentiles.length; i += 1) {
    const row = refs.jcrPercentiles[i];
    const isLast = i === refs.jcrPercentiles.length - 1;
    if (value >= row.JCRmin && (value < row.JCRmax || (isLast && value <= row.JCRmax))) return row;
  }
  return refs.jcrPercentiles.at(-1) || { TipoJCR: 'SemJCR', Pesos: refs.articleWeights.at(-1).weight };
}

function scoreArticles(doc, researcherName, start, end, scoreMode, refs) {
  const accumulated = new Array(refs.articleWeights.length).fill(0);
  const rows = [];
  for (const article of allByTag(doc, 'ARTIGO-PUBLICADO')) {
    const basic = directChild(article, 'DADOS-BASICOS-DO-ARTIGO');
    const detail = directChild(article, 'DETALHAMENTO-DO-ARTIGO');
    if (!basic || !detail || !yearIn(basic, 'ANO-DO-ARTIGO', start, end)) continue;

    const issn = normalizeIssn(detail.getAttribute('ISSN'));
    const doi = String(basic.getAttribute('DOI') || '').trim();
    const title = basic.getAttribute('TITULO-DO-ARTIGO') || '';
    const journal = detail.getAttribute('TITULO-DO-PERIODICO-OU-REVISTA') || '';
    const qualis = refs.qualisMap.get(issn) || 'SemQualis';
    const capesWeight = refs.articleWeights.find((row) => row.capes === qualis)?.weight ?? noIndexWeight(refs, doi);
    const sjrValue = refs.sjrMap.has(issn) ? refs.sjrMap.get(issn) : -99;
    const band = sjrValue >= 0 ? sjrBand(refs, sjrValue) : null;
    const sjrPoints = band ? band.Pesos : noIndexWeight(refs, doi);

    const jcrRecord = refs.jcrMap.get(issn) || null;
    const jcrValue = jcrRecord && jcrRecord.value >= 0 ? jcrRecord.value : -99;
    const jcrMetricBand = jcrValue >= 0 ? jcrBand(refs, jcrValue) : null;
    const jcrPoints = jcrMetricBand ? jcrMetricBand.Pesos : noIndexWeight(refs, doi);

    let rawWeight;
    let source;
    if (scoreMode === 'CAPES') { rawWeight = capesWeight; source = 'CAPES'; }
    else if (scoreMode === 'SJR') { rawWeight = sjrPoints; source = 'SJR'; }
    else if (scoreMode === 'JCR') { rawWeight = jcrPoints; source = 'JCR'; }
    else if (scoreMode === 'MELHOR_JCR') {
      if (jcrPoints > capesWeight) { rawWeight = jcrPoints; source = 'JCR'; }
      else { rawWeight = capesWeight; source = 'CAPES'; }
    } else if (sjrPoints > capesWeight) { rawWeight = sjrPoints; source = 'SJR'; }
    else { rawWeight = capesWeight; source = 'CAPES'; }

    const authors = allByTag(article, 'AUTORES')
      .map((author) => author.getAttribute('NOME-COMPLETO-DO-AUTOR') || author.getAttribute('NOME-PARA-CITACAO'))
      .filter(Boolean);
    const awarded = applyArticleCap(refs, accumulated, rawWeight);
    rows.push({
      Nome: researcherName,
      Titulo: title,
      Periodico: journal,
      ISSN: issn,
      DOI: doi,
      QualisCAPES: qualis,
      SJR: sjrValue >= 0 ? sjrValue : 'SemSJR',
      FaixaSJR: band?.TipoSJR || 'SemSJR',
      JCR: jcrValue >= 0 ? jcrValue : 'SemJCR',
      FaixaJCR: jcrMetricBand?.TipoJCR || 'SemJCR',
      QuartilJCR: jcrRecord?.quartile || 'N/A',
      CategoriasJCR: jcrRecord?.categories || '',
      Ano: Number(basic.getAttribute('ANO-DO-ARTIGO')),
      PesoBruto: rawWeight,
      Peso: awarded,
      FontePontuacao: source,
      NumeroAutores: authors.length,
      Autores: authors.join('; ')
    });
  }
  return rows;
}

function reduceEventNameRStyle(name) {
  let current = String(name ?? '');
  const separators = ['Proceedings of the ', ' - ', '(', ' '];
  for (const separator of separators) {
    if (!current.includes(separator)) continue;
    const parts = current.split(separator);
    const first = parts[0] || '';
    const second = separator === ' ' ? parts.slice(1).join(' ') : (parts[1] || '');
    current = second.length >= first.length ? second : first;
  }
  return current.trim();
}

function levenshteinRatio(a, b) {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  const previous = Array.from({ length: shorter.length + 1 }, (_, i) => i);
  const current = new Array(shorter.length + 1);
  for (let i = 1; i <= longer.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= shorter.length; j += 1) {
      const cost = longer[i - 1] === shorter[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    for (let j = 0; j <= shorter.length; j += 1) previous[j] = current[j];
  }
  return 1 - previous[shorter.length] / longer.length;
}

function tokenSimilarity(a, b) {
  const aSet = new Set(a.split(' ').filter((token) => token.length > 2));
  const bSet = new Set(b.split(' ').filter((token) => token.length > 2));
  if (!aSet.size || !bSet.size) return 0;
  let intersection = 0;
  for (const token of aSet) if (bSet.has(token)) intersection += 1;
  return intersection / new Set([...aSet, ...bSet]).size;
}

function matchEvent(eventName, refs) {
  const original = normalizeText(eventName);
  const reduced = normalizeText(reduceEventNameRStyle(eventName));
  const words = original.split(' ');
  const acronymCandidates = words.filter((word) => /^[A-Z0-9]{3,12}$/.test(word.replace(/[^A-Z0-9]/g, '')));
  let best = null;
  let bestScore = 0;
  for (const event of refs.eventList) {
    if (event.norm === original || event.norm === reduced) return event;
    if (event.norm.includes(reduced) || reduced.includes(event.norm)) return event;
    if (event.acronym && acronymCandidates.includes(event.acronym)) {
      const score = 0.85 + 0.15 * tokenSimilarity(original, event.norm);
      if (score > bestScore) { best = event; bestScore = score; }
      continue;
    }
    const tokenScore = Math.max(tokenSimilarity(original, event.norm), tokenSimilarity(reduced, event.norm));
    if (tokenScore < 0.35) continue;
    const editScore = Math.max(levenshteinRatio(original, event.norm), levenshteinRatio(reduced, event.norm));
    const score = tokenScore * 0.62 + editScore * 0.38;
    if (score > bestScore) { best = event; bestScore = score; }
  }
  return bestScore >= 0.66 ? best : null;
}

function scoreCompleteEvents(doc, start, end, refs) {
  const accumulated = new Array(refs.articleWeights.length).fill(0);
  const rows = [];
  for (const work of allByTag(doc, 'TRABALHO-EM-EVENTOS')) {
    const basic = directChild(work, 'DADOS-BASICOS-DO-TRABALHO');
    const detail = directChild(work, 'DETALHAMENTO-DO-TRABALHO');
    if (!basic || !detail || basic.getAttribute('NATUREZA') !== 'COMPLETO' || !yearIn(basic, 'ANO-DO-TRABALHO', start, end)) continue;
    const eventName = detail.getAttribute('NOME-DO-EVENTO') || '';
    const matched = matchEvent(eventName, refs);
    const qualis = matched?.qualis || refs.articleWeights[0].capes;
    const weight = refs.articleWeights.find((row) => row.capes === qualis)?.weight ?? refs.articleWeights[0].weight;
    const awarded = applyArticleCap(refs, accumulated, weight);
    rows.push({ NomeEvento: eventName, QualisCAPES: qualis, Ano: Number(basic.getAttribute('ANO-DO-TRABALHO')), Peso: awarded });
  }
  return rows;
}

function countProductions(doc, start, end, idLattes, refs) {
  const counts = {};
  counts.Artigos = countTagYear(doc, 'DADOS-BASICOS-DO-ARTIGO', 'ANO-DO-ARTIGO', start, end);
  counts.Livros = countTagYear(doc, 'DADOS-BASICOS-DO-LIVRO', 'ANO', start, end);
  counts.CapLivros = countTagYear(doc, 'DADOS-BASICOS-DO-CAPITULO', 'ANO', start, end);

  const eventBasics = allByTag(doc, 'DADOS-BASICOS-DO-TRABALHO').filter((element) => yearIn(element, 'ANO-DO-TRABALHO', start, end));
  counts.ResumoSimples = eventBasics.filter((element) => element.getAttribute('NATUREZA') === 'RESUMO').length;
  counts.ResumoExpandido = eventBasics.filter((element) => element.getAttribute('NATUREZA') === 'RESUMO_EXPANDIDO').length;
  counts.TrabCompleto = eventBasics.filter((element) => element.getAttribute('NATUREZA') === 'COMPLETO').length;

  let registered = 0;
  let unregistered = 0;
  for (const software of allByTag(doc, 'SOFTWARE')) {
    const basic = directChild(software, 'DADOS-BASICOS-DO-SOFTWARE');
    if (!yearIn(basic, 'ANO', start, end)) continue;
    const detail = directChild(software, 'DETALHAMENTO-DO-SOFTWARE');
    const hasRegistration = allByTag(software, 'REGISTRO-OU-PATENTE').length > 0 || (detail && detail.attributes.length !== 6);
    if (hasRegistration) registered += 1;
    else unregistered += 1;
  }
  counts.SoftwaresReg = registered;
  counts.SoftwaresSemReg = unregistered;

  counts.Patentes = allByTag(doc, 'PATENTE').filter((patent) => {
    const basic = directChild(patent, 'DADOS-BASICOS-DA-PATENTE');
    const registration = allByTag(patent, 'REGISTRO-OU-PATENTE')[0];
    return yearIn(basic, 'ANO-DESENVOLVIMENTO', start, end) && Boolean(registration?.getAttribute('DATA-DE-CONCESSAO'));
  }).length;

  counts.CultivarProt = allByTag(doc, 'CULTIVAR-PROTEGIDA').filter((item) => yearIn(directChild(item, 'DADOS-BASICOS-DA-CULTIVAR'), 'ANO', start, end)).length;
  counts.CultivarReg = allByTag(doc, 'CULTIVAR-REGISTRADA').filter((item) => yearIn(directChild(item, 'DADOS-BASICOS-DA-CULTIVAR'), 'ANO', start, end)).length;
  counts.Maquetes = countTagYear(doc, 'DADOS-BASICOS-DE-MAQUETES', 'ANO', start, end);
  counts.MapasCartas = countTagYear(doc, 'DADOS-BASICOS-DE-CARTA-MAPA-OU-SIMILAR', 'ANO', start, end);

  const otherTechnicalTags = [
    'DADOS-BASICOS-DA-APRESENTACAO-DE-TRABALHO', 'DADOS-BASICOS-DE-CURSOS-CURTA-DURACAO-MINISTRADO',
    'DADOS-BASICOS-DO-MATERIAL-DIDATICO-OU-INSTRUCIONAL', 'DADOS-BASICOS-DA-ORGANIZACAO-DE-EVENTO',
    'DADOS-BASICOS-DO-RELATORIO-DE-PESQUISA', 'DADOS-BASICOS-DE-EDITORACAO',
    'DADOS-BASICOS-DO-PROGRAMA-DE-RADIO-OU-TV', 'DADOS-BASICOS-DA-MIDIA-SOCIAL-WEBSITE-BLOG',
    'DADOS-BASICOS-DE-OUTRA-PRODUCAO-TECNICA', 'DADOS-BASICOS-DO-TRABALHO-TECNICO',
    'DADOS-BASICOS-DO-PROCESSOS-OU-TECNICAS'
  ];
  counts.OutrosTrabTec = otherTechnicalTags.reduce((sum, tag) => sum + countTagYear(doc, tag, 'ANO', start, end), 0);

  let orientMestConc = 0; let coOrientMestConc = 0;
  for (const item of allByTag(doc, 'ORIENTACOES-CONCLUIDAS-PARA-MESTRADO')) {
    const basic = directChild(item, 'DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO');
    const detail = directChild(item, 'DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO');
    if (!yearIn(basic, 'ANO', start, end)) continue;
    if (detail?.getAttribute('TIPO-DE-ORIENTACAO') === 'ORIENTADOR_PRINCIPAL') orientMestConc += 1;
    if (detail?.getAttribute('TIPO-DE-ORIENTACAO') === 'CO_ORIENTADOR') coOrientMestConc += 1;
  }
  counts.OrientMestConc = orientMestConc; counts.CoOrientMestConc = coOrientMestConc;

  let orientDoutConc = 0; let coOrientDoutConc = 0;
  for (const item of allByTag(doc, 'ORIENTACOES-CONCLUIDAS-PARA-DOUTORADO')) {
    const basic = directChild(item, 'DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-DOUTORADO');
    const detail = directChild(item, 'DETALHAMENTO-DE-ORIENTACOES-CONCLUIDAS-PARA-DOUTORADO');
    if (!yearIn(basic, 'ANO', start, end)) continue;
    if (detail?.getAttribute('TIPO-DE-ORIENTACAO') === 'ORIENTADOR_PRINCIPAL') orientDoutConc += 1;
    if (detail?.getAttribute('TIPO-DE-ORIENTACAO') === 'CO_ORIENTADOR') coOrientDoutConc += 1;
  }
  counts.OrientDoutConc = orientDoutConc; counts.CoOrientDoutConc = coOrientDoutConc;
  counts.OrientPosDoutConc = countTagYear(doc, 'DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-POS-DOUTORADO', 'ANO', start, end);

  const otherOrientations = allByTag(doc, 'DADOS-BASICOS-DE-OUTRAS-ORIENTACOES-CONCLUIDAS').filter((element) => yearIn(element, 'ANO', start, end));
  counts.OrientICConc = otherOrientations.filter((element) => element.getAttribute('NATUREZA') === 'INICIACAO_CIENTIFICA').length;
  counts.OrientTCCConc = otherOrientations.filter((element) => element.getAttribute('NATUREZA') === 'TRABALHO_DE_CONCLUSAO_DE_CURSO_GRADUACAO').length;
  counts.OrientMonConc = otherOrientations.filter((element) => element.getAttribute('NATUREZA') === 'MONOGRAFIA_DE_CONCLUSAO_DE_CURSO_APERFEICOAMENTO_E_ESPECIALIZACAO').length;

  counts.OrientICAnd = countTagYear(doc, 'DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-INICIACAO-CIENTIFICA', 'ANO', start, end,
    (element) => element.getAttribute('NATUREZA') === 'Iniciação Científica');
  const gradOngoing = allByTag(doc, 'DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-GRADUACAO').filter((element) => yearIn(element, 'ANO', start, end));
  counts.OrientTCCAnd = gradOngoing.filter((element) => element.getAttribute('NATUREZA') === 'Trabalho de conclusão de curso de graduação').length;
  counts.OrientMonAnd = gradOngoing.filter((element) => element.getAttribute('NATUREZA') === 'MONOGRAFIA_DE_CONCLUSAO_DE_CURSO_APERFEICOAMENTO_E_ESPECIALIZACAO').length;

  let orientMestAnd = 0; let coOrientMestAnd = 0;
  for (const item of allByTag(doc, 'ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO')) {
    const basic = directChild(item, 'DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO');
    const detail = directChild(item, 'DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO');
    if (!yearIn(basic, 'ANO', start, end)) continue;
    if (detail?.getAttribute('TIPO-DE-ORIENTACAO') === 'ORIENTADOR_PRINCIPAL') orientMestAnd += 1;
    if (detail?.getAttribute('TIPO-DE-ORIENTACAO') === 'CO_ORIENTADOR') coOrientMestAnd += 1;
  }
  counts.OrientMestAnd = orientMestAnd; counts.CoOrientMestAnd = coOrientMestAnd;

  let orientDoutAnd = 0; let coOrientDoutAnd = 0;
  for (const item of allByTag(doc, 'ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO')) {
    const basic = directChild(item, 'DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO');
    const detail = directChild(item, 'DETALHAMENTO-DA-ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO');
    if (!yearIn(basic, 'ANO', start, end)) continue;
    if (detail?.getAttribute('TIPO-DE-ORIENTACAO') === 'ORIENTADOR_PRINCIPAL') orientDoutAnd += 1;
    if (detail?.getAttribute('TIPO-DE-ORIENTACAO') === 'CO_ORIENTADOR') coOrientDoutAnd += 1;
  }
  counts.OrientDoutAnd = orientDoutAnd; counts.CoOrientDoutAnd = coOrientDoutAnd;
  counts.OrientPosDoutAnd = countTagYear(doc, 'DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-POS-DOUTORADO', 'ANO', start, end);

  counts.BancaMonogEsp = countTagYear(doc, 'DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-APERFEICOAMENTO-ESPECIALIZACAO', 'ANO', start, end, (element) => element.getAttribute('NATUREZA') === 'Curso de aperfeiçoamento/especialização');
  counts.BancaTCC = countTagYear(doc, 'DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-GRADUACAO', 'ANO', start, end, (element) => element.getAttribute('NATUREZA') === 'Graduação');
  counts.BancaMestrado = countTagYear(doc, 'DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-MESTRADO', 'ANO', start, end, (element) => element.getAttribute('NATUREZA') === 'Mestrado');
  counts.BancaDout = countTagYear(doc, 'DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-DOUTORADO', 'ANO', start, end, (element) => element.getAttribute('NATUREZA') === 'Doutorado');
  counts.ProdArtesVisuais = countTagYear(doc, 'DADOS-BASICOS-DE-ARTES-VISUAIS', 'ANO', start, end);
  counts.ProdArtesCenicas = countTagYear(doc, 'DADOS-BASICOS-DE-ARTES-CENICAS', 'ANO', start, end);
  counts.ProdMusicas = countTagYear(doc, 'DADOS-BASICOS-DE-MUSICA', 'ANO', start, end);
  counts.ProdutividadeCNPq = refs.fellowsSet.has(idLattes) ? 1 : 0;
  return counts;
}

function extractYearlyProfile(doc, start, end) {
  const rows = blankYears(start, end);
  countElementsByYear(doc, ['DADOS-BASICOS-DO-ARTIGO'], 'ANO-DO-ARTIGO', start, end, 'Artigos', rows);
  countElementsByYear(doc, ['DADOS-BASICOS-DO-LIVRO'], 'ANO', start, end, 'Livros', rows);
  countElementsByYear(doc, ['DADOS-BASICOS-DO-CAPITULO'], 'ANO', start, end, 'CapLivros', rows);
  countElementsByYear(doc, ['DADOS-BASICOS-DO-TRABALHO'], 'ANO-DO-TRABALHO', start, end, 'TrabCompleto', rows,
    (element) => element.getAttribute('NATUREZA') === 'COMPLETO');

  countElementsByYear(doc, [
    'DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-MESTRADO',
    'DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-DOUTORADO',
    'DADOS-BASICOS-DE-ORIENTACOES-CONCLUIDAS-PARA-POS-DOUTORADO',
    'DADOS-BASICOS-DE-OUTRAS-ORIENTACOES-CONCLUIDAS'
  ], 'ANO', start, end, 'OrientacoesConcluidas', rows);
  countElementsByYear(doc, [
    'DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-INICIACAO-CIENTIFICA',
    'DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-GRADUACAO',
    'DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-MESTRADO',
    'DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-DOUTORADO',
    'DADOS-BASICOS-DA-ORIENTACAO-EM-ANDAMENTO-DE-POS-DOUTORADO'
  ], 'ANO', start, end, 'OrientacoesAndamento', rows);
  countElementsByYear(doc, [
    'DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-APERFEICOAMENTO-ESPECIALIZACAO',
    'DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-GRADUACAO',
    'DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-MESTRADO',
    'DADOS-BASICOS-DA-PARTICIPACAO-EM-BANCA-DE-DOUTORADO'
  ], 'ANO', start, end, 'Bancas', rows);
  countElementsByYear(doc, [
    'DADOS-BASICOS-DO-SOFTWARE', 'DADOS-BASICOS-DA-PATENTE', 'DADOS-BASICOS-DA-CULTIVAR',
    'DADOS-BASICOS-DA-APRESENTACAO-DE-TRABALHO', 'DADOS-BASICOS-DE-CURSOS-CURTA-DURACAO-MINISTRADO',
    'DADOS-BASICOS-DO-MATERIAL-DIDATICO-OU-INSTRUCIONAL', 'DADOS-BASICOS-DA-ORGANIZACAO-DE-EVENTO',
    'DADOS-BASICOS-DO-RELATORIO-DE-PESQUISA', 'DADOS-BASICOS-DE-EDITORACAO',
    'DADOS-BASICOS-DO-PROGRAMA-DE-RADIO-OU-TV', 'DADOS-BASICOS-DA-MIDIA-SOCIAL-WEBSITE-BLOG',
    'DADOS-BASICOS-DE-OUTRA-PRODUCAO-TECNICA', 'DADOS-BASICOS-DO-TRABALHO-TECNICO',
    'DADOS-BASICOS-DO-PROCESSOS-OU-TECNICAS'
  ], 'ANO', start, end, 'ProducaoTecnicaInovacao', rows);
  // Patentes usam ANO-DESENVOLVIMENTO em algumas versões do XML.
  countElementsByYear(doc, ['DADOS-BASICOS-DA-PATENTE'], 'ANO-DESENVOLVIMENTO', start, end, 'ProducaoTecnicaInovacao', rows);
  return rows;
}

function parseCurriculum(xmlText, source, config, refs) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error(`XML inválido em ${source}.`);
  const root = doc.documentElement;
  if (root.tagName !== 'CURRICULO-VITAE') throw new Error(`${source} não parece ser um currículo Lattes.`);
  const general = allByTag(doc, 'DADOS-GERAIS')[0];
  const name = general?.getAttribute('NOME-COMPLETO') || safeFileName(source);
  const idLattes = (root.getAttribute('NUMERO-IDENTIFICADOR') || '').replace(/\D/g, '');
  const articleRows = scoreArticles(doc, name, config.start, config.end, config.scoreMode, refs);
  const eventRows = scoreCompleteEvents(doc, config.start, config.end, refs);
  const counts = countProductions(doc, config.start, config.end, idLattes, refs);
  const yearly = extractYearlyProfile(doc, config.start, config.end);
  const points = { Artigos: articleRows.reduce((sum, row) => sum + Number(row.Peso), 0) };
  for (const rule of refs.generalWeights) {
    if (rule.type === 'TrabCompleto') points[rule.type] = eventRows.reduce((sum, row) => sum + Number(row.Peso), 0);
    else points[rule.type] = getGeneralPoints(refs, rule.type, counts[rule.type] || 0);
  }
  const total = points.Artigos + refs.generalWeights.reduce((sum, rule) => sum + Number(points[rule.type] || 0), 0);
  return { name, idLattes, source, articleRows, eventRows, counts, points, yearly, total };
}

function articleIdentity(row) {
  const doi = String(row.DOI || '').trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
  if (doi) return `doi:${doi}`;
  return `meta:${normalizeText(row.Titulo)}|${row.Ano}|${normalizeIssn(row.ISSN)}|${normalizeText(row.Periodico)}`;
}

function median(values) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function gini(values) {
  const sorted = values.map(Number).filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  const n = sorted.length;
  const total = sorted.reduce((sum, value) => sum + value, 0);
  if (!n || total === 0) return 0;
  const weighted = sorted.reduce((sum, value, index) => sum + (index + 1) * value, 0);
  return (2 * weighted) / (n * total) - (n + 1) / n;
}

function percentage(numerator, denominator) {
  return denominator ? (100 * numerator) / denominator : 0;
}

function sumFields(object, fields) {
  return fields.reduce((sum, field) => sum + Number(object[field] || 0), 0);
}

function buildAnalytics(researchers, refs, config) {
  const articleParticipations = researchers.flatMap((researcher) => researcher.articleRows);
  const uniqueMap = new Map();
  for (const row of articleParticipations) {
    const key = articleIdentity(row);
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, { ...row, _docentes: new Set([row.Nome]), _participacoes: 1, _pesoMax: Number(row.PesoBruto || row.Peso || 0) });
    } else {
      const current = uniqueMap.get(key);
      current._docentes.add(row.Nome);
      current._participacoes += 1;
      current._pesoMax = Math.max(current._pesoMax, Number(row.PesoBruto || row.Peso || 0));
      if (!current.DOI && row.DOI) current.DOI = row.DOI;
      if ((!current.Titulo || current.Titulo.length < row.Titulo.length) && row.Titulo) current.Titulo = row.Titulo;
    }
  }
  const uniqueArticles = [...uniqueMap.values()].map((row) => ({
    Ano: row.Ano,
    Titulo: row.Titulo,
    Periodico: row.Periodico,
    ISSN: row.ISSN,
    DOI: row.DOI,
    QualisCAPES: row.QualisCAPES,
    SJR: row.SJR,
    FaixaSJR: row.FaixaSJR,
    JCR: row.JCR,
    FaixaJCR: row.FaixaJCR,
    QuartilJCR: row.QuartilJCR,
    CategoriasJCR: row.CategoriasJCR,
    PesoReferencia: row._pesoMax,
    DocentesUFJ: [...row._docentes].sort((a, b) => a.localeCompare(b, 'pt-BR')).join('; '),
    NumeroDocentesUFJ: row._docentes.size,
    ParticipacoesNosCurriculos: row._participacoes
  })).sort((a, b) => b.Ano - a.Ano || a.Periodico.localeCompare(b.Periodico, 'pt-BR'));

  const annualRows = blankYears(config.start, config.end).map((row) => ({ ...row, ArtigosUnicos: 0, PontuacaoArtigosUnicos: 0 }));
  for (const researcher of researchers) {
    for (const yearRow of researcher.yearly) {
      const target = annualRows.find((row) => row.Ano === yearRow.Ano);
      Object.keys(yearRow).filter((key) => key !== 'Ano').forEach((key) => { target[key] += Number(yearRow[key] || 0); });
    }
  }
  for (const article of uniqueArticles) {
    const target = annualRows.find((row) => row.Ano === article.Ano);
    if (target) {
      target.ArtigosUnicos += 1;
      target.PontuacaoArtigosUnicos += Number(article.PesoReferencia || 0);
    }
  }

  const capesOrder = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4', 'C', 'ArtigoCOMDOI', 'ArtigoSEMDOI', 'SemQualis'];
  const metricOrder = ['ArtigoP7', 'ArtigoP6', 'ArtigoP5', 'ArtigoP4', 'ArtigoP3', 'ArtigoP2', 'ArtigoP1', 'ArtigoCOMDOI', 'SemSJR', 'SemJCR'];
  const quartileOrder = ['Q1', 'Q2', 'Q3', 'Q4', 'N/A'];
  const capesCounts = new Map();
  const sjrCounts = new Map();
  const jcrCounts = new Map();
  const jcrQuartileCounts = new Map();
  for (const article of uniqueArticles) {
    capesCounts.set(article.QualisCAPES || 'SemQualis', (capesCounts.get(article.QualisCAPES || 'SemQualis') || 0) + 1);
    sjrCounts.set(article.FaixaSJR || 'SemSJR', (sjrCounts.get(article.FaixaSJR || 'SemSJR') || 0) + 1);
    jcrCounts.set(article.FaixaJCR || 'SemJCR', (jcrCounts.get(article.FaixaJCR || 'SemJCR') || 0) + 1);
    jcrQuartileCounts.set(article.QuartilJCR || 'N/A', (jcrQuartileCounts.get(article.QuartilJCR || 'N/A') || 0) + 1);
  }
  const capesQualityRows = [...capesCounts].map(([Estrato, Artigos]) => ({ Sistema: 'CAPES', Estrato, Artigos }))
    .sort((a, b) => (capesOrder.indexOf(a.Estrato) < 0 ? 99 : capesOrder.indexOf(a.Estrato)) - (capesOrder.indexOf(b.Estrato) < 0 ? 99 : capesOrder.indexOf(b.Estrato)));
  const sjrQualityRows = [...sjrCounts].map(([Estrato, Artigos]) => ({ Sistema: 'SJR', Estrato, Artigos }))
    .sort((a, b) => (metricOrder.indexOf(a.Estrato) < 0 ? 99 : metricOrder.indexOf(a.Estrato)) - (metricOrder.indexOf(b.Estrato) < 0 ? 99 : metricOrder.indexOf(b.Estrato)));
  const jcrQualityRows = [...jcrCounts].map(([Estrato, Artigos]) => ({ Sistema: 'JCR', Estrato, Artigos }))
    .sort((a, b) => (metricOrder.indexOf(a.Estrato) < 0 ? 99 : metricOrder.indexOf(a.Estrato)) - (metricOrder.indexOf(b.Estrato) < 0 ? 99 : metricOrder.indexOf(b.Estrato)));
  const jcrQuartileRows = [...jcrQuartileCounts].map(([Estrato, Artigos]) => ({ Sistema: 'JCR Quartil', Estrato, Artigos }))
    .sort((a, b) => (quartileOrder.indexOf(a.Estrato) < 0 ? 99 : quartileOrder.indexOf(a.Estrato)) - (quartileOrder.indexOf(b.Estrato) < 0 ? 99 : quartileOrder.indexOf(b.Estrato)));
  const qualityRows = [...capesQualityRows, ...sjrQualityRows, ...jcrQualityRows, ...jcrQuartileRows];

  const journalMap = new Map();
  for (const article of uniqueArticles) {
    const key = `${normalizeIssn(article.ISSN)}|${normalizeText(article.Periodico)}`;
    if (!journalMap.has(key)) journalMap.set(key, {
      Periodico: article.Periodico || 'Não informado', ISSN: article.ISSN,
      ArtigosUnicos: 0, PontuacaoReferencia: 0, _sjr: [], _jcr: [],
      _quartisJcr: new Set(), _categoriasJcr: new Set(), _docentes: new Set()
    });
    const current = journalMap.get(key);
    current.ArtigosUnicos += 1;
    current.PontuacaoReferencia += Number(article.PesoReferencia || 0);
    if (typeof article.SJR === 'number') current._sjr.push(article.SJR);
    if (typeof article.JCR === 'number') current._jcr.push(article.JCR);
    if (article.QuartilJCR && article.QuartilJCR !== 'N/A') current._quartisJcr.add(article.QuartilJCR);
    String(article.CategoriasJCR || '').split('|').map((value) => value.trim()).filter(Boolean).forEach((value) => current._categoriasJcr.add(value));
    String(article.DocentesUFJ).split(';').map((name) => name.trim()).filter(Boolean).forEach((name) => current._docentes.add(name));
  }
  const journalRows = [...journalMap.values()].map((row) => ({
    Periodico: row.Periodico,
    ISSN: row.ISSN,
    ArtigosUnicos: row.ArtigosUnicos,
    PontuacaoReferencia: row.PontuacaoReferencia,
    SJRMedio: row._sjr.length ? row._sjr.reduce((sum, value) => sum + value, 0) / row._sjr.length : '',
    JIFMedio: row._jcr.length ? row._jcr.reduce((sum, value) => sum + value, 0) / row._jcr.length : '',
    MelhorQuartilJCR: [...row._quartisJcr].sort((a, b) => Number(a.replace('Q', '')) - Number(b.replace('Q', '')))[0] || 'N/A',
    CategoriasJCR: [...row._categoriasJcr].sort((a, b) => a.localeCompare(b, 'pt-BR')).join(' | '),
    NumeroDocentes: row._docentes.size,
    Docentes: [...row._docentes].sort((a, b) => a.localeCompare(b, 'pt-BR')).join('; ')
  })).sort((a, b) => b.ArtigosUnicos - a.ArtigosUnicos || b.PontuacaoReferencia - a.PontuacaoReferencia);

  const collaborationMap = new Map();
  for (const article of uniqueArticles.filter((row) => row.NumeroDocentesUFJ > 1)) {
    const names = article.DocentesUFJ.split(';').map((name) => name.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    for (let i = 0; i < names.length; i += 1) {
      for (let j = i + 1; j < names.length; j += 1) {
        const pair = `${names[i]}|||${names[j]}`;
        if (!collaborationMap.has(pair)) collaborationMap.set(pair, { Docente1: names[i], Docente2: names[j], ArtigosCompartilhados: 0, PontuacaoCompartilhada: 0 });
        const current = collaborationMap.get(pair);
        current.ArtigosCompartilhados += 1;
        current.PontuacaoCompartilhada += Number(article.PesoReferencia || 0);
      }
    }
  }
  const collaborationRows = [...collaborationMap.values()].sort((a, b) => b.ArtigosCompartilhados - a.ArtigosCompartilhados || b.PontuacaoCompartilhada - a.PontuacaoCompartilhada);

  const pointTotals = researchers.map((researcher) => researcher.total);
  const grandPoints = pointTotals.reduce((sum, value) => sum + value, 0);
  const topCount = Math.max(1, Math.ceil(researchers.length * 0.2));
  const topShare = grandPoints ? researchers.map((row) => row.total).sort((a, b) => b - a).slice(0, topCount).reduce((sum, value) => sum + value, 0) / grandPoints * 100 : 0;
  const doiCount = uniqueArticles.filter((row) => String(row.DOI || '').trim()).length;
  const capesIndexed = uniqueArticles.filter((row) => row.QualisCAPES && row.QualisCAPES !== 'SemQualis').length;
  const sjrIndexed = uniqueArticles.filter((row) => typeof row.SJR === 'number').length;
  const jcrIndexed = uniqueArticles.filter((row) => typeof row.JCR === 'number').length;

  const orientationCompletedFields = ['OrientMestConc', 'CoOrientMestConc', 'OrientDoutConc', 'CoOrientDoutConc', 'OrientPosDoutConc', 'OrientICConc', 'OrientTCCConc', 'OrientMonConc'];
  const orientationOngoingFields = ['OrientICAnd', 'OrientTCCAnd', 'OrientMonAnd', 'OrientMestAnd', 'CoOrientMestAnd', 'OrientDoutAnd', 'CoOrientDoutAnd', 'OrientPosDoutAnd'];
  const technicalFields = ['SoftwaresReg', 'SoftwaresSemReg', 'Patentes', 'CultivarProt', 'CultivarReg', 'Maquetes', 'MapasCartas', 'OutrosTrabTec'];

  const indicatorRows = researchers.map((researcher) => {
    const articles = researcher.articleRows;
    const internalArticles = uniqueArticles.filter((row) => row.NumeroDocentesUFJ > 1 && row.DocentesUFJ.split(';').map((name) => name.trim()).includes(researcher.name));
    const partners = new Set();
    internalArticles.forEach((article) => article.DocentesUFJ.split(';').map((name) => name.trim()).filter((name) => name && name !== researcher.name).forEach((name) => partners.add(name)));
    const withDoi = articles.filter((row) => String(row.DOI || '').trim()).length;
    const withCapes = articles.filter((row) => row.QualisCAPES && row.QualisCAPES !== 'SemQualis').length;
    const withSjr = articles.filter((row) => typeof row.SJR === 'number').length;
    const withJcr = articles.filter((row) => typeof row.JCR === 'number').length;
    const qualisA = articles.filter((row) => /^A[1-4]$/i.test(row.QualisCAPES)).length;
    const jcrQ1 = articles.filter((row) => row.QuartilJCR === 'Q1').length;
    return {
      Nomes: researcher.name,
      TotalPontos: researcher.total,
      Artigos: articles.length,
      PontosPorArtigo: articles.length ? researcher.points.Artigos / articles.length : 0,
      ArtigosQualisA: qualisA,
      ArtigosJCRQ1: jcrQ1,
      CoberturaDOI_pct: percentage(withDoi, articles.length),
      CoberturaCAPES_pct: percentage(withCapes, articles.length),
      CoberturaSJR_pct: percentage(withSjr, articles.length),
      CoberturaJCR_pct: percentage(withJcr, articles.length),
      Livros: researcher.counts.Livros || 0,
      Capitulos: researcher.counts.CapLivros || 0,
      OrientacoesConcluidas: sumFields(researcher.counts, orientationCompletedFields),
      OrientacoesAndamento: sumFields(researcher.counts, orientationOngoingFields),
      ProducaoTecnicaInovacao: sumFields(researcher.counts, technicalFields),
      ArtigosColaboracaoInterna: internalArticles.length,
      ParceirosInternos: partners.size,
      BolsistaProdutividade: researcher.counts.ProdutividadeCNPq || 0
    };
  }).sort((a, b) => b.TotalPontos - a.TotalPontos);

  const productKeys = ['Artigos', ...refs.generalWeights.map((row) => row.type)];
  const productQuantityRows = productKeys.map((key) => ({
    Categoria: PRODUCT_LABELS[key] || key,
    Codigo: key,
    Quantidade: researchers.reduce((sum, row) => sum + Number(row.counts[key] || 0), 0)
  })).filter((row) => row.Quantidade > 0).sort((a, b) => b.Quantidade - a.Quantidade);
  const productPointsRows = productKeys.map((key) => ({
    Categoria: PRODUCT_LABELS[key] || key,
    Codigo: key,
    Pontuacao: researchers.reduce((sum, row) => sum + Number(row.points[key] || 0), 0)
  })).filter((row) => row.Pontuacao > 0).sort((a, b) => b.Pontuacao - a.Pontuacao);

  return {
    articleParticipations, uniqueArticles, annualRows, qualityRows,
    capesQualityRows, sjrQualityRows, jcrQualityRows, jcrQuartileRows,
    journalRows, collaborationRows, indicatorRows, productQuantityRows, productPointsRows,
    summary: {
      grandPoints,
      meanPoints: researchers.length ? grandPoints / researchers.length : 0,
      medianPoints: median(pointTotals),
      gini: gini(pointTotals),
      top20Share: topShare,
      doiCoverage: percentage(doiCount, uniqueArticles.length),
      capesCoverage: percentage(capesIndexed, uniqueArticles.length),
      sjrCoverage: percentage(sjrIndexed, uniqueArticles.length),
      jcrCoverage: percentage(jcrIndexed, uniqueArticles.length),
      uniqueArticleCount: uniqueArticles.length,
      collaborationArticleCount: uniqueArticles.filter((row) => row.NumeroDocentesUFJ > 1).length,
      collaborationPairCount: collaborationRows.length
    }
  };
}

async function processAll() {
  const files = Array.from(els.lattesFiles.files || []);
  const start = Number(els.yearStart.value);
  const end = Number(els.yearEnd.value);
  if (!files.length) throw new Error('Selecione pelo menos um currículo Lattes em ZIP ou XML.');
  if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) throw new Error('Informe um período válido.');

  const config = { start, end, scoreMode: els.scoreMode.value, ruleVersion: '1.2.1 corrigida' };
  resetProgress();
  els.processBtn.disabled = true;
  if (state.downloadUrl) {
    URL.revokeObjectURL(state.downloadUrl);
    state.downloadUrl = '';
  }
  [els.downloadLink, els.downloadLinkResults].forEach((link) => {
    link.classList.add('hidden');
    link.removeAttribute('href');
  });
  els.resultsSection.classList.add('hidden');
  log(`Iniciando análise corrigida de ${files.length} arquivo(s) selecionado(s).`);

  try {
    const refs = await prepareReferences();
    setProgress(58, 'Descompactando currículos...');
    const documents = await loadCurricula(files);
    if (!documents.length) throw new Error('Nenhum arquivo curriculo.xml foi encontrado.');
    log(`${documents.length} currículo(s) XML encontrado(s).`);

    const researchers = [];
    const errors = [];
    for (let i = 0; i < documents.length; i += 1) {
      const item = documents[i];
      setProgress(60 + (i / documents.length) * 28, `Processando currículo ${i + 1} de ${documents.length}...`);
      try {
        const result = parseCurriculum(item.xmlText, item.source, config, refs);
        researchers.push(result);
        log(`${result.name}: ${result.counts.Artigos} artigo(s), ${result.counts.Livros} livro(s), ${result.counts.CapLivros} capítulo(s), ${formatNumber(result.total)} pontos.`);
      } catch (error) {
        errors.push(`${item.source}: ${error.message}`);
        log(`Aviso — ${item.source}: ${error.message}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    if (!researchers.length) throw new Error(`Nenhum currículo pôde ser processado. ${errors.join(' ')}`);

    const columns = ['Nomes', 'Artigos', ...refs.generalWeights.map((row) => row.type)];
    const quantityRows = researchers.map((researcher) => {
      const row = { Nomes: researcher.name, Artigos: researcher.counts.Artigos };
      refs.generalWeights.forEach((rule) => { row[rule.type] = researcher.counts[rule.type] || 0; });
      return row;
    }).sort((a, b) => b.Artigos - a.Artigos || a.Nomes.localeCompare(b.Nomes, 'pt-BR'));

    const pointsRows = researchers.map((researcher) => {
      const row = { Nomes: researcher.name, Artigos: researcher.points.Artigos };
      refs.generalWeights.forEach((rule) => { row[rule.type] = researcher.points[rule.type] || 0; });
      return row;
    }).sort((a, b) => b.Artigos - a.Artigos || a.Nomes.localeCompare(b.Nomes, 'pt-BR'));

    const totalRows = researchers.map((researcher) => ({ Nomes: researcher.name, TotalPontos: researcher.total }))
      .sort((a, b) => b.TotalPontos - a.TotalPontos || a.Nomes.localeCompare(b.Nomes, 'pt-BR'));

    setProgress(90, 'Construindo indicadores e análises...');
    const analytics = buildAnalytics(researchers, refs, config);
    state.results = {
      config, refs, researchers, columns, quantityRows, pointsRows, totalRows,
      percentiles: refs.sjrPercentiles, sjrPercentiles: refs.sjrPercentiles,
      jcrPercentiles: refs.jcrPercentiles, analytics, errors
    };
    state.activeTab = 'total';
    state.selectedResearcher = 'ALL';
    state.profileResearcher = totalRows[0]?.Nomes || researchers[0].name;
    state.profileView = 'INDIVIDUAL';
    renderResults();
    setProgress(96, 'Preparando o pacote para download...');
    await new Promise((resolve) => setTimeout(resolve, 0));
    prepareDownloadLink();
    setProgress(100, 'Processamento concluído — download disponível');
    log(`Processamento concluído: ${researchers.length} currículo(s), ${analytics.summary.uniqueArticleCount} artigo(s) único(s) e ${formatNumber(analytics.summary.grandPoints)} pontos.`);
    log('O link para baixar todos os resultados já está disponível.');
  } finally {
    els.processBtn.disabled = false;
  }
}

// -----------------------------------------------------------------------------
// Resultados e painel analítico
// -----------------------------------------------------------------------------

function renderResults() {
  const results = state.results;
  if (!results) return;
  const totalArticles = results.researchers.reduce((sum, row) => sum + row.counts.Artigos, 0);
  const top = results.totalRows[0];
  const summary = results.analytics.summary;
  els.summaryCards.innerHTML = [
    ['Currículos analisados', results.researchers.length, 'docentes/pesquisadores'],
    ['Participações em artigos', totalArticles, 'soma dos currículos'],
    ['Artigos únicos', summary.uniqueArticleCount, 'sem duplicar coautorias internas'],
    ['Pontuação acumulada', formatNumber(summary.grandPoints), `mediana: ${formatNumber(summary.medianPoints)}`],
    ['Cobertura de DOI', `${formatNumber(summary.doiCoverage, 1)}%`, `CAPES: ${formatNumber(summary.capesCoverage, 1)}% · SJR: ${formatNumber(summary.sjrCoverage, 1)}% · JCR: ${formatNumber(summary.jcrCoverage, 1)}%`],
    ['Maior pontuação', top ? formatNumber(top.TotalPontos) : '—', top?.Nomes || '—']
  ].map(([label, value, note]) => `<div class="summary-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></div>`).join('');

  els.resultsMeta.textContent = `${results.config.start}–${results.config.end} · ${scoreModeLabel(results.config.scoreMode)} · regras corrigidas 1.2.1`;
  renderRanking(results.totalRows);
  populateProfileSelect();
  renderDashboard();
  renderProfileSection();
  els.resultsSection.classList.remove('hidden');
  document.querySelectorAll('.tab').forEach((button) => button.classList.toggle('active', button.dataset.tab === state.activeTab));
  renderActiveTab();
  els.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderRanking(rows) {
  const maximum = Math.max(...rows.map((row) => Number(row.TotalPontos)), 1);
  els.rankingChart.innerHTML = rows.map((row, index) => `
    <div class="rank-row">
      <div class="rank-position">${index + 1}</div>
      <div class="rank-name" title="${escapeHtml(row.Nomes)}">${escapeHtml(row.Nomes)}</div>
      <div class="rank-track"><div class="rank-bar" style="width:${Math.max(0.5, (row.TotalPontos / maximum) * 100)}%"></div></div>
      <div class="rank-value">${escapeHtml(formatNumber(row.TotalPontos))}</div>
    </div>`).join('');
}

function renderTable(rows, columns = null) {
  const safeRows = rows || [];
  if (!safeRows.length) {
    els.tableContainer.innerHTML = '<div class="notice">Nenhum registro encontrado para esta seleção.</div>';
    return;
  }
  const keys = columns || Object.keys(safeRows[0]);
  const header = keys.map((key) => `<th>${escapeHtml(key)}</th>`).join('');
  const body = safeRows.map((row) => `<tr>${keys.map((key) => {
    const value = row[key] ?? '';
    const numeric = typeof value === 'number' || (value !== '' && Number.isFinite(Number(value)));
    const isPercent = /_pct$|Percentual|Cobertura/i.test(key);
    const display = numeric && key !== 'ISSN' && key !== 'Ano'
      ? `${formatNumber(value, 3)}${isPercent ? '%' : ''}` : value;
    return `<td class="${numeric ? 'numeric' : ''}">${escapeHtml(display)}</td>`;
  }).join('')}</tr>`).join('');
  els.tableContainer.innerHTML = `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
}

function populateProfileSelect() {
  const names = state.results.totalRows.map((row) => row.Nomes);
  els.profileResearcher.innerHTML = names.map((name) => `<option value="${escapeHtml(name)}" ${state.profileResearcher === name ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('');
}

function horizontalBars(container, rows, labelKey, valueKey, maxItems = 10, formatter = (value) => formatNumber(value)) {
  if (!rows.length) { container.innerHTML = '<div class="chart-empty">Sem dados para esta análise.</div>'; return; }
  const selected = rows.slice(0, maxItems);
  const max = Math.max(...selected.map((row) => Number(row[valueKey]) || 0), 1);
  container.innerHTML = `<div class="bar-list">${selected.map((row) => `
    <div class="mini-bar-row">
      <div class="mini-bar-label" title="${escapeHtml(row[labelKey])}">${escapeHtml(row[labelKey])}</div>
      <div class="mini-bar-track"><div class="mini-bar-fill" style="width:${Number(row[valueKey]) > 0 ? Math.max(1, (Number(row[valueKey]) / max) * 100) : 0}%"></div></div>
      <div class="mini-bar-value">${escapeHtml(formatter(row[valueKey]))}</div>
    </div>`).join('')}</div>`;
}

function lineChart(container, rows, series) {
  if (!rows.length) { container.innerHTML = '<div class="chart-empty">Sem dados anuais.</div>'; return; }
  const width = 900; const height = 330; const margin = { left: 54, right: 25, top: 25, bottom: 45 };
  const plotW = width - margin.left - margin.right; const plotH = height - margin.top - margin.bottom;
  const max = Math.max(...rows.flatMap((row) => series.map((item) => Number(row[item.key]) || 0)), 1);
  const x = (index) => margin.left + (rows.length === 1 ? plotW / 2 : index * plotW / (rows.length - 1));
  const y = (value) => margin.top + plotH - (Number(value) / max) * plotH;
  const ticks = 5;
  const grid = Array.from({ length: ticks + 1 }, (_, index) => {
    const value = max * index / ticks; const py = y(value);
    return `<line class="chart-grid" x1="${margin.left}" y1="${py}" x2="${width - margin.right}" y2="${py}"/><text class="chart-label" x="${margin.left - 8}" y="${py + 4}" text-anchor="end">${escapeHtml(formatNumber(value, 0))}</text>`;
  }).join('');
  const xLabels = rows.map((row, index) => `<text class="chart-label" x="${x(index)}" y="${height - 17}" text-anchor="middle">${row.Ano}</text>`).join('');
  const paths = series.map((item, sIndex) => {
    const points = rows.map((row, index) => `${x(index)},${y(row[item.key])}`).join(' ');
    const circles = rows.map((row, index) => `<circle class="chart-point" cx="${x(index)}" cy="${y(row[item.key])}" r="4" fill="${CHART_COLORS[sIndex]}"><title>${escapeHtml(item.label)} — ${row.Ano}: ${formatNumber(row[item.key], 0)}</title></circle>`).join('');
    return `<polyline class="chart-line" points="${points}" stroke="${CHART_COLORS[sIndex]}"/>${circles}`;
  }).join('');
  const legend = `<div class="chart-legend">${series.map((item, index) => `<span class="legend-item"><i class="legend-swatch" style="background:${CHART_COLORS[index]}"></i>${escapeHtml(item.label)}</span>`).join('')}</div>`;
  container.innerHTML = `${legend}<svg class="svg-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Evolução anual da produção">${grid}<line class="chart-axis" x1="${margin.left}" y1="${margin.top + plotH}" x2="${width - margin.right}" y2="${margin.top + plotH}"/>${xLabels}${paths}</svg>`;
}

function scatterChart(container, rows) {
  if (!rows.length) { container.innerHTML = '<div class="chart-empty">Sem dados para o gráfico.</div>'; return; }
  const width = 700; const height = 330; const margin = { left: 55, right: 24, top: 24, bottom: 48 };
  const plotW = width - margin.left - margin.right; const plotH = height - margin.top - margin.bottom;
  const maxX = Math.max(...rows.map((row) => Number(row.Artigos) || 0), 1);
  const maxY = Math.max(...rows.map((row) => Number(row.TotalPontos) || 0), 1);
  const x = (value) => margin.left + Number(value) / maxX * plotW;
  const y = (value) => margin.top + plotH - Number(value) / maxY * plotH;
  const grids = Array.from({ length: 6 }, (_, index) => {
    const ratio = index / 5; const px = margin.left + ratio * plotW; const py = margin.top + plotH - ratio * plotH;
    return `<line class="chart-grid" x1="${px}" y1="${margin.top}" x2="${px}" y2="${margin.top + plotH}"/><line class="chart-grid" x1="${margin.left}" y1="${py}" x2="${margin.left + plotW}" y2="${py}"/><text class="chart-label" x="${px}" y="${height - 20}" text-anchor="middle">${formatNumber(maxX * ratio, 0)}</text><text class="chart-label" x="${margin.left - 8}" y="${py + 4}" text-anchor="end">${formatNumber(maxY * ratio, 0)}</text>`;
  }).join('');
  const points = rows.map((row, index) => `<circle class="chart-point" cx="${x(row.Artigos)}" cy="${y(row.TotalPontos)}" r="6" fill="${CHART_COLORS[index % CHART_COLORS.length]}"><title>${escapeHtml(row.Nomes)} — ${row.Artigos} artigos; ${formatNumber(row.TotalPontos)} pontos</title></circle>`).join('');
  container.innerHTML = `<svg class="svg-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Relação entre número de artigos e pontuação">${grids}<line class="chart-axis" x1="${margin.left}" y1="${margin.top + plotH}" x2="${margin.left + plotW}" y2="${margin.top + plotH}"/><line class="chart-axis" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotH}"/>${points}<text class="chart-title-label" x="${margin.left + plotW / 2}" y="${height - 3}" text-anchor="middle">Artigos</text><text class="chart-title-label" transform="translate(14 ${margin.top + plotH / 2}) rotate(-90)" text-anchor="middle">Pontuação total</text></svg>`;
}

function renderCoveragePanel(container, summary) {
  const metrics = [
    ['Média por docente', formatNumber(summary.meanPoints)],
    ['Mediana', formatNumber(summary.medianPoints)],
    ['Índice de Gini', formatNumber(summary.gini, 3)],
    ['Participação do top 20%', `${formatNumber(summary.top20Share, 1)}%`]
  ];
  const coverage = [
    ['Artigos com DOI', summary.doiCoverage],
    ['Artigos indexados na CAPES', summary.capesCoverage],
    ['Artigos indexados no SJR', summary.sjrCoverage],
    ['Artigos indexados no JCR', summary.jcrCoverage]
  ];
  container.innerHTML = `<div class="metric-grid">${metrics.map(([label, value]) => `<div class="metric-tile"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}</div>${coverage.map(([label, value]) => `<div class="coverage-row"><div class="coverage-label"><span>${escapeHtml(label)}</span><strong>${formatNumber(value, 1)}%</strong></div><div class="coverage-track"><div class="coverage-fill" style="width:${Math.max(0, Math.min(100, value))}%"></div></div></div>`).join('')}`;
}

const QUALITY_ORDERS = {
  CAPES: ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4', 'C', 'SemQualis'],
  SJR: ['ArtigoP7', 'ArtigoP6', 'ArtigoP5', 'ArtigoP4', 'ArtigoP3', 'ArtigoP2', 'ArtigoP1', 'SemSJR'],
  JCR: ['ArtigoP7', 'ArtigoP6', 'ArtigoP5', 'ArtigoP4', 'ArtigoP3', 'ArtigoP2', 'ArtigoP1', 'SemJCR'],
  JCR_QUARTILE: ['Q1', 'Q2', 'Q3', 'Q4', 'N/A']
};

const STACK_COLORS = ['#082f63', '#1557a0', '#2f7cc1', '#62a9df', '#19704a', '#45a778', '#d58b1d', '#edb84a', '#845ec2', '#b9c2cf'];

function qualityDisplayLabel(value) {
  const labels = {
    ArtigoP7: 'P7', ArtigoP6: 'P6', ArtigoP5: 'P5', ArtigoP4: 'P4',
    ArtigoP3: 'P3', ArtigoP2: 'P2', ArtigoP1: 'P1',
    SemQualis: 'Sem Qualis', SemSJR: 'Sem SJR', SemJCR: 'Sem JCR', 'N/A': 'Sem quartil'
  };
  return labels[value] || value;
}

function metricSystemForMode(mode) {
  if (mode === 'SJR' || mode === 'MELHOR') return 'SJR';
  if (mode === 'JCR' || mode === 'MELHOR_JCR') return 'JCR';
  return null;
}

function qualityRowsForArticles(articles, system) {
  const order = QUALITY_ORDERS[system] || [];
  const key = system === 'CAPES' ? 'QualisCAPES'
    : system === 'SJR' ? 'FaixaSJR'
      : system === 'JCR' ? 'FaixaJCR' : 'QuartilJCR';
  const fallback = system === 'CAPES' ? 'SemQualis'
    : system === 'SJR' ? 'SemSJR'
      : system === 'JCR' ? 'SemJCR' : 'N/A';
  const counts = new Map(order.map((item) => [item, 0]));
  for (const article of articles || []) {
    const value = String(article[key] || fallback).trim() || fallback;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  const extras = [...counts.keys()].filter((item) => !order.includes(item));
  return [...order, ...extras].map((Estrato) => ({ Estrato, Rotulo: qualityDisplayLabel(Estrato), Artigos: counts.get(Estrato) || 0 }));
}

function renderQualityHistogram(container, rows) {
  horizontalBars(container, rows, 'Rotulo', 'Artigos', rows.length, (value) => formatNumber(value, 0));
}

function topArticlesForResearcher(researcher, limit = 10) {
  return [...(researcher?.articleRows || [])]
    .sort((a, b) => Number(b.PesoBruto || 0) - Number(a.PesoBruto || 0)
      || Number(b.JCR || -1) - Number(a.JCR || -1)
      || Number(b.SJR || -1) - Number(a.SJR || -1)
      || Number(b.Ano || 0) - Number(a.Ano || 0))
    .slice(0, limit);
}

function countQualitySegments(articles, system) {
  return Object.fromEntries(qualityRowsForArticles(articles, system).map((row) => [row.Estrato, row.Artigos]));
}

function stackedHistogram(container, rows, categories) {
  if (!rows.length) { container.innerHTML = '<div class="chart-empty">Sem dados para a comparação.</div>'; return; }
  const totals = rows.map((row) => categories.reduce((sum, category) => sum + Number(row.segments[category] || 0), 0));
  const maxTotal = Math.max(...totals, 1);
  const legend = `<div class="stacked-legend">${categories.map((category, index) => `<span class="legend-item"><i class="legend-swatch" style="background:${STACK_COLORS[index % STACK_COLORS.length]}"></i>${escapeHtml(qualityDisplayLabel(category))}</span>`).join('')}</div>`;
  const bars = rows.map((row, rowIndex) => {
    const total = totals[rowIndex];
    const segments = categories.map((category, index) => {
      const value = Number(row.segments[category] || 0);
      if (!value) return '';
      const width = total ? value / maxTotal * 100 : 0;
      return `<span class="stack-segment" style="width:${width}%;background:${STACK_COLORS[index % STACK_COLORS.length]}" title="${escapeHtml(row.Docente)} — ${escapeHtml(qualityDisplayLabel(category))}: ${value}"><b>${value}</b></span>`;
    }).join('');
    return `<div class="stacked-row"><div class="stacked-label" title="${escapeHtml(row.Docente)}">${escapeHtml(row.Docente)}</div><div class="stacked-track">${segments}</div><div class="stacked-total">${total}</div></div>`;
  }).join('');
  container.innerHTML = `${legend}<div class="stacked-list">${bars}</div>`;
}

function buildTop10Comparison() {
  return state.results.researchers.map((researcher) => {
    const articles = topArticlesForResearcher(researcher, 10);
    const score = articles.reduce((sum, article) => sum + Number(article.PesoBruto || 0), 0);
    return {
      Docente: researcher.name,
      Rotulo: `${researcher.name} (n=${articles.length})`,
      Quantidade: articles.length,
      PontuacaoTop10: score,
      MediaTop10: articles.length ? score / articles.length : 0,
      capesSegments: countQualitySegments(articles, 'CAPES'),
      sjrSegments: countQualitySegments(articles, 'SJR'),
      jcrSegments: countQualitySegments(articles, 'JCR')
    };
  });
}

function renderResearcherProfile(name) {
  const results = state.results;
  const row = results.analytics.indicatorRows.find((item) => item.Nomes === name);
  const researcher = results.researchers.find((item) => item.name === name);
  if (!row || !researcher) { els.researcherProfile.innerHTML = '<div class="chart-empty">Selecione um docente.</div>'; return; }
  const stats = [
    ['Pontuação total', formatNumber(row.TotalPontos)], ['Artigos', row.Artigos], ['Pontos por artigo', formatNumber(row.PontosPorArtigo)],
    ['Artigos Qualis A', row.ArtigosQualisA], ['Artigos JCR Q1', row.ArtigosJCRQ1], ['Livros + capítulos', row.Livros + row.Capitulos],
    ['Orientações concluídas', row.OrientacoesConcluidas], ['Orientações em andamento', row.OrientacoesAndamento],
    ['Produção técnica/inovação', row.ProducaoTecnicaInovacao],
    ['Artigos em colaboração interna', row.ArtigosColaboracaoInterna], ['Parceiros internos', row.ParceirosInternos],
    ['Cobertura DOI', `${formatNumber(row.CoberturaDOI_pct, 1)}%`], ['Cobertura CAPES', `${formatNumber(row.CoberturaCAPES_pct, 1)}%`],
    ['Cobertura SJR', `${formatNumber(row.CoberturaSJR_pct, 1)}%`], ['Cobertura JCR', `${formatNumber(row.CoberturaJCR_pct, 1)}%`]
  ];
  els.researcherProfile.innerHTML = `<div class="profile-name-banner"><span>Docente selecionado</span><strong>${escapeHtml(name)}</strong></div><div class="profile-grid">${stats.map(([label, value]) => `<div class="profile-stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}</div>`;

  lineChart(els.profileAnnualChart, researcher.yearly, [
    { key: 'Artigos', label: 'Artigos' },
    { key: 'OrientacoesConcluidas', label: 'Orientações concluídas' },
    { key: 'ProducaoTecnicaInovacao', label: 'Produção técnica/inovação' }
  ]);

  const categoryRows = Object.entries(researcher.points)
    .map(([key, value]) => ({ Categoria: PRODUCT_LABELS[key] || key, Pontuacao: Number(value) || 0 }))
    .filter((item) => item.Pontuacao > 0).sort((a, b) => b.Pontuacao - a.Pontuacao);
  horizontalBars(els.profileProductionMixChart, categoryRows, 'Categoria', 'Pontuacao', 10);
  renderQualityHistogram(els.profileQualityCapesChart, qualityRowsForArticles(researcher.articleRows, 'CAPES'));

  const metric = metricSystemForMode(results.config.scoreMode);
  els.profileQualityMetricPanel.classList.toggle('hidden', !metric);
  if (metric) {
    els.profileQualityMetricTitle.textContent = `Qualidade individual por faixas ${metric}`;
    renderQualityHistogram(els.profileQualityMetricChart, qualityRowsForArticles(researcher.articleRows, metric));
  }

  const topRows = topArticlesForResearcher(researcher, 10).map((article, index) => ({
    Artigo: `${index + 1}. ${article.Titulo || article.Periodico || 'Artigo sem título'}`,
    Peso: Number(article.PesoBruto || 0)
  }));
  horizontalBars(els.profileTopArticlesChart, topRows, 'Artigo', 'Peso', 10);
}

function renderTop10Comparison() {
  const rows = buildTop10Comparison();
  const scoreRows = [...rows].sort((a, b) => b.PontuacaoTop10 - a.PontuacaoTop10 || b.MediaTop10 - a.MediaTop10);
  const averageRows = [...rows].sort((a, b) => b.MediaTop10 - a.MediaTop10 || b.PontuacaoTop10 - a.PontuacaoTop10);
  horizontalBars(els.top10ScoreChart, scoreRows, 'Rotulo', 'PontuacaoTop10', rows.length);
  horizontalBars(els.top10AverageChart, averageRows, 'Rotulo', 'MediaTop10', rows.length);

  const capesRows = scoreRows.map((row) => ({ Docente: row.Docente, segments: row.capesSegments }));
  stackedHistogram(els.top10CapesChart, capesRows, QUALITY_ORDERS.CAPES);

  const metric = metricSystemForMode(state.results.config.scoreMode);
  els.top10MetricPanel.classList.toggle('hidden', !metric);
  if (metric) {
    els.top10MetricTitle.textContent = `Faixas ${metric} entre os 10 melhores artigos`;
    const metricRows = scoreRows.map((row) => ({ Docente: row.Docente, segments: metric === 'SJR' ? row.sjrSegments : row.jcrSegments }));
    stackedHistogram(els.top10MetricChart, metricRows, QUALITY_ORDERS[metric]);
  }

  const sumWinner = scoreRows[0];
  const meanWinner = averageRows[0];
  els.comparisonSummary.innerHTML = `<div class="comparison-highlight"><span>Maior soma nos 10 melhores</span><strong>${escapeHtml(sumWinner?.Docente || '—')}</strong><small>${formatNumber(sumWinner?.PontuacaoTop10 || 0)} pontos em ${sumWinner?.Quantidade || 0} artigo(s)</small></div><div class="comparison-highlight"><span>Maior média entre os 10 melhores</span><strong>${escapeHtml(meanWinner?.Docente || '—')}</strong><small>${formatNumber(meanWinner?.MediaTop10 || 0)} pontos por artigo</small></div><div class="comparison-note">Os artigos são ordenados pelo <strong>peso bruto do modo selecionado</strong> (${escapeHtml(scoreModeLabel(state.results.config.scoreMode))}). Docentes com menos de 10 artigos são comparados com a quantidade disponível, indicada por <em>n</em>.</div>`;
}

function renderProfileSection() {
  if (!state.results) return;
  const comparison = state.profileView === 'TOP10';
  els.profileAnalysisMode.value = state.profileView;
  els.profileResearcherLabel.classList.toggle('hidden', comparison);
  els.individualProfilePanels.classList.toggle('hidden', comparison);
  els.comparisonProfilePanels.classList.toggle('hidden', !comparison);
  if (comparison) renderTop10Comparison();
  else renderResearcherProfile(state.profileResearcher);
}

function renderDashboard() {
  const analytics = state.results.analytics;
  lineChart(els.annualChart, analytics.annualRows, [
    { key: 'ArtigosUnicos', label: 'Artigos únicos' },
    { key: 'OrientacoesConcluidas', label: 'Orientações concluídas' },
    { key: 'ProducaoTecnicaInovacao', label: 'Produção técnica/inovação' }
  ]);
  horizontalBars(els.productionMixChart, analytics.productPointsRows, 'Categoria', 'Pontuacao', 9);

  renderQualityHistogram(els.qualityCapesChart, qualityRowsForArticles(analytics.uniqueArticles, 'CAPES'));
  const metric = metricSystemForMode(state.results.config.scoreMode);
  els.qualityMetricPanel.classList.toggle('hidden', !metric);
  if (metric) {
    els.qualityMetricTitle.textContent = `Qualidade dos artigos por faixas ${metric}`;
    els.qualityMetricDescription.textContent = `Quantidade de artigos únicos em cada estrato ${metric}.`;
    renderQualityHistogram(els.qualityMetricChart, qualityRowsForArticles(analytics.uniqueArticles, metric));
  }
  const showJcrQuartile = metric === 'JCR';
  els.qualityJcrQuartilePanel.classList.toggle('hidden', !showJcrQuartile);
  if (showJcrQuartile) renderQualityHistogram(els.qualityJcrQuartileChart, qualityRowsForArticles(analytics.uniqueArticles, 'JCR_QUARTILE'));

  scatterChart(els.scatterChart, analytics.indicatorRows);
  renderCoveragePanel(els.concentrationPanel, analytics.summary);
  horizontalBars(els.journalsChart, analytics.journalRows, 'Periodico', 'ArtigosUnicos', 9, (value) => formatNumber(value, 0));
  const collaborationDisplay = analytics.collaborationRows.map((row) => ({ Par: `${row.Docente1} × ${row.Docente2}`, Artigos: row.ArtigosCompartilhados }));
  horizontalBars(els.collaborationChart, collaborationDisplay, 'Par', 'Artigos', 9, (value) => formatNumber(value, 0));
}

function researcherSelect() {
  const names = state.results.researchers.map((row) => row.name).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return `<label>Docente/pesquisador <select id="researcherFilter"><option value="ALL">Todos</option>${names.map((name) => `<option value="${escapeHtml(name)}" ${state.selectedResearcher === name ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')}</select></label>`;
}

function renderActiveTab() {
  const results = state.results;
  if (!results) return;
  const analytics = results.analytics;
  els.tabControls.innerHTML = '';
  if (state.activeTab === 'total') renderTable(results.totalRows, ['Nomes', 'TotalPontos']);
  else if (state.activeTab === 'quantity') renderTable(results.quantityRows, results.columns);
  else if (state.activeTab === 'points') renderTable(results.pointsRows, results.columns);
  else if (state.activeTab === 'indicators') renderTable(analytics.indicatorRows, ['Nomes', 'TotalPontos', 'Artigos', 'PontosPorArtigo', 'ArtigosQualisA', 'ArtigosJCRQ1', 'CoberturaDOI_pct', 'CoberturaCAPES_pct', 'CoberturaSJR_pct', 'CoberturaJCR_pct', 'Livros', 'Capitulos', 'OrientacoesConcluidas', 'OrientacoesAndamento', 'ProducaoTecnicaInovacao', 'ArtigosColaboracaoInterna', 'ParceirosInternos', 'BolsistaProdutividade']);
  else if (state.activeTab === 'annual') renderTable(analytics.annualRows, ['Ano', 'Artigos', 'ArtigosUnicos', 'Livros', 'CapLivros', 'TrabCompleto', 'OrientacoesConcluidas', 'OrientacoesAndamento', 'Bancas', 'ProducaoTecnicaInovacao', 'PontuacaoArtigosUnicos']);
  else if (state.activeTab === 'quality') renderTable(analytics.qualityRows, ['Sistema', 'Estrato', 'Artigos']);
  else if (state.activeTab === 'journals') renderTable(analytics.journalRows, ['Periodico', 'ISSN', 'ArtigosUnicos', 'PontuacaoReferencia', 'SJRMedio', 'JIFMedio', 'MelhorQuartilJCR', 'CategoriasJCR', 'NumeroDocentes', 'Docentes']);
  else if (state.activeTab === 'collaborations') renderTable(analytics.collaborationRows, ['Docente1', 'Docente2', 'ArtigosCompartilhados', 'PontuacaoCompartilhada']);
  else if (state.activeTab === 'uniqueArticles') renderTable(analytics.uniqueArticles, ['Ano', 'Titulo', 'Periodico', 'ISSN', 'DOI', 'QualisCAPES', 'SJR', 'FaixaSJR', 'JCR', 'FaixaJCR', 'QuartilJCR', 'CategoriasJCR', 'PesoReferencia', 'NumeroDocentesUFJ', 'DocentesUFJ']);
  else if (state.activeTab === 'percentiles') renderTable(results.sjrPercentiles, ['TipoSJR', 'SJRmin', 'SJRmax', 'Pesos']);
  else if (state.activeTab === 'jcrPercentiles') renderTable(results.jcrPercentiles, ['TipoJCR', 'JCRmin', 'JCRmax', 'Pesos']);
  else if (state.activeTab === 'articles') {
    els.tabControls.innerHTML = researcherSelect();
    const rows = results.researchers.filter((row) => state.selectedResearcher === 'ALL' || row.name === state.selectedResearcher).flatMap((row) => row.articleRows);
    renderTable(rows, ['Nome', 'Ano', 'Titulo', 'Periodico', 'ISSN', 'DOI', 'QualisCAPES', 'SJR', 'FaixaSJR', 'JCR', 'FaixaJCR', 'QuartilJCR', 'CategoriasJCR', 'FontePontuacao', 'PesoBruto', 'Peso']);
  } else if (state.activeTab === 'eventsDetail') {
    els.tabControls.innerHTML = researcherSelect();
    const rows = results.researchers.filter((row) => state.selectedResearcher === 'ALL' || row.name === state.selectedResearcher).flatMap((row) => row.eventRows.map((event) => ({ Nome: row.name, ...event })));
    renderTable(rows, ['Nome', 'NomeEvento', 'QualisCAPES', 'Ano', 'Peso']);
  }
  const filter = $('researcherFilter');
  if (filter) filter.addEventListener('change', () => { state.selectedResearcher = filter.value; renderActiveTab(); });
}

// -----------------------------------------------------------------------------
// Exportação CSV, XLSX, HTML e ZIP
// -----------------------------------------------------------------------------

function csvEscape(value, delimiter = ',') {
  const text = String(value ?? '');
  if (text.includes('"') || text.includes('\n') || text.includes('\r') || text.includes(delimiter)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function rowsToCsv(rows, columns = null, delimiter = ',') {
  const keys = columns || (rows.length ? Object.keys(rows[0]) : []);
  const lines = [keys.map((key) => csvEscape(key, delimiter)).join(delimiter)];
  for (const row of rows) lines.push(keys.map((key) => csvEscape(row[key] ?? '', delimiter)).join(delimiter));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

function columnName(index) {
  let number = index + 1;
  let name = '';
  while (number > 0) {
    const remainder = (number - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    number = Math.floor((number - 1) / 26);
  }
  return name;
}

function sheetXml(rows) {
  const widths = [];
  for (const row of rows) row.forEach((value, index) => { widths[index] = Math.min(42, Math.max(widths[index] || 8, String(value ?? '').length + 2)); });
  const cols = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${Math.max(9, width)}" customWidth="1"/>`).join('');
  const rowXml = rows.map((row, rowIndex) => {
    const cells = row.map((value, colIndex) => {
      const ref = `${columnName(colIndex)}${rowIndex + 1}`;
      const style = rowIndex === 0 ? ' s="1"' : '';
      if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"${style}><v>${value}</v></c>`;
      return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${escapeXml(value ?? '')}</t></is></c>`;
    }).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join('');
  const last = rows.length && rows[0].length ? `${columnName(rows[0].length - 1)}${rows.length}` : 'A1';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>${cols}</cols><sheetData>${rowXml}</sheetData><autoFilter ref="A1:${last}"/>
</worksheet>`;
}

function xlsxBytes(sheets) {
  const safeSheets = sheets.map((sheet, index) => ({ name: String(sheet.name || `Planilha${index + 1}`).slice(0, 31), rows: sheet.rows }));
  const contentOverrides = safeSheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
  const workbookSheets = safeSheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('');
  const workbookRels = safeSheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('');
  const styleRelId = safeSheets.length + 1;
  const entries = [
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${contentOverrides}</Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRels}<Relationship Id="rId${styleRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B3266"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` }
  ];
  safeSheets.forEach((sheet, index) => entries.push({ name: `xl/worksheets/sheet${index + 1}.xml`, data: sheetXml(sheet.rows) }));
  return zipStore(entries);
}

function objectRowsToMatrix(rows, columns) {
  return [columns, ...rows.map((row) => columns.map((column) => row[column] ?? ''))];
}

function makeReportHtml(results) {
  const table = (rows, columns, limit = 500) => `<table><thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead><tbody>${rows.slice(0, limit).map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(row[column] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const analytics = results.analytics;
  const summary = analytics.summary;
  const cards = [
    ['Currículos', results.researchers.length], ['Artigos únicos', summary.uniqueArticleCount],
    ['Pontuação total', formatNumber(summary.grandPoints)], ['Cobertura DOI', `${formatNumber(summary.doiCoverage, 1)}%`],
    ['Cobertura CAPES', `${formatNumber(summary.capesCoverage, 1)}%`],
    ['Cobertura SJR', `${formatNumber(summary.sjrCoverage, 1)}%`],
    ['Cobertura JCR', `${formatNumber(summary.jcrCoverage, 1)}%`],
    ['Gini', formatNumber(summary.gini, 3)]
  ].map(([label, value]) => `<div class="card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
  const indicatorColumns = ['Nomes', 'TotalPontos', 'Artigos', 'PontosPorArtigo', 'ArtigosQualisA', 'ArtigosJCRQ1', 'CoberturaDOI_pct', 'CoberturaCAPES_pct', 'CoberturaSJR_pct', 'CoberturaJCR_pct', 'Livros', 'Capitulos', 'OrientacoesConcluidas', 'OrientacoesAndamento', 'ProducaoTecnicaInovacao', 'ArtigosColaboracaoInterna', 'ParceirosInternos'];
  const journalColumns = ['Periodico', 'ISSN', 'ArtigosUnicos', 'PontuacaoReferencia', 'SJRMedio', 'JIFMedio', 'MelhorQuartilJCR', 'CategoriasJCR', 'NumeroDocentes', 'Docentes'];
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório PapaLattes Analítico</title><style>body{font-family:Arial,sans-serif;margin:28px;color:#172033}h1,h2{color:#0b3266}table{border-collapse:collapse;width:100%;margin:14px 0 30px;font-size:12px}th,td{border:1px solid #d9e1eb;padding:7px;text-align:left}th{background:#0b3266;color:#fff}tr:nth-child(even){background:#f5f8fb}.meta{color:#667085}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.card{border:1px solid #d9e1eb;border-radius:10px;padding:12px}.card span{display:block;color:#667085;font-size:12px}.card strong{display:block;color:#08244a;font-size:22px;margin-top:4px}@media(max-width:700px){.cards{grid-template-columns:1fr}}</style></head><body><h1>PapaLattes Web Analítico</h1><p class="meta">Período: ${results.config.start}–${results.config.end} | Pontuação: ${scoreModeLabel(results.config.scoreMode)} | Regras corrigidas 1.2.1 | JCR 2026 (JIF 2025) | Gerado em: ${new Date().toLocaleString('pt-BR')}</p><div class="cards">${cards}</div><h2>Pontuação total</h2>${table(results.totalRows, ['Nomes', 'TotalPontos'])}<h2>Indicadores por docente</h2>${table(analytics.indicatorRows, indicatorColumns)}<h2>Produção anual</h2>${table(analytics.annualRows, ['Ano', 'Artigos', 'ArtigosUnicos', 'Livros', 'CapLivros', 'TrabCompleto', 'OrientacoesConcluidas', 'OrientacoesAndamento', 'Bancas', 'ProducaoTecnicaInovacao', 'PontuacaoArtigosUnicos'])}<h2>Qualidade dos artigos</h2>${table(analytics.qualityRows, ['Sistema', 'Estrato', 'Artigos'])}<h2>Periódicos mais frequentes</h2>${table(analytics.journalRows, journalColumns, 100)}<h2>Colaborações internas</h2>${table(analytics.collaborationRows, ['Docente1', 'Docente2', 'ArtigosCompartilhados', 'PontuacaoCompartilhada'], 100)}<h2>Quantidade de produtos</h2>${table(results.quantityRows, results.columns)}<h2>Pontuação por produto</h2>${table(results.pointsRows, results.columns)}<h2>Faixas SJR</h2>${table(results.sjrPercentiles, ['TipoSJR', 'SJRmin', 'SJRmax', 'Pesos'])}<h2>Faixas JCR</h2>${table(results.jcrPercentiles, ['TipoJCR', 'JCRmin', 'JCRmax', 'Pesos'])}</body></html>`;
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function buildDownloadZip() {
  const results = state.results;
  if (!results) throw new Error('Não há resultados para baixar.');
  const { start, end, scoreMode } = results.config;
  const prefix = `Prod_${start}_${end}_${scoreMode}`;
  const entries = [];
  const analytics = results.analytics;

  // Arquivos históricos preservados e nova tabela de faixas JCR.
  const xlsxFiles = [
    [`${prefix}_PontuacaoTotal.xlsx`, 'PontuacaoTotal', results.totalRows, ['Nomes', 'TotalPontos']],
    [`${prefix}_QuantidadeProdutos.xlsx`, 'QuantidadeProdutos', results.quantityRows, results.columns],
    [`${prefix}_PontuacaoProdutos.xlsx`, 'PontuacaoProdutos', results.pointsRows, results.columns],
    [`${prefix}_SJR_Percentis.xlsx`, 'SJR_Percentis', results.sjrPercentiles, ['TipoSJR', 'SJRmin', 'SJRmax', 'Pesos']],
    [`${prefix}_JCR_Faixas.xlsx`, 'JCR_Faixas', results.jcrPercentiles, ['TipoJCR', 'JCRmin', 'JCRmax', 'Pesos']]
  ];
  for (const [name, sheetName, rows, columns] of xlsxFiles) {
    entries.push({ name, data: xlsxBytes([{ name: sheetName, rows: objectRowsToMatrix(rows, columns) }]) });
  }

  const indicatorColumns = ['Nomes', 'TotalPontos', 'Artigos', 'PontosPorArtigo', 'ArtigosQualisA', 'ArtigosJCRQ1', 'CoberturaDOI_pct', 'CoberturaCAPES_pct', 'CoberturaSJR_pct', 'CoberturaJCR_pct', 'Livros', 'Capitulos', 'OrientacoesConcluidas', 'OrientacoesAndamento', 'ProducaoTecnicaInovacao', 'ArtigosColaboracaoInterna', 'ParceirosInternos', 'BolsistaProdutividade'];
  const annualColumns = ['Ano', 'Artigos', 'ArtigosUnicos', 'Livros', 'CapLivros', 'TrabCompleto', 'OrientacoesConcluidas', 'OrientacoesAndamento', 'Bancas', 'ProducaoTecnicaInovacao', 'PontuacaoArtigosUnicos'];
  const qualityColumns = ['Sistema', 'Estrato', 'Artigos'];
  const journalColumns = ['Periodico', 'ISSN', 'ArtigosUnicos', 'PontuacaoReferencia', 'SJRMedio', 'JIFMedio', 'MelhorQuartilJCR', 'CategoriasJCR', 'NumeroDocentes', 'Docentes'];
  const collaborationColumns = ['Docente1', 'Docente2', 'ArtigosCompartilhados', 'PontuacaoCompartilhada'];
  const uniqueArticleColumns = ['Ano', 'Titulo', 'Periodico', 'ISSN', 'DOI', 'QualisCAPES', 'SJR', 'FaixaSJR', 'JCR', 'FaixaJCR', 'QuartilJCR', 'CategoriasJCR', 'PesoReferencia', 'NumeroDocentesUFJ', 'DocentesUFJ', 'ParticipacoesNosCurriculos'];

  entries.push({
    name: `${prefix}_Completo.xlsx`,
    data: xlsxBytes([
      { name: 'PontuacaoTotal', rows: objectRowsToMatrix(results.totalRows, ['Nomes', 'TotalPontos']) },
      { name: 'QuantidadeProdutos', rows: objectRowsToMatrix(results.quantityRows, results.columns) },
      { name: 'PontuacaoProdutos', rows: objectRowsToMatrix(results.pointsRows, results.columns) },
      { name: 'SJR_Percentis', rows: objectRowsToMatrix(results.sjrPercentiles, ['TipoSJR', 'SJRmin', 'SJRmax', 'Pesos']) },
      { name: 'JCR_Faixas', rows: objectRowsToMatrix(results.jcrPercentiles, ['TipoJCR', 'JCRmin', 'JCRmax', 'Pesos']) },
      { name: 'IndicadoresDocentes', rows: objectRowsToMatrix(analytics.indicatorRows, indicatorColumns) },
      { name: 'ProducaoAnual', rows: objectRowsToMatrix(analytics.annualRows, annualColumns) },
      { name: 'QualidadeArtigos', rows: objectRowsToMatrix(analytics.qualityRows, qualityColumns) },
      { name: 'Periodicos', rows: objectRowsToMatrix(analytics.journalRows, journalColumns) },
      { name: 'Colaboracoes', rows: objectRowsToMatrix(analytics.collaborationRows, collaborationColumns) },
      { name: 'ArtigosUnicos', rows: objectRowsToMatrix(analytics.uniqueArticles, uniqueArticleColumns) }
    ])
  });

  entries.push({
    name: `${prefix}_AnalisesInstitucionais.xlsx`,
    data: xlsxBytes([
      { name: 'IndicadoresDocentes', rows: objectRowsToMatrix(analytics.indicatorRows, indicatorColumns) },
      { name: 'ProducaoAnual', rows: objectRowsToMatrix(analytics.annualRows, annualColumns) },
      { name: 'QualidadeArtigos', rows: objectRowsToMatrix(analytics.qualityRows, qualityColumns) },
      { name: 'Periodicos', rows: objectRowsToMatrix(analytics.journalRows, journalColumns) },
      { name: 'Colaboracoes', rows: objectRowsToMatrix(analytics.collaborationRows, collaborationColumns) },
      { name: 'ArtigosUnicos', rows: objectRowsToMatrix(analytics.uniqueArticles, uniqueArticleColumns) },
      { name: 'ComposicaoPontos', rows: objectRowsToMatrix(analytics.productPointsRows, ['Categoria', 'Codigo', 'Pontuacao']) },
      { name: 'ComposicaoQuantidades', rows: objectRowsToMatrix(analytics.productQuantityRows, ['Categoria', 'Codigo', 'Quantidade']) },
      { name: 'FaixasSJR', rows: objectRowsToMatrix(results.sjrPercentiles, ['TipoSJR', 'SJRmin', 'SJRmax', 'Pesos']) },
      { name: 'FaixasJCR', rows: objectRowsToMatrix(results.jcrPercentiles, ['TipoJCR', 'JCRmin', 'JCRmax', 'Pesos']) }
    ])
  });

  entries.push({ name: `Analises/${prefix}_IndicadoresDocentes.csv`, data: rowsToCsv(analytics.indicatorRows, indicatorColumns, ';') });
  entries.push({ name: `Analises/${prefix}_ProducaoAnual.csv`, data: rowsToCsv(analytics.annualRows, annualColumns, ';') });
  entries.push({ name: `Analises/${prefix}_QualidadeArtigos.csv`, data: rowsToCsv(analytics.qualityRows, qualityColumns, ';') });
  entries.push({ name: `Analises/${prefix}_Periodicos.csv`, data: rowsToCsv(analytics.journalRows, journalColumns, ';') });
  entries.push({ name: `Analises/${prefix}_ColaboracoesInternas.csv`, data: rowsToCsv(analytics.collaborationRows, collaborationColumns, ';') });
  entries.push({ name: `Analises/${prefix}_ArtigosUnicos.csv`, data: rowsToCsv(analytics.uniqueArticles, uniqueArticleColumns, ';') });
  entries.push({ name: `Analises/${prefix}_ComposicaoPontuacao.csv`, data: rowsToCsv(analytics.productPointsRows, ['Categoria', 'Codigo', 'Pontuacao'], ';') });
  entries.push({ name: `Analises/${prefix}_FaixasSJR.csv`, data: rowsToCsv(results.sjrPercentiles, ['TipoSJR', 'SJRmin', 'SJRmax', 'Pesos'], ';') });
  entries.push({ name: `Analises/${prefix}_FaixasJCR.csv`, data: rowsToCsv(results.jcrPercentiles, ['TipoJCR', 'JCRmin', 'JCRmax', 'Pesos'], ';') });

  for (const researcher of results.researchers) {
    const base = `${safeFileName(researcher.name)}${start}-${end}_${scoreMode}`;
    // Arquivos anteriores preservados.
    entries.push({ name: `Artigos_docentes/${base}.csv`, data: rowsToCsv(researcher.articleRows, ['Nome', 'Periodico', 'ISSN', 'QualisCAPES', 'SJR', 'Ano', 'Peso']) });
    if (researcher.eventRows.length) entries.push({ name: `Trabalhos_completos/${base}.csv`, data: rowsToCsv(researcher.eventRows, ['NomeEvento', 'QualisCAPES', 'Ano', 'Peso']) });
    // Versão detalhada adicional com JCR.
    entries.push({
      name: `Artigos_docentes_detalhados/${base}.csv`,
      data: rowsToCsv(researcher.articleRows, ['Nome', 'Ano', 'Titulo', 'Periodico', 'ISSN', 'DOI', 'QualisCAPES', 'SJR', 'FaixaSJR', 'JCR', 'FaixaJCR', 'QuartilJCR', 'CategoriasJCR', 'FontePontuacao', 'PesoBruto', 'Peso', 'NumeroAutores', 'Autores'], ';')
    });
  }

  entries.push({ name: 'Relatorio_PapaLattes.html', data: makeReportHtml(results) });
  entries.push({
    name: 'LEIA-ME.txt',
    data: `PapaLattes Web Analítico\r\nPeríodo: ${start}-${end}\r\nPontuação: ${scoreModeLabel(scoreMode)}\r\nRegras: PapaLattes 1.2.1 corrigidas\r\nJCR: edição 2026, Fator de Impacto de 2025\r\nCurrículos processados: ${results.researchers.length}\r\nParticipações em artigos: ${analytics.articleParticipations.length}\r\nArtigos únicos: ${analytics.summary.uniqueArticleCount}\r\nCobertura CAPES: ${formatNumber(analytics.summary.capesCoverage, 1)}%\r\nCobertura SJR: ${formatNumber(analytics.summary.sjrCoverage, 1)}%\r\nCobertura JCR: ${formatNumber(analytics.summary.jcrCoverage, 1)}%\r\nArtigos com colaboração interna: ${analytics.summary.collaborationArticleCount}\r\n\r\nOs quatro arquivos XLSX históricos foram mantidos e foi acrescentado o arquivo de faixas JCR. O pacote também inclui análises institucionais, indicadores docentes, produção anual, qualidade, periódicos, colaborações e artigos únicos.\r\nGerado em: ${new Date().toLocaleString('pt-BR')}\r\n`
  });
  return zipStore(entries);
}

function prepareDownloadLink() {
  if (!state.results) return;
  if (state.downloadUrl) URL.revokeObjectURL(state.downloadUrl);
  const bytes = buildDownloadZip();
  const config = state.results.config;
  const fileName = `PapaLattes_Resultados_${config.start}_${config.end}_${config.scoreMode}.zip`;
  state.downloadUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
  [els.downloadLink, els.downloadLinkResults].forEach((link) => {
    link.href = state.downloadUrl;
    link.download = fileName;
    link.textContent = `Baixar resultados — ${fileName}`;
    link.classList.remove('hidden');
  });
}

async function downloadResults() {
  if (!state.downloadUrl) prepareDownloadLink();
  els.downloadLink.click();
}

// -----------------------------------------------------------------------------
// Eventos da interface
// -----------------------------------------------------------------------------

function updateFileSummary() {
  const files = Array.from(els.lattesFiles.files || []);
  if (!files.length) { els.fileSummary.textContent = 'Nenhum currículo selecionado.'; return; }
  const total = files.reduce((sum, file) => sum + file.size, 0);
  els.fileSummary.innerHTML = `<strong>${files.length} arquivo(s)</strong> — ${(total / 1024 / 1024).toFixed(2)} MB<br>${files.slice(0, 8).map((file) => escapeHtml(file.name)).join(' · ')}${files.length > 8 ? '…' : ''}`;
}

function installEvents() {
  els.toggleRefs.addEventListener('click', () => {
    const hidden = els.referencePanel.classList.toggle('hidden');
    els.toggleRefs.textContent = hidden ? 'Mostrar arquivos' : 'Ocultar arquivos';
  });
  bindReferenceInput(els.qualisFile, 'qualis');
  bindReferenceInput(els.sjrFile, 'sjr');
  bindReferenceInput(els.jcrFile, 'jcr');
  bindReferenceInput(els.eventsFile, 'events');
  bindReferenceInput(els.articleWeightsFile, 'articleWeights');
  bindReferenceInput(els.generalWeightsFile, 'generalWeights');
  bindReferenceInput(els.fellowsFile, 'fellows');

  els.lattesFiles.addEventListener('change', updateFileSummary);
  ['dragenter', 'dragover'].forEach((eventName) => els.dropZone.addEventListener(eventName, (event) => { event.preventDefault(); els.dropZone.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach((eventName) => els.dropZone.addEventListener(eventName, (event) => { event.preventDefault(); els.dropZone.classList.remove('dragover'); }));
  els.dropZone.addEventListener('drop', (event) => {
    const files = Array.from(event.dataTransfer.files).filter((file) => /\.(zip|xml)$/i.test(file.name));
    if (!files.length) return;
    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    els.lattesFiles.files = transfer.files;
    updateFileSummary();
  });

  els.processBtn.addEventListener('click', async () => {
    try { await processAll(); }
    catch (error) {
      console.error(error);
      els.progressSection.classList.remove('hidden');
      log(`ERRO: ${error.message}`);
      els.progressLabel.textContent = 'Falha no processamento';
      els.tableContainer.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
    }
  });
  [els.downloadLink, els.downloadLinkResults].forEach((link) => link.addEventListener('click', () => {
    log('Download do pacote de resultados iniciado.');
  }));
  els.profileResearcher.addEventListener('change', () => {
    state.profileResearcher = els.profileResearcher.value;
    renderProfileSection();
  });
  els.profileAnalysisMode.addEventListener('change', () => {
    state.profileView = els.profileAnalysisMode.value;
    renderProfileSection();
  });
  window.addEventListener('beforeunload', () => {
    if (state.downloadUrl) URL.revokeObjectURL(state.downloadUrl);
  });
  document.querySelectorAll('.tab').forEach((button) => button.addEventListener('click', () => {
    state.activeTab = button.dataset.tab;
    state.selectedResearcher = 'ALL';
    document.querySelectorAll('.tab').forEach((item) => item.classList.toggle('active', item === button));
    renderActiveTab();
  }));
}

function initialize() {
  cacheElements();
  Object.keys(DEFAULT_FILES).forEach((key) => markReferenceStatus(key, 'ready'));
  installEvents();
}

document.addEventListener('DOMContentLoaded', initialize);
