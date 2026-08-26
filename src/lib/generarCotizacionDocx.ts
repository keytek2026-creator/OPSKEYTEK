import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType,
  VerticalAlign,
  ImageRun,
  Header,
  Footer,
  HorizontalPositionRelativeFrom,
  HorizontalPositionAlign,
  VerticalPositionRelativeFrom,
  VerticalPositionAlign,
  TextWrappingType,
  Packer,
} from 'docx';
import * as path from 'path';
import * as fs from 'fs';
import { logoB64 } from './logoB64';

interface LineItem {
  id: string;
  descripcion: string;
  cantidad: number;
  valorUnit: number;
}

interface Cotizacion {
  id: string;
  numero: string;
  fecha: string;
  cliente: string;
  rut: string;
  atencion: string;
  emailContacto: string;
  descripcionServicio: string;
  direccion: string;
  items: LineItem[];
  validacion?: string;
  nota: string;
  estado: string;
}

// ── Paleta exacta del diseño ─────────────────────────────────────────────────
const NAVY        = '1B2A4F';  // ola principal
const SLATE       = '5F6E8F';  // header tabla y banda total
const CLIENT_BLUE = '2E75B6';  // datos cliente
const TITLE_GRAY  = '3F3F3F';  // título y fecha
const ROW_GRAY    = 'DCE0E9';  // filas relleno

function fmtM(n: number): string {
  return '$' + new Intl.NumberFormat('es-CL').format(n);
}

function formatLongDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split(/[-/]/);
  if (parts.length === 3) {
    const day   = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year  = parseInt(parts[2], 10);
    const months = [
      'Enero','Febrero','Marzo','Abril','Mayo','Junio',
      'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
    ];
    if (!isNaN(day) && month >= 0 && month < 12 && !isNaN(year)) {
      return `${String(day).padStart(2,'0')} de ${months[month]} ${year}`;
    }
  }
  return dateStr;
}

// ── Bordes vacíos helper ─────────────────────────────────────────────────────
const NO_BORDERS = {
  top:             { style: BorderStyle.NONE },
  bottom:          { style: BorderStyle.NONE },
  left:            { style: BorderStyle.NONE },
  right:           { style: BorderStyle.NONE },
  insideHorizontal:{ style: BorderStyle.NONE },
  insideVertical:  { style: BorderStyle.NONE },
};

// ── Cell helpers ─────────────────────────────────────────────────────────────
function dataCell(
  children: Paragraph[],
  opts: {
    width?: number;
    align?: string;
    bg?: string;
    bold?: boolean;
    color?: string;
    size?: number;
  } = {}
): TableCell {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.bg ? { type: ShadingType.CLEAR, fill: opts.bg } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    borders: {
      top:    { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left:   { style: BorderStyle.NONE },
      right:  { style: BorderStyle.NONE },
    },
    children,
  });
}

function headerCell(text: string, align: string, width: number): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, fill: SLATE },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    borders: {
      top:    { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left:   { style: BorderStyle.NONE },
      right:  { style: BorderStyle.NONE },
    },
    children: [new Paragraph({
      alignment: align as typeof AlignmentType[keyof typeof AlignmentType],
      children: [new TextRun({
        text, bold: true, color: 'FFFFFF', size: 20, font: 'Calibri',
      })],
    })],
  });
}

function totalRowCell(text: string, align: string, bg?: string, isTotal?: boolean): TableCell {
  return new TableCell({
    shading: bg ? { type: ShadingType.CLEAR, fill: bg } : undefined,
    margins: { top: isTotal ? 120 : 80, bottom: isTotal ? 120 : 80, left: 140, right: 140 },
    borders: {
      top:    bg ? { style: BorderStyle.NONE } : { style: BorderStyle.SINGLE, size: 4, color: ROW_GRAY },
      bottom: bg ? { style: BorderStyle.NONE } : { style: BorderStyle.SINGLE, size: 4, color: ROW_GRAY },
      left:   { style: BorderStyle.NONE },
      right:  { style: BorderStyle.NONE },
    },
    children: [new Paragraph({
      alignment: align as typeof AlignmentType[keyof typeof AlignmentType],
      children: [new TextRun({
        text,
        bold: true,
        color: bg ? 'FFFFFF' : TITLE_GRAY,
        size: isTotal ? 24 : 20,
        font: 'Calibri',
      })],
    })],
  });
}

