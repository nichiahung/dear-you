# Firebase Architecture

文件最後更新：2026-05-02

本文件記錄目前 Firebase 架構、資料路徑、rules 與部署流程。

## Project

```text
projectId: dearyou-bfffc
hosting: https://dearyou-bfffc.web.app
```

設定檔：

```text
.firebaserc
firebase.json
functions/
firestore.rules
storage.rules
```

## Frontend Build

前端使用 Vite 8 與 npm 版 Firebase Web SDK。Firebase Hosting 的 public 目錄是 Vite build output：

```text
source: index.html, src/**, public/assets/**
build: npm run build
hosting public: dist
```

主要前端模組：

```text
src/app.js                       -> app bootstrap / chapter switching / feature wiring
src/styles.css                   -> site styles
src/core/*                       -> constants, DOM helpers, media helpers, entry normalization
src/features/*                   -> birthday, chronicles, editor, margins, works modules
src/services/firebaseCloud.js    -> Firebase Auth / Firestore / Storage bridge
src/services/entryRepository.js  -> cloud/local read-write facade
src/services/localStore.js       -> IndexedDB fallback
```

Firebase Web `apiKey` 由 Vite env 注入，避免把 key literal commit 進 repo：

```bash
cp .env.example .env.local
# Fill VITE_FIREBASE_API_KEY in .env.local
npm run dev
```

GitHub Actions deploy 需要 repo secret：

```text
FIREBASE_WEB_API_KEY
```

workflow 也接受 `VITE_FIREBASE_API_KEY` 作為 fallback secret name，方便沿用 `.env.local` 的命名。

這個 key 仍會出現在瀏覽器 bundle 中；它不是密碼。安全重點是 Google Cloud API key restrictions、Firebase Auth、Firestore/Storage Rules 與 App Check。

## Cloud Functions

`functions/index.js` 提供書本搜尋 proxy：

```text
GET /api/searchBooks?q={book title}
```

Hosting 透過 rewrite 將 `/api/searchBooks` 導到 `searchBooks` function。

搜尋順序：

```text
Google Books API regional/title variants -> Open Library API -> normalized book results
```

Google Books 會對同一個 query 做多組後端查詢：

```text
q={query}&country=TW
q=intitle:{query}&country=TW
中文 query 額外加 langRestrict=zh
```

這讓繁中書名、中文譯名、以及標題精準搜尋的命中率比單次 Google Books 查詢穩定。

回傳資料：

```js
{
  books: [
    {
      id: "google-...",
      provider: "google",
      providerId: "...",
      title: "書名",
      author: "作者",
      year: "2020",
      coverUrl: "https://...",
      isbn: "978..."
    }
  ]
}
```

Google Books key 使用 Firebase Secret，不寫在前端：

```bash
firebase functions:secrets:set GOOGLE_BOOKS_API_KEY --project dearyou-bfffc
```

本機或 function 尚未部署時，前端會 fallback 到 Open Library client-side search。

## GitHub Actions Deploy

`main` push 會透過 `.github/workflows/deploy.yml` build Vite frontend 並部署 Firebase Hosting。

Cloud Functions 部署保留為手動 workflow input：

```text
Actions -> Deploy to Firebase -> Run workflow -> deploy_functions=true
```

部署 Functions 時，GitHub secret `FIREBASE_SERVICE_ACCOUNT_DEARYOU_BFFFC` 對應的 service account 需要能 act as Firebase App Engine default service account：

```text
dearyou-bfffc@appspot.gserviceaccount.com
```

若缺少權限，GitHub Actions 會在 functions deploy 時失敗並提示需要：

```text
iam.serviceAccounts.ActAs
```

由 project Owner 到 Google Cloud IAM 補上 `Service Account User` role 後，再手動重跑 workflow 並勾選 `deploy_functions`。

## Local Emulator Validation

Vite dev server 不會套用 Firebase Hosting rewrite：

```text
http://localhost:5173/api/searchBooks -> Vite HTML fallback
```

要驗證正式 rewrite 行為，先 build，再啟動 Hosting + Functions emulators：

```bash
npm run build
cd functions && npm install && cd ..
firebase emulators:start --only hosting,functions --project dearyou-bfffc
```

Hosting emulator 預設使用 `5000`，若 port 被占用會改用其他 port，例如本次驗證為：

```text
Hosting   127.0.0.1:5002
Functions 127.0.0.1:5001
```

驗證 rewrite：

```bash
curl "http://127.0.0.1:5002/api/searchBooks?q=Norwegian%20Wood"
```

本次驗證結果：

```text
GET /api/searchBooks?q=Norwegian%20Wood -> 200 application/json
response.books.length -> 4
GET /api/searchBooks                  -> 400 {"error":"missing_query"}
POST /api/searchBooks?q=test          -> 405 {"error":"method_not_allowed"}
```

本機 emulator 若無 Secret Manager 權限或 `functions/.secret.local`，`GOOGLE_BOOKS_API_KEY` 會取不到；Google Books 可能 429，但 function 仍應 fallback 到 Open Library 並回傳 JSON。

## Authentication

目前使用 Firebase Anonymous Auth。

用途：

