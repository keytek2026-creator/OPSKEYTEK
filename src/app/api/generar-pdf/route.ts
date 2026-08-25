import { NextRequest } from 'next/server';
import * as path from 'path';
import * as fs from 'fs';
import { supabaseInforme } from '@/lib/supabaseInforme';

export const runtime = 'nodejs';

// ── Helper: extract base64 data from data URL or raw base64 string ─────────────
function extractBase64(url: string): { data: string; mime: string } | null {
  try {
    if (url.startsWith('data:')) {
      const match = url.match(/^data:([^;]+);base64,(.*)$/);
      if (match) return { mime: match[1], data: match[2] };
    }
    // plain base64 (no prefix)
    if (url.length > 100 && !url.startsWith('http')) {
      return { mime: 'image/jpeg', data: url };
    }
    return null;
  } catch {
    return null;
  }
}

function extractDate(dateString: string): string {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) {
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

// ── Route ─────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const informe = body.informe;

    if (!informe) {
      return new Response(JSON.stringify({ error: 'Falta el objeto informe' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (body.reportId) {
      const { data, error } = await supabaseInforme
        .from('informes')
        .select('data')
        .eq('id', body.reportId)
        .single();
      
      if (data && data.data && data.data.images) {
        informe.imagenes = data.data.images;
      }
    }

    // ── Logo ────────────────────────────────────────────────────────────────
    let logoDataUrl: string | null = null;

    if (informe.logoBase64 && informe.logoBase64.length > 100) {
      logoDataUrl = `data:image/png;base64,${informe.logoBase64}`;
    } else {
      const logoPath = fs.existsSync(path.join(process.cwd(), 'public', 'logo_sinfondo.png'))
        ? path.join(process.cwd(), 'public', 'logo_sinfondo.png')
        : path.join(process.cwd(), 'public', 'logo.png');
      if (fs.existsSync(logoPath)) {
        const buf = fs.readFileSync(logoPath);
        const mime = logoPath.endsWith('.png') ? 'image/png' : 'image/jpeg';
        logoDataUrl = `data:${mime};base64,${buf.toString('base64')}`;
      }
    }

    // ── pdfmake singleton (Node.js entry point: js/index.js) ─────────────
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfmake = require('pdfmake');

    // Register Roboto fonts (physical TTF files that ship with pdfmake)
    const robotoDir = path.join(process.cwd(), 'node_modules', 'pdfmake', 'fonts', 'Roboto');
    pdfmake.addFonts({
      Roboto: {
        normal: path.join(robotoDir, 'Roboto-Regular.ttf'),
        bold: path.join(robotoDir, 'Roboto-Medium.ttf'),
        italics: path.join(robotoDir, 'Roboto-Italic.ttf'),
        bolditalics: path.join(robotoDir, 'Roboto-MediumItalic.ttf'),
      },
    });

    // Allow reading local font files
    pdfmake.setLocalAccessPolicy(() => true);

    // ── Constants ────────────────────────────────────────────────────────────
    const GRAY = '#DEEAF1';
    const BLACK = '#000000';
    const EMERALD_DARK = '#1F497D';
    const SZ = 11; // default font size

    // ── Cell helpers ─────────────────────────────────────────────────────────
    const lbl = (text: string) => ({
      text,
      bold: true,
      fontSize: SZ,
      fillColor: GRAY,
      color: BLACK,
      margin: [4, 4, 4, 4] as [number, number, number, number],
    });

    const val = (text: string, colSpan?: number) => {
      const cell: Record<string, unknown> = {
        text: text || '',
        fontSize: SZ,
        color: BLACK,
        margin: [4, 4, 4, 4],
      };
      if (colSpan) cell.colSpan = colSpan;
      return cell;
    };

    const empty = () => ({ text: '' });

    // ── Info table body ───────────────────────────────────────────────────────
    const tableBody = [
      [lbl('Fecha'), val(extractDate(informe.fechaInicio)), { text: '' }, { text: '' }],
      [lbl('Cliente'), val(informe.destinatario || ''), lbl('Solicitante'), val(informe.solicitante || '')],
      [lbl('Dirección'), val(informe.direccion || ''), lbl('Comuna'), val(informe.comuna || '')],
      [lbl('Ubicación'), val(informe.ubicacion || ''), lbl('N° ATM'), val(informe.numeroATM || '')],
      [lbl('Modelo'), val(informe.modeloMMBB || ''), lbl('Técnico'), val(informe.tecnicoSupervisor || '')],
      [lbl('Hora Inicio'), val(extractTime(informe.fechaInicio)), lbl('Hora Término'), val(extractTime(informe.fechaFin))],
    ];

    // ── Photo grid ────────────────────────────────────────────────────────────
    const photoContent: object[] = [];

    if (informe.imagenes && informe.imagenes.length > 0) {
      const images: (string | null)[] = informe.imagenes.map((img: string) => {
        const info = extractBase64(img);
        if (!info) return null;
        return `data:${info.mime};base64,${info.data}`;
      });

      const chunks: (string | null)[][] = [];
      for (let i = 0; i < images.length; i += 4) chunks.push(images.slice(i, i + 4));

      for (let ci = 0; ci < chunks.length; ci++) {
        const chunk = chunks[ci];

        photoContent.push({ text: '', pageBreak: 'before' });
        photoContent.push({
          text: ci === 0 ? 'REGISTRO FOTOGRÁFICO' : 'REGISTRO FOTOGRÁFICO (cont.)',
          bold: true,
          decoration: 'underline',
          alignment: 'center',
          fontSize: SZ,
          margin: [0, 0, 0, 12],
        });

        for (let row = 0; row < 2; row++) {
          const leftImg = chunk[row * 2] ?? null;
          const rightImg = chunk[row * 2 + 1] ?? null;
          const leftIdx = ci * 4 + row * 2 + 1;
          const rightIdx = ci * 4 + row * 2 + 2;

          if (!leftImg && !rightImg) continue;

          const makeCell = (imgUrl: string | null, idx: number) => {
            if (!imgUrl) return { text: '' };
            return {
              stack: [
                { image: imgUrl, width: 240, height: 180, alignment: 'center' },
                {
                  text: `Foto ${idx}`,
                  fontSize: 8,
                  italics: true,
                  color: '#555555',
                  alignment: 'center',
                  margin: [0, 3, 0, 0],
                },
              ],
            };
          };

          photoContent.push({
            columns: [makeCell(leftImg, leftIdx), makeCell(rightImg, rightIdx)],
            columnGap: 10,
            margin: [0, 0, 0, 12],
          });
        }
      }
    }

    // ── Document definition ───────────────────────────────────────────────────
    const docDefinition = {
      pageSize: 'LETTER',
      pageMargins: [45, 45, 45, 45],
      defaultStyle: { font: 'Roboto', fontSize: SZ, color: BLACK },
      content: [
        // OT number top-right
        {
          columns: [
            { text: '', width: '*' },
            {
              text: `OT: ${informe.numeroOT || '____'}`,
              bold: true,
              fontSize: 12,
              alignment: 'right',
              width: 'auto',
            },
          ],
          margin: [0, 0, 0, 6],
        },
        // Logo centered
        logoDataUrl
          ? { image: logoDataUrl, width: 160, height: 110, alignment: 'center', margin: [0, 0, 0, 8] }
          : { text: 'VAULTEC SpA', bold: true, fontSize: 16, color: '#1F497D', alignment: 'center', margin: [0, 0, 0, 8] },
        // Title
        {
          text: 'INFORME TÉCNICO DE SERVICIO',
          bold: true,
          decoration: 'underline',
          alignment: 'center',
          fontSize: 16,
          color: '#1F497D',
          margin: [0, 4, 0, 12],
        },
        // Info table
        {
          table: {
            widths: ['25%', '25%', '25%', '25%'],
            body: tableBody,
          },
          layout: {
            hLineWidth: () => 1,
            vLineWidth: () => 1,
            hLineColor: () => EMERALD_DARK,
            vLineColor: () => EMERALD_DARK,
          },
          margin: [0, 0, 0, 12],
        },
        // Detalle
        { text: 'Detalle del trabajo:', bold: true, decoration: 'underline', fontSize: SZ, margin: [0, 8, 0, 4] },
        { text: informe.detalle || '', fontSize: SZ, margin: [0, 0, 0, 8] },
        // Resumen
        { text: 'Resumen del trabajo:', bold: true, decoration: 'underline', fontSize: SZ, margin: [0, 8, 0, 4] },
        { text: informe.resumenTrabajo || '', fontSize: SZ, margin: [0, 0, 0, 8] },
        // Photos
        ...photoContent,
      ],
    };

    // ── Generate buffer ───────────────────────────────────────────────────────
    const pdfDoc = pdfmake.createPdf(docDefinition);
    const pdfBuffer: Buffer = await pdfDoc.getBuffer();

    const fileName = `Informe_OT_${informe.numeroOT || 'nuevo'}.pdf`;

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': pdfBuffer.byteLength.toString(),
      },
    });
  } catch (error: unknown) {
    console.error('[generar-pdf] Error:', error);
    const msg = error instanceof Error ? error.message : 'Error interno';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
