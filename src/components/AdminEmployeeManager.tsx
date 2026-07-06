import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Pencil, Plus, X, Check, UserPlus } from "lucide-react";
import { toast } from "sonner";

interface Employee {
  id: string;
  user_id: string;
  full_name: string;
  username: string | null;
  shift_type: string;
  default_clock_in: string | null;
  default_clock_out: string | null;
  department_id: string | null;
  base_salary: number;
  hourly_rate: number;
}

interface Dept {
  id: string;
  name: string;
}

const TEMP_HIDDEN_TEST_USERNAMES = new Set(['test_loaia', 'test_loaib', 'test_loaic']);

export default function AdminEmployeeManager() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    full_name: "",
    shift_type: "basic",
    default_clock_in: "",
    default_clock_out: "",
    department_id: "",
    base_salary: 0,
    hourly_rate: 25000,
  });

  // Add form state
  const [addForm, setAddForm] = useState({
    username: "",
    full_name: "",
    shift_type: "basic",
    default_clock_in: "08:00",
    default_clock_out: "17:00",
    department_id: "",
    base_salary: 5000000,
    hourly_rate: 25000,
  });

  useEffect(() => {
    const load = async () => {
      const [{ data: profiles }, { data: depts }] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("departments").select("id, name"),
      ]);
      setEmployees(((profiles as Employee[]) || []).filter(emp => !TEMP_HIDDEN_TEST_USERNAMES.has((emp.username || "").toLowerCase())));
      setDepartments((depts as Dept[]) || []);
      setLoading(false);
    };
    load();
  }, []);

  const startEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setEditForm({
      full_name: emp.full_name || "",
      shift_type: emp.shift_type || "basic",
      default_clock_in: emp.default_clock_in || "",
      default_clock_out: emp.default_clock_out || "",
      department_id: emp.department_id || "",
      base_salary: emp.base_salary || 0,
      hourly_rate: emp.hourly_rate || 25000,
    });
  };

  const saveEdit = async (emp: Employee) => {
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: editForm.full_name,
        shift_type: editForm.shift_type as any,
        default_clock_in: editForm.default_clock_in || null,
        default_clock_out: editForm.default_clock_out || null,
        department_id: editForm.department_id || null,
        base_salary: editForm.base_salary,
        hourly_rate: editForm.hourly_rate,
      })
      .eq("id", emp.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    setEmployees((prev) =>
      prev.map((e) =>
        e.id === emp.id
          ? { ...e, ...editForm, default_clock_in: editForm.default_clock_in || null, default_clock_out: editForm.default_clock_out || null, department_id: editForm.department_id || null }
          : e
      )
    );
    setEditingId(null);
    toast.success("Đã cập nhật");
  };

  const addEmployee = async () => {
    if (!addForm.username || !addForm.full_name) {
      toast.error("Cần nhập tên đăng nhập và họ tên");
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const res = await supabase.functions.invoke("manage-employee", {
      body: { action: "create", ...addForm, department_id: addForm.department_id || null },
    });

    if (res.error || res.data?.error) {
      toast.error(res.data?.error || res.error?.message || "Lỗi tạo nhân viên");
      return;
    }

    toast.success("Đã thêm nhân viên (mật khẩu mặc định: abc12345)");
    setShowAdd(false);
    setAddForm({ username: "", full_name: "", shift_type: "basic", default_clock_in: "08:00", default_clock_out: "17:00", department_id: "", base_salary: 5000000, hourly_rate: 25000 });

    // Refresh
    const { data: profiles } = await supabase.from("profiles").select("*");
    setEmployees(((profiles as Employee[]) || []).filter(emp => !TEMP_HIDDEN_TEST_USERNAMES.has((emp.username || "").toLowerCase())));
  };

  const getDeptName = (id: string | null) => departments.find((d) => d.id === id)?.name || "—";

  const shiftLabels: Record<string, string> = { basic: "Loại A", overtime: "Loại B", notice_only: "Loại C", lunar_rate: "Loại D", daily: "Loại E" };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-6 h-6 rounded-full gradient-gold animate-glow-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Add button */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => setShowAdd(!showAdd)}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl gradient-gold text-primary-foreground font-display font-semibold text-sm"
      >
        <UserPlus size={16} />
        Thêm nhân viên
      </motion.button>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowAdd(false)}
          />
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.97 }}
            className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-card border border-border shadow-2xl p-5 space-y-4 mx-0 sm:mx-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display font-semibold text-foreground">Thêm nhân viên mới</h2>
              <button onClick={() => setShowAdd(false)} className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Thông tin cơ bản</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <input
                    type="text"
                    value={addForm.username}
                    onChange={(e) => setAddForm((f) => ({ ...f, username: e.target.value }))}
                    className="px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="Tên đăng nhập"
                  />
                  <input
                    type="text"
                    value={addForm.full_name}
                    onChange={(e) => setAddForm((f) => ({ ...f, full_name: e.target.value }))}
                    className="px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="Họ tên"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Phòng ban</label>
                <select
                  value={addForm.department_id}
                  onChange={(e) => setAddForm((f) => ({ ...f, department_id: e.target.value }))}
                  className="w-full mt-1 px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">— Chọn phòng ban —</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Loại nhân viên</label>
                <div className="grid grid-cols-5 gap-1 mt-1">
                  {(["basic", "overtime", "notice_only", "lunar_rate", "daily"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setAddForm((f) => ({ ...f, shift_type: t }))}
                      className={`py-2 rounded-lg text-xs font-medium transition-all ${
                        addForm.shift_type === t
                          ? "gradient-gold text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {shiftLabels[t]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Lương</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div className="relative">
                    <input
                      type="number"
                      value={addForm.base_salary || ""}
                      onChange={(e) => setAddForm((f) => ({ ...f, base_salary: Number(e.target.value) }))}
                      className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      placeholder="5.000.000"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">đ</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      value={addForm.hourly_rate || ""}
                      onChange={(e) => setAddForm((f) => ({ ...f, hourly_rate: Number(e.target.value) }))}
                      className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      placeholder="25.000"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">đ/h</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Giờ làm mặc định</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div>
                    <span className="text-[10px] text-muted-foreground">Vào ca</span>
                    <input
                      type="time"
                      value={addForm.default_clock_in}
                      onChange={(e) => setAddForm((f) => ({ ...f, default_clock_in: e.target.value }))}
                      className="w-full mt-0.5 px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground">Tan ca</span>
                    <input
                      type="time"
                      value={addForm.default_clock_out}
                      onChange={(e) => setAddForm((f) => ({ ...f, default_clock_out: e.target.value }))}
                      className="w-full mt-0.5 px-3 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowAdd(false)}
                className="flex-1 py-2.5 rounded-xl bg-muted text-muted-foreground font-medium text-sm"
              >
                Hủy
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={addEmployee}
                className="flex-1 py-2.5 rounded-xl gradient-gold text-primary-foreground font-semibold text-sm"
              >
                Tạo nhân viên
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Employee list */}
      {employees.map((emp) => (
        <div key={emp.id} className="glass-card p-4">
          {editingId === emp.id ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Họ tên</label>
                  <input
                    type="text"
                    value={editForm.full_name}
                    onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Loại ca</label>
                  <select
                    value={editForm.shift_type}
                    onChange={(e) => setEditForm((f) => ({ ...f, shift_type: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="basic">Loại A</option>
                    <option value="overtime">Loại B</option>
                    <option value="notice_only">Loại C</option>
                    <option value="lunar_rate">Loại D</option>
                    <option value="daily">Loại E</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Giờ vào</label>
                  <input
                    type="time"
                    value={editForm.default_clock_in}
                    onChange={(e) => setEditForm((f) => ({ ...f, default_clock_in: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Giờ ra</label>
                  <input
                    type="time"
                    value={editForm.default_clock_out}
                    onChange={(e) => setEditForm((f) => ({ ...f, default_clock_out: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Phòng ban</label>
                  <select
                    value={editForm.department_id}
                    onChange={(e) => setEditForm((f) => ({ ...f, department_id: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="">— Không —</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Lương cơ bản</label>
                  <input
                    type="number"
                    value={editForm.base_salary}
                    onChange={(e) => setEditForm((f) => ({ ...f, base_salary: Number(e.target.value) }))}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="5000000"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Lương giờ</label>
                  <input
                    type="number"
                    value={editForm.hourly_rate}
                    onChange={(e) => setEditForm((f) => ({ ...f, hourly_rate: Number(e.target.value) }))}
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="25000"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => saveEdit(emp)} className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Check size={16} />
                </motion.button>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setEditingId(null)} className="p-2 rounded-xl bg-muted text-muted-foreground">
                  <X size={16} />
                </motion.button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-foreground">{emp.full_name || "Chưa đặt tên"}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {shiftLabels[emp.shift_type] || emp.shift_type} · {emp.base_salary?.toLocaleString() || 0}đ · {getDeptName(emp.department_id)}
                </div>
              </div>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => startEdit(emp)} className="p-2 rounded-xl bg-muted text-muted-foreground">
                <Pencil size={16} />
              </motion.button>
            </div>
          )}
        </div>
      ))}

      {employees.length === 0 && (
        <div className="glass-card p-8 text-center text-muted-foreground text-sm">
          Chưa có nhân viên nào
        </div>
      )}
    </div>
  );
}
