'use strict';

/* ================================================================
   State
   ================================================================ */
const state = {
  images:        [],    // [{ id, name, dataUrl, originalPalette, palette, extracted }]
  activeImageId: null,
  format:        'png',
  exportSize:    256,
  layout:        'grid',
  textureN:      4,
  textureSlots:  Array(16).fill(null),   // null | { r, g, b, count }
  texFormat:     'png',
  texExportSize: 256,
};

const activeImg = () => state.images.find(img => img.id === state.activeImageId) || null;

/* ================================================================
   Drag state
   ================================================================ */
const drag = { active: false, type: null, color: null, slotIdx: null };

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
const exportBtn        = $('exportBtn');
const extractCanvas    = $('extractCanvas');
const toastEl          = $('toast');
const historyStrip     = $('historyStrip');
const historyCount     = $('historyCount');
const textureGrid      = $('textureGrid');
const clearTextureBtn  = $('clearTextureBtn');
const exportTextureBtn = $('exportTextureBtn');

/* ================================================================
   File Input / Upload
   ================================================================ */
function openFilePicker() { fileInput.click(); }

dropZone.addEventListener('click', openFilePicker);
browseBtn.addEventListener('click', e => { e.stopPropagation(); openFilePicker(); });
browseBtn.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFilePicker(); }
});

changeImageBtn.addEventListener('click', () => { fileInput.value = ''; openFilePicker(); });

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) loadFile(fileInput.files[0]);
});

/* Drag-and-drop onto the upload zone */
dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('is-over'); });
dropZone.addEventListener('dragleave', ()  => dropZone.classList.remove('is-over'));
dropZone.addEventListener('dragend',   ()  => dropZone.classList.remove('is-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('is-over');
  const file = e.dataTransfer?.files?.[0];
  if (file && file.type.startsWith('image/')) loadFile(file);
});

let nextId = 1;

function loadFile(file) {
  const reader = new FileReader();
  reader.onload = ev => {
    const id = nextId++;
    const record = {
      id,
      name:            file.name,
      dataUrl:         ev.target.result,
      originalPalette: [],
      palette:         [],
      extracted:       false,
    };
    state.images.push(record);
    activateImage(id);
  };
  reader.readAsDataURL(file);
}

/* ================================================================
   Session Image Management
   ================================================================ */
function activateImage(id) {
  const img = state.images.find(i => i.id === id);
  if (!img) return;

  state.activeImageId = id;

  previewImage.onload = () => {
    fileNameEl.textContent = img.name;
    uploadSection.hidden   = true;
    workspace.hidden       = false;

    if (img.extracted) {
      paletteSection.hidden = false;
      exportSection.hidden  = false;
      renderPalette(img.palette);
    } else {
      paletteSection.hidden = true;
      exportSection.hidden  = true;
    }

    renderHistory();
  };
  previewImage.src = img.dataUrl;
}

function renderHistory() {
  historyStrip.innerHTML = '';
  const count = state.images.length;
  historyCount.textContent = count === 1 ? '1 image' : `${count} images`;

  state.images.forEach(img => {
    const thumb = document.createElement('div');
    thumb.className = 'history-thumb' + (img.id === state.activeImageId ? ' active' : '');
    thumb.title = img.name;

    const imgEl = document.createElement('img');
    imgEl.src = img.dataUrl;
    imgEl.alt = img.name;

    const nameEl = document.createElement('div');
    nameEl.className = 'history-thumb-name';
    nameEl.textContent = img.name;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'history-thumb-remove';
    removeBtn.type = 'button';
    removeBtn.title = 'Remove image';
    removeBtn.innerHTML = '&times;';
    removeBtn.addEventListener('click', e => {
      e.stopPropagation();
      removeImage(img.id);
    });

    thumb.appendChild(imgEl);
    thumb.appendChild(nameEl);
    thumb.appendChild(removeBtn);
    thumb.addEventListener('click', () => activateImage(img.id));
    historyStrip.appendChild(thumb);
  });
}

