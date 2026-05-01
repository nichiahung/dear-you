import { openDB } from './services/localStore.js';
import { createEntryRepository } from './services/entryRepository.js';
import {
  CATEGORY_LABELS,
  CATEGORY_PLACEHOLDERS,
  DEFAULT_FEATURED_IMAGE_INDEX,
  DEFAULT_WORK_TYPE,
  WORK_TYPES
} from './core/constants.js';
import {
  inferImageFocus
} from './core/media.js';
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
let currentWorkFilter='all';

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
  toggleBirthdayMagic,
  waitForOpeningFonts
} = birthday;

const chronicles = createChroniclesFeature({
  getEntry,
  saveEntryToDB,
  loadEntries: () => loadEntries()
});

const {
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
  buildEditorEntry: buildMarginEditorEntry,
  cycleMarginBookStatus,
  handleBookSearchKey,
  handleMarginNoteKey,
  handleQueueBookActionKey,
  loadMarginBooks,
  removeMarginBook,
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
  if (workFilters) workFilters.style.display = isVoices ? 'grid' : 'none';
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

  const visibleList = isVoices && currentWorkFilter !== 'all'
    ? list.filter(entry => workForEntry(entry).type === currentWorkFilter)
    : list;

  if (isVoices) renderWorkFilters(list, currentWorkFilter);

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
  document.getElementById('fBody').value=entry?.body||defaults.body||'';
  document.getElementById('fBody').placeholder=CATEGORY_PLACEHOLDERS[editorCategory].body;
  selectedWorkType = isWorksEditor
    ? workForEntry(entry || { category: 'voices', work: defaults.work || { type: currentWorkFilter !== 'all' ? currentWorkFilter : DEFAULT_WORK_TYPE } }).type
    : DEFAULT_WORK_TYPE;
  renderWorkTypeOptions(isWorksEditor);
  renderMarginEditorFields(entry, defaults, isMarginsEditor);

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

function closeEditor(){
  document.getElementById('editor').classList.remove('visible');
  if(mediaRecorder&&mediaRecorder.state==='recording') mediaRecorder.stop();
  draftImages.forEach(i=>{if(i.blob&&i.url)URL.revokeObjectURL(i.url);});
  draftAudios.forEach(a=>{if(a.blob&&a.url)URL.revokeObjectURL(a.url);});
  draftImages=[];draftAudios=[];
}

async function saveEntry(){
  const date=document.getElementById('fDate').value;
  const title=document.getElementById('fTitle').value.trim();
  const body=document.getElementById('fBody').value.trim();

  if (currentCategory === 'margins') {
    const entry = await buildMarginEditorEntry({ date, editingId });
    if (!entry) return;
    await saveEntryToDB(entry);
    closeEditor();
    loadEntries();
    return;
  }

  if(!title&&!body&&draftImages.length===0&&draftAudios.length===0){
    alert('please add something — words, an image, or a voice ✦');
    return;
  }

  const entry={
    category:currentCategory,
    date:date||new Date().toISOString().slice(0,10),
    title,body,
    images:draftImages,
    audios:draftAudios,
    updatedAt:Date.now()
  };
  if (currentCategory === 'chronicles') {
    const year = Number((entry.date || '').slice(0, 4)) || new Date().getFullYear();
    entry.chronicle = {
      year,
      eyebrow: String(year),
      coverImagePath: draftImages.find(image => image.path)?.path || null
    };
    entry.images = draftImages.map(normalizeChronicleImageMeta);
  }
  if (currentCategory === 'voices') {
    const work = normalizeWork({ type: selectedWorkType, featuredImageIndex: DEFAULT_FEATURED_IMAGE_INDEX });
    entry.work = work;
  }
  if(editingId){
    entry.id=editingId;
    const old=await getEntry(editingId);
    entry.createdAt=old?.createdAt||Date.now();
    if (currentCategory === 'chronicles') {
      entry.chronicle = {
        ...(old?.chronicle || {}),
        ...entry.chronicle
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
  await saveEntryToDB(entry);
  closeEditor();
  loadEntries();
}

async function addImages(e){
  const files = Array.from(e.target.files);
  for (const f of files) {
    const focus = await inferImageFocus(f);
    draftImages.push({blob:f,url:URL.createObjectURL(f),name:f.name,...focus,fit:'cover'});
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
    if(draftImages[idx].blob&&draftImages[idx].url)URL.revokeObjectURL(draftImages[idx].url);
    draftImages.splice(idx,1);
  }
  else{
    if(draftAudios[idx].blob&&draftAudios[idx].url)URL.revokeObjectURL(draftAudios[idx].url);
    draftAudios.splice(idx,1);
  }
  renderMediaPreview();
}

function updateImageCaption(index, value) {
  if (!draftImages[index]) return;
  draftImages[index].caption = value.trim();
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
    document.getElementById('photoLightboxClose').addEventListener('click',closePhotoLightbox);
    document.getElementById('photoLightboxPrev').addEventListener('click',()=>movePhotoLightbox(-1));
    document.getElementById('photoLightboxNext').addEventListener('click',()=>movePhotoLightbox(1));
    document.getElementById('photoLightbox').addEventListener('click',(event)=>{
      if(event.target.id === 'photoLightbox') closePhotoLightbox();
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
        if (currentCategory === 'voices' && previousCategory !== 'voices') currentWorkFilter = 'all';
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

  showView('lock');
  }catch(err){
    console.error('Init error:', err);
  }
})();

Object.assign(window, {
  addBookFromSearch,
  confirmDelete,
  cycleMarginBookStatus,
  editEntry,
  handleBookSearchKey,
  handleChroniclePhotoClick,
  handleMarginNoteKey,
  handleQueueBookActionKey,
  handlePhotoFrameKey,
  openChronicleYearEditor,
  openFocusEditor,
  removeMedia,
  removeMarginBook,
  replyToMargin,
  saveMarginReflection,
  scrollToChronicleYear,
  searchOpenLibraryBooks,
  selectMarginAuthor,
  selectMarginBook,
  selectMarginEditorAuthor,
  selectWorkType,
  setWorkFilter,
  toggleBookSearchDrawer,
  updateImageCaption,
  voteMarginBook
});
