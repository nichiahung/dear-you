const DB_NAME = 'dearYouBookDB';
const DB_VERSION = 1;
const STORE = 'entries';
const SETTINGS_STORE = 'settings';

let db = null;
let localDbAvailable = false;

export function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(STORE)) {
        const s = d.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        s.createIndex('category', 'category', { unique: false });
      }
      if (!d.objectStoreNames.contains(SETTINGS_STORE)) {
        d.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => {
      db = req.result;
      localDbAvailable = true;
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
}

function tx(s, m='readonly'){
  if (!localDbAvailable || !db) return null;
  return db.transaction(s,m).objectStore(s);
}

export async function getLocalSetting(k){
  if (!localDbAvailable) return null;
  return new Promise(r=>{const q=tx(SETTINGS_STORE)?.get(k); if(!q){r(null); return;} q.onsuccess=()=>r(q.result?.value);q.onerror=()=>r(null);});
}

export async function setLocalSetting(k,v){
  if (!localDbAvailable) return;
  return new Promise(r=>{const q=tx(SETTINGS_STORE,'readwrite')?.put({key:k,value:v}); if(!q){r(); return;} q.onsuccess=()=>r(); q.onerror=()=>r();});
}

export async function delLocalSetting(k){
  if (!localDbAvailable) return;
  return new Promise(r=>{const q=tx(SETTINGS_STORE,'readwrite')?.delete(k); if(!q){r(); return;} q.onsuccess=()=>r(); q.onerror=()=>r();});
}

export async function getLocalAllEntries(cat){
  if (!localDbAvailable) return [];
  return new Promise(r=>{
    const store = tx(STORE);
    if(!store){r([]); return;}
    const idx=store.index('category');
    const q=idx.getAll(cat);
    q.onsuccess=()=>{const l=q.result||[];l.sort((a,b)=>(b.date||'').localeCompare(a.date||''));r(l);};
    q.onerror=()=>r([]);
  });
}

export async function saveLocalEntry(e){
  if (!localDbAvailable) return e?.id ?? null;
  return new Promise(r=>{const q=tx(STORE,'readwrite')?.put(e); if(!q){r(e?.id ?? null); return;} q.onsuccess=()=>r(q.result); q.onerror=()=>r(e?.id ?? null);});
}

export async function deleteLocalEntry(id){
  if (!localDbAvailable) return;
  return new Promise(r=>{const q=tx(STORE,'readwrite')?.delete(id); if(!q){r(); return;} q.onsuccess=()=>r(); q.onerror=()=>r();});
}

export async function getLocalEntry(id){
  if (!localDbAvailable) return null;
  return new Promise(r=>{const q=tx(STORE)?.get(id); if(!q){r(null); return;} q.onsuccess=()=>r(q.result); q.onerror=()=>r(null);});
}

export function isLocalEntryId(id) {
  return typeof id === 'number' || /^\d+$/.test(String(id));
}
