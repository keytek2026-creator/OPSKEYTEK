import { NextRequest } from 'next/server';
import { generarDocx } from '@/lib/generarDocx';
import { Informe } from '@/types/informe';
import { supabaseInforme } from '@/lib/supabaseInforme';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const informe: Informe = body.informe;

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

    const buffer = await generarDocx(informe);
    const uint8 = new Uint8Array(buffer);

    const sanitize = (str: string) => (str || "").replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
    const destinatario = sanitize(informe.destinatario || "");
    const ot = sanitize(informe.numeroOT ? `informe OT ${informe.numeroOT}` : "informe OT");
    const ubicacion = sanitize(informe.ubicacion || informe.direccion || informe.comuna || "");
    const atm = sanitize(informe.numeroATM || "");
    const parts = [destinatario, ot, ubicacion, atm].filter(Boolean);
    const fileName = `${parts.length > 0 ? parts.join(" - ") : `informe OT ${informe.numeroOT || "nuevo"}`}.docx`;

    return new Response(uint8, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': uint8.byteLength.toString(),
      },
    });
  } catch (error: unknown) {
    console.error('[generar-docx] Error:', error);
    const msg = error instanceof Error ? error.message : 'Error interno';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
