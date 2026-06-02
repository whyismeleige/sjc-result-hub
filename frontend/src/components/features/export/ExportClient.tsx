'use client';
// src/components/features/export/ExportClient.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Download, FileText, CheckCircle, Loader2,
  AlertCircle, Users, BookOpen, GraduationCap, X, Search, User, FileSpreadsheet, FileDown
} from 'lucide-react';
import { cn } from '@/utils';
import type { jsPDF as JsPDFType } from 'jspdf';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts';

type PdfDoc = JsPDFType & {
  autoTable(opts: Record<string, unknown>): void;
  lastAutoTable?: { finalY: number };
};

type ExportScope = 'all' | 'students' | 'semesters' | 'grades';
type ExportFormat = 'csv' | 'pdf';

interface StudentHit {
  id: number;
  hall_ticket: string;
  student_name: string;
  program: string | null;
}

interface StudentRow {
  hall_ticket: string;
  student_name: string;
  father_name: string | null;
  mother_name: string | null;
  program: string | null;
}

interface SemesterRow {
  semester_name: string;
  exam_month_year: string;
  sgpa: string | null;
  overall_result: string | null;
  student: { hall_ticket: string; student_name: string };
}

interface GradeRow {
  grade: string | null;
  subject_result: string | null;
  semester: {
    semester_name: string;
    exam_month_year: string;
    student: { hall_ticket: string; student_name: string };
  };
  subject: { course_code: string; course_title: string };
}

interface ChartData {
  programDistribution?: { name: string; value: number }[];
  sgpaDistribution?: { range: string; count: number }[];
  semesterAverages?: { semester: string; avgSgpa: number }[];
  gradeDistribution?: { grade: string; count: number }[];
  passRateTrend?: { semester: string; passRate: number }[];
}

interface ExportJsonResponse {
  scope: ExportScope;
  totalRows: number;
  students?: StudentRow[];
  semesters?: SemesterRow[];
  grades?: GradeRow[];
  charts: ChartData;
}

const PIE_COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const BAR_COLOR = '#f59e0b';

const SCOPE_OPTIONS: { value: ExportScope; label: string; description: string; icon: typeof FileText }[] = [
  { value: 'all',        label: 'Complete Export',   description: 'Students, semester results, and grade breakdown in one file', icon: FileText },
  { value: 'students',   label: 'Student Records',   description: 'Hall ticket, name, program, and parent details',               icon: Users },
  { value: 'semesters',  label: 'Semester Results',  description: 'SGPA scores per semester with pass/fail status',                icon: BookOpen },
  { value: 'grades',     label: 'Grade Breakdown',   description: 'Individual subject-wise grades for every student',             icon: GraduationCap },
];

const FORMAT_OPTIONS: { value: ExportFormat; label: string; icon: typeof FileText }[] = [
  { value: 'csv', label: 'CSV', icon: FileSpreadsheet },
  { value: 'pdf', label: 'PDF', icon: FileDown },
];

function getInitialTickets(sp: URLSearchParams): string[] {
  const val = sp.get('students');
  return val ? val.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : [];
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
}

/* ── Hidden chart components for PDF ─────────────────────── */

