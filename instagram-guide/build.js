// Builds the Hebrew (RTL) Instagram marketing guide as a Word document
// from the lightweight-markup chapter files in ./content.
//
// Markup:
//   PART: <title> | <subtitle>   part divider page
//   # / ## / ###                 headings (H1 starts a new page)
//   - item / "  - item"          bullets (two levels)
//   1. item                      numbered line (number kept as written)
//   [] item                      checklist item
//   > TYPE: text                 callout box; TYPE in TIP|WARN|SRC|EX|TASK|NOTE
//   > more text                  continues the previous callout
//   | a | b |                    table (first row is the header)
//   **bold**                     inline bold

const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow,
  TableCell, WidthType, ShadingType, BorderStyle, LevelFormat, PageBreak, Footer, Header,
  PageNumber, TableOfContents, TableLayoutType,
} = require('docx');

const FONT = { ascii: 'Arial', hAnsi: 'Arial', cs: 'Arial', eastAsia: 'Arial' };
const COLORS = {
  primary: '8E2C5A', accent: 'D9480F', dark: '222222', muted: '666666',
  headerFill: '8E2C5A', zebra: 'F7EEF2', border: 'C9A3B6',
};
const CALLOUTS = {
  TIP: { label: 'טיפ מקצועי', fill: 'EAF6EC', border: '2F9E44' },
  WARN: { label: 'שימו לב', fill: 'FFF4E6', border: 'E8590C' },
  SRC: { label: 'מקור ומהימנות', fill: 'EDF2FF', border: '4263EB' },
  EX: { label: 'דוגמה', fill: 'F8F0FC', border: '9C36B5' },
  TASK: { label: 'תרגיל', fill: 'FFF9DB', border: 'F08C00' },
  NOTE: { label: 'הערה', fill: 'F1F3F5', border: '868E96' },
};
const PAGE_W = 11906; // A4
const MARGIN = 1200;
const CONTENT_W = PAGE_W - 2 * MARGIN;

function runs(text, base = {}) {
  const out = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  for (const p of parts) {
    const bold = p.startsWith('**') && p.endsWith('**');
    const t = bold ? p.slice(2, -2) : p;
    out.push(new TextRun({
      text: t, font: FONT, rightToLeft: true,
      bold: bold || base.bold, boldComplexScript: bold || base.bold,
      color: base.color, size: base.size, sizeComplexScript: base.size,
    }));
  }
  return out;
}

function para(text, opts = {}) {
  return new Paragraph({
    bidirectional: true,
    alignment: opts.alignment || AlignmentType.BOTH,
    spacing: { after: opts.after ?? 120, line: 300 },
    indent: opts.indent,
    children: runs(text, opts.run || {}),
    ...(opts.extra || {}),
  });
}

function heading(text, level) {
  const map = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 };
  return new Paragraph({
    heading: map[level], bidirectional: true, alignment: AlignmentType.START,
    pageBreakBefore: level === 1,
    children: [new TextRun({ text, font: FONT, rightToLeft: true })],
  });
}

function partPage(title, subtitle) {
  return [
    new Paragraph({ children: [new PageBreak()] }),
    ...Array.from({ length: 8 }, () => new Paragraph({ children: [] })),
    new Paragraph({
      bidirectional: true, alignment: AlignmentType.CENTER, spacing: { after: 300 },
      children: [new TextRun({ text: title, font: FONT, rightToLeft: true, bold: true, boldComplexScript: true, size: 64, sizeComplexScript: 64, color: COLORS.primary })],
    }),
    new Paragraph({
      bidirectional: true, alignment: AlignmentType.CENTER,
      border: { top: { style: BorderStyle.SINGLE, size: 12, color: COLORS.accent, space: 12 } },
      children: [new TextRun({ text: subtitle || '', font: FONT, rightToLeft: true, size: 30, sizeComplexScript: 30, color: COLORS.muted })],
    }),
  ];
}

const cellBorders = (c) => ({
  top: { style: BorderStyle.SINGLE, size: 4, color: c },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: c },
  left: { style: BorderStyle.SINGLE, size: 4, color: c },
  right: { style: BorderStyle.SINGLE, size: 4, color: c },
});

