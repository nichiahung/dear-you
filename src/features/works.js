import { DEFAULT_FEATURED_IMAGE_INDEX, DEFAULT_WORK_TYPE, DEFAULT_WORK_CHILD, WORK_CHILDREN, WORK_TYPES } from '../core/constants.js';

export function normalizeWork(work) {
  const legacyType = work?.type === 'certificate' || work?.type === 'trophy' ? 'award' : work?.type;
  const type = WORK_TYPES[legacyType] ? legacyType : DEFAULT_WORK_TYPE;
  const child = WORK_CHILDREN[work?.child] ? work.child : DEFAULT_WORK_CHILD;
  return {
    type,
    label: WORK_TYPES[type].label,
    child,
    childLabel: WORK_CHILDREN[child].label,
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

export function childFilterItems() {
  return [
    { child: 'all', label: '全部' },
    ...Object.entries(WORK_CHILDREN).map(([child, data]) => ({ child, ...data }))
  ];
}

export function renderWorkFilters(list, currentWorkFilter, currentChildFilter) {
  const wrap = document.getElementById('workFilters');
  if (!wrap) return;

  const typeCounts = list.reduce((acc, entry) => {
    const w = workForEntry(entry);
    acc[w.type] = (acc[w.type] || 0) + 1;
    acc.all += 1;
    return acc;
  }, { all: 0 });

  const childCounts = list.reduce((acc, entry) => {
    const w = workForEntry(entry);
    acc[w.child] = (acc[w.child] || 0) + 1;
    acc.all += 1;
    return acc;
  }, { all: 0 });

  wrap.innerHTML = `
    <div class="work-filter-row">
      ${workFilterItems().map(item => `
        <button class="work-filter-btn ${currentWorkFilter === item.type ? 'active' : ''}" onclick="setWorkFilter('${item.type}')">
          <span class="iconify" data-icon="${item.icon}"></span>
          <span class="work-filter-label">${item.label}</span>
          <span class="work-filter-count">${typeCounts[item.type] || 0}</span>
        </button>
      `).join('')}
    </div>
    <div class="work-filter-row work-child-filter-row">
      ${childFilterItems().map(item => `
        <button class="work-filter-btn work-child-filter-btn ${currentChildFilter === item.child ? 'active' : ''}" onclick="setChildFilter('${item.child}')">
          <span class="work-filter-label">${item.label}</span>
          <span class="work-filter-count">${childCounts[item.child] || 0}</span>
        </button>
      `).join('')}
    </div>
  `;
}
