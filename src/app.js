import { openDB } from './services/localStore.js';
import { createEntryRepository } from './services/entryRepository.js';
import {
  CATEGORY_LABELS,
  CATEGORY_PLACEHOLDERS,
  DEFAULT_FEATURED_IMAGE_INDEX,
  DEFAULT_WORK_TYPE,
  DEFAULT_WORK_CHILD,
  WORK_CHILDREN,
  WORK_TYPES
} from './core/constants.js';
import {
  inferImageFocus
} from './core/media.js';
import { extractLocationFromImage } from './core/exifLocation.js';
import { createPointerReorder } from './core/pointerReorder.js';
import {
  getMarkdownValue,
  markdownToPlainText,
  setMarkdownPlaceholder,
  setMarkdownValue
} from './core/richText.js';
import {
  normalizeWork,
  renderWorkFilters,
  workForEntry
} from './features/works.js';

import { createMarginsFeature } from './features/margins.js';
import { createChroniclesFeature } from './features/chronicles.js';
import { createEditorActions, mediaPreviewMarkup, renderEntry } from './features/editor.js';
import { createBirthdayFeature } from './features/birthday.js';

const {
  deleteEntryFromDB,
  getAllEntries,
  getEntry,
  getSetting,
  initCloudStore,
  saveEntryToDB,
  setSetting
} = createEntryRepository();

function showView(name) {
  document.body.classList.remove('app-booting');
  document.body.classList.toggle('stage-open', name !== 'app');
  document.getElementById('lockView').classList.toggle('active', name==='lock');
  document.getElementById('dedicationView').classList.toggle('active', name==='dedication');
  if (name==='app') document.getElementById('app').classList.add('visible');
  else document.getElementById('app').classList.remove('visible');
}

let currentCategory='letters';
let editingId=null;
let draftImages=[];
let draftAudios=[];
let mediaRecorder=null;
let recordChunks=[];
let selectedWorkType='drawing';
let selectedWorkChild='kris';
let currentWorkFilter='all';
let currentChildFilter='all';
let isSavingEntry=false;
let imageCaptionEditorIndex=null;
let imageCaptionCropper=null;
let imageCaptionCropDirty=false;
let cropperModulePromise=null;

const IMAGE_CAPTION_CROPPER_TEMPLATE = `
  <cropper-canvas background>
    <cropper-image></cropper-image>
    <cropper-shade hidden></cropper-shade>
    <cropper-handle action="select" plain></cropper-handle>
    <cropper-selection initial-coverage="1" movable resizable>
      <cropper-grid role="grid" bordered covered></cropper-grid>
      <cropper-crosshair centered></cropper-crosshair>
      <cropper-handle action="move" theme-color="rgba(255, 255, 255, 0.35)"></cropper-handle>
      <cropper-handle action="n-resize"></cropper-handle>
      <cropper-handle action="e-resize"></cropper-handle>
      <cropper-handle action="s-resize"></cropper-handle>
      <cropper-handle action="w-resize"></cropper-handle>
      <cropper-handle action="ne-resize"></cropper-handle>
      <cropper-handle action="nw-resize"></cropper-handle>
      <cropper-handle action="se-resize"></cropper-handle>
      <cropper-handle action="sw-resize"></cropper-handle>
    </cropper-selection>
  </cropper-canvas>
`;

function loadCropper() {
  if (!cropperModulePromise) cropperModulePromise = import('cropperjs');
  return cropperModulePromise;
}

const birthday = createBirthdayFeature({
  showView,
  loadEntries: () => loadEntries()
});

const {
  continueToBook,
  handleUnlock,
  hideBirthdayBear,
  hideBirthdayDrawing,
  initBirthdayToggle,
  resumeDailyUnlock,
  toggleBirthdayMagic,
  waitForOpeningFonts
} = birthday;

const chronicles = createChroniclesFeature({
  getEntry,
  saveEntryToDB,
  loadEntries: () => loadEntries()
});

const {
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
} = chronicles;

const editorActions = createEditorActions({
  deleteEntryFromDB,
  getEntry,
  loadEntries: () => loadEntries(),
  openEditor: (entry, defaults) => openEditor(entry, defaults),
  setCurrentCategory: (category) => {
    currentCategory = category;
  }
});

const {
  confirmDelete,
  editEntry,
  openChronicleYearEditor
} = editorActions;

const imagePointerReorder = createPointerReorder({
  itemSelector: '.media-chip-image',
  getItems: () => document.querySelectorAll('#mediaPreview .media-chip-image'),
  onReorder: (fromIndex, toIndex) => reorderDraftImages(fromIndex, toIndex),
  onAnnounce: announceReorder
});

