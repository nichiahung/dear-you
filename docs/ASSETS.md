# Assets and Licensing

文件最後更新：2026-04-24

本文件記錄《致 · 妳 — A Love Letter in Chapters》使用的圖片、字體、圖示、CDN、內嵌素材、配色與授權。

## Images

所有背景與章節扉頁圖片來自 [Pexels](https://www.pexels.com/)，採用 [Pexels License](https://www.pexels.com/license/)。

| 用途 | Pexels 頁面 | 直連 URL |
| --- | --- | --- |
| 封面背景與 Dedication 背景，柔焦藕色牡丹 | [photo/931177](https://www.pexels.com/photo/931177/) | `images.pexels.com/photos/931177/pexels-photo-931177.jpeg` |
| Ch. I Letters 扉頁，玫瑰盛開 | [photo/39517](https://www.pexels.com/photo/39517/) | `images.pexels.com/photos/39517/rose-flower-blossom-bloom-39517.jpeg` |
| Ch. II Margins 扉頁，花與書感 | [photo/756903](https://www.pexels.com/photo/756903/) | `images.pexels.com/photos/756903/pexels-photo-756903.jpeg` |
| Ch. III Chronicles 扉頁，花瓣時光感 | [photo/1022922](https://www.pexels.com/photo/1022922/) | `images.pexels.com/photos/1022922/pexels-photo-1022922.jpeg` |
| Ch. IV Voices 扉頁，柔和粉花 | [photo/1071882](https://www.pexels.com/photo/1071882/) | `images.pexels.com/photos/1071882/pexels-photo-1071882.jpeg` |

目前 URL 格式：

```text
https://images.pexels.com/photos/{ID}/...jpeg?auto=compress&cs=tinysrgb&w={width}
```

常用寬度：

```text
1600 -> 封面背景
1200 -> 章節扉頁
```

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
| `ph:microphone-stage-thin` | Ch. IV Voices |
| `ph:feather-thin` | New Entry |
| `ph:camera-thin` | 新增圖片 |
| `ph:microphone-thin` | 開始錄音 |
| `ph:stop-circle-thin` | 停止錄音 |
| `ph:upload-simple-thin` | 上傳聲音 |
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
| Pexels CDN | 圖片 |
| Firebase JS SDK | Auth、Firestore、Storage、Analytics |

Firebase SDK 以 browser ESM CDN 載入：

```text
https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js
https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js
https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js
https://www.gstatic.com/firebasejs/12.7.0/firebase-storage.js
https://www.gstatic.com/firebasejs/12.7.0/firebase-analytics.js
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
| 圖片 | Pexels | 是 | Pexels License |
| 字體 | Google Fonts | 是 | SIL OFL 1.1 |
| 圖示 | Phosphor Icons | 是 | MIT |
| 圖示 runtime | Iconify | 是 | MIT |
| CSS / 動畫 / 文案 / 程式碼 | 專案原創 | 是 | 專案所有者 |

## Agent Notes

- 修改 icon 時保持 Phosphor Thin family，避免和現有細線風格不一致。
- 修改圖片來源時優先使用穩定 CDN URL，並同步更新本文件。
- 新增第三方素材時記錄來源、授權與使用位置。
