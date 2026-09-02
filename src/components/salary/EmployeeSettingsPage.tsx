import { useEffect, useState } from 'react';
import { ChevronLeft, User, Briefcase, Wallet, Gift, CalendarCheck, Clock } from 'lucide-react';
import {
  AllowanceKey,
  EmployeeAllowance,
  EmployeeShiftType,
  EMPLOYEE_TYPE_LABELS,
} from '@/types/salary';
import EmployeeAllowanceEditor from './EmployeeAllowanceEditor';
import { formatVND } from './TotalSalaryDisplay';

/** Shape of the employee record needed by the settings page. */
export interface SettingsEmployee {
  user_id: string;
  username?: string | null;
  full_name: string;
  shift_type: EmployeeShiftType;
  base_salary: number;
  hourly_rate: number;
  default_clock_in: string | null;
  default_clock_out: string | null;
  department_id: string | null;
  work_shift?: string | null;
  include_in_shift_register?: boolean;
}

interface EmployeeSettingsPageProps {
  employee: SettingsEmployee;
  departments: { id: string; name: string }[];
  allowances: EmployeeAllowance[];
  isPreview: boolean;
  onNameChange: (name: string) => void;
  onShiftTypeChange: (type: EmployeeShiftType) => void;
  onDepartmentChange: (departmentId: string | null) => void;
  onBaseSalaryChange: (salary: number) => void;
  onHourlyRateChange: (rate: number) => void;
  onWorkShiftChange: (shift: 'morning' | 'evening') => void;
  onDefaultClockInChange: (time: string) => void;
  onDefaultClockOutChange: (time: string) => void;
  onIncludeShiftRegisterChange: (include: boolean) => void;
  onAllowanceToggle: (key: AllowanceKey) => void;
  onAllowanceUpdate: (key: AllowanceKey, updates: { label?: string; amount?: number }) => void;
  onAddAllowance: (label: string, amount: number) => void;
  onFlipBack: () => void;
}

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

const ToggleSwitch = ({ checked }: { checked: boolean }) => (
  <span
    className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
      checked ? 'bg-emerald-500' : 'bg-muted-foreground/30'
    }`}
  >
    <span
      className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-5' : ''
      }`}
    />
  </span>
);

