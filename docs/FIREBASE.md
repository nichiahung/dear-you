# Firebase Architecture

文件最後更新：2026-04-24

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
firestore.rules
storage.rules
```

## Firebase SDK

`index.html` 使用 browser ESM CDN，不需要 bundler。

```text
firebase-app.js
firebase-analytics.js
firebase-auth.js
firebase-firestore.js
firebase-storage.js
```

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
  createdAt: 1776820000000,
  updatedAt: 1776820000000,
  legacyLocalId: null
}
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
- 修改資料模型時同步更新 rules、前端 render/save 邏輯與本文件。
- 新增 media provider 時保留 `source` 欄位，避免混淆 Storage URL、external URL、local Blob。
- Firebase API key 是 public config，不是 secret；不要把它當作敏感密碼處理。