function removeImage(id) {
  const idx = state.images.findIndex(i => i.id === id);
  if (idx === -1) return;

  state.images.splice(idx, 1);

  if (!state.images.length) {
    state.activeImageId    = null;
    uploadSection.hidden   = false;
    workspace.hidden       = true;
    paletteSection.hidden  = true;
    exportSection.hidden   = true;
    return;
  }

  const nextImg = state.images[Math.min(idx, state.images.length - 1)];
  activateImage(nextImg.id);
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
  const img = activeImg();
  if (img && img.originalPalette.length) {
    img.palette = sortPalette([...img.originalPalette], sortBySelect.value);
    renderPalette(img.palette);
  }
});

/* ================================================================
   Color Extraction
   ================================================================ */
extractBtn.addEventListener('click', () => {
  if (!activeImg()) return;
  extractBtn.disabled = true;
  extractBtn.textContent = 'Extracting…';
  requestAnimationFrame(() => setTimeout(runExtraction, 0));
});

function runExtraction() {
  const img = activeImg();
  if (!img) { resetExtractBtn(); return; }

  const ctx = extractCanvas.getContext('2d');
  extractCanvas.width  = previewImage.naturalWidth;
  extractCanvas.height = previewImage.naturalHeight;
  ctx.drawImage(previewImage, 0, 0);

  let pixels = samplePixels(
    ctx.getImageData(0, 0, extractCanvas.width, extractCanvas.height).data,
    parseInt(sampleQuality.value, 10)
  );

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

  img.originalPalette = raw;
  img.palette         = sortPalette([...raw], sortBySelect.value);
  img.extracted       = true;

  renderPalette(img.palette);
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
    if (data[i + 3] > 128)
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
    let bestIdx  = -1;
    let bestSpan = -1;

    for (let i = 0; i < buckets.length; i++) {
      if (buckets[i].length < 2) continue;
      const { span } = bucketRange(buckets[i]);
      if (span > bestSpan) { bestSpan = span; bestIdx = i; }
    }

    if (bestIdx === -1) break;

    const [bucket] = buckets.splice(bestIdx, 1);
    const { ch }   = bucketRange(bucket);

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
    case 'frequency':  return pal.sort((a, b) => b.count    - a.count);
    case 'hue':        return pal.sort((a, b) => toHsl(a).h - toHsl(b).h);
    case 'brightness': return pal.sort((a, b) => luma(b)    - luma(a));
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
function renderPalette(palette) {
  paletteGrid.innerHTML = '';
  if (!palette || !palette.length) return;
  const total = palette.reduce((s, c) => s + c.count, 0);

  for (const color of palette) {
    const hex = toHex(color);
    const pct = total > 0 ? ((color.count / total) * 100).toFixed(1) : '0.0';

    const swatch = document.createElement('div');
    swatch.className = 'swatch';
    swatch.title     = `${hex.toUpperCase()} · ${pct}%`;
    swatch.draggable = true;

    swatch.innerHTML = `
      <div class="swatch-color" style="background:${hex}">
        <button class="swatch-add" type="button" title="Add to texture">+</button>
      </div>
      <div class="swatch-info">
        <span class="swatch-hex">${hex.toUpperCase()}</span>
        <span class="swatch-pct">${pct}%</span>
      </div>`;

    swatch.querySelector('.swatch-color').addEventListener('click', e => {
      if (!e.target.classList.contains('swatch-add'))
        copyText(hex.toUpperCase(), `Copied ${hex.toUpperCase()}`);
    });

    swatch.querySelector('.swatch-add').addEventListener('click', e => {
      e.stopPropagation();
      addToTexture(color);
    });

    swatch.addEventListener('dragstart', e => {
      drag.active  = true;
      drag.type    = 'palette';
      drag.color   = color;
      drag.slotIdx = null;
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', hex);
    });
    swatch.addEventListener('dragend', () => { drag.active = false; });

    paletteGrid.appendChild(swatch);
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
  const img = activeImg();
  if (!img) return;
  const all = img.palette.map(c => toHex(c).toUpperCase()).join('\n');
  copyText(all, 'All hex codes copied!');
});

/* ================================================================
   Texture Builder
   ================================================================ */
function addToTexture(color) {
  const firstEmpty = state.textureSlots.indexOf(null);
  if (firstEmpty === -1) {
    showToast('Texture is full — clear a slot or increase the grid size.');
    return;
  }
  state.textureSlots[firstEmpty] = color;
  renderTextureGrid();
  showToast(`Added ${toHex(color).toUpperCase()} to texture`);
}

function resizeTexture(newN) {
  const newTotal = newN * newN;
  const filled   = state.textureSlots.filter(s => s !== null);
  const newSlots = Array(newTotal).fill(null);
  filled.slice(0, newTotal).forEach((c, i) => { newSlots[i] = c; });
  state.textureN     = newN;
  state.textureSlots = newSlots;
  renderTextureGrid();
}

function renderTextureGrid() {
  const N = state.textureN;
  textureGrid.style.gridTemplateColumns = `repeat(${N}, 1fr)`;
  textureGrid.innerHTML = '';

  state.textureSlots.forEach((color, idx) => {
    const slot = document.createElement('div');
    slot.className   = 'texture-slot ' + (color ? 'filled' : 'empty');
    slot.dataset.idx = idx;

    if (color) {
      slot.style.background = toHex(color);
      slot.draggable        = true;
      slot.title            = toHex(color).toUpperCase();

      const removeBtn = document.createElement('button');
      removeBtn.className   = 'slot-remove';
      removeBtn.type        = 'button';
      removeBtn.title       = 'Remove color';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', e => {
        e.stopPropagation();
        state.textureSlots[idx] = null;
        renderTextureGrid();
      });
      slot.appendChild(removeBtn);

      slot.addEventListener('dragstart', e => {
        drag.active  = true;
        drag.type    = 'slot';
        drag.color   = color;
        drag.slotIdx = idx;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', toHex(color));
        slot.classList.add('is-dragging');
      });
      slot.addEventListener('dragend', () => {
        drag.active = false;
        slot.classList.remove('is-dragging');
      });
    }

    slot.addEventListener('dragover', e => {
      if (!drag.active) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = drag.type === 'slot' ? 'move' : 'copy';
      slot.classList.add('drag-over');
    });
    slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
    slot.addEventListener('drop', e => {
      e.preventDefault();
      slot.classList.remove('drag-over');
      if (!drag.active) return;

      if (drag.type === 'palette') {
        state.textureSlots[idx] = drag.color;
      } else if (drag.type === 'slot' && drag.slotIdx !== null && drag.slotIdx !== idx) {
        const tmp = state.textureSlots[idx];
        state.textureSlots[idx]          = state.textureSlots[drag.slotIdx];
        state.textureSlots[drag.slotIdx] = tmp;
      }

      drag.active = false;
      renderTextureGrid();
    });

    textureGrid.appendChild(slot);
  });
}

