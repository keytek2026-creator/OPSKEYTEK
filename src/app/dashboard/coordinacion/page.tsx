"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import {
  Search, Calendar, Clock, MapPin, User, Building2, FileText, Tag,
  Hash, ChevronLeft, ChevronRight, X, Plus, Save, Check, Pencil, Trash2, Download
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Technician } from "@/types";
import * as XLSX from "xlsx";
import { useSearchParams } from "next/navigation";

interface ProgramacionRow {
  id: number;
  fecha: string | null;
  hora_inicio: string | null;
  hora_termino: string | null;
  categoria?: string | null;
  tipo_trabajo: string | null;
  local: string | null;
  direccion: string | null;
  atm: string | null;
  comuna: string | null;
  asignado_a: string | null;
  nombre_solicitante: string | null;
  solicitado_por: string | null;
  banco_empresa: string | null;
  informe: string | null;
  ot: string | null;
  precio_pinares?: string | null;
}

const ROWS_PER_PAGE = 25;

const BADGE_COLORS: Record<string, { bg: string; color: string }> = {
  SI:  { bg: "rgba(114,176,29,0.12)", color: "#93c947" },
  NO:  { bg: "rgba(239,68,68,0.12)",  color: "#f87171" },
  "N/A": { bg: "rgba(148,163,184,0.12)", color: "#94a3b8" },
  "": { bg: "rgba(100,116,139,0.12)", color: "#64748b" },
};

const TIPO_COLOR = (tipo: string) => {
  const t = tipo?.toLowerCase() || "";
  if (t.includes("pintura") || t.includes("pintar")) return { bg: "rgba(234,179,8,0.12)", color: "#facc15" };
  if (t.includes("camara") || t.includes("cámara") || t.includes("cctv") || t.includes("dvr")) return { bg: "rgba(14,165,233,0.12)", color: "#38bdf8" };
  if (t.includes("cerrajeria") || t.includes("cerrajería") || t.includes("cerrajero") || t.includes("chapa")) return { bg: "rgba(236,72,153,0.12)", color: "#ec4899" };
  if (t.includes("llave") || t.includes("lave")) return { bg: "rgba(168,85,247,0.12)", color: "#c084fc" };
  if (t.includes("instalacion") || t.includes("anclaje")) return { bg: "rgba(59,130,246,0.12)", color: "#60a5fa" };
  if (t.includes("supervision") || t.includes("supervisión")) return { bg: "rgba(245,158,11,0.12)", color: "#fbbf24" };
  if (t.includes("servicio") || t.includes("mantencion") || t.includes("mantención")) return { bg: "rgba(114,176,29,0.12)", color: "#93c947" };
  if (t.includes("visita")) return { bg: "rgba(139,92,246,0.12)", color: "#a78bfa" };
  return { bg: "rgba(100,116,139,0.1)", color: "#94a3b8" };
};

