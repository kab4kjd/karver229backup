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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          description: string
          id: string
          metadata: Json | null
          user_id: string
          username: string
        }
        Insert: {
          action: string
          created_at?: string
          description: string
          id?: string
          metadata?: Json | null
          user_id: string
          username: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
          sort_order: number
          unit_multiplier: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          sort_order?: number
          unit_multiplier?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          sort_order?: number
          unit_multiplier?: number
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          note: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          note?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          note?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      debt_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          note: string | null
          paid_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          note?: string | null
          paid_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          note?: string | null
          paid_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "debt_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
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
      expense_product_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      expense_product_items: {
        Row: {
          created_at: string
          group_id: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_product_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "expense_product_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category_name: string
          created_at: string
          expense_date: string
          id: string
          note: string | null
          product_category: string | null
          product_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          category_name: string
          created_at?: string
          expense_date?: string
          id?: string
          note?: string | null
          product_category?: string | null
          product_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_name?: string
          created_at?: string
          expense_date?: string
          id?: string
          note?: string | null
          product_category?: string | null
          product_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      global_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      inventory_check_items: {
        Row: {
          created_at: string
          id: string
          item_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_check_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_check_records: {
        Row: {
          actual_stock: number
          check_id: string
          created_at: string
          difference: number
          id: string
          imported: number
          item_id: string
          item_name: string
          note: string | null
          opening_stock: number
          sold: number
          theoretical_stock: number
        }
        Insert: {
          actual_stock?: number
          check_id: string
          created_at?: string
          difference?: number
          id?: string
          imported?: number
          item_id: string
          item_name: string
          note?: string | null
          opening_stock?: number
          sold?: number
          theoretical_stock?: number
        }
        Update: {
          actual_stock?: number
          check_id?: string
          created_at?: string
          difference?: number
          id?: string
          imported?: number
          item_id?: string
          item_name?: string
          note?: string | null
          opening_stock?: number
          sold?: number
          theoretical_stock?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_check_records_check_id_fkey"
            columns: ["check_id"]
            isOneToOne: false
            referencedRelation: "inventory_checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_check_records_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_checks: {
        Row: {
          check_date: string
          check_mode: string
          created_at: string
          end_date: string
          id: string
          start_date: string
          user_id: string
        }
        Insert: {
          check_date?: string
          check_mode?: string
          created_at?: string
          end_date: string
          id?: string
          start_date: string
          user_id: string
        }
        Update: {
          check_date?: string
          check_mode?: string
          created_at?: string
          end_date?: string
          id?: string
          start_date?: string
          user_id?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          invoice_id: string
          item_name: string
          item_price: number
          quantity: number
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          invoice_id: string
          item_name: string
          item_price: number
          quantity: number
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          invoice_id?: string
          item_name?: string
          item_price?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          check_in: string
          check_out: string
          created_at: string | null
          customer_name: string | null
          discount_type: string | null
          discount_value: number | null
          duration: number
          id: string
          paid_amount: number
          payment_status: string
          room_name: string
          room_price: number
          staff_name: string | null
          tax_rate: number | null
          total_amount: number
        }
        Insert: {
          check_in: string
          check_out: string
          created_at?: string | null
          customer_name?: string | null
          discount_type?: string | null
          discount_value?: number | null
          duration: number
          id?: string
          paid_amount?: number
          payment_status?: string
          room_name: string
          room_price: number
          staff_name?: string | null
          tax_rate?: number | null
          total_amount: number
        }
        Update: {
          check_in?: string
          check_out?: string
          created_at?: string | null
          customer_name?: string | null
          discount_type?: string | null
          discount_value?: number | null
          duration?: number
          id?: string
          paid_amount?: number
          payment_status?: string
          room_name?: string
          room_price?: number
          staff_name?: string | null
          tax_rate?: number | null
          total_amount?: number
        }
        Relationships: []
      }
      items: {
        Row: {
          category_id: string | null
          created_at: string | null
          custom_quantity: boolean
          id: string
          import_shorthand: string | null
          name: string
          price: number
          shorthand: string | null
          sort_order: number
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          custom_quantity?: boolean
          id?: string
          import_shorthand?: string | null
          name: string
          price: number
          shorthand?: string | null
          sort_order?: number
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          custom_quantity?: boolean
          id?: string
          import_shorthand?: string | null
          name?: string
          price?: number
          shorthand?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      operating_hours: {
        Row: {
          end_time: string
          id: string
          start_time: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          end_time?: string
          id?: string
          start_time?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          end_time?: string
          id?: string
          start_time?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      price_list_items: {
        Row: {
          created_at: string | null
          custom_price: number
          id: string
          item_id: string
          room_group_id: string
        }
        Insert: {
          created_at?: string | null
          custom_price: number
          id?: string
          item_id: string
          room_group_id: string
        }
        Update: {
          created_at?: string | null
          custom_price?: number
          id?: string
          item_id?: string
          room_group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_list_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_items_room_group_id_fkey"
            columns: ["room_group_id"]
            isOneToOne: false
            referencedRelation: "room_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      print_settings: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          settings: Json
          template_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          settings?: Json
          template_name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          settings?: Json
          template_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          display_name: string | null
          id: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      room_groups: {
        Row: {
          block_minutes: number
          created_at: string | null
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          block_minutes?: number
          created_at?: string | null
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          block_minutes?: number
          created_at?: string | null
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      rooms: {
        Row: {
          block_minutes: number
          created_at: string | null
          group_id: string | null
          id: string
          name: string
          price: number
          sort_order: number
        }
        Insert: {
          block_minutes?: number
          created_at?: string | null
          group_id?: string | null
          id?: string
          name: string
          price?: number
          sort_order?: number
        }
        Update: {
          block_minutes?: number
          created_at?: string | null
          group_id?: string | null
          id?: string
          name?: string
          price?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "rooms_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "room_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          can_config_items: boolean
          can_config_layout: boolean
          can_config_pricelist: boolean
          can_config_print: boolean
          can_config_rooms: boolean
          can_delete_customers: boolean
          can_delete_history: boolean
          can_delete_inventory_history: boolean
          can_delete_logs: boolean
          can_edit_inventory_history: boolean
          can_view_config: boolean
          can_view_customers: boolean
          can_view_expenses: boolean
          can_view_history: boolean
          can_view_inventory: boolean
          can_view_logs: boolean
          can_view_reports: boolean
          created_at: string | null
          edit_invoice_minutes: number
          id: string
          lock_screen_enabled: boolean
          lock_screen_minutes: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          can_config_items?: boolean
          can_config_layout?: boolean
          can_config_pricelist?: boolean
          can_config_print?: boolean
          can_config_rooms?: boolean
          can_delete_customers?: boolean
          can_delete_history?: boolean
          can_delete_inventory_history?: boolean
          can_delete_logs?: boolean
          can_edit_inventory_history?: boolean
          can_view_config?: boolean
          can_view_customers?: boolean
          can_view_expenses?: boolean
          can_view_history?: boolean
          can_view_inventory?: boolean
          can_view_logs?: boolean
          can_view_reports?: boolean
          created_at?: string | null
          edit_invoice_minutes?: number
          id?: string
          lock_screen_enabled?: boolean
          lock_screen_minutes?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          can_config_items?: boolean
          can_config_layout?: boolean
          can_config_pricelist?: boolean
          can_config_print?: boolean
          can_config_rooms?: boolean
          can_delete_customers?: boolean
          can_delete_history?: boolean
          can_delete_inventory_history?: boolean
          can_delete_logs?: boolean
          can_edit_inventory_history?: boolean
          can_view_config?: boolean
          can_view_customers?: boolean
          can_view_expenses?: boolean
          can_view_history?: boolean
          can_view_inventory?: boolean
          can_view_logs?: boolean
          can_view_reports?: boolean
          created_at?: string | null
          edit_invoice_minutes?: number
          id?: string
          lock_screen_enabled?: boolean
          lock_screen_minutes?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          id: string
          preference_key: string
          preference_value: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          preference_key: string
          preference_value?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          preference_key?: string
          preference_value?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff"
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
      app_role: ["admin", "staff"],
    },
  },
} as const
