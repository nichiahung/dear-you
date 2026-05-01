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

### Auto-deploy (recommended)

Pushes to `main` that touch `index.html`, `firebase.json`, or `.firebaserc` automatically deploy Hosting via GitHub Actions (`.github/workflows/deploy.yml`).

One-time setup — add repo secret `FIREBASE_SERVICE_ACCOUNT_DEARYOU_BFFFC` containing a Firebase service-account JSON key with the `Firebase Hosting Admin` role. See [docs/FIREBASE.md](docs/FIREBASE.md) for the exact steps.

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

Vite dev server 不會套用 Firebase Hosting rewrite，所以 `http://localhost:5173/api/searchBooks` 會回 Vite HTML。要測正式 rewrite 行為，使用 Firebase emulator：

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

## Important Agent Notes

- 不要用舊版 IndexedDB-only HTML 覆蓋 `index.html`，否則會移除 Firebase cloud sync。
- 不要直接部署 repo root；Hosting public 目錄是 `dist`，需先執行 `npm run build`。
- 不要用 Vite dev server 判斷 Firebase rewrite；`/api/searchBooks` rewrite 需用 Firebase Hosting emulator 或部署後驗證。
- 修改資料模型時，同步更新 `firestore.rules`、`storage.rules`、[Firebase Architecture](docs/FIREBASE.md)。
- 修改素材、字體、icon、配色時，同步更新 [Assets and Licensing](docs/ASSETS.md)。
- 修改未來計畫或技術債時，同步更新 [Roadmap and Agent Notes](docs/ROADMAP.md)。
- Firebase API key 在前端是 public config，不是密碼；真正的保護在 Auth 與 Rules。
- 目前生日解鎖是前端門鎖，適合私人分享，不是高強度安全機制。
