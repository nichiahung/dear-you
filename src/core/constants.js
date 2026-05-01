export const MARLENE_BIRTHDAY = '1985-05-06';

export const WORK_TYPES = {
  drawing: { label: '畫圖作品', icon: 'ph:paint-brush-thin', cls: 'work-drawing' },
  award: { label: '獎狀 / 獎盃', icon: 'ph:trophy-thin', cls: 'work-award' }
};

export const DEFAULT_WORK_TYPE = 'drawing';
export const DEFAULT_FEATURED_IMAGE_INDEX = 1;

export const CATEGORY_LABELS = {
  letters: { zh: '寫給妳的信', en: 'Letters', chNum: 'Chapter I' },
  margins: { zh: '書頁邊的字', en: 'Margins', chNum: 'Chapter II' },
  chronicles: { zh: '我們的編年史', en: 'Chronicles', chNum: 'Chapter III' },
  voices: { zh: '孩子的作品', en: 'Works', chNum: 'Chapter IV' }
};

export const CATEGORY_PLACEHOLDERS = {
  letters: { title: 'dear you...', body: '親愛的，今天我想告訴妳...' },
  margins: { title: "from a book I'm reading...", body: '讀到這一頁，忽然想起妳...' },
  chronicles: { title: '2010', body: '這一年，我們...' },
  voices: { title: '孩子的作品...', body: '（可以記下這份作品的故事、孩子想說的話，或完成時的場景）' }
};

export const CHRONICLES_START_YEAR = 2010;
export const MARGIN_BOOKS_SETTING_KEY = 'marginsBookQueue';

export const MARGIN_AUTHORS = {
  me: { key: 'me', label: 'J', cls: 'from-me' },
  her: { key: 'her', label: 'Marlene', cls: 'from-her' }
};

export const MARGIN_BOOK_STATUSES = ['想讀', '正在讀', '下本一起讀'];
