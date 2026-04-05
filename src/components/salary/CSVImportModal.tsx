import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, AlertCircle, CheckCircle2, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { SalaryEntry, EmployeeShiftType } from '@/types/salary';
import { calcHoursFromTimes } from '@/lib/salaryCalculations';

// ---------------------------------------------------------------------------
// CSV column specs per shift type
// ---------------------------------------------------------------------------

export interface ParsedRow {
  entry_date: string;       // YYYY-MM-DD
  sort_order: number;
  is_day_off: boolean;
  off_percent: number;
  note: string | null;
  clock_in: string | null;  // HH:MM
  clock_out: string | null; // HH:MM
  total_hours: number | null;
  allowance_rate_override: number | null;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ParseResult {
  rows: ParsedRow[];
  errors: ValidationError[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{1,2}:\d{2}$/;

function normalizeTime(raw: string): string | null {
  const t = raw.trim();
  if (!t || t === '-' || t === '—') return null;
  // Accept H:MM or HH:MM
  const match = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function normalizeDate(raw: string): string | null {
  const t = raw.trim();
  // Accept YYYY-MM-DD or DD/MM/YYYY
  if (DATE_RE.test(t)) return t;
  const dmY = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmY) {
    const d = String(dmY[1]).padStart(2, '0');
    const m = String(dmY[2]).padStart(2, '0');
    return `${dmY[3]}-${m}-${d}`;
  }
  return null;
}

function parseBool(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  return t === 'true' || t === '1' || t === 'yes' || t === 'x' || t === 'có';
}

function parsePercent(raw: string): number {
  const n = parseFloat(raw.replace('%', '').trim());
  return isNaN(n) ? 0 : n;
}

// ---------------------------------------------------------------------------
// Per-type expected headers
// ---------------------------------------------------------------------------

const HEADERS: Record<EmployeeShiftType, string[]> = {
  basic: ['date', 'note', 'is_day_off', 'off_percent', 'rate_override'],
  overtime: ['date', 'note', 'clock_out', 'is_day_off'],
  notice_only: ['date', 'note', 'clock_in', 'clock_out', 'is_day_off'],
};

const HEADER_ALIASES: Record<string, string> = {
  // date
  ngày: 'date', 'ngay': 'date', 'date': 'date',
  // note
  'ghi chú': 'note', 'ghi_chu': 'note', 'note': 'note', 'ghichu': 'note',
  // clock_in
  'giờ vào': 'clock_in', 'gio_vao': 'clock_in', 'clock_in': 'clock_in', 'vào': 'clock_in', 'vao': 'clock_in',
  // clock_out
  'giờ ra': 'clock_out', 'gio_ra': 'clock_out', 'clock_out': 'clock_out', 'ra': 'clock_out',
  // is_day_off
  'nghỉ': 'is_day_off', 'nghi': 'is_day_off', 'is_day_off': 'is_day_off', 'day_off': 'is_day_off',
  // off_percent
  'off_percent': 'off_percent', 'phần trăm nghỉ': 'off_percent', 'phan_tram_nghi': 'off_percent',
  // rate_override
  'rate_override': 'allowance_rate_override', 'phụ cấp': 'allowance_rate_override', 'phu_cap': 'allowance_rate_override',
};

function normalizeHeader(h: string): string {
  const lower = h.trim().toLowerCase();
  return HEADER_ALIASES[lower] ?? lower;
}

// ---------------------------------------------------------------------------
// Core parser
// ---------------------------------------------------------------------------

export function parseCSV(raw: string, shiftType: EmployeeShiftType, periodStart: string, periodEnd: string): ParseResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];
  const rows: ParsedRow[] = [];

  // Split lines, strip BOM
  const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length < 2) {
    errors.push({ row: 0, field: 'file', message: 'File phải có ít nhất 1 dòng tiêu đề và 1 dòng dữ liệu.' });
    return { rows, errors, warnings };
  }

