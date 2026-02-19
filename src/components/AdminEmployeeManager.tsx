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
}

interface Dept {
  id: string;
  name: string;
}

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
  });

  // Add form state
  const [addForm, setAddForm] = useState({
    username: "",
    full_name: "",
    shift_type: "basic",
    default_clock_in: "08:00",
    default_clock_out: "17:00",
    department_id: "",
  });

  useEffect(() => {
    const load = async () => {
      const [{ data: profiles }, { data: depts }] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("departments").select("id, name"),
      ]);
      setEmployees((profiles as Employee[]) || []);
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
    setAddForm({ username: "", full_name: "", shift_type: "basic", default_clock_in: "08:00", default_clock_out: "17:00", department_id: "" });

    // Refresh
    const { data: profiles } = await supabase.from("profiles").select("*");
    setEmployees((profiles as Employee[]) || []);
  };

  const getDeptName = (id: string | null) => departments.find((d) => d.id === id)?.name || "—";

  const shiftLabels: Record<string, string> = { basic: "Cơ bản", overtime: "Tăng ca", notice_only: "Chỉ ghi chú" };

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

      {/* Add form */}
      {showAdd && (
        <div className="glass-card p-4 space-y-3">
          <h3 className="font-display font-semibold text-sm text-foreground">Nhân viên mới</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Tên đăng nhập</label>
              <input
                type="text"
                value={addForm.username}
                onChange={(e) => setAddForm((f) => ({ ...f, username: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="vd: nguyenvan"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Họ tên</label>
              <input
                type="text"
                value={addForm.full_name}
                onChange={(e) => setAddForm((f) => ({ ...f, full_name: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="Nguyễn Văn A"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Loại ca</label>
              <select
                value={addForm.shift_type}
                onChange={(e) => setAddForm((f) => ({ ...f, shift_type: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="basic">Cơ bản</option>
                <option value="overtime">Tăng ca</option>
                <option value="notice_only">Chỉ ghi chú</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Giờ vào</label>
              <input
                type="time"
                value={addForm.default_clock_in}
                onChange={(e) => setAddForm((f) => ({ ...f, default_clock_in: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Giờ ra</label>
              <input
                type="time"
                value={addForm.default_clock_out}
                onChange={(e) => setAddForm((f) => ({ ...f, default_clock_out: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Phòng ban</label>
            <select
              value={addForm.department_id}
              onChange={(e) => setAddForm((f) => ({ ...f, department_id: e.target.value }))}
              className="w-full mt-1 px-3 py-2 rounded-xl bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">— Chọn —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={addEmployee}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl gradient-gold text-primary-foreground font-semibold text-sm"
            >
              <Plus size={14} /> Tạo
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 rounded-xl bg-muted text-muted-foreground text-sm"
            >
              Hủy
            </motion.button>
          </div>
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
                    <option value="basic">Cơ bản</option>
                    <option value="overtime">Tăng ca</option>
                    <option value="notice_only">Chỉ ghi chú</option>
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
                  {shiftLabels[emp.shift_type] || emp.shift_type} · {emp.default_clock_in || "—"}–{emp.default_clock_out || "—"} · {getDeptName(emp.department_id)}
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
