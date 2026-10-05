import { BASE_URL } from '../api/client';

// Must match backend/models/AnnouncementTemplate.js's ANNOUNCEMENT_FIELD_KEYS.
export const ANNOUNCEMENT_FIELDS = [
  { key: 'title', label: 'Title' },
  { key: 'content', label: 'Message' },
  { key: 'date', label: 'Date' },
  { key: 'time', label: 'Time' },
  { key: 'location', label: 'Location' },
  { key: 'postedBy', label: 'Posted By' },
];

const FILE_HOST = BASE_URL.replace(/\/api\/?$/, '');

export function resolveTemplateImageUrl(imageUrl) {
  if (!imageUrl) return '';
  return imageUrl.startsWith('http') ? imageUrl : `${FILE_HOST}${imageUrl}`;
}

/**
 * Builds the {fieldKey: displayValue} map for one announcement — shared by
 * the live designer preview (sample values) and the real generation step at
 * post time (the announcement's actual field values).
 */
export function buildFieldValues(announcement, currentUserName) {
  return {
    title: announcement.title || '—',
    content: announcement.content || '—',
    date: announcement.date
      ? new Date(announcement.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : '—',
    time: announcement.time || '—',
    location: announcement.location || '—',
    postedBy: announcement.createdBy?.name || currentUserName || '—',
  };
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load the template image.'));
    img.src = url;
  });
}

/** Draws the template + each field's resolved value onto a canvas, natural-size. */
export async function renderAnnouncementToCanvas({ imageUrl, imageWidth, imageHeight, fields, values }) {
  const img = await loadImage(resolveTemplateImageUrl(imageUrl));
  const width = imageWidth || img.naturalWidth;
  const height = imageHeight || img.naturalHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  fields.forEach((f) => {
    const text = String(values[f.key] ?? '');
    if (!text) return;
    ctx.font = `${f.fontWeight === 'bold' ? 'bold ' : ''}${f.fontSize}px Arial, sans-serif`;
    ctx.fillStyle = f.color || '#000000';
    ctx.textAlign = f.align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, (f.x / 100) * width, (f.y / 100) * height);
  });

  return canvas;
}

export function canvasToPngFile(canvas, filename) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(new File([blob], filename, { type: 'image/png' })), 'image/png');
  });
}

/**
 * End-to-end: resolves every field's value for this announcement and
 * composites it onto the template — the one call both the post-time
 * generation and its on-screen preview build on.
 */
export async function composeAnnouncementImage(announcement, template, currentUserName) {
  const values = buildFieldValues(announcement, currentUserName);
  return renderAnnouncementToCanvas({
    imageUrl: template.imageUrl,
    imageWidth: template.imageWidth,
    imageHeight: template.imageHeight,
    fields: template.fields,
    values,
  });
}
