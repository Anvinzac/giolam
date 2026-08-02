Initialising login role...
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
    PostgrestVersion: "14.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
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
      custom_depletion_notices: {
        Row: {
          dismissed_at: string | null
          dismissed_by: string | null
          id: string
          ingredient_name: string
          needs_purchase: boolean
          note: string | null
          quantity: string | null
          reported_at: string
          reported_by: string
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          dismissed_at?: string | null
          dismissed_by?: string | null
          id?: string
          ingredient_name: string
          needs_purchase?: boolean
          note?: string | null
          quantity?: string | null
          reported_at?: string
          reported_by: string
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          dismissed_at?: string | null
          dismissed_by?: string | null
          id?: string
          ingredient_name?: string
          needs_purchase?: boolean
          note?: string | null
          quantity?: string | null
          reported_at?: string
          reported_by?: string
          resolved_at?: string | null
          resolved_by?: string | null
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
      employee_allowance_defaults: {
        Row: {
          allowance_key: string
          amount: number
          created_at: string
          id: string
          is_enabled: boolean
          label: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allowance_key: string
          amount?: number
          created_at?: string
          id?: string
          is_enabled?: boolean
          label?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allowance_key?: string
          amount?: number
          created_at?: string
          id?: string
          is_enabled?: boolean
          label?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          updated_at: string
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
          updated_at?: string
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
          updated_at?: string
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
      employee_ingredients: {
        Row: {
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          ingredient_id: string
          report_weekdays: number[] | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          ingredient_id: string
          report_weekdays?: number[] | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          ingredient_id?: string
          report_weekdays?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          category: string
          created_at: string
          emoji: string
          id: string
          name: string
          reference_price: number | null
          subcategory: string | null
          supplier: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          emoji: string
          id: string
          name: string
          reference_price?: number | null
          subcategory?: string | null
          supplier?: string | null
          unit: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          emoji?: string
          id?: string
          name?: string
          reference_price?: number | null
          subcategory?: string | null
          supplier?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          base_salary: number | null
          created_at: string
          default_clock_in: string | null
          default_clock_out: string | null
          department_id: string | null
          full_name: string
          hourly_rate: number | null
          id: string
          must_change_password: boolean
          shift_type: Database["public"]["Enums"]["shift_type"]
          updated_at: string
          user_id: string
          username: string | null
          work_shift: Database["public"]["Enums"]["work_shift"] | null
        }
        Insert: {
          avatar_url?: string | null
          base_salary?: number | null
          created_at?: string
          default_clock_in?: string | null
          default_clock_out?: string | null
          department_id?: string | null
          full_name?: string
          hourly_rate?: number | null
          id?: string
          must_change_password?: boolean
          shift_type?: Database["public"]["Enums"]["shift_type"]
          updated_at?: string
          user_id: string
          username?: string | null
          work_shift?: Database["public"]["Enums"]["work_shift"] | null
        }
        Update: {
          avatar_url?: string | null
          base_salary?: number | null
          created_at?: string
          default_clock_in?: string | null
          default_clock_out?: string | null
          department_id?: string | null
          full_name?: string
          hourly_rate?: number | null
          id?: string
          must_change_password?: boolean
          shift_type?: Database["public"]["Enums"]["shift_type"]
          updated_at?: string
          user_id?: string
          username?: string | null
          work_shift?: Database["public"]["Enums"]["work_shift"] | null
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
          allowance_amount: number | null
          allowance_rate_override: number | null
          base_daily_wage: number | null
          clock_in: string | null
          clock_out: string | null
          created_at: string
          entry_date: string
          extra_wage: number | null
          id: string
          is_admin_reviewed: boolean
          is_day_off: boolean
          last_employee_edit_at: string | null
          note: string | null
          off_percent: number | null
          period_id: string
          sort_order: number
          submitted_by: string | null
          total_daily_wage: number | null
          total_hours: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allowance_amount?: number | null
          allowance_rate_override?: number | null
          base_daily_wage?: number | null
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          entry_date: string
          extra_wage?: number | null
          id?: string
          is_admin_reviewed?: boolean
          is_day_off?: boolean
          last_employee_edit_at?: string | null
          note?: string | null
          off_percent?: number | null
          period_id: string
          sort_order?: number
          submitted_by?: string | null
          total_daily_wage?: number | null
          total_hours?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allowance_amount?: number | null
          allowance_rate_override?: number | null
          base_daily_wage?: number | null
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          entry_date?: string
          extra_wage?: number | null
          id?: string
          is_admin_reviewed?: boolean
          is_day_off?: boolean
          last_employee_edit_at?: string | null
          note?: string | null
          off_percent?: number | null
          period_id?: string
          sort_order?: number
          submitted_by?: string | null
          total_daily_wage?: number | null
          total_hours?: number | null
          updated_at?: string
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
      salary_published_snapshots: {
        Row: {
          allowances: Json
          breakdown: Json | null
          created_at: string
          entries: Json
          id: string
          period_id: string
          period_info: Json | null
          profile_info: Json | null
          published_at: string
          rates: Json
          salary_record_id: string
          total_salary: number
          updated_at: string
          user_id: string
        }
        Insert: {
          allowances?: Json
          breakdown?: Json | null
          created_at?: string
          entries?: Json
          id?: string
          period_id: string
          period_info?: Json | null
          profile_info?: Json | null
          published_at?: string
          rates?: Json
          salary_record_id: string
          total_salary?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          allowances?: Json
          breakdown?: Json | null
          created_at?: string
          entries?: Json
          id?: string
          period_id?: string
          period_info?: Json | null
          profile_info?: Json | null
          published_at?: string
          rates?: Json
          salary_record_id?: string
          total_salary?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_published_snapshots_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "working_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_published_snapshots_salary_record_id_fkey"
            columns: ["salary_record_id"]
            isOneToOne: false
            referencedRelation: "salary_records"
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
          updated_at: string
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
          updated_at?: string
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
          updated_at?: string
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
          shift_slot: string
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
          shift_slot?: string
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
          shift_slot?: string
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
          shift_slot: string
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
          shift_slot?: string
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
          shift_slot?: string
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
          updated_at: string
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
          updated_at?: string
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
          updated_at?: string
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
      stock_reports: {
        Row: {
          id: string
          ingredient_id: string
          is_low_stock: boolean
          remaining_quantity: number | null
          reported_at: string
          reported_by: string
          resolved_at: string | null
          resolved_by: string | null
          warning_message: string | null
        }
        Insert: {
          id?: string
          ingredient_id: string
          is_low_stock?: boolean
          remaining_quantity?: number | null
          reported_at?: string
          reported_by: string
          resolved_at?: string | null
          resolved_by?: string | null
          warning_message?: string | null
        }
        Update: {
          id?: string
          ingredient_id?: string
          is_low_stock?: boolean
          remaining_quantity?: number | null
          reported_at?: string
          reported_by?: string
          resolved_at?: string | null
          resolved_by?: string | null
          warning_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_reports_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
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
          is_archived: boolean
          off_days: string[]
          start_date: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          is_archived?: boolean
          off_days?: string[]
          start_date: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          is_archived?: boolean
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
        | "assigned"
      shift_type:
        | "basic"
        | "overtime"
        | "notice_only"
        | "lunar_rate"
        | "daily"
        | "other"
      work_shift: "morning" | "evening"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "employee"],
      registration_status: [
        "pending",
        "approved",
        "rejected",
        "modified",
        "unapproved",
        "assigned",
      ],
      shift_type: [
        "basic",
        "overtime",
        "notice_only",
        "lunar_rate",
        "daily",
        "other",
      ],
      work_shift: ["morning", "evening"],
    },
  },
} as const
A new version of Supabase CLI is available: v2.111.0 (currently installed v2.84.4)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