function CoordinacionContent() {
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("category");

  const [data, setData] = useState<ProgramacionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterBanco, setFilterBanco] = useState("all");
  const [filterInforme, setFilterInforme] = useState("all");
  const [filterTipo, setFilterTipo] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (categoryParam) {
      setFilterTipo(categoryParam.toUpperCase());
    } else {
      setFilterTipo("all");
    }
  }, [categoryParam]);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<ProgramacionRow | null>(null);
  const [formData, setFormData] = useState<Partial<ProgramacionRow>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Technician MultiSelect State
  const [techs, setTechs] = useState<Technician[]>([]);
  const [techSearch, setTechSearch] = useState("");
  const [showTechDropdown, setShowTechDropdown] = useState(false);

  const toggleTech = (name: string) => {
    let current = formData.asignado_a ? formData.asignado_a.split(",").map(s => s.trim()).filter(Boolean) : [];
    if (current.includes(name)) {
      current = current.filter(n => n !== name);
    } else {
      current.push(name);
    }
    setFormData({ ...formData, asignado_a: current.join(", ") });
  };

  const createNewTech = async () => {
    if (!techSearch.trim()) return;
    const newName = techSearch.trim();

    // Determine next techNumber
    let maxNum = 0;
    techs.forEach(t => {
      if (t.techNumber) {
        const num = parseInt(t.techNumber, 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    const nextTechNumber = String(maxNum + 1).padStart(2, '0');

    const newId = `tech-${Date.now()}`;

    // Save to Supabase
    const { data: inserted, error } = await supabase
      .from("tecnicos")
      .insert([{
        id: newId,
        tech_number: nextTechNumber,
        name: newName,
        rut: "—",
        phone: "—",
        email: "",
        region: "Metropolitana",
        vehicle: "",
        status: "disponible",
        certifications: [],
        completed_orders: 0,
        avg_time: 0,
        productivity: 0,
      }])
      .select()
      .single();

    if (error) {
      console.error("Error creando técnico:", error.message);
      return;
    }

    const newTech: Technician = {
      id: inserted.id,
      techNumber: inserted.tech_number,
      name: inserted.name,
      rut: inserted.rut || "—",
      phone: inserted.phone || "—",
      email: inserted.email || "",
      region: inserted.region || "Metropolitana",
      vehicle: inserted.vehicle || "",
      certifications: [],
      status: inserted.status || "disponible",
      completedOrders: 0,
      avgTime: 0,
      productivity: 0,
    };
    setTechs(prev => [...prev, newTech]);
    toggleTech(newName);
    setTechSearch("");
    setShowTechDropdown(false);
  };

  const fetchTechs = async () => {
    const { data: rows, error } = await supabase.from("tecnicos").select("*").order("tech_number");
    if (!error && rows) {
      setTechs(rows.map((r) => ({
        id: r.id,
        techNumber: r.tech_number,
        name: r.name,
        rut: r.rut || "—",
        phone: r.phone || "—",
        email: r.email || "",
        region: r.region || "",
        vehicle: r.vehicle || "",
        certifications: [],
        status: r.status || "disponible",
        completedOrders: 0,
        avgTime: 0,
        productivity: 0,
      })));
    }
  };

  const fetchServicios = async () => {
    setLoading(true);
    const { data: servicios, error } = await supabase
      .from("servicios")
      .select("*");
      
    if (error) {
      console.error("Error fetching servicios:", error.message);
    } else if (servicios) {
      // Ordenar: del más nuevo al más antiguo según fecha (DD-MM-YYYY)
      servicios.sort((a, b) => {
        const parseD = (d: string | null) => {
          if (!d) return 0;
          const p = d.split('-');
          if (p.length === 3) {
            let year = p[2];
            if (year.length === 2) year = `20${year}`;
            return new Date(`${year}-${p[1]}-${p[0]}`).getTime();
          }
          return 0;
        };
        const dateA = parseD(a.fecha);
        const dateB = parseD(b.fecha);
        if (dateB !== dateA) return dateB - dateA;
        return b.id - a.id;
      });
      setData(servicios);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchServicios();
    fetchTechs();
  }, []);

  const bancos = useMemo(() => {
    const set = new Set(data.map((r) => r.banco_empresa).filter(Boolean));
    return Array.from(set).sort() as string[];
  }, [data]);

  const filtered = useMemo(() => {
    return data.filter((row) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        [row.fecha, row.tipo_trabajo, row.local, row.direccion, row.atm, row.comuna,
          row.asignado_a, row.nombre_solicitante, row.banco_empresa, row.ot]
          .some((f) => (f || "").toLowerCase().includes(q));
      const matchBanco = filterBanco === "all" || row.banco_empresa === filterBanco;
      const matchInf = filterInforme === "all" || row.informe === filterInforme;
      
      let matchDate = true;
      if (dateFrom || dateTo) {
        if (!row.fecha) {
          matchDate = false;
        } else {
          const parts = row.fecha.split("-");
          if (parts.length === 3) {
            const rowDateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
            if (dateFrom && rowDateStr < dateFrom) matchDate = false;
            if (dateTo && rowDateStr > dateTo) matchDate = false;
          }
        }
      }
      let matchTipo = true;
      if (filterTipo !== "all") {
        const rowTipo = (row.tipo_trabajo || "").toLowerCase();
        if (filterTipo === "PINTURA") {
          matchTipo = rowTipo.includes("pintura") || rowTipo.includes("pintar");
        } else if (filterTipo === "CAMARAS") {
          matchTipo = rowTipo.includes("camara") || rowTipo.includes("cámara") || rowTipo.includes("cctv") || rowTipo.includes("dvr");
        } else if (filterTipo === "CERRAJERIA") {
          matchTipo = rowTipo.includes("cerrajeria") || rowTipo.includes("cerrajería") || rowTipo.includes("cerrajero") || rowTipo.includes("chapa");
        } else if (filterTipo === "LLAVES" || filterTipo === "LAVES") {
          matchTipo = rowTipo.includes("llave") || rowTipo.includes("lave");
        } else if (filterTipo === "ANCLAJE") {
          matchTipo = rowTipo.includes("anclaje") && !rowTipo.includes("supervision") && !rowTipo.includes("supervisión");
        } else if (filterTipo === "DESANCLAJE") {
          matchTipo = rowTipo.includes("desanclaje");
        } else if (filterTipo === "SUPERVISION") {
          matchTipo = rowTipo.includes("supervision") || rowTipo.includes("supervisión") || rowTipo.includes("supervicion");
        } else if (filterTipo === "MANTENCION") {
          matchTipo = rowTipo.includes("mantencion") || rowTipo.includes("mantención") || rowTipo.includes("servicio");
        } else if (filterTipo === "VISITA") {
          matchTipo = rowTipo.includes("visita");
        } else if (filterTipo === "SERVICIO ELECTRICO") {
          matchTipo = rowTipo.includes("electrico") || rowTipo.includes("eléctrico");
        }
      }
      return matchSearch && matchBanco && matchInf && matchDate && matchTipo;
    });
  }, [data, search, filterBanco, filterInforme, filterTipo, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  const resetFilters = () => {
    setSearch("");
    setFilterBanco("all");
    setFilterInforme("all");
    setFilterTipo("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const hasFilters = search || filterBanco !== "all" || filterInforme !== "all" || filterTipo !== "all" || dateFrom || dateTo;

  const downloadExcel = () => {
    if (filtered.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }
    
    const rows = filtered.map(r => {
      const rowData: any = {
        "OT": r.ot || "",
        "Fecha": r.fecha || "",
        "Hora Inicio": r.hora_inicio || "",
        "Hora Termino": r.hora_termino || "",
        "Categoría": r.categoria || r.tipo_trabajo || "",
        "Tipo de Trabajo": r.tipo_trabajo || "",
        "Local": r.local || "",
        "Direccion": r.direccion || "",
        "Comuna": r.comuna || "",
        "ATM": r.atm || "",
        "Asignado a": r.asignado_a || "",
        "Solicitante": r.nombre_solicitante || "",
        "Solicitado por": r.solicitado_por || "",
        "Banco/Empresa": r.banco_empresa || "",
        "Informe": r.informe || ""
      };
      if (filterTipo === "CERRAJERIA") {
        rowData["Precio Pinares"] = r.precio_pinares || "";
      }
      return rowData;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Coordinaciones");
    
    XLSX.writeFile(workbook, `coordinaciones_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const displayDate = (d: string | null) => {
    if (!d) return "—";
    return d;
  };

  const handleOpenCreate = () => {
    setEditingRow(null);
    setFormData({});
    setIsModalOpen(true);
  };

  const handleOpenEdit = (row: ProgramacionRow) => {
    setEditingRow(row);
    setFormData(row);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    const savePayload: any = { ...formData };
    if (savePayload.categoria) savePayload.categoria = String(savePayload.categoria).trim().toUpperCase();
    if (savePayload.tipo_trabajo) savePayload.tipo_trabajo = String(savePayload.tipo_trabajo).trim().toUpperCase();

    if (editingRow) {
      // Editar
      let { error } = await supabase
        .from("servicios")
        .update(savePayload)
        .eq("id", editingRow.id);
      
      if (error && error.code === "42703") {
        const fallback = { ...savePayload };
        delete fallback.categoria;
        const res = await supabase.from("servicios").update(fallback).eq("id", editingRow.id);
        error = res.error;
      }
      
      if (error) {
        alert(`Error al actualizar: ${error.message}`);
      } else {
        // Actualizar también en nosotros si existe el registro vinculado
        try {
          const nosotrosId = `coord-${editingRow.id}`;
          const { data: existingNosotros } = await supabase.from("nosotros").select("data").eq("id", nosotrosId).maybeSingle();
          if (existingNosotros && existingNosotros.data) {
            await supabase.from("nosotros").update({
              data: {
                ...existingNosotros.data,
                atm: formData.atm ?? existingNosotros.data.atm,
                banco: formData.banco_empresa ?? existingNosotros.data.banco,
                local: formData.local ?? existingNosotros.data.local ?? "",
                servicio: (formData.categoria || formData.tipo_trabajo) ?? existingNosotros.data.servicio
              }
            }).eq("id", nosotrosId);
          }
        } catch (err) {
          console.error("Error sincronizando actualización con nosotros:", err);
        }

        setIsModalOpen(false);
        fetchServicios();
      }
    } else {
      // Crear nuevo
      let { data: newRows, error } = await supabase
        .from("servicios")
        .insert([savePayload])
        .select();
      
      if (error && error.code === "42703") {
        const fallback = { ...savePayload };
        delete fallback.categoria;
        const res = await supabase.from("servicios").insert([fallback]).select();
        newRows = res.data;
        error = res.error;
      }
      
      if (error) {
        alert(`Error al crear: ${error.message}`);
      } else {
        // Automatically add to 'nosotros' category (cualquier servicio, no solo cerrajería)
        try {
          const insertedId = newRows && newRows[0] ? newRows[0].id : Date.now();
          const payloadNosotros = {
            atm: formData.atm || "",
            banco: formData.banco_empresa || "",
            local: formData.local || "",
            servicio: formData.categoria || formData.tipo_trabajo || "",
            carlos: 0,
            scott: 0,
            ricardo: 0,
            status: "Pendiente"
          };
          const nosotrosId = `coord-${insertedId}`;
          await supabase.from("nosotros").upsert({
            id: nosotrosId,
            data: payloadNosotros
          });
        } catch (e) {
          console.error("Error creating linked nosotros record:", e);
        }

        setIsModalOpen(false);
        fetchServicios();
        setPage(1); // Volver a primera página para ver el nuevo registro
      }
    }
    setIsSaving(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!window.confirm("¿Estás seguro de que deseas eliminar esta coordinación? Esta acción no se puede deshacer.")) {
      return;
    }
    const { error } = await supabase
      .from("servicios")
      .delete()
      .eq("id", id);
    if (error) {
      alert(`Error al eliminar: ${error.message}`);
    } else {
      // Eliminar también de la categoría Nosotros
      try {
        await supabase
          .from("nosotros")
          .delete()
          .eq("id", `coord-${id}`);
      } catch (err) {
        console.error("Error al eliminar de nosotros:", err);
      }
      fetchServicios();
    }
  };

  // Mapeo de campos para el formulario
  const formFields = [
    { key: "ot", label: "OT" },
    { key: "fecha", label: "Fecha (DD-MM-YYYY)" },
    { key: "hora_inicio", label: "Hora Inicio" },
    { key: "hora_termino", label: "Hora Término" },
    { key: "categoria", label: "Categoría" },
    { key: "tipo_trabajo", label: "Tipo de Trabajo" },
    { key: "local", label: "Local" },
    { key: "direccion", label: "Dirección" },
    { key: "comuna", label: "Comuna" },
    { key: "atm", label: "ATM" },
    { key: "asignado_a", label: "Asignado a" },
    { key: "nombre_solicitante", label: "Solicitante" },
    { key: "solicitado_por", label: "Solicitado por" },
    { key: "banco_empresa", label: "Banco/Empresa" },
    { key: "informe", label: "Informe (SI / NO)" },
    { key: "precio_pinares", label: "Precio Pinares" },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="section-title">Coordinación (Supabase)</h2>
          <p className="section-subtitle">
            {loading ? "Cargando datos desde la nube..." : `${filtered.length} de ${data.length} registros (Ordenados del más reciente al más antiguo)`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={downloadExcel}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{ background: "rgba(34,197,94,0.1)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.2)" }}
          >
            <Download size={14} />
            Exportar Excel
          </button>
          <div className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "rgba(114,176,29,0.1)", color: "#72b01d", border: "1px solid rgba(114,176,29,0.2)" }}>
            {data.length} registros totales
          </div>
          <button
            onClick={handleOpenCreate}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} />
            Nueva Coordinación
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-56">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#475569" }} />
          <input
            className="ops-input pl-9"
            placeholder="Buscar OT, local, ATM, técnico, banco..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        {/* Banco filter */}
        <select
          className="ops-select text-sm"
          value={filterBanco}
          onChange={(e) => { setFilterBanco(e.target.value); setPage(1); }}
        >
          <option value="all">Todos los bancos</option>
          {bancos.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>

        {/* Informe filter */}
        <select
          className="ops-select text-sm"
          value={filterInforme}
          onChange={(e) => { setFilterInforme(e.target.value); setPage(1); }}
        >
          <option value="all">Todos los informes</option>
          <option value="SI">Con informe (SI)</option>
          <option value="NO">Sin informe (NO)</option>
          <option value="N/A">No requiere informe (N/A)</option>
        </select>

        {/* Tipo de Trabajo filter */}
        <select
          className="ops-select text-sm"
          value={filterTipo}
          onChange={(e) => { setFilterTipo(e.target.value); setPage(1); }}
        >
          <option value="all">Todas las categorías</option>
          <option value="PINTURA">Pintura</option>
          <option value="CAMARAS">Cámaras</option>
          <option value="CERRAJERIA">Cerrajería</option>
          <option value="LLAVES">Llaves</option>
        </select>

        {/* Date filters */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="ops-input text-sm"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            title="Fecha Desde"
          />
          <span className="text-slate-400">-</span>
          <input
            type="date"
            className="ops-input text-sm"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            title="Fecha Hasta"
          />
        </div>

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg"
            style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            <X size={12} /> Limpiar
          </button>
        )}
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "rgba(27,30,36,0.9)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {(() => {
                  const headers = [
                    { label: "OT", icon: Hash },
                    { label: "Fecha", icon: Calendar },
                    { label: "Hora Inicio", icon: Clock },
                    { label: "Hora Término", icon: Clock },
                    { label: "Categoría", icon: Tag },
                    { label: "Tipo de Trabajo", icon: FileText },
                    { label: "Local", icon: MapPin },
                    { label: "Dirección", icon: MapPin },
                    { label: "Comuna", icon: MapPin },
                    { label: "ATM", icon: null },
                    { label: "Asignado a", icon: User },
                    { label: "Solicitante", icon: User },
                    { label: "Solicitado Por", icon: User },
                    { label: "Banco/Empresa", icon: Building2 },
                    { label: "Informe", icon: null },
                  ];
                  if (filterTipo === "CERRAJERIA") {
                    headers.push({ label: "Precio Pinares", icon: null });
                  }
                  headers.push({ label: "Acciones", icon: null });

                  return headers.map(({ label, icon: Icon }) => (
                    <th
                      key={label}
                      style={{
                        padding: "12px 14px",
                        textAlign: "left",
                        color: "#64748b",
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        {Icon && <Icon size={11} />}
                        {label}
                      </div>
                    </th>
                  ));
                })()}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={15} style={{ textAlign: "center", padding: 40, color: "#475569" }}>
                    Conectando con Supabase...
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={15} style={{ textAlign: "center", padding: 40, color: "#475569" }}>
                    No se encontraron registros
                  </td>
                </tr>
              ) : (
                paginated.map((row) => {
                  const tipoBadge = TIPO_COLOR(row.categoria || row.tipo_trabajo || "");
                  const informeBadge = BADGE_COLORS[row.informe?.toUpperCase() || ""] || BADGE_COLORS[""];

                  return (
                    <tr
                      key={row.id}
                      onClick={() => handleOpenEdit(row)}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        cursor: "pointer",
                        transition: "background 0.12s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(114,176,29,0.04)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      title="Haz clic para editar este registro"
                    >
                      {/* OT */}
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                        <span style={{ fontWeight: 700, color: "#72b01d", fontSize: 12 }}>
                          {row.ot || "—"}
                        </span>
                      </td>
                      {/* Fecha */}
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap", color: "#cbd5e1", fontSize: 12 }}>
                        {displayDate(row.fecha)}
                      </td>
                      {/* Hora Inicio */}
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                        <div style={{ color: "#94a3b8", fontSize: 11 }}>
                          {row.hora_inicio || "—"}
                        </div>
                      </td>
                      {/* Hora Termino */}
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                        <div style={{ color: "#94a3b8", fontSize: 11 }}>
                          {row.hora_termino || "—"}
                        </div>
                      </td>
                      {/* Categoría */}
                      <td style={{ padding: "10px 14px", maxWidth: 160 }}>
                        <span style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 600,
                          background: tipoBadge.bg,
                          color: tipoBadge.color,
                          whiteSpace: "nowrap",
                        }}>
                          {row.categoria || row.tipo_trabajo || "—"}
                        </span>
                      </td>
                      {/* Tipo de Trabajo */}
                      <td style={{ padding: "10px 14px", maxWidth: 220 }}>
                        <div style={{ color: "#e2e8f0", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.tipo_trabajo || ""}>
                          {row.tipo_trabajo || "—"}
                        </div>
                      </td>
                      {/* Local */}
                      <td style={{ padding: "10px 14px", maxWidth: 180 }}>
                        <div style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {row.local || "—"}
                        </div>
                      </td>
                      {/* Dirección */}
                      <td style={{ padding: "10px 14px", maxWidth: 180 }}>
                        <div style={{ color: "#94a3b8", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {row.direccion || "—"}
                        </div>
                      </td>
                      {/* Comuna */}
                      <td style={{ padding: "10px 14px", maxWidth: 120 }}>
                        <div style={{ color: "#94a3b8", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {row.comuna || "—"}
                        </div>
                      </td>
                      {/* ATM */}
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                        <span style={{ color: "#94a3b8", fontFamily: "monospace", fontSize: 12 }}>
                          {row.atm || "—"}
                        </span>
                      </td>
                      {/* Asignado */}
                      <td style={{ padding: "10px 14px", maxWidth: 160 }}>
                        <div style={{ color: "#e2e8f0", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {row.asignado_a || "—"}
                        </div>
                      </td>
                      {/* Solicitante */}
                      <td style={{ padding: "10px 14px", maxWidth: 150 }}>
                        <div style={{ color: "#94a3b8", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {row.nombre_solicitante || "—"}
                        </div>
                      </td>
                      {/* Solicitado Por */}
                      <td style={{ padding: "10px 14px", maxWidth: 120 }}>
                        <div style={{ color: "#94a3b8", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {row.solicitado_por || "—"}
                        </div>
                      </td>
                      {/* Banco */}
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                        <span style={{ color: "#94a3b8", fontSize: 12 }}>{row.banco_empresa || "—"}</span>
                      </td>
                      {/* Informe */}
                      <td style={{ padding: "10px 14px", textAlign: "center" }}>
                        <span style={{
                          display: "inline-block",
                          padding: "2px 10px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                          background: informeBadge.bg,
                          color: informeBadge.color,
                        }}>
                          {row.informe || "—"}
                        </span>
                      </td>
                      {/* Precio Pinares */}
                      {filterTipo === "CERRAJERIA" && (
                        <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                          <span style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 500 }}>
                            {row.precio_pinares || "—"}
                          </span>
                        </td>
                      )}
                      {/* Acciones */}
                      <td style={{ padding: "10px 14px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleOpenEdit(row); }}
                            style={{
                              background: "rgba(114,176,29,0.1)",
                              color: "#72b01d",
                              border: "1px solid rgba(114,176,29,0.2)",
                              borderRadius: "6px",
                              padding: "4px 8px",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "11px",
                              fontWeight: 600,
                            }}
                          >
                            <Pencil size={12} /> Editar
                          </button>
                          <button
                            onClick={(e) => handleDelete(e, row.id)}
                            style={{
                              background: "rgba(239,68,68,0.1)",
                              color: "#ef4444",
                              border: "1px solid rgba(239,68,68,0.2)",
                              borderRadius: "6px",
                              padding: "4px 8px",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "11px",
                              fontWeight: 600,
                            }}
                            title="Eliminar registro"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderTop: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <span style={{ color: "#475569", fontSize: 12 }}>
            Página {page} de {totalPages} · {filtered.length} registros
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                padding: "6px 10px",
                borderRadius: 7,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                color: page === 1 ? "#334155" : "#94a3b8",
                cursor: page === 1 ? "not-allowed" : "pointer",
                fontSize: 12,
              }}
            >
              <ChevronLeft size={14} />
            </button>
            {/* Page numbers */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              const p = start + i;
              if (p > totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 7,
                    border: `1px solid ${p === page ? "rgba(114,176,29,0.4)" : "rgba(255,255,255,0.08)"}`,
                    background: p === page ? "rgba(114,176,29,0.12)" : "rgba(255,255,255,0.03)",
                    color: p === page ? "#93c947" : "#64748b",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: p === page ? 700 : 400,
                  }}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{
                padding: "6px 10px",
                borderRadius: 7,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                color: page === totalPages ? "#334155" : "#94a3b8",
                cursor: page === totalPages ? "not-allowed" : "pointer",
                fontSize: 12,
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
        >
          <div
            className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
            style={{ background: "#1b1e24", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between p-5 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div>
                <div style={{ color: "#f1f5f9", fontSize: 16, fontWeight: 700 }}>
                  {editingRow ? `Editar Coordinación #${editingRow.ot || editingRow.id}` : "Nueva Coordinación"}
                </div>
                <div style={{ color: "#475569", fontSize: 12, marginTop: 2 }}>
                  {editingRow ? "Modifica los campos del registro seleccionado." : "Ingresa los datos para el nuevo registro."}
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#475569" }}>
                <X size={20} />
              </button>
            </div>

            {/* Modal body (scrollable) */}
            <div className="p-5 overflow-y-auto" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              {formFields.filter(f => f.key !== "precio_pinares" || filterTipo === "CERRAJERIA").map(f => (
                <div key={f.key} className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pl-1">
                    {f.label}
                  </label>
                  {f.key === "asignado_a" ? (
                    <div className="relative">
                      <div 
                        className="ops-input min-h-[42px] flex flex-wrap gap-2 items-center cursor-text"
                        onClick={() => setShowTechDropdown(true)}
                      >
                        {formData.asignado_a && formData.asignado_a.split(",").map(s => s.trim()).filter(Boolean).map(t => (
                          <span key={t} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold" style={{ background: "rgba(114,176,29,0.15)", color: "#93c947", border: "1px solid rgba(114,176,29,0.3)" }}>
                            {t}
                            <button onClick={(e) => { e.stopPropagation(); toggleTech(t); }} style={{ background: "none", border: "none", color: "#93c947", cursor: "pointer", display: "flex", alignItems: "center" }}>
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                        <input 
                          placeholder={formData.asignado_a ? "" : "Buscar o crear..."}
                          value={techSearch}
                          onChange={(e) => { setTechSearch(e.target.value); setShowTechDropdown(true); }}
                          onFocus={() => setShowTechDropdown(true)}
                          style={{ background: "transparent", border: "none", outline: "none", color: "#e2e8f0", fontSize: 13, flex: 1, minWidth: 100 }}
                        />
                      </div>
                      
                      {showTechDropdown && (
                        <div className="mt-1 rounded-xl shadow-xl max-h-48 overflow-y-auto w-full" style={{ background: "#23272f", border: "1px solid rgba(255,255,255,0.1)" }}>
                          <div className="flex justify-end p-1 sticky top-0 bg-[#23272f]">
                            <button onClick={() => setShowTechDropdown(false)} className="text-slate-400 hover:text-white"><X size={14} /></button>
                          </div>
                          {techs.filter(t => t.name.toLowerCase().includes(techSearch.toLowerCase()) || t.techNumber?.includes(techSearch)).map(tech => {
                            const isSelected = (formData.asignado_a || "").includes(tech.name);
                            return (
                              <button
                                key={tech.id}
                                type="button"
                                onClick={() => { toggleTech(tech.name); setTechSearch(""); }}
                                className="w-full flex items-center justify-between px-3 py-2 text-left text-xs hover:bg-white/5 transition-colors"
                                style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                              >
                                <div className="flex items-center gap-2">
                                  {tech.techNumber && <span style={{ color: "#72b01d", fontWeight: 700 }}>#{tech.techNumber}</span>}
                                  <span style={{ color: isSelected ? "#93c947" : "#e2e8f0" }}>{tech.name}</span>
                                </div>
                                {isSelected && <Check size={14} style={{ color: "#93c947" }} />}
                              </button>
                            );
                          })}
                          {techSearch.trim() !== "" && !techs.some(t => t.name.toLowerCase() === techSearch.trim().toLowerCase()) && (
                            <button
                              type="button"
                              onClick={createNewTech}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-white/5 transition-colors"
                              style={{ color: "#f59e0b", borderTop: "1px solid rgba(255,255,255,0.06)" }}
                            >
                              <Plus size={14} /> Crear nuevo: <b>{techSearch.trim()}</b>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : f.key === "categoria" ? (
                    <div className="space-y-1.5">
                      <select
                        className="ops-select"
                        value={
                          ["PINTURA", "CAMARAS", "CERRAJERIA", "LLAVES"]
                            .includes((formData.categoria || "").toUpperCase())
                            ? (formData.categoria || "").toUpperCase()
                            : (formData.categoria ? "OTRO" : "")
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "OTRO") {
                            if (["PINTURA", "CAMARAS", "CERRAJERIA", "LLAVES"].includes((formData.categoria || "").toUpperCase())) {
                              setFormData({ ...formData, categoria: "" });
                            }
                          } else {
                            setFormData({ ...formData, categoria: val });
                          }
                        }}
                      >
                        <option value="">Selecciona categoría...</option>
                        <option value="PINTURA">Pintura</option>
                        <option value="CAMARAS">Cámaras</option>
                        <option value="CERRAJERIA">Cerrajería</option>
                        <option value="LLAVES">Llaves</option>
                        <option value="OTRO">Otro (Personalizado...)</option>
                      </select>
                      {(!["PINTURA", "CAMARAS", "CERRAJERIA", "LLAVES"].includes((formData.categoria || "").toUpperCase()) && formData.categoria !== undefined && formData.categoria !== "") && (
                        <input
                          className="ops-input text-xs"
                          placeholder="Escribe categoría personalizada..."
                          value={formData.categoria || ""}
                          onChange={(e) => setFormData({ ...formData, categoria: e.target.value.toUpperCase() })}
                        />
                      )}
                    </div>
                  ) : f.key === "tipo_trabajo" ? (
                    <input
                      className="ops-input"
                      placeholder="Ej: Cambio de cerradura, pintura de muro..."
                      value={formData.tipo_trabajo || ""}
                      onChange={(e) => setFormData({ ...formData, tipo_trabajo: e.target.value.toUpperCase() })}
                    />
                  ) : f.key === "informe" ? (
                    <select
                      className="ops-select"
                      value={formData.informe || ""}
                      onChange={(e) => setFormData({ ...formData, informe: e.target.value })}
                    >
                      <option value="">Selecciona opción...</option>
                      <option value="SI">SI</option>
                      <option value="NO">NO</option>
                      <option value="N/A">N/A</option>
                    </select>
                  ) : (
                    <input
                      className="ops-input"
                      placeholder={`Ingresa ${f.label.toLowerCase()}`}
                      value={formData[f.key as keyof ProgramacionRow] || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({ ...formData, [f.key]: val });
                      }}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Modal footer */}
            <div className="p-5 shrink-0 flex justify-end gap-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.2)" }}>
              <button
                className="btn-secondary"
                onClick={() => setIsModalOpen(false)}
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button
                className="btn-primary flex items-center gap-2"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  "Guardando..."
                ) : (
                  <>
                    <Save size={16} />
                    {editingRow ? "Guardar Cambios" : "Crear Registro"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CoordinacionPage() {
  return (
    <Suspense fallback={<div className="glass-card p-12 text-center text-[#64748b]">Cargando Coordinación...</div>}>
      <CoordinacionContent />
    </Suspense>
  );
}
