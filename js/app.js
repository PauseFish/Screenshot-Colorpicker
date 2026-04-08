'use strict';

/* ================================================================
   State
   ================================================================ */
const state = {
  imageLoaded:     false,
  originalPalette: [],   // unsorted — used for live re-sorting
  palette:         [],
  format:          'png',
  exportSize:      256,
  layout:          'grid',
};

/* ================================================================
   DOM refs
   ================================================================ */
const $  = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

const uploadSection    = $('uploadSection');
const workspace        = $('workspace');
const dropZone         = $('dropZone');
const fileInput        = $('fileInput');
const browseBtn        = $('browseBtn');
const previewSection   = $('previewSection');
const previewImage     = $('previewImage');
const imageContainer   = $('imageContainer');
const fileNameEl       = $('fileName');
const changeImageBtn   = $('changeImageBtn');
const fitContainBtn    = $('fitContain');
const fitCoverBtn      = $('fitCover');
const numColorsSelect  = $('numColors');
const sortBySelect     = $('sortBy');
const sampleQuality    = $('sampleQuality');
const sampleQualityVal = $('sampleQualityVal');
const ignoreNearWhite  = $('ignoreNearWhite');
const ignoreNearBlack  = $('ignoreNearBlack');
const ignoreGray       = $('ignoreGray');
const extractBtn       = $('extractBtn');
const paletteSection   = $('paletteSection');
const paletteGrid      = $('paletteGrid');
const viewSwatchesBtn  = $('viewSwatches');
const viewListBtn      = $('viewList');
const copyAllBtn       = $('copyAllBtn');
const exportSection    = $('exportSection');
const showHexOnExport  = $('showHexOnExport');
const exportBtn        = $('exportBtn');
const extractCanvas    = $('extractCanvas');
const toastEl          = $('toast');
// showHexOnExport removed — export never includes hex labels

/* ================================================================
   File Input / Upload
   ================================================================ */
function openFilePicker() { fileInput.click(); }

dropZone.addEventListener('click', openFilePicker);
browseBtn.addEventListener('click', e => { e.stopPropagation(); openFilePicker(); });
browseBtn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFilePicker(); } });

changeImageBtn.addEventListener('click', () => { fileInput.value = ''; openFilePicker(); });

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) loadFile(fileInput.files[0]);
});

/* Drag-and-drop */
dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('is-over'); });
dropZone.addEventListener('dragleave', ()  => dropZone.classList.remove('is-over'));
dropZone.addEventListener('dragend',   ()  => dropZone.classList.remove('is-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('is-over');
  const file = e.dataTransfer?.files?.[0];
  if (file && file.type.startsWith('image/')) loadFile(file);
});

