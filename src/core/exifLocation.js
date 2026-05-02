let exifrModule = null;
async function getExifr() {
  if (!exifrModule) exifrModule = import('exifr');
  return exifrModule;
}

const geocodeCache = new Map();

async function reverseGeocode(latitude, longitude) {
  const key = `${Math.round(latitude * 10)},${Math.round(longitude * 10)}`;
  if (geocodeCache.has(key)) return geocodeCache.get(key);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 4500);
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&accept-language=en&lat=${latitude}&lon=${longitude}&zoom=10`,
      { signal: controller.signal }
    );
    if (!resp.ok) { geocodeCache.set(key, null); return null; }
    const data = await resp.json();
    const a = data.address || {};
    const name = a.city || a.town || a.village || a.county || a.state || null;
    geocodeCache.set(key, name);
    return name;
  } catch {
    geocodeCache.set(key, null);
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function extractLocationFromImage(file) {
  try {
    const exifr = await getExifr();
    const gps = await exifr.gps(file);
    if (!gps?.latitude || !gps?.longitude) return null;
    return reverseGeocode(gps.latitude, gps.longitude);
  } catch {
    return null;
  }
}
