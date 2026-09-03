"use client";

import { useState, useEffect } from "react";
import { 
  Heart, Plus, Edit2, Trash2, Search, X, DollarSign, Loader2, 
  HelpCircle, CheckCircle2, UserCheck, AlertTriangle
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface NosotrosRecord {
  id: string;
  atm: string;
  banco: string;
  local?: string;
  servicio: string;
  fecha?: string;
  carlos: number;
  scott: number;
  ricardo: number;
  status: string;
  createdAt?: string;
}

// Datos semilla basados en el Excel YO.xlsx
const SEED_DATA: NosotrosRecord[] = [
  { id: "seed-1", atm: "164", banco: "Banco de Chile", local: "Casa Matriz", servicio: "Cerrajería", carlos: 110000, scott: 110000, ricardo: 100000, status: "Completado" },
  { id: "seed-2", atm: "269", banco: "Scotiabank", local: "Sucursal Providencia", servicio: "Cerrajería", carlos: 110000, scott: 110000, ricardo: 100000, status: "Completado" },
  { id: "seed-3", atm: "243", banco: "Scotiabank", local: "Sucursal Las Condes", servicio: "Cerrajería", carlos: 110000, scott: 110000, ricardo: 100000, status: "Completado" },
  { id: "seed-4", atm: "1753", banco: "Santander", local: "Sucursal Santiago Centro", servicio: "Cerrajería", carlos: 100000, scott: 100000, ricardo: 100000, status: "Completado" }
];

export default function NosotrosPage() {
  const [records, setRecords] = useState<NosotrosRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterMes, setFilterMes] = useState("todos");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<NosotrosRecord | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form states
  const [atm, setAtm] = useState("");
  const [banco, setBanco] = useState("");
  const [local, setLocal] = useState("");
  const [servicio, setServicio] = useState("Cerrajería");
  const [carlos, setCarlos] = useState(0);
  const [scott, setScott] = useState(0);
  const [ricardo, setRicardo] = useState(0);
  const [status, setStatus] = useState("Completado");

  // Fetch records
  const fetchRecords = async () => {
    try {
      setLoading(true);
      const [nosotrosRes, serviciosRes] = await Promise.all([
        supabase
          .from("nosotros")
          .select("*")
          .order("created_at", { ascending: true }),
        supabase
          .from("servicios")
          .select("id, local, atm, banco_empresa, fecha")
      ]);

      const { data, error } = nosotrosRes;

      if (error) {
        // Si la tabla no existe en la base de datos (error 42P01)
        if (error.code === "42P01") {
          console.warn("La tabla 'nosotros' no existe en Supabase. Cargando datos semilla locales.");
          setRecords(SEED_DATA);
          setDbError("La tabla 'nosotros' no existe en Supabase. Asegúrate de ejecutar el script SQL provisto. Mostrando datos locales temporales.");
        } else {
          throw error;
        }
      } else if (data && data.length > 0) {
        // Map de servicios de coordinación para enriquecer el local si no viene en el registro
        const serviciosList = serviciosRes.data || [];
        const coordMap = new Map<string, string>();
        const atmMap = new Map<string, string>();
        const fechaCoordMap = new Map<string, string>();
        const fechaAtmMap = new Map<string, string>();

        serviciosList.forEach((s: any) => {
          if (s.id && s.local) coordMap.set(`coord-${s.id}`, s.local);
          if (s.atm && s.local) atmMap.set(String(s.atm).trim().toLowerCase(), s.local);
          if (s.id && s.fecha) fechaCoordMap.set(`coord-${s.id}`, s.fecha);
          if (s.atm && s.fecha) fechaAtmMap.set(String(s.atm).trim().toLowerCase(), s.fecha);
        });

        const mapped: NosotrosRecord[] = data.map((r: any) => {
          let localVal = r.data.local ?? "";
          if (!localVal) {
            if (coordMap.has(r.id)) {
              localVal = coordMap.get(r.id) || "";
            } else if (r.data.atm && atmMap.has(String(r.data.atm).trim().toLowerCase())) {
              localVal = atmMap.get(String(r.data.atm).trim().toLowerCase()) || "";
            }
          }
          // Fecha desde servicios
          let fechaVal = r.data.fecha ?? "";
          if (!fechaVal) {
            if (fechaCoordMap.has(r.id)) {
              fechaVal = fechaCoordMap.get(r.id) || "";
            } else if (r.data.atm && fechaAtmMap.has(String(r.data.atm).trim().toLowerCase())) {
              fechaVal = fechaAtmMap.get(String(r.data.atm).trim().toLowerCase()) || "";
            }
          }
          return {
            id: r.id,
            atm: r.data.atm ?? "",
            banco: r.data.banco ?? "",
            local: localVal,
            servicio: r.data.servicio ?? "",
            fecha: fechaVal,
            carlos: Number(r.data.carlos ?? 0),
            scott: Number(r.data.scott ?? 0),
            ricardo: Number(r.data.ricardo ?? 0),
            status: r.data.status ?? "",
            createdAt: r.created_at
          };
        });
        setRecords(mapped);
        setDbError(null);
      } else {
        // Si está vacía pero la tabla existe, insertamos las semillas automáticamente para comenzar
        console.log("Tabla 'nosotros' vacía. Insertando datos semilla.");
        for (const item of SEED_DATA) {
          await supabase.from("nosotros").insert({
            id: item.id,
            data: {
              atm: item.atm,
              banco: item.banco,
              local: item.local,
              servicio: item.servicio,
              carlos: item.carlos,
              scott: item.scott,
              ricardo: item.ricardo,
              status: item.status
            }
          });
        }
        setRecords(SEED_DATA);
        setDbError(null);
      }
    } catch (e: any) {
      console.error("Error cargando base de datos:", e);
      setDbError(`Error al conectar con la base de datos: ${e.message || e}`);
      setRecords(SEED_DATA); // Fallback a local
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openNewModal = () => {
    setEditingRecord(null);
    setAtm("");
    setBanco("");
    setLocal("");
    setServicio("Cerrajería");
    setCarlos(0);
    setScott(0);
    setRicardo(0);
    setStatus("Completado");
    setIsModalOpen(true);
  };

  const openEditModal = (rec: NosotrosRecord) => {
    setEditingRecord(rec);
    setAtm(rec.atm);
    setBanco(rec.banco);
    setLocal(rec.local || "");
    setServicio(rec.servicio);
    setCarlos(rec.carlos);
    setScott(rec.scott);
    setRicardo(rec.ricardo);
    setStatus(rec.status);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!atm || !banco || !servicio) return;

    const payload: Omit<NosotrosRecord, "id"> = {
      atm,
      banco,
      local,
      servicio,
      carlos: Number(carlos),
      scott: Number(scott),
      ricardo: Number(ricardo),
      status
    };

    const id = editingRecord ? editingRecord.id : `rec-${Date.now()}`;

    try {
      // Guardar localmente
      if (editingRecord) {
        setRecords(prev => prev.map(r => r.id === id ? { ...r, ...payload } : r));
      } else {
        setRecords(prev => [...prev, { id, ...payload }]);
      }

      // Guardar en Supabase
      const { error } = await supabase.from("nosotros").upsert({
        id,
        data: payload
      });

      if (error && error.code !== "42P01") {
        throw error;
      }
    } catch (err: any) {
      console.error("Error guardando registro:", err);
      alert("Se guardó en la pantalla, pero hubo un problema al sincronizar con la base de datos.");
    } finally {
      setIsModalOpen(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setRecords(prev => prev.filter(r => r.id !== id));
      const { error } = await supabase.from("nosotros").delete().eq("id", id);
      if (error && error.code !== "42P01") throw error;
    } catch (err) {
      console.error("Error eliminando registro:", err);
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const isCompletado = (s: string) => (s || "").trim().toLowerCase() === "completado";

  const handleToggleStatus = async (record: NosotrosRecord) => {
    const newStatus = isCompletado(record.status) ? "Pendiente" : "Completado";
    const updated = { ...record, status: newStatus };
    setRecords(prev => prev.map(r => r.id === record.id ? updated : r));
    try {
      await supabase.from("nosotros").upsert({
        id: record.id,
        data: {
          atm: record.atm,
          banco: record.banco,
          local: record.local || "",
          servicio: record.servicio,
          carlos: record.carlos,
          scott: record.scott,
          ricardo: record.ricardo,
          status: newStatus
        }
      });
    } catch (e) {
      console.error("Error actualizando estado:", e);
    }
  };

  // Acumulados monetarios globales (solo completados)
  const totalCarlos = records.reduce((sum, r) => isCompletado(r.status) ? sum + Number(r.carlos || 0) : sum, 0);
  const totalScott = records.reduce((sum, r) => isCompletado(r.status) ? sum + Number(r.scott || 0) : sum, 0);
  const totalRicardo = records.reduce((sum, r) => isCompletado(r.status) ? sum + Number(r.ricardo || 0) : sum, 0);

  // Pendientes globales
  const pendingCarlos = records.reduce((sum, r) => !isCompletado(r.status) ? sum + Number(r.carlos || 0) : sum, 0);
  const pendingScott = records.reduce((sum, r) => !isCompletado(r.status) ? sum + Number(r.scott || 0) : sum, 0);
  const pendingRicardo = records.reduce((sum, r) => !isCompletado(r.status) ? sum + Number(r.ricardo || 0) : sum, 0);

  const fmtCLP = (n: number) => {
    return "$ " + n.toLocaleString("es-CL");
  };

  // Parsea fecha en formato DD-MM-YYYY o YYYY-MM-DD y retorna "YYYY-MM" para filtrar por mes
  const getMesKey = (fecha: string | undefined): string => {
    if (!fecha) return "";
    // Formato DD-MM-YYYY
    const ddmmyyyy = fecha.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}`;
    // Formato YYYY-MM-DD
    const yyyymmdd = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (yyyymmdd) return `${yyyymmdd[1]}-${yyyymmdd[2]}`;
    return "";
  };

  // Meses disponibles para el filtro (solo los que tienen datos)
  const mesesDisponibles = Array.from(
    new Set(records.map(r => getMesKey(r.fecha)).filter(Boolean))
  ).sort().reverse();

  const MESES_ES: Record<string, string> = {
    "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
    "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
    "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre"
  };

  const formatMesLabel = (mesKey: string) => {
    const [anio, mes] = mesKey.split("-");
    return `${MESES_ES[mes] || mes} ${anio}`;
  };

  const filteredRecords = records.filter(r => {
    const matchSearch =
      r.banco.toLowerCase().includes(search.toLowerCase()) ||
      r.atm.toLowerCase().includes(search.toLowerCase()) ||
      (r.local || "").toLowerCase().includes(search.toLowerCase()) ||
      r.servicio.toLowerCase().includes(search.toLowerCase());
    const matchMes = filterMes === "todos" || getMesKey(r.fecha) === filterMes;
    return matchSearch && matchMes;
  });

  // Totales de la tabla visible
  const filteredCompletedCarlos = filteredRecords.reduce((sum, r) => isCompletado(r.status) ? sum + Number(r.carlos || 0) : sum, 0);
  const filteredCompletedScott = filteredRecords.reduce((sum, r) => isCompletado(r.status) ? sum + Number(r.scott || 0) : sum, 0);
  const filteredCompletedRicardo = filteredRecords.reduce((sum, r) => isCompletado(r.status) ? sum + Number(r.ricardo || 0) : sum, 0);

  const filteredPendingCarlos = filteredRecords.reduce((sum, r) => !isCompletado(r.status) ? sum + Number(r.carlos || 0) : sum, 0);
  const filteredPendingScott = filteredRecords.reduce((sum, r) => !isCompletado(r.status) ? sum + Number(r.scott || 0) : sum, 0);
  const filteredPendingRicardo = filteredRecords.reduce((sum, r) => !isCompletado(r.status) ? sum + Number(r.ricardo || 0) : sum, 0);

  const hasPendingFiltered = (filteredPendingCarlos + filteredPendingScott + filteredPendingRicardo) > 0;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-100" style={{ background: "#121418" }}>
      
      {/* Alerta de Tabla no creada */}
      {dbError && (
        <div className="p-4 rounded-xl flex items-start gap-3 border" style={{ background: "rgba(245,158,11,0.06)", borderColor: "rgba(245,158,11,0.2)" }}>
          <AlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={18} />
          <div>
            <div className="font-bold text-amber-500 text-sm">Nota de Conectividad</div>
            <div className="text-xs text-slate-400 mt-0.5">{dbError}</div>
          </div>
        </div>
      )}

      {/* ── SECCIÓN SUPERIOR: TARJETAS DE ACUMULADOS ─────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Tarjeta Carlos */}
        <div className="relative p-6 rounded-2xl flex flex-col justify-between overflow-hidden border border-slate-800"
          style={{ background: "linear-gradient(135deg, #1b263b 0%, #121a2e 100%)" }}>
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <UserCheck size={80} className="text-sky-400" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs font-extrabold text-sky-400 tracking-wider uppercase">Acumulado Carlos</div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-300 font-bold border border-sky-500/20">Completados</span>
            </div>
            <div className="text-3xl font-extrabold tracking-tight text-white">{fmtCLP(totalCarlos)}</div>
            {pendingCarlos > 0 && (
              <div className="text-xs font-semibold text-amber-400 mt-1 flex items-center gap-1">
                <span>⏳ +{fmtCLP(pendingCarlos)} pendientes</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 mt-4 text-[11px] text-sky-300 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
            Asignado a Trabajos en Terreno
          </div>
        </div>

        {/* Tarjeta Scott */}
        <div className="relative p-6 rounded-2xl flex flex-col justify-between overflow-hidden border border-slate-800"
          style={{ background: "linear-gradient(135deg, #1d352d 0%, #11221b 100%)" }}>
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <UserCheck size={80} className="text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs font-extrabold text-emerald-400 tracking-wider uppercase">Acumulado Scott</div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 font-bold border border-emerald-500/20">Completados</span>
            </div>
            <div className="text-3xl font-extrabold tracking-tight text-white">{fmtCLP(totalScott)}</div>
            {pendingScott > 0 && (
              <div className="text-xs font-semibold text-amber-400 mt-1 flex items-center gap-1">
                <span>⏳ +{fmtCLP(pendingScott)} pendientes</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 mt-4 text-[11px] text-emerald-300 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Asignado a Coordinación y Control
          </div>
        </div>

        {/* Tarjeta Ricardo */}
        <div className="relative p-6 rounded-2xl flex flex-col justify-between overflow-hidden border border-slate-800"
          style={{ background: "linear-gradient(135deg, #2b2b35 0%, #1d1d24 100%)" }}>
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <UserCheck size={80} className="text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs font-extrabold text-indigo-400 tracking-wider uppercase">Acumulado Ricardo</div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 font-bold border border-indigo-500/20">Completados</span>
            </div>
            <div className="text-3xl font-extrabold tracking-tight text-white">{fmtCLP(totalRicardo)}</div>
            {pendingRicardo > 0 && (
              <div className="text-xs font-semibold text-amber-400 mt-1 flex items-center gap-1">
                <span>⏳ +{fmtCLP(pendingRicardo)} pendientes</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 mt-4 text-[11px] text-indigo-300 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            Asignado a Operaciones Generales
          </div>
        </div>

      </div>

      {/* ── TOOLBAR / CONTROLES DE TABLA ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
        
        {/* Buscador */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            placeholder="Buscar por banco, ATM o tipo de servicio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-sm border focus:outline-none transition-all"
            style={{ 
              background: "#1b1e24", 
              borderColor: "rgba(255,255,255,0.05)",
              color: "#e2e8f0"
            }}
          />
        </div>

        {/* Filtro por Mes */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap">📅 Mes:</span>
          <select
            value={filterMes}
            onChange={(e) => setFilterMes(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm border focus:outline-none transition-all"
            style={{
              background: "#1b1e24",
              borderColor: filterMes !== "todos" ? "rgba(114,176,29,0.5)" : "rgba(255,255,255,0.05)",
              color: filterMes !== "todos" ? "#93c947" : "#e2e8f0",
              fontWeight: filterMes !== "todos" ? 700 : 400,
            }}
          >
            <option value="todos">Todos los meses</option>
            {mesesDisponibles.map(m => (
              <option key={m} value={m}>{formatMesLabel(m)}</option>
            ))}
          </select>
          {filterMes !== "todos" && (
            <button
              onClick={() => setFilterMes("todos")}
              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer border-none bg-transparent"
              title="Limpiar filtro"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Botón Nuevo Registro */}
        <button
          onClick={openNewModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-lg hover:shadow-brand-500/10 cursor-pointer border-none"
          style={{ background: "#1F497D" }}
        >
          <Plus size={16} />
          Nuevo Registro
        </button>
      </div>

      {/* ── SECCIÓN CENTRAL: TABLA DE DATOS ──────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-800 overflow-hidden" style={{ background: "#1b1e24" }}>
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-sky-500" size={28} />
            <div className="text-sm text-slate-400">Cargando base de datos...</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">ATM</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Banco</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Local</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Servicio</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-sky-400 uppercase tracking-wider">Carlos</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-emerald-400 uppercase tracking-wider">Scott</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-indigo-400 uppercase tracking-wider">Ricardo</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-300 uppercase tracking-wider">Total (Fila)</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-wider w-24">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-12 text-center text-slate-500 text-sm">
                      No se encontraron registros que coincidan con la búsqueda.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r) => {
                    const rowTotal = r.carlos + r.scott + r.ricardo;
                    const completado = isCompletado(r.status);
                    return (
                      <tr key={r.id} className="hover:bg-white/[0.01] transition-colors border-b border-slate-800/40">
                        <td className="px-6 py-3.5 text-sm text-slate-400 whitespace-nowrap font-mono">{r.fecha || "—"}</td>
                        <td className="px-6 py-3.5 text-sm font-semibold text-slate-200">{r.atm}</td>
                        <td className="px-6 py-3.5 text-sm text-slate-300 font-medium">{r.banco}</td>
                        <td className="px-6 py-3.5 text-sm text-slate-300 font-medium">{r.local || "-"}</td>
                        <td className="px-6 py-3.5 text-sm text-slate-400">{r.servicio}</td>
                        <td className={`px-6 py-3.5 text-sm text-right font-mono ${completado ? "text-sky-300" : "text-slate-400"}`}>{fmtCLP(r.carlos)}</td>
                        <td className={`px-6 py-3.5 text-sm text-right font-mono ${completado ? "text-emerald-300" : "text-slate-400"}`}>{fmtCLP(r.scott)}</td>
                        <td className={`px-6 py-3.5 text-sm text-right font-mono ${completado ? "text-indigo-300" : "text-slate-400"}`}>{fmtCLP(r.ricardo)}</td>
                        <td className="px-6 py-3.5 text-sm text-right text-white font-bold font-mono">{fmtCLP(rowTotal)}</td>
                        <td className="px-6 py-3.5 text-sm text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(r)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border hover:scale-105 active:scale-95"
                            style={{
                              background: completado ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)",
                              color: completado ? "#34d399" : "#fbbf24",
                              borderColor: completado ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)",
                            }}
                            title={`Estado: ${r.status || "Pendiente"}. Clic para cambiar a ${completado ? "Pendiente" : "Completado"}`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: completado ? "#34d399" : "#fbbf24" }} />
                            {r.status || "Pendiente"}
                          </button>
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openEditModal(r)}
                              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer border-none bg-transparent"
                              title="Editar"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(r.id)}
                              className="p-1.5 rounded-lg hover:bg-red-500/15 text-slate-400 hover:text-red-400 transition-colors cursor-pointer border-none bg-transparent"
                              title="Eliminar"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
                
                {/* FILA DE TOTALES GENERALES (COMPLETADOS) */}
                {filteredRecords.length > 0 && (
                  <>
                    <tr style={{ background: "rgba(255,255,255,0.03)" }} className="font-bold border-t-2 border-slate-700">
                      <td colSpan={5} className="px-6 py-3 text-xs font-extrabold text-emerald-400 uppercase tracking-wider text-left">
                        TOTALES (COMPLETADOS)
                      </td>
                      <td className="px-6 py-3 text-sm text-right text-sky-400 font-mono">{fmtCLP(filteredCompletedCarlos)}</td>
                      <td className="px-6 py-3 text-sm text-right text-emerald-400 font-mono">{fmtCLP(filteredCompletedScott)}</td>
                      <td className="px-6 py-3 text-sm text-right text-indigo-400 font-mono">{fmtCLP(filteredCompletedRicardo)}</td>
                      <td className="px-6 py-3 text-base text-right text-emerald-400 font-extrabold font-mono" style={{ borderLeft: "1px solid rgba(255,255,255,0.05)" }}>
                        {fmtCLP(filteredCompletedCarlos + filteredCompletedScott + filteredCompletedRicardo)}
                      </td>
                      <td colSpan={2} className="text-[11px] text-center text-slate-400">Sumado al balance</td>
                    </tr>

                    {/* FILA DE TOTALES PENDIENTES SI EXISTEN */}
                    {hasPendingFiltered && (
                      <>
                        <tr style={{ background: "rgba(245,158,11,0.03)" }} className="font-semibold text-xs border-t border-slate-800">
                          <td colSpan={5} className="px-6 py-2.5 text-xs font-bold text-amber-400 uppercase tracking-wider text-left">
                            TOTALES (PENDIENTES)
                          </td>
                          <td className="px-6 py-2.5 text-sm text-right text-amber-300/80 font-mono">{fmtCLP(filteredPendingCarlos)}</td>
                          <td className="px-6 py-2.5 text-sm text-right text-amber-300/80 font-mono">{fmtCLP(filteredPendingScott)}</td>
                          <td className="px-6 py-2.5 text-sm text-right text-amber-300/80 font-mono">{fmtCLP(filteredPendingRicardo)}</td>
                          <td className="px-6 py-2.5 text-sm text-right text-amber-400 font-bold font-mono" style={{ borderLeft: "1px solid rgba(255,255,255,0.05)" }}>
                            {fmtCLP(filteredPendingCarlos + filteredPendingScott + filteredPendingRicardo)}
                          </td>
                          <td colSpan={2} className="text-[10px] text-center text-amber-400/80">Haz clic en "Pendiente" para completar</td>
                        </tr>

                        <tr style={{ background: "rgba(255,255,255,0.05)" }} className="font-bold border-t border-slate-700">
                          <td colSpan={5} className="px-6 py-3 text-xs font-extrabold text-white uppercase tracking-wider text-left">
                            GRAN TOTAL (TODOS LOS REGISTROS)
                          </td>
                          <td className="px-6 py-3 text-sm text-right text-slate-200 font-mono">{fmtCLP(filteredCompletedCarlos + filteredPendingCarlos)}</td>
                          <td className="px-6 py-3 text-sm text-right text-slate-200 font-mono">{fmtCLP(filteredCompletedScott + filteredPendingScott)}</td>
                          <td className="px-6 py-3 text-sm text-right text-slate-200 font-mono">{fmtCLP(filteredCompletedRicardo + filteredPendingRicardo)}</td>
                          <td className="px-6 py-3 text-base text-right text-white font-extrabold font-mono" style={{ borderLeft: "1px solid rgba(255,255,255,0.05)" }}>
                            {fmtCLP(filteredCompletedCarlos + filteredCompletedScott + filteredCompletedRicardo + filteredPendingCarlos + filteredPendingScott + filteredPendingRicardo)}
                          </td>
                          <td colSpan={2}></td>
                        </tr>
                      </>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL FORMULARIO: REGISTRAR / EDITAR ─────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden border border-slate-800 shadow-2xl" style={{ background: "#1b1e24" }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h3 className="font-bold text-base text-slate-200">
                {editingRecord ? "Editar Registro" : "Nuevo Registro de Servicio"}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-slate-400 hover:text-white transition-colors cursor-pointer border-none bg-transparent"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              
              <div className="grid grid-cols-3 gap-3">
                {/* ATM */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">ID ATM</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: 164"
                    value={atm}
                    onChange={(e) => setAtm(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-sm border focus:outline-none focus:border-sky-500 transition-colors"
                    style={{ background: "#121418", borderColor: "rgba(255,255,255,0.05)", color: "#f1f5f9" }}
                  />
                </div>

                {/* Banco */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Banco</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Banco de Chile"
                    value={banco}
                    onChange={(e) => setBanco(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-sm border focus:outline-none focus:border-sky-500 transition-colors"
                    style={{ background: "#121418", borderColor: "rgba(255,255,255,0.05)", color: "#f1f5f9" }}
                  />
                </div>

                {/* Local */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Local</label>
                  <input
                    type="text"
                    placeholder="Ej: Providencia"
                    value={local}
                    onChange={(e) => setLocal(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-sm border focus:outline-none focus:border-sky-500 transition-colors"
                    style={{ background: "#121418", borderColor: "rgba(255,255,255,0.05)", color: "#f1f5f9" }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Servicio */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Servicio</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Cerrajería"
                    value={servicio}
                    onChange={(e) => setServicio(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-sm border focus:outline-none focus:border-sky-500 transition-colors"
                    style={{ background: "#121418", borderColor: "rgba(255,255,255,0.05)", color: "#f1f5f9" }}
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Estado (Status)</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-sm border focus:outline-none focus:border-sky-500 transition-colors"
                    style={{ background: "#121418", borderColor: "rgba(255,255,255,0.05)", color: "#f1f5f9" }}
                  >
                    <option value="Completado">Completado</option>
                    <option value="Pendiente">Pendiente</option>
                    <option value="En Proceso">En Proceso</option>
                  </select>
                </div>
              </div>

              {/* ASIGNACIÓN DE MONTOS */}
              <div className="p-4 rounded-xl border border-slate-800 space-y-3" style={{ background: "rgba(255,255,255,0.01)" }}>
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Asignación de Pagos (CLP)
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {/* Carlos */}
                  <div>
                    <label className="block text-[10px] font-bold text-sky-400 mb-1 uppercase">Carlos</label>
                    <input
                      type="number"
                      min="0"
                      value={carlos}
                      onChange={(e) => setCarlos(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-lg text-sm border focus:outline-none"
                      style={{ background: "#121418", borderColor: "rgba(255,255,255,0.05)", color: "#f1f5f9" }}
                    />
                  </div>

                  {/* Scott */}
                  <div>
                    <label className="block text-[10px] font-bold text-emerald-400 mb-1 uppercase">Scott</label>
                    <input
                      type="number"
                      min="0"
                      value={scott}
                      onChange={(e) => setScott(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-lg text-sm border focus:outline-none"
                      style={{ background: "#121418", borderColor: "rgba(255,255,255,0.05)", color: "#f1f5f9" }}
                    />
                  </div>

                  {/* Ricardo */}
                  <div>
                    <label className="block text-[10px] font-bold text-indigo-400 mb-1 uppercase">Ricardo</label>
                    <input
                      type="number"
                      min="0"
                      value={ricardo}
                      onChange={(e) => setRicardo(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-lg text-sm border focus:outline-none"
                      style={{ background: "#121418", borderColor: "rgba(255,255,255,0.05)", color: "#f1f5f9" }}
                    />
                  </div>
                </div>

                {/* Suma total previsualizada */}
                <div className="flex justify-between items-center text-xs font-semibold text-slate-400 pt-2 border-t border-slate-800">
                  <span>Suma Total Asignada:</span>
                  <span className="text-sm font-bold text-white font-mono">{fmtCLP(Number(carlos) + Number(scott) + Number(ricardo))}</span>
                </div>
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-slate-400 hover:text-white transition-colors cursor-pointer border-none"
                  style={{ background: "rgba(255,255,255,0.03)" }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-sm font-bold text-white cursor-pointer border-none"
                  style={{ background: "#1F497D" }}
                >
                  Guardar Registro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL CONFIRMACIÓN ELIMINAR ──────────────────────────────────────── */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-sm rounded-2xl p-6 border border-slate-800 shadow-2xl" style={{ background: "#1b1e24" }}>
            <h3 className="font-bold text-base text-slate-200 mb-2">¿Eliminar registro?</h3>
            <p className="text-xs text-slate-400 mb-6">
              Esta acción no se puede deshacer. El registro se eliminará permanentemente de la base de datos de control.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:text-white cursor-pointer border-none"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 cursor-pointer border-none"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
