import { CHRONICLES_START_YEAR } from '../core/constants.js';
import { escapeHtml, formatDate } from '../core/dom.js';
import { clampFocusValue, clampZoomValue, mediaUrl } from '../core/media.js';
import { createPointerReorder } from '../core/pointerReorder.js';
import { renderMarkdown } from '../core/richText.js';

let sortableModulePromise = null;

function loadSortable() {
  if (!sortableModulePromise) sortableModulePromise = import('sortablejs');
  return sortableModulePromise;
}

export function createChroniclesFeature({ getEntry, saveEntryToDB, loadEntries }) {
  let chronicleLightboxSets = {};
  let chronicleReorderSets = {};
  let currentLightboxSetId = null;
  let currentLightboxIndex = 0;
  let currentPhotoBrowserSetId = null;
  let focusEditorState = null;
  let focusPointerActive = false;
  let focusPointerLast = null;
  let chronicleYearObserver = null;
  let chronicleReorderSaving = false;
  let suppressChroniclePhotoClick = false;
  let photoBrowserSortable = null;

  const chroniclePointerReorder = createPointerReorder({
    itemSelector: '.chronicle-photo-frame[data-reorder-index], .chronicle-photo-browser-item[data-reorder-index]',
    getItems: (context) => {
      if (context?.surface === 'browser') {
        return document.querySelectorAll('#chroniclePhotoBrowserGrid .chronicle-photo-browser-item[data-reorder-index]');
      }
      return document.querySelectorAll(`[data-chronicle-set="${context?.setId}"][data-reorder-index]`);
    },
    getGhostRect: ({ x, y, context }) => {
      const size = context?.surface === 'timeline'
        ? Math.min(160, Math.max(124, window.innerWidth - 32))
        : Math.min(180, Math.max(124, window.innerWidth - 32));
      return {
        width: size,
        height: size,
        left: Math.max(12, Math.min(window.innerWidth - size - 12, x - size / 2)),
        top: Math.max(12, Math.min(window.innerHeight - size - 12, y - size / 2)),
        grabX: size / 2,
        grabY: size / 2
      };
    },
    canReorder: (fromIndex, toIndex, context) => canReorderChroniclePhotos(context?.setId, fromIndex, toIndex),
    onReorder: (fromIndex, toIndex, context) => reorderChroniclePhotos(context?.setId, fromIndex, context?.setId, toIndex),
    onDragStart: () => {
      suppressChroniclePhotoClick = true;
    },
    onDragEnd: () => {
      setTimeout(() => {
        suppressChroniclePhotoClick = false;
      }, 120);
    },
    onAnnounce: announceReorder
  });

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
  chronicleReorderSets={};
  for (let year = CHRONICLES_START_YEAR; year <= currentYear; year++) years.push(year);

  const byYear = new Map(years.map(year => [year, []]));
  list.forEach(entry => {
    const year = entryYear(entry);
    if (!year || year < CHRONICLES_START_YEAR || year > currentYear) return;
    byYear.get(year).push(entry);
  });

  const filledYears = years.filter(year => byYear.get(year).length > 0).length;
  countEl.textContent = `${filledYears}/${years.length} years`;

  container.innerHTML = `
    ${renderChronicleYearNav(years, byYear)}
    ${renderChronicleTimeline(years, byYear)}
  `;
  requestAnimationFrame(() => setupChronicleYearNavState(years));
}

