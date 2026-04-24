# Roadmap and Agent Notes

文件最後更新：2026-04-24

本文件記錄後續功能、技術債，以及給 AI agent 的維護注意事項。

## Current UX

```text
輸入 Marlene 生日
-> Dedication page
-> turn the page
-> 進入四個章節
-> 文字 / 圖片 / 錄音同步到 cloud
```

目前章節：

- Ch. I Letters：寫給妳的信
- Ch. II Margins：書頁邊的字
- Ch. III Chronicles：我們的編年史
- Ch. IV Voices：孩子的聲音

## Current Features

- 生日解鎖
- Dedication page
- 四章切換
- 文章新增 / 編輯 / 刪除
- 日期、標題、正文
- 多張圖片
- 錄音
- 上傳音檔
- Firestore + Storage cloud sync
- IndexedDB local fallback
- cloud/local source icon
- `synced to cloud` 狀態顯示
- 較短、較自然的 CSS stagger animation
- `prefers-reduced-motion`
- 生日彩蛋開發版：生日當天自動啟用，開發期間左下角保留測試按鈕

## Short Term

- [ ] 刪除測試資料，換成正式內容
- [ ] 圖片上傳前壓縮，建議 1600px max width / JPEG quality 0.82
- [ ] 生日彩蛋上線前整理：確認是否保留測試按鈕、花瓣效能、正式文案
- [ ] 隨機信件按鈕：「今天抽一封」
- [ ] 年度回顧統計頁
- [ ] 行動版細節檢查：entry action 對齊、modal 高度、圖片格線
- [ ] 針對圖片 / 錄音上傳加入更明確的 syncing 狀態

## Medium Term

- [ ] 作者模式 / 閱讀模式分離
- [ ] Email/Password Auth，只允許指定帳號寫入
- [ ] 自訂網域
- [ ] PWA，可加入手機主畫面
- [ ] 支援外部圖片 URL
  - 可貼 Google Drive 或其他穩定公開圖片直連
  - Firestore 存 `source: "external"` 與 `url`
  - Google Photos 分享連結 / API `baseUrl` 不一定適合長期顯示
  - 實作前再討論儲存與權限策略
- [ ] 備份 / 匯出 JSON

## Long Term

- [ ] 跨章節搜尋
- [ ] Chronicles 時間軸視覺化
- [ ] 匯出 PDF / 電子書
- [ ] 心情標籤 / 花瓣顏色
- [ ] 開場錄音
- [ ] 歡迎語依早晚變化
- [ ] 實體書輸出版面

## Technical Debt

- `index.html` 已經很大，後續若功能繼續增加，可考慮拆成 Vite app。
- Firebase client 與 fallback 邏輯目前都在單檔中，改動時要避免初始化順序問題。
- `type="module"` Firebase script 與一般 script 之間靠 `dearYouCloudReady` event 銜接，不能移除。
- `initCloudStore()` 會先啟用 cloud，再背景執行 local migration；migration 失敗不應阻止 cloud read。
- Firestore shared path 是 `books/dear-you`，不要回到 `users/{uid}` 作為主要資料源。
- 圖片與錄音目前靠 Storage URL 顯示；如果新增 external URL，要保持 render path 相容。

## Motion Guidelines

- 優先調整 easing / delay，不要增加很長的 stagger。
- 封面和 Dedication 的完整出現應維持在約 1.2 秒左右。
- Entry / modal 進場位移要小，避免跳動感。
- 保留 `prefers-reduced-motion`。

## Visual Guidelines

- 圖示維持 Phosphor Thin family。
- 主要色系維持藕色、紙色、燻金、深棕紫。
- 不要加入太重的現代 dashboard 感元件。
- cloud/local icon 應像書頁邊註，不像工程狀態 badge。

## Agent Guardrails

- 不要用舊版 IndexedDB-only HTML 覆蓋 `index.html`。
- 不要移除 Firebase Anonymous Auth，除非同步更新 rules 與登入流程。
- 不要把大型圖片 / 錄音塞進 Firestore 文件。
- 不要把 Google Photos `baseUrl` 當永久 URL 存起來。
- 不要把實際生日解鎖值寫進公開文件或公開測試提示。
- 改資料模型時同步更新：
  - `index.html`
  - `firestore.rules`
  - `storage.rules`
  - `docs/FIREBASE.md`
- 改素材或 icon 時同步更新 `docs/ASSETS.md`。
