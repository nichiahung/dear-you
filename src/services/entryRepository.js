import { CATEGORY_LABELS } from '../core/constants.js';
import { normalizeEntryForUI } from '../core/entries.js';
import { asDraftMedia, mediaForLocalStore } from '../core/media.js';
import {
  delLocalSetting,
  deleteLocalEntry,
  getLocalAllEntries,
  getLocalEntry,
  getLocalSetting,
  isLocalEntryId,
  saveLocalEntry,
  setLocalSetting
} from './localStore.js';

export function createEntryRepository() {
  let cloudAvailable = false;

  function setCloudStatus(text, error=false) {
    const el = document.getElementById('cloudStatus');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('error', error);
  }

  function waitForCloudBridge() {
    if (window.dearYouCloud) return Promise.resolve(window.dearYouCloud);
    if (window.dearYouCloudError) return Promise.reject(window.dearYouCloudError);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Firebase module did not initialize in time'));
      }, 10000);

      function cleanup() {
        clearTimeout(timer);
        window.removeEventListener('dearYouCloudReady', handleReady);
        window.removeEventListener('dearYouCloudUnavailable', handleUnavailable);
      }

      function handleReady() {
        cleanup();
        resolve(window.dearYouCloud);
      }

      function handleUnavailable(event) {
        cleanup();
        reject(event.detail || window.dearYouCloudError || new Error('Firebase module unavailable'));
      }

      window.addEventListener('dearYouCloudReady', handleReady, { once: true });
      window.addEventListener('dearYouCloudUnavailable', handleUnavailable, { once: true });
    });
  }

  async function migrateLocalDataToCloud() {
    const cloud = window.dearYouCloud;
    await cloud.ready;
    const migratedKey = `firebaseMigrated:dearyou-bfffc:shared:${cloud.bookId}`;
    if (await getLocalSetting(migratedKey)) return;

    const existing = [];
    for (const cat of Object.keys(CATEGORY_LABELS)) {
      existing.push(...await cloud.listEntries(cat));
    }
    const migratedLegacyIds = new Set(existing.map(e=>e.legacyLocalId).filter(Boolean));

    for (const cat of Object.keys(CATEGORY_LABELS)) {
      const localEntries = await getLocalAllEntries(cat);
      for (const entry of localEntries) {
        const legacyLocalId = `${entry.category || cat}:${entry.id}`;
        if (migratedLegacyIds.has(legacyLocalId)) continue;

        await cloud.saveEntry({
          category: entry.category || cat,
          date: entry.date || new Date().toISOString().slice(0,10),
          title: entry.title || '',
          body: entry.body || '',
          images: (entry.images || []).map(asDraftMedia),
          audios: (entry.audios || []).map(asDraftMedia),
          margin: entry.margin || null,
          work: entry.work || null,
          createdAt: entry.createdAt || Date.now(),
          updatedAt: entry.updatedAt || Date.now(),
          legacyLocalId
        });
      }
    }

    await setLocalSetting(migratedKey, Date.now());
  }

  async function initCloudStore() {
    try {
      const cloud = await waitForCloudBridge();
      await cloud.ready;
      cloudAvailable = true;
      setCloudStatus('synced to cloud');
      migrateLocalDataToCloud().catch((err) => {
        console.warn('Local data migration skipped:', err);
        setCloudStatus('synced to cloud - local import skipped', true);
      });
    } catch (err) {
      cloudAvailable = false;
      console.error('Firebase cloud sync unavailable:', err);
      setCloudStatus(`local only - ${err.code || err.message || 'Firebase unavailable'}`, true);
    }
  }

  async function getSetting(k){
    if (!cloudAvailable) return getLocalSetting(k);
    try { return await window.dearYouCloud.getSetting(k); }
    catch(err){ console.error(err); setCloudStatus('local only - cloud read failed', true); return getLocalSetting(k); }
  }

  async function setSetting(k,v){
    await setLocalSetting(k,v);
    if (!cloudAvailable) return;
    try { await window.dearYouCloud.setSetting(k,v); setCloudStatus('synced to cloud'); }
    catch(err){ console.error(err); setCloudStatus('saved locally - cloud write failed', true); }
  }

  async function delSetting(k){
    await delLocalSetting(k);
    if (!cloudAvailable) return;
    try { await window.dearYouCloud.deleteSetting(k); setCloudStatus('synced to cloud'); }
    catch(err){ console.error(err); setCloudStatus('removed locally - cloud delete failed', true); }
  }

  async function getAllEntries(cat){
    if (!cloudAvailable) return (await getLocalAllEntries(cat)).map(normalizeEntryForUI);
    try { const entries = await window.dearYouCloud.listEntries(cat); setCloudStatus('synced to cloud'); return entries.map(normalizeEntryForUI); }
    catch(err){ console.error(err); setCloudStatus('local only - cloud read failed', true); return (await getLocalAllEntries(cat)).map(normalizeEntryForUI); }
  }

  async function saveEntryToDB(e){
    const localCopy = {
      ...e,
      images: (e.images || []).map(mediaForLocalStore).filter(Boolean),
      audios: (e.audios || []).map(mediaForLocalStore).filter(Boolean)
    };
    if (!e.id || isLocalEntryId(e.id)) await saveLocalEntry(localCopy);
    if (!cloudAvailable) return e.id || localCopy.id;
    try { const id = await window.dearYouCloud.saveEntry(e); setCloudStatus('synced to cloud'); return id; }
    catch(err){ console.error(err); setCloudStatus('saved locally - cloud write failed', true); return e.id || localCopy.id; }
  }

  async function deleteEntryFromDB(id){
    if (isLocalEntryId(id)) await deleteLocalEntry(id);
    if (!cloudAvailable) return;
    try { await window.dearYouCloud.deleteEntry(id); setCloudStatus('synced to cloud'); }
    catch(err){ console.error(err); setCloudStatus('removed locally - cloud delete failed', true); }
  }

  async function getEntry(id){
    if (!cloudAvailable) return normalizeEntryForUI(await getLocalEntry(id));
    try { return normalizeEntryForUI(await window.dearYouCloud.getEntry(id)); }
    catch(err){ console.error(err); setCloudStatus('local only - cloud read failed', true); return isLocalEntryId(id) ? normalizeEntryForUI(await getLocalEntry(id)) : null; }
  }

  return {
    deleteEntryFromDB,
    delSetting,
    getAllEntries,
    getEntry,
    getSetting,
    initCloudStore,
    saveEntryToDB,
    setSetting
  };
}
