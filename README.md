# 致 · 妳 — A Love Letter in Chapters

為 Marlene 而存在的數位情書。

文件最後更新：2026-04-24

線上網站：[https://dearyou-bfffc.web.app](https://dearyou-bfffc.web.app)

## Project Snapshot

這是一個單頁 HTML 網站，部署在 Firebase Hosting，正式資料同步到 Firestore 與 Firebase Storage。

目前流程：

```text
輸入 Marlene 生日
-> Dedication page
-> turn the page
-> 進入四個章節
-> 文字 / 圖片 / 錄音同步到 cloud
```

目前核心：

- 單頁前端：`index.html`
- Hosting：Firebase Hosting
- Auth：Firebase Anonymous Auth
- 文字資料：Firestore `books/dear-you/entries/{entryId}`
- 圖片 / 錄音：Firebase Storage `books/dear-you/entries/{entryId}/...`
- 本機 fallback：IndexedDB `dearYouBookDB`

## Repository Guide

```text
index.html       -> 前端 UI、動畫、Firebase client、日記功能
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

## Quick Deploy

```bash
firebase deploy --only hosting --project dearyou-bfffc
firebase deploy --only firestore:rules,storage --project dearyou-bfffc
```

## Current UX

- 生日解鎖：`1985 / 05 / 06`
- Dedication page：`To Marlene`
- 四個章節：
  - Ch. I Letters
  - Ch. II Margins
  - Ch. III Chronicles
  - Ch. IV Voices
- 每篇可加入文字、日期、標題、圖片、錄音、上傳音檔
- 每篇右上角有來源 icon：
  - `ph:cloud-thin`：Cloud / Firestore
  - `ph:bookmark-simple-thin`：Local only
- 開發期間左下角會顯示生日彩蛋測試按鈕，可手動預覽花瓣與生日訊息

## Important Agent Notes

- 不要用舊版 IndexedDB-only HTML 覆蓋 `index.html`，否則會移除 Firebase cloud sync。
- 修改資料模型時，同步更新 `firestore.rules`、`storage.rules`、[Firebase Architecture](docs/FIREBASE.md)。
- 修改素材、字體、icon、配色時，同步更新 [Assets and Licensing](docs/ASSETS.md)。
- 修改未來計畫或技術債時，同步更新 [Roadmap and Agent Notes](docs/ROADMAP.md)。
- Firebase API key 在前端是 public config，不是密碼；真正的保護在 Auth 與 Rules。
- 目前生日解鎖是前端門鎖，適合私人分享，不是高強度安全機制。
