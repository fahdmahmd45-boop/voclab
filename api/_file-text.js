'use strict';

const pdfParse = require('pdf-parse');
const JSZip = require('jszip');

const MAX_MODEL_FILE_CHARS = 18000;
const MIN_USEFUL_TEXT_CHARS = 24;

function decodeDataUrl(fileData) {
  const match = /^data:([^;,]*)(?:;[^,]*)*;base64,([A-Za-z0-9+/=]+)$/i.exec(String(fileData || ''));
  if (!match) return null;
  try { return Buffer.from(match[2], 'base64'); } catch { return null; }
}

function decodeXmlEntities(text) {
  return String(text || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Math.min(0x10ffff, Number(n) || 0)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Math.min(0x10ffff, parseInt(n, 16) || 0)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'");
}

function xmlToText(xml) {
  return decodeXmlEntities(String(xml || '')
    .replace(/<(?:w:tab|a:tab)\b[^>]*\/?\s*>/gi, '\t')
    .replace(/<(?:w:br|a:br)\b[^>]*\/?\s*>/gi, '\n')
    .replace(/<\/(?:w:p|a:p|row|si|c|v)>/gi, '\n')
    .replace(/<[^>]+>/g, ' '));
}

function normalizeText(text) {
  const lines = String(text || '')
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\f\v ]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  // PDF headers/footers are often repeated on every page. Keeping the first copy
  // reduces token waste without changing the actual vocabulary source.
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    const key = line.length <= 220 ? line.toLowerCase() : null;
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(line);
  }
  return out.join('\n').trim();
}

function sampleAcrossText(text, maxChars = MAX_MODEL_FILE_CHARS) {
  const source = String(text || '').trim();
  if (source.length <= maxChars) return { text: source, sampled: false, sourceChars: source.length };

  const chunks = 6;
  const chunkSize = Math.floor(maxChars / chunks);
  const maxStart = Math.max(0, source.length - chunkSize);
  const parts = [];

  for (let i = 0; i < chunks; i++) {
    const ratio = chunks === 1 ? 0 : i / (chunks - 1);
    let start = Math.floor(maxStart * ratio);
    if (start > 0) {
      const nextBreak = source.indexOf('\n', start);
      if (nextBreak !== -1 && nextBreak - start < 220) start = nextBreak + 1;
    }
    let part = source.slice(start, start + chunkSize);
    if (start + chunkSize < source.length) {
      const lastBreak = part.lastIndexOf('\n');
      if (lastBreak > chunkSize * 0.7) part = part.slice(0, lastBreak);
    }
    if (part.trim()) parts.push(part.trim());
  }

  return { text: parts.join('\n\n'), sampled: true, sourceChars: source.length };
}

function naturalSort(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

async function openXmlText(buffer, ext) {
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
  let selected = [];

  if (ext === 'docx') {
    selected = names.filter((name) => /^word\/(?:document|header\d+|footer\d+|footnotes|endnotes)\.xml$/i.test(name));
  } else if (ext === 'pptx') {
    selected = names.filter((name) => /^ppt\/(?:slides\/slide\d+|notesSlides\/notesSlide\d+)\.xml$/i.test(name));
  } else if (ext === 'xlsx') {
    selected = names.filter((name) => /^xl\/(?:sharedStrings|worksheets\/sheet\d+)\.xml$/i.test(name));
  }

  selected.sort(naturalSort);
  const pieces = [];
  for (const name of selected) {
    const xml = await zip.files[name].async('string');
    const text = xmlToText(xml);
    if (text.trim()) pieces.push(text);
  }
  return pieces.join('\n');
}

async function extractFileText(ext, fileData) {
  const buffer = decodeDataUrl(fileData);
  if (!buffer || !buffer.length) {
    return { ok: false, status: 400, code: 'FILE_DATA_INVALID', error: 'Please choose the file again.' };
  }

  let raw = '';
  try {
    if (ext === 'pdf') {
      const parsed = await pdfParse(buffer);
      raw = String(parsed?.text || '');
    } else if (ext === 'txt' || ext === 'csv' || ext === 'json' || ext === 'md') {
      raw = buffer.toString('utf8');
    } else if (ext === 'docx' || ext === 'pptx' || ext === 'xlsx') {
      raw = await openXmlText(buffer, ext);
    } else if (ext === 'doc' || ext === 'ppt' || ext === 'xls') {
      return {
        ok: false,
        status: 400,
        code: 'LEGACY_OFFICE_FORMAT',
        error: 'Please save this older Office file as DOCX, PPTX, XLSX, or PDF, then upload it again.'
      };
    } else {
      return { ok: false, status: 400, code: 'FILE_TYPE_UNSUPPORTED', error: 'This file type is not supported.' };
    }
  } catch (error) {
    console.error('File text extraction failed', ext, error?.message || error);
    return {
      ok: false,
      status: 422,
      code: 'FILE_TEXT_READ_FAILED',
      error: 'VocLab could not read text from this file. Try exporting it again as a searchable PDF or modern Office file.'
    };
  }

  const normalized = normalizeText(raw);
  if (normalized.length < MIN_USEFUL_TEXT_CHARS) {
    return {
      ok: false,
      status: 422,
      code: 'FILE_TEXT_EMPTY',
      error: ext === 'pdf'
        ? 'This PDF does not contain enough readable text. If it is scanned, export it as a searchable PDF and try again.'
        : 'This file does not contain enough readable text to extract vocabulary.'
    };
  }

  const sampled = sampleAcrossText(normalized);
  return {
    ok: true,
    text: sampled.text,
    sampled: sampled.sampled,
    sourceChars: sampled.sourceChars,
    modelChars: sampled.text.length
  };
}

module.exports = {
  MAX_MODEL_FILE_CHARS,
  extractFileText,
  normalizeText,
  sampleAcrossText
};