const margins = createMarginsFeature({
  getEntry,
  getSetting,
  getCurrentCategory: () => currentCategory,
  loadEntries: () => loadEntries(),
  openEditor: (entry, defaults) => openEditor(entry, defaults),
  saveEntryToDB,
  setSetting
});

const {
  addBookFromSearch,
  addMarginQuote,
  buildEditorEntry: buildMarginEditorEntry,
  cycleMarginBookStatus,
  handleBookSearchKey,
  handleMarginNoteKey,
  handleQueueBookActionKey,
  loadMarginBooks,
  removeMarginBook,
  removeMarginQuote,
  renderEditorFields: renderMarginEditorFields,
  renderWorkspace: renderMarginsWorkspace,
  replyToMargin,
  saveMarginReflection,
  searchOpenLibraryBooks,
  selectMarginAuthor,
  selectMarginBook,
  selectMarginEditorAuthor,
  toggleBookSearchDrawer,
  voteMarginBook
} = margins;

async function loadEntries() {
  const list=await getAllEntries(currentCategory);
  const container=document.getElementById('entries');
  const countEl=document.getElementById('sectionCount');
  const isVoices = currentCategory === 'voices';
  const isMargins = currentCategory === 'margins';
  const workFilters = document.getElementById('workFilters');
  if (workFilters) workFilters.style.display = isVoices ? 'flex' : 'none';
  document.body.classList.toggle('chronicles-mode', currentCategory === 'chronicles');
  document.body.classList.toggle('margins-mode', isMargins);

  if (currentCategory === 'chronicles') {
    renderChroniclesTimeline(list, container, countEl);
    return;
  }

  if (isMargins) {
    await renderMarginsWorkspace(list, container, countEl);
    return;
  }

  const visibleList = isVoices
    ? list.filter(entry => {
        const w = workForEntry(entry);
        return (currentWorkFilter === 'all' || w.type === currentWorkFilter)
            && (currentChildFilter === 'all' || w.child === currentChildFilter);
      })
    : list;

  if (isVoices) renderWorkFilters(list, currentWorkFilter, currentChildFilter);

  countEl.textContent = visibleList.length>0 ? `· ${visibleList.length} ${visibleList.length===1?'entry':'entries'}` : '';

  if(visibleList.length===0){
    container.innerHTML=`<div class="empty-state">
      <div class="mark">⁎</div>
      <div class="msg-text">a blank page waits for you</div>
    </div>`;
    return;
  }

  container.innerHTML = visibleList.map(e=>renderEntry(e, isVoices)).join('');
}

function setWorkFilter(type) {
  currentWorkFilter = type === 'all' || WORK_TYPES[type] ? type : 'all';
  loadEntries();
}

async function openEditor(entry=null, defaults={}){
  editingId=entry?.id??null;
  const editorCategory = entry?.category || defaults.category || currentCategory;
  const cat=CATEGORY_LABELS[editorCategory];
  const isWorksEditor = editorCategory === 'voices';
  const isMarginsEditor = editorCategory === 'margins';
  currentCategory = editorCategory;
  if (isMarginsEditor) await loadMarginBooks();
  document.getElementById('editorTitle').textContent = isMarginsEditor
    ? (entry ? 'Edit Reading Note' : '留下書邊的字')
    : (entry ? 'Edit Entry' : 'A New Entry');
  document.getElementById('editorSubtitle').textContent = `${cat.chNum} · ${cat.en}`;
  document.getElementById('fDate').value=entry?.date||defaults.date||new Date().toISOString().slice(0,10);
  document.getElementById('fTitle').value=entry?.title||defaults.title||'';
  document.getElementById('fTitle').placeholder=CATEGORY_PLACEHOLDERS[editorCategory].title;
  await setMarkdownPlaceholder('fBody', CATEGORY_PLACEHOLDERS[editorCategory].body);
  await setMarkdownValue('fBody', entry?.body||defaults.body||'', entry?.bodyFormat || defaults.bodyFormat);
  selectedWorkType = isWorksEditor
    ? workForEntry(entry || { category: 'voices', work: defaults.work || { type: currentWorkFilter !== 'all' ? currentWorkFilter : DEFAULT_WORK_TYPE } }).type
    : DEFAULT_WORK_TYPE;
  selectedWorkChild = isWorksEditor
    ? workForEntry(entry || { category: 'voices', work: defaults.work || { child: currentChildFilter !== 'all' ? currentChildFilter : DEFAULT_WORK_CHILD } }).child
    : DEFAULT_WORK_CHILD;
  renderWorkTypeOptions(isWorksEditor);
  renderWorkChildOptions(isWorksEditor);
  await renderMarginEditorFields(entry, defaults, isMarginsEditor);

  draftImages.forEach(i=>URL.revokeObjectURL(i.url));
  draftAudios.forEach(a=>URL.revokeObjectURL(a.url));
  draftImages=[];
  draftAudios=[];

  if(entry && !isMarginsEditor){
    (entry.images||[]).forEach(b=>{
      if(b?.path&&b?.url) draftImages.push({...b,cloud:true});
      else if(b?.blob instanceof Blob) draftImages.push({...b,url:b.url||URL.createObjectURL(b.blob)});
      else if(b instanceof Blob) draftImages.push({blob:b,url:URL.createObjectURL(b)});
    });
    (entry.audios||[]).forEach(b=>{
      if(b?.path&&b?.url) draftAudios.push({...b,cloud:true});
      else if(b?.blob instanceof Blob) draftAudios.push({...b,url:b.url||URL.createObjectURL(b.blob)});
      else if(b instanceof Blob) draftAudios.push({blob:b,url:URL.createObjectURL(b)});
    });
  }

  renderMediaPreview();
  setEditorSaving(false);
  document.getElementById('editor').classList.add('visible');
}

