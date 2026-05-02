# Assets and Licensing

文件最後更新：2026-05-02

本文件記錄《致 · 妳 — A Love Letter in Chapters》使用的圖片、字體、圖示、CDN、內嵌素材、配色與授權。

## Generated Images

封面背景與章節 banner 為 AI 生成專案素材，依照藕色玫瑰視覺語言延伸。封面背景輸出為 WebP，分桌機與手機裁切；章節素材輸出為無白邊寬幅 banner，約 3:1 比例、420px 高，供 CSS `background-size: cover` 裁切顯示。

| 用途 | 檔案 | 主題 |
| --- | --- | --- |
| 首頁封面背景 Desktop | `public/assets/backgrounds/cover-floral-desktop.webp` | 藕色玫瑰、奶油白花、柔焦情書封面背景 |
| 首頁封面背景 Mobile | `public/assets/backgrounds/cover-floral-mobile.webp` | 直式藕色玫瑰花束背景，中央保留文字留白 |
| 首頁封面背景 Desktop options | `public/assets/backgrounds/cover-floral-desktop-option-*.webp` | 可替換候選版本 |
| 首頁封面背景 Mobile options | `public/assets/backgrounds/cover-floral-mobile-option-*.webp` | 可替換候選版本 |
| Ch. I Letters banner | `public/assets/banners/letters-banner.png` | 寫給妳的信：玫瑰、信封、手寫信紙 |
| Ch. II Margins banner | `public/assets/banners/margins-banner.png` | 書頁邊的字：玫瑰、翻開的書、書頁邊緣 |
| Ch. III Chronicles banner | `public/assets/banners/chronicles-banner.png` | 我們的編年史：玫瑰、時鐘、回憶紙張 |
| Ch. IV Works banner | `public/assets/banners/voices-banner.png` | 孩子的作品：玫瑰、音樂盒、溫柔紀念感 |

生日彩蛋角色素材：

| 用途 | 檔案 | 說明 |
| --- | --- | --- |
| 生日彩蛋左下角 Happy Birthday 角色 | `public/assets/characters/birthday-bear-happy.png` | 使用使用者提供的去背玩偶圖，加上 Happy Birthday 對話框並清理為透明 PNG |
| 生日彩蛋右下角 Mommy Happy Birthday 畫作 | `public/assets/characters/mommy-birthday-drawing.png` | 使用使用者提供的手繪生日圖延伸為透明貼圖素材 |
| 生日彩蛋 Marlene 下方驚喜圖 | `public/assets/characters/marlene-birthday-surprise.png` | 點擊生日彩蛋後顯示在內容頁 Marlene 標題下方 |

## Fonts

字體透過 Google Fonts CDN 載入。

