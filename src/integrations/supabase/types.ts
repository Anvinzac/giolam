export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      branches: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_allowances: {
        Row: {
          allowance_key: string
          amount: number
          created_at: string
          id: string
          is_enabled: boolean
          label: string
          period_id: string
          user_id: string
        }
        Insert: {
          allowance_key: string
          amount?: number
          created_at?: string
          id?: string
          is_enabled?: boolean
          label?: string
          period_id: string
          user_id: string
        }
        Update: {
          allowance_key?: string
          amount?: number
          created_at?: string
          id?: string
          is_enabled?: boolean
          label?: string
          period_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_allowances_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "working_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_clock_in: string | null
          default_clock_out: string | null
          department_id: string | null
          full_name: string
          id: string
          must_change_password: boolean
          shift_type: Database["public"]["Enums"]["shift_type"]
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_clock_in?: string | null
          default_clock_out?: string | null
          department_id?: string | null
          full_name?: string
          id?: string
          must_change_password?: boolean
          shift_type?: Database["public"]["Enums"]["shift_type"]
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_clock_in?: string | null
          default_clock_out?: string | null
          department_id?: string | null
          full_name?: string
          id?: string
          must_change_password?: boolean
          shift_type?: Database["public"]["Enums"]["shift_type"]
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_entries: {
        Row: {
          allowance_amount: number
          allowance_rate_override: number | null
          base_daily_wage: number
          clock_in: string | null
          clock_out: string | null
          created_at: string
          entry_date: string
          extra_wage: number
          id: string
          is_day_off: boolean
          note: string | null
          off_percent: number
          period_id: string
          sort_order: number
          total_daily_wage: number
          total_hours: number | null
          user_id: string
        }
        Insert: {
          allowance_amount?: number
          allowance_rate_override?: number | null
          base_daily_wage?: number
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          entry_date: string
          extra_wage?: number
          id?: string
          is_day_off?: boolean
          note?: string | null
          off_percent?: number
          period_id: string
          sort_order?: number
          total_daily_wage?: number
          total_hours?: number | null
          user_id: string
        }
        Update: {
          allowance_amount?: number
          allowance_rate_override?: number | null
          base_daily_wage?: number
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          entry_date?: string
          extra_wage?: number
          id?: string
          is_day_off?: boolean
          note?: string | null
          off_percent?: number
          period_id?: string
          sort_order?: number
          total_daily_wage?: number
          total_hours?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_entries_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "working_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_records: {
        Row: {
          created_at: string
          id: string
          period_id: string
          published_at: string | null
          salary_breakdown: Json | null
          status: string
          total_salary: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          period_id: string
          published_at?: string | null
          salary_breakdown?: Json | null
          status?: string
          total_salary?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          period_id?: string
          published_at?: string | null
          salary_breakdown?: Json | null
          status?: string
          total_salary?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_records_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "working_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_registrations: {
        Row: {
          admin_clock_in: string | null
          admin_clock_out: string | null
          admin_note: string | null
          clock_in: string | null
          clock_out: string | null
          created_at: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          shift_date: string
          status: Database["public"]["Enums"]["registration_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_clock_in?: string | null
          admin_clock_out?: string | null
          admin_note?: string | null
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          shift_date: string
          status?: Database["public"]["Enums"]["registration_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_clock_in?: string | null
          admin_clock_out?: string | null
          admin_note?: string | null
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          shift_date?: string
          status?: Database["public"]["Enums"]["registration_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shifts: {
        Row: {
          clock_in: string | null
          clock_out: string | null
          created_at: string
          id: string
          is_active: boolean
          main_clock_in: string | null
          main_clock_out: string | null
          notice: string | null
          overtime_clock_in: string | null
          overtime_clock_out: string | null
          period_id: string
          shift_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          main_clock_in?: string | null
          main_clock_out?: string | null
          notice?: string | null
          overtime_clock_in?: string | null
          overtime_clock_out?: string | null
          period_id: string
          shift_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          main_clock_in?: string | null
          main_clock_out?: string | null
          notice?: string | null
          overtime_clock_in?: string | null
          overtime_clock_out?: string | null
          period_id?: string
          shift_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "working_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      special_day_rates: {
        Row: {
          created_at: string
          day_type: string
          description_vi: string
          id: string
          period_id: string
          rate_percent: number
          sort_order: number
          special_date: string
        }
        Insert: {
          created_at?: string
          day_type: string
          description_vi?: string
          id?: string
          period_id: string
          rate_percent?: number
          sort_order?: number
          special_date: string
        }
        Update: {
          created_at?: string
          day_type?: string
          description_vi?: string
          id?: string
          period_id?: string
          rate_percent?: number
          sort_order?: number
          special_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "special_day_rates_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "working_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      working_periods: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          off_days: string[]
          start_date: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          off_days?: string[]
          start_date: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          off_days?: string[]
          start_date?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      expire_past_pending_registrations: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "employee"
      registration_status:
        | "pending"
        | "approved"
        | "rejected"
        | "modified"
        | "unapproved"
      shift_type: "basic" | "overtime" | "notice_only"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "employee"],
      registration_status: [
        "pending",
        "approved",
        "rejected",
        "modified",
        "unapproved",
      ],
      shift_type: ["basic", "overtime", "notice_only"],
    },
  },
} as const