function loadFile(file) {
  const reader = new FileReader();
  reader.onload = ev => {
    previewImage.onload = () => {
      state.imageLoaded = true;
      fileNameEl.textContent = file.name;

      uploadSection.hidden  = true;
      workspace.hidden      = false;
      paletteSection.hidden = true;
      exportSection.hidden  = true;
      state.originalPalette = [];
      state.palette = [];

      workspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    previewImage.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

/* ================================================================
   Image fit toggle
   ================================================================ */
fitContainBtn.addEventListener('click', () => {
  imageContainer.classList.remove('is-cover');
  activateInGroup(fitContainBtn, [fitContainBtn, fitCoverBtn]);
});
fitCoverBtn.addEventListener('click', () => {
  imageContainer.classList.add('is-cover');
  activateInGroup(fitCoverBtn, [fitContainBtn, fitCoverBtn]);
});

/* ================================================================
   Quality slider — live badge update
   ================================================================ */
sampleQuality.addEventListener('input', () => {
  sampleQualityVal.textContent = sampleQuality.value;
});

/* ================================================================
   Sort select — live re-sort without re-extracting
   ================================================================ */
sortBySelect.addEventListener('change', () => {
  if (state.originalPalette.length) {
    state.palette = sortPalette([...state.originalPalette], sortBySelect.value);
    renderPalette();
  }
});

/* ================================================================
   Color Extraction
   ================================================================ */
extractBtn.addEventListener('click', () => {
  if (!state.imageLoaded) return;
  extractBtn.disabled = true;
  extractBtn.textContent = 'Extracting…';
  // Yield to browser to paint the disabled state before the CPU-heavy work
  requestAnimationFrame(() => setTimeout(runExtraction, 0));
});

function runExtraction() {
  /* Draw image to off-screen canvas */
  const ctx = extractCanvas.getContext('2d');
  extractCanvas.width  = previewImage.naturalWidth;
  extractCanvas.height = previewImage.naturalHeight;
  ctx.drawImage(previewImage, 0, 0);

  let pixels = samplePixels(
    ctx.getImageData(0, 0, extractCanvas.width, extractCanvas.height).data,
    parseInt(sampleQuality.value, 10)
  );

  /* Apply user filters */
  if (ignoreNearWhite.checked)
    pixels = pixels.filter(([r,g,b]) => !(r > 220 && g > 220 && b > 220));
  if (ignoreNearBlack.checked)
    pixels = pixels.filter(([r,g,b]) => !(r < 35  && g < 35  && b < 35));
  if (ignoreGray.checked)
    pixels = pixels.filter(([r,g,b]) => Math.max(r,g,b) - Math.min(r,g,b) > 30);

  if (!pixels.length) {
    showToast('No pixels matched — try disabling some filters.');
    resetExtractBtn();
    return;
  }

  const numColors = parseInt(numColorsSelect.value, 10);
  const raw = medianCut(pixels, numColors);

  state.originalPalette = raw;
  state.palette = sortPalette([...raw], sortBySelect.value);

  renderPalette();
  paletteSection.hidden = false;
  exportSection.hidden  = false;
  paletteSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  resetExtractBtn();
}

function resetExtractBtn() {
  extractBtn.disabled = false;
  extractBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
    <circle cx="7.5" cy="10.5" r="1" fill="currentColor"/><circle cx="10.5" cy="7.5" r="1" fill="currentColor"/>
    <circle cx="14.5" cy="7.5" r="1" fill="currentColor"/><circle cx="17.5" cy="10.5" r="1" fill="currentColor"/>
  </svg> Extract Colors`;
}

/* ================================================================
   Pixel Sampling
   target 10 000–100 000 samples based on quality (1–10)
   ================================================================ */
function samplePixels(data, quality) {
  const totalPixels   = data.length / 4;
  const targetSamples = quality * 10000;
  const step          = Math.max(1, Math.floor(totalPixels / targetSamples)) * 4;
  const out = [];
  for (let i = 0; i < data.length; i += step) {
    if (data[i + 3] > 128)                          // skip transparent
      out.push([data[i], data[i+1], data[i+2]]);
  }
  return out;
}

/* ================================================================
   Median-Cut Colour Quantisation
   ================================================================ */
function medianCut(pixels, numColors) {
  if (!pixels.length) return [];

  let buckets = [pixels];

  while (buckets.length < numColors) {
    // Find the bucket with the widest colour range on any channel
    let bestIdx  = -1;
    let bestSpan = -1;

    for (let i = 0; i < buckets.length; i++) {
      if (buckets[i].length < 2) continue;
      const { span } = bucketRange(buckets[i]);
      if (span > bestSpan) { bestSpan = span; bestIdx = i; }
    }

    if (bestIdx === -1) break;   // all remaining buckets are singleton

    const [bucket] = buckets.splice(bestIdx, 1);
    const { ch } = bucketRange(bucket);

    // Sort along widest axis and split at the median
    bucket.sort((a, b) => a[ch] - b[ch]);
    const mid = bucket.length >> 1;
    buckets.push(bucket.slice(0, mid), bucket.slice(mid));
  }

  return buckets.map(b => {
    let sr = 0, sg = 0, sb = 0;
    for (const [r, g, bl] of b) { sr += r; sg += g; sb += bl; }
    return {
      r:     Math.round(sr / b.length),
      g:     Math.round(sg / b.length),
      b:     Math.round(sb / b.length),
      count: b.length,
    };
  });
}

function bucketRange(pixels) {
  let mnR = 255, mxR = 0, mnG = 255, mxG = 0, mnB = 255, mxB = 0;
  for (const [r, g, b] of pixels) {
    if (r < mnR) mnR = r;  if (r > mxR) mxR = r;
    if (g < mnG) mnG = g;  if (g > mxG) mxG = g;
    if (b < mnB) mnB = b;  if (b > mxB) mxB = b;
  }
  const rR = mxR - mnR, rG = mxG - mnG, rB = mxB - mnB;
  let ch = 0, span = rR;
  if (rG > span) { span = rG; ch = 1; }
  if (rB > span) { span = rB; ch = 2; }
  return { ch, span };
}

/* ================================================================
   Palette Utilities
   ================================================================ */
function sortPalette(pal, by) {
  switch (by) {
    case 'frequency':  return pal.sort((a, b) => b.count   - a.count);
    case 'hue':        return pal.sort((a, b) => toHsl(a).h - toHsl(b).h);
    case 'brightness': return pal.sort((a, b) => luma(b)   - luma(a));
    case 'saturation': return pal.sort((a, b) => toHsl(b).s - toHsl(a).s);
    default:           return pal;
  }
}

function toHex({ r, g, b }) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function luma({ r, g, b }) { return 0.299 * r + 0.587 * g + 0.114 * b; }

function toHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

/* ================================================================
   Render Palette
   ================================================================ */
function renderPalette() {
  paletteGrid.innerHTML = '';
  const total = state.palette.reduce((s, c) => s + c.count, 0);

  for (const color of state.palette) {
    const hex = toHex(color);
    const pct = total > 0 ? ((color.count / total) * 100).toFixed(1) : '0.0';

    const btn = document.createElement('button');
    btn.className = 'swatch';
    btn.type      = 'button';
    btn.title     = `${hex.toUpperCase()} · ${pct}% — click to copy`;
    btn.innerHTML = `
      <span class="swatch-color" style="background:${hex}"></span>
      <span class="swatch-info">
        <span class="swatch-hex">${hex.toUpperCase()}</span>
        <span class="swatch-pct">${pct}%</span>
      </span>`;
    btn.addEventListener('click', () => copyText(hex.toUpperCase(), `Copied ${hex.toUpperCase()}`));
    paletteGrid.appendChild(btn);
  }
}

/* View toggle */
viewSwatchesBtn.addEventListener('click', () => {
  paletteGrid.classList.remove('is-list');
  activateInGroup(viewSwatchesBtn, [viewSwatchesBtn, viewListBtn]);
});
viewListBtn.addEventListener('click', () => {
  paletteGrid.classList.add('is-list');
  activateInGroup(viewListBtn, [viewSwatchesBtn, viewListBtn]);
});

/* Copy all */
copyAllBtn.addEventListener('click', () => {
  const all = state.palette.map(c => toHex(c).toUpperCase()).join('\n');
  copyText(all, 'All hex codes copied!');
});

/* ================================================================
   Clipboard
   ================================================================ */
function copyText(text, successMsg) {
  const done = () => showToast(successMsg);
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}

function fallbackCopy(text, cb) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
  cb();
}

/* ================================================================
   Toast
   ================================================================ */
let toastTimer;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  // Re-trigger the CSS animation on repeated calls
  toastEl.style.animation = 'none';
  void toastEl.offsetWidth;   // force reflow
  toastEl.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2200);
}

/* ================================================================
   Export controls
   ================================================================ */
$$('.format-btn').forEach(btn =>
  btn.addEventListener('click', () => {
    state.format = btn.dataset.format;
    activateInGroup(btn, $$('.format-btn'));
  })
);

$$('.size-btn').forEach(btn =>
  btn.addEventListener('click', () => {
    state.exportSize = parseInt(btn.dataset.size, 10);
    activateInGroup(btn, $$('.size-btn'));
  })
);

$$('.layout-btn').forEach(btn =>
  btn.addEventListener('click', () => {
    state.layout = btn.dataset.layout;
    activateInGroup(btn, $$('.layout-btn'));
  })
);

exportBtn.addEventListener('click', () => {
  if (!state.palette.length) return;
  const { format, exportSize: sz, layout } = state;
  if (format === 'png') exportAsPng(sz, layout);
  else                  exportAsSvg(sz, layout);
});

/* ================================================================
   Export — PNG
   ================================================================ */
function exportAsPng(size, layout) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  drawPalette(c.getContext('2d'), state.palette, size, size, layout);
  c.toBlob(blob => {
    download(URL.createObjectURL(blob), `palette-${size}x${size}.png`);
  }, 'image/png');
}

/* ================================================================
   Export — SVG
   ================================================================ */
function exportAsSvg(size, layout) {
  const shapes = buildSvgShapes(state.palette, size, size, layout);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${shapes}
</svg>`;
  download(URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })),
           `palette-${size}x${size}.svg`);
}

