import { CHRONICLES_START_YEAR } from '../core/constants.js';
import { escapeHtml, formatDate } from '../core/dom.js';
import { clampFocusValue, clampZoomValue, mediaUrl } from '../core/media.js';

export function createChroniclesFeature({ getEntry, saveEntryToDB, loadEntries }) {
  let chronicleLightboxSets = {};
  let currentLightboxSetId = null;
  let currentLightboxIndex = 0;
  let focusEditorState = null;
  let focusPointerActive = false;
  let focusPointerLast = null;

function entryYear(entry) {
  if (entry.chronicle?.year) return Number(entry.chronicle.year);
  const match = String(entry.date || '').match(/^(\d{4})/);
  if (match) return Number(match[1]);
  return null;
}

function chronicleEntryMeta(entry) {
  const year = entryYear(entry);
  return {
    year,
    eyebrow: entry.chronicle?.eyebrow || (year ? String(year) : 'Memory'),
    location: entry.chronicle?.location || '',
    season: entry.chronicle?.season || '',
    coverImagePath: entry.chronicle?.coverImagePath || null
  };
}

function renderChroniclesTimeline(list, container, countEl) {
  const currentYear = new Date().getFullYear();
  const years = [];
  chronicleLightboxSets={};
  for (let year = CHRONICLES_START_YEAR; year <= currentYear; year++) years.push(year);

  const byYear = new Map(years.map(year => [year, []]));
  list.forEach(entry => {
    const year = entryYear(entry);
    if (!year || year < CHRONICLES_START_YEAR || year > currentYear) return;
    byYear.get(year).push(entry);
  });

  const filledYears = years.filter(year => byYear.get(year).length > 0).length;
  countEl.textContent = `· ${filledYears}/${years.length} years`;

  container.innerHTML = `
    ${renderChronicleYearNav(years, byYear)}
    ${renderChronicleTimeline(years, byYear)}
  `;
}

function renderChronicleYearNav(years, byYear) {
  return `
    <div class="chronicle-year-nav" aria-label="Chronicle years">
      ${years.map(year => `
        <button class="${byYear.get(year).length ? 'has-memory' : ''}" onclick="scrollToChronicleYear(${year})">${year}</button>
      `).join('')}
    </div>
  `;
}

function renderChronicleTimeline(years, byYear) {
  return `
    <div class="chronicle-timeline">
      ${years.map(year => renderChronicleYear(year, byYear.get(year))).join('')}
    </div>
  `;
}

function renderChronicleYear(year, entries) {
  const hasMemory = entries.length > 0;
  return `
    <section class="chronicle-year ${hasMemory ? 'has-memory' : ''}" id="chronicle-year-${year}">
      <div class="chronicle-year-label">${year}</div>
      <div class="chronicle-year-body">
        ${hasMemory ? renderChronicleAlbum(year, entries) : renderEmptyChronicleYear(year)}
      </div>
    </section>
  `;
}

function sortedChronicleEntries(entries) {
  return [...entries].sort((a, b) => {
    const dateCompare = (a.date || '').localeCompare(b.date || '');
    return dateCompare || (a.createdAt || 0) - (b.createdAt || 0);
  });
}

function chronicleImagesForEntry(entry) {
  const meta = chronicleEntryMeta(entry);
  return (entry.images || []).map((item, imageIndex) => ({
    item,
    imageIndex,
    entryId: String(entry.id)
  })).sort((a, b) => {
    const ar = a.item?.role === 'cover' || a.item?.path === meta.coverImagePath ? -1 : 0;
    const br = b.item?.role === 'cover' || b.item?.path === meta.coverImagePath ? -1 : 0;
    return ar - br || (a.item?.order ?? 999) - (b.item?.order ?? 999);
  });
}

function chronicleImageStyle(item) {
  const focalX = Number.isFinite(item?.focalX) ? Math.max(0, Math.min(100, item.focalX)) : 50;
  const focalY = Number.isFinite(item?.focalY) ? Math.max(0, Math.min(100, item.focalY)) : 38;
  const fit = item?.fit === 'contain' ? 'contain' : 'cover';
  const zoom = Number.isFinite(item?.zoom) ? Math.max(1, Math.min(1.6, item.zoom)) : 1;
  return `--focus-x:${focalX}%;--focus-y:${focalY}%;--thumb-fit:${fit};--thumb-zoom:${zoom};`;
}

function normalizeChronicleImageMeta(image, index) {
  return {
    ...image,
    role: index === 0 ? 'cover' : (image.role || 'supporting'),
    order: index,
    focalX: Number.isFinite(image.focalX) ? image.focalX : 50,
    focalY: Number.isFinite(image.focalY) ? image.focalY : 38,
    zoom: Number.isFinite(image.zoom) ? image.zoom : 1,
    fit: image.fit || 'cover'
  };
}

function renderChronicleAlbum(year, entries) {
  const orderedEntries = sortedChronicleEntries(entries);
  const primary = orderedEntries.find(entry => entry.images?.length) || orderedEntries[0];
  const allImages = orderedEntries.flatMap(chronicleImagesForEntry);
  const photoCount = allImages.length;
  const visibleImages = allImages.slice(0, 4);
  const hiddenCount = Math.max(0, photoCount - visibleImages.length);
  const entryId = String(primary.id);
  const lightboxSetId = `chronicle-${year}`;
  const dateStr = primary.date ? formatDate(primary.date) : String(year);
  const body = primary.body || '';
  const title = primary.title || `${year}`;
  chronicleLightboxSets[lightboxSetId] = allImages
    .map((record, index) => ({
      url: mediaUrl(record.item),
      caption: record.item?.caption || title || `${year}`,
      alt: record.item?.caption || title || `Chronicle photo ${index + 1}`
    }))
    .filter(item => item.url);

  return `
    <article class="chronicle-memory">
      ${renderChroniclePhotoCluster(visibleImages, hiddenCount, title, lightboxSetId)}
      <div class="chronicle-memory-content">
        <div class="chronicle-memory-copy">
          <span class="chronicle-memory-date">${escapeHtml(dateStr)}</span>
          <h3 class="chronicle-memory-title">${escapeHtml(title)}</h3>
          ${body
            ? `<div class="entry-body">${escapeHtml(body)}</div>`
            : `<div class="chronicle-text-placeholder">這一年還等著被寫下來。</div>`}
        </div>
        <div class="chronicle-card-footer">
          <span>${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}</span>
          <span class="entry-actions">
            <button onclick="editEntry('${entryId}')"><span class="iconify" data-icon="ph:pencil-simple-thin"></span>edit</button>
            <button onclick="confirmDelete('${entryId}')"><span class="iconify" data-icon="ph:trash-thin"></span>remove</button>
          </span>
        </div>
      </div>
    </article>
  `;
}

function renderChroniclePhotoCluster(images, hiddenCount, title, lightboxSetId) {
  if (images.length === 0) {
    return '<div class="chronicle-photo-placeholder">photo waits here</div>';
  }

  const photos = images.map((record, index) => {
    const item = record.item;
    const url = mediaUrl(item);
    if (!url) return '';
    const alt = escapeHtml(item?.caption || title || `Chronicle photo ${index + 1}`);
    const cls = index === 0 ? 'main' : 'supporting';
    const more = hiddenCount > 0 && index === images.length - 1
      ? `<span class="chronicle-more-photos">+${hiddenCount}</span>`
      : '';
    const caption = item?.caption
      ? `<figcaption class="chronicle-photo-caption">${escapeHtml(item.caption)}</figcaption>`
      : '';
    return `
      <figure class="chronicle-photo-frame ${cls}" role="button" tabindex="0" onclick="handleChroniclePhotoClick(event, '${lightboxSetId}', ${index})" onkeydown="handlePhotoFrameKey(event, '${lightboxSetId}', ${index})">
        <img src="${url}" loading="lazy" alt="${alt}" style="${chronicleImageStyle(item)}">
        ${more}
        ${caption}
        <button class="chronicle-focus-btn" type="button" onclick="event.stopPropagation(); openFocusEditor('${record.entryId}', ${record.imageIndex})">取景</button>
      </figure>`;
  }).join('');

  return `
    <div class="chronicle-photo-strip ${images.length > 1 ? 'has-multiple' : ''} photo-count-${images.length}">
      ${photos}
    </div>
  `;
}

function renderEmptyChronicleYear(year) {
  return `
    <div class="chronicle-empty-year">
      <div class="chronicle-empty-frame">
        <div class="chronicle-empty-photo">photo waits here</div>
        <div class="chronicle-empty-copy">
          <span class="chronicle-memory-date">${year}</span>
          <h3 class="chronicle-memory-title">這一年還等著被寫下來。</h3>
          <div class="chronicle-text-placeholder">放上幾張代表照片，再留一段話給未來的我們。</div>
          <button class="chronicle-add-year" onclick="openChronicleYearEditor(${year})">Add photo</button>
        </div>
      </div>
    </div>
  `;
}

function scrollToChronicleYear(year) {
  document.getElementById(`chronicle-year-${year}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function revealChroniclePhotoTools(frame) {
  if (!frame) return;
  frame.classList.add('show-tools');
  clearTimeout(frame._toolsTimer);
  frame._toolsTimer = setTimeout(() => frame.classList.remove('show-tools'), 2400);
}

function handleChroniclePhotoClick(event, setId, index) {
  const frame = event.currentTarget;
  if (window.matchMedia?.('(hover: none)').matches && !frame.classList.contains('show-tools')) {
    event.preventDefault();
    revealChroniclePhotoTools(frame);
    return;
  }
  openChronicleLightbox(setId, index);
}

function handlePhotoFrameKey(event, setId, index) {
  if (event.target?.closest?.('button')) return;
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  revealChroniclePhotoTools(event.currentTarget);
  openChronicleLightbox(setId, index);
}

function openChronicleLightbox(setId, index=0) {
  const photos = chronicleLightboxSets[setId] || [];
  if (!photos.length) return;
  currentLightboxSetId = setId;
  currentLightboxIndex = Math.max(0, Math.min(index, photos.length - 1));
  renderPhotoLightbox();
  const lightbox = document.getElementById('photoLightbox');
  lightbox.classList.add('visible');
  lightbox.setAttribute('aria-hidden', 'false');
  document.getElementById('photoLightboxClose')?.focus();
}

function closePhotoLightbox() {
  const lightbox = document.getElementById('photoLightbox');
  if (!lightbox) return;
  lightbox.classList.remove('visible');
  lightbox.setAttribute('aria-hidden', 'true');
  currentLightboxSetId = null;
  currentLightboxIndex = 0;
}

function movePhotoLightbox(delta) {
  const photos = chronicleLightboxSets[currentLightboxSetId] || [];
  if (!photos.length) return;
  currentLightboxIndex = (currentLightboxIndex + delta + photos.length) % photos.length;
  renderPhotoLightbox();
}

function renderPhotoLightbox() {
  const photos = chronicleLightboxSets[currentLightboxSetId] || [];
  const photo = photos[currentLightboxIndex];
  if (!photo) return;
  const image = document.getElementById('photoLightboxImage');
  const caption = document.getElementById('photoLightboxCaption');
  const count = document.getElementById('photoLightboxCount');
  const prev = document.getElementById('photoLightboxPrev');
  const next = document.getElementById('photoLightboxNext');
  if (image) {
    image.src = photo.url;
    image.alt = photo.alt || '';
  }
  if (caption) caption.textContent = photo.caption || '';
  if (count) count.textContent = `${currentLightboxIndex + 1} / ${photos.length}`;
  if (prev) prev.style.display = photos.length > 1 ? '' : 'none';
  if (next) next.style.display = photos.length > 1 ? '' : 'none';
}

async function openFocusEditor(entryId, imageIndex) {
  const entry = await getEntry(entryId);
  const image = entry?.images?.[imageIndex];
  if (!entry || !image) return;
  focusEditorState = {
    entry,
    entryId: String(entryId),
    imageIndex,
    focalX: Number.isFinite(image.focalX) ? image.focalX : 50,
    focalY: Number.isFinite(image.focalY) ? image.focalY : 38,
    zoom: Number.isFinite(image.zoom) ? image.zoom : 1,
    url: mediaUrl(image),
    alt: image.caption || entry.title || 'Chronicle photo'
  };
  renderFocusEditor();
  const editor = document.getElementById('focusEditor');
  editor.classList.add('visible');
  editor.setAttribute('aria-hidden', 'false');
  document.getElementById('focusEditorSave')?.focus();
}

function closeFocusEditor() {
  const editor = document.getElementById('focusEditor');
  if (!editor) return;
  editor.classList.remove('visible');
  editor.setAttribute('aria-hidden', 'true');
  focusEditorState = null;
  focusPointerActive = false;
  focusPointerLast = null;
}

function renderFocusEditor() {
  if (!focusEditorState) return;
  const preview = document.getElementById('focusEditorPreview');
  const image = document.getElementById('focusEditorImage');
  const readout = document.getElementById('focusReadout');
  const rangeX = document.getElementById('focusRangeX');
  const rangeY = document.getElementById('focusRangeY');
  const rangeZoom = document.getElementById('focusRangeZoom');
  const x = clampFocusValue(focusEditorState.focalX);
  const y = clampFocusValue(focusEditorState.focalY);
  const zoom = clampZoomValue(focusEditorState.zoom);
  if (preview) {
    preview.style.setProperty('--focus-x', `${x}%`);
    preview.style.setProperty('--focus-y', `${y}%`);
    preview.style.setProperty('--focus-zoom', zoom);
  }
  if (image) {
    image.src = focusEditorState.url || '';
    image.alt = focusEditorState.alt || '';
  }
  if (rangeX && rangeX.value !== String(x)) rangeX.value = String(x);
  if (rangeY && rangeY.value !== String(y)) rangeY.value = String(y);
  if (rangeZoom && rangeZoom.value !== String(Math.round(zoom * 100))) rangeZoom.value = String(Math.round(zoom * 100));
  if (readout) readout.textContent = `左右 ${x} · 上下 ${y} · 縮放 ${Math.round(zoom * 100)}%`;
}

function nudgeFocusEditor(dx, dy) {
  if (!focusEditorState) return;
  focusEditorState.focalX = clampFocusValue(focusEditorState.focalX + dx);
  focusEditorState.focalY = clampFocusValue(focusEditorState.focalY + dy);
  renderFocusEditor();
}

function centerFocusEditor() {
  if (!focusEditorState) return;
  focusEditorState.focalX = 50;
  focusEditorState.focalY = 38;
  focusEditorState.zoom = 1;
  renderFocusEditor();
}

function setFocusAxis(axis, value) {
  if (!focusEditorState) return;
  if (axis === 'x') focusEditorState.focalX = clampFocusValue(Number(value));
  if (axis === 'y') focusEditorState.focalY = clampFocusValue(Number(value));
  if (axis === 'zoom') focusEditorState.zoom = clampZoomValue(Number(value) / 100);
  renderFocusEditor();
}

function setFocusFromPointer(event) {
  if (!focusEditorState) return;
  const preview = document.getElementById('focusEditorPreview');
  const rect = preview?.getBoundingClientRect();
  if (!rect) return;
  focusEditorState.focalX = clampFocusValue(((event.clientX - rect.left) / rect.width) * 100);
  focusEditorState.focalY = clampFocusValue(((event.clientY - rect.top) / rect.height) * 100);
  renderFocusEditor();
}

function startFocusDrag(event) {
  focusPointerActive = true;
  focusPointerLast = { x: event.clientX, y: event.clientY };
  event.currentTarget.setPointerCapture?.(event.pointerId);
}

function moveFocusDrag(event) {
  if (!focusPointerActive || !focusEditorState || !focusPointerLast) return;
  const preview = document.getElementById('focusEditorPreview');
  const rect = preview?.getBoundingClientRect();
  if (!rect) return;
  const dx = event.clientX - focusPointerLast.x;
  const dy = event.clientY - focusPointerLast.y;
  const sensitivity = 100 / Math.min(rect.width, rect.height);
  focusEditorState.focalX = clampFocusValue(focusEditorState.focalX - dx * sensitivity);
  focusEditorState.focalY = clampFocusValue(focusEditorState.focalY - dy * sensitivity);
  focusPointerLast = { x: event.clientX, y: event.clientY };
  renderFocusEditor();
}

function endFocusDrag(event) {
  focusPointerActive = false;
  focusPointerLast = null;
  event.currentTarget.releasePointerCapture?.(event.pointerId);
}

async function saveFocusEditor() {
  if (!focusEditorState) return;
  const entry = focusEditorState.entry;
  const images = [...(entry.images || [])];
  const image = images[focusEditorState.imageIndex];
  if (!image) return;
  images[focusEditorState.imageIndex] = {
    ...image,
    focalX: clampFocusValue(focusEditorState.focalX),
    focalY: clampFocusValue(focusEditorState.focalY),
    zoom: clampZoomValue(focusEditorState.zoom),
    fit: image.fit || 'cover'
  };
  await saveEntryToDB({ ...entry, images, updatedAt: Date.now() });
  closeFocusEditor();
  loadEntries();
}


  return {
    closeFocusEditor,
    closePhotoLightbox,
    centerFocusEditor,
    endFocusDrag,
    handleChroniclePhotoClick,
    handlePhotoFrameKey,
    moveFocusDrag,
    movePhotoLightbox,
    nudgeFocusEditor,
    normalizeChronicleImageMeta,
    openFocusEditor,
    renderChroniclesTimeline,
    saveFocusEditor,
    scrollToChronicleYear,
    setFocusAxis,
    setFocusFromPointer,
    startFocusDrag
  };
}
