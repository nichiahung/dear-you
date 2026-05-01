import { DEFAULT_FEATURED_IMAGE_INDEX, DEFAULT_WORK_TYPE, WORK_TYPES } from '../core/constants.js';

export function normalizeWork(work) {
  const legacyType = work?.type === 'certificate' || work?.type === 'trophy' ? 'award' : work?.type;
  const type = WORK_TYPES[legacyType] ? legacyType : DEFAULT_WORK_TYPE;
  return {
    type,
    label: WORK_TYPES[type].label,
    featuredImageIndex: typeof work?.featuredImageIndex === 'number' ? work.featuredImageIndex : DEFAULT_FEATURED_IMAGE_INDEX
  };
}

export function workForEntry(entry) {
  return normalizeWork(entry?.work);
}

export function workFilterItems() {
  return [
    { type: 'all', label: '全部', icon: 'ph:squares-four-thin' },
    ...Object.entries(WORK_TYPES).map(([type, data]) => ({ type, ...data }))
  ];
}

export function renderWorkFilters(list, currentWorkFilter) {
  const wrap = document.getElementById('workFilters');
  if (!wrap) return;
  const counts = list.reduce((acc, entry) => {
    const type = workForEntry(entry).type;
    acc[type] = (acc[type] || 0) + 1;
    acc.all += 1;
    return acc;
  }, { all: 0, drawing: 0, award: 0 });

  wrap.innerHTML = workFilterItems().map(item => `
    <button class="work-filter-btn ${currentWorkFilter === item.type ? 'active' : ''}" onclick="setWorkFilter('${item.type}')">
      <span class="iconify" data-icon="${item.icon}"></span>
      <span class="work-filter-label">${item.label}</span>
      <span class="work-filter-count">${counts[item.type] || 0}</span>
    </button>
  `).join('');
}