/* ================================================================
   Drawing — Canvas
   Cells are flush edge-to-edge: no padding, no gap, no rounded corners.
   Pixel boundaries are snapped to integers to avoid sub-pixel gaps.
   ================================================================ */
function drawPalette(ctx, palette, W, H, layout) {
  if (layout === 'grid') {
    const cols = Math.ceil(Math.sqrt(palette.length));
    const rows = Math.ceil(palette.length / cols);
    palette.forEach((color, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      // Derive x/y from rounded boundaries so adjacent cells share the same edge pixel
      const x1 = Math.round(col       * W / cols);
      const y1 = Math.round(row       * H / rows);
      const x2 = Math.round((col + 1) * W / cols);
      const y2 = Math.round((row + 1) * H / rows);
      ctx.fillStyle = toHex(color);
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
    });
  } else {
    /* Strips */
    const cnt = palette.length;
    palette.forEach((color, i) => {
      const y1 = Math.round(i       * H / cnt);
      const y2 = Math.round((i + 1) * H / cnt);
      ctx.fillStyle = toHex(color);
      ctx.fillRect(0, y1, W, y2 - y1);
    });
  }
}

/* ================================================================
   Drawing — SVG shapes string
   Same flush layout; SVG handles sub-pixel naturally.
   ================================================================ */
function buildSvgShapes(palette, W, H, layout) {
  let out = '';
  if (layout === 'grid') {
    const cols = Math.ceil(Math.sqrt(palette.length));
    const rows = Math.ceil(palette.length / cols);
    palette.forEach((color, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = n(col       * W / cols);
      const y = n(row       * H / rows);
      const w = n((col + 1) * W / cols - col * W / cols);
      const h = n((row + 1) * H / rows - row * H / rows);
      out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${toHex(color).toUpperCase()}"/>\n`;
    });
  } else {
    const cnt = palette.length;
    palette.forEach((color, i) => {
      const y = n(i       * H / cnt);
      const h = n((i + 1) * H / cnt - i * H / cnt);
      out += `<rect x="0" y="${y}" width="${W}" height="${h}" fill="${toHex(color).toUpperCase()}"/>\n`;
    });
  }
  return out;
}

/* ================================================================
   Helpers
   ================================================================ */

/** Round a number to 2 decimal places for SVG attribute cleanliness */
const n = v => parseFloat(v.toFixed(2));

function download(url, filename) {
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Toggle the .active class within a group of elements */
function activateInGroup(active, group) {
  (group instanceof NodeList ? [...group] : group)
    .forEach(el => el.classList.toggle('active', el === active));
}