- 讓 Firestore / Storage rules 可以檢查 `request.auth != null`
- 讓不同裝置可進入同一份 shared book

注意：

- 生日解鎖是前端門鎖，適合私人分享，不是高強度安全機制。
- 若要更嚴格保護，後續改成 Email/Password Auth 或指定帳號 allowlist。

## Firestore

正式共同書本資料路徑：

```text
books/dear-you/entries/{entryId}
```

文章資料範例：

```js
{
  bookId: "dear-you",
  category: "letters",
  date: "2026-04-22",
  title: "測試信件一",
  body: "文字內容",
  images: [
    {
      path: "books/dear-you/entries/abc/images/xxx.jpg",
      url: "https://firebasestorage.googleapis.com/...",
      contentType: "image/jpeg",
      size: 245000,
      name: "photo.jpg"
    }
  ],
  audios: [],
  margin: {
    authorKey: "me",
    author: "J",
    bookId: "ol-works-OL...",
    book: {
      id: "ol-works-OL...",
      provider: "openlibrary",
      providerId: "/works/OL...",
      title: "Norwegian Wood",
      author: "Haruki Murakami",
      coverUrl: "https://covers.openlibrary.org/b/id/2237620-M.jpg",
      status: "想讀",
      votes: 1
    },
    page: "42",
    quote: "引用句",
    bookmarked: false
  },
  createdAt: 1776820000000,
  updatedAt: 1776820000000,
  legacyLocalId: null
}
```

`margin` 只用於 `category: "margins"` 的讀書心得；其他章節寫入 `null`。

書本候選清單存在 shared book settings：

```text
books/dear-you/settings/marginsBookQueue
```

保留舊路徑：

```text
users/{uid}/entries/{entryId}
users/{uid}/settings/{key}
```

用途：

- 舊版 per-user migration
- 不應作為新功能的主要寫入路徑

## Storage

正式媒體路徑：

```text
books/dear-you/entries/{entryId}/images/{timestamp}-{index}.{ext}
books/dear-you/entries/{entryId}/audios/{timestamp}-{index}.{ext}
```

Firestore 存 metadata 與 URL，不直接存大型 Blob。

## IndexedDB Fallback

仍保留本機 IndexedDB：

```text
dearYouBookDB
entries
settings
```

用途：

- 舊資料 migration fallback
- Firebase 不可用時 local only 暫存
- cloud/local icon 判斷來源

正式儲存仍以 Firestore + Storage 為準。

## Rules

目前 `firestore.rules`：

```text
books/dear-you/** -> request.auth != null 可讀寫
users/{uid}/**    -> request.auth.uid == uid 可讀寫
```

目前 `storage.rules`：

```text
books/dear-you/** -> request.auth != null 可讀寫
users/{uid}/**    -> request.auth.uid == uid 可讀寫
```

若後續導入 Email/Password Auth，應收緊 `books/dear-you/**`：

```js
request.auth != null && request.auth.token.email in allowedAuthors
```

或改成 custom claims。

## Deploy

### Hosting（自動）

`.github/workflows/deploy.yml` 在 push 到 `main` 且變動了 `index.html` / `firebase.json` / `.firebaserc` 時自動跑 `firebase deploy --only hosting`。

一次性設定：

1. Firebase Console → Project settings → Service accounts → Generate new private key（下載 JSON）
2. 確認角色至少包含 `Firebase Hosting Admin`
3. GitHub repo → Settings → Secrets and variables → Actions → New repository secret
   - Name: `FIREBASE_SERVICE_ACCOUNT_DEARYOU_BFFFC`
   - Value: 貼上整份 JSON
4. 確認後把本機那份 JSON 刪掉（別 commit）

之後推 main 會自動部署。Actions tab 可看到執行狀態與部署 preview URL。

### Hosting（手動備援）

```bash
npm run build
firebase deploy --only hosting --project dearyou-bfffc
```

### Rules（手動）

```bash
firebase deploy --only firestore:rules,storage --project dearyou-bfffc
```

### 全部

```bash
firebase deploy --project dearyou-bfffc
```

## Media Strategy

目前正式策略：

```text
文字 / metadata -> Firestore
圖片 / 錄音 -> Firebase Storage
本機 Blob -> fallback / migration
```

Google Photos / Google URL 討論：

- Google Photos 分享連結通常不是穩定 `<img src>` 直連。
- Google Photos API `baseUrl` 會過期，不適合長期存在 Firestore 當永久 URL。
- 未來可支援 `source: "external"` 圖片 URL，例如 Google Drive 公開直連或其他穩定圖片 CDN。

## Agent Notes

- 不要把正式儲存退回 IndexedDB-only。
- Hosting 部署前要先 `npm run build`，不要直接部署原始 `index.html`。
- `/api/searchBooks` rewrite 需用 Firebase Hosting emulator 或部署環境驗證；不要用 Vite dev server 的 `/api/searchBooks` 結果判斷。
- 修改資料模型時同步更新 rules、前端 render/save 邏輯與本文件。
- 新增 media provider 時保留 `source` 欄位，避免混淆 Storage URL、external URL、local Blob。
- Firebase API key 是 public config，不是後端 secret；不要 commit literal，並在 Google Cloud Console 限制允許的 referrer 與 API。
