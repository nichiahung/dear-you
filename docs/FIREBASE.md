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

Hosting：

```bash
npm run build
firebase deploy --only hosting --project dearyou-bfffc
```

Rules：

```bash
firebase deploy --only firestore:rules,storage --project dearyou-bfffc
```

全部：

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
- Firebase API key 是 public config，不是 secret；不要把它當作敏感密碼處理。
