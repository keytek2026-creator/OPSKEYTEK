import { NextRequest } from 'next/server';
import { generarCotizacionDocx } from '@/lib/generarCotizacionDocx';
import { getCotizacionFileName } from '@/lib/cotizacionFileName';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const cotizacion = body.cotizacion;

    if (!cotizacion) {
      return new Response(JSON.stringify({ error: 'Falta el objeto cotizacion' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const buffer = await generarCotizacionDocx(cotizacion);
    const uint8 = new Uint8Array(buffer);

    const fileName = getCotizacionFileName(cotizacion, 'docx');

    return new Response(uint8, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'Content-Length': uint8.byteLength.toString(),
      },
    });
  } catch (error: unknown) {
    console.error('[generar-cotizacion-docx] Error:', error);
    const msg = error instanceof Error ? error.message : 'Error interno';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
