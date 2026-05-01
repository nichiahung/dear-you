export function asDraftMedia(item) {
  if (item?.path && item?.url) return { ...item, cloud: true };
  if (item instanceof Blob) return { blob: item };
  return item;
}

export function mediaForLocalStore(item) {
  if (!item?.blob) return item;
  const { url, ...rest } = item;
  return rest;
}

export function mediaUrl(item) {
  const blob = item?.blob || item;
  return item?.url || (blob instanceof Blob ? URL.createObjectURL(blob) : '');
}

export function clampFocusValue(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function clampZoomValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.max(1, Math.min(1.6, Math.round(numeric * 100) / 100));
}

export async function inferImageFocus(blob) {
  if (!('FaceDetector' in window) || !window.createImageBitmap) return { focalX: 50, focalY: 38, zoom: 1 };
  let bitmap = null;
  try {
    bitmap = await createImageBitmap(blob);
    const detector = new FaceDetector({ fastMode: true, maxDetectedFaces: 8 });
    const faces = await detector.detect(bitmap);
    if (!faces.length) return { focalX: 50, focalY: 38, zoom: 1 };
    const bounds = faces.reduce((box, face) => {
      const rect = face.boundingBox;
      return {
        left: Math.min(box.left, rect.x),
        top: Math.min(box.top, rect.y),
        right: Math.max(box.right, rect.x + rect.width),
        bottom: Math.max(box.bottom, rect.y + rect.height)
      };
    }, { left: Infinity, top: Infinity, right: 0, bottom: 0 });
    return {
      focalX: clampFocusValue(((bounds.left + bounds.right) / 2 / bitmap.width) * 100),
      focalY: clampFocusValue(((bounds.top + bounds.bottom) / 2 / bitmap.height) * 100),
      zoom: 1
    };
  } catch (err) {
    return { focalX: 50, focalY: 38, zoom: 1 };
  } finally {
    bitmap?.close?.();
  }
}