function renderWorkTypeOptions(visible) {
  const field = document.getElementById('workTypeField');
  const wrap = document.getElementById('workTypeOptions');
  if (!field || !wrap) return;
  field.style.display = visible ? 'block' : 'none';
  if (!visible) {
    wrap.innerHTML = '';
    return;
  }
  wrap.innerHTML = Object.entries(WORK_TYPES).map(([type, data]) => `
    <button type="button" class="work-type-option ${selectedWorkType === type ? 'active' : ''}" onclick="selectWorkType('${type}')">
      <span class="iconify" data-icon="${data.icon}"></span>
      <span>${data.label}</span>
    </button>
  `).join('');
}

function selectWorkType(type) {
  selectedWorkType = WORK_TYPES[type] ? type : DEFAULT_WORK_TYPE;
  renderWorkTypeOptions(true);
}

function renderWorkChildOptions(visible) {
  const field = document.getElementById('workChildField');
  const wrap = document.getElementById('workChildOptions');
  if (!field || !wrap) return;
  field.style.display = visible ? 'block' : 'none';
  if (!visible) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = Object.entries(WORK_CHILDREN).map(([child, data]) => `
    <button type="button" class="work-type-option ${selectedWorkChild === child ? 'active' : ''}" onclick="selectWorkChild('${child}')">
      <span>${data.label}</span>
    </button>
  `).join('');
}

function selectWorkChild(child) {
  selectedWorkChild = WORK_CHILDREN[child] ? child : DEFAULT_WORK_CHILD;
  renderWorkChildOptions(true);
}

function setChildFilter(child) {
  currentChildFilter = child === 'all' || WORK_CHILDREN[child] ? child : 'all';
  renderEntries();
}

function closeEditor(){
  if (isSavingEntry) return;
  closeImageCaptionEditor();
  setEditorSaving(false);
  document.getElementById('editor').classList.remove('visible');
  if(mediaRecorder&&mediaRecorder.state==='recording') mediaRecorder.stop();
  draftImages.forEach(i=>{if(i.blob&&i.url)URL.revokeObjectURL(i.url);});
  draftAudios.forEach(a=>{if(a.blob&&a.url)URL.revokeObjectURL(a.url);});
  draftImages=[];draftAudios=[];
}