const ToggleRow = ({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={() => !disabled && onChange(!checked)}
    className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 transition-opacity ${
      disabled ? 'opacity-50 cursor-default' : 'hover:bg-muted/70'
    }`}
  >
    <span className="text-left">
      <span className="block text-sm font-medium text-foreground">{label}</span>
      {description && (
        <span className="block text-[11px] text-muted-foreground mt-0.5">{description}</span>
      )}
    </span>
    <ToggleSwitch checked={checked} />
  </button>
);

/** Inline editable VND amount using the app-wide ×1000 entry convention. */
const AmountRow = ({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (next: number) => void;
}) => {
  const toShort = (v: number) => (v === 0 ? '' : Math.round(v / 1000).toString());
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(() => toShort(value));

  useEffect(() => {
    setRaw(toShort(value));
  }, [value]);

  const save = () => {
    const cleaned = raw.replace(/\D/g, '');
    let parsed = cleaned === '' ? 0 : parseInt(cleaned, 10);
    if (parsed > 0) parsed *= 1000;
    if (!isNaN(parsed) && parsed !== value) onChange(parsed);
    setEditing(false);
  };

  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40">
      <span className="text-sm text-muted-foreground">{label}</span>
      {editing && !disabled ? (
        <div className="flex items-center gap-1.5">
          <div className="relative flex items-center rounded-lg border border-primary/60 bg-background px-2 py-1">
            <input
              value={raw}
              onChange={e => setRaw(e.target.value.replace(/\D/g, ''))}
              className="absolute inset-0 w-full opacity-0 text-[15px]"
              inputMode="numeric"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') save();
                if (e.key === 'Escape') setEditing(false);
              }}
            />
            <span className="text-[15px] font-bold text-foreground pointer-events-none">
              {parseInt(raw, 10) > 0 ? parseInt(raw, 10).toLocaleString('vi-VN') : ''}
            </span>
            <span className="text-[15px] font-bold text-muted-foreground/40 pointer-events-none">
              {parseInt(raw, 10) > 0 ? '.000' : '000'}
            </span>
          </div>
          <button
            onClick={save}
            className="px-2.5 py-1 rounded-lg gradient-gold text-primary-foreground text-xs font-semibold"
          >
            OK
          </button>
          <button
            onClick={() => setEditing(false)}
            className="text-xs text-muted-foreground px-1"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => !disabled && setEditing(true)}
          className={`text-[15px] font-bold text-accent tabular-nums ${
            disabled ? 'cursor-default' : 'hover:underline'
          }`}
        >
          {formatVND(value).replace(' đ', '')}đ
        </button>
      )}
    </div>
  );
};

const SectionHeader = ({ icon: Icon, title }: { icon: typeof User; title: string }) => (
  <div className="flex items-center gap-2 mb-2">
    <Icon size={14} className="text-primary" />
    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
      {title}
    </h3>
  </div>
);

/* ------------------------------------------------------------------ */
/* Main settings page                                                  */
/* ------------------------------------------------------------------ */

export default function EmployeeSettingsPage({
  employee,
  departments,
  allowances,
  isPreview,
  onNameChange,
  onShiftTypeChange,
  onDepartmentChange,
  onBaseSalaryChange,
  onHourlyRateChange,
  onWorkShiftChange,
  onDefaultClockInChange,
  onDefaultClockOutChange,
  onIncludeShiftRegisterChange,
  onAllowanceToggle,
  onAllowanceUpdate,
  onAddAllowance,
  onFlipBack,
}: EmployeeSettingsPageProps) {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(employee.full_name);

  const guiXe = allowances.find(a => a.allowance_key === 'gui_xe');
  const otherAllowances = allowances.filter(a => a.allowance_key !== 'gui_xe');
  const includedInShiftRegister = employee.include_in_shift_register ?? true;

  const typeBadgeColor = (t: EmployeeShiftType) => {
    switch (t) {
      case 'basic': return 'bg-amber-500/20 text-amber-400';
      case 'overtime': return 'bg-cyan-500/20 text-cyan-400';
      case 'notice_only': return 'bg-purple-500/20 text-purple-400';
      case 'daily': return 'bg-emerald-500/20 text-emerald-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const handleTypePick = (type: EmployeeShiftType) => {
    if (type === employee.shift_type) return;
    if (window.confirm('Đổi loại nhân viên sẽ xóa toàn bộ dữ liệu lương hiện tại. Tiếp tục?')) {
      onShiftTypeChange(type);
    }
  };

  return (
    <div className="space-y-3">
      {/* Page header with flip-back control */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-bold text-foreground">Cài đặt nhân viên</h2>
        <button
          type="button"
          onClick={onFlipBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold gradient-gold text-primary-foreground"
        >
          <ChevronLeft size={13} />
          Về bảng lương
        </button>
      </div>

      {/* Identity */}
      <div className="glass-card p-3 space-y-2">
        <SectionHeader icon={User} title="Thông tin" />
        {editingName && !isPreview ? (
          <div className="flex items-center gap-1.5">
            <input
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { onNameChange(nameInput); setEditingName(false); }
                if (e.key === 'Escape') setEditingName(false);
              }}
              className="flex-1 px-2 py-1.5 rounded-lg bg-background border border-border text-sm text-foreground"
              autoFocus
            />
            <button
              onClick={() => { onNameChange(nameInput); setEditingName(false); }}
              className="px-2.5 py-1 rounded-lg gradient-gold text-primary-foreground text-xs font-semibold"
            >
              OK
            </button>
            <button onClick={() => setEditingName(false)} className="text-xs text-muted-foreground px-1">✕</button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { if (!isPreview) { setNameInput(employee.full_name); setEditingName(true); } }}
            className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 ${
              isPreview ? 'cursor-default' : 'hover:bg-muted/70'
            }`}
          >
            <span className="text-sm text-muted-foreground flex-shrink-0">Họ tên</span>
            <span className={`text-sm font-medium text-foreground truncate ${isPreview ? '' : 'hover:underline'}`}>
              {employee.full_name}
            </span>
          </button>
        )}
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 min-w-0">
          <span className="text-sm text-muted-foreground flex-shrink-0">Tài khoản</span>
          <span className="text-sm font-medium text-muted-foreground truncate">@{employee.username || '—'}</span>
        </div>
      </div>

      {/* Employee type */}
      <div className="glass-card p-3 space-y-2">
        <SectionHeader icon={Briefcase} title="Loại nhân viên" />
        <div className="grid grid-cols-5 gap-1">
          {(['basic', 'overtime', 'notice_only', 'lunar_rate', 'daily'] as EmployeeShiftType[]).map(type => (
            <button
              key={type}
              type="button"
              disabled={isPreview}
              onClick={() => handleTypePick(type)}
              className={`flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] font-medium transition-all ${
                employee.shift_type === type
                  ? 'gradient-gold text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              } ${isPreview ? 'cursor-default' : ''}`}
            >
              <span>{EMPLOYEE_TYPE_LABELS[type]}</span>
              <span className={`text-[8px] px-1 rounded-full ${typeBadgeColor(type)}`}>{type}</span>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">
          ⚠️ Đổi loại sẽ xóa toàn bộ dữ liệu lương hiện tại
        </p>
      </div>

      {/* Department & work shift */}
      <div className="glass-card p-3 space-y-2">
        <SectionHeader icon={Briefcase} title="Bộ phận & ca làm việc" />
        <div className="p-3 rounded-xl bg-muted/40">
          <span className="block text-sm text-muted-foreground mb-1.5">Bộ phận</span>
          <select
            value={employee.department_id || ''}
            disabled={isPreview}
            onChange={e => onDepartmentChange(e.target.value || null)}
            className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground"
          >
            <option value="">— Chưa phân bộ phận —</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          {(['morning', 'evening'] as const).map(shift => (
            <button
              key={shift}
              type="button"
              disabled={isPreview}
              onClick={() => onWorkShiftChange(shift)}
              className={`flex-1 min-w-0 py-2 px-2 rounded-xl text-xs font-medium transition-all ${
                employee.work_shift === shift
                  ? shift === 'morning'
                    ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-400/50'
                    : 'bg-accent/20 text-accent ring-1 ring-accent/50'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
            >
              <span className="block truncate">{shift === 'morning' ? 'Ca sáng' : 'Ca chiều'}</span>
              <span className="block text-[10px] font-normal opacity-70 truncate">
                {shift === 'morning' ? '8:00 – 15:00' : '15:00 – 22:00'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Default clock times */}
      <div className="glass-card p-3 space-y-2">
        <SectionHeader icon={Clock} title="Giờ chấm công mặc định" />
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 rounded-xl bg-muted/40 min-w-0">
            <span className="block text-[11px] text-muted-foreground mb-1.5">Giờ vào</span>
            <input
              type="time"
              value={employee.default_clock_in || ''}
              disabled={isPreview}
              onChange={e => onDefaultClockInChange(e.target.value)}
              className="w-full min-w-0 px-2 py-1.5 rounded-lg bg-background border border-border text-sm text-foreground"
            />
          </div>
          <div className="p-3 rounded-xl bg-muted/40 min-w-0">
            <span className="block text-[11px] text-muted-foreground mb-1.5">Giờ ra</span>
            <input
              type="time"
              value={employee.default_clock_out || ''}
              disabled={isPreview}
              onChange={e => onDefaultClockOutChange(e.target.value)}
              className="w-full min-w-0 px-2 py-1.5 rounded-lg bg-background border border-border text-sm text-foreground"
            />
          </div>
        </div>
      </div>

      {/* Salary */}
      <div className="glass-card p-3 space-y-2">
        <SectionHeader icon={Wallet} title="Lương" />
        <AmountRow
          label="Lương cơ bản"
          value={employee.base_salary || 0}
          disabled={isPreview}
          onChange={onBaseSalaryChange}
        />
        <AmountRow
          label="Lương giờ"
          value={employee.hourly_rate || 0}
          disabled={isPreview}
          onChange={onHourlyRateChange}
        />
      </div>

      {/* Parking (Gửi xe) */}
      <div className="glass-card p-3 space-y-2">
        <SectionHeader icon={Gift} title="Gửi xe" />
        <ToggleRow
          label="Áp dụng phụ cấp gửi xe"
          description={
            guiXe?.is_enabled
              ? `Đang áp dụng — ${formatVND(guiXe.amount).replace(' đ', '')}đ`
              : 'Đang tắt'
          }
          checked={guiXe?.is_enabled ?? false}
          disabled={isPreview || !guiXe}
          onChange={() => onAllowanceToggle('gui_xe')}
        />
      </div>

      {/* Additional allowances */}
      <EmployeeAllowanceEditor
        allowances={otherAllowances}
        onToggle={onAllowanceToggle}
        onUpdate={onAllowanceUpdate}
        onAddAllowance={onAddAllowance}
        isAdmin={!isPreview}
      />

      {/* Shift registration table inclusion */}
      <div className="glass-card p-3 space-y-2">
        <SectionHeader icon={CalendarCheck} title="Đăng ký ca" />
        <ToggleRow
          label="Trong bảng đăng ký ca"
          description={
            includedInShiftRegister
              ? 'Nhân viên xuất hiện trong bảng phân công ca'
              : 'Nhân viên bị ẩn khỏi bảng phân công ca'
          }
          checked={includedInShiftRegister}
          disabled={isPreview}
          onChange={onIncludeShiftRegisterChange}
        />
      </div>
    </div>
  );
}
