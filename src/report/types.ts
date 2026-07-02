/**
 * Daily field report — data model.
 *
 * Mirrors the Siemens "Field Report" Word template: header meta, four
 * narrative sections, and a photo grid with captions. Everything is plain
 * JSON so a draft can autosave to localStorage and round-trip to exports.
 */

export interface ReportPhoto {
  id: string;
  /** JPEG data URL (downscaled on import to keep drafts storable). */
  dataUrl: string;
  /** Natural pixel size of the stored image, used to scale exports. */
  width: number;
  height: number;
  caption: string;
}

export interface ReportData {
  /** Brand text in the top banner (template ships with SIEMENS). */
  brand: string;
  docTitle: string;
  project: string;
  jobNumber: string;
  siteAddress: string;
  tech: string;
  /** ISO date (yyyy-mm-dd) from the date input. */
  date: string;
  summary: string;
  findings: string[];
  working: string[];
  openItems: string[];
  photos: ReportPhoto[];
  /** Footer line, e.g. "Siemens Smart Infrastructure". */
  footer: string;
}

export const SECTION_TITLES = {
  summary: 'Summary',
  findings: 'Findings',
  working: 'Working Through It',
  openItems: 'Open Items',
  photos: 'Photos',
} as const;

/** Template accent colors, taken from the .docx source. */
export const REPORT_COLORS = {
  accent: '00646E', // Siemens petrol — brand + section headings
  meta: '666666', // job / address line
  caption: '555555', // photo captions
  placeholderFill: 'EDEDED',
} as const;

export function emptyReport(): ReportData {
  return {
    brand: 'SIEMENS',
    docTitle: 'Field Report',
    project: '',
    jobNumber: '',
    siteAddress: '',
    tech: '',
    date: new Date().toISOString().slice(0, 10),
    summary: '',
    findings: [''],
    working: [''],
    openItems: [''],
    photos: [],
    footer: 'Siemens Smart Infrastructure',
  };
}

/** "2026-07-02" → "July 2, 2026" (falls back to the raw string). */
export function formatReportDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (isNaN(dt.getTime())) return iso;
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** The gray " | "-separated meta line under the project title. */
export function metaLine(r: ReportData): string {
  return [
    r.jobNumber ? `Job ${r.jobNumber}` : '',
    r.siteAddress,
    r.tech,
    formatReportDate(r.date),
  ]
    .filter(Boolean)
    .join('   |   ');
}

/** Non-empty trimmed bullets for a section. */
export function cleanBullets(items: string[]): string[] {
  return items.map((s) => s.trim()).filter(Boolean);
}

/** Filename stem like "Field_Report_44OP1234567_2026-07-02". */
export function exportFileStem(r: ReportData): string {
  const bits = [r.docTitle || 'Field Report', r.jobNumber, r.date].filter(Boolean).join(' ');
  return bits.replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
