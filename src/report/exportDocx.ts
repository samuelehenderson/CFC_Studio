/**
 * .docx export — rebuilds the Siemens "Field Report" template with the
 * user's content: brand banner, title + gray meta line, petrol section
 * headings, bulleted sections, and a two-column photo grid with captions.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  ImageRun,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TabStopType,
  TextRun,
  WidthType,
} from 'docx';
import {
  cleanBullets,
  downloadBlob,
  exportFileStem,
  metaLine,
  REPORT_COLORS,
  SECTION_TITLES,
  type ReportData,
  type ReportPhoto,
} from './types';

// Template sizes are half-points: brand 26, title 28, meta 17, heading 23, body 18.
const SZ = { brand: 26, title: 28, meta: 17, heading: 23, body: 18, caption: 17 };
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } as const;
const NO_BORDERS = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
  insideHorizontal: NO_BORDER,
  insideVertical: NO_BORDER,
} as const;

// Usable width inside 1" margins on letter paper, in DXA (1/20 pt).
const CONTENT_DXA = 9360;
const PHOTO_CELL_DXA = CONTENT_DXA / 2;
// Photo box width in points (half the content width minus padding).
const PHOTO_MAX_PT = 220;

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function heading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 260, after: 90 },
    children: [
      new TextRun({ text, bold: true, color: REPORT_COLORS.accent, size: SZ.heading }),
    ],
  });
}

function bodyParagraphs(text: string): Paragraph[] {
  const lines = text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  return lines.map(
    (line) =>
      new Paragraph({
        spacing: { after: 90 },
        children: [new TextRun({ text: line, size: SZ.body })],
      }),
  );
}

function bulletParagraphs(items: string[]): Paragraph[] {
  return cleanBullets(items).map(
    (item) =>
      new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 60 },
        children: [new TextRun({ text: item, size: SZ.body })],
      }),
  );
}

function photoCell(photo: ReportPhoto | undefined): TableCell {
  const children: Paragraph[] = [];
  if (photo) {
    const scale = Math.min(1, PHOTO_MAX_PT / (photo.width * 0.75));
    const w = Math.round(photo.width * 0.75 * scale);
    const h = Math.round(photo.height * 0.75 * scale);
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 60 },
        children: [
          new ImageRun({
            type: 'jpg',
            data: dataUrlToBytes(photo.dataUrl),
            transformation: { width: w, height: h },
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: photo.caption || ' ',
            italics: true,
            color: REPORT_COLORS.caption,
            size: SZ.caption,
          }),
        ],
      }),
    );
  } else {
    children.push(new Paragraph({ text: '' }));
  }
  return new TableCell({
    width: { size: PHOTO_CELL_DXA, type: WidthType.DXA },
    borders: NO_BORDERS,
    children,
  });
}

function photoGrid(photos: ReportPhoto[]): Table {
  const rows: TableRow[] = [];
  for (let i = 0; i < photos.length; i += 2) {
    rows.push(new TableRow({ children: [photoCell(photos[i]), photoCell(photos[i + 1])] }));
  }
  return new Table({
    width: { size: CONTENT_DXA, type: WidthType.DXA },
    borders: NO_BORDERS,
    rows,
  });
}

export async function exportReportDocx(r: ReportData): Promise<void> {
  const children: (Paragraph | Table)[] = [];

  // Brand banner: brand left, doc title right (borderless 2-cell table).
  children.push(
    new Table({
      width: { size: CONTENT_DXA, type: WidthType.DXA },
      borders: NO_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: CONTENT_DXA / 2, type: WidthType.DXA },
              borders: NO_BORDERS,
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: r.brand,
                      bold: true,
                      color: REPORT_COLORS.accent,
                      size: SZ.brand,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: CONTENT_DXA / 2, type: WidthType.DXA },
              borders: NO_BORDERS,
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: r.docTitle,
                      bold: true,
                      color: REPORT_COLORS.accent,
                      size: SZ.brand,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  );

  // Project title + gray meta line.
  children.push(
    new Paragraph({
      spacing: { before: 220, after: 40 },
      children: [new TextRun({ text: r.project || 'Project / Building', bold: true, size: SZ.title })],
    }),
    new Paragraph({
      spacing: { after: 160 },
      children: [new TextRun({ text: metaLine(r), color: REPORT_COLORS.meta, size: SZ.meta })],
    }),
  );

  if (r.summary.trim()) {
    children.push(heading(SECTION_TITLES.summary), ...bodyParagraphs(r.summary));
  }
  const sections: [string, string[]][] = [
    [SECTION_TITLES.findings, r.findings],
    [SECTION_TITLES.working, r.working],
    [SECTION_TITLES.openItems, r.openItems],
  ];
  for (const [title, items] of sections) {
    const bullets = bulletParagraphs(items);
    if (bullets.length) children.push(heading(title), ...bullets);
  }
  if (r.photos.length) {
    children.push(heading(SECTION_TITLES.photos), photoGrid(r.photos));
  }

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: SZ.body } },
      },
    },
    sections: [
      {
        properties: {},
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_DXA }],
                children: [
                  new TextRun({ text: r.footer, color: REPORT_COLORS.meta, size: SZ.caption }),
                  new TextRun({ text: '\tPage ', color: REPORT_COLORS.meta, size: SZ.caption }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    color: REPORT_COLORS.meta,
                    size: SZ.caption,
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${exportFileStem(r)}.docx`);
}
