import { WORK_TYPES } from '../core/constants.js';
import { escapeHtml, formatDate } from '../core/dom.js';
import { mediaUrl } from '../core/media.js';
import { renderMarkdown } from '../core/richText.js';
import { isLocalEntryId } from '../services/localStore.js';
import { workForEntry } from './works.js';

export function renderEntry(e, isVoice=false) {
  const work = isVoice ? workForEntry(e) : null;
  const workType = work ? WORK_TYPES[work.type] : null;
  const images=(e.images||[]).map((b, idx)=>{
    const url=mediaUrl(b);
    if(!url) return '';
    if (isVoice) {
      const isFeatured = idx === work.featuredImageIndex;
      const frameClass = `voice-art-frame voice-art-frame-${idx + 1}${isFeatured ? ' voice-art-frame-featured' : ''}`;
      const imageClass = `voice-image voice-image-${idx + 1}${isFeatured ? ' voice-image-featured' : ''}`;
      return `<figure class="${frameClass}"><img class="${imageClass}" src="${url}" loading="lazy" alt=""></figure>`;
    }
    const caption = b?.caption ? `<figcaption>${escapeHtml(b.caption)}</figcaption>` : '';
    return `<figure><img src="${url}" loading="lazy" alt="${escapeHtml(b?.caption || '')}">${caption}</figure>`;
  }).join('');
  const audios=(e.audios||[]).map(b=>{
    const url=mediaUrl(b);
    if(!url) return '';
    return `<div class="entry-audio"><audio controls src="${url}"></audio></div>`;
  }).join('');
  const dateStr=e.date?formatDate(e.date):'';
  const cls = isVoice ? `entry voice-card ${workType?.cls || ''}` : 'entry';
  const entryId = String(e.id);
  const isCloudEntry = e.source === 'cloud' || !isLocalEntryId(e.id);
  const sourceIcon = isCloudEntry
    ? '<span class="iconify entry-source cloud" data-icon="ph:cloud-thin" title="Cloud"></span>'
    : '<span class="iconify entry-source local" data-icon="ph:bookmark-simple-thin" title="Local only"></span>';

  return `
    <article class="${cls}">
      <div class="entry-meta">
        <span class="entry-date">${dateStr}</span>
        <span class="entry-actions">
          ${sourceIcon}
          <button onclick="editEntry('${entryId}')"><span class="iconify" data-icon="ph:pencil-simple-thin"></span>edit</button>
          <button onclick="confirmDelete('${entryId}')"><span class="iconify" data-icon="ph:trash-thin"></span>remove</button>
        </span>
      </div>
      ${isVoice ? `<div class="work-tags"><div class="work-type-tag"><span class="iconify" data-icon="${workType.icon}"></span>${work.label}</div><div class="work-child-tag">${work.childLabel}</div></div>` : ''}
      ${e.title?`<h3 class="entry-title">${escapeHtml(e.title)}</h3>`:''}
      ${e.body?renderMarkdown(e.body, e.bodyFormat, 'entry-body markdown-content'):''}
      ${images?`<div class="entry-media">${images}</div>`:''}
      ${audios||''}
    </article>
  `;
}

export function mediaPreviewMarkup(draftImages, draftAudios, isVoices=false, featuredImageIndex=0) {
  const imgs=draftImages.map((i,idx)=>{
    const caption = (i.caption || '').trim();
    const isFeatured = isVoices && idx === featuredImageIndex;
    return `
    <div class="media-chip media-chip-image ${isFeatured ? 'is-featured' : ''}" tabindex="0" data-reorder-index="${idx}" onpointerdown="startImageReorder(event, ${idx})" onkeydown="handleImageReorderKey(event, ${idx})">
      <span class="media-drag-handle" aria-hidden="true"><span class="iconify" data-icon="ph:dots-three-vertical-thin"></span></span>
      <img src="${i.url}" alt="" draggable="false">
      ${isVoices ? `<button type="button" class="media-featured-btn ${isFeatured ? 'active' : ''}" onclick="selectFeaturedImage(${idx})" title="${isFeatured ? '封面圖片' : '設為封面'}"><span class="iconify" data-icon="${isFeatured ? 'ph:star-fill' : 'ph:star-thin'}"></span></button>` : ''}
      <div class="media-order-controls" aria-label="調整圖片順序">
        <button type="button" class="media-order-btn" onclick="moveMedia('image',${idx},-1)" ${idx === 0 ? 'disabled' : ''} aria-label="往前移一張" title="往前移一張"><span class="iconify" data-icon="ph:arrow-left-thin"></span></button>
        <span class="media-order-label">${idx + 1}</span>
        <button type="button" class="media-order-btn" onclick="moveMedia('image',${idx},1)" ${idx === draftImages.length - 1 ? 'disabled' : ''} aria-label="往後移一張" title="往後移一張"><span class="iconify" data-icon="ph:arrow-right-thin"></span></button>
      </div>
      <button type="button" class="media-caption-btn" onclick="openImageCaptionEditor(${idx})">
        <span class="iconify" data-icon="ph:pencil-simple-thin"></span>${caption ? '編輯描述' : '加入描述'}
      </button>
      <div class="media-caption-summary ${caption ? '' : 'empty'}" title="${escapeHtml(caption)}">${caption ? escapeHtml(caption) : '尚未描述'}</div>
      <button class="remove" onclick="removeMedia('image',${idx})">×</button>
    </div>`;
  }).join('');
  const auds=draftAudios.map((a,idx)=>`
    <div class="media-chip">
      <audio controls src="${a.url}"></audio>
      <button class="remove" onclick="removeMedia('audio',${idx})">×</button>
    </div>`).join('');
  return imgs + auds;
}

export function createEditorActions({ deleteEntryFromDB, getEntry, loadEntries, openEditor, setCurrentCategory, softDeleteEntry }) {
  async function editEntry(id) {
    await openEditor(await getEntry(id));
  }

  async function confirmDelete(id) {
    await softDeleteEntry(id);
  }

  function openChronicleYearEditor(year) {
    setCurrentCategory('chronicles');
    openEditor(null, {
      date: `${year}-01-01`,
      title: String(year),
      body: ''
    });
  }

  return {
    confirmDelete,
    editEntry,
    openChronicleYearEditor
  };
}
