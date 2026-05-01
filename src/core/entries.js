import { normalizeMargin } from '../features/margins.js';
import { normalizeWork } from '../features/works.js';

export function normalizeEntryForUI(entry) {
  if (!entry) return entry;
  if (entry.category === 'margins') {
    return {
      ...entry,
      margin: normalizeMargin(entry.margin, entry)
    };
  }
  if (entry.category !== 'voices') return entry;
  return {
    ...entry,
    work: normalizeWork(entry.work)
  };
}
