import { BASE_URL } from '../api/client';
import { studentsApi } from '../api/students';
import { cadetsApi } from '../api/cadets';

// Must match backend/models/CertificateTemplate.js's CERTIFICATE_FIELD_KEYS.
export const CERTIFICATE_FIELDS = [
  { key: 'studentName', label: 'Student Name' },
  { key: 'studentId', label: 'Student/Cadet ID' },
  { key: 'program', label: 'Program (CWTS/ROTC)' },
  { key: 'course', label: 'Program' },
  { key: 'yearLevel', label: 'Year Level' },
  { key: 'sectionOrCompany', label: 'Section / Company' },
  { key: 'campus', label: 'Campus' },
  { key: 'certificateType', label: 'Certificate Type' },
  { key: 'purpose', label: 'Purpose' },
  { key: 'dateIssued', label: 'Date Issued' },
];

const FILE_HOST = BASE_URL.replace(/\/api\/?$/, '');

export function resolveTemplateImageUrl(imageUrl) {
  if (!imageUrl) return '';
  return imageUrl.startsWith('http') ? imageUrl : `${FILE_HOST}${imageUrl}`;
}

/**
 * Builds the {fieldKey: displayValue} map for one certificate request —
 * shared by the live designer preview (sample values) and the real
 * generation step at approval time (actual trainee values).
 */
export function buildFieldValues({ request, profile }) {
  const isRotc = request.program === 'ROTC';
  return {
    studentName: request.studentId?.name || profile?.fullName || '—',
    studentId: request.studentId?.studentId || profile?.studentId || profile?.cadetId || '—',
    program: request.program,
    course: profile?.course || '—',
    yearLevel: profile?.yearLevel || '—',
    sectionOrCompany: (isRotc ? profile?.company : profile?.section) || profile?.section || '—',
    campus: profile?.campus || '—',
    certificateType: request.type || '—',
    purpose: request.purpose || '—',
    dateIssued: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
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
export async function renderCertificateToCanvas({ imageUrl, imageWidth, imageHeight, fields, values }) {
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
 * Looks up the requesting trainee's full profile (course, year level,
 * section/company, campus) — the certificate-request document itself only
 * carries name/studentId/email, not enough to fill a template. Falls back to
 * null (fields resolve to '—') if the lookup fails rather than blocking
 * approval on it.
 */
async function fetchTraineeProfile(request) {
  const id = request.studentId?._id || request.studentId;
  try {
    const res = request.program === 'ROTC' ? await cadetsApi.get(id) : await studentsApi.get(id);
    return res.data;
  } catch {
    return null;
  }
}

/**
 * End-to-end: fetches the trainee's full profile, resolves every field's
 * value, and composites it onto the template — the one call both the
 * approval-time file generation and its on-screen preview build on.
 */
export async function composeCertificateForRequest(request, template) {
  const profile = await fetchTraineeProfile(request);
  const values = buildFieldValues({ request, profile });
  const canvas = await renderCertificateToCanvas({
    imageUrl: template.imageUrl,
    imageWidth: template.imageWidth,
    imageHeight: template.imageHeight,
    fields: template.fields,
    values,
  });
  return canvas;
}
