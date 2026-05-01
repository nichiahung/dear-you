import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  where
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes
} from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCe3kmMwYZ4_v9L_0xnetosfWYM9UeoN9A",
  authDomain: "dearyou-bfffc.firebaseapp.com",
  projectId: "dearyou-bfffc",
  storageBucket: "dearyou-bfffc.firebasestorage.app",
  messagingSenderId: "290995743342",
  appId: "1:290995743342:web:aba96f0bc727af9bb1147f",
  measurementId: "G-JSR7N4FBSV"
};

const app = initializeApp(firebaseConfig);
const analytics = await isSupported().then((supported) => supported ? getAnalytics(app) : null);
const auth = getAuth(app);
const firestore = getFirestore(app);
const storage = getStorage(app);
const SHARED_BOOK_ID = "dear-you";

const authReady = new Promise((resolve, reject) => {
  const unsub = onAuthStateChanged(auth, (user) => {
    if (user) {
      unsub();
      resolve(user);
    }
  }, reject);

  if (!auth.currentUser) {
    signInAnonymously(auth).catch(reject);
  }
});

function entriesCollection() {
  return collection(firestore, "books", SHARED_BOOK_ID, "entries");
}

function entryDocument(id) {
  return doc(firestore, "books", SHARED_BOOK_ID, "entries", id);
}

function settingDocument(key) {
  return doc(firestore, "books", SHARED_BOOK_ID, "settings", key);
}

function cleanMediaItem(item) {
  const cleaned = {
    path: item.path,
    url: item.url,
    contentType: item.contentType || null,
    size: typeof item.size === "number" ? item.size : null,
    name: item.name || null,
    caption: item.caption || null,
    role: item.role || null,
    order: typeof item.order === "number" ? item.order : null
  };
  if (typeof item.focalX === "number") cleaned.focalX = item.focalX;
  if (typeof item.focalY === "number") cleaned.focalY = item.focalY;
  if (typeof item.zoom === "number") cleaned.zoom = item.zoom;
  if (item.fit) cleaned.fit = item.fit;
  return cleaned;
}

function blobExtension(blob) {
  const type = blob?.type || "";
  if (type.includes("png")) return "png";
  if (type.includes("gif")) return "gif";
  if (type.includes("webp")) return "webp";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  if (type.includes("mp4")) return "m4a";
  if (type.includes("mpeg")) return "mp3";
  if (type.includes("wav")) return "wav";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("webm")) return "webm";
  return "bin";
}

async function uploadMedia(entryId, kind, item, index) {
  if (item?.path && item?.url) return cleanMediaItem(item);

  const blob = item?.blob || item;
  if (!(blob instanceof Blob)) return null;

  const ext = blobExtension(blob);
  const path = `books/${SHARED_BOOK_ID}/entries/${entryId}/${kind}/${Date.now()}-${index}.${ext}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, blob, { contentType: blob.type || "application/octet-stream" });
  const url = await getDownloadURL(fileRef);

  const uploaded = {
    path,
    url,
    contentType: blob.type || "application/octet-stream",
    size: blob.size || 0,
    name: item?.name || null,
    caption: item?.caption || null,
    role: item?.role || null,
    order: typeof item?.order === "number" ? item.order : null
  };
  if (typeof item?.focalX === "number") uploaded.focalX = item.focalX;
  if (typeof item?.focalY === "number") uploaded.focalY = item.focalY;
  if (typeof item?.zoom === "number") uploaded.zoom = item.zoom;
  if (item?.fit) uploaded.fit = item.fit;
  return cleanMediaItem(uploaded);
}

async function deleteStoredMedia(media) {
  if (!media?.path) return;
  try {
    await deleteObject(ref(storage, media.path));
  } catch (err) {
    console.warn("Unable to delete stored media:", err);
  }
}

function normalizeEntry(id, data) {
  return {
    id,
    category: data.category || "letters",
    date: data.date || "",
    title: data.title || "",
    body: data.body || "",
    images: Array.isArray(data.images) ? data.images : [],
    audios: Array.isArray(data.audios) ? data.audios : [],
    margin: data.margin || null,
    chronicle: data.chronicle || null,
    work: data.work || null,
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now(),
    legacyLocalId: data.legacyLocalId || null,
    source: "cloud"
  };
}

const ready = authReady.then((user) => ({ user, uid: user.uid }));

async function listEntries(category) {
  await ready;
  const snapshot = await getDocs(query(entriesCollection(), where("category", "==", category)));
  return snapshot.docs
    .map((entry) => normalizeEntry(entry.id, entry.data()))
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.updatedAt || 0) - (a.updatedAt || 0));
}

async function getEntry(id) {
  await ready;
  const snapshot = await getDoc(entryDocument(String(id)));
  return snapshot.exists() ? normalizeEntry(snapshot.id, snapshot.data()) : null;
}

async function saveEntry(entry) {
  await ready;
  const id = entry.id ? String(entry.id) : doc(entriesCollection()).id;
  const previous = entry.id ? await getEntry(id) : null;
  const images = (await Promise.all((entry.images || []).map((item, index) => uploadMedia(id, "images", item, index)))).filter(Boolean);
  const audios = (await Promise.all((entry.audios || []).map((item, index) => uploadMedia(id, "audios", item, index)))).filter(Boolean);
  const keepPaths = new Set([...images, ...audios].map((item) => item.path).filter(Boolean));

  await setDoc(entryDocument(id), {
    category: entry.category,
    date: entry.date,
    title: entry.title,
    body: entry.body,
    images,
    audios,
    margin: entry.category === "margins" ? (entry.margin || previous?.margin || null) : null,
    chronicle: entry.chronicle || previous?.chronicle || null,
    work: entry.category === "voices" ? (entry.work || previous?.work || null) : null,
    createdAt: entry.createdAt || previous?.createdAt || Date.now(),
    updatedAt: Date.now(),
    legacyLocalId: entry.legacyLocalId || previous?.legacyLocalId || null,
    bookId: SHARED_BOOK_ID
  });

  [...(previous?.images || []), ...(previous?.audios || [])]
    .filter((item) => item.path && !keepPaths.has(item.path))
    .forEach((item) => deleteStoredMedia(item));

  return id;
}

async function deleteEntry(id) {
  const entry = await getEntry(String(id));
  if (entry) {
    await Promise.all([...(entry.images || []), ...(entry.audios || [])].map(deleteStoredMedia));
  }

  await ready;
  await deleteDoc(entryDocument(String(id)));
}

async function getSetting(key) {
  await ready;
  const snapshot = await getDoc(settingDocument(key));
  return snapshot.exists() ? snapshot.data().value : null;
}

async function setSetting(key, value) {
  await ready;
  await setDoc(settingDocument(key), { value, updatedAt: Date.now(), bookId: SHARED_BOOK_ID });
}

async function deleteSetting(key) {
  await ready;
  await deleteDoc(settingDocument(key));
}

window.dearYouFirebase = { app, analytics, auth, firestore, storage, config: firebaseConfig };
window.dearYouCloud = {
  bookId: SHARED_BOOK_ID,
  ready,
  listEntries,
  getEntry,
  saveEntry,
  deleteEntry,
  getSetting,
  setSetting,
  deleteSetting
};
window.dispatchEvent(new Event("dearYouCloudReady"));