async function saveEntry(){
  if (isSavingEntry) return;
  const date=document.getElementById('fDate').value;
  const title=document.getElementById('fTitle').value.trim();
  const body=await getMarkdownValue('fBody');
  const hasImages = draftImages.length > 0;

  if (currentCategory === 'margins') {
    const entry = await buildMarginEditorEntry({ date, editingId });
    if (!entry) return;
    await runEditorSaveState(async () => {
      await saveEntryToDB(entry);
    }, false);
    return;
  }

  if(!title&&!markdownToPlainText(body, 'markdown')&&draftImages.length===0&&draftAudios.length===0){
    alert('please add something — words, an image, or a voice ✦');
    return;
  }

  const entry={
    category:currentCategory,
    date:date||new Date().toISOString().slice(0,10),
    title,body,
    bodyFormat:'markdown',
    images:draftImages,
    audios:draftAudios,
    updatedAt:Date.now()
  };
  if (currentCategory === 'chronicles') {
    const year = Number((entry.date || '').slice(0, 4)) || new Date().getFullYear();
    const gpsLocations = [...new Set(draftImages.map(img => img.gpsLocation).filter(Boolean))];
    entry.chronicle = {
      year,
      eyebrow: String(year),
      coverImagePath: draftImages.find(image => image.path)?.path || null,
      location: gpsLocations.join(' · ') || ''
    };
    entry.images = draftImages.map(normalizeChronicleImageMeta);
  }
  if (currentCategory === 'voices') {
    const work = normalizeWork({ type: selectedWorkType, child: selectedWorkChild, featuredImageIndex: DEFAULT_FEATURED_IMAGE_INDEX });
    entry.work = work;
  }
  if(editingId){
    entry.id=editingId;
    const old=await getEntry(editingId);
    entry.createdAt=old?.createdAt||Date.now();
    if (currentCategory === 'chronicles') {
      entry.chronicle = {
        ...(old?.chronicle || {}),
        ...entry.chronicle,
        location: entry.chronicle.location || old?.chronicle?.location || ''
      };
    }
    if (currentCategory === 'voices') {
      entry.work = normalizeWork({
        ...(old?.work || {}),
        ...entry.work
      });
    }
  } else {
    entry.createdAt=Date.now();
  }
  await runEditorSaveState(async () => {
    await saveEntryToDB(entry);
  }, hasImages);
}

async function runEditorSaveState(saveTask, hasImages=false) {
  isSavingEntry = true;
  setEditorSaving(true, {
    phase: 'saving',
    title: hasImages ? 'Saving photos' : 'Saving entry',
    copy: hasImages ? '正在保存圖片與文字' : '正在保存這一頁'
  });
  try {
    await saveTask();
    setEditorSaving(true, {
      phase: 'saved',
      title: 'Saved',
      copy: hasImages ? '照片已保存' : '內容已保存'
    });
    await new Promise(resolve => setTimeout(resolve, 520));
    isSavingEntry = false;
    closeEditor();
    loadEntries();
  } catch (err) {
    console.error(err);
    setEditorSaving(true, {
      phase: 'error',
      title: 'Save failed',
      copy: '儲存失敗，請再試一次'
    });
    setTimeout(() => {
      isSavingEntry = false;
      setEditorSaving(false);
    }, 900);
  }
}