function renderChronicleYearNav(years, byYear) {
  return `
    <div class="chronicle-year-nav" aria-label="Chronicle years" style="--chronicle-year-count: ${years.length};">
      ${years.map(year => `
        <button class="${byYear.get(year).length ? 'has-memory' : ''}" data-chronicle-year="${year}" onclick="scrollToChronicleYear(${year})">${year}</button>
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

function normalizeCropConfig(crop = {}, fallback = {}) {
  return {
    focalX: Number.isFinite(crop?.focalX) ? clampFocusValue(crop.focalX) : (Number.isFinite(fallback?.focalX) ? clampFocusValue(fallback.focalX) : 50),
    focalY: Number.isFinite(crop?.focalY) ? clampFocusValue(crop.focalY) : (Number.isFinite(fallback?.focalY) ? clampFocusValue(fallback.focalY) : 38),
    zoom: Number.isFinite(crop?.zoom) ? clampZoomValue(crop.zoom) : (Number.isFinite(fallback?.zoom) ? clampZoomValue(fallback.zoom) : 1),
    fit: crop?.fit || fallback?.fit || 'cover'
  };
}

function chronicleImageStyle(item) {
  const crop = normalizeCropConfig(item);
  const focalX = crop.focalX;
  const focalY = crop.focalY;
  const fit = crop.fit === 'contain' ? 'contain' : 'cover';
  const zoom = crop.zoom;
  return `--focus-x:${focalX}%;--focus-y:${focalY}%;--thumb-fit:${fit};--thumb-zoom:${zoom};`;
}

function normalizeChronicleImageMeta(image, index) {
  const baseCrop = normalizeCropConfig(image);
  return {
    ...image,
    role: index === 0 ? 'cover' : 'supporting',
    order: index,
    focalX: baseCrop.focalX,
    focalY: baseCrop.focalY,
    zoom: baseCrop.zoom,
    fit: baseCrop.fit
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
  const locations = [...new Set(orderedEntries.map(e => e.chronicle?.location).filter(Boolean))].join(' · ');
  chronicleLightboxSets[lightboxSetId] = allImages
    .map((record, index) => ({
      url: mediaUrl(record.item),
      caption: record.item?.caption || title || `${year}`,
      alt: record.item?.caption || title || `Chronicle photo ${index + 1}`
    }))
    .filter(item => item.url);
  chronicleReorderSets[lightboxSetId] = allImages;

  return `
    <article class="chronicle-memory">
      ${renderChroniclePhotoCluster(visibleImages, hiddenCount, title, lightboxSetId)}
      <div class="chronicle-memory-content">
        <div class="chronicle-memory-copy">
          <span class="chronicle-memory-date">${escapeHtml(dateStr)}</span>
          ${locations ? `<span class="chronicle-memory-location"><span class="iconify" data-icon="ph:map-pin-thin"></span>${escapeHtml(locations)}</span>` : ''}
          <h3 class="chronicle-memory-title">${escapeHtml(title)}</h3>
          ${body
            ? renderMarkdown(body, primary.bodyFormat, 'entry-body markdown-content')
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

  const renderPhoto = (record, index) => {
    const item = record.item;
    const url = mediaUrl(item);
    if (!url) return '';
    const alt = escapeHtml(item?.caption || title || `Chronicle photo ${index + 1}`);
    const cls = index === 0 ? 'main' : 'supporting';
    const isMoreTrigger = hiddenCount > 0 && index === images.length - 1;
    const more = isMoreTrigger
      ? `<span class="chronicle-more-photos">+${hiddenCount}</span>`
      : '';
    const caption = item?.caption
      ? `<figcaption class="chronicle-photo-caption">${escapeHtml(item.caption)}</figcaption>`
      : '';
    if (isMoreTrigger) {
      return `
        <figure class="chronicle-photo-frame ${cls} has-more" role="button" tabindex="0" onclick="handleChroniclePhotoClick(event, '${lightboxSetId}', ${index})" onkeydown="handlePhotoFrameKey(event, '${lightboxSetId}', ${index})">
          <img src="${url}" loading="lazy" alt="${alt}" draggable="false" style="${chronicleImageStyle(item)}">
          ${more}
          ${caption}
        </figure>`;
    }
    return `
      <figure class="chronicle-photo-frame ${cls}" role="button" tabindex="0" data-chronicle-set="${lightboxSetId}" data-reorder-index="${index}" onpointerdown="startChroniclePhotoReorder(event, '${lightboxSetId}', ${index})" onclick="handleChroniclePhotoClick(event, '${lightboxSetId}', ${index})" onkeydown="handleChronicleReorderKey(event, '${lightboxSetId}', ${index}); handlePhotoFrameKey(event, '${lightboxSetId}', ${index})">
        <span class="chronicle-drag-handle" aria-hidden="true"><span class="iconify" data-icon="ph:dots-three-vertical-thin"></span></span>
        <img src="${url}" loading="lazy" alt="${alt}" draggable="false" style="${chronicleImageStyle(item)}">
        ${more}
        ${caption}
        <button class="chronicle-focus-btn" type="button" onclick="event.stopPropagation(); openFocusEditor('${record.entryId}', ${record.imageIndex})">取景</button>
      </figure>`;
  };

  const mainPhoto = renderPhoto(images[0], 0);
  const supportingPhotos = images.slice(1).map((record, index) => renderPhoto(record, index + 1)).join('');
  const hasSupportingRail = images.length > 1;
  const rail = hasSupportingRail
    ? `<div class="chronicle-photo-rail rail-count-${images.length - 1}">${supportingPhotos}</div>`
    : supportingPhotos;

  return `
    <div class="chronicle-photo-strip ${images.length > 1 ? 'has-multiple' : ''} ${hasSupportingRail ? 'has-rail' : ''} photo-count-${images.length}">
      ${mainPhoto}
      ${rail}
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
  setCurrentChronicleYear(year, { scrollNav: true });
  document.getElementById(`chronicle-year-${year}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setCurrentChronicleYear(year, { scrollNav = false } = {}) {
  const nav = document.querySelector('.chronicle-year-nav');
  if (!nav) return;
  const targetYear = String(year);
  nav.querySelectorAll('button[data-chronicle-year]').forEach(button => {
    const isCurrent = button.dataset.chronicleYear === targetYear;
    button.classList.toggle('is-current', isCurrent);
    if (isCurrent) {
      button.setAttribute('aria-current', 'true');
      if (scrollNav) button.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    } else {
      button.removeAttribute('aria-current');
    }
  });
}

function setupChronicleYearNavState(years) {
  chronicleYearObserver?.disconnect();
  const nav = document.querySelector('.chronicle-year-nav');
  if (nav) {
    nav.scrollLeft = 0;
    nav.addEventListener('wheel', handleChronicleYearNavWheel, { passive: false });
    requestAnimationFrame(() => {
      nav.scrollLeft = 0;
    });
  }
  setCurrentChronicleYear(years[0]);

  if (!('IntersectionObserver' in window)) return;
  const visibleYears = new Map();
  chronicleYearObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const year = entry.target.id.replace('chronicle-year-', '');
      if (entry.isIntersecting) {
        visibleYears.set(year, Math.abs(entry.boundingClientRect.top - 120));
      } else {
        visibleYears.delete(year);
      }
    });
    if (!visibleYears.size) return;
    const [year] = [...visibleYears.entries()].sort((a, b) => a[1] - b[1])[0];
    setCurrentChronicleYear(year);
  }, {
    rootMargin: '-18% 0px -62% 0px',
    threshold: [0, 0.18, 0.38]
  });

  years.forEach(year => {
    const section = document.getElementById(`chronicle-year-${year}`);
    if (section) chronicleYearObserver.observe(section);
  });
}

function handleChronicleYearNavWheel(event) {
  const nav = event.currentTarget;
  if (!nav || nav.scrollWidth <= nav.clientWidth) return;

  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  if (!delta) return;

  const maxScroll = nav.scrollWidth - nav.clientWidth;
  const nextScroll = Math.max(0, Math.min(maxScroll, nav.scrollLeft + delta));
  if (nextScroll === nav.scrollLeft) return;

  event.preventDefault();
  nav.scrollLeft = nextScroll;
}

function revealChroniclePhotoTools(frame) {
  if (!frame) return;
  frame.classList.add('show-tools');
  clearTimeout(frame._toolsTimer);
  frame._toolsTimer = setTimeout(() => frame.classList.remove('show-tools'), 2400);
}

function startChroniclePhotoReorder(event, setId, index, surface='timeline') {
  chroniclePointerReorder.start(event, index, { setId, surface });
}

function canReorderChroniclePhotos(setId, fromIndex, toIndex) {
  const records = chronicleReorderSets[setId] || [];
  const fromRecord = records[fromIndex];
  const toRecord = records[toIndex];
  if (!fromRecord || !toRecord) return false;
  if (fromRecord.entryId === toRecord.entryId) return true;
  announceReorder('這兩張照片屬於不同篇編年史，請進入編輯後再整理。');
  return false;
}

async function handleChronicleReorderKey(event, setId, index) {
  if (!event.altKey && !event.metaKey) return;
  const delta = event.key === 'ArrowLeft' ? -1 : (event.key === 'ArrowRight' ? 1 : 0);
  if (!delta) return;
  event.preventDefault();
  event.stopPropagation();
  const targetIndex = index + delta;
  const didMove = await reorderChroniclePhotos(setId, index, setId, targetIndex);
  if (didMove) announceReorder(`照片已移到第 ${targetIndex + 1} 張`);
}

async function reorderChroniclePhotos(fromSetId, fromIndex, toSetId, toIndex) {
  if (chronicleReorderSaving) return false;
  if (!fromSetId || fromSetId !== toSetId) return false;
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) || fromIndex === toIndex) return false;

  const records = chronicleReorderSets[fromSetId] || [];
  const fromRecord = records[fromIndex];
  const toRecord = records[toIndex];
  if (!fromRecord || !toRecord) return false;
  if (fromRecord.entryId !== toRecord.entryId) {
    announceReorder('這兩張照片屬於不同篇編年史，請進入編輯後再整理。');
    return false;
  }

  chronicleReorderSaving = true;
  try {
    const entry = await getEntry(fromRecord.entryId);
    const entryRecords = records.filter(record => record.entryId === fromRecord.entryId);
    const fromEntryIndex = entryRecords.findIndex(record => record.imageIndex === fromRecord.imageIndex);
    const toEntryIndex = entryRecords.findIndex(record => record.imageIndex === toRecord.imageIndex);
    if (!entry || fromEntryIndex < 0 || toEntryIndex < 0) return false;

    const reorderedRecords = [...entryRecords];
    const [movedRecord] = reorderedRecords.splice(fromEntryIndex, 1);
    reorderedRecords.splice(toEntryIndex, 0, movedRecord);
    const reorderedImages = reorderedRecords
      .map(record => entry.images?.[record.imageIndex])
      .filter(Boolean)
      .map(normalizeChronicleImageMeta);
    if (reorderedImages.length !== (entry.images || []).length) return false;
    const coverImagePath = reorderedImages.find(image => image.path)?.path || null;

    await saveEntryToDB({
      ...entry,
      images: reorderedImages,
      chronicle: {
        ...(entry.chronicle || {}),
        coverImagePath
      },
      updatedAt: Date.now()
    });
    await loadEntries();
    if (currentPhotoBrowserSetId) renderChroniclePhotoBrowser();
    return true;
  } finally {
    chronicleReorderSaving = false;
  }
}

function announceReorder(message) {
  const live = document.getElementById('reorderLive');
  if (!live) return;
  live.textContent = '';
  requestAnimationFrame(() => {
    live.textContent = message;
  });
}

function handleChroniclePhotoClick(event, setId, index) {
  if (suppressChroniclePhotoClick) {
    event.preventDefault();
    return;
  }
  const allPhotos = chronicleReorderSets[setId] || [];
  if (allPhotos.length > 4 && index === 3) {
    event.preventDefault();
    revealChroniclePhotoTools(event.currentTarget);
    openChroniclePhotoBrowser(setId);
    return;
  }
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
  const allPhotos = chronicleReorderSets[setId] || [];
  if (allPhotos.length > 4 && index === 3) {
    openChroniclePhotoBrowser(setId);
    return;
  }
  openChronicleLightbox(setId, index);
}

function openChroniclePhotoBrowser(setId) {
  currentPhotoBrowserSetId = setId;
  renderChroniclePhotoBrowser();
  const browser = document.getElementById('chroniclePhotoBrowser');
  browser?.classList.remove('closing');
  browser?.classList.add('visible');
  browser?.setAttribute('aria-hidden', 'false');
  document.getElementById('chroniclePhotoBrowserClose')?.focus();
}

function closeChroniclePhotoBrowser() {
  const browser = document.getElementById('chroniclePhotoBrowser');
  if (!browser) return;
  const finish = () => {
    destroyPhotoBrowserSortable();
    browser.classList.remove('visible', 'closing');
    browser.setAttribute('aria-hidden', 'true');
    currentPhotoBrowserSetId = null;
  };
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    finish();
    return;
  }
  browser.classList.add('closing');
  setTimeout(finish, 150);
}

function destroyPhotoBrowserSortable() {
  if (!photoBrowserSortable) return;
  photoBrowserSortable.destroy();
  photoBrowserSortable = null;
}

async function setupPhotoBrowserSortable(grid) {
  destroyPhotoBrowserSortable();
  const records = chronicleReorderSets[currentPhotoBrowserSetId] || [];
  if (!grid || records.length < 2) return;

  const { default: Sortable } = await loadSortable();
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let sortableDragging = false;
  photoBrowserSortable = Sortable.create(grid, {
    draggable: '.chronicle-photo-browser-item',
    animation: reduceMotion ? 0 : 260,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    forceFallback: true,
    fallbackOnBody: true,
    fallbackTolerance: 6,
    fallbackClass: 'photo-sortable-fallback',
    ghostClass: 'photo-sortable-ghost',
    chosenClass: 'photo-sortable-chosen',
    dragClass: 'photo-sortable-drag',
    swapThreshold: 0.64,
    invertedSwapThreshold: 0.7,
    onChoose: () => {
      sortableDragging = false;
      suppressChroniclePhotoClick = true;
      grid.classList.add('sortable-choosing');
    },
    onStart: () => {
      sortableDragging = true;
      suppressChroniclePhotoClick = true;
      grid.classList.remove('sortable-choosing');
      grid.classList.add('sortable-active');
    },
    onEnd: async (event) => {
      sortableDragging = false;
      grid.classList.remove('sortable-choosing', 'sortable-active');
      const fromIndex = Number(event.oldIndex);
      const toIndex = Number(event.newIndex);
      const setId = currentPhotoBrowserSetId;
      const didMove = Number.isInteger(fromIndex) && Number.isInteger(toIndex) && fromIndex !== toIndex
        ? await reorderChroniclePhotos(setId, fromIndex, setId, toIndex)
        : false;
      if (didMove) {
        announceReorder(`照片已移到第 ${toIndex + 1} 張`);
      } else if (fromIndex !== toIndex) {
        renderChroniclePhotoBrowser();
      }
      setTimeout(() => {
        suppressChroniclePhotoClick = false;
      }, 120);
    },
    onUnchoose: () => {
      if (sortableDragging) return;
      grid.classList.remove('sortable-choosing');
      setTimeout(() => {
        suppressChroniclePhotoClick = false;
      }, 0);
    }
  });
}

function renderChroniclePhotoBrowser() {
  const grid = document.getElementById('chroniclePhotoBrowserGrid');
  if (!grid || !currentPhotoBrowserSetId) return;
  const records = chronicleReorderSets[currentPhotoBrowserSetId] || [];
  grid.innerHTML = records.map((record, index) => {
    const item = record.item;
    const url = mediaUrl(item);
    if (!url) return '';
    const caption = item?.caption ? `<figcaption>${escapeHtml(item.caption)}</figcaption>` : '';
    return `
      <figure class="chronicle-photo-browser-item" tabindex="0" data-chronicle-set="${currentPhotoBrowserSetId}" data-reorder-index="${index}" onkeydown="handleChronicleReorderKey(event, '${currentPhotoBrowserSetId}', ${index})">
        <span class="chronicle-drag-handle" aria-hidden="true"><span class="iconify" data-icon="ph:dots-three-vertical-thin"></span></span>
        <img src="${url}" loading="lazy" alt="${escapeHtml(item?.caption || `Chronicle photo ${index + 1}`)}" draggable="false" style="${chronicleImageStyle(item)}">
        <span class="chronicle-photo-browser-index">${index + 1}</span>
        ${caption}
      </figure>
    `;
  }).join('');
  setupPhotoBrowserSortable(grid);
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
    closeChroniclePhotoBrowser,
    closeFocusEditor,
    closePhotoLightbox,
    centerFocusEditor,
    endFocusDrag,
    handleChronicleReorderKey,
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
    startChroniclePhotoReorder,
    startFocusDrag
  };
}