function callout(type, lines) {
  const c = CALLOUTS[type] || CALLOUTS.NOTE;
  const children = [
    new Paragraph({
      bidirectional: true, alignment: AlignmentType.START, spacing: { after: 60 },
      children: [new TextRun({ text: c.label, font: FONT, rightToLeft: true, bold: true, boldComplexScript: true, color: c.border })],
    }),
    ...lines.map((l) => para(l.replace(/^- /, '• '), { after: 60, alignment: AlignmentType.START })),
  ];
  return [
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: [CONTENT_W],
      visuallyRightToLeft: true, layout: TableLayoutType.FIXED,
      rows: [new TableRow({
        cantSplit: true,
        children: [new TableCell({
          width: { size: CONTENT_W, type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: c.fill, color: 'auto' },
          margins: { top: 120, bottom: 120, left: 200, right: 200 },
          borders: {
            top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            left: { style: BorderStyle.SINGLE, size: 24, color: c.border },
          },
          children,
        })],
      })],
    }),
    new Paragraph({ spacing: { after: 120 }, children: [] }),
  ];
}

function table(rows) {
  const cells = rows.map((r) => r.replace(/^\||\|$/g, '').split('|').map((s) => s.trim()));
  const n = cells[0].length;
  // Weight columns by content length, with a floor so short columns stay readable.
  const lens = Array.from({ length: n }, (_, i) => Math.max(...cells.map((r) => (r[i] || '').length)));
  const weights = lens.map((l) => Math.max(14, Math.min(l, 45)));
  const total = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map((w) => Math.floor((w / total) * CONTENT_W));
  widths[0] += CONTENT_W - widths.reduce((a, b) => a + b, 0);
  const fontSize = n >= 5 ? 18 : 20;
  return [
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: widths,
      visuallyRightToLeft: true, layout: TableLayoutType.FIXED,
      rows: cells.map((r, ri) => new TableRow({
        tableHeader: ri === 0, cantSplit: true,
        children: Array.from({ length: n }, (_, ci) => new TableCell({
          width: { size: widths[ci], type: WidthType.DXA },
          borders: cellBorders(COLORS.border),
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          shading: ri === 0
            ? { type: ShadingType.CLEAR, fill: COLORS.headerFill, color: 'auto' }
            : ri % 2 === 0 ? { type: ShadingType.CLEAR, fill: COLORS.zebra, color: 'auto' } : undefined,
          children: [para(r[ci] || '', {
            after: 0, alignment: AlignmentType.START,
            run: ri === 0 ? { bold: true, color: 'FFFFFF', size: fontSize } : { size: fontSize },
          })],
        })),
      })),
    }),
    new Paragraph({ spacing: { after: 160 }, children: [] }),
  ];
}

function parse(src) {
  const out = [];
  const lines = src.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();
    if (!t) { i++; continue; }
    if (t.startsWith('PART:')) {
      const [title, sub] = t.slice(5).split('|').map((s) => s.trim());
      out.push(...partPage(title, sub)); i++; continue;
    }
    const h = t.match(/^(#{1,3}) (.*)$/);
    if (h) { out.push(heading(h[2], h[1].length)); i++; continue; }
    if (t.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const r = lines[i].trim();
        if (!/^\|[\s\-:|]+\|$/.test(r)) rows.push(r);
        i++;
      }
      out.push(...table(rows)); continue;
    }
    const co = t.match(/^> ([A-Z]+): (.*)$/);
    if (co) {
      const body = [co[2]]; i++;
      while (i < lines.length && /^> (?![A-Z]+: )/.test(lines[i].trim())) { body.push(lines[i].trim().slice(2)); i++; }
      out.push(...callout(co[1], body)); continue;
    }
    if (/^ {2,}- /.test(line)) {
      out.push(new Paragraph({ bidirectional: true, alignment: AlignmentType.START, numbering: { reference: 'bullets', level: 1 }, spacing: { after: 60, line: 280 }, children: runs(t.slice(2)) }));
      i++; continue;
    }
    if (t.startsWith('- ')) {
      out.push(new Paragraph({ bidirectional: true, alignment: AlignmentType.START, numbering: { reference: 'bullets', level: 0 }, spacing: { after: 80, line: 280 }, children: runs(t.slice(2)) }));
      i++; continue;
    }
    if (t.startsWith('[] ')) {
      out.push(para('☐  ' + t.slice(3), { after: 60, alignment: AlignmentType.START, indent: { left: 360 } }));
      i++; continue;
    }
    const num = t.match(/^(\d+)\. (.*)$/);
    if (num) {
      out.push(para(`${num[1]}.  ${num[2]}`, { after: 80, alignment: AlignmentType.START, indent: { left: 360 } }));
      i++; continue;
    }
    out.push(para(t)); i++;
  }
  return out;
}