function setEditorSaving(active, options={}) {
  const editor = document.getElementById('editor');
  const card = editor?.querySelector('.modal-card');
  const state = document.getElementById('editorSaveState');
  const title = document.getElementById('editorSaveTitle');
  const copy = document.getElementById('editorSaveCopy');
  const saveBtn = document.getElementById('saveBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  if (!editor || !state || !saveBtn || !cancelBtn) return;

  const phase = options.phase || 'saving';
  editor.classList.toggle('saving', active);
  card?.classList.toggle('saving', active);
  state.classList.toggle('visible', active);
  state.dataset.phase = phase;
  state.setAttribute('aria-hidden', active ? 'false' : 'true');
  if (title && options.title) title.textContent = options.title;
  if (copy && options.copy) copy.textContent = options.copy;
  saveBtn.disabled = active;
  cancelBtn.disabled = active;
  saveBtn.textContent = active ? (phase === 'saved' ? 'Saved' : 'Saving') : 'Save';
}

async function addImages(e){
  const files = Array.from(e.target.files);
  for (const f of files) {
    const focus = await inferImageFocus(f);
    const imgRef = {blob:f,url:URL.createObjectURL(f),name:f.name,...focus,fit:'cover'};
    draftImages.push(imgRef);
    if (currentCategory === 'chronicles') {
      extractLocationFromImage(f).then(loc => { if (loc) imgRef.gpsLocation = loc; });
    }
  }
  e.target.value='';
  renderMediaPreview();
}

function addAudioFile(e){
  Array.from(e.target.files).forEach(f=>{
    draftAudios.push({blob:f,url:URL.createObjectURL(f),name:f.name});
  });
  e.target.value='';
  renderMediaPreview();
}

function removeMedia(type,idx){
  if(type==='image'){
    if (imageCaptionEditorIndex === idx) closeImageCaptionEditor();
    if(draftImages[idx].blob&&draftImages[idx].url)URL.revokeObjectURL(draftImages[idx].url);
    draftImages.splice(idx,1);
    if (imageCaptionEditorIndex !== null && imageCaptionEditorIndex > idx) imageCaptionEditorIndex -= 1;
  }
  else{
    if(draftAudios[idx].blob&&draftAudios[idx].url)URL.revokeObjectURL(draftAudios[idx].url);
    draftAudios.splice(idx,1);
  }
  renderMediaPreview();
}

function moveMedia(type, idx, delta) {
  if (type !== 'image') return;
  const targetIndex = idx + delta;
  reorderDraftImages(idx, targetIndex);
}

function reorderDraftImages(fromIndex, toIndex) {
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return false;
  if (fromIndex === toIndex) return false;
  if (fromIndex < 0 || fromIndex >= draftImages.length) return false;
  if (toIndex < 0 || toIndex >= draftImages.length) return false;
  const [image] = draftImages.splice(fromIndex, 1);
  draftImages.splice(toIndex, 0, image);
  renderMediaPreview();
  return true;
}

function startImageReorder(event, index) {
  imagePointerReorder.start(event, index);
}

function handleImageReorderKey(event, index) {
  if (!event.altKey && !event.metaKey) return;
  const delta = event.key === 'ArrowLeft' ? -1 : (event.key === 'ArrowRight' ? 1 : 0);
  if (!delta) return;
  event.preventDefault();
  if (reorderDraftImages(index, index + delta)) announceReorder(`照片已移到第 ${index + delta + 1} 張`);
}

async function openImageCaptionEditor(index) {
  const image = draftImages[index];
  const editor = document.getElementById('imageCaptionEditor');
  const cropperMount = document.getElementById('imageCaptionCropper');
  const count = document.getElementById('imageCaptionEditorCount');
  const text = document.getElementById('imageCaptionEditorText');
  if (!image || !editor || !cropperMount || !text) return;
  destroyImageCaptionCropper();
  imageCaptionEditorIndex = index;
  imageCaptionCropDirty = false;
  cropperMount.replaceChildren();
  if (count) count.textContent = `${index + 1} / ${draftImages.length}`;
  text.value = image.caption || '';
  editor.classList.add('visible');
  editor.setAttribute('aria-hidden', 'false');
  const cropperImage = new Image();
  cropperImage.alt = image.caption || `照片 ${index + 1}`;
  cropperImage.src = image.url || '';
  const { default: Cropper } = await loadCropper();
  imageCaptionCropper = new Cropper(cropperImage, {
    container: cropperMount,
    template: IMAGE_CAPTION_CROPPER_TEMPLATE
  });
  requestAnimationFrame(() => cropperMount.focus());
}

function closeImageCaptionEditor() {
  const editor = document.getElementById('imageCaptionEditor');
  const cropperMount = document.getElementById('imageCaptionCropper');
  const text = document.getElementById('imageCaptionEditorText');
  if (!editor) return;
  editor.classList.remove('visible');
  editor.setAttribute('aria-hidden', 'true');
  destroyImageCaptionCropper();
  cropperMount?.replaceChildren();
  if (text) text.value = '';
  imageCaptionEditorIndex = null;
  imageCaptionCropDirty = false;
}

function destroyImageCaptionCropper() {
  imageCaptionCropper?.destroy?.();
  imageCaptionCropper = null;
}

function canvasToBlob(canvas, type='image/jpeg', quality=0.9) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Unable to export cropped image'));
    }, type, quality);
  });
}

function croppedImageName(name='photo') {
  const base = String(name || 'photo').replace(/\.[^.]+$/, '');
  return `${base}-cropped.jpg`;
}

async function saveImageCaptionEditor() {
  const text = document.getElementById('imageCaptionEditorText');
  if (imageCaptionEditorIndex === null || !draftImages[imageCaptionEditorIndex] || !text) return;
  const currentImage = draftImages[imageCaptionEditorIndex];
  try {
    const selection = imageCaptionCropDirty ? imageCaptionCropper?.getCropperSelection?.() : null;
    const canvas = selection ? await selection.$toCanvas() : null;
    const croppedBlob = canvas ? await canvasToBlob(canvas) : null;
    const croppedUrl = croppedBlob ? URL.createObjectURL(croppedBlob) : currentImage.url;
    if (croppedBlob && currentImage.blob && currentImage.url) URL.revokeObjectURL(currentImage.url);
    draftImages[imageCaptionEditorIndex] = {
      ...currentImage,
      blob: croppedBlob || currentImage.blob,
      url: croppedUrl,
      name: croppedBlob ? croppedImageName(currentImage.name) : currentImage.name,
      caption: text.value.trim(),
      path: croppedBlob ? undefined : currentImage.path,
      cloud: croppedBlob ? undefined : currentImage.cloud,
      contentType: croppedBlob ? croppedBlob.type : currentImage.contentType,
      size: croppedBlob ? croppedBlob.size : currentImage.size
    };
    closeImageCaptionEditor();
    renderMediaPreview();
  } catch (err) {
    console.error(err);
    alert('無法輸出裁切後的圖片，請再試一次或重新上傳圖片。');
  }
}