| 字體 | 用途 | 連結 |
| --- | --- | --- |
| Cormorant Garamond | 英文襯線主字體、副標題、按鈕、日期 | [Google Fonts](https://fonts.google.com/specimen/Cormorant+Garamond) |
| Pinyon Script | Marlene 名字、獻詞、章節引言 | [Google Fonts](https://fonts.google.com/specimen/Pinyon+Script) |
| Noto Serif TC | 繁體中文襯線字體 | [Google Fonts](https://fonts.google.com/noto/specimen/Noto+Serif+TC) |
| Cormorant | 備用 Cormorant 家族 | [Google Fonts](https://fonts.google.com/specimen/Cormorant) |

實際引用：

```html
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&family=Pinyon+Script&family=Noto+Serif+TC:wght@200;300;400;500;600&family=Cormorant:ital,wght@0,300;0,400;1,300&display=swap" rel="stylesheet">
```

## Icons

圖示由 Iconify runtime 載入，實際圖示為 Phosphor Icons Thin style。

| 資源 | 用途 | 授權 | 連結 |
| --- | --- | --- | --- |
| Iconify | 圖示載入引擎 | MIT | [iconify.design](https://iconify.design/) |
| Phosphor Icons Thin | 網站內所有細線 icon | MIT | [phosphoricons.com](https://phosphoricons.com/) |

實際使用 icon：

| Icon ID | 使用位置 |
| --- | --- |
| `ph:envelope-thin` | Ch. I Letters |
| `ph:book-open-thin` | Ch. II Margins |
| `ph:clock-countdown-thin` | Ch. III Chronicles |
| `ph:paint-brush-thin` | Ch. IV Works |
| `ph:squares-four-thin` | Ch. IV Works 全部分類 |
| `ph:trophy-thin` | Ch. IV Works 獎狀 / 獎盃分類 |
| `ph:presentation-chart-thin` | Ch. IV Works Show & Tell 分類 |
| `ph:feather-thin` | New Entry |
| `ph:camera-thin` | 新增圖片 |
| `ph:microphone-thin` | 開始錄音 |
| `ph:stop-circle-thin` | 停止錄音 |
| `ph:upload-simple-thin` | 上傳聲音 |
| `ph:magnifying-glass-thin` | Ch. II 書本候選清單搜尋 |
| `ph:heart-thin` | Ch. II 書本候選清單想讀數 |
| `ph:arrow-bend-down-left-thin` | Ch. II 書邊心得回覆 |
| `ph:pencil-simple-thin` | 編輯文章 |
| `ph:trash-thin` | 刪除文章 |
| `ph:arrow-right-thin` | Dedication page 翻頁按鈕 |
| `ph:cloud-thin` | Cloud / Firestore 文章來源標記 |
| `ph:bookmark-simple-thin` | Local only 文章來源標記 |

實際引用：

```html
<script async src="https://cdn.jsdelivr.net/npm/@iconify/iconify@3.1.1/dist/iconify.min.js"></script>
```

## External CDN and SDKs

| 服務 | 用途 |
| --- | --- |
| jsDelivr | Iconify runtime |
| Google Fonts | 字體 |
| Firebase JS SDK | Auth、Firestore、Storage、Analytics |
| Firebase Cloud Functions | 書本搜尋 proxy，避免 API key 出現在前端 |
| Google Books API | Ch. II 書本候選清單搜尋與封面 metadata |
| Open Library APIs | Ch. II 書名搜尋與封面候選 |

Firebase SDK 透過 npm 套件與 Vite 打包：

```text
firebase/app
firebase/auth
firebase/firestore
firebase/storage
firebase/analytics
```

## Embedded Assets

以下素材直接寫在 `index.html`：

- 紙張紋理：SVG `feTurbulence` data URL
- 配色系統：CSS custom properties
- 動畫：CSS keyframes 與 transition
- 文案：封面、Dedication、章節標語
- Firebase client config：Web app public config

## Color System

| 用途 | 變數 | 色值 |
| --- | --- | --- |
| 藕色最淺 | `--rose-lightest` | `#f5ecea` |
| 藕色淺 | `--rose-light` | `#e8d5d2` |
| 藕色主色 | `--rose` | `#c9a8a8` |
| 藕色深 | `--rose-deep` | `#a67f7f` |
| 藕紫 | `--mauve` | `#8a6a6b` |
| 紙色 | `--paper` | `#f8f1eb` |
| 暖紙色 | `--paper-warm` | `#f0e5db` |
| 奶紙色 | `--paper-cream` | `#faf5ee` |
| 墨色 | `--ink` | `#3d2c3a` |
| 柔墨色 | `--ink-soft` | `#5d4450` |
| 褪墨色 | `--ink-faded` | `#8a7580` |
| 燻金 | `--gold` | `#b08d57` |
| 柔燻金 | `--gold-soft` | `#c4a876` |
| 線色 | `--line` | `#d9c5bd` |
| 柔線色 | `--line-soft` | `#e8dcd4` |

動畫 easing：

```css
--ease-page: cubic-bezier(0.19, 1, 0.22, 1);
--ease-soft: cubic-bezier(0.22, 0.61, 0.36, 1);
```

## Licensing Summary

| 類別 | 來源 | 可商用 | 授權 |
| --- | --- | --- | --- |
| 圖片 | AI 生成 / 使用者提供素材 | 是 | 專案所有者 |
| 字體 | Google Fonts | 是 | SIL OFL 1.1 |
| 圖示 | Phosphor Icons | 是 | MIT |
| 圖示 runtime | Iconify | 是 | MIT |
| CSS / 動畫 / 文案 / 程式碼 | 專案原創 | 是 | 專案所有者 |

## Agent Notes

- 修改 icon 時保持 Phosphor Thin family，避免和現有細線風格不一致。
- 修改圖片來源時優先使用穩定 CDN URL，並同步更新本文件。
- 新增第三方素材時記錄來源、授權與使用位置。
