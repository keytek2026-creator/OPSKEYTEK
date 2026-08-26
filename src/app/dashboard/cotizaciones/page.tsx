"use client";

import { useState, useEffect } from "react";
import { 
  FileText, Download, Printer, Plus, Trash2, Edit2, Search, X, 
  CheckCircle2, Clock, Mail, AlertCircle, Building2, Calendar, 
  User, DollarSign, ArrowRight, Eye, Package, Save
} from "lucide-react";
import { downloadCotizacionWord as downloadWord } from "@/lib/downloadCotizacionWord";
import { supabase } from "@/lib/supabase";

// ─── Types ───────────────────────────────────────────────────────────────────
export interface LineItem {
  id: string;
  descripcion: string;
  cantidad: number;
  valorUnit: number;
}

export interface Cotizacion {
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
  validacion: string;
  plazoEntrega?: string;
  nota: string;
  estado: "borrador" | "enviada" | "aprobada" | "rechazada";
  createdAt?: string;
}

const EMPTY_ITEM = (): LineItem => ({
  id: String(Date.now() + Math.random()),
  descripcion: "",
  cantidad: 1,
  valorUnit: 0,
});

const EMPTY_COT = (): Omit<Cotizacion, 'id' | 'createdAt'> => ({
  numero: "",
  fecha: new Date().toLocaleDateString('es-CL'),
  cliente: "",
  rut: "",
  atencion: "",
  emailContacto: "",
  descripcionServicio: "",
  direccion: "",
  items: [EMPTY_ITEM()],
  validacion: "5 días",
  plazoEntrega: "3 días",
  nota: "La cotización es válida por 5 días.",
  estado: 'borrador',
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const IVA_RATE = 0.19;

function calcTotals(items: LineItem[]) {
  const neto = items.reduce((s, i) => s + i.cantidad * i.valorUnit, 0);
  const iva = Math.round(neto * IVA_RATE);
  const bruto = neto + iva;
  return { neto, iva, bruto };
}

function fmtCLP(n: number): string {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}

const ESTADO_STYLE: Record<Cotizacion["estado"], { bg: string; color: string; label: string }> = {
  borrador:  { bg: "rgba(100,116,139,0.15)", color: "#94a3b8", label: "Borrador" },
  enviada:   { bg: "rgba(245,158,11,0.15)",  color: "#f59e0b", label: "Enviada" },
  aprobada:  { bg: "rgba(114,176,29,0.15)",  color: "#72b01d", label: "Aprobada" },
  rechazada: { bg: "rgba(239,68,68,0.15)",   color: "#ef4444", label: "Rechazada" },
};

// Helper to format date as "06 de Agosto 2026"
function formatLongDate(dateStr: string) {
  if (!dateStr) return '';
  const parts = dateStr.split(/[-/]/);
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const months = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    if (!isNaN(day) && month >= 0 && month < 12 && !isNaN(year)) {
      return `${String(day).padStart(2, '0')} de ${months[month]} ${year}`;
    }
  }
  return dateStr;
}

// ─── Print Modal ─────────────────────────────────────────────────────────────
function PrintView({ cot, onClose }: { cot: Cotizacion; onClose: () => void }) {
  const { neto, iva, bruto } = calcTotals(cot.items);
  const handleDownloadWord = () => downloadWord(cot);
  const handlePrint = () => window.print();

  // Paleta exacta del diseño
  const NAVY        = '#1B2A4F';
  const SLATE       = '#5F6E8F';
  const ROW_GRAY    = '#E2E8F0';
  const CLIENT_BLUE = '#2E75B6';
  const TITLE_GRAY  = '#3F3F3F';

  const diasVal = cot.validacion?.replace(/[^\d]/g, '') || '5';
  const TOTAL_ROWS = 4;
  const fillerCount = Math.max(0, TOTAL_ROWS - cot.items.length);
  const fmtM = (n: number) => '$' + new Intl.NumberFormat('es-CL').format(n);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Poppins:wght@300;400;500&display=swap');
        @page { size: A4 portrait; margin: 0; }
        @media print {
          html, body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
          }
          body * {
            visibility: hidden;
          }
          .no-print {
            display: none !important;
          }
          .print-modal-overlay {
            position: absolute !important;
            inset: 0 !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            display: block !important;
          }
          .print-scale-container {
            transform: none !important;
            box-shadow: none !important;
            margin: 0 !important;
          }
          #cotizacion-pdf, #cotizacion-pdf * {
            visibility: visible !important;
          }
          #cotizacion-pdf {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            box-shadow: none !important;
            transform: none !important;
          }
        }
        #cotizacion-pdf {
          position: relative;
          width: 210mm;
          height: 297mm;
          overflow: hidden;
          background: #fff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          font-family: 'Poppins', sans-serif;
          box-sizing: border-box;
        }
      `}</style>

      {/* Overlay — solo en pantalla */}
      <div className="print-modal-overlay" style={{
        position:'fixed', inset:0, zIndex:9999,
        background:'rgba(0,0,0,0.88)', backdropFilter:'blur(6px)',
        display:'flex', alignItems:'flex-start', justifyContent:'center',
        padding:'20px 16px', overflowY:'auto',
      }}>
        <div style={{ width:'100%', maxWidth:820 }}>

          {/* Toolbar */}
          <div className="no-print" style={{ display:'flex', justifyContent:'flex-end', gap:10, marginBottom:14 }}>
            <button onClick={handleDownloadWord} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 18px', background:'#2b579a', color:'white', borderRadius:8, border:'none', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              <FileText size={14}/> Word
            </button>
            <button onClick={handlePrint} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 18px', background:'#dc2626', color:'white', borderRadius:8, border:'none', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              <Download size={14}/> PDF
            </button>
            <button onClick={handlePrint} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 18px', background:'linear-gradient(135deg,#72b01d,#578814)', color:'white', borderRadius:8, border:'none', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              <Printer size={14}/> Imprimir
            </button>
            <button onClick={onClose} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 18px', background:'rgba(255,255,255,0.08)', color:'#94a3b8', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
              <X size={14}/> Cerrar
            </button>
          </div>

          {/* Preview escalado en pantalla */}
          <div style={{ display:'flex', justifyContent:'center' }}>
            <div className="print-scale-container" style={{ transform:'scale(0.87)', transformOrigin:'top center', boxShadow:'0 16px 60px rgba(0,0,0,0.6)', borderRadius:2, marginBottom:'-13%' }}>

              {/* DOCUMENTO A4 */}
              <div id="cotizacion-pdf">

                {/* OLA SUPERIOR (Imagen idéntica a Word) */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/top_wave.png"
                  alt=""
                  style={{ position:'absolute', top:0, left:0, width:'100%', height:'52mm', objectFit:'fill', pointerEvents:'none', zIndex:1 }}
                />

                {/* OLA INFERIOR (Imagen idéntica a Word) */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/bottom_wave.png"
                  alt=""
                  style={{ position:'absolute', bottom:0, left:0, width:'100%', height:'58mm', objectFit:'fill', pointerEvents:'none', zIndex:1 }}
                />

                {/* CONTENIDO */}
                <div style={{ position:'relative', zIndex:2, width:'100%', height:'100%', padding:'52mm 22mm 46mm 22mm', boxSizing:'border-box', display:'flex', flexDirection:'column' }}>

                  {/* HEADER */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'6mm' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/coti.png" alt="vaultec" style={{ width:'30mm', height:'30mm', objectFit:'contain' }}/>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:'17pt', color:TITLE_GRAY, lineHeight:1.1 }}>
                        COTIZACI&Oacute;N #{cot.numero || '___'}
                      </div>
                      <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:300, fontSize:'10.5pt', color:TITLE_GRAY, marginTop:'1.5mm' }}>
                        {formatLongDate(cot.fecha)}
                      </div>
                    </div>
                  </div>

                  {/* CLIENTE */}
                  <div style={{ marginBottom:'5mm' }}>
                    <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:'8pt', color:TITLE_GRAY, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:'1.5mm' }}>
                      Cliente
                    </div>
                    {cot.atencion ? (
                      <>
                        <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:500, fontSize:'9pt', color:CLIENT_BLUE, lineHeight:1.6 }}>Nombre: {cot.atencion}</div>
                        <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:500, fontSize:'9pt', color:CLIENT_BLUE, lineHeight:1.6 }}>Empresa: {cot.cliente}</div>
                      </>
                    ) : (
                      <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:500, fontSize:'9pt', color:CLIENT_BLUE, lineHeight:1.6 }}>{cot.cliente}</div>
                    )}
                  </div>

                  {/* TABLA */}
                  <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:'4mm', tableLayout:'fixed' }}>
                    <thead>
                      <tr style={{ background:SLATE }}>
                        <th style={{ fontFamily:"'Poppins',sans-serif", fontWeight:500, fontSize:'8.5pt', color:'white', textAlign:'left',   padding:'2.5mm 3mm 2.5mm 3.5mm', width:'45%' }}>Descripci&oacute;n</th>
                        <th style={{ fontFamily:"'Poppins',sans-serif", fontWeight:500, fontSize:'8.5pt', color:'white', textAlign:'center', padding:'2.5mm', width:'18%' }}>Cantidad</th>
                        <th style={{ fontFamily:"'Poppins',sans-serif", fontWeight:500, fontSize:'8.5pt', color:'white', textAlign:'right',  padding:'2.5mm', width:'18%' }}>Precio</th>
                        <th style={{ fontFamily:"'Poppins',sans-serif", fontWeight:500, fontSize:'8.5pt', color:'white', textAlign:'right',  padding:'2.5mm 3.5mm 2.5mm 3mm', width:'19%' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cot.items.map((item) => (
                        <tr key={item.id} style={{ background:'white', height:'8mm' }}>
                          <td style={{ fontFamily:"'Poppins',sans-serif", fontWeight:300, fontSize:'8.5pt', color:'#333', padding:'0 3mm 0 3.5mm' }}>{item.descripcion}</td>
                          <td style={{ fontFamily:"'Poppins',sans-serif", fontWeight:300, fontSize:'8.5pt', color:'#333', textAlign:'center', padding:'0 3mm' }}>{item.cantidad}</td>
                          <td style={{ fontFamily:"'Poppins',sans-serif", fontWeight:300, fontSize:'8.5pt', color:'#333', textAlign:'right',  padding:'0 3mm' }}>{fmtM(item.valorUnit)}</td>
                          <td style={{ fontFamily:"'Poppins',sans-serif", fontWeight:400, fontSize:'8.5pt', color:'#333', textAlign:'right',  padding:'0 3.5mm 0 3mm' }}>{fmtM(item.cantidad * item.valorUnit)}</td>
                        </tr>
                      ))}
                      {Array.from({ length: fillerCount }).map((_, i) => (
                        <tr key={`f-${i}`} style={{ background: i % 2 === 0 ? ROW_GRAY : 'white', height:'8mm' }}>
                          <td style={{ padding:'0 3mm 0 3.5mm' }}>&nbsp;</td>
                          <td>&nbsp;</td><td>&nbsp;</td>
                          <td style={{ padding:'0 3.5mm 0 3mm' }}>&nbsp;</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* TOTALES */}
                  <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'4mm' }}>
                    <div style={{ width:'48%' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', padding:'1.2mm 0', borderBottom:`1px solid ${ROW_GRAY}` }}>
                        <span style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:'8.5pt', color:NAVY }}>SUBTOTAL</span>
                        <span style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:'8.5pt', color:TITLE_GRAY }}>{fmtM(neto)}</span>
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between', padding:'1.2mm 0', marginBottom:'1.5mm', borderBottom:`1px solid ${ROW_GRAY}` }}>
                        <span style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:'8.5pt', color:NAVY }}>IVA (19%)</span>
                        <span style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:'8.5pt', color:TITLE_GRAY }}>{fmtM(iva)}</span>
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:SLATE, padding:'3mm 4mm', borderRadius:'1mm' }}>
                        <span style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:'10pt', color:'white' }}>TOTAL:</span>
                        <span style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:'11.5pt', color:'white' }}>{fmtM(bruto)}</span>
                      </div>
                    </div>
                  </div>

                  {/* DIRECCIÓN */}
                  {cot.direccion && (
                    <div style={{ marginBottom:'2mm' }}>
                      <span style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:'8.5pt', color:NAVY }}>Direcci&oacute;n: </span>
                      <span style={{ fontFamily:"'Poppins',sans-serif", fontWeight:400, fontSize:'8.5pt', color:'#5A5A5A' }}>
                        {cot.direccion}
                      </span>
                    </div>
                  )}

                  {/* NOTA */}
                  <div>
                    <span style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:'8.5pt', color:NAVY }}>Nota: </span>
                    <span style={{ fontFamily:"'Poppins',sans-serif", fontWeight:300, fontSize:'8.5pt', color:'#5A5A5A' }}>
                      {cot.nota || `La cotizaci\u00f3n es v\u00e1lida por ${diasVal} d\u00edas.`}
                    </span>
                  </div>

                </div>

                {/* FOOTER EMAIL */}
                <div style={{ position:'absolute', bottom:'14mm', left:0, right:0, zIndex:3, textAlign:'center' }}>
                  <span style={{ fontFamily:"'Poppins',sans-serif", fontWeight:300, fontSize:'9pt', color:'white' }}>contacto@vaultec.cl</span>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Form Modal ───────────────────────────────────────────────────────────────
function CotizacionForm({
  initial,
  onClose,
  onSave,
}: {
  initial?: Cotizacion | null;
  onClose: () => void;
  onSave: (c: Cotizacion) => Promise<void>;
}) {
  const [form, setForm] = useState<Cotizacion>(() => {
    if (initial) return initial;
    return {
      ...EMPTY_COT(),
      id: `cot-${Date.now()}`,
      createdAt: new Date().toISOString(),
    } as Cotizacion;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (field: keyof Cotizacion) => (val: any) => setForm(f => ({ ...f, [field]: val }));

  const setItem = (id: string, field: keyof LineItem, val: any) =>
    setForm(f => ({ ...f, items: f.items.map(i => i.id === id ? { ...i, [field]: val } : i) }));

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, EMPTY_ITEM()] }));
  const removeItem = (id: string) => setForm(f => ({ ...f, items: f.items.filter(i => i.id !== id) }));

  const { neto, iva, bruto } = calcTotals(form.items);

  const handleSave = async () => {
    if (!form.cliente) { setError("El campo Cliente es obligatorio."); return; }
    setSaving(true); setError("");
    const finalForm: Cotizacion = {
      ...form,
      nota: "La cotización es válida por 5 días."
    };
    try { await onSave(finalForm); } catch (e: any) { setError(e?.message || "Error al guardar"); setSaving(false); }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 12px",
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 8, color: "#f1f5f9", fontSize: 13, fontFamily: "inherit",
    outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)", overflowY: "auto", padding: "24px 16px" }}>
      <div style={{ maxWidth: 780, margin: "0 auto", background: "#1b1e24", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "20px 28px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 16 }}>
              {initial ? "Editar Cotización" : "Nueva Cotización"}
            </div>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>ATM's Servicios — RUT: 76.049.304-K</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}><X size={20} /></button>
        </div>

        <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Meta row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <div>
              <label style={{ color: "#64748b", fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>FECHA</label>
              <input style={inputStyle} value={form.fecha} onChange={e => set("fecha")(e.target.value)} placeholder="DD/MM/AAAA" />
            </div>
            <div>
              <label style={{ color: "#64748b", fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>N° COTIZACIÓN</label>
              <input style={inputStyle} value={form.numero} onChange={e => set("numero")(e.target.value)} placeholder="Ej: 024-2026" />
            </div>
            <div>
              <label style={{ color: "#64748b", fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>ESTADO</label>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={form.estado} onChange={e => set("estado")(e.target.value)}>
                <option value="borrador" style={{ color: "#000000", backgroundColor: "#ffffff" }}>Borrador</option>
                <option value="enviada" style={{ color: "#000000", backgroundColor: "#ffffff" }}>Enviada</option>
                <option value="aprobada" style={{ color: "#000000", backgroundColor: "#ffffff" }}>Aprobada</option>
                <option value="rechazada" style={{ color: "#000000", backgroundColor: "#ffffff" }}>Rechazada</option>
              </select>
            </div>
          </div>

          {/* Cliente y Dirección */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={{ color: "#64748b", fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>SEÑOR(ES) / CLIENTE *</label>
              <input style={inputStyle} value={form.cliente} onChange={e => set("cliente")(e.target.value)} placeholder="Nombre empresa o persona" />
            </div>
            <div>
              <label style={{ color: "#64748b", fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>RUT</label>
              <input style={inputStyle} value={form.rut} onChange={e => set("rut")(e.target.value)} placeholder="XX.XXX.XXX-X" />
            </div>
            <div>
              <label style={{ color: "#64748b", fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>ATENCIÓN</label>
              <input style={inputStyle} value={form.atencion} onChange={e => set("atencion")(e.target.value)} placeholder="Nombre contacto" />
            </div>
            <div>
              <label style={{ color: "#64748b", fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>EMAIL CONTACTO</label>
              <input style={inputStyle} value={form.emailContacto} onChange={e => set("emailContacto")(e.target.value)} placeholder="email@empresa.cl" />
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label style={{ color: "#64748b", fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>DIRECCIÓN / UBICACIÓN</label>
              <input style={inputStyle} value={form.direccion} onChange={e => set("direccion")(e.target.value)} placeholder="Ej: Av. Providencia 1234, Santiago" />
            </div>
          </div>

          {/* Descripción servicio */}
          <div>
            <label style={{ color: "#64748b", fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>DESCRIPCIÓN DEL SERVICIO</label>
            <textarea
              style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
              value={form.descripcionServicio}
              onChange={e => set("descripcionServicio")(e.target.value)}
              placeholder="Ej: VISITA ELÉCTRICA ATM 6423 — TIENDA PRONTO COPEC..."
            />
          </div>

          {/* Items */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <label style={{ color: "#64748b", fontSize: 11, fontWeight: 600 }}>ÍTEMS</label>
              <button onClick={addItem} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", background: "rgba(114,176,29,0.12)", border: "1px solid rgba(114,176,29,0.25)", color: "#72b01d", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                <Plus size={12} /> Agregar ítem
              </button>
            </div>

            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 130px 130px 32px", gap: 6, marginBottom: 6 }}>
              {["DESCRIPCIÓN", "CANT.", "VALOR UNIT.", "TOTAL", ""].map(h => (
                <div key={h} style={{ color: "#475569", fontSize: 10, fontWeight: 700 }}>{h}</div>
              ))}
            </div>

            {form.items.map(item => {
              const total = item.cantidad * item.valorUnit;
              return (
                <div key={item.id} style={{ display: "grid", gridTemplateColumns: "1fr 70px 130px 130px 32px", gap: 6, marginBottom: 6, alignItems: "center" }}>
                  <input style={inputStyle} value={item.descripcion} onChange={e => setItem(item.id, "descripcion", e.target.value)} placeholder="Descripción del ítem" />
                  <input style={{ ...inputStyle, textAlign: "center" }} type="number" min={1} value={item.cantidad} onChange={e => setItem(item.id, "cantidad", Number(e.target.value))} />
                  <input style={{ ...inputStyle, textAlign: "right" }} type="number" min={0} value={item.valorUnit} onChange={e => setItem(item.id, "valorUnit", Number(e.target.value))} placeholder="0" />
                  <div style={{ ...inputStyle, textAlign: "right", color: "#72b01d", fontWeight: 700, pointerEvents: "none" }}>{fmtCLP(total)}</div>
                  <button onClick={() => removeItem(item.id)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", padding: 4 }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Nota (Fija y no modificable) */}
          <div>
            <label style={{ color: "#64748b", fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>NOTA (CONDICIÓN FIJA)</label>
            <input
              style={{ ...inputStyle, background: "rgba(255,255,255,0.02)", color: "#94a3b8", cursor: "not-allowed", borderStyle: "dashed" }}
              value="La cotización es válida por 5 días."
              readOnly
              disabled
            />
          </div>

          {/* Totales */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 20 }}>
            <div />

            {/* Totals */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "14px 18px", minWidth: 200 }}>
              {[
                { label: "NETO", value: fmtCLP(neto) },
                { label: "IVA (19%)", value: fmtCLP(iva) },
              ].map(r => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13, color: "#94a3b8" }}>
                  <span>{r.label}</span><span style={{ fontWeight: 600 }}>{r.value}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, color: "#72b01d", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10, marginTop: 4 }}>
                <span>BRUTO</span><span>{fmtCLP(bruto)}</span>
              </div>
            </div>
          </div>

          {error && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", color: "#f87171", fontSize: 13 }}>
              ⚠️ {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 4 }}>
            <button onClick={onClose} disabled={saving} style={{ padding: "9px 20px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 22px", background: saving ? "#578814" : "linear-gradient(135deg,#72b01d,#578814)", border: "none", color: "white", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: saving ? 0.8 : 1 }}>
              {saving ? (
                <><span style={{ display: "inline-block", width: 13, height: 13, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />Guardando...</>
              ) : (
                <><Save size={14} />Guardar Cotización</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function CotizacionesPage() {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Cotizacion | null>(null);
  const [previewing, setPreviewing] = useState<Cotizacion | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Cotizacion | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState("todos");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const { data, error } = await supabase
      .from("cotizaciones")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setCotizaciones(data.map(r => ({ ...r.data, id: r.id, createdAt: r.created_at })));
    setLoading(false);
  }

  const handleDownloadWord = (cot: Cotizacion) => {
    downloadWord(cot);
  };

  async function handleSave(cot: Cotizacion) {
    const exists = cotizaciones.some(c => c.id === cot.id);
    const { error } = await supabase
      .from("cotizaciones")
      .upsert({ id: cot.id, data: cot });
    if (error) throw new Error(error.message);
    setCotizaciones(prev =>
      exists ? prev.map(c => c.id === cot.id ? cot : c) : [cot, ...prev]
    );
    setShowForm(false);
    setEditing(null);
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    const { error } = await supabase.from("cotizaciones").delete().eq("id", confirmDelete.id);
    if (!error) {
      setCotizaciones(prev => prev.filter(c => c.id !== confirmDelete.id));
      setConfirmDelete(null);
    }
    setDeleting(false);
  }

  const filtered = cotizaciones.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.numero.toLowerCase().includes(q) || c.cliente.toLowerCase().includes(q) || c.descripcionServicio.toLowerCase().includes(q);
    const matchEstado = filterEstado === "todos" || c.estado === filterEstado;
    return matchSearch && matchEstado;
  });

  // Stats
  const stats = {
    total: cotizaciones.length,
    aprobadas: cotizaciones.filter(c => c.estado === 'aprobada').length,
    enviadas: cotizaciones.filter(c => c.estado === 'enviada').length,
    monto: cotizaciones.filter(c => c.estado === 'aprobada').reduce((s, c) => s + calcTotals(c.items).bruto, 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="section-title">Cotizaciones</h2>
          <p className="section-subtitle">Gestión de presupuestos y propuestas comerciales</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", background: "linear-gradient(135deg,#72b01d,#578814)", border: "none", color: "white", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 16px rgba(114,176,29,0.35)" }}
        >
          <Plus size={16} /> Nueva Cotización
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total cotizaciones", value: stats.total, color: "#72b01d", icon: FileText },
          { label: "Enviadas", value: stats.enviadas, color: "#f59e0b", icon: Mail },
          { label: "Aprobadas", value: stats.aprobadas, color: "#10b981", icon: CheckCircle2 },
          { label: "Monto aprobado", value: fmtCLP(stats.monto), color: "#3b82f6", icon: Package },
        ].map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="stat-card">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${k.color}18` }}>
                  <Icon size={20} style={{ color: k.color }} />
                </div>
              </div>
              <div className="text-2xl font-bold mb-1" style={{ color: "#f1f5f9" }}>{k.value}</div>
              <div className="text-sm" style={{ color: "#64748b" }}>{k.label}</div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por N°, cliente, descripción..."
            style={{ width: "100%", padding: "8px 12px 8px 34px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8, color: "#f1f5f9", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
          />
        </div>
        <select
          value={filterEstado}
          onChange={e => setFilterEstado(e.target.value)}
          style={{ padding: "8px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8, color: "#f1f5f9", fontSize: 13, fontFamily: "inherit", cursor: "pointer", minWidth: 150 }}
        >
          <option value="todos" style={{ color: "#000000", backgroundColor: "#ffffff" }}>Todos los estados</option>
          <option value="borrador" style={{ color: "#000000", backgroundColor: "#ffffff" }}>Borrador</option>
          <option value="enviada" style={{ color: "#000000", backgroundColor: "#ffffff" }}>Enviada</option>
          <option value="aprobada" style={{ color: "#000000", backgroundColor: "#ffffff" }}>Aprobada</option>
          <option value="rechazada" style={{ color: "#000000", backgroundColor: "#ffffff" }}>Rechazada</option>
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="glass-card p-12 text-center" style={{ color: "#64748b" }}>Cargando cotizaciones...</div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <FileText size={40} style={{ color: "#334155", margin: "0 auto 12px" }} />
          <div style={{ color: "#94a3b8", fontWeight: 600 }}>No hay cotizaciones</div>
          <div style={{ color: "#475569", fontSize: 13, marginTop: 4 }}>Crea tu primera cotización con el botón de arriba</div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => {
            const { bruto } = calcTotals(c.items);
            const est = ESTADO_STYLE[c.estado];
            return (
              <div key={c.id} className="glass-card p-5">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(114,176,29,0.08)", border: "1px solid rgba(114,176,29,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <FileText size={20} style={{ color: "#72b01d" }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 14 }}>N° {c.numero || "Sin número"}</span>
                        <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 20, background: est.bg, color: est.color, fontWeight: 700 }}>{est.label}</span>
                      </div>
                      <div style={{ color: "#64748b", fontSize: 12, marginBottom: 4 }}>
                        <Building2 size={11} style={{ display: "inline", marginRight: 4 }} />{c.cliente || "Sin cliente"}
                        {c.atencion && <> · <User size={11} style={{ display: "inline", marginRight: 4 }} />{c.atencion}</>}
                      </div>
                      {c.descripcionServicio && (
                        <div style={{ color: "#94a3b8", fontSize: 12, maxWidth: 500 }}>{c.descripcionServicio.slice(0, 120)}{c.descripcionServicio.length > 120 ? "…" : ""}</div>
                      )}
                      <div className="flex flex-wrap gap-4 mt-2">
                        <span style={{ color: "#475569", fontSize: 11 }}><Calendar size={10} style={{ display: "inline", marginRight: 3 }} />{c.fecha}</span>
                        <span style={{ color: "#72b01d", fontSize: 12, fontWeight: 700 }}>{fmtCLP(bruto)}</span>
                        <span style={{ color: "#475569", fontSize: 11 }}>{c.items.length} ítem{c.items.length !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center">
                    <button
                      onClick={() => setPreviewing(c)}
                      title="Ver e Imprimir"
                      style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 13px", background: "rgba(114,176,29,0.1)", border: "1px solid rgba(114,176,29,0.2)", color: "#72b01d", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      <Eye size={13} /> Ver PDF
                    </button>
                    <button
                      onClick={() => handleDownloadWord(c)}
                      title="Descargar Word"
                      style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 13px", background: "rgba(43,87,154,0.15)", border: "1px solid rgba(43,87,154,0.3)", color: "#60a5fa", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      <FileText size={13} /> Word
                    </button>
                    <button
                      onClick={() => { setEditing(c); setShowForm(true); }}
                      title="Editar"
                      style={{ padding: "7px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", borderRadius: 8, cursor: "pointer" }}
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(c)}
                      title="Eliminar"
                      style={{ padding: "7px 10px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", color: "#f87171", borderRadius: 8, cursor: "pointer" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showForm && (
        <CotizacionForm
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}

      {previewing && <PrintView cot={previewing} onClose={() => setPreviewing(null)} />}

      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#1b1e24", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 16, padding: 32, maxWidth: 400, width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Trash2 size={20} style={{ color: "#f87171" }} />
              </div>
              <div>
                <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 16 }}>¿Eliminar cotización?</div>
                <div style={{ color: "#64748b", fontSize: 13 }}>Esta acción no se puede deshacer</div>
              </div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "12px 16px", marginBottom: 24 }}>
              <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 14 }}>N° {confirmDelete.numero}</div>
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>{confirmDelete.cliente}</div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDelete(null)} disabled={deleting} style={{ padding: "9px 20px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
              <button onClick={handleDelete} disabled={deleting} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 20px", background: deleting ? "#7f1d1d" : "linear-gradient(135deg,#dc2626,#b91c1c)", border: "none", color: "white", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: deleting ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: deleting ? 0.8 : 1 }}>
                {deleting ? "Eliminando..." : <><Trash2 size={14} /> Sí, eliminar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
