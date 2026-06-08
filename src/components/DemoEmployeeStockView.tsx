import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { AlertTriangle, CheckCircle2, Clock, ChevronDown, Eye, User } from 'lucide-react'
import { toast } from 'sonner'

interface AssignedIngredient {
  id: string
  name: string
  emoji: string
  unit: string
  category: string
}

interface StockReport {
  id: string
  ingredient_id: string
  remaining_quantity: number | null
  warning_message: string | null
  is_low_stock: boolean
  reported_at: string
  resolved_at: string | null
}

const CATEGORY_EMOJI: Record<string, string> = {
  vegetables: '🥬', sauces: '🫙', spices: '🧂', grains: '🌾',
  oils: '🫒', proteins: '🥩', dairy: '🧀', gas: '⛽',
  equipment: '🔧', tissue: '🧻', takeaway: '🥡', extra: '✨', wash: '🧽',
}

export default function DemoEmployeeStockView() {
  const [employees, setEmployees] = useState<{ id: string; full_name: string; username: string | null }[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null)
  const [ingredients, setIngredients] = useState<AssignedIngredient[]>([])
  const [reports, setReports] = useState<StockReport[]>([])
  const [loading, setLoading] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  useEffect(() => {
    loadEmployees()
  }, [])

  const loadEmployees = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, username')
      .order('full_name')
    if (error) {
      toast.error(error.message)
    } else {
      setEmployees(data || [])
    }
  }

  const loadEmployeeView = async (employeeId: string) => {
    setLoading(true)
    const { data: assigned } = await supabase
      .from('employee_ingredients')
      .select('ingredient_id, ingredients(id, name, emoji, unit, category)')
      .eq('employee_id', employeeId)

    if (assigned?.length) {
      const ings = assigned
        .map((a: any) => a.ingredients)
        .filter(Boolean)
      setIngredients(ings)
    } else {
      setIngredients([])
    }

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
    const { data: existingReports } = await supabase
      .from('stock_reports')
      .select('id, ingredient_id, remaining_quantity, warning_message, is_low_stock, reported_at, resolved_at')
      .eq('reported_by', employeeId)
      .gte('reported_at', startOfMonth)
      .order('reported_at', { ascending: false })

    if (existingReports?.length) {
      setReports(existingReports as StockReport[])
    } else {
      setReports([])
    }
    setLoading(false)
  }

  const handleEmployeeSelect = (employeeId: string) => {
    setSelectedEmployee(employeeId)
    setDropdownOpen(false)
    loadEmployeeView(employeeId)
  }

  const getIngredientReport = (ingredientId: string) => {
    return reports.find(r => r.ingredient_id === ingredientId)
  }

  const selectedEmployeeData = employees.find(e => e.id === selectedEmployee)

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Eye size={16} className="text-muted-foreground" />
          <h3 className="font-display font-semibold text-sm text-foreground">
            Xem trước góc nhìn nhân viên
          </h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Chọn một nhân viên để xem trang báo cáo tồn kho của họ
        </p>

        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border border-border text-sm text-left"
          >
            <User size={14} className="text-muted-foreground" />
            {selectedEmployeeData ? (
              <span className="text-foreground">{selectedEmployeeData.full_name}{selectedEmployeeData.username ? ` (${selectedEmployeeData.username})` : ''}</span>
            ) : (
              <span className="text-muted-foreground">Chọn nhân viên...</span>
            )}
            <ChevronDown size={14} className="ml-auto text-muted-foreground" />
          </button>

          {dropdownOpen && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg max-h-60 overflow-y-auto">
              {employees.map(employee => (
                <button
                  key={employee.id}
                  onClick={() => handleEmployeeSelect(employee.id)}
                  className={`w-full px-3 py-2 text-sm text-left hover:bg-muted transition-colors ${
                    selectedEmployee === employee.id ? 'bg-muted/80 text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {employee.full_name}{employee.username ? ` (${employee.username})` : ''}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedEmployee && loading && (
        <div className="glass-card p-8 text-center text-muted-foreground">Đang tải...</div>
      )}

      {selectedEmployee && !loading && (
        <div className="space-y-3">
          <div className="glass-card p-3 bg-muted/30">
            <p className="text-xs text-muted-foreground">
              <span className="text-foreground font-medium">Đang xem:</span> Góc nhìn của {selectedEmployeeData?.full_name}
            </p>
          </div>

          {ingredients.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <p className="text-muted-foreground text-sm">Nhân viên này chưa được phân công nguyên liệu nào.</p>
            </div>
          ) : (
            ingredients.map((ing) => {
              const report = getIngredientReport(ing.id)
              return (
                <div
                  key={ing.id}
                  className="glass-card p-4 space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{ing.emoji}</span>
                    <div className="flex-1">
                      <h3 className="font-medium">{ing.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {CATEGORY_EMOJI[ing.category] || '📦'} Đơn vị: {ing.unit}
                      </p>
                    </div>
                  </div>

                  {report && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground p-2 rounded-lg bg-muted/50">
                      {report.resolved_at ? (
                        <CheckCircle2 size={14} className="text-green-500" />
                      ) : report.is_low_stock ? (
                        <AlertTriangle size={14} className="text-destructive" />
                      ) : (
                        <Clock size={14} />
                      )}
                      <span>
                        {report.resolved_at
                          ? 'Đã xử lý'
                          : report.warning_message
                          ? `Báo cáo: ${report.remaining_quantity ?? '—'} ${ing.unit} - ${report.warning_message}`
                          : `Báo cáo: ${report.remaining_quantity ?? '—'} ${ing.unit}`}
                      </span>
                    </div>
                  )}

                  <div className="space-y-2 opacity-50 pointer-events-none">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder={`Tồn kho (${ing.unit})`}
                        className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none"
                        disabled
                      />
                      <label className="flex items-center gap-1 text-sm cursor-default">
                        <input
                          type="checkbox"
                          className="rounded border-border"
                          disabled
                        />
                        <span className="text-destructive text-xs">Sắp hết</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      placeholder="Ghi chú (tùy chọn)"
                      className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none"
                      disabled
                    />
                    <button
                      className="w-full py-2 rounded-lg gradient-gold text-primary-foreground text-sm font-medium opacity-50 cursor-default"
                      disabled
                    >
                      Báo cáo
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