/* Grid size buttons */
$$('.size-tex').forEach(btn =>
  btn.addEventListener('click', () => {
    resizeTexture(parseInt(btn.dataset.n, 10));
    activateInGroup(btn, $$('.size-tex'));
  })
);

/* Clear texture */
clearTextureBtn.addEventListener('click', () => {
  state.textureSlots = Array(state.textureN * state.textureN).fill(null);
  renderTextureGrid();
  showToast('Texture cleared');
});

/* ================================================================
   Texture Export
   ================================================================ */
$$('.tex-fmt-btn').forEach(btn =>
  btn.addEventListener('click', () => {
    state.texFormat = btn.dataset.format;
    activateInGroup(btn, $$('.tex-fmt-btn'));
  })
);

$$('.tex-sz-btn').forEach(btn =>
  btn.addEventListener('click', () => {
    state.texExportSize = parseInt(btn.dataset.size, 10);
    activateInGroup(btn, $$('.tex-sz-btn'));
  })
);

exportTextureBtn.addEventListener('click', () => {
  if (!state.textureSlots.some(s => s !== null)) {
    showToast('Add some colors to the texture first.');
    return;
  }
  const { texFormat: fmt, texExportSize: sz, textureN: N } = state;
  if (fmt === 'png') exportTexturePng(sz, N);
  else               exportTextureSvg(sz, N);
});

