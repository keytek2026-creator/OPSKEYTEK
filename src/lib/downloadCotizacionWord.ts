export async function downloadCotizacionWord(cot: any) {
  try {
    const res = await fetch('/api/generar-cotizacion-docx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cotizacion: cot }),
    });
    if (!res.ok) throw new Error('Error al generar el documento Word');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cotizacion-${cot.numero || 'nueva'}.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Error al descargar documento Word:', e);
    alert('Error al descargar el archivo de Word.');
  }
}
