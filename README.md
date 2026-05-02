# 致 · 妳 — A Love Letter in Chapters

為 Marlene 而存在的數位情書。

文件最後更新：2026-05-02

線上網站：[https://dearyou-bfffc.web.app](https://dearyou-bfffc.web.app)

## Project Snapshot

這是一個 Vite 單頁前端，部署在 Firebase Hosting，正式資料同步到 Firestore 與 Firebase Storage。

目前流程：

```text
輸入 Marlene 生日
-> Dedication page
-> turn the page
-> 進入四個章節
-> 文字 / 圖片 / 錄音同步到 cloud
```

目前核心：

- 單頁前端：Vite 8 + vanilla ES modules
- 前端入口：`index.html`、`src/app.js`
- 前端分層：`src/core/`、`src/features/`、`src/services/`
- Hosting：Firebase Hosting
- Auth：Firebase Anonymous Auth
- 文字資料：Firestore `books/dear-you/entries/{entryId}`
- 圖片 / 錄音：Firebase Storage `books/dear-you/entries/{entryId}/...`
- 書本搜尋：Cloud Functions `/api/searchBooks` proxy，Google Books + Open Library
- 本機 fallback：IndexedDB `dearYouBookDB`

## Repository Guide

```text
index.html       -> Vite HTML shell
src/app.js       -> app bootstrap、章節切換、feature wiring、inline handler bridge
src/core/        -> 常數、DOM helper、media helper、entry normalization
src/features/    -> birthday、chronicles、editor、margins、works 功能模組
src/services/    -> Firebase cloud bridge、entry repository、IndexedDB fallback
public/assets/   -> Hosting 公開靜態素材
package.json     -> Vite / Firebase Web SDK frontend dependencies
firebase.json    -> Firebase Hosting / Firestore / Storage 設定
.firebaserc      -> Firebase project: dearyou-bfffc
firestore.rules  -> Firestore security rules
storage.rules    -> Storage security rules
.gitignore       -> 忽略 Firebase CLI cache
docs/ASSETS.md   -> 素材、字體、圖示、配色、授權
docs/FIREBASE.md -> Firebase 架構、資料路徑、rules、部署
docs/ROADMAP.md  -> 後續功能、技術債、AI agent 維護注意事項
```

## Documentation

- [Assets and Licensing](docs/ASSETS.md)
- [Firebase Architecture](docs/FIREBASE.md)
- [Roadmap and Agent Notes](docs/ROADMAP.md)

## Deploy

### Local Firebase web config

Firebase Web `apiKey` is public browser config, but it must not be committed as a literal value. For local development:

```bash
cp .env.example .env.local
# Fill VITE_FIREBASE_API_KEY in .env.local
npm run dev
```

### Auto-deploy (recommended)

Pushes to `main` that touch `index.html`, `firebase.json`, or `.firebaserc` automatically deploy Hosting via GitHub Actions (`.github/workflows/deploy.yml`).

One-time setup — add repo secret `FIREBASE_SERVICE_ACCOUNT_DEARYOU_BFFFC` containing a Firebase service-account JSON key with the `Firebase Hosting Admin` role. Also add repo secret `FIREBASE_WEB_API_KEY` containing the restricted Firebase Web API key used at build time; `VITE_FIREBASE_API_KEY` is also accepted as a fallback secret name. See [docs/FIREBASE.md](docs/FIREBASE.md) for the exact steps.

### Manual deploy

Rules changes are still manual (not covered by the workflow):

前端 Hosting 需要先 build：

```bash
npm install
npm run build
```

```bash
firebase deploy --only hosting --project dearyou-bfffc
firebase deploy --only functions:searchBooks --project dearyou-bfffc
firebase deploy --only firestore:rules,storage --project dearyou-bfffc
```

Google Books fallback 需要先設定 secret：

```bash
firebase functions:secrets:set GOOGLE_BOOKS_API_KEY --project dearyou-bfffc
```

## Local Emulator Check

Vite dev server 會把 `/api` proxy 到 production Hosting，方便本機開發時使用書本搜尋：

```bash
npm run dev
curl "http://localhost:5173/api/searchBooks?q=Norwegian%20Wood"
```

這只能確認前端 fetch path 與 production function 可用；要驗證 Firebase Hosting rewrite 本身，使用 Firebase emulator：

```bash
npm run build
cd functions && npm install && cd ..
firebase emulators:start --only hosting,functions --project dearyou-bfffc
```

Hosting emulator 會顯示實際 port，例如 `http://127.0.0.1:5002`。用該 port 測：

```bash
curl "http://127.0.0.1:5002/api/searchBooks?q=Norwegian%20Wood"
```

預期回傳 JSON：

```js
{ "books": [...] }
```

若本機沒有 Secret Manager 權限或 `.secret.local`，Google Books key 可能取不到；function 仍應 fallback 到 Open Library。

## Current UX

- 生日解鎖：使用 Marlene 的生日
- Dedication page：`To Marlene`
- 四個章節：
  - Ch. I Letters
  - Ch. II Margins
  - Ch. III Chronicles
  - Ch. IV Works
- 每篇可加入文字、日期、標題、圖片、錄音、上傳音檔
- Ch. II Margins 可建立共同閱讀清單，透過 Open Library 搜尋書名與封面，並互相留下書邊心得
- 每篇右上角有來源 icon：
  - `ph:cloud-thin`：Cloud / Firestore
  - `ph:bookmark-simple-thin`：Local only
- 開發時可用本機或 `?birthdayPreview=1` 顯示生日彩蛋測試按鈕，手動預覽花瓣與生日訊息

## Recent UX and Loading Updates

- Rich text editing：Letters、Margins、Chronicles、Works 的 markdown 欄位使用 lazy-loaded rich text editor，避免初始載入時就下載完整編輯器。
- Image workflows：圖片可補 caption，裁切工具採 lazy load；Chronicles photo browser 支援照片排序。
- Startup loading：`app-booting` guard 會在初始狀態判定完成前隱藏主要畫面，降低已解鎖 reload、未解鎖 lock screen、生日模式之間的閃爍與空白轉場。
- Bundle optimization：Tiptap editor、CropperJS、SortableJS 拆成按需載入 chunk，讓 main JS 維持在 Vite warning threshold 以下。

## Important Agent Notes

- 不要用舊版 IndexedDB-only HTML 覆蓋 `index.html`，否則會移除 Firebase cloud sync。
- 不要直接部署 repo root；Hosting public 目錄是 `dist`，需先執行 `npm run build`。
- Vite dev server 的 `/api` 是 proxy，不是 Firebase Hosting rewrite；rewrite 需用 Firebase Hosting emulator 或部署後驗證。
- 修改資料模型時，同步更新 `firestore.rules`、`storage.rules`、[Firebase Architecture](docs/FIREBASE.md)。
- 修改素材、字體、icon、配色時，同步更新 [Assets and Licensing](docs/ASSETS.md)。
- 修改未來計畫或技術債時，同步更新 [Roadmap and Agent Notes](docs/ROADMAP.md)。
- Firebase API key 在前端是 public config，不是密碼；真正的保護在 Auth 與 Rules。
- 目前生日解鎖是前端門鎖，適合私人分享，不是高強度安全機制。
