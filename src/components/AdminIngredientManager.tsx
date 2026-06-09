import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Users, Search, Plus, X, Check, Package, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { WEEKDAYS, frequencyLabel } from '@/lib/reportFrequency';

interface Employee {
  user_id: string;
  full_name: string;
  username: string | null;
  department_id?: string | null;
  department_name?: string;
}

interface Ingredient {
  id: string;
  name: string;
  emoji: string;
  unit: string;
  category: string;
}

interface Assignment {
  id: string;
  employee_id: string;
  ingredient_id: string;
  report_weekdays: number[] | null;
}

const CATEGORY_EMOJI: Record<string, string> = {
  vegetables: '🥬', sauces: '🫙', spices: '🧂', grains: '🌾',
  oils: '🫒', proteins: '🥩', dairy: '🧀', gas: '⛽',
  equipment: '🔧', tissue: '🧻', takeaway: '🥡', extra: '✨', wash: '🧽',
};

export default function AdminIngredientManager() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchEmployee, setSearchEmployee] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [addIngredientSearch, setAddIngredientSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(0);
  const [freqEditorFor, setFreqEditorFor] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: ings }, { data: assigns }] = await Promise.all([
      // Only real staff: department-less profiles are test accounts and
      // shouldn't clutter the assignment picker.
      supabase.from('profiles').select('user_id, full_name, username, department_id').not('department_id', 'is', null),
      supabase.from('ingredients').select('*').order('category').order('name'),
      supabase.from('employee_ingredients').select('*'),
    ]);
    setEmployees((profiles as Employee[]) || []);
    setIngredients((ings as Ingredient[]) || []);
    setAssignments((assigns as Assignment[]) || []);
    setLoading(false);
  };

  const filteredEmployees = useMemo(() => {
    if (!searchEmployee) return employees;
    const q = searchEmployee.toLowerCase();
    return employees.filter(e =>
      e.full_name?.toLowerCase().includes(q) ||
      e.username?.toLowerCase().includes(q)
    );
  }, [employees, searchEmployee]);

  const assignedIngredientIds = useMemo(() => {
    if (!selectedEmployee) return new Set<string>();
    return new Set(assignments.filter(a => a.employee_id === selectedEmployee).map(a => a.ingredient_id));
  }, [assignments, selectedEmployee]);

  const availableIngredients = useMemo(() => {
    let ings = ingredients;
    if (categoryFilter !== 'all') {
      ings = ings.filter(i => i.category === categoryFilter);
    }
    if (addIngredientSearch) {
      const q = addIngredientSearch.toLowerCase();
      ings = ings.filter(i => i.name.toLowerCase().includes(q));
    }
    return ings;
  }, [ingredients, categoryFilter, addIngredientSearch]);

  const categories = useMemo(() => {
    const cats = new Set(ingredients.map(i => i.category));
    return Array.from(cats);
  }, [ingredients]);

  const selectedEmployeeData = useMemo(
    () => employees.find(emp => emp.user_id === selectedEmployee) || null,
    [employees, selectedEmployee]
  );

  const scrollToPage = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handleSelectEmployee = (employeeId: string) => {
    setSelectedEmployee(employeeId);
    setFreqEditorFor(null);
    scrollToPage(1);
  };

  const assignIngredient = async (employeeId: string, ingredientId: string) => {
    if (assignments.some(a => a.employee_id === employeeId && a.ingredient_id === ingredientId)) return;

    const tempId = `pending-${employeeId}-${ingredientId}-${Date.now()}`;
    const optimisticAssignment: Assignment = {
      id: tempId,
      employee_id: employeeId,
      ingredient_id: ingredientId,
      report_weekdays: null,
    };

    setAssignments(prev => [...prev, optimisticAssignment]);

    const { data, error } = await supabase
      .from('employee_ingredients')
      .insert({
        employee_id: employeeId,
        ingredient_id: ingredientId,
      })
      .select('*')
      .single();

    if (error) {
      setAssignments(prev => prev.filter(a => a.id !== tempId));
      toast.error(error.message);
      return;
    }

    if (data) {
      setAssignments(prev => prev.map(a => a.id === tempId ? data as Assignment : a));
    }
  };

  const removeAssignment = async (assignmentId: string) => {
    const { error } = await supabase.from('employee_ingredients').delete().eq('id', assignmentId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Đã xóa phân công');
    loadData();
  };

  const updateWeekdays = async (assignmentId: string, weekdays: number[] | null) => {
    // Optimistic local update so the chips respond instantly.
    setAssignments(prev => prev.map(a =>
      a.id === assignmentId ? { ...a, report_weekdays: weekdays } : a
    ));
    const { error } = await supabase
      .from('employee_ingredients')
      .update({ report_weekdays: weekdays && weekdays.length > 0 ? weekdays : null } as any)
      .eq('id', assignmentId);
    if (error) {
      toast.error(error.message);
      loadData(); // reconcile on failure
    }
  };

  const toggleWeekday = (assignment: Assignment, day: number) => {
    const current = assignment.report_weekdays || [];
    const next = current.includes(day)
      ? current.filter(d => d !== day)
      : [...current, day].sort((a, b) => a - b);
    updateWeekdays(assignment.id, next.length > 0 ? next : null);
  };

  if (loading) {
    return <div className="glass-card p-8 text-center text-muted-foreground">Đang tải...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {[
          { label: 'Nhân viên', icon: Users },
          { label: 'Đã giao', icon: Package },
          { label: 'Thêm', icon: Plus },
        ].map((item, idx) => {
          const Icon = item.icon;
          const disabled = idx > 0 && !selectedEmployee;
          return (
            <button
              key={item.label}
              type="button"
              disabled={disabled}
              onClick={() => scrollToPage(idx)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors disabled:opacity-40 ${
                currentPage === idx
                  ? 'gradient-gold text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={13} />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="-mx-4 overflow-hidden">
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${currentPage * 100}%)` }}
        >
          <section className="w-full min-w-0 shrink-0 px-4">
            <div className="glass-card p-4 space-y-3">
              <h3 className="font-display font-semibold flex items-center gap-2">
                <Users size={16} />
                Chọn nhân viên
              </h3>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchEmployee}
                  onChange={e => setSearchEmployee(e.target.value)}
                  placeholder="Tìm nhân viên..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1 max-h-[65vh] overflow-y-auto">
                {filteredEmployees.map(emp => (
                  <button
                    key={emp.user_id}
                    onClick={() => handleSelectEmployee(emp.user_id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedEmployee === emp.user_id
                        ? 'gradient-gold text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    {emp.full_name}
                    {emp.username && <span className="text-xs opacity-60 ml-1">({emp.username})</span>}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="w-full min-w-0 shrink-0 px-4">
            <div className="glass-card p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-display font-semibold flex items-center gap-2">
                    <Package size={16} />
                    Nguyên liệu đã phân công
                  </h3>
                  {selectedEmployeeData && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {selectedEmployeeData.full_name}
                      {selectedEmployeeData.username && ` (${selectedEmployeeData.username})`}
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {assignedIngredientIds.size} món
                </span>
              </div>

              {!selectedEmployee ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Chọn nhân viên trước.
                </div>
              ) : (
                <>
                  <div className="space-y-1 max-h-[62vh] overflow-y-auto">
                    {ingredients
                      .filter(i => assignedIngredientIds.has(i.id))
                      .map(ing => {
                        const assignment = assignments.find(a => a.ingredient_id === ing.id && a.employee_id === selectedEmployee);
                        if (!assignment) return null;
                        const isEditing = freqEditorFor === assignment.id;
                        const isDaily = !assignment.report_weekdays || assignment.report_weekdays.length === 0;
                        return (
                          <div key={ing.id} className="rounded-lg bg-muted/50 px-3 py-2 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <span>{ing.emoji}</span>
                                <span className="text-sm truncate">{ing.name}</span>
                                <span className="text-xs text-muted-foreground shrink-0">({ing.unit})</span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => setFreqEditorFor(isEditing ? null : assignment.id)}
                                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                                    isEditing
                                      ? 'bg-primary/20 text-primary'
                                      : isDaily
                                        ? 'bg-muted text-muted-foreground hover:text-foreground'
                                        : 'bg-primary/15 text-primary'
                                  }`}
                                >
                                  <CalendarDays size={12} />
                                  {frequencyLabel(assignment.report_weekdays)}
                                </button>
                                <button
                                  onClick={() => removeAssignment(assignment.id)}
                                  className="p-1 rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            </div>

                            {isEditing && (
                              <div className="pt-1 space-y-2 border-t border-border/40">
                                <p className="text-[11px] text-muted-foreground pt-1.5">
                                  Chọn ngày cần báo cáo. Không chọn = hàng ngày.
                                </p>
                                <div className="flex gap-1 flex-wrap">
                                  {WEEKDAYS.map(w => {
                                    const active = (assignment.report_weekdays || []).includes(w.value);
                                    return (
                                      <button
                                        key={w.value}
                                        onClick={() => toggleWeekday(assignment, w.value)}
                                        className={`w-9 h-9 rounded-lg text-[12px] font-semibold transition-colors ${
                                          active
                                            ? 'gradient-gold text-primary-foreground'
                                            : 'bg-muted text-muted-foreground hover:bg-muted/70'
                                        }`}
                                      >
                                        {w.short}
                                      </button>
                                    );
                                  })}
                                </div>
                                <div className="flex gap-2 pt-0.5">
                                  <button
                                    onClick={() => updateWeekdays(assignment.id, null)}
                                    className="text-[11px] px-2.5 py-1 rounded-full bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    Hàng ngày
                                  </button>
                                  <button
                                    onClick={() => updateWeekdays(assignment.id, [1])}
                                    className="text-[11px] px-2.5 py-1 rounded-full bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    1 lần/tuần (T2)
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    {assignedIngredientIds.size === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">Chưa phân công nguyên liệu nào</p>
                    )}
                  </div>

                  <button
                    onClick={() => scrollToPage(2)}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-muted hover:bg-muted/80 transition-colors text-sm"
                  >
                    <Plus size={14} />
                    Thêm nguyên liệu
                  </button>
                </>
              )}
            </div>
          </section>

          <section className="w-full min-w-0 shrink-0 px-4">
            <div className="glass-card p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-display font-semibold flex items-center gap-2">
                    <Plus size={16} />
                    Thêm nguyên liệu
                  </h3>
                  {selectedEmployeeData && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {selectedEmployeeData.full_name}
                      {selectedEmployeeData.username && ` (${selectedEmployeeData.username})`}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => scrollToPage(1)}
                  disabled={!selectedEmployee}
                  className="px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-xs disabled:opacity-40"
                >
                  Đã giao
                </button>
              </div>

              {!selectedEmployee ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Chọn nhân viên trước.
                </div>
              ) : (
                <>
                  <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    <button
                      onClick={() => setCategoryFilter('all')}
                      className={`shrink-0 px-3 py-1 rounded-full text-xs transition-colors ${
                        categoryFilter === 'all' ? 'gradient-gold text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      Tất cả
                    </button>
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        className={`shrink-0 px-3 py-1 rounded-full text-xs transition-colors ${
                          categoryFilter === cat ? 'gradient-gold text-primary-foreground' : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {CATEGORY_EMOJI[cat] || '📦'} {cat}
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={addIngredientSearch}
                      onChange={e => setAddIngredientSearch(e.target.value)}
                      placeholder="Tìm nguyên liệu..."
                      className="w-full pl-9 pr-4 py-2 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>

                  <div className="space-y-1 max-h-[58vh] overflow-y-auto">
                    {availableIngredients.map(ing => {
                      const isAssigned = assignedIngredientIds.has(ing.id);
                      return (
                        <button
                          key={ing.id}
                          type="button"
                          onClick={() => assignIngredient(selectedEmployee, ing.id)}
                          disabled={isAssigned}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors disabled:opacity-100 ${
                            isAssigned
                              ? 'bg-primary/10 text-foreground'
                              : 'bg-muted/50 hover:bg-muted'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="shrink-0">{ing.emoji}</span>
                            <span className="text-sm truncate">{ing.name}</span>
                            <span className="text-xs text-muted-foreground shrink-0">({ing.unit})</span>
                          </div>
                          <span className={`p-1 rounded-md transition-colors shrink-0 ${
                            isAssigned ? 'bg-primary/20 text-primary' : 'text-muted-foreground'
                          }`}>
                            <Check size={14} />
                          </span>
                        </button>
                      );
                    })}
                    {availableIngredients.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">Không tìm thấy nguyên liệu</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
