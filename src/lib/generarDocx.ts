import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  ImageRun,
  PageBreak,
  UnderlineType,
  VerticalAlign,
  ShadingType,
} from 'docx';
import { Informe } from '@/types/informe';
import { logoB64 } from '@/lib/logoB64';
import * as fs from 'fs';
import * as path from 'path';

// Helpers de fecha
function extractDate(dateString: string): string {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) {
      // If it contains a semicolon, take the first part
      return dateString.split(';')[0].trim();
    }
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  } catch {
    return dateString;
  }
}

function extractTime(dateString: string): string {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) {
      const parts = dateString.split(';');
      return parts.length > 1 ? parts[1].trim() : '';
    }
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${min}`;
  } catch {
    return '';
  }
}

interface ImageBufferInfo {
  buffer: Buffer;
  type: 'jpg' | 'png' | 'gif' | 'bmp';
}

// Helper to fetch/load image to buffer (supporting both http URLs and local base64 data URLs)
async function fetchImageBuffer(url: string): Promise<ImageBufferInfo | null> {
  try {
    if (url.startsWith('data:')) {
      const match = url.match(/^data:([^;]+);base64,(.*)$/);
      if (match) {
        const mimeType = match[1];
        let type: 'jpg' | 'png' | 'gif' | 'bmp' = 'jpg';
        if (mimeType.includes('png')) type = 'png';
        else if (mimeType.includes('gif')) type = 'gif';
        else if (mimeType.includes('bmp')) type = 'bmp';
        return {
          buffer: Buffer.from(match[2], 'base64'),
          type,
        };
      }
    }
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get('Content-Type') || '';
    let type: 'jpg' | 'png' | 'gif' | 'bmp' = 'jpg';
    if (contentType.includes('png')) type = 'png';
    else if (contentType.includes('gif')) type = 'gif';
    else if (contentType.includes('bmp')) type = 'bmp';
    else {
      // Fallback to extension check
      const ext = url.split('.').pop()?.toLowerCase();
      if (ext === 'png') type = 'png';
      else if (ext === 'gif') type = 'gif';
      else if (ext === 'bmp') type = 'bmp';
    }
    return {
      buffer: Buffer.from(await res.arrayBuffer()),
      type,
    };
  } catch (e) {
    console.error('Error fetching image:', url, e);
    return null;
  }
}

export async function generarDocx(informe: Informe): Promise<Buffer> {
  // ── Logo ─────────────────────────────────────────
  let logoRun: ImageRun | null = null;
  const logoBufferInfo = await fetchImageBuffer(logoB64);
  if (logoBufferInfo) {
    logoRun = new ImageRun({
      data: logoBufferInfo.buffer,
      transformation: { width: 160, height: 110 },
      type: logoBufferInfo.type,
    });
  }

  // ── Página 1 ──────────────────────────────────────

  // ── Encabezado (OT arriba a la derecha, Logo centrado) ────────────────
  // Row 1: empty left cell + OT right
  const otRow = new TableRow({
    children: [
      new TableCell({
        width: { size: 80, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE },
          bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
        },
        children: [new Paragraph({ children: [] })],
      }),
      new TableCell({
        width: { size: 20, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE },
          bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({
                text: `OT: ${informe.numeroOT || '____'}`,
                bold: true,
                size: 24,
                font: 'Calibri',
                color: '000000',
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [otRow],
  });

  // Logo centrado debajo de OT
  const logoParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: logoRun
      ? [logoRun]
      : [new TextRun({ text: 'VAULTEC SpA', bold: true, size: 32, font: 'Calibri', color: '0f766e' })],
  });

  // Título principal subrayado y centrado
  const tituloParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 300 },
    children: [
      new TextRun({
        text: 'INFORME TÉCNICO DE SERVICIO',
        bold: true,
        size: 44,           // 22pt = 44 half-points
        font: 'Cambria',
        color: '1F497D',
        underline: { type: UnderlineType.SINGLE },
      }),
    ],
  });

  // ── Tabla de datos ────────────────────────────────
  const COL_LBL1 = 2500; // Columna 1
  const COL_VAL2 = 2250; // Columna 2
  const COL_LBL2 = 2000; // Columna 3
  const COL_VAL_FIN = 2250; // Columna 4 (Total 9000)

  function splitRow(label1: string, val1: string, label2: string, val2: string): TableRow {
    return new TableRow({
      children: [
        mkCell(label1, COL_LBL1, true),
        mkCell(val1, COL_VAL2, false),
        mkCell(label2, COL_LBL2, true),
        mkCell(val2, COL_VAL_FIN, false),
      ],
    });
  }

  function mkCell(text: string, width: number, isLabel: boolean): TableCell {
    return new TableCell({
      width: { size: width, type: WidthType.DXA },
      shading: isLabel ? { type: ShadingType.CLEAR, fill: 'DEEAF1' } : undefined,
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
      borders: allBorders(),
      children: [new Paragraph({ children: [new TextRun({ text, bold: isLabel, size: 24, font: 'Calibri', color: '000000' })] })],
    });
  }

  function allBorders() {
    return {
      top: { style: BorderStyle.SINGLE, size: 12, color: '1F497D' },
      bottom: { style: BorderStyle.SINGLE, size: 12, color: '1F497D' },
      left: { style: BorderStyle.SINGLE, size: 12, color: '1F497D' },
      right: { style: BorderStyle.SINGLE, size: 12, color: '1F497D' },
    };
  }

  const dataTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      splitRow('Fecha', extractDate(informe.fechaInicio), '', ''),
      splitRow('Cliente', informe.destinatario || '', 'Solicitante', informe.solicitante || ''),
      splitRow('Dirección', informe.direccion || '', 'Comuna', informe.comuna || ''),
      splitRow('Ubicación', informe.ubicacion || '', 'N° ATM', informe.numeroATM || ''),
      splitRow('Modelo', informe.modeloMMBB || '', 'Técnico', informe.tecnicoSupervisor || ''),
      splitRow('Hora Inicio', extractTime(informe.fechaInicio), 'Hora Término', extractTime(informe.fechaFin)),
    ],
  });

  // Espacios y secciones de texto
  const espacioParagraph = new Paragraph({ spacing: { after: 200 }, children: [] });

  const makeSection = (titulo: string, contenido: string) => [
    new Paragraph({
      spacing: { before: 300, after: 100 },
      children: [new TextRun({ text: titulo, bold: true, size: 24, font: 'Calibri', underline: { type: UnderlineType.SINGLE } })],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: contenido || '', size: 24, font: 'Calibri' })],
    }),
  ];

  // ── Páginas de imágenes ───────────────────────────
  const imageChildren: (Paragraph | Table)[] = [];

  if (informe.imagenes && informe.imagenes.length > 0) {
    imageChildren.push(new Paragraph({ children: [new PageBreak()] }));
    imageChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
        children: [new TextRun({ text: 'REGISTRO FOTOGRÁFICO', bold: true, size: 24, font: 'Calibri', underline: { type: UnderlineType.SINGLE } })],
      })
    );

    const imageInfos = await Promise.all(informe.imagenes.map(fetchImageBuffer));
    const chunks: (ImageBufferInfo | null)[][] = [];
    for (let i = 0; i < imageInfos.length; i += 4) chunks.push(imageInfos.slice(i, i + 4));

    for (let ci = 0; ci < chunks.length; ci++) {
      const chunk = chunks[ci];
      if (ci > 0) {
        imageChildren.push(new Paragraph({ children: [new PageBreak()] }));
        imageChildren.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [new TextRun({ text: 'REGISTRO FOTOGRÁFICO (cont.)', bold: true, size: 24, font: 'Calibri', underline: { type: UnderlineType.SINGLE } })],
          })
        );
      }

      for (let row = 0; row < 2; row++) {
        const left = chunk[row * 2];
        const right = chunk[row * 2 + 1];

        // Only add rows if there is at least one image in it
        if (!left && !right) continue;

        const makeImgCell = (info: ImageBufferInfo | null, idx: number): TableCell =>
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            margins: { top: 80, bottom: 80, left: 80, right: 80 },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: info
              ? [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new ImageRun({ data: info.buffer, transformation: { width: 290, height: 220 }, type: info.type })],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: `Foto ${ci * 4 + row * 2 + idx + 1}`, size: 16, font: 'Calibri', italics: true, color: '555555' })],
                  }),
                ]
              : [new Paragraph({ children: [] })],
          });

        imageChildren.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [new TableRow({ children: [makeImgCell(left || null, 0), makeImgCell(right || null, 1)] })],
          })
        );
        imageChildren.push(new Paragraph({ spacing: { after: 180 }, children: [] }));
      }
    }
  }

  // ── Construir documento ───────────────────────────
  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 20, color: '000000' } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 900, right: 900 },
          },
        },
        children: [
          headerTable,
          logoParagraph,
          tituloParagraph,
          new Paragraph({ spacing: { after: 200 }, children: [] }), // Espacio antes de tabla
          dataTable,
          espacioParagraph,
          ...makeSection('Detalle del trabajo:', informe.detalle),
          ...makeSection('Resumen del trabajo:', informe.resumenTrabajo),
          ...imageChildren,
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
