export function sanitizeFileName(str: string): string {
  return (str || "")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getCotizacionFileName(cot: any, ext?: string): string {
  if (!cot) return ext ? `Cotizacion.${ext}` : "Cotizacion";

  // 1. Número de cotización: "Cotizacion N°028-2026"
  const rawNum = sanitizeFileName(cot.numero || "");
  let numPart = "";
  if (rawNum) {
    if (/^cotizaci[oó]n\s*n[°o#]/i.test(rawNum)) {
      numPart = rawNum.replace(/^cotizaci[oó]n\s*n[°o#]\s*/i, "Cotizacion N°");
    } else if (/^cotizaci[oó]n\s*/i.test(rawNum)) {
      numPart = rawNum.replace(/^cotizaci[oó]n\s*/i, "Cotizacion N°");
    } else if (/^n[°o#]\s*/i.test(rawNum)) {
      numPart = `Cotizacion N°${rawNum.replace(/^n[°o#]\s*/i, "")}`;
    } else {
      numPart = `Cotizacion N°${rawNum}`;
    }
  } else {
    numPart = "Cotizacion";
  }

  // 2. Cliente: "NCR"
  const cliente = sanitizeFileName(cot.cliente || "");

  // 3. ATM / Cajero
  let rawAtm = sanitizeFileName(cot.numeroATM || cot.atm || "");
  if (!rawAtm) {
    const textToSearch = `${cot.descripcionServicio || ""} ${cot.direccion || ""}`;
    const match = textToSearch.match(/\b(?:ATM|CAJERO)\s*#?\s*([A-Za-z0-9_-]+)/i);
    if (match) {
      rawAtm = match[1];
    }
  }

  let atmPart = "";
  if (rawAtm) {
    atmPart = /^atm\b/i.test(rawAtm) ? rawAtm.toUpperCase() : `ATM ${rawAtm}`;
  }

  // 4. Local / Ubicación: "SUPERMERCADO BODEGA ACUENTA PAINE"
  // Prioridad absoluta al LOCAL: cot.local > cot.ubicacion > cot.direccion
  let ubicacion = sanitizeFileName(cot.local || cot.ubicacion || cot.direccion || "");

  // Si la ubicación ya contiene el ATM (ej: "SUPERMERCADO BODEGA ACUENTA PAINE ATM 6400"), no duplicar
  if (atmPart && ubicacion.toUpperCase().includes(atmPart.toUpperCase())) {
    atmPart = "";
  }

  // Si no hay dirección especificada pero sí hay descripción del servicio, intentar extraer algo descriptivo
  if (!ubicacion && cot.descripcionServicio) {
    const cleanDesc = sanitizeFileName(cot.descripcionServicio)
      .replace(/\b(?:ATM|CAJERO)\s*#?\s*[A-Za-z0-9_-]+/gi, "")
      .trim();
    if (cleanDesc) {
      ubicacion = cleanDesc.slice(0, 50).trim();
    }
  }

  const parts = [numPart, cliente, ubicacion, atmPart].filter(Boolean);
  const baseName = parts.length > 0 ? parts.join(" ") : `Cotizacion-${cot.numero || "nueva"}`;

  return ext ? `${baseName}.${ext}` : baseName;
}