function cover() {
  const big = (text, size, color, bold = true, after = 200) => new Paragraph({
    bidirectional: true, alignment: AlignmentType.CENTER, spacing: { after },
    children: [new TextRun({ text, font: FONT, rightToLeft: true, bold, boldComplexScript: bold, size, sizeComplexScript: size, color })],
  });
  return [
    ...Array.from({ length: 6 }, () => new Paragraph({ children: [] })),
    big('המדריך המלא לשיווק ולמכירות באינסטגרם', 60, COLORS.primary),
    big('מרמת מתחילים ועד רמת מומחה', 36, COLORS.accent, true, 600),
    big('תוכן אורגני • בניית קהל • מכירות ואוטומציות • שיווק ממומן ב-Meta Ads', 26, COLORS.dark, false),
    big('עם דגש על תחום התזונה ואורח החיים הבריא: מדריכים, קורסים דיגיטליים וייעוץ', 26, COLORS.dark, false, 1200),
    big('מותאם לשוק הישראלי', 24, COLORS.muted, false),
    big('מהדורה: אוקטובר 2026', 22, COLORS.muted, false),
  ];
}

function tocPage() {
  return [
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({
      bidirectional: true, alignment: AlignmentType.START, spacing: { after: 240 },
      children: [new TextRun({ text: 'תוכן העניינים', font: FONT, rightToLeft: true, bold: true, boldComplexScript: true, size: 40, sizeComplexScript: 40, color: COLORS.primary })],
    }),
    para('אם תוכן העניינים מופיע ריק, לחצו עליו קליק ימני ובחרו "עדכן שדה" (Update Field).', { run: { color: COLORS.muted, size: 18 } }),
    new TableOfContents('תוכן העניינים', { hyperlink: true, headingStyleRange: '1-1' }),
  ];
}

const contentDir = path.join(__dirname, 'content');
const files = fs.readdirSync(contentDir).filter((f) => f.endsWith('.md')).sort();
const body = files.flatMap((f) => parse(fs.readFileSync(path.join(contentDir, f), 'utf8')));

const headingStyle = (id, name, size, color, before, after) => ({
  id, name, basedOn: 'Normal', next: 'Normal', quickFormat: true,
  run: { font: FONT, size, sizeComplexScript: size, bold: true, boldComplexScript: true, color, rightToLeft: true },
  paragraph: { spacing: { before, after }, outlineLevel: Number(id.slice(-1)) - 1, keepNext: true },
});

const doc = new Document({
  creator: 'Instagram Marketing Guide',
  title: 'המדריך המלא לשיווק ולמכירות באינסטגרם',
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: FONT, size: 22, sizeComplexScript: 22, rightToLeft: true }, paragraph: { bidirectional: true } } },
    paragraphStyles: [
      headingStyle('Heading1', 'Heading 1', 40, COLORS.primary, 0, 300),
      headingStyle('Heading2', 'Heading 2', 30, COLORS.accent, 360, 160),
      headingStyle('Heading3', 'Heading 3', 25, COLORS.dark, 240, 120),
    ],
  },
  numbering: {
    config: [{
      reference: 'bullets',
      levels: [
        { level: 0, format: LevelFormat.BULLET, text: '●', alignment: AlignmentType.START, style: { paragraph: { indent: { left: 540, hanging: 300 } }, run: { color: COLORS.primary, size: 16 } } },
        { level: 1, format: LevelFormat.BULLET, text: '○', alignment: AlignmentType.START, style: { paragraph: { indent: { left: 1080, hanging: 300 } }, run: { color: COLORS.accent, size: 16 } } },
      ],
    }],
  },
  sections: [{
    properties: {
      page: { size: { width: PAGE_W, height: 16838 }, margin: { top: 1300, bottom: 1200, left: MARGIN, right: MARGIN } },
      titlePage: true,
    },
    headers: {
      default: new Header({ children: [new Paragraph({ bidirectional: true, alignment: AlignmentType.END, children: [new TextRun({ text: 'המדריך המלא לשיווק ולמכירות באינסטגרם', font: FONT, rightToLeft: true, size: 16, sizeComplexScript: 16, color: COLORS.muted })] })] }),
      first: new Header({ children: [new Paragraph({ children: [] })] }),
    },
    footers: {
      default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: COLORS.muted })] })] }),
      first: new Footer({ children: [new Paragraph({ children: [] })] }),
    },
    children: [...cover(), ...tocPage(), ...body],
  }],
});

const outPath = process.argv[2] || path.join(__dirname, 'Instagram_Marketing_Guide_HE.docx');
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(outPath, buf); console.log('wrote', outPath, files.length, 'chapters'); });