  // Parse header
  const rawHeaders = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const headers = rawHeaders.map(normalizeHeader);

  // Check required columns
  const required = HEADERS[shiftType];
  const missingRequired = required.filter(r => !headers.includes(r));
  if (missingRequired.length > 0) {
    errors.push({
      row: 0,
      field: 'header',
      message: `Thiếu cột bắt buộc: ${missingRequired.join(', ')}. Cần có: ${required.join(', ')}`,
    });
    return { rows, errors, warnings };
  }

  const col = (row: string[], name: string): string => {
    const idx = headers.indexOf(name);
    return idx >= 0 ? (row[idx] ?? '').trim().replace(/^"|"$/g, '') : '';
  };

  const sortOrderMap = new Map<string, number>();

  for (let i = 1; i < lines.length; i++) {
    const rowNum = i + 1;
    // Simple CSV split (handles quoted fields with commas)
    const cells = splitCSVLine(lines[i]);

    if (cells.length < headers.length - 1) {
      warnings.push(`Dòng ${rowNum}: số cột không khớp (${cells.length} / ${headers.length}), bỏ qua.`);
      continue;
    }

    // --- date ---
    const rawDate = col(cells, 'date');
    const entry_date = normalizeDate(rawDate);
    if (!entry_date) {
      errors.push({ row: rowNum, field: 'date', message: `Ngày không hợp lệ: "${rawDate}". Dùng YYYY-MM-DD hoặc DD/MM/YYYY.` });
      continue;
    }
    if (entry_date < periodStart || entry_date > periodEnd) {
      warnings.push(`Dòng ${rowNum}: ngày ${entry_date} nằm ngoài kỳ lương (${periodStart} – ${periodEnd}), bỏ qua.`);
      continue;
    }

    // sort_order: increment per date
    const so = sortOrderMap.get(entry_date) ?? 0;
    sortOrderMap.set(entry_date, so + 1);

    // --- is_day_off ---
    const is_day_off = parseBool(col(cells, 'is_day_off'));

    // --- off_percent ---
    let off_percent = 0;
    const rawOff = col(cells, 'off_percent');
    if (rawOff) {
      off_percent = parsePercent(rawOff);
      if (![0, 25, 50, 75, 100].includes(off_percent)) {
        warnings.push(`Dòng ${rowNum}: off_percent "${rawOff}" không phải 0/25/50/75/100, dùng 0.`);
        off_percent = 0;
      }
    }

    // --- note ---
    const note = col(cells, 'note') || null;

    // --- clock_in / clock_out ---
    let clock_in: string | null = null;
    let clock_out: string | null = null;

    if (shiftType === 'notice_only' || shiftType === 'overtime') {
      const rawIn = col(cells, 'clock_in');
      const rawOut = col(cells, 'clock_out');
      if (rawIn) {
        clock_in = normalizeTime(rawIn);
        if (rawIn && !clock_in) {
          errors.push({ row: rowNum, field: 'clock_in', message: `Giờ vào không hợp lệ: "${rawIn}". Dùng HH:MM.` });
        }
      }
      if (rawOut) {
        clock_out = normalizeTime(rawOut);
        if (rawOut && !clock_out) {
          errors.push({ row: rowNum, field: 'clock_out', message: `Giờ ra không hợp lệ: "${rawOut}". Dùng HH:MM.` });
        }
      }
      if (clock_in && clock_out) {
        const h = calcHoursFromTimes(clock_in, clock_out);
        if (h === null || h <= 0) {
          errors.push({ row: rowNum, field: 'clock_out', message: `Giờ ra phải sau giờ vào (${clock_in} → ${clock_out}).` });
        }
      }
    }

    // --- rate_override ---
    let allowance_rate_override: number | null = null;
    const rawRate = col(cells, 'allowance_rate_override');
    if (rawRate) {
      const n = parseFloat(rawRate.replace('%', ''));
      if (!isNaN(n)) allowance_rate_override = n;
    }

    // --- total_hours ---
    let total_hours: number | null = null;
    if (clock_in && clock_out) {
      total_hours = calcHoursFromTimes(clock_in, clock_out);
    }

    rows.push({
      entry_date,
      sort_order: so,
      is_day_off,
      off_percent: is_day_off ? off_percent : 0,
      note,
      clock_in,
      clock_out,
      total_hours,
      allowance_rate_override,
    });
  }