function adjustImageCaptionCropper(action) {
  const selection = imageCaptionCropper?.getCropperSelection?.();
  if (!selection) return;
  if (action === 'zoom-in') selection.$zoom(0.1);
  if (action === 'zoom-out') selection.$zoom(-0.1);
  if (action === 'reset') selection.$reset();
  imageCaptionCropDirty = true;
}

function announceReorder(message) {
  const live = document.getElementById('reorderLive');
  if (!live) return;
  live.textContent = '';
  requestAnimationFrame(() => {
    live.textContent = message;
  });
}

function renderMediaPreview(){
  const wrap=document.getElementById('mediaPreview');
  wrap.innerHTML=mediaPreviewMarkup(draftImages, draftAudios);
}

async function toggleRecord(){
  const btn=document.getElementById('recBtn');
  if(mediaRecorder&&mediaRecorder.state==='recording'){mediaRecorder.stop();return;}
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){
    alert('此瀏覽器不支援直接錄音。\n可以用「上傳聲音」按鈕來加入錄好的檔案。');return;
  }
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    let mimeType='';
    if(typeof MediaRecorder!=='undefined'){
      if(MediaRecorder.isTypeSupported('audio/webm'))mimeType='audio/webm';
      else if(MediaRecorder.isTypeSupported('audio/mp4'))mimeType='audio/mp4';
    }
    mediaRecorder=mimeType?new MediaRecorder(stream,{mimeType}):new MediaRecorder(stream);
    recordChunks=[];
    mediaRecorder.ondataavailable=(e)=>{if(e.data.size>0)recordChunks.push(e.data);};
    mediaRecorder.onstop=()=>{
      const blob=new Blob(recordChunks,{type:mimeType||'audio/webm'});
      draftAudios.push({blob,url:URL.createObjectURL(blob)});
      renderMediaPreview();
      stream.getTracks().forEach(t=>t.stop());
      btn.innerHTML='<span class="iconify" data-icon="ph:microphone-thin"></span>錄音';
      btn.classList.remove('recording');
    };
    mediaRecorder.start();
    btn.innerHTML='<span class="iconify" data-icon="ph:stop-circle-thin"></span>停止';
    btn.classList.add('recording');
  }catch(err){
    alert('無法啟用麥克風：'+err.message+'\n\n改用「↑ 上傳聲音」就可以了。');
  }
}