function exportTexturePng(size, N) {
  const c   = document.createElement('canvas');
  c.width   = c.height = size;
  const ctx = c.getContext('2d');

  state.textureSlots.forEach((color, idx) => {
    if (!color) return;
    const col = idx % N;
    const row = Math.floor(idx / N);
    const x1  = Math.round(col       * size / N);
    const y1  = Math.round(row       * size / N);
    const x2  = Math.round((col + 1) * size / N);
    const y2  = Math.round((row + 1) * size / N);
    ctx.fillStyle = toHex(color);
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
  });

  c.toBlob(blob => {
    download(URL.createObjectURL(blob), `texture-${N}x${N}-${size}px.png`);
  }, 'image/png');
}

function exportTextureSvg(size, N) {
  let rects = '';
  state.textureSlots.forEach((color, idx) => {
    if (!color) return;
    const col = idx % N;
    const row = Math.floor(idx / N);
    const x   = n2(col       * size / N);
    const y   = n2(row       * size / N);
    const w   = n2((col + 1) * size / N - col * size / N);
    const h   = n2((row + 1) * size / N - row * size / N);
    rects += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${toHex(color).toUpperCase()}"/>\n`;
  });

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${rects}
</svg>`;
  download(
    URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })),
    `texture-${N}x${N}-${size}px.svg`
  );
}

/* ================================================================
   Palette Export controls
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
  const img = activeImg();
  if (!img || !img.palette.length) return;
  const { format, exportSize: sz, layout } = state;
  if (format === 'png') exportAsPng(sz, layout, img.palette);
  else                  exportAsSvg(sz, layout, img.palette);
});

/* ================================================================
   Export — PNG
   ================================================================ */
function exportAsPng(size, layout, palette) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  drawPalette(c.getContext('2d'), palette, size, size, layout);
  c.toBlob(blob => {
    download(URL.createObjectURL(blob), `palette-${size}x${size}.png`);
  }, 'image/png');
}

/* ================================================================
   Export — SVG
   ================================================================ */
function exportAsSvg(size, layout, palette) {
  const shapes = buildSvgShapes(palette, size, size, layout);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${shapes}
</svg>`;
  download(
    URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })),
    `palette-${size}x${size}.svg`
  );
}

/* ================================================================
   Drawing — Canvas
   Cells are flush edge-to-edge: no padding, no gap, no rounded corners.
   ================================================================ */
function drawPalette(ctx, palette, W, H, layout) {
  if (layout === 'grid') {
    const cols = Math.ceil(Math.sqrt(palette.length));
    const rows = Math.ceil(palette.length / cols);
    palette.forEach((color, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x1  = Math.round(col       * W / cols);
      const y1  = Math.round(row       * H / rows);
      const x2  = Math.round((col + 1) * W / cols);
      const y2  = Math.round((row + 1) * H / rows);
      ctx.fillStyle = toHex(color);
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
    });
  } else {
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
   ================================================================ */
function buildSvgShapes(palette, W, H, layout) {
  let out = '';
  if (layout === 'grid') {
    const cols = Math.ceil(Math.sqrt(palette.length));
    const rows = Math.ceil(palette.length / cols);
    palette.forEach((color, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x   = n2(col       * W / cols);
      const y   = n2(row       * H / rows);
      const w   = n2((col + 1) * W / cols - col * W / cols);
      const h   = n2((row + 1) * H / rows - row * H / rows);
      out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${toHex(color).toUpperCase()}"/>\n`;
    });
  } else {
    const cnt = palette.length;
    palette.forEach((color, i) => {
      const y = n2(i       * H / cnt);
      const h = n2((i + 1) * H / cnt - i * H / cnt);
      out += `<rect x="0" y="${y}" width="${W}" height="${h}" fill="${toHex(color).toUpperCase()}"/>\n`;
    });
  }
  return out;
}

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
  toastEl.style.animation = 'none';
  void toastEl.offsetWidth;
  toastEl.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2200);
}

/* ================================================================
   Helpers
   ================================================================ */
const n2 = v => parseFloat(v.toFixed(2));

function download(url, filename) {
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function activateInGroup(active, group) {
  (group instanceof NodeList ? [...group] : group)
    .forEach(el => el.classList.toggle('active', el === active));
}

/* ================================================================
   Init — render empty texture grid on load
   ================================================================ */
renderTextureGrid();