  return { rows, errors, warnings };
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// ---------------------------------------------------------------------------
// Template generator
// ---------------------------------------------------------------------------

export function generateTemplate(shiftType: EmployeeShiftType, periodStart: string, periodEnd: string): string {
  const exampleDate = periodStart;
  switch (shiftType) {
    case 'basic':
      return [
        'date,note,is_day_off,off_percent,rate_override',
        `${exampleDate},Thứ Bảy,false,0,15`,
        `${exampleDate},Rằm,false,0,40`,
      ].join('\n');
    case 'overtime':
      return [
        'date,note,clock_out,is_day_off',
        `${exampleDate},Ghi chú,21:30,false`,
        `${exampleDate},,22:00,false`,
      ].join('\n');
    case 'notice_only':
      return [
        'date,note,clock_in,clock_out,is_day_off',
        `${exampleDate},Ca sáng,08:00,17:30,false`,
        `${exampleDate},Nghỉ,,, true`,
      ].join('\n');
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CSVImportModalProps {
  shiftType: EmployeeShiftType;
  periodStart: string;
  periodEnd: string;
  onImport: (rows: ParsedRow[]) => Promise<void>;
  onClose: () => void;
}

export default function CSVImportModal({ shiftType, periodStart, periodEnd, onImport, onClose }: CSVImportModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setParseResult({ rows: [], errors: [{ row: 0, field: 'file', message: 'Chỉ chấp nhận file .csv' }], warnings: [] });
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const result = parseCSV(text, shiftType, periodStart, periodEnd);
      setParseResult(result);
      setDone(false);
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleDrop = (ev: React.DragEvent) => {
    ev.preventDefault();
    const file = ev.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    if (!parseResult || parseResult.rows.length === 0) return;
    setImporting(true);
    await onImport(parseResult.rows);
    setImporting(false);
    setDone(true);
  };

  const downloadTemplate = () => {
    const csv = generateTemplate(shiftType, periodStart, periodEnd);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template_${shiftType}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasErrors = (parseResult?.errors.length ?? 0) > 0;
  const canImport = parseResult && !hasErrors && parseResult.rows.length > 0 && !done;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-0 sm:px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          className="w-full sm:max-w-lg bg-background border border-border rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border shrink-0">
            <div>
              <h2 className="font-display font-bold text-lg text-foreground">Nhập từ CSV</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Loại {shiftType === 'basic' ? 'A' : shiftType === 'overtime' ? 'B' : 'C'} · {periodStart} – {periodEnd}
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-border/60 hover:border-primary/50 rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer transition-colors group"
            >
              <Upload size={28} className="text-muted-foreground group-hover:text-primary transition-colors" />
              <p className="text-sm font-medium text-foreground">
                {fileName ?? 'Kéo thả hoặc nhấn để chọn file CSV'}
              </p>
              <p className="text-xs text-muted-foreground">Chỉ chấp nhận .csv · UTF-8</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>

            {/* Template download */}
            <button
              onClick={downloadTemplate}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              <FileText size={15} />
              Tải file mẫu (.csv)
            </button>

            {/* Validation results */}
            {parseResult && (
              <div className="space-y-3">
                {/* Errors */}
                {parseResult.errors.length > 0 && (
                  <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-destructive text-sm font-semibold">
                      <AlertCircle size={15} />
                      {parseResult.errors.length} lỗi cần sửa
                    </div>
                    {parseResult.errors.map((err, i) => (
                      <p key={i} className="text-xs text-destructive/80 pl-5">
                        {err.row > 0 ? `Dòng ${err.row} [${err.field}]: ` : ''}{err.message}
                      </p>
                    ))}
                  </div>
                )}

                {/* Warnings */}
                {parseResult.warnings.length > 0 && (
                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold">
                      <AlertCircle size={15} />
                      {parseResult.warnings.length} cảnh báo
                    </div>
                    {parseResult.warnings.map((w, i) => (
                      <p key={i} className="text-xs text-amber-400/80 pl-5">{w}</p>
                    ))}
                  </div>
                )}

                {/* Success summary */}
                {!hasErrors && parseResult.rows.length > 0 && (
                  <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3">
                    <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                      <CheckCircle2 size={15} />
                      {parseResult.rows.length} dòng hợp lệ, sẵn sàng nhập
                    </div>
                  </div>
                )}

                {/* Preview toggle */}
                {parseResult.rows.length > 0 && (
                  <button
                    onClick={() => setShowPreview(p => !p)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-muted/50 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span>Xem trước dữ liệu ({parseResult.rows.length} dòng)</span>
                    {showPreview ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                )}

                {showPreview && parseResult.rows.length > 0 && (
                  <div className="rounded-xl border border-border overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/50 text-muted-foreground">
                            <th className="px-3 py-2 text-left font-semibold">Ngày</th>
                            <th className="px-3 py-2 text-left font-semibold">Ghi chú</th>
                            {(shiftType === 'notice_only' || shiftType === 'overtime') && (
                              <>
                                {shiftType === 'notice_only' && <th className="px-3 py-2 text-center font-semibold">Vào</th>}
                                <th className="px-3 py-2 text-center font-semibold">Ra</th>
                                <th className="px-3 py-2 text-center font-semibold">Giờ</th>
                              </>
                            )}
                            {shiftType === 'basic' && <th className="px-3 py-2 text-right font-semibold">PC%</th>}
                            <th className="px-3 py-2 text-center font-semibold">Nghỉ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {parseResult.rows.map((r, i) => (
                            <tr key={i} className={r.is_day_off ? 'opacity-50' : ''}>
                              <td className="px-3 py-1.5 font-medium">{r.entry_date.slice(5)}</td>
                              <td className="px-3 py-1.5 text-muted-foreground max-w-[120px] truncate">{r.note ?? '—'}</td>
                              {(shiftType === 'notice_only' || shiftType === 'overtime') && (
                                <>
                                  {shiftType === 'notice_only' && <td className="px-3 py-1.5 text-center text-emerald-400">{r.clock_in ?? '—'}</td>}
                                  <td className="px-3 py-1.5 text-center text-accent">{r.clock_out ?? '—'}</td>
                                  <td className="px-3 py-1.5 text-center">{r.total_hours ?? '—'}</td>
                                </>
                              )}
                              {shiftType === 'basic' && (
                                <td className="px-3 py-1.5 text-right">{r.allowance_rate_override ?? '—'}</td>
                              )}
                              <td className="px-3 py-1.5 text-center">{r.is_day_off ? '✓' : ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Done state */}
            {done && (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 flex items-center gap-3">
                <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
                <p className="text-sm text-emerald-400 font-medium">Nhập thành công {parseResult?.rows.length} dòng.</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 pt-3 border-t border-border shrink-0 flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-muted text-muted-foreground text-sm font-semibold hover:bg-muted/80 transition-colors"
            >
              {done ? 'Đóng' : 'Hủy'}
            </button>
            {!done && (
              <button
                onClick={handleImport}
                disabled={!canImport || importing}
                className="flex-1 py-3 rounded-xl gradient-gold text-primary-foreground text-sm font-semibold disabled:opacity-40 transition-opacity"
              >
                {importing ? 'Đang nhập...' : `Nhập ${parseResult?.rows.length ?? 0} dòng`}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