(async function init(){
  try{
    const openingAnimationReady = waitForOpeningFonts().then(() => {
      document.body.classList.add('animation-ready');
    });

    try{await openDB();}
    catch(err){
      console.error('IndexedDB failed:', err);
      const msg=document.getElementById('lockMsg');
      if(msg){msg.textContent='儲存初始化失敗，功能受限';}
    }
    await openingAnimationReady;
    await initCloudStore();

    document.getElementById('unlockBtn').addEventListener('click',handleUnlock);
    document.getElementById('continueBtn').addEventListener('click',continueToBook);
    document.querySelector('.birthday-bear-card').addEventListener('click',hideBirthdayBear);
    document.querySelector('.birthday-drawing-card').addEventListener('click',hideBirthdayDrawing);
    const birthdayMagicToggle = document.getElementById('birthdayMagicToggle');
    birthdayMagicToggle.addEventListener('click',toggleBirthdayMagic);
    initBirthdayToggle();
    document.getElementById('newBtn').addEventListener('click',()=>{
      openEditor();
    });
    document.getElementById('cancelBtn').addEventListener('click',closeEditor);
    document.getElementById('saveBtn').addEventListener('click',saveEntry);
    document.getElementById('addImgBtn').addEventListener('click',()=>document.getElementById('fImages').click());
    document.getElementById('uploadAudioBtn').addEventListener('click',()=>document.getElementById('fAudio').click());
    document.getElementById('recBtn').addEventListener('click',toggleRecord);
    document.getElementById('fImages').addEventListener('change',addImages);
    document.getElementById('fAudio').addEventListener('change',addAudioFile);
    document.getElementById('imageCaptionEditorClose').addEventListener('click',closeImageCaptionEditor);
    document.getElementById('imageCaptionEditorCancel').addEventListener('click',closeImageCaptionEditor);
    document.getElementById('imageCaptionEditorSave').addEventListener('click',saveImageCaptionEditor);
    document.getElementById('imageCaptionCropper').addEventListener('action',()=>{
      if (imageCaptionCropper) imageCaptionCropDirty = true;
    });
    document.querySelectorAll('[data-caption-crop-action]').forEach(button=>{
      button.addEventListener('click',()=>adjustImageCaptionCropper(button.dataset.captionCropAction));
    });
    document.getElementById('imageCaptionEditor').addEventListener('click',(event)=>{
      if(event.target.id === 'imageCaptionEditor') closeImageCaptionEditor();
    });
    document.getElementById('photoLightboxClose').addEventListener('click',closePhotoLightbox);
    document.getElementById('photoLightboxPrev').addEventListener('click',()=>movePhotoLightbox(-1));
    document.getElementById('photoLightboxNext').addEventListener('click',()=>movePhotoLightbox(1));
    document.getElementById('photoLightbox').addEventListener('click',(event)=>{
      if(event.target.id === 'photoLightbox') closePhotoLightbox();
    });
    document.getElementById('chroniclePhotoBrowserClose').addEventListener('click',closeChroniclePhotoBrowser);
    document.getElementById('chroniclePhotoBrowser').addEventListener('click',(event)=>{
      if(event.target.id === 'chroniclePhotoBrowser') closeChroniclePhotoBrowser();
    });
    document.getElementById('focusEditorClose').addEventListener('click',closeFocusEditor);
    document.getElementById('focusEditorCancel').addEventListener('click',closeFocusEditor);
    document.getElementById('focusEditorSave').addEventListener('click',saveFocusEditor);
    document.getElementById('focusEditor').addEventListener('click',(event)=>{
      if(event.target.id === 'focusEditor') closeFocusEditor();
    });
    const focusPreview = document.getElementById('focusEditorPreview');
    focusPreview.addEventListener('click',setFocusFromPointer);
    focusPreview.addEventListener('pointerdown',startFocusDrag);
    focusPreview.addEventListener('pointermove',moveFocusDrag);
    focusPreview.addEventListener('pointerup',endFocusDrag);
    focusPreview.addEventListener('pointercancel',endFocusDrag);
    document.getElementById('focusRangeX').addEventListener('input',(event)=>setFocusAxis('x', event.target.value));
    document.getElementById('focusRangeY').addEventListener('input',(event)=>setFocusAxis('y', event.target.value));
    document.getElementById('focusRangeZoom').addEventListener('input',(event)=>setFocusAxis('zoom', event.target.value));
    document.querySelectorAll('[data-focus-action]').forEach(button=>{
      button.addEventListener('click',()=>{
        const action = button.dataset.focusAction;
        if(action === 'up') nudgeFocusEditor(0, -4);
        if(action === 'down') nudgeFocusEditor(0, 4);
        if(action === 'left') nudgeFocusEditor(-4, 0);
        if(action === 'right') nudgeFocusEditor(4, 0);
        if(action === 'center') centerFocusEditor();
      });
    });
    document.addEventListener('keydown',(event)=>{
      const captionEditor = document.getElementById('imageCaptionEditor');
      if(captionEditor?.classList.contains('visible')) {
        if(event.key === 'Escape') closeImageCaptionEditor();
        return;
      }
      const focusEditor = document.getElementById('focusEditor');
      if(focusEditor?.classList.contains('visible')) {
        if(event.key === 'Escape') closeFocusEditor();
        if(event.key === 'ArrowLeft') { event.preventDefault(); nudgeFocusEditor(-2, 0); }
        if(event.key === 'ArrowRight') { event.preventDefault(); nudgeFocusEditor(2, 0); }
        if(event.key === 'ArrowUp') { event.preventDefault(); nudgeFocusEditor(0, -2); }
        if(event.key === 'ArrowDown') { event.preventDefault(); nudgeFocusEditor(0, 2); }
        return;
      }
      const lightbox = document.getElementById('photoLightbox');
      const browser = document.getElementById('chroniclePhotoBrowser');
      if(browser?.classList.contains('visible')) {
        if(event.key === 'Escape') closeChroniclePhotoBrowser();
        return;
      }
      if(!lightbox?.classList.contains('visible')) return;
      if(event.key === 'Escape') closePhotoLightbox();
      if(event.key === 'ArrowLeft') movePhotoLightbox(-1);
      if(event.key === 'ArrowRight') movePhotoLightbox(1);
    });

    const CHAPTERS = {
      letters: {
        cls: 'fp-letters',
        chapter: 'CH. I',
        zh: '寫給妳的信',
        en: 'Letters',
        introTitle: 'A letter kept in the quiet pages of us.',
        introCopy: 'Small love notes, ordinary days, and sentences that still belong to you.'
      },
      margins: {
        cls: 'fp-margins',
        chapter: 'CH. II',
        zh: '書頁邊的字',
        en: 'Margins',
        introTitle: 'Reading together, leaving words in the margins for each other.',
        introCopy: 'A sentence underlined, a page where I paused and thought of you. Any of these can become a reply between us.'
      },
      chronicles: {
        cls: 'fp-chronicles',
        chapter: 'CH. III',
        zh: '我們的編年史',
        en: 'Chronicles',
        introTitle: 'The years gathered gently, one memory at a time.',
        introCopy: 'A timeline of places we stood, seasons we crossed, and photographs that keep the feeling close.'
      },
      voices: {
        cls: 'fp-voices',
        chapter: 'CH. IV',
        zh: '孩子的作品',
        en: 'Works',
        introTitle: "The children's works, saved like small bright offerings.",
        introCopy: 'Drawings, awards, and handmade pieces they made for you, each with the story around it.'
      }
    };

    function updateFrontispiece(cat) {
      const fp = document.getElementById('frontispiece');
      const cap = document.getElementById('frontispieceCaption');
      const data = CHAPTERS[cat];
      fp.className = 'chapter-frontispiece ' + data.cls;
      // Re-trigger fade animation
      fp.style.animation = 'none';
      fp.offsetHeight; // reflow
      fp.style.animation = '';
      const chapter = document.createElement('span');
      const zh = document.createElement('span');
      const en = document.createElement('span');
      chapter.className = 'caption-chapter';
      zh.className = 'caption-zh';
      en.className = 'caption-en';
      chapter.textContent = data.chapter;
      zh.textContent = data.zh;
      en.textContent = data.en;
      cap.replaceChildren(chapter, zh, en);
      document.getElementById('chapterIntroTitle').textContent = data.introTitle;
      document.getElementById('chapterIntroCopy').textContent = data.introCopy;
    }

    document.querySelectorAll('.chapter').forEach(t=>{
      t.addEventListener('click',()=>{
        document.querySelectorAll('.chapter').forEach(x=>x.classList.remove('active'));
        t.classList.add('active');
        const previousCategory = currentCategory;
        currentCategory=t.dataset.cat;
        closePhotoLightbox();
        if (currentCategory === 'voices' && previousCategory !== 'voices') { currentWorkFilter = 'all'; currentChildFilter = 'all'; }
        const cat=CATEGORY_LABELS[currentCategory];
        document.getElementById('sectionTitle').textContent=cat.en;
        updateFrontispiece(currentCategory);
        loadEntries();
      });
    });

    ['bYear','bMonth','bDay'].forEach(id=>{
      document.getElementById(id).addEventListener('keydown',e=>{if(e.key==='Enter')handleUnlock();});
    });
    document.getElementById('bYear').addEventListener('input',e=>{if(e.target.value.length>=4)document.getElementById('bMonth').focus();});
    document.getElementById('bMonth').addEventListener('input',e=>{if(e.target.value.length>=2)document.getElementById('bDay').focus();});

    if (!resumeDailyUnlock()) showView('lock');
  }catch(err){
    console.error('Init error:', err);
    document.body.classList.remove('app-booting');
    document.getElementById('lockView')?.classList.add('active');
  }
})();

Object.assign(window, {
  addBookFromSearch,
  addMarginQuote,
  closeChroniclePhotoBrowser,
  confirmDelete,
  cycleMarginBookStatus,
  editEntry,
  handleBookSearchKey,
  handleImageReorderKey,
  handleChronicleReorderKey,
  handleChroniclePhotoClick,
  handleMarginNoteKey,
  handleQueueBookActionKey,
  handlePhotoFrameKey,
  openImageCaptionEditor,
  openChronicleYearEditor,
  openFocusEditor,
  moveMedia,
  removeMedia,
  removeMarginBook,
  removeMarginQuote,
  replyToMargin,
  saveMarginReflection,
  scrollToChronicleYear,
  searchOpenLibraryBooks,
  selectMarginAuthor,
  selectMarginBook,
  selectMarginEditorAuthor,
  selectWorkChild,
  selectWorkType,
  setChildFilter,
  setWorkFilter,
  startImageReorder,
  startChroniclePhotoReorder,
  toggleBookSearchDrawer,
  voteMarginBook
});
