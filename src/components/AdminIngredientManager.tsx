import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Users, Search, Plus, X, Check, Package } from 'lucide-react';
import { toast } from 'sonner';

interface Employee {
  user_id: string;
  full_name: string;
  username: string | null;
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
}

const CATEGORY_EMOJI: Record<string, string> = {
  vegetables: '🥬', sauces: '🫙', spices: '🧂', grains: '🌾',
  oils: '🫒', proteins: '🥩', dairy: '🧀', gas: '⛽',
  equipment: '🔧', tissue: '🧻',
};

export default function AdminIngredientManager() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchEmployee, setSearchEmployee] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [showAddIngredient, setShowAddIngredient] = useState(false);
  const [addIngredientSearch, setAddIngredientSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: ings }, { data: assigns }] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name, username'),
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
    let ings = ingredients.filter(i => !assignedIngredientIds.has(i.id));
    if (categoryFilter !== 'all') {
      ings = ings.filter(i => i.category === categoryFilter);
    }
    if (addIngredientSearch) {
      const q = addIngredientSearch.toLowerCase();
      ings = ings.filter(i => i.name.toLowerCase().includes(q));
    }
    return ings;
  }, [ingredients, assignedIngredientIds, categoryFilter, addIngredientSearch]);

  const categories = useMemo(() => {
    const cats = new Set(ingredients.map(i => i.category));
    return Array.from(cats);
  }, [ingredients]);

  const assignIngredient = async (employeeId: string, ingredientId: string) => {
    const { error } = await supabase.from('employee_ingredients').insert({
      employee_id: employeeId,
      ingredient_id: ingredientId,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Đã phân công');
    loadData();
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

  if (loading) {
    return <div className="glass-card p-8 text-center text-muted-foreground">Đang tải...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Employee list */}
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
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {filteredEmployees.map(emp => (
            <button
              key={emp.user_id}
              onClick={() => setSelectedEmployee(emp.user_id)}
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

      {/* Selected employee's assigned ingredients */}
      {selectedEmployee && (
        <>
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold flex items-center gap-2">
                <Package size={16} />
                Nguyên liệu đã phân công
              </h3>
              <span className="text-xs text-muted-foreground">
                {assignedIngredientIds.size} nguyên liệu
              </span>
            </div>
            <div className="space-y-1">
              {ingredients
                .filter(i => assignedIngredientIds.has(i.id))
                .map(ing => {
                  const assignment = assignments.find(a => a.ingredient_id === ing.id && a.employee_id === selectedEmployee);
                  return (
                    <div key={ing.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        <span>{ing.emoji}</span>
                        <span className="text-sm">{ing.name}</span>
                        <span className="text-xs text-muted-foreground">({ing.unit})</span>
                      </div>
                      <button
                        onClick={() => removeAssignment(assignment!.id)}
                        className="p-1 rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              {assignedIngredientIds.size === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Chưa phân công nguyên liệu nào</p>
              )}
            </div>
          </div>

          {/* Add ingredient */}
          <div className="glass-card p-4 space-y-3">
            <button
              onClick={() => setShowAddIngredient(!showAddIngredient)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-muted hover:bg-muted/80 transition-colors text-sm"
            >
              <Plus size={14} />
              Thêm nguyên liệu
            </button>

            {showAddIngredient && (
              <div className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setCategoryFilter('all')}
                    className={`px-3 py-1 rounded-full text-xs transition-colors ${
                      categoryFilter === 'all' ? 'gradient-gold text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    Tất cả
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-3 py-1 rounded-full text-xs transition-colors ${
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

                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {availableIngredients.map(ing => (
                    <div key={ing.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        <span>{ing.emoji}</span>
                        <span className="text-sm">{ing.name}</span>
                        <span className="text-xs text-muted-foreground">({ing.unit})</span>
                      </div>
                      <button
                        onClick={() => assignIngredient(selectedEmployee, ing.id)}
                        className="p-1 rounded-md hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  ))}
                  {availableIngredients.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Không tìm thấy nguyên liệu</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
