import { WORK_TYPES } from '../core/constants.js';
import { escapeHtml, formatDate } from '../core/dom.js';
import { mediaUrl } from '../core/media.js';
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
      ${isVoice ? `<div class="work-type-tag"><span class="iconify" data-icon="${workType.icon}"></span>${work.label}</div>` : ''}
      ${e.title?`<h3 class="entry-title">${escapeHtml(e.title)}</h3>`:''}
      ${e.body?`<div class="entry-body">${escapeHtml(e.body)}</div>`:''}
      ${images?`<div class="entry-media">${images}</div>`:''}
      ${audios||''}
    </article>
  `;
}

export function mediaPreviewMarkup(draftImages, draftAudios) {
  const imgs=draftImages.map((i,idx)=>`
    <div class="media-chip">
      <img src="${i.url}" alt="">
      <textarea class="media-caption-input" rows="2" placeholder="這張照片的描述" oninput="updateImageCaption(${idx}, this.value)">${escapeHtml(i.caption || '')}</textarea>
      <button class="remove" onclick="removeMedia('image',${idx})">×</button>
    </div>`).join('');
  const auds=draftAudios.map((a,idx)=>`
    <div class="media-chip">
      <audio controls src="${a.url}"></audio>
      <button class="remove" onclick="removeMedia('audio',${idx})">×</button>
    </div>`).join('');
  return imgs + auds;
}

export function createEditorActions({ deleteEntryFromDB, getEntry, loadEntries, openEditor, setCurrentCategory }) {
  async function editEntry(id) {
    await openEditor(await getEntry(id));
  }

  async function confirmDelete(id) {
    if (!confirm('確定要移除這一篇嗎？')) return;
    await deleteEntryFromDB(id);
    loadEntries();
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
