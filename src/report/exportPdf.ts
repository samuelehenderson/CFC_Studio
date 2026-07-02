/**
 * .pdf export — same visual language as the Word template (petrol headings,
 * gray meta line, bulleted sections, two-column photo grid, footer with page
 * numbers), laid out directly with jsPDF on letter pages.
 */
import { jsPDF } from 'jspdf';
import {
  cleanBullets,
  exportFileStem,
  metaLine,
  REPORT_COLORS,
  SECTION_TITLES,
  type ReportData,
  type ReportPhoto,
} from './types';

const PAGE_W = 612; // letter, pt
const PAGE_H = 792;
const MARGIN = 54; // 0.75"
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = PAGE_H - 30;
const BOTTOM = FOOTER_Y - 18;

// Template sizes in points: brand 13, title 14, meta 8.5, heading 11.5, body 9.
const SZ = { brand: 13, title: 14, meta: 8.5, heading: 11.5, body: 9, caption: 8.5 };

const hex = (h: string): [number, number, number] => [
  parseInt(h.slice(0, 2), 16),
  parseInt(h.slice(2, 4), 16),
  parseInt(h.slice(4, 6), 16),
];
const ACCENT = hex(REPORT_COLORS.accent);
const META = hex(REPORT_COLORS.meta);
const CAPTION = hex(REPORT_COLORS.caption);

class Layout {
  doc = new jsPDF({ unit: 'pt', format: 'letter' });
  y = MARGIN;

  ensure(height: number) {
    if (this.y + height > BOTTOM) {
      this.doc.addPage();
      this.y = MARGIN;
    }
  }

  /** Wrapped text block; returns nothing, advances y. Breaks across pages. */
  text(
    str: string,
    size: number,
    opts: { bold?: boolean; italic?: boolean; color?: [number, number, number]; x?: number; width?: number; gapAfter?: number } = {},
  ) {
    const { bold, italic, color = [0, 0, 0], x = MARGIN, width = CONTENT_W, gapAfter = 0 } = opts;
    this.doc.setFont('helvetica', bold ? 'bold' : italic ? 'italic' : 'normal');
    this.doc.setFontSize(size);
    this.doc.setTextColor(...color);
    const lines: string[] = this.doc.splitTextToSize(str, width);
    const lineH = size * 1.3;
    for (const line of lines) {
      this.ensure(lineH);
      this.doc.text(line, x, this.y + size);
      this.y += lineH;
    }
    this.y += gapAfter;
  }

  heading(title: string) {
    this.ensure(SZ.heading * 2.6); // keep heading attached to first body line
    this.y += 10;
    this.text(title, SZ.heading, { bold: true, color: ACCENT, gapAfter: 3 });
  }

  bullets(items: string[]) {
    for (const item of cleanBullets(items)) {
      const lineH = SZ.body * 1.3;
      this.ensure(lineH);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(SZ.body);
      this.doc.setTextColor(0, 0, 0);
      this.doc.text('•', MARGIN + 4, this.y + SZ.body);
      this.text(item, SZ.body, { x: MARGIN + 16, width: CONTENT_W - 16, gapAfter: 2 });
    }
  }
}

function photoBlockHeight(p: ReportPhoto, boxW: number, doc: jsPDF): { imgW: number; imgH: number; total: number; capLines: string[] } {
  const maxH = 240;
  let imgW = boxW;
  let imgH = (p.height / p.width) * imgW;
  if (imgH > maxH) {
    imgH = maxH;
    imgW = (p.width / p.height) * imgH;
  }
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(SZ.caption);
  const capLines: string[] = p.caption ? doc.splitTextToSize(p.caption, boxW) : [];
  const capH = capLines.length * SZ.caption * 1.3;
  return { imgW, imgH, total: imgH + 6 + capH + 14, capLines };
}

export function exportReportPdf(r: ReportData): void {
  const L = new Layout();
  const doc = L.doc;

  // Brand banner.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(SZ.brand);
  doc.setTextColor(...ACCENT);
  doc.text(r.brand, MARGIN, L.y + SZ.brand);
  doc.text(r.docTitle, PAGE_W - MARGIN, L.y + SZ.brand, { align: 'right' });
  L.y += SZ.brand * 1.6;
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.75);
  doc.line(MARGIN, L.y, PAGE_W - MARGIN, L.y);
  L.y += 14;

  L.text(r.project || 'Project / Building', SZ.title, { bold: true, gapAfter: 2 });
  L.text(metaLine(r), SZ.meta, { color: META, gapAfter: 6 });

  if (r.summary.trim()) {
    L.heading(SECTION_TITLES.summary);
    for (const para of r.summary.split(/\n+/).map((s) => s.trim()).filter(Boolean)) {
      L.text(para, SZ.body, { gapAfter: 4 });
    }
  }
  const sections: [string, string[]][] = [
    [SECTION_TITLES.findings, r.findings],
    [SECTION_TITLES.working, r.working],
    [SECTION_TITLES.openItems, r.openItems],
  ];
  for (const [title, items] of sections) {
    if (cleanBullets(items).length) {
      L.heading(title);
      L.bullets(items);
    }
  }

  if (r.photos.length) {
    L.heading(SECTION_TITLES.photos);
    const gutter = 16;
    const boxW = (CONTENT_W - gutter) / 2;
    for (let i = 0; i < r.photos.length; i += 2) {
      const pair = [r.photos[i], r.photos[i + 1]].filter(Boolean) as ReportPhoto[];
      const metrics = pair.map((p) => photoBlockHeight(p, boxW, doc));
      const rowH = Math.max(...metrics.map((m) => m.total));
      L.ensure(rowH);
      pair.forEach((p, k) => {
        const m = metrics[k];
        const x0 = MARGIN + k * (boxW + gutter);
        const imgX = x0 + (boxW - m.imgW) / 2;
        doc.addImage(p.dataUrl, 'JPEG', imgX, L.y, m.imgW, m.imgH);
        let cy = L.y + m.imgH + 6 + SZ.caption;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(SZ.caption);
        doc.setTextColor(...CAPTION);
        for (const line of m.capLines) {
          doc.text(line, x0 + boxW / 2, cy, { align: 'center' });
          cy += SZ.caption * 1.3;
        }
      });
      L.y += rowH;
    }
  }

  // Footer on every page.
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(SZ.caption);
    doc.setTextColor(...META);
    doc.text(r.footer, MARGIN, FOOTER_Y);
    doc.text(`Page ${p} of ${pages}`, PAGE_W - MARGIN, FOOTER_Y, { align: 'right' });
  }

  doc.save(`${exportFileStem(r)}.pdf`);
}
