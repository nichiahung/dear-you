import { MARLENE_BIRTHDAY } from '../core/constants.js';

const BIRTHDAY_MAGIC_STORAGE_KEY = 'birthdayMagicEnabled';
const BIRTHDAY_MAGIC_PREVIEW_STORAGE_KEY = 'birthdayMagicPreviewEnabled';
const BIRTHDAY_FLOWERS = [
  { src: 'assets/characters/birthday-flower-smile.png', className: 'flower-smile' },
  { src: 'assets/characters/birthday-flower-pink.png', className: 'flower-pink' }
];

const PETAL_TEMPLATES = [
  `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs><radialGradient id="pg{{ID}}" cx="35%" cy="25%" r="75%"><stop offset="0%" stop-color="#f5e0dc"/><stop offset="45%" stop-color="#d9b0b0"/><stop offset="100%" stop-color="#a67f7f"/></radialGradient></defs>
    <path d="M50,8 C70,20 85,45 78,70 C72,88 58,95 50,95 C42,95 28,88 22,70 C15,45 30,20 50,8 Z" fill="url(#pg{{ID}})"/>
    <path d="M50,12 C50,35 50,60 50,88" stroke="#b5898a" stroke-width="0.8" stroke-opacity="0.35" fill="none"/>
  </svg>`,
  `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs><radialGradient id="pg{{ID}}" cx="40%" cy="30%" r="80%"><stop offset="0%" stop-color="#f8e8e4"/><stop offset="50%" stop-color="#c9a8a8"/><stop offset="100%" stop-color="#8a6a6b"/></radialGradient></defs>
    <path d="M52,5 C75,15 88,40 82,68 C76,90 55,92 48,88 C28,78 18,52 28,28 C34,12 44,6 52,5 Z" fill="url(#pg{{ID}})"/>
    <path d="M48,15 C46,40 50,65 55,85" stroke="#9a7070" stroke-width="0.7" stroke-opacity="0.3" fill="none"/>
  </svg>`,
  `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs><radialGradient id="pg{{ID}}" cx="50%" cy="30%" r="70%"><stop offset="0%" stop-color="#fbeeea"/><stop offset="60%" stop-color="#d5b5b5"/><stop offset="100%" stop-color="#a67f7f"/></radialGradient></defs>
    <path d="M50,15 C60,8 80,18 82,42 C84,68 62,92 50,92 C38,92 16,68 18,42 C20,18 40,8 50,15 Z" fill="url(#pg{{ID}})"/>
  </svg>`,
  `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs><radialGradient id="pg{{ID}}" cx="35%" cy="20%" r="85%"><stop offset="0%" stop-color="#f6e2de"/><stop offset="55%" stop-color="#cda0a0"/><stop offset="100%" stop-color="#966666"/></radialGradient></defs>
    <path d="M50,3 C62,15 72,38 68,62 C64,84 55,95 50,95 C45,95 36,84 32,62 C28,38 38,15 50,3 Z" fill="url(#pg{{ID}})"/>
    <path d="M50,8 Q50,50 50,90" stroke="#a67f7f" stroke-width="0.6" stroke-opacity="0.4" fill="none"/>
  </svg>`
];

