"use client";

import { useState, useEffect } from "react";
import {
  FileText, Plus, Download, Send, Eye, X, ClipboardList, MapPin,
  Monitor, Cpu, User, Calendar, ImageIcon, Save, FileOutput,
  CheckCircle2, Trash2, Clock, Edit,
} from "lucide-react";
import { mockWorkOrders } from "@/lib/mock-data";
import { formatDateTime, formatDate } from "@/lib/utils";
import type { TechnicalReport } from "@/types";
import { getReportsDB, saveReportDB, deleteReportDB, getReportByIdDB } from "@/lib/reportsDb";

// ─── Word Document Generation Utility ─────────────────────────────────────────
const formatDateForWord = (dateString?: string) => {
  if (!dateString) return "";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}-${month}-${year}; ${hours}:${minutes}`;
  } catch (e) {
    return dateString;
  }
};

const getReportFileName = (report: any, ext: 'docx' | 'pdf') => {
  const sanitize = (str: string) => (str || "").replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
  
  const destinatario = sanitize(report.destinatario || report.clientName || "");
  const ot = sanitize(report.otNumber ? `informe OT ${report.otNumber}` : "informe OT");
  const ubicacion = sanitize(report.ubicacionRef || report.local || report.direccion || "");
  const atm = sanitize(report.numeroATM || report.atm || "");

  const parts = [destinatario, ot, ubicacion, atm].filter(Boolean);
  const baseName = parts.length > 0 ? parts.join(" - ") : `informe OT ${report.otNumber || "nuevo"}`;
  return `${baseName}.${ext}`;
};

const downloadReportAsWord = async (report: any) => {
  const filename = getReportFileName(report, 'docx');
  
  const mappedInforme = {
    numeroOT: report.otNumber || "",
    destinatario: report.destinatario || report.clientName || "",
    direccion: report.direccion || "",
    ubicacion: report.ubicacionRef || "",
    comuna: report.comuna || "",
    numeroATM: report.numeroATM || "",
    serieATM: report.serieATM || "",
    modeloMMBB: report.modeloMMBB || "",
    serieMMBB: report.serieMMBB || "",
    solicitante: report.solicitante || "",
    tecnicoSupervisor: report.technicianName || report.tecnico || "",
    fechaInicio: report.fechaInicio || "",
    fechaFin: report.fechaFin || "",
    valorServicio: report.valorServicio || "",
    detalle: report.diagnosis || "",
    resumenTrabajo: report.solution || "",
    imagenes: report.images || []
  };

  try {
    const response = await fetch('/api/generar-docx', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ informe: { ...mappedInforme, imagenes: [] }, reportId: report.id }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate document');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  } catch (error) {
    console.error('Error generating document:', error);
    alert('Error al generar el documento Word. Por favor intente de nuevo.');
  }
};

const downloadReportAsPdf = async (report: any) => {
  const filename = getReportFileName(report, 'pdf');

  const formatFechaHtml = (dateString?: string) => {
    if (!dateString) return "";
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return dateString;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${day}-${month}-${year}; ${hours}:${minutes}`;
    } catch (e) {
      return dateString;
    }
  };

  // Fetch the logo base64 dynamically from the public directory
  let logoBase64 = "";
  try {
    const res = await fetch("/logo_b64.txt");
    if (res.ok) {
      const text = await res.text();
      logoBase64 = text.trim();
    }
  } catch (e) {
    console.error("Error loading logo base64:", e);
  }

  // Map report data same way as Word
  const mappedInforme = {
    numeroOT: report.otNumber || "",
    destinatario: report.destinatario || report.clientName || "",
    direccion: report.direccion || "",
    ubicacion: report.ubicacionRef || "",
    comuna: report.comuna || "",
    numeroATM: report.numeroATM || "",
    serieATM: report.serieATM || "",
    modeloMMBB: report.modeloMMBB || "",
    serieMMBB: report.serieMMBB || "",
    solicitante: report.solicitante || "",
    tecnicoSupervisor: report.technicianName || report.tecnico || "",
    fechaInicio: formatFechaHtml(report.fechaInicio),
    fechaFin: formatFechaHtml(report.fechaFin),
    valorServicio: report.valorServicio || "",
    detalle: report.diagnosis || report.detalletrabajo || "",
    resumenTrabajo: report.solution || report.resumenTrabajo || "",
    imagenes: report.images || [],
    logoBase64,
  };

  try {
    const response = await fetch('/api/generar-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ informe: { ...mappedInforme, imagenes: [] }, reportId: report.id }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Error del servidor: ${errText}`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Error al generar el documento PDF. Por favor intente de nuevo.');
  }
};

