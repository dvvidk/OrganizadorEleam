import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search, Plus, X, Trash2, Pencil, Users, Clock, Check, AlertTriangle,
  ChevronLeft, ChevronRight, Loader2, Save, UserPlus, ListChecks,
} from "lucide-react";
import { storage } from "./storage.js";
import { SEED_RESIDENTS } from "./seedResidents.js";

// ---------- utilidades de fecha ----------
function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fromDateStr(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addDays(dateStr, n) {
  const d = fromDateStr(dateStr);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}
function getMonday(dateStr) {
  const d = fromDateStr(dateStr);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return toDateStr(d);
}
function formatPretty(dateStr) {
  const d = fromDateStr(dateStr);
  return d.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function formatPrettyShort(dateStr) {
  const d = fromDateStr(dateStr);
  return d.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" });
}
function formatShort(dateStr) {
  const d = fromDateStr(dateStr);
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}
function nowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
function initials(nombre) {
  const parts = nombre.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

const TODAY = toDateStr(new Date());

const ESTADOS_ATENCION = ["Atendido", "Pendiente", "Seguimiento"];
const ESTADOS_RESIDENTE = ["Activo", "En seguimiento", "Sin Atención"];

// Emojis de estado de ATENCIÓN (registro puntual del día) — set propio, no se repite
// con los emojis de estado del RESIDENTE (condición general de la persona).
const ATENCION_META = {
  "Atendido": { emoji: "✅", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  "Pendiente": { emoji: "⏳", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  "Seguimiento": { emoji: "🔎", cls: "bg-sky-50 text-sky-700 border-sky-200" },
};
const RESIDENTE_META = {
  "Activo": { emoji: "🟢", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  "En seguimiento": { emoji: "🔵", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  "Sin Atención": { emoji: "🔴", cls: "bg-red-50 text-red-700 border-red-200" },
};

const AVATAR_COLORS = [
  "bg-indigo-100 text-indigo-700", "bg-sky-100 text-sky-700", "bg-violet-100 text-violet-700",
  "bg-amber-100 text-amber-700", "bg-rose-100 text-rose-700", "bg-emerald-100 text-emerald-700",
];
function avatarColor(id) {
  let sum = 0;
  for (const c of id) sum += c.charCodeAt(0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

function AtencionBadge({ estado }) {
  const meta = ATENCION_META[estado] || { emoji: "•", cls: "bg-slate-100 text-slate-600 border-slate-200" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${meta.cls}`}>
      <span>{meta.emoji}</span>{estado}
    </span>
  );
}
function ResidenteBadge({ estado }) {
  const meta = RESIDENTE_META[estado] || { emoji: "•", cls: "bg-slate-100 text-slate-600 border-slate-200" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${meta.cls}`}>
      <span>{meta.emoji}</span>{estado}
    </span>
  );
}

// ---------- rangos de filtro rápido ----------
function buildPresets() {
  const monday = getMonday(TODAY);
  const lastMonday = addDays(monday, -7);
  const lastSunday = addDays(monday, -1);
  const firstOfMonth = TODAY.slice(0, 8) + "01";
  return [
    { key: "hoy", label: "Hoy", start: TODAY, end: TODAY },
    { key: "ayer", label: "Ayer", start: addDays(TODAY, -1), end: addDays(TODAY, -1) },
    { key: "7dias", label: "Últimos 7 días", start: addDays(TODAY, -6), end: TODAY },
    { key: "semanapasada", label: "Semana pasada", start: lastMonday, end: lastSunday },
    { key: "mes", label: "Mes actual", start: firstOfMonth, end: TODAY },
  ];
}

// ---------- tarjeta de estadística ----------
function StatCard({ emoji, value, label, gradient }) {
  return (
    <div className={`relative overflow-hidden rounded-xl sm:rounded-2xl p-2.5 sm:p-4 text-white shadow-sm ${gradient}`}>
      <p className="text-lg sm:text-2xl font-bold leading-none">{value}</p>
      <p className="text-[10px] sm:text-xs opacity-90 mt-1 sm:mt-1.5 leading-tight">{emoji} {label}</p>
    </div>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [residents, setResidents] = useState([]);
  const [attentions, setAttentions] = useState([]);
  const [mobileTab, setMobileTab] = useState("residentes"); // residentes | hoy | historial

  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [journalDate, setJournalDate] = useState(TODAY);

  const [showResidentModal, setShowResidentModal] = useState(false);
  const [editingResident, setEditingResident] = useState(null);
  const [profileResident, setProfileResident] = useState(null);

  const [editingAttention, setEditingAttention] = useState(null);
  const [dupConfirm, setDupConfirm] = useState(null);

  const [historyPreset, setHistoryPreset] = useState("7dias");
  const [customStart, setCustomStart] = useState(addDays(TODAY, -6));
  const [customEnd, setCustomEnd] = useState(TODAY);
  const [historySearch, setHistorySearch] = useState("");

  const [saving, setSaving] = useState(false);

  // ---------- carga inicial ----------
  useEffect(() => {
    (async () => {
      try {
        let r = null;
        let a = [];
        try {
          const res = await storage.get("residents-v1");
          if (res) r = JSON.parse(res.value);
        } catch (e) { /* no existe aún */ }
        try {
          const res = await storage.get("attentions-v1");
          if (res) a = JSON.parse(res.value);
        } catch (e) { /* no existe aún */ }

        if (r === null) {
          r = SEED_RESIDENTS.map(s => ({ id: uid(), estado: "Activo", ...s }));
          await storage.set("residents-v1", JSON.stringify(r));
        }

        setResidents(r);
        setAttentions(a);
      } catch (e) {
        console.error("Error cargando datos", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = useCallback(async (key, value) => {
    setSaving(true);
    try {
      await storage.set(key, JSON.stringify(value));
    } catch (e) {
      console.error("Error guardando", key, e);
    } finally {
      setSaving(false);
    }
  }, []);

  const saveResidents = useCallback((next) => {
    setResidents(next);
    persist("residents-v1", next);
  }, [persist]);

  const saveAttentions = useCallback((next) => {
    setAttentions(next);
    persist("attentions-v1", next);
  }, [persist]);

  // ---------- residentes ----------
  const filteredResidents = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? residents.filter(r => r.nombre.toLowerCase().includes(q)) : residents;
    return [...list].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [residents, search]);

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function upsertResident(data) {
    if (data.id) {
      saveResidents(residents.map(r => r.id === data.id ? { ...r, ...data } : r));
    } else {
      saveResidents([...residents, { id: uid(), estado: "Activo", edad: "", observaciones: "", ...data }]);
    }
    setShowResidentModal(false);
    setEditingResident(null);
  }

  function deleteResident(id) {
    saveResidents(residents.filter(r => r.id !== id));
    saveAttentions(attentions.filter(a => a.residentId !== id));
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    setProfileResident(null);
  }

  // ---------- atenciones ----------
  function residentesDelDia(dateStr) {
    return attentions.filter(a => a.fecha === dateStr);
  }

  function attemptAddSelected() {
    const dayList = residentesDelDia(journalDate);
    const dupIds = [...selectedIds].filter(id => dayList.some(a => a.residentId === id));
    if (dupIds.length > 0) {
      const dupNames = dupIds.map(id => residents.find(r => r.id === id)?.nombre || "");
      setDupConfirm({ ids: [...selectedIds], dupIds, dupNames });
    } else {
      commitAddSelected([...selectedIds]);
    }
  }

  function commitAddSelected(ids) {
    const nuevas = ids.map(id => ({
      id: uid(),
      residentId: id,
      fecha: journalDate,
      hora: nowTimeStr(),
      observacion: "",
      estado: "Atendido",
      usuario: "",
    }));
    saveAttentions([...attentions, ...nuevas]);
    setSelectedIds(new Set());
    setDupConfirm(null);
  }

  function skipDuplicatesAndAdd() {
    const ids = dupConfirm.ids.filter(id => !dupConfirm.dupIds.includes(id));
    commitAddSelected(ids);
  }

  function updateAttention(id, patch) {
    saveAttentions(attentions.map(a => a.id === id ? { ...a, ...patch } : a));
  }

  function deleteAttention(id) {
    saveAttentions(attentions.filter(a => a.id !== id));
  }

  // ---------- historial ----------
  const activePreset = useMemo(() => buildPresets().find(p => p.key === historyPreset), [historyPreset]);
  const rangeStart = historyPreset === "custom" ? customStart : (activePreset?.start || TODAY);
  const rangeEnd = historyPreset === "custom" ? customEnd : (activePreset?.end || TODAY);

  const historyList = useMemo(() => {
    let list = attentions.filter(a => a.fecha >= rangeStart && a.fecha <= rangeEnd);
    const q = historySearch.trim().toLowerCase();
    if (q) {
      list = list.filter(a => (residents.find(r => r.id === a.residentId)?.nombre || "").toLowerCase().includes(q));
    }
    return list.sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora));
  }, [attentions, rangeStart, rangeEnd, historySearch, residents]);

  const todayList = useMemo(() => {
    return attentions
      .filter(a => a.fecha === journalDate)
      .sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));
  }, [attentions, journalDate]);

  // ---------- estadísticas ----------
  const statsHoy = useMemo(() => {
    const hoy = attentions.filter(a => a.fecha === TODAY);
    return {
      atendidos: hoy.filter(a => a.estado === "Atendido").length,
      pendientes: hoy.filter(a => a.estado === "Pendiente").length,
      seguimiento: hoy.filter(a => a.estado === "Seguimiento").length,
    };
  }, [attentions]);

  // Cobertura SEMANAL: % de residentes con al menos una atención en los últimos 7 días.
  const semanaInicio = addDays(TODAY, -6);
  const coberturaSemanal = useMemo(() => {
    const atendidosEstaSemana = new Set(
      attentions.filter(a => a.fecha >= semanaInicio && a.fecha <= TODAY).map(a => a.residentId)
    );
    return {
      count: atendidosEstaSemana.size,
      pct: residents.length > 0 ? Math.round((atendidosEstaSemana.size / residents.length) * 100) : 0,
    };
  }, [attentions, residents, semanaInicio]);

  function residentName(id) {
    return residents.find(r => r.id === id)?.nombre || "Residente eliminado";
  }

  function residentHistory(id) {
    return attentions.filter(a => a.residentId === id).sort((a, b) => (b.fecha + (b.hora||"")).localeCompare(a.fecha + (a.hora||"")));
  }

  // ================= RENDER =================
  if (loading) {
    return (
      <div className="min-h-[500px] flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 text-indigo-700">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando registros…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-16 md:pb-0">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-3 py-3 sm:px-6 sm:py-4 sticky top-0 z-20 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-xl bg-white/10 flex items-center justify-center text-base sm:text-lg">🩺</div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-lg font-bold leading-tight truncate">Registro de Atenciones</h1>
              <p className="text-indigo-200 text-[11px] sm:text-xs leading-tight truncate">
                👋 {greeting()} · <span className="sm:hidden">{formatPrettyShort(TODAY)}</span><span className="hidden sm:inline">{formatPretty(TODAY)}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-indigo-200 shrink-0">
            {saving && <span className="hidden sm:flex items-center gap-1 bg-white/10 px-2 py-1 rounded-full"><Loader2 className="w-3 h-3 animate-spin" /> guardando</span>}
            <span className="flex items-center gap-1 bg-white/10 px-2 sm:px-2.5 py-1 rounded-full font-medium">🧓 {residents.length}</span>
          </div>
        </div>

        {/* Stats rápidas */}
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-3 mt-3 sm:mt-4">
          <StatCard emoji="✅" value={statsHoy.atendidos} label="Atendidos hoy" gradient="bg-gradient-to-br from-emerald-600 to-emerald-700" />
          <StatCard emoji="⏳" value={statsHoy.pendientes} label="Pendientes hoy" gradient="bg-gradient-to-br from-amber-600 to-amber-700" />
          <StatCard emoji="🔎" value={statsHoy.seguimiento} label="En seguimiento hoy" gradient="bg-gradient-to-br from-sky-600 to-sky-700" />
          <StatCard emoji="📈" value={`${coberturaSemanal.pct}%`} label="Cobertura semanal" gradient="bg-gradient-to-br from-indigo-600 to-indigo-700" />
        </div>
      </header>

      <div className="max-w-7xl mx-auto md:grid md:grid-cols-[280px_1fr_340px] md:gap-4 md:p-4">
        {/* ---------------- PANEL IZQUIERDO: RESIDENTES ---------------- */}
        <section className={`${mobileTab === "residentes" ? "block" : "hidden"} md:block bg-white md:rounded-2xl md:border md:border-slate-200 md:shadow-sm p-3 sm:p-4 md:h-[calc(100vh-172px)] md:overflow-y-auto mt-3 md:mt-0`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-700 flex items-center gap-1.5">🧓 Residentes</h2>
            <button
              onClick={() => { setEditingResident(null); setShowResidentModal(true); }}
              className="flex items-center gap-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded-lg transition-all shadow-sm hover:shadow"
            >
              <Plus className="w-3.5 h-3.5" /> Nuevo
            </button>
          </div>

          <div className="relative mb-3">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre…"
              className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {selectedIds.size > 0 && (
            <div className="mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2 text-xs">
              <span className="text-indigo-800 font-semibold">🙋 {selectedIds.size} seleccionado(s)</span>
              <button onClick={attemptAddSelected} className="flex items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded-lg font-semibold shadow-sm">
                <Plus className="w-3.5 h-3.5" /> Agregar a jornada
              </button>
            </div>
          )}

          <div className="space-y-1.5">
            {filteredResidents.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">
                {residents.length === 0 ? "🗒️ Aún no hay residentes. Agrega el primero." : "🔍 Sin resultados para esta búsqueda."}
              </p>
            )}
            {filteredResidents.map(r => (
              <ResidentRow
                key={r.id}
                resident={r}
                selected={selectedIds.has(r.id)}
                onToggle={() => toggleSelect(r.id)}
                onOpenProfile={() => setProfileResident(r)}
                onDelete={() => deleteResident(r.id)}
              />
            ))}
          </div>
        </section>

        {/* ---------------- PANEL CENTRAL: JORNADA DEL DÍA ---------------- */}
        <section className={`${mobileTab === "hoy" ? "block" : "hidden"} md:block bg-white md:rounded-2xl md:border md:border-slate-200 md:shadow-sm p-3 sm:p-4 md:h-[calc(100vh-172px)] md:overflow-y-auto mt-3 md:mt-0`}>
          <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
            <h2 className="font-bold text-slate-700 flex items-center gap-1.5">🩹 Jornada</h2>
            <div className="flex items-center gap-1 flex-wrap">
              <button onClick={() => setJournalDate(addDays(journalDate, -1))} className="p-1.5 rounded-lg hover:bg-slate-100"><ChevronLeft className="w-4 h-4" /></button>
              <input
                type="date"
                value={journalDate}
                onChange={e => setJournalDate(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-2 py-1 max-w-[140px] sm:max-w-none"
              />
              <button onClick={() => setJournalDate(addDays(journalDate, 1))} className="p-1.5 rounded-lg hover:bg-slate-100"><ChevronRight className="w-4 h-4" /></button>
              {journalDate !== TODAY && (
                <button onClick={() => setJournalDate(TODAY)} className="text-xs text-indigo-700 font-semibold ml-1 hover:underline">Hoy</button>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-400 capitalize mb-3">{formatPretty(journalDate)}</p>

          {residents.length > 0 && (
            <div className="mb-4 bg-gradient-to-r from-indigo-50 to-sky-50 border border-indigo-100 rounded-xl p-3">
              <div className="flex items-center justify-between text-xs font-medium text-indigo-800 mb-1.5">
                <span>📈 Cobertura semanal</span>
                <span>{coberturaSemanal.count} / {residents.length} residentes</span>
              </div>
              <div className="h-2 bg-white rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-sky-500 rounded-full transition-all" style={{ width: `${coberturaSemanal.pct}%` }} />
              </div>
              <p className="text-[10px] text-indigo-400 mt-1">Desde el {formatShort(semanaInicio)} hasta hoy</p>
            </div>
          )}

          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-slate-600">{todayList.length} atención(es) registrada(s)</p>
          </div>

          <div className="space-y-2">
            {todayList.length === 0 && (
              <div className="text-center py-10 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                📭 Sin atenciones para esta fecha.<br/>Selecciona residentes a la izquierda y agrégalos a la jornada.
              </div>
            )}
            {todayList.map(a => (
              <AttentionRow
                key={a.id}
                attention={a}
                nombre={residentName(a.residentId)}
                editing={editingAttention === a.id}
                onEdit={() => setEditingAttention(a.id)}
                onCancelEdit={() => setEditingAttention(null)}
                onSave={(patch) => { updateAttention(a.id, patch); setEditingAttention(null); }}
                onDelete={() => deleteAttention(a.id)}
              />
            ))}
          </div>
        </section>

        {/* ---------------- PANEL DERECHO: HISTORIAL ---------------- */}
        <section className={`${mobileTab === "historial" ? "block" : "hidden"} md:block bg-white md:rounded-2xl md:border md:border-slate-200 md:shadow-sm p-3 sm:p-4 md:h-[calc(100vh-172px)] md:overflow-y-auto mt-3 md:mt-0`}>
          <h2 className="font-bold text-slate-700 flex items-center gap-1.5 mb-3">🕰️ Historial</h2>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {buildPresets().map(p => (
              <button
                key={p.key}
                onClick={() => setHistoryPreset(p.key)}
                className={`text-xs px-2.5 py-1.5 rounded-full border font-semibold transition-all ${historyPreset === p.key ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"}`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setHistoryPreset("custom")}
              className={`text-xs px-2.5 py-1.5 rounded-full border font-semibold transition-all ${historyPreset === "custom" ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"}`}
            >
              🗓️ Rango personalizado
            </button>
          </div>

          {historyPreset === "custom" && (
            <div className="flex items-center gap-2 mb-3 text-xs">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1 flex-1 min-w-0" />
              <span className="text-slate-400">a</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1 flex-1 min-w-0" />
            </div>
          )}

          <p className="text-xs text-slate-400 mb-3">
            {formatShort(rangeStart)} – {formatShort(rangeEnd)} · {historyList.length} registro(s)
          </p>

          <div className="relative mb-3">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              placeholder="Filtrar por residente…"
              className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div className="space-y-2">
            {historyList.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">🧾 No hay atenciones en este período.</p>
            )}
            {historyList.map(a => (
              <div key={a.id} className="p-2.5 rounded-xl border border-slate-100 hover:border-indigo-200 hover:shadow-sm transition-all">
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => { const r = residents.find(r => r.id === a.residentId); if (r) setProfileResident(r); }}
                    className="text-sm font-medium text-slate-800 hover:text-indigo-700 truncate text-left"
                  >
                    {residentName(a.residentId)}
                  </button>
                  <AtencionBadge estado={a.estado} />
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                  <span className="capitalize">{formatShort(a.fecha)}</span>
                  {a.hora && <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{a.hora}</span>}
                </div>
                {a.observacion && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{a.observacion}</p>}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Nav móvil */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex justify-around py-1.5 z-20 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
        {[
          { key: "residentes", label: "Residentes", emoji: "🧓" },
          { key: "hoy", label: "Jornada", emoji: "🩹" },
          { key: "historial", label: "Historial", emoji: "🕰️" },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setMobileTab(t.key)}
            className={`flex flex-col items-center gap-0.5 px-5 py-1.5 rounded-xl text-xs font-medium transition-all ${mobileTab === t.key ? "text-indigo-700 bg-indigo-50" : "text-slate-400"}`}
          >
            <span className="text-base leading-none">{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {/* Modal: nuevo/editar residente */}
      {showResidentModal && (
        <ResidentModal
          initial={editingResident}
          onClose={() => { setShowResidentModal(false); setEditingResident(null); }}
          onSave={upsertResident}
        />
      )}

      {/* Modal: perfil de residente */}
      {profileResident && (
        <ResidentProfile
          resident={residents.find(r => r.id === profileResident.id) || profileResident}
          history={residentHistory(profileResident.id)}
          onClose={() => setProfileResident(null)}
          onEdit={() => { setEditingResident(profileResident); setShowResidentModal(true); setProfileResident(null); }}
          onDelete={() => deleteResident(profileResident.id)}
        />
      )}

      {/* Confirmación de duplicados */}
      {dupConfirm && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-xl">
            <div className="flex items-center gap-2 text-amber-600 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold">Ya agregados hoy</h3>
            </div>
            <p className="text-sm text-slate-600 mb-3">
              {dupConfirm.dupNames.join(", ")} ya {dupConfirm.dupNames.length > 1 ? "tienen" : "tiene"} una atención registrada el {formatShort(journalDate)}.
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={() => commitAddSelected(dupConfirm.ids)} className="w-full text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2 font-semibold shadow-sm">
                Agregar de todos modos (duplicar)
              </button>
              <button onClick={skipDuplicatesAndAdd} className="w-full text-sm border border-slate-200 hover:bg-slate-50 rounded-xl py-2 font-semibold">
                Omitir duplicados y agregar el resto
              </button>
              <button onClick={() => setDupConfirm(null)} className="w-full text-sm text-slate-500 py-1">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- fila de residente (con eliminación directa) ----------
function ResidentRow({ resident, selected, onToggle, onOpenProfile, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${selected ? "border-indigo-400 bg-indigo-50 shadow-sm" : "border-slate-100 hover:border-indigo-200 hover:bg-slate-50"}`}
      onClick={onToggle}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        onClick={e => e.stopPropagation()}
        className="w-4 h-4 accent-indigo-600"
      />
      <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${avatarColor(resident.id)}`}>
        {initials(resident.nombre)}
      </div>
      <div className="flex-1 min-w-0" onClick={(e) => { e.stopPropagation(); onOpenProfile(); }}>
        <p className="text-sm font-medium text-slate-800 truncate">{resident.nombre}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {resident.edad && <span className="text-xs text-slate-400">{resident.edad} años</span>}
          <ResidenteBadge estado={resident.estado} />
        </div>
      </div>
      {confirmDelete ? (
        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={onDelete} className="p-1.5 rounded-lg text-white bg-red-600 hover:bg-red-700"><Check className="w-3.5 h-3.5" /></button>
          <button onClick={() => setConfirmDelete(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-3.5 h-3.5" /></button>
        </div>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
          title="Eliminar residente"
          className="p-1.5 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ---------- fila de atención (con edición inline) ----------
function AttentionRow({ attention, nombre, editing, onEdit, onCancelEdit, onSave, onDelete }) {
  const [hora, setHora] = useState(attention.hora || "");
  const [estado, setEstado] = useState(attention.estado);
  const [observacion, setObservacion] = useState(attention.observacion || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (editing) {
    return (
      <div className="p-3 rounded-xl border border-indigo-300 bg-indigo-50/40 space-y-2">
        <p className="text-sm font-semibold text-slate-800">{nombre}</p>
        <div className="flex gap-2">
          <input type="time" value={hora} onChange={e => setHora(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-2 py-1 flex-1" />
          <select value={estado} onChange={e => setEstado(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-2 py-1 flex-1">
            {ESTADOS_ATENCION.map(s => <option key={s} value={s}>{ATENCION_META[s].emoji} {s}</option>)}
          </select>
        </div>
        <textarea
          value={observacion}
          onChange={e => setObservacion(e.target.value)}
          placeholder="Observación clínica…"
          rows={2}
          className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 resize-none"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onCancelEdit} className="text-xs px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100">Cancelar</button>
          <button onClick={() => onSave({ hora, estado, observacion })} className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold flex items-center gap-1 shadow-sm"><Save className="w-3.5 h-3.5" /> Guardar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:shadow-sm transition-all group">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">{nombre}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {attention.hora && <span className="flex items-center gap-0.5 text-xs text-slate-400"><Clock className="w-3 h-3" />{attention.hora}</span>}
            <AtencionBadge estado={attention.estado} />
          </div>
          {attention.observacion && <p className="text-xs text-slate-500 mt-1.5">{attention.observacion}</p>}
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={onEdit} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-700 hover:bg-indigo-50"><Pencil className="w-3.5 h-3.5" /></button>
          {confirmDelete ? (
            <button onClick={onDelete} className="p-1.5 rounded-lg text-white bg-red-600 hover:bg-red-700"><Check className="w-3.5 h-3.5" /></button>
          ) : (
            <button onClick={() => setConfirmDelete(true)} onBlur={() => setConfirmDelete(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- modal crear/editar residente ----------
function ResidentModal({ initial, onClose, onSave }) {
  const [nombre, setNombre] = useState(initial?.nombre || "");
  const [edad, setEdad] = useState(initial?.edad || "");
  const [estado, setEstado] = useState(initial?.estado || "Activo");
  const [observaciones, setObservaciones] = useState(initial?.observaciones || "");

  function submit() {
    if (!nombre.trim()) return;
    onSave({ id: initial?.id, nombre: nombre.trim(), edad, estado, observaciones });
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800">{initial ? "✏️ Editar residente" : "📝 Nuevo residente"}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-500">Nombre completo</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} className="w-full mt-1 border border-slate-200 rounded-xl px-3 py-2 text-sm" placeholder="Ej: Juana Pérez Soto" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs font-semibold text-slate-500">Edad (opcional)</label>
              <input value={edad} onChange={e => setEdad(e.target.value)} className="w-full mt-1 border border-slate-200 rounded-xl px-3 py-2 text-sm" placeholder="Ej: 84" />
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold text-slate-500">Estado</label>
              <select value={estado} onChange={e => setEstado(e.target.value)} className="w-full mt-1 border border-slate-200 rounded-xl px-3 py-2 text-sm">
                {ESTADOS_RESIDENTE.map(s => <option key={s} value={s}>{RESIDENTE_META[s].emoji} {s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Observaciones (opcional)</label>
            <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={3} className="w-full mt-1 border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none" placeholder="Notas administrativas o clínicas generales…" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="text-sm px-3 py-2 rounded-xl text-slate-500 hover:bg-slate-100">Cancelar</button>
          <button onClick={submit} disabled={!nombre.trim()} className="text-sm px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-semibold shadow-sm">
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- perfil de residente ----------
function ResidentProfile({ resident, history, onClose, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const total = history.length;
  const ultima = history[0];

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold ${avatarColor(resident.id)}`}>
              {initials(resident.nombre)}
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg leading-tight">{resident.nombre}</h3>
              <div className="flex items-center gap-2 mt-1">
                {resident.edad && <span className="text-xs text-slate-400">{resident.edad} años</span>}
                <ResidenteBadge estado={resident.estado} />
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>

        {resident.observaciones && (
          <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 mb-3">{resident.observaciones}</p>
        )}

        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-xl p-3 text-center shadow-sm">
            <p className="text-xl font-bold">{total}</p>
            <p className="text-xs opacity-90">🗃️ atenciones totales</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-sm font-semibold text-slate-700">{ultima ? formatShort(ultima.fecha) : "—"}</p>
            <p className="text-xs text-slate-500">⏱️ última atención</p>
          </div>
        </div>

        <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1"><ListChecks className="w-3.5 h-3.5" /> Historial de atenciones</p>
        <div className="space-y-2 mb-4">
          {history.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Sin atenciones registradas todavía.</p>}
          {history.map(a => (
            <div key={a.id} className="border border-slate-100 rounded-xl p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700 capitalize">{formatShort(a.fecha)} {a.hora && `· ${a.hora}`}</span>
                <AtencionBadge estado={a.estado} />
              </div>
              {a.observacion && <p className="text-xs text-slate-500 mt-1">{a.observacion}</p>}
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center border-t border-slate-100 pt-3">
          <button onClick={onEdit} className="text-sm text-indigo-700 font-semibold hover:underline">✏️ Editar datos</button>
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">¿Eliminar residente y su historial?</span>
              <button onClick={onDelete} className="text-xs bg-red-600 text-white px-2.5 py-1.5 rounded-lg font-semibold">Confirmar</button>
              <button onClick={() => setConfirmDelete(false)} className="text-xs text-slate-500">Cancelar</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="text-sm text-red-500 font-semibold hover:underline">🗑️ Eliminar</button>
          )}
        </div>
      </div>
    </div>
  );
}
