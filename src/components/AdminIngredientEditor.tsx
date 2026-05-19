import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';

interface Ingredient {
  id: string;
  name: string;
  emoji: string;
  unit: string;
  category: string;
  subcategory: string | null;
  reference_price: number | null;
  supplier: string | null;
}

const CATEGORIES = [
  { id: 'vegetables', name: 'Rau Củ', emoji: '🥬' },
  { id: 'sauces', name: 'Nước Chấm', emoji: '🫙' },
  { id: 'spices', name: 'Gia Vị', emoji: '🧂' },
  { id: 'grains', name: 'Ngũ Cốc', emoji: '🌾' },
  { id: 'oils', name: 'Dầu Mỡ', emoji: '🫒' },
  { id: 'proteins', name: 'Đạm', emoji: '🥩' },
  { id: 'dairy', name: 'Sữa', emoji: '🧀' },
  { id: 'gas', name: 'Gas', emoji: '⛽' },
  { id: 'equipment', name: 'Dụng Cụ', emoji: '🔧' },
  { id: 'tissue', name: 'Vệ Sinh', emoji: '🧻' },
];

const UNITS = ['kg', 'g', 'lít', 'ml', 'cái', 'gói', 'chai', 'hộp', 'bịch', 'lon', 'cuộn', 'tá', 'bình', 'đôi'];

export default function AdminIngredientEditor() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState<Omit<Ingredient, 'id'>>({
    name: '', emoji: '📦', unit: 'kg', category: 'vegetables',
    subcategory: null, reference_price: null, supplier: null,
  });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ingredients')
      .select('*')
      .order('category')
      .order('name');
    if (error) toast.error(error.message);
    else setIngredients(data || []);
    setLoading(false);
  };

  const filtered = ingredients.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'all' || i.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const resetForm = () => {
    setForm({ name: '', emoji: '📦', unit: 'kg', category: 'vegetables', subcategory: null, reference_price: null, supplier: null });
    setShowAdd(false);
    setEditingId(null);
  };

  const handleAdd = async () => {
    if (!form.name.trim()) { toast.error('Tên nguyên liệu không được để trống'); return; }
    const id = `${form.category.substring(0, 3)}_${Date.now()}`;
    const { error } = await supabase.from('ingredients').insert({ ...form, id });
    if (error) { toast.error(error.message); return; }
    toast.success('Đã thêm');
    resetForm();
    load();
  };

  const handleUpdate = async (id: string) => {
    const { error } = await supabase.from('ingredients').update(form).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Đã cập nhật');
    resetForm();
    load();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Xóa "${name}"? Hành động này không thể hoàn tác.`)) return;
    const { error } = await supabase.from('ingredients').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Đã xóa');
    load();
  };

  const startEdit = (ing: Ingredient) => {
    setEditingId(ing.id);
    setForm({
      name: ing.name, emoji: ing.emoji, unit: ing.unit, category: ing.category,
      subcategory: ing.subcategory, reference_price: ing.reference_price, supplier: ing.supplier,
    });
  };

  if (loading) return <div className="glass-card p-8 text-center text-muted-foreground">Đang tải...</div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm nguyên liệu..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setCategoryFilter('all')} className={`px-3 py-1.5 rounded-full text-xs ${categoryFilter === 'all' ? 'gradient-gold text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>Tất cả</button>
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={() => setCategoryFilter(c.id)} className={`px-3 py-1.5 rounded-full text-xs ${categoryFilter === c.id ? 'gradient-gold text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              {c.emoji} {c.name}
            </button>
          ))}
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1 px-3 py-2 rounded-xl gradient-gold text-primary-foreground text-sm font-medium">
          <Plus size={14} /> Thêm
        </button>
      </div>

      {showAdd && (
        <div className="glass-card p-4 space-y-3">
          <h3 className="font-display font-semibold text-sm">Thêm nguyên liệu mới</h3>
          <IngredientForm form={form} setForm={setForm} onSubmit={handleAdd} onCancel={resetForm} submitLabel="Thêm" />
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(ing => (
          <div key={ing.id} className="glass-card p-4">
            {editingId === ing.id ? (
              <div className="space-y-3">
                <IngredientForm form={form} setForm={setForm} onSubmit={() => handleUpdate(ing.id)} onCancel={resetForm} submitLabel="Lưu" />
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{ing.emoji}</span>
                  <div>
                    <h4 className="font-medium">{ing.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {CATEGORIES.find(c => c.id === ing.category)?.emoji} {CATEGORIES.find(c => c.id === ing.category)?.name} · {ing.unit}
                      {ing.reference_price && ` · ${ing.reference_price}k`}
                      {ing.supplier && ` · ${ing.supplier}`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(ing)} className="p-2 rounded-lg hover:bg-muted transition-colors"><Pencil size={14} /></button>
                  <button onClick={() => handleDelete(ing.id, ing.name)} className="p-2 rounded-lg hover:bg-destructive/20 text-destructive transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="glass-card p-8 text-center text-muted-foreground">Không tìm thấy nguyên liệu nào</div>
        )}
      </div>
    </div>
  );
}

function IngredientForm({ form, setForm, onSubmit, onCancel, submitLabel }: {
  form: Omit<Ingredient, 'id'>;
  setForm: (f: Omit<Ingredient, 'id'>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
}) {
  const update = (field: string, value: any) => setForm({ ...form, [field]: value });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Emoji</label>
          <input type="text" value={form.emoji} onChange={e => update('emoji', e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm" />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground">Tên</label>
          <input type="text" value={form.name} onChange={e => update('name', e.target.value)} placeholder="Tên nguyên liệu" className="w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Đơn vị</label>
          <select value={form.unit} onChange={e => update('unit', e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm">
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Danh mục</label>
          <select value={form.category} onChange={e => update('category', e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm">
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Giá tham chiếu (k)</label>
          <input type="number" value={form.reference_price ?? ''} onChange={e => update('reference_price', e.target.value ? Number(e.target.value) : null)} className="w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Nhà cung cấp</label>
          <input type="text" value={form.supplier ?? ''} onChange={e => update('supplier', e.target.value || null)} className="w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Danh mục con</label>
          <input type="text" value={form.subcategory ?? ''} onChange={e => update('subcategory', e.target.value || null)} className="w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-muted text-sm">Hủy</button>
        <button onClick={onSubmit} className="px-4 py-2 rounded-lg gradient-gold text-primary-foreground text-sm font-medium">{submitLabel}</button>
      </div>
    </div>
  );
}