function PieChartWidget({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
          {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1e293b' }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function BarChartWidget({ data, xKey, barKey, label }: { data: Record<string, unknown>[]; xKey: string; barKey: string; label?: string }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey={xKey} tick={{ fill: '#64748b', fontSize: 12 }} />
        <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
        <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1e293b' }} />
        {label && <Legend />}
        <Bar dataKey={barKey} fill={BAR_COLOR} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function LineChartWidget({ data, xKey, lines }: { data: Record<string, unknown>[]; xKey: string; lines: { key: string; color: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey={xKey} tick={{ fill: '#64748b', fontSize: 12 }} />
        <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
        <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1e293b' }} />
        <Legend />
        {lines.map(l => <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color} strokeWidth={2} dot={{ r: 3 }} />)}
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ── PDF chart panel (hidden during render, captured by html2canvas) ── */

function PdfCharts({ data, chartRefs }: { data: ExportJsonResponse; chartRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>> }) {
  const c = data.charts;
  const sections: { key: string; title: string; chart: React.ReactNode }[] = [];

  if (c.programDistribution && c.programDistribution.length > 0) {
    sections.push({ key: 'programDist', title: 'Students by Program', chart: <PieChartWidget data={c.programDistribution} /> });
  }
  if (c.semesterAverages && c.semesterAverages.length > 0) {
    sections.push({ key: 'semesterAvg', title: 'Average SGPA per Semester', chart: <BarChartWidget data={c.semesterAverages as unknown as Record<string, unknown>[]} xKey="semester" barKey="avgSgpa" /> });
  }
  if (c.gradeDistribution && c.gradeDistribution.length > 0) {
    sections.push({ key: 'gradeDist', title: 'Grade Distribution', chart: <BarChartWidget data={c.gradeDistribution as unknown as Record<string, unknown>[]} xKey="grade" barKey="count" /> });
  }
  if (c.passRateTrend && c.passRateTrend.length > 0) {
    sections.push({ key: 'passRate', title: 'Pass Rate Trend', chart: <LineChartWidget data={c.passRateTrend as unknown as Record<string, unknown>[]} xKey="semester" lines={[{ key: 'passRate', color: '#10b981' }]} /> });
  }
  if (c.sgpaDistribution && c.sgpaDistribution.length > 0) {
    sections.push({ key: 'sgpaDist', title: 'SGPA Distribution', chart: <BarChartWidget data={c.sgpaDistribution as unknown as Record<string, unknown>[]} xKey="range" barKey="count" /> });
  }

  return (
    <div style={{ position: 'fixed', left: -9999, top: 0, zIndex: -1, background: '#ffffff', padding: 16 }}>
      {sections.map(s => (
        <div key={s.key} ref={el => { chartRefs.current[s.key] = el; }} style={{ width: 700, marginBottom: 24, padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ color: '#1e293b', fontSize: 16, fontWeight: 600, marginBottom: 12, fontFamily: 'system-ui' }}>{s.title}</div>
          {s.chart}
        </div>
      ))}
    </div>
  );
}

export function ExportClient() {
  const searchParams = useSearchParams();
  const [exportScope, setExportScope] = useState<ExportScope>('all');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [hallTickets, setHallTickets] = useState<string[]>(() => getInitialTickets(searchParams));
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ filename: string; rowCount: number | null } | null>(null);

  // ── Debounced search ──────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StudentHit[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (query.length < 2) return;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/students?q=${encodeURIComponent(query)}&limit=8`);
        const json = await res.json();
        setResults(json.data || []);
      } catch { setResults([]); }
      setSearching(false);
    }, 280);
    return () => clearTimeout(timer);
  }, [query]);

  // ── PDF generation ────────────────────────────────────────────
  const [pdfData, setPdfData] = useState<ExportJsonResponse | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const chartRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!pdfData || pdfBusy) return;
    const timer = setTimeout(async () => {
      setPdfBusy(true);
      await new Promise(r => requestAnimationFrame(r));
      await new Promise(r => setTimeout(r, 150));

      const [{ jsPDF: JsPdfConstructor }, autotable, html2canvas] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
        import('html2canvas').then(m => m.default),
      ]);
      autotable.applyPlugin(JsPdfConstructor);
      const jsPDF = JsPdfConstructor;

      const doc = new jsPDF('p', 'mm', 'a4') as unknown as PdfDoc;
      const pw = doc.internal.pageSize.getWidth();
      const margin = 14;
      const contentW = pw - margin * 2;
      let y = margin;

      doc.setFontSize(22);
      doc.setTextColor(245, 158, 11);
      doc.text('Academic Data Export', margin, y);
      y += 8;
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(`Generated: ${formatDate()}`, margin, y);
      y += 5;
      const scopeLabel = SCOPE_OPTIONS.find(s => s.value === pdfData.scope)?.label || pdfData.scope;
      doc.text(`Scope: ${scopeLabel}  |  Records: ${pdfData.totalRows}`, margin, y);
      y += 12;

      const chartKeys = Object.keys(chartRefs.current).filter(k => chartRefs.current[k]);
      if (chartKeys.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(30, 41, 59);
        doc.text('Charts', margin, y);
        y += 4;
        doc.setDrawColor(245, 158, 11);
        doc.setLineWidth(0.5);
        doc.line(margin, y, margin + 30, y);
        y += 8;

        for (const key of chartKeys) {
          const el = chartRefs.current[key];
          if (!el) continue;
          try {
            const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', logging: false });
            const imgData = canvas.toDataURL('image/png');
            const imgW = contentW;
            const imgH = (canvas.height / canvas.width) * imgW;

            if (y + imgH > doc.internal.pageSize.getHeight() - margin) {
              doc.addPage();
              y = margin;
            }
            doc.addImage(imgData, 'PNG', margin, y, imgW, imgH);
            y += imgH + 6;
          } catch {
            // skip chart if capture fails
          }
        }
      }

      if (pdfData.students && pdfData.students.length > 0) {
        if (y + 20 > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); y = margin; }
        doc.autoTable({
          startY: y + 4,
          head: [['Hall Ticket', 'Name', 'Father', 'Mother', 'Program']],
          body: pdfData.students.map(s => [s.hall_ticket, s.student_name, s.father_name || '', s.mother_name || '', s.program || '']),
          theme: 'grid' as const,
          headStyles: { fillColor: [245, 158, 11] as unknown as number[], textColor: [15, 23, 42] as unknown as number[], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [241, 245, 249] as unknown as number[] },
          styles: { fontSize: 8, textColor: [30, 41, 59] as unknown as number[], cellPadding: 2 },
        });
        y = (doc.lastAutoTable?.finalY ?? y) + 10;
      }

      if (pdfData.semesters && pdfData.semesters.length > 0) {
        if (y + 20 > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); y = margin; }
        doc.autoTable({
          startY: y + 4,
          head: [['Hall Ticket', 'Name', 'Semester', 'Period', 'SGPA', 'Result']],
          body: pdfData.semesters.map(s => [s.student.hall_ticket, s.student.student_name, s.semester_name, s.exam_month_year, s.sgpa || '', s.overall_result || '']),
          theme: 'grid' as const,
          headStyles: { fillColor: [245, 158, 11] as unknown as number[], textColor: [15, 23, 42] as unknown as number[], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [241, 245, 249] as unknown as number[] },
          styles: { fontSize: 8, textColor: [30, 41, 59] as unknown as number[], cellPadding: 2 },
        });
        y = (doc.lastAutoTable?.finalY ?? y) + 10;
      }

      if (pdfData.grades && pdfData.grades.length > 0) {
        if (y + 20 > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); y = margin; }
        doc.autoTable({
          startY: y + 4,
          head: [['Hall Ticket', 'Name', 'Semester', 'Course Code', 'Course Title', 'Grade', 'Result']],
          body: pdfData.grades.map(s => [s.semester.student.hall_ticket, s.semester.student.student_name, s.semester.semester_name, s.subject.course_code, s.subject.course_title, s.grade || '', s.subject_result || '']),
          theme: 'grid' as const,
          headStyles: { fillColor: [245, 158, 11] as unknown as number[], textColor: [15, 23, 42] as unknown as number[], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [241, 245, 249] as unknown as number[] },
          styles: { fontSize: 8, textColor: [30, 41, 59] as unknown as number[], cellPadding: 2 },
        });
        y = (doc.lastAutoTable?.finalY ?? y) + 10;
      }

      const filename = `export-${pdfData.scope}-${Date.now()}.pdf`;
      doc.save(filename);

      setDone({ filename, rowCount: pdfData.totalRows });
      setPdfData(null);
      setPdfBusy(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [pdfData, pdfBusy]);

  // ── Handlers ──────────────────────────────────────────────────
  const addStudent = (s: StudentHit) => {
    setHallTickets(prev => prev.includes(s.hall_ticket) ? prev : [...prev, s.hall_ticket]);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const addRawTicket = () => {
    const ticket = query.trim().toUpperCase();
    if (!ticket) return;
    setHallTickets(prev => prev.includes(ticket) ? prev : [...prev, ticket]);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const removeHallTicket = (ht: string) => {
    setHallTickets(prev => prev.filter(h => h !== ht));
  };

  const clearHallTickets = () => {
    setHallTickets([]);
  };

  const handleExport = useCallback(async () => {
    if (exportFormat === 'pdf') {
      setError(null);
      setDone(null);
      setExporting(true);
      try {
        const params = new URLSearchParams({ format: 'json', scope: exportScope });
        if (hallTickets.length > 0) params.set('students', hallTickets.join(','));
        const res = await fetch(`/api/export?${params}`);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `Export failed (${res.status})`);
        }
        const data: ExportJsonResponse = await res.json();
        setPdfData(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'PDF export failed');
      } finally {
        setExporting(false);
      }
      return;
    }

    // ── CSV export ──
    setExporting(true);
    setError(null);
    setDone(null);

    try {
      const params = new URLSearchParams({ format: 'csv', scope: exportScope });
      if (hallTickets.length > 0) params.set('students', hallTickets.join(','));

      const res = await fetch(`/api/export?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Export failed (${res.status})`);
      }

      const blob = await res.blob();
      const filename = res.headers.get('Content-Disposition')?.match(/filename="?(.+?)"?$/)?.[1] || 'export.csv';
      const rowCount = res.headers.get('X-Total-Rows') ? Number(res.headers.get('X-Total-Rows')) : null;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      setDone({ filename, rowCount });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [exportScope, exportFormat, hallTickets]);

  const busy = exporting || pdfBusy;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Options */}
      <div className="lg:col-span-2 space-y-6">
        {/* Scope selection */}
        <div className="card p-5">
          <h3 className="font-display font-semibold text-sm text-white mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-brand-400" /> What to Export
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SCOPE_OPTIONS.map(s => (
              <button
                key={s.value}
                onClick={() => setExportScope(s.value)}
                className={cn(
                  'card p-4 text-left transition-all border-2',
                  exportScope === s.value
                    ? 'border-brand-500/60 bg-brand-950/30'
                    : 'border-white/[0.07] hover:border-white/[0.15]'
                )}
              >
                <div className={cn(
                  'inline-flex p-2 rounded-lg border mb-3',
                  exportScope === s.value ? 'bg-brand-900/30 border-brand-800/40' : 'bg-surface-800/40 border-surface-700/40'
                )}>
                  <s.icon className={cn('w-5 h-5', exportScope === s.value ? 'text-brand-400' : 'text-surface-400')} />
                </div>
                <div className="font-medium text-sm text-surface-100 mb-1">{s.label}</div>
                <div className="text-xs text-surface-500">{s.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Filter by students */}
        <div className="card p-5">
          <h3 className="font-display font-semibold text-sm text-white mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-400" /> Filter by Students
          </h3>
          <p className="text-xs text-surface-500 mb-3">
            Search by name or hall ticket to add students. Leave empty to export all.
          </p>

          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <Search className="w-4 h-4 text-surface-400" />
            </div>
            <input
              type="text"
              value={query}
              onChange={e => { const v = e.target.value; setQuery(v); if (v.length < 2) { setResults([]); setSearching(false); } setOpen(true); }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 180)}
              onKeyDown={e => { if (e.key === 'Enter') addRawTicket(); }}
              placeholder="Search by name or hall ticket…"
              className="input pl-9 pr-9"
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="w-4 h-4 animate-spin text-surface-400" />
              </div>
            )}
          </div>

          {open && results.length > 0 && (
            <div className="mt-1.5 card border-white/[0.1] overflow-hidden z-50">
              {results.map(s => (
                <button
                  key={s.id}
                  onMouseDown={() => addStudent(s)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors text-left border-b border-white/[0.04] last:border-0"
                >
                  <div className="w-8 h-8 rounded-lg bg-brand-900/50 border border-brand-800/40 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-brand-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-surface-100 font-medium text-sm truncate">{s.student_name}</div>
                    <div className="text-surface-500 text-xs font-mono flex gap-2">
                      <span>{s.hall_ticket}</span>
                      {s.program && <span className="text-surface-600">· {s.program}</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {hallTickets.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {hallTickets.map(ht => (
                <span key={ht} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-brand-900/40 border border-brand-800/40 text-brand-300 text-xs font-mono">
                  {ht}
                  <button onClick={() => removeHallTicket(ht)} className="hover:text-rose-400 transition-colors leading-none">
                    &times;
                  </button>
                </span>
              ))}
              <button onClick={clearHallTickets} className="inline-flex items-center px-2 py-0.5 rounded text-xs text-rose-400 hover:bg-rose-950/30 transition-colors">
                <X className="w-3 h-3" /> Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right: Summary & Export */}
      <div className="space-y-6">
        <div className="card p-5 sticky top-24">
          <h3 className="font-display font-semibold text-sm text-white mb-4">Export Summary</h3>

          <div className="space-y-3 text-sm mb-6">
            <div className="flex justify-between">
              <span className="text-surface-500">Scope</span>
              <span className="text-surface-200 font-medium">{SCOPE_OPTIONS.find(s => s.value === exportScope)?.label}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-500">Students</span>
              <span className="text-surface-200 font-medium">{hallTickets.length > 0 ? `${hallTickets.length} selected` : 'All'}</span>
            </div>
            <div className="glow-line" />
            <div className="flex justify-between">
              <span className="text-surface-500">Format</span>
              <span className="text-surface-200 font-medium flex items-center gap-1">
                {exportFormat === 'pdf' ? <FileDown className="w-3.5 h-3.5 text-amber-400" /> : <FileText className="w-3.5 h-3.5 text-brand-400" />}
                {exportFormat.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Format selector */}
          <div className="flex gap-2 mb-4">
            {FORMAT_OPTIONS.map(f => (
              <button
                key={f.value}
                onClick={() => setExportFormat(f.value)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all border',
                  exportFormat === f.value
                    ? 'border-brand-500/50 bg-brand-950/40 text-brand-300'
                    : 'border-white/[0.07] text-surface-400 hover:text-surface-200 hover:border-white/[0.15]'
                )}
              >
                <f.icon className="w-4 h-4" />
                {f.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-rose-400 text-sm mb-4 bg-rose-950/30 border border-rose-800/40 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {done && (
            <div className="flex items-center gap-2 text-brand-400 text-sm mb-4 bg-brand-950/30 border border-brand-800/40 rounded-lg px-3 py-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>
                Downloaded <span className="font-mono">{done.filename}</span>
                {done.rowCount != null && ` (${done.rowCount.toLocaleString()} rows)`}
              </span>
            </div>
          )}

          <button
            onClick={handleExport}
            disabled={busy}
            className="btn-primary w-full justify-center text-base py-3 disabled:opacity-60"
          >
            {busy ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {pdfBusy ? 'Generating PDF…' : 'Exporting…'}</>
            ) : (
              <><Download className="w-4 h-4" /> Export {exportFormat.toUpperCase()}</>
            )}
          </button>

          <p className="text-xs text-surface-600 text-center mt-3">
            {exportFormat === 'pdf'
              ? 'PDF includes charts and formatted tables.'
              : 'Exports data from the latest available records.'}
          </p>
        </div>
      </div>

      {/* Hidden charts for PDF capture */}
      {pdfData && (
        <PdfCharts data={pdfData} chartRefs={chartRefs} />
      )}
    </div>
  );
}