// ─── Form state type ─────────────────────────────────────────────────────────
interface ReportForm {
  otNumber: string;
  direccion: string;
  ubicacionRef: string;
  comuna: string;
  numeroATM: string;
  serieATM: string;
  modeloMMBB: string;
  serieMMBB: string;
  destinatario: string;
  solicitante: string;
  tecnico: string;
  fechaInicio: string;
  fechaFin: string;
  valorServicio: string;
  detalletrabajo: string;
  resumenTrabajo: string;
}

const EMPTY_FORM: ReportForm = {
  otNumber: "", direccion: "", ubicacionRef: "", comuna: "",
  numeroATM: "", serieATM: "", modeloMMBB: "", serieMMBB: "",
  destinatario: "", solicitante: "", tecnico: "",
  fechaInicio: "", fechaFin: "", valorServicio: "",
  detalletrabajo: "", resumenTrabajo: "",
};

// ─── Section wrapper ─────────────────────────────────────────────────────────
function FormSection({ icon: Icon, title, children }: {
  icon: React.ElementType; title: string; children: React.ReactNode;
}) {
  return (
    <div style={{ background: "rgba(27,30,36,0.9)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "22px 24px", marginBottom: 16 }}>
      <div className="flex items-center gap-2 mb-5 pb-3" style={{ borderBottom: "1px solid rgba(114,176,29,0.15)" }}>
        <Icon size={16} style={{ color: "#72b01d" }} />
        <span style={{ color: "#72b01d", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

// ─── Field component ─────────────────────────────────────────────────────────
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#94a3b8", marginBottom: 7 }}>
        {label} {required && <span style={{ color: "#72b01d" }}>*</span>}
      </label>
      {children}
    </div>
  );
}

// Input styled to match user's original green-accent design
const inputStyle: React.CSSProperties = {
  width: "100%", background: "rgba(27,30,36,0.95)", border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 8, padding: "10px 14px", fontSize: 13.5, color: "#e2e8f0",
  outline: "none", fontFamily: "Inter, inherit", transition: "border-color 0.15s ease",
};

function Input({ placeholder, value, onChange, type = "text" }: {
  placeholder: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={inputStyle}
      onFocus={(e) => { e.target.style.borderColor = "rgba(114,176,29,0.5)"; e.target.style.boxShadow = "0 0 0 3px rgba(114,176,29,0.08)"; }}
      onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.09)"; e.target.style.boxShadow = "none"; }}
    />
  );
}

function Textarea({ placeholder, value, onChange, rows = 4 }: {
  placeholder: string; value: string; onChange: (v: string) => void; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
      onFocus={(e) => { e.target.style.borderColor = "rgba(114,176,29,0.5)"; e.target.style.boxShadow = "0 0 0 3px rgba(114,176,29,0.08)"; }}
      onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.09)"; e.target.style.boxShadow = "none"; }}
    />
  );
}

// ─── New Report Form ──────────────────────────────────────────────────────────
function NewReportForm({
  onClose,
  onSave,
  editingReport,
}: {
  onClose: () => void;
  onSave: (report: TechnicalReport) => void;
  editingReport?: TechnicalReport | null;
}) {
  const [form, setForm] = useState<ReportForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [images, setImages] = useState<{ url: string; base64: string }[]>([]);

  // Helpers states to align exactly with the Single Date + Start/End time requested by Word
  const [reportDate, setReportDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  useEffect(() => {
    if (editingReport) {
      setForm({
        otNumber: editingReport.otNumber || "",
        direccion: editingReport.direccion || "",
        ubicacionRef: editingReport.ubicacionRef || "",
        comuna: editingReport.comuna || "",
        numeroATM: editingReport.numeroATM || "",
        serieATM: editingReport.serieATM || "",
        modeloMMBB: editingReport.modeloMMBB || "",
        serieMMBB: editingReport.serieMMBB || "",
        destinatario: editingReport.destinatario || editingReport.clientName || "",
        solicitante: editingReport.solicitante || "",
        tecnico: editingReport.technicianName || editingReport.tecnico || "",
        fechaInicio: editingReport.fechaInicio || "",
        fechaFin: editingReport.fechaFin || "",
        valorServicio: editingReport.valorServicio || "",
        detalletrabajo: editingReport.diagnosis || "",
        resumenTrabajo: editingReport.solution || "",
      });

      if (editingReport.fechaInicio) {
        const parts = editingReport.fechaInicio.split('T');
        if (parts.length === 2) {
          setReportDate(parts[0]);
          setStartTime(parts[1].slice(0, 5));
        } else {
          // Fallback if not in ISO format
          setReportDate(editingReport.fechaInicio.slice(0, 10));
          setStartTime("08:00");
        }
      } else {
        setReportDate(new Date().toISOString().slice(0, 10));
        setStartTime("09:00");
      }

      if (editingReport.fechaFin) {
        const parts = editingReport.fechaFin.split('T');
        if (parts.length === 2) {
          setEndTime(parts[1].slice(0, 5));
        } else {
          setEndTime("18:00");
        }
      } else {
        setEndTime("18:00");
      }

      if (editingReport.images && editingReport.images.length > 0) {
        setImages(editingReport.images.map(img => ({ url: img, base64: img })));
      } else {
        setImages([]);
      }
    } else {
      setForm(EMPTY_FORM);
      const today = new Date().toISOString().slice(0, 10);
      setReportDate(today);
      setStartTime("09:00");
      setEndTime("18:00");
      setImages([]);
    }
  }, [editingReport]);

  const set = (field: keyof ReportForm) => (v: string) => setForm((f) => ({ ...f, [field]: v }));

  const handleSave = async () => {
    if (saving) return;
    setSaveError('');
    setSaving(true);

    const matchedOrder = mockWorkOrders.find(o => o.otNumber === form.otNumber);
    const clientName = matchedOrder ? matchedOrder.clientName : (form.solicitante || "Cliente General");
    const workOrderId = editingReport ? editingReport.workOrderId : (matchedOrder ? matchedOrder.id : `wo-${Date.now()}`);

    const finalFechaInicio = reportDate && startTime ? `${reportDate}T${startTime}:00` : form.fechaInicio;
    const finalFechaFin = reportDate && endTime ? `${reportDate}T${endTime}:00` : form.fechaFin;

    const newReport: any = {
      id: editingReport ? editingReport.id : `rep-${Date.now()}`,
      workOrderId,
      otNumber: form.otNumber || `OT-${Date.now()}`,
      clientName,
      diagnosis: form.detalletrabajo || "Revisión técnica realizada sin observaciones.",
      solution: form.resumenTrabajo || "Servicio completado satisfactoriamente.",
      materialsUsed: editingReport ? editingReport.materialsUsed : [
        { name: "Materiales y repuestos varios", quantity: 1 }
      ],
      technicianId: editingReport ? editingReport.technicianId : "tech-001",
      technicianName: form.tecnico || "Técnico de Turno",
      createdAt: editingReport ? editingReport.createdAt : new Date().toISOString(),
      
      // Extended fields
      direccion: form.direccion,
      ubicacionRef: form.ubicacionRef,
      comuna: form.comuna,
      numeroATM: form.numeroATM,
      serieATM: form.serieATM || "",
      modeloMMBB: form.modeloMMBB,
      serieMMBB: form.serieMMBB || "",
      destinatario: form.destinatario,
      solicitante: form.solicitante,
      fechaInicio: finalFechaInicio,
      fechaFin: finalFechaFin,
      valorServicio: form.valorServicio || "",
      images: images.map(img => img.base64),
    };

    try {
      await onSave(newReport);
    } catch (e: any) {
      setSaveError('Error al guardar: ' + (e?.message || 'Intenta nuevamente'));
      setSaving(false);
    }
  };

  const handleGenerateWord = () => {
    const matchedOrder = mockWorkOrders.find(o => o.otNumber === form.otNumber);
    const clientName = matchedOrder ? matchedOrder.clientName : (form.solicitante || "Cliente General");
    const workOrderId = editingReport ? editingReport.workOrderId : (matchedOrder ? matchedOrder.id : `wo-${Date.now()}`);

    const finalFechaInicio = reportDate && startTime ? `${reportDate}T${startTime}:00` : form.fechaInicio;
    const finalFechaFin = reportDate && endTime ? `${reportDate}T${endTime}:00` : form.fechaFin;

    const currentReport: any = {
      id: editingReport ? editingReport.id : `rep-${Date.now()}`,
      workOrderId,
      otNumber: form.otNumber || `OT-${Date.now()}`,
      clientName,
      diagnosis: form.detalletrabajo || "Revisión técnica realizada sin observaciones.",
      solution: form.resumenTrabajo || "Servicio completado satisfactoriamente.",
      materialsUsed: editingReport ? editingReport.materialsUsed : [
        { name: "Materiales y repuestos varios", quantity: 1 }
      ],
      technicianId: editingReport ? editingReport.technicianId : "tech-001",
      technicianName: form.tecnico || "Técnico de Turno",
      createdAt: editingReport ? editingReport.createdAt : new Date().toISOString(),

      // Extended fields
      direccion: form.direccion,
      ubicacionRef: form.ubicacionRef,
      comuna: form.comuna,
      numeroATM: form.numeroATM,
      serieATM: form.serieATM || "",
      modeloMMBB: form.modeloMMBB,
      serieMMBB: form.serieMMBB || "",
      destinatario: form.destinatario,
      solicitante: form.solicitante,
      fechaInicio: finalFechaInicio,
      fechaFin: finalFechaFin,
      valorServicio: form.valorServicio || "",
      images: images.map(img => img.base64),
    };

    downloadReportAsWord(currentReport);
  };

  const handleGeneratePdf = () => {
    const matchedOrder = mockWorkOrders.find(o => o.otNumber === form.otNumber);
    const clientName = matchedOrder ? matchedOrder.clientName : (form.solicitante || "Cliente General");
    const workOrderId = editingReport ? editingReport.workOrderId : (matchedOrder ? matchedOrder.id : `wo-${Date.now()}`);

    const finalFechaInicio = reportDate && startTime ? `${reportDate}T${startTime}:00` : form.fechaInicio;
    const finalFechaFin = reportDate && endTime ? `${reportDate}T${endTime}:00` : form.fechaFin;

    const currentReport: any = {
      id: editingReport ? editingReport.id : `rep-${Date.now()}`,
      workOrderId,
      otNumber: form.otNumber || `OT-${Date.now()}`,
      clientName,
      diagnosis: form.detalletrabajo || "Revisión técnica realizada sin observaciones.",
      solution: form.resumenTrabajo || "Servicio completado satisfactoriamente.",
      materialsUsed: editingReport ? editingReport.materialsUsed : [
        { name: "Materiales y repuestos varios", quantity: 1 }
      ],
      technicianId: editingReport ? editingReport.technicianId : "tech-001",
      technicianName: form.tecnico || "Técnico de Turno",
      createdAt: editingReport ? editingReport.createdAt : new Date().toISOString(),

      // Extended fields
      direccion: form.direccion,
      ubicacionRef: form.ubicacionRef,
      comuna: form.comuna,
      numeroATM: form.numeroATM,
      serieATM: form.serieATM || "",
      modeloMMBB: form.modeloMMBB,
      serieMMBB: form.serieMMBB || "",
      destinatario: form.destinatario,
      solicitante: form.solicitante,
      fechaInicio: finalFechaInicio,
      fechaFin: finalFechaFin,
      valorServicio: form.valorServicio || "",
      images: images.map(img => img.base64),
    };

    downloadReportAsPdf(currentReport);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}>
      <div className="min-h-screen py-6 px-4 flex items-start justify-center">
        <div className="w-full max-w-3xl rounded-2xl overflow-hidden" style={{ background: "#1b1e24", border: "1px solid rgba(255,255,255,0.08)" }}>

          {/* Header */}
          <div className="flex items-center justify-between px-7 py-5" style={{ background: "rgba(27,30,36,0.95)", borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--primary-transparent)" }}>
                <FileText size={20} style={{ color: "var(--primary)" }} />
              </div>
              <div>
                <div className="font-bold text-lg" style={{ color: "#f1f5f9" }}>
                  {editingReport ? "Editar Informe Técnico" : "Nuevo Informe Técnico"}
                </div>
                <div className="text-xs" style={{ color: "#475569" }}>
                  {editingReport ? "Modifica los campos del informe técnico" : "Completa todos los campos requeridos para generar el informe"}
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#475569", padding: 4 }}>
              <X size={20} />
            </button>
          </div>

          {/* Form */}
          <div className="p-6">

            {/* GENERAL */}
            <FormSection icon={ClipboardList} title="General">
              <Field label="Número de OT" required>
                <Input placeholder="Ej: 12345" value={form.otNumber} onChange={set("otNumber")} />
              </Field>
            </FormSection>

            {/* UBICACIÓN */}
            <FormSection icon={MapPin} title="Ubicación">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Dirección" required>
                  <Input placeholder="Ej: Av. Principal 123" value={form.direccion} onChange={set("direccion")} />
                </Field>
                <Field label="Ubicación / Referencia">
                  <Input placeholder="Ej: Entrada principal" value={form.ubicacionRef} onChange={set("ubicacionRef")} />
                </Field>
                <Field label="Comuna" required>
                  <Input placeholder="Ej: Santiago" value={form.comuna} onChange={set("comuna")} />
                </Field>
              </div>
            </FormSection>

            {/* DATOS DEL ATM */}
            <FormSection icon={Monitor} title="Datos del ATM">
              <div className="grid grid-cols-1 gap-4">
                <Field label="Número ATM" required>
                  <Input placeholder="Ej: 00123" value={form.numeroATM} onChange={set("numeroATM")} />
                </Field>
              </div>
            </FormSection>

            {/* DATOS MMBB */}
            <FormSection icon={Cpu} title="Datos MMBB">
              <div className="grid grid-cols-1 gap-4">
                <Field label="Modelo" required>
                  <Input placeholder="Ej: Wincor Nixdorf 2550" value={form.modeloMMBB} onChange={set("modeloMMBB")} />
                </Field>
              </div>
            </FormSection>

            {/* PERSONAL */}
            <FormSection icon={User} title="Personal">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Cliente" required>
                  <Input placeholder="Ej: Banco de Chile, Santander, etc." value={form.destinatario} onChange={set("destinatario")} />
                </Field>
                <Field label="Solicitante">
                  <Input placeholder="Nombre del solicitante" value={form.solicitante} onChange={set("solicitante")} />
                </Field>
                <Field label="Técnico" required>
                  <Input placeholder="Nombre del técnico" value={form.tecnico} onChange={set("tecnico")} />
                </Field>
              </div>
            </FormSection>

            {/* PERÍODO Y SERVICIO */}
            <FormSection icon={Calendar} title="Fechas y Horarios">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Fecha" required>
                  <Input type="date" placeholder="dd-mm-aaaa" value={reportDate} onChange={setReportDate} />
                </Field>
                <Field label="Hora Inicio" required>
                  <Input type="time" placeholder="--:--" value={startTime} onChange={setStartTime} />
                </Field>
                <Field label="Hora Término" required>
                  <Input type="time" placeholder="--:--" value={endTime} onChange={setEndTime} />
                </Field>
              </div>
            </FormSection>

            {/* DESCRIPCIÓN DEL TRABAJO */}
            <FormSection icon={ClipboardList} title="Descripción del Trabajo">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Detalle del Trabajo" required>
                  <Textarea
                    placeholder="Describe en detalle el trabajo realizado..."
                    value={form.detalletrabajo}
                    onChange={set("detalletrabajo")}
                    rows={5}
                  />
                </Field>
                <Field label="Resumen del Trabajo">
                  <Textarea
                    placeholder="Resumen ejecutivo del trabajo..."
                    value={form.resumenTrabajo}
                    onChange={set("resumenTrabajo")}
                    rows={5}
                  />
                </Field>
              </div>
            </FormSection>

            {/* IMÁGENES DEL TRABAJO */}
            <FormSection icon={ImageIcon} title="Imágenes del Trabajo">
              <div>
                <label
                  htmlFor="img-upload"
                  className="border-2 border-dashed rounded-xl p-6 block text-center cursor-pointer transition-all hover:border-brand-500/40"
                  style={{ borderColor: "rgba(114,176,29,0.2)", background: "rgba(114,176,29,0.03)" }}
                >
                  <input
                    id="img-upload"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      files.forEach((file) => {
                        const objectUrl = URL.createObjectURL(file);
                        const img = new window.Image();
                        img.onload = () => {
                          // Compress: max 1400px wide/tall, JPEG quality 0.72
                          const MAX = 1400;
                          let { width, height } = img;
                          if (width > MAX || height > MAX) {
                            if (width > height) {
                              height = Math.round(height * MAX / width);
                              width = MAX;
                            } else {
                              width = Math.round(width * MAX / height);
                              height = MAX;
                            }
                          }
                          const canvas = document.createElement('canvas');
                          canvas.width = width;
                          canvas.height = height;
                          const ctx = canvas.getContext('2d')!;
                          ctx.drawImage(img, 0, 0, width, height);
                          const compressed = canvas.toDataURL('image/jpeg', 0.72);
                          setImages((prev) => [
                            ...prev,
                            { url: objectUrl, base64: compressed }
                          ]);
                        };
                        img.src = objectUrl;
                      });
                    }}
                  />
                  <ImageIcon size={28} style={{ margin: "0 auto 8px", color: "#72b01d", opacity: 0.6 }} />
                  <div style={{ color: "#72b01d", fontSize: 13, fontWeight: 600 }}>Haz clic para subir imágenes</div>
                  <div style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>PNG, JPG, HEIC · Máximo 20MB por archivo</div>
                </label>
                {images.length > 0 && (
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    {images.map((imgObj, i) => (
                      <div key={i} className="relative rounded-xl overflow-hidden" style={{ aspectRatio: "4/3", background: "#23272f" }}>
                        <img src={imgObj.url} alt={`Imagen ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setImages((prev) => prev.filter((_, j) => j !== i));
                          }}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                          style={{ background: "rgba(239,68,68,0.9)", border: "none", cursor: "pointer" }}
                        >
                          <Trash2 size={11} color="white" />
                        </button>
                        <div className="absolute bottom-1 left-1 text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(0,0,0,0.7)", color: "#94a3b8" }}>
                          #{i + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </FormSection>

            {/* Actions */}
            <div className="flex flex-col gap-3 pt-2">
              {saveError && (
                <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", color: "#f87171", fontSize: 13 }}>
                  ⚠️ {saveError}
                </div>
              )}
              <div className="flex items-center justify-between">
                <button onClick={onClose} className="btn-secondary text-sm" disabled={saving}>Cancelar</button>
                <div className="flex items-center gap-3 font-semibold">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      padding: "10px 22px", background: saving ? "#578814" : "linear-gradient(135deg, #72b01d, #578814)",
                      color: "white", borderRadius: 9, fontSize: 14, fontWeight: 700,
                      border: "none", cursor: saving ? "not-allowed" : "pointer", transition: "all 0.2s ease",
                      boxShadow: "0 4px 16px rgba(114,176,29,0.35)", fontFamily: "inherit",
                      opacity: saving ? 0.8 : 1,
                    }}
                  >
                    {saving ? (
                      <>
                        <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                        Guardando...
                      </>
                    ) : (
                      <><Save size={16} />{editingReport ? "Guardar Cambios" : "Guardar Informe"}</>
                    )}
                  </button>
                  <button
                    onClick={handleGeneratePdf}
                    disabled={saving}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      padding: "10px 22px", background: "linear-gradient(135deg, #0284c7, #0369a1)",
                      color: "white", borderRadius: 9, fontSize: 14, fontWeight: 700,
                      border: "none", cursor: "pointer", transition: "all 0.2s ease",
                      boxShadow: "0 4px 16px rgba(2,132,199,0.3)", fontFamily: "inherit",
                    }}
                  >
                    <FileText size={16} />
                    Generar PDF
                  </button>
                  <button
                    onClick={handleGenerateWord}
                    disabled={saving}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      padding: "10px 22px", background: "linear-gradient(135deg, #578814, #3d600d)",
                      color: "white", borderRadius: 9, fontSize: 14, fontWeight: 700,
                      border: "none", cursor: "pointer", transition: "all 0.2s ease",
                      boxShadow: "0 4px 16px rgba(87,136,20,0.3)", fontFamily: "inherit",
                    }}
                  >
                    <FileOutput size={16} />
                    Generar Word
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Report detail viewer ─────────────────────────────────────────────────────
function ReportViewer({ report, onClose, onEdit }: { report: TechnicalReport; onClose: () => void; onEdit: (report: TechnicalReport) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden" style={{ background: "#1b1e24", border: "1px solid rgba(255,255,255,0.08)", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between p-6" style={{ borderBottom: "1px solid rgba(114,176,29,0.12)" }}>
          <div>
            <div className="text-xs font-bold mb-1" style={{ color: "#72b01d", letterSpacing: "0.08em" }}>INFORME TÉCNICO</div>
            <h3 className="text-xl font-bold" style={{ color: "#f1f5f9" }}>{report.otNumber}</h3>
            <div className="text-sm mt-0.5" style={{ color: "#64748b" }}>{report.clientName}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => onEdit(report)} className="btn-secondary text-xs py-1.5 px-3" style={{ gap: 6 }}><Edit size={13} /> Editar</button>
            <button onClick={() => downloadReportAsWord(report)} className="btn-secondary text-xs py-1.5 px-3" style={{ gap: 6 }}><Download size={13} /> Word</button>
            <button onClick={() => downloadReportAsPdf(report)} className="btn-secondary text-xs py-1.5 px-3" style={{ gap: 6 }}><FileText size={13} /> PDF</button>
            <button className="btn-secondary text-xs py-1.5 px-3" style={{ gap: 6 }}><Send size={13} /> Enviar</button>
            <button onClick={onClose} style={{ color: "#475569", background: "none", border: "none", cursor: "pointer" }}><X size={20} /></button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Preview of report content */}
          <div className="p-4 rounded-xl" style={{ background: "rgba(114,176,29,0.04)", border: "1px solid rgba(114,176,29,0.12)" }}>
            <div className="text-xs font-bold mb-2" style={{ color: "#72b01d" }}>DIAGNÓSTICO</div>
            <p style={{ color: "#e2e8f0", fontSize: 13, lineHeight: 1.7 }}>{report.diagnosis}</p>
          </div>
          <div className="p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="text-xs font-bold mb-2" style={{ color: "#64748b" }}>SOLUCIÓN APLICADA</div>
            <p style={{ color: "#e2e8f0", fontSize: 13, lineHeight: 1.7 }}>{report.solution}</p>
          </div>
          <div className="p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="text-xs font-bold mb-3" style={{ color: "#64748b" }}>MATERIALES USADOS</div>
            <div className="space-y-1">
              {report.materialsUsed.map((m, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span style={{ color: "#cbd5e1" }}>{m.name}</span>
                  <span className="font-bold" style={{ color: "#72b01d" }}>×{m.quantity}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
            <div className="flex items-center gap-3">
              <div className="tech-avatar"><User size={14} /></div>
              <div>
                <div className="text-sm font-semibold" style={{ color: "#e2e8f0" }}>{report.technicianName}</div>
                <div className="text-xs" style={{ color: "#475569" }}>Técnico Responsable</div>
              </div>
            </div>
            <div className="text-xs flex items-center gap-1" style={{ color: "#475569" }}>
              <Clock size={11} /> {formatDateTime(report.createdAt)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [showNew, setShowNew] = useState(false);
  const [viewReport, setViewReport] = useState<TechnicalReport | null>(null);
  const [reports, setReports] = useState<TechnicalReport[]>([]);
  const [editingReport, setEditingReport] = useState<TechnicalReport | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TechnicalReport | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    const loadReports = async () => {
      try {
        const saved = await getReportsDB();
        setReports(saved);
      } catch (e) {
        console.error("Error loading reports from Supabase:", e);
        setReports([]);
      }
    };
    loadReports();
  }, []);

  const handleOpenViewer = async (reportId: string) => {
    setLoadingDetail(true);
    try {
      const full = await getReportByIdDB(reportId);
      if (full) {
        setViewReport(full);
      } else {
        alert("No se pudo cargar el detalle del informe.");
      }
    } catch (e) {
      console.error(e);
      alert("Error al cargar el detalle.");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleOpenEditor = async (reportId: string) => {
    setLoadingDetail(true);
    try {
      const full = await getReportByIdDB(reportId);
      if (full) {
        setEditingReport(full);
        setShowNew(true);
      } else {
        alert("No se pudo cargar el detalle del informe.");
      }
    } catch (e) {
      console.error(e);
      alert("Error al cargar el detalle.");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDownloadWord = async (reportId: string) => {
    setLoadingDetail(true);
    try {
      const full = await getReportByIdDB(reportId);
      if (full) {
        await downloadReportAsWord(full);
      } else {
        alert("No se pudo descargar el documento Word.");
      }
    } catch (e) {
      console.error(e);
      alert("Error al generar Word.");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDownloadPdf = async (reportId: string) => {
    setLoadingDetail(true);
    try {
      const full = await getReportByIdDB(reportId);
      if (full) {
        await downloadReportAsPdf(full);
      } else {
        alert("No se pudo descargar el PDF.");
      }
    } catch (e) {
      console.error(e);
      alert("Error al generar PDF.");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSave = async (newReport: TechnicalReport) => {
    await saveReportDB(newReport);
    setReports((prev) => {
      const exists = prev.some((r) => r.id === newReport.id);
      if (exists) {
        return prev.map((r) => r.id === newReport.id ? newReport : r);
      } else {
        const listRep = {
          ...newReport,
          images: [],
          solution: '',
          fechaInicio: '',
          fechaFin: '',
        };
        return [listRep, ...prev];
      }
    });
    setShowNew(false);
    setEditingReport(null);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteReportDB(confirmDelete.id);
      setReports((prev) => prev.filter((r) => r.id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch (e) {
      console.error('Error al eliminar informe:', e);
      alert('Error al eliminar el informe. Intenta nuevamente.');
    } finally {
      setDeleting(false);
    }
  };

  const pendingOrders = mockWorkOrders.filter(
    (o) => o.status === "finalizada" && !reports.find((r) => r.workOrderId === o.id)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="section-title">Informes Técnicos</h2>
          <p className="section-subtitle">Creación y gestión de informes de servicio en terreno</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "10px 20px", background: "linear-gradient(135deg, #72b01d, #578814)",
            color: "white", borderRadius: 9, fontSize: 13, fontWeight: 700,
            border: "none", cursor: "pointer", boxShadow: "0 4px 16px rgba(114,176,29,0.3)",
            fontFamily: "inherit", transition: "all 0.15s ease",
          }}
        >
          <Plus size={16} /> Nuevo Informe
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Informes generados", value: reports.length, color: "#72b01d" },
          { label: "Este mes", value: 1, color: "#cbd5e1" },
          { label: "Pendientes de informe", value: pendingOrders.length, color: "#f59e0b" },
          { label: "Con Word generado", value: reports.length, color: "#578814" },
        ].map((s) => (
          <div key={s.label} className="stat-card py-3">
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs font-medium mt-0.5" style={{ color: "#64748b" }}>{s.label}</div>
          </div>
        ))}
      </div>



      {/* Reports list */}
      <div className="space-y-3">
        {reports.map((r) => (
          <div key={r.id} className="glass-card p-5">
            <div className="flex flex-col md:flex-row items-start md:justify-between gap-4">
              <div className="flex items-start gap-4 w-full">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(114,176,29,0.08)", border: "1px solid rgba(114,176,29,0.15)" }}>
                  <FileText size={20} style={{ color: "#72b01d" }} />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-bold text-sm" style={{ color: "#f1f5f9" }}>{r.otNumber}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(114,176,29,0.1)", color: "#72b01d" }}>
                      ✓ Generado
                    </span>
                  </div>
                  <div className="text-xs mb-2" style={{ color: "#64748b" }}>
                    Cliente: {r.clientName} · Técnico: {r.technicianName}
                  </div>
                  <div className="text-xs leading-relaxed" style={{ color: "#94a3b8", maxWidth: 480 }}>
                    {r.diagnosis.slice(0, 130)}…
                  </div>
                  <div className="flex flex-wrap items-center gap-4 mt-3">
                    <span className="text-xs flex items-center gap-1" style={{ color: "#475569" }}>
                      <User size={10} /> {r.technicianName}
                    </span>
                    <span className="text-xs flex items-center gap-1" style={{ color: "#475569" }}>
                      <Calendar size={10} /> {formatDateTime(r.createdAt)}
                    </span>
                    <span className="text-xs flex items-center gap-1" style={{ color: "#475569" }}>
                      📦 {r.materialsUsed.length} materiales
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-row flex-wrap md:flex-col gap-2 flex-shrink-0 w-full md:w-auto mt-2 md:mt-0">
                <button onClick={() => handleOpenViewer(r.id)} className="btn-secondary text-xs py-1.5 px-3 flex-1 md:flex-none justify-center">
                  <Eye size={12} /> Ver
                </button>
                <button onClick={() => handleOpenEditor(r.id)} className="btn-secondary text-xs py-1.5 px-3 flex-1 md:flex-none justify-center">
                  <Edit size={12} /> Editar
                </button>
                <button onClick={() => handleDownloadWord(r.id)} className="btn-secondary text-xs py-1.5 px-3 flex-1 md:flex-none justify-center">
                  <Download size={12} /> Word
                </button>
                <button onClick={() => handleDownloadPdf(r.id)} className="btn-secondary text-xs py-1.5 px-3 flex-1 md:flex-none justify-center">
                  <FileText size={12} /> PDF
                </button>
                <button className="btn-secondary text-xs py-1.5 px-3 flex-1 md:flex-none justify-center">
                  <Send size={12} /> Enviar
                </button>
                <button
                  onClick={() => setConfirmDelete(r)}
                  className="text-xs py-1.5 px-3 flex-1 md:flex-none justify-center"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
                    color: "#f87171", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                    fontWeight: 600, transition: "all 0.15s ease",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.18)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(239,68,68,0.5)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.08)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(239,68,68,0.25)"; }}
                >
                  <Trash2 size={12} /> Borrar
                </button>
              </div>
            </div>
          </div>
        ))}


      </div>

      {/* ── Modal Confirmar Borrar ── */}
      {confirmDelete && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div style={{
            background: "#1b1e24", border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 16, padding: 32, maxWidth: 420, width: "100%",
            boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Trash2 size={20} style={{ color: "#f87171" }} />
              </div>
              <div>
                <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 16 }}>¿Eliminar informe?</div>
                <div style={{ color: "#64748b", fontSize: 13 }}>Esta acción no se puede deshacer</div>
              </div>
            </div>
            <div style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 10, padding: "12px 16px", marginBottom: 24,
            }}>
              <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 14 }}>OT {confirmDelete.otNumber}</div>
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
                {confirmDelete.clientName} · {confirmDelete.technicianName}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                style={{
                  padding: "9px 20px", background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8",
                  borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  padding: "9px 20px",
                  background: deleting ? "#7f1d1d" : "linear-gradient(135deg, #dc2626, #b91c1c)",
                  border: "none", color: "white", borderRadius: 9,
                  fontSize: 13, fontWeight: 700, cursor: deleting ? "not-allowed" : "pointer",
                  fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 8,
                  opacity: deleting ? 0.8 : 1,
                }}
              >
                {deleting ? (
                  <>
                    <span style={{ display: "inline-block", width: 13, height: 13, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                    Eliminando...
                  </>
                ) : (
                  <><Trash2 size={14} /> Sí, eliminar</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showNew && (
        <NewReportForm
          onClose={() => {
            setShowNew(false);
            setEditingReport(null);
          }}
          onSave={handleSave}
          editingReport={editingReport}
        />
      )}
      {viewReport && (
        <ReportViewer
          report={viewReport}
          onClose={() => setViewReport(null)}
          onEdit={(r) => {
            setViewReport(null);
            setEditingReport(r);
            setShowNew(true);
          }}
        />
      )}
      {loadingDetail && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, border: "4px solid rgba(255,255,255,0.1)", borderTopColor: "#72b01d", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <div style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 600 }}>Cargando detalles del informe...</div>
        </div>
      )}
    </div>
  );
}