export function createBirthdayFeature({ showView, loadEntries }) {
  let previewBirthdayMode = false;
  let birthdayMagicEnabled = false;

  function isActualBirthdayToday(){
    const now = new Date();
    const [, bMonth, bDay] = MARLENE_BIRTHDAY.split('-').map(Number);
    return (now.getMonth() + 1) === bMonth && now.getDate() === bDay;
  }

  function isBirthdayToday(){
    return isActualBirthdayToday() || previewBirthdayMode;
  }

  function shouldShowBirthdayStickers(){
    return isBirthdayToday();
  }

  function calculateAge(){
    const now = new Date();
    const birth = new Date(MARLENE_BIRTHDAY + 'T00:00:00');
    let age = now.getFullYear() - birth.getFullYear();
    const thisYearBirthday = new Date(now.getFullYear(), birth.getMonth(), birth.getDate());
    if (now < thisYearBirthday) age--;
    if (previewBirthdayMode && now < thisYearBirthday) age++;
    return age;
  }

  function daysSinceBirth(){
    const now = new Date();
    const birth = new Date(MARLENE_BIRTHDAY + 'T00:00:00');
    return Math.floor((now - birth) / (1000 * 60 * 60 * 24));
  }

  function createPetalRain(){
    const container = document.getElementById('petalRain');
    if (!container) return;
    container.innerHTML = '';
    container.style.display = 'block';
    const count = 28;
    const sizes = ['size-s', 'size-m', 'size-m', 'size-l'];

    for (let i = 0; i < count; i++) {
      const petal = document.createElement('div');
      petal.className = `petal ${sizes[Math.floor(Math.random() * sizes.length)]}`;
      const template = PETAL_TEMPLATES[Math.floor(Math.random() * PETAL_TEMPLATES.length)];
      petal.innerHTML = template.replace(/\{\{ID\}\}/g, `p${i}`);
      petal.style.left = `${Math.random() * 100}vw`;
      petal.style.setProperty('--dur', `${12 + Math.random() * 8}s`);
      petal.style.setProperty('--delay', `${-Math.random() * 14}s`);
      petal.style.setProperty('--drift', `${(Math.random() - 0.5) * 280}px`);
      petal.style.setProperty('--sway', `${2.5 + Math.random() * 2}s`);
      petal.style.setProperty('--flip', `${3 + Math.random() * 4}s`);
      container.appendChild(petal);
    }
  }

  function stopPetalRain(){
    const container = document.getElementById('petalRain');
    if (!container) return;
    container.innerHTML = '';
    container.style.display = 'none';
  }

  function showContentFlowerDrift(){
    const container = document.getElementById('birthdayFlowerDrift');
    if (!container || !birthdayMagicEnabled) return;
    if (!document.getElementById('app')?.classList.contains('visible')) return;

    container.innerHTML = '';
    container.style.display = 'block';

    const count = window.innerWidth <= 640 ? 4 : 5;
    for (let i = 0; i < count; i++) {
      const flowerAsset = BIRTHDAY_FLOWERS[i % BIRTHDAY_FLOWERS.length];
      const flower = document.createElement('div');
      flower.className = `birthday-floating-flower ${flowerAsset.className}`;
      flower.style.left = `${8 + Math.random() * 84}vw`;
      flower.style.setProperty('--flower-size', `${window.innerWidth <= 640 ? 30 + Math.random() * 14 : 38 + Math.random() * 22}px`);
      flower.style.setProperty('--flower-dur', `${18 + Math.random() * 10}s`);
      flower.style.setProperty('--flower-delay', `${-Math.random() * 16}s`);
      flower.style.setProperty('--flower-drift', `${(Math.random() - 0.5) * 180}px`);
      flower.style.setProperty('--flower-sway', `${4.6 + Math.random() * 2.4}s`);
      flower.style.setProperty('--flower-rot-start', `${Math.random() * 60 - 30}deg`);
      flower.style.setProperty('--flower-rot-end', `${Math.random() * 180 - 90}deg`);

      const img = document.createElement('img');
      img.src = flowerAsset.src;
      img.alt = '';
      img.decoding = 'async';
      flower.appendChild(img);
      container.appendChild(flower);
    }
  }

  function stopContentFlowerDrift(){
    const container = document.getElementById('birthdayFlowerDrift');
    if (!container) return;
    container.innerHTML = '';
    container.style.display = 'none';
  }

  function startPetalEffects(){
    createPetalRain();
    showContentFlowerDrift();
  }

  function stopPetalEffects(){
    stopPetalRain();
    stopContentFlowerDrift();
  }

  function showBirthdayBear(){
    const pop = document.getElementById('birthdayBearPop');
    if (!pop) return;
    pop.classList.remove('closing');
    pop.classList.add('visible');
    pop.setAttribute('aria-hidden', 'false');
  }

  function hideBirthdayBear(){
    const pop = document.getElementById('birthdayBearPop');
    if (!pop || !pop.classList.contains('visible')) return;
    showBirthdayMarleneSurprise();
    createBirthdayBurst(pop);
    hideBirthdaySticker(pop);
  }

  function showBirthdayDrawing(){
    const pop = document.getElementById('birthdayDrawingPop');
    if (!pop) return;
    pop.classList.remove('closing');
    pop.classList.add('visible');
    pop.setAttribute('aria-hidden', 'false');
  }

  function hideBirthdayDrawing(){
    const pop = document.getElementById('birthdayDrawingPop');
    if (!pop || !pop.classList.contains('visible')) return;
    showBirthdayMarleneSurprise();
    createBirthdayBurst(pop);
    hideBirthdaySticker(pop);
  }

  function showBirthdayMarleneSurprise(){
    const surprise = document.getElementById('birthdayMarleneSurprise');
    if (!surprise) return;
    surprise.classList.remove('visible');
    surprise.offsetHeight;
    surprise.classList.add('visible');
    surprise.setAttribute('aria-hidden', 'false');
  }

  function hideBirthdayMarleneSurprise(){
    const surprise = document.getElementById('birthdayMarleneSurprise');
    if (!surprise) return;
    surprise.classList.remove('visible');
    surprise.setAttribute('aria-hidden', 'true');
  }

  function hideBirthdaySticker(pop){
    if (!pop.classList.contains('visible')) return;
    pop.classList.add('closing');
    window.setTimeout(() => {
      pop.classList.remove('visible', 'closing');
      pop.setAttribute('aria-hidden', 'true');
    }, 190);
  }

  function createBirthdayBurst(pop){
    if (!pop.classList.contains('visible')) return;
    const card = pop.querySelector('[class$="-card"]');
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const originX = rect.left + rect.width * 0.5;
    const originY = rect.top + rect.height * 0.45;
    const bits = ['♡', '', '♡', '', ''];
    const colors = ['#c4a876', '#d995a2', '#e8b7be', '#b08d57', '#f0c7cf'];

    bits.forEach((bit, i) => {
      const el = document.createElement('span');
      el.className = `birthday-burst ${bit ? 'heart' : 'dot'}`;
      el.textContent = bit;
      el.style.setProperty('--x', `${originX}px`);
      el.style.setProperty('--y', `${originY}px`);
      el.style.setProperty('--dx', `${(i - 2) * 18 + (i % 2 ? 8 : -6)}px`);
      el.style.setProperty('--dy', `${-42 - i * 8}px`);
      el.style.setProperty('--rot', `${(i - 2) * 18}deg`);
      el.style.setProperty('--size', `${bit ? 13 + (i % 2) * 2 : 7 + (i % 2) * 2}px`);
      el.style.setProperty('--burst-color', colors[i]);
      document.body.appendChild(el);
      window.setTimeout(() => el.remove(), 950);
    });
  }

  function applyBirthdayMagic(){
    if (!isBirthdayToday()) return;

    document.body.classList.add('birthday-mode');
    if (birthdayMagicEnabled) startPetalEffects();
    else stopPetalEffects();

    const coverLabel = document.querySelector('.cover-label');
    if (coverLabel) coverLabel.textContent = 'Happy Birthday, my love';

    const message = document.getElementById('birthdayMessage');
    if (message) message.style.display = 'block';

    const ageEl = document.getElementById('ageNum');
    const daysEl = document.getElementById('daysSince');
    if (ageEl) ageEl.textContent = calculateAge();
    if (daysEl) daysEl.textContent = daysSinceBirth().toLocaleString();

    document.title = '♡ Happy Birthday, Marlene ♡';
  }

  function removeBirthdayMagic({ hideStickers = true } = {}){
    document.body.classList.remove('birthday-mode');
    stopPetalEffects();
    if (hideStickers) {
      hideBirthdayBear();
      hideBirthdayDrawing();
      hideBirthdayMarleneSurprise();
    }

    const coverLabel = document.querySelector('.cover-label');
    if (coverLabel) coverLabel.textContent = 'For the one I love';

    const message = document.getElementById('birthdayMessage');
    if (message) message.style.display = 'none';

    document.title = '致 · 妳 — A Love Letter in Chapters';
  }

  function isPreviewToggleEnabled() {
    const params = new URLSearchParams(window.location.search);
    return window.location.hostname === 'localhost'
      || window.location.hostname === '127.0.0.1'
      || window.location.protocol === 'file:'
      || params.get('birthdayPreview') === '1';
  }

  function isBirthdayToggleAvailable() {
    return isActualBirthdayToday() || isPreviewToggleEnabled();
  }

  function birthdayMagicPreferenceKey() {
    if (!isActualBirthdayToday()) return BIRTHDAY_MAGIC_PREVIEW_STORAGE_KEY;
    return `${BIRTHDAY_MAGIC_STORAGE_KEY}:${new Date().getFullYear()}`;
  }

  function readBirthdayMagicPreference(key) {
    try {
      const value = window.localStorage.getItem(key);
      if (value === null) return null;
      return value === '1';
    } catch (_) {
      return null;
    }
  }

  function writeBirthdayMagicPreference(key, enabled) {
    try {
      window.localStorage.setItem(key, enabled ? '1' : '0');
    } catch (_) {}
  }

  function syncBirthdayToggle() {
    const button = document.getElementById('birthdayMagicToggle');
    if (!button) return;
    button.classList.toggle('active', birthdayMagicEnabled);
    button.setAttribute('aria-checked', birthdayMagicEnabled ? 'true' : 'false');
  }

  function setBirthdayMagicEnabled(enabled) {
    birthdayMagicEnabled = enabled;
    writeBirthdayMagicPreference(birthdayMagicPreferenceKey(), enabled);
    syncBirthdayToggle();

    if (!isBirthdayToday()) return;
    if (enabled) startPetalEffects();
    else stopPetalEffects();
  }

  function initBirthdayToggle() {
    const button = document.getElementById('birthdayMagicToggle');
    if (!button) return;

    if (!isBirthdayToggleAvailable()) {
      button.hidden = true;
      removeBirthdayMagic();
      return;
    }

    button.hidden = false;
    previewBirthdayMode = !isActualBirthdayToday() && isPreviewToggleEnabled();
    const savedPreference = readBirthdayMagicPreference(birthdayMagicPreferenceKey());
    birthdayMagicEnabled = savedPreference ?? isActualBirthdayToday();
    syncBirthdayToggle();
    applyBirthdayMagic();
  }

  async function waitForOpeningFonts() {
    if (!document.fonts || !document.fonts.ready) {
      await new Promise((resolve) => setTimeout(resolve, 180));
      return;
    }
    try {
      await Promise.race([
        document.fonts.ready,
        new Promise((resolve) => setTimeout(resolve, 1500))
      ]);
    } catch (_) {
      await new Promise((resolve) => setTimeout(resolve, 180));
    }
  }

  function toggleBirthdayMagic(){
    setBirthdayMagicEnabled(!birthdayMagicEnabled);
  }

  async function handleUnlock() {
    const y=document.getElementById('bYear').value.trim();
    const m=document.getElementById('bMonth').value.trim();
    const d=document.getElementById('bDay').value.trim();
    const msg=document.getElementById('lockMsg');

    if(!y||!m||!d){msg.textContent='please fill in all fields';return;}

    const input=`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;

    if(input===MARLENE_BIRTHDAY){
      msg.textContent='';
      showView('dedication');
    } else {
      msg.textContent='try again ✦';
      setTimeout(()=>{msg.textContent='';}, 2200);
    }
  }

  function continueToBook(){
    showView('app');
    if (shouldShowBirthdayStickers()) {
      showBirthdayBear();
      showBirthdayDrawing();
    }
    if (birthdayMagicEnabled) {
      showContentFlowerDrift();
    }
    loadEntries();
  }

  return {
    applyBirthdayMagic,
    continueToBook,
    handleUnlock,
    hideBirthdayBear,
    hideBirthdayDrawing,
    initBirthdayToggle,
    toggleBirthdayMagic,
    waitForOpeningFonts
  };
}