// ── Generador principal ───────────────────────────────────────────────────────
export async function generarCotizacionDocx(cot: Cotizacion): Promise<Buffer> {
  const neto  = cot.items.reduce((s, i) => s + i.cantidad * i.valorUnit, 0);
  const iva   = Math.round(neto * 0.19);
  const bruto = neto + iva;
  const diasVal = cot.validacion?.replace(/[^\d]/g, '') || '5';

  // ── Cargar imágenes de ondas ────────────────────────────────────────────────
  const publicPath = path.join(process.cwd(), 'public');
  let topWaveBuffer: Buffer | null = null;
  let bottomWaveBuffer: Buffer | null = null;
  try {
    topWaveBuffer    = fs.readFileSync(path.join(publicPath, 'top_wave.png'));
    bottomWaveBuffer = fs.readFileSync(path.join(publicPath, 'bottom_wave.png'));
  } catch (e) {
    console.warn('No se pudieron cargar las ondas:', e);
  }

  // ── Cargar logo ─────────────────────────────────────────────────────────────
  let logoBuffer: Buffer | null = null;
  try {
    const cotiPath = path.join(publicPath, 'coti.png');
    if (fs.existsSync(cotiPath)) {
      logoBuffer = fs.readFileSync(cotiPath);
    } else {
      const clean = logoB64.replace(/^data:image\/\w+;base64,/, '');
      logoBuffer = Buffer.from(clean, 'base64');
    }
  } catch { /* sin logo */ }

  // ── HEADER del documento: ola superior ─────────────────────────────────────
  //    A4 en twips: 11906 de ancho. Margen 720 twips = 1.27cm cada lado
  //    La imagen ocupa el ancho completo de la página (11906 twips ≈ 210mm)
  //    En pixeles a 96dpi: A4 = 794px ancho
  // top_wave.png es 794x287px (75.7mm de alto en A4 a 96dpi)
  // Lo mostramos a 794x287 para que ocupe exactamente su zona natural
  const TOP_WAVE_H_PX = 200; // px de display — ~53mm en Word
  const BOT_WAVE_H_PX = 230; // px de display — ~61mm en Word

  const pageHeader = new Header({
    children: topWaveBuffer ? [
      new Paragraph({
        children: [
          new ImageRun({
            data: topWaveBuffer,
            type: 'png',
            transformation: { width: 794, height: TOP_WAVE_H_PX },
            floating: {
              horizontalPosition: {
                relative: HorizontalPositionRelativeFrom.PAGE,
                align: HorizontalPositionAlign.LEFT,
              },
              verticalPosition: {
                relative: VerticalPositionRelativeFrom.PAGE,
                align: VerticalPositionAlign.TOP,
              },
              wrap: { type: TextWrappingType.NONE },
              margins: { top: 0, bottom: 0, left: 0, right: 0 },
            },
          }),
        ],
      }),
    ] : [],
  });

  // ── FOOTER del documento: ola inferior + email ──────────────────────────────
  const pageFooter = new Footer({
    children: [
      ...(bottomWaveBuffer ? [
        new Paragraph({
          children: [
            new ImageRun({
              data: bottomWaveBuffer,
              type: 'png',
              transformation: { width: 794, height: BOT_WAVE_H_PX },
              floating: {
                horizontalPosition: {
                  relative: HorizontalPositionRelativeFrom.PAGE,
                  align: HorizontalPositionAlign.LEFT,
                },
                verticalPosition: {
                  relative: VerticalPositionRelativeFrom.PAGE,
                  align: VerticalPositionAlign.BOTTOM,
                },
                wrap: { type: TextWrappingType.NONE },
                margins: { top: 0, bottom: 0, left: 0, right: 0 },
              },
            }),
          ],
        }),
      ] : []),
      // Email centrado — aparece sobre la ola oscura
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80 },
        children: [
          new TextRun({
            text: 'Contacto@vaultec.cl',
            size: 20,
            color: 'FFFFFF',
            font: 'Calibri',
          }),
        ],
      }),
    ],
  });

  // ── TABLA HEADER: Logo ← | → Título + Fecha ────────────────────────────────
  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_BORDERS,
    rows: [
      new TableRow({
        children: [
          // Celda logo — el spacing before empuja el logo por debajo de la ola
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            borders: NO_BORDERS,
            verticalAlign: VerticalAlign.BOTTOM,
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                spacing: { before: 0 },
                children: logoBuffer ? [
                  new ImageRun({
                    data: logoBuffer,
                    type: 'png',
                    transformation: { width: 85, height: 85 },
                  }),
                ] : [
                  new TextRun({ text: 'VAULTEC', bold: true, size: 32, color: NAVY, font: 'Calibri' }),
                ],
              }),
            ],
          }),
          // Celda título
          new TableCell({
            width: { size: 55, type: WidthType.PERCENTAGE },
            borders: NO_BORDERS,
            verticalAlign: VerticalAlign.BOTTOM,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `COTIZACIÓN #${cot.numero || '___'}`,
                    bold: true,
                    size: 40,
                    color: TITLE_GRAY,
                    font: 'Calibri',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 60 },
                children: [
                  new TextRun({
                    text: formatLongDate(cot.fecha),
                    size: 22,
                    color: TITLE_GRAY,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // ── BLOQUE CLIENTE ──────────────────────────────────────────────────────────
  const clienteParagraphs: Paragraph[] = [
    new Paragraph({
      spacing: { before: 300, after: 80 },
      children: [
        new TextRun({ text: 'CLIENTE', bold: true, size: 18, color: TITLE_GRAY, font: 'Calibri' }),
      ],
    }),
  ];

  if (cot.atencion) {
    clienteParagraphs.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({ text: 'Nombre: ', bold: true, size: 20, color: CLIENT_BLUE, font: 'Calibri' }),
          new TextRun({ text: cot.atencion, size: 20, color: CLIENT_BLUE, font: 'Calibri' }),
        ],
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [
          new TextRun({ text: 'Empresa: ', bold: true, size: 20, color: CLIENT_BLUE, font: 'Calibri' }),
          new TextRun({ text: cot.cliente, size: 20, color: CLIENT_BLUE, font: 'Calibri' }),
        ],
      }),
    );
  } else {
    clienteParagraphs.push(
      new Paragraph({
        spacing: { after: 200 },
        children: [
          new TextRun({ text: cot.cliente, size: 20, color: CLIENT_BLUE, font: 'Calibri' }),
        ],
      }),
    );
  }

  // ── TABLA DE ÍTEMS ──────────────────────────────────────────────────────────
  const TOTAL_ROWS = 6;
  const fillerCount = Math.max(0, TOTAL_ROWS - cot.items.length);

  const tableRows: TableRow[] = [
    // Encabezado
    new TableRow({
      tableHeader: true,
      children: [
        headerCell('Descripción', AlignmentType.LEFT,   45),
        headerCell('Cantidad',    AlignmentType.CENTER, 18),
        headerCell('Precio',      AlignmentType.RIGHT,  18),
        headerCell('Total',       AlignmentType.RIGHT,  19),
      ],
    }),
    // Filas de datos
    ...cot.items.map((item) =>
      new TableRow({
        children: [
          dataCell([new Paragraph({ children: [new TextRun({ text: item.descripcion || '', size: 20, font: 'Calibri', color: '5A5A5A' })] })], { width: 45 }),
          dataCell([new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(item.cantidad), size: 20, font: 'Calibri', color: '5A5A5A' })] })], { width: 18 }),
          dataCell([new Paragraph({ alignment: AlignmentType.RIGHT,  children: [new TextRun({ text: fmtM(item.valorUnit), size: 20, font: 'Calibri', color: '5A5A5A' })] })], { width: 18 }),
          dataCell([new Paragraph({ alignment: AlignmentType.RIGHT,  children: [new TextRun({ text: fmtM(item.cantidad * item.valorUnit), size: 20, font: 'Calibri', color: '5A5A5A' })] })], { width: 19 }),
        ],
      })
    ),
    // Filas de relleno — alternas gris/blanco hasta 6 filas total
    ...Array.from({ length: fillerCount }).map((_, i) =>
      new TableRow({
        children: [
          dataCell([new Paragraph({ children: [new TextRun({ text: ' ' })] })], { width: 45, bg: i % 2 === 0 ? ROW_GRAY : undefined }),
          dataCell([new Paragraph({ children: [new TextRun({ text: ' ' })] })], { bg: i % 2 === 0 ? ROW_GRAY : undefined }),
          dataCell([new Paragraph({ children: [new TextRun({ text: ' ' })] })], { bg: i % 2 === 0 ? ROW_GRAY : undefined }),
          dataCell([new Paragraph({ children: [new TextRun({ text: ' ' })] })], { width: 19, bg: i % 2 === 0 ? ROW_GRAY : undefined }),
        ],
      })
    ),
  ];

  const itemsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_BORDERS,
    rows: tableRows,
  });

  // ── TABLA DE TOTALES ────────────────────────────────────────────────────────
  // Alineada a la derecha, ocupa el 48% derecho
  const totalsTable = new Table({
    width: { size: 48, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.RIGHT,
    borders: NO_BORDERS,
    rows: [
      // SUBTOTAL
      new TableRow({
        children: [
          totalRowCell('SUBTOTAL',  AlignmentType.LEFT,  undefined, false),
          totalRowCell(fmtM(neto),  AlignmentType.RIGHT, undefined, false),
        ],
      }),
      // IVA
      new TableRow({
        children: [
          totalRowCell('IVA (19%)', AlignmentType.LEFT,  undefined, false),
          totalRowCell(fmtM(iva),   AlignmentType.RIGHT, undefined, false),
        ],
      }),
      // TOTAL — fondo slate navy
      new TableRow({
        children: [
          totalRowCell('TOTAL:',    AlignmentType.LEFT,  SLATE, true),
          totalRowCell(fmtM(bruto), AlignmentType.RIGHT, SLATE, true),
        ],
      }),
    ],
  });

  // ── DIRECCIÓN Y NOTA ────────────────────────────────────────────────────────
  const extraParagraphs: Paragraph[] = [];
  if (cot.direccion) {
    extraParagraphs.push(
      new Paragraph({
        spacing: { before: 240, after: 60 },
        children: [
          new TextRun({ text: 'Dirección: ', bold: true, size: 20, color: NAVY, font: 'Calibri' }),
          new TextRun({ text: cot.direccion, size: 20, color: '5A5A5A', font: 'Calibri' }),
        ],
      })
    );
  }

  const notaParagraph = new Paragraph({
    spacing: { before: cot.direccion ? 60 : 280, after: 120 },
    children: [
      new TextRun({ text: 'Nota: ', bold: true, size: 20, color: NAVY, font: 'Calibri' }),
      new TextRun({ text: cot.nota || `La cotización es válida por ${diasVal} días.`, size: 20, color: '5A5A5A', font: 'Calibri' }),
    ],
  });

  // ── DOCUMENTO FINAL ─────────────────────────────────────────────────────────
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4 en twips
            margin: {
              // TOP_WAVE_H_PX=200px → 200/96*25.4mm=52.9mm → 52.9*56.7=2999 twips
              // Añadimos 400 extra para que el logo quede claramente bajo la ola
              top:    3400, // ~60mm — logo queda bajo la ola superior
              // BOT_WAVE_H_PX=230px → 230/96*25.4mm=60.8mm → 3447 twips
              bottom: 3600, // ~63mm — ola inferior visible completa
              left:   1260, // ~2.2cm
              right:  1260,
              header: 0,    // header desde el borde superior de la página
              footer: 0,    // footer desde el borde inferior de la página
            },
          },
        },
        headers:  { default: pageHeader },
        footers:  { default: pageFooter },
        children: [
          headerTable,
          new Paragraph({ spacing: { after: 200 } }), // espacio entre header y cliente
          ...clienteParagraphs,
          itemsTable,
          new Paragraph({ spacing: { after: 160 } }),
          totalsTable,
          ...extraParagraphs,
          notaParagraph,
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
