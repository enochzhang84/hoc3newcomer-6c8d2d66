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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      adult_class_checkins: {
        Row: {
          checkin_at: string
          created_at: string
          fellowship: string | null
          id: string
          kind: string
          name: string
          notes: string | null
        }
        Insert: {
          checkin_at?: string
          created_at?: string
          fellowship?: string | null
          id?: string
          kind: string
          name: string
          notes?: string | null
        }
        Update: {
          checkin_at?: string
          created_at?: string
          fellowship?: string | null
          id?: string
          kind?: string
          name?: string
          notes?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      attendance_records: {
        Row: {
          children_students: number
          children_teachers: number
          created_at: string
          id: string
          notes: string | null
          record_date: string
          updated_at: string
          worship_count: number
        }
        Insert: {
          children_students?: number
          children_teachers?: number
          created_at?: string
          id?: string
          notes?: string | null
          record_date: string
          updated_at?: string
          worship_count?: number
        }
        Update: {
          children_students?: number
          children_teachers?: number
          created_at?: string
          id?: string
          notes?: string | null
          record_date?: string
          updated_at?: string
          worship_count?: number
        }
        Relationships: []
      }
      contacts: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          email: string | null
          fellowship: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          wechat: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          fellowship?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          wechat?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          fellowship?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          wechat?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      duty_personnel: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      duty_schedules: {
        Row: {
          created_at: string
          id: string
          live_person: string | null
          live_person_2: string | null
          ppt_person: string | null
          schedule_type: string
          slot_time: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          live_person?: string | null
          live_person_2?: string | null
          ppt_person?: string | null
          schedule_type: string
          slot_time: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          live_person?: string | null
          live_person_2?: string | null
          ppt_person?: string | null
          schedule_type?: string
          slot_time?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          qr_token: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          qr_token?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          qr_token?: string
        }
        Relationships: []
      }
      feedbacks: {
        Row: {
          contact: string
          created_at: string
          description: string | null
          fellowship: string | null
          id: string
          images: string[]
          name: string
          title: string
        }
        Insert: {
          contact: string
          created_at?: string
          description?: string | null
          fellowship?: string | null
          id?: string
          images?: string[]
          name: string
          title: string
        }
        Update: {
          contact?: string
          created_at?: string
          description?: string | null
          fellowship?: string | null
          id?: string
          images?: string[]
          name?: string
          title?: string
        }
        Relationships: []
      }
      fellowship_checkins: {
        Row: {
          checkin_date: string
          contact: string | null
          created_at: string
          email: string | null
          fellowship: string
          id: string
          name: string
          prayer_request: string | null
        }
        Insert: {
          checkin_date: string
          contact?: string | null
          created_at?: string
          email?: string | null
          fellowship: string
          id?: string
          name: string
          prayer_request?: string | null
        }
        Update: {
          checkin_date?: string
          contact?: string | null
          created_at?: string
          email?: string | null
          fellowship?: string
          id?: string
          name?: string
          prayer_request?: string | null
        }
        Relationships: []
      }
      fellowships: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      hospitality_ministry_entries: {
        Row: {
          created_at: string
          holy_communion: boolean
          id: string
          location: string | null
          panel_key: string
          service_date: string | null
          service_item: string | null
          sort_order: number
          updated_at: string
          worker: string | null
        }
        Insert: {
          created_at?: string
          holy_communion?: boolean
          id?: string
          location?: string | null
          panel_key: string
          service_date?: string | null
          service_item?: string | null
          sort_order?: number
          updated_at?: string
          worker?: string | null
        }
        Update: {
          created_at?: string
          holy_communion?: boolean
          id?: string
          location?: string | null
          panel_key?: string
          service_date?: string | null
          service_item?: string | null
          sort_order?: number
          updated_at?: string
          worker?: string | null
        }
        Relationships: []
      }
      kids_class_enrollment_snapshots: {
        Row: {
          class_id: string
          class_name: string | null
          created_at: string
          id: string
          snapshot_date: string
          student_count: number
          track: string
        }
        Insert: {
          class_id: string
          class_name?: string | null
          created_at?: string
          id?: string
          snapshot_date?: string
          student_count?: number
          track: string
        }
        Update: {
          class_id?: string
          class_name?: string | null
          created_at?: string
          id?: string
          snapshot_date?: string
          student_count?: number
          track?: string
        }
        Relationships: []
      }
      meal_plans: {
        Row: {
          attendees: number
          category: string
          created_at: string
          id: string
          meal_type: string | null
          notes: string | null
          plan_date: string
          updated_at: string
        }
        Insert: {
          attendees?: number
          category?: string
          created_at?: string
          id?: string
          meal_type?: string | null
          notes?: string | null
          plan_date: string
          updated_at?: string
        }
        Update: {
          attendees?: number
          category?: string
          created_at?: string
          id?: string
          meal_type?: string | null
          notes?: string | null
          plan_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      meal_types: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          images: string[]
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          images?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          images?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      registrations: {
        Row: {
          address: string | null
          age_group: string | null
          city: string | null
          created_at: string
          district: string | null
          email: string | null
          event_id: string | null
          faith: string | null
          faith_other: string | null
          faith_years: number | null
          follow_up_person: string | null
          gender: string | null
          id: string
          invited_by: string | null
          is_first_visit: boolean | null
          marital_status: string | null
          name: string
          name_en: string | null
          notes: string | null
          phone: string | null
          referrer_other: string | null
          referrer_type: string | null
          source: string
          source_channel: string | null
          spouse_name: string | null
          wants_followup: boolean | null
          wants_info: boolean | null
          wants_visit: boolean | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          age_group?: string | null
          city?: string | null
          created_at?: string
          district?: string | null
          email?: string | null
          event_id?: string | null
          faith?: string | null
          faith_other?: string | null
          faith_years?: number | null
          follow_up_person?: string | null
          gender?: string | null
          id?: string
          invited_by?: string | null
          is_first_visit?: boolean | null
          marital_status?: string | null
          name: string
          name_en?: string | null
          notes?: string | null
          phone?: string | null
          referrer_other?: string | null
          referrer_type?: string | null
          source?: string
          source_channel?: string | null
          spouse_name?: string | null
          wants_followup?: boolean | null
          wants_info?: boolean | null
          wants_visit?: boolean | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          age_group?: string | null
          city?: string | null
          created_at?: string
          district?: string | null
          email?: string | null
          event_id?: string | null
          faith?: string | null
          faith_other?: string | null
          faith_years?: number | null
          follow_up_person?: string | null
          gender?: string | null
          id?: string
          invited_by?: string | null
          is_first_visit?: boolean | null
          marital_status?: string | null
          name?: string
          name_en?: string | null
          notes?: string | null
          phone?: string | null
          referrer_other?: string | null
          referrer_type?: string | null
          source?: string
          source_channel?: string | null
          spouse_name?: string | null
          wants_followup?: boolean | null
          wants_info?: boolean | null
          wants_visit?: boolean | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      retreat_registrations: {
        Row: {
          bed: string | null
          bus: string | null
          can_pickup: number | null
          cell: string | null
          chinese_name: string
          church: string | null
          confirmation_no: string | null
          created_at: string
          email: string | null
          entry_no: number
          first_name: string | null
          gender: string | null
          id: string
          last_name: string | null
          need_pickup: number | null
          paid: boolean
          program: string | null
          serial_no: string | null
          topic: string | null
          updated_at: string
          user_notes: string | null
        }
        Insert: {
          bed?: string | null
          bus?: string | null
          can_pickup?: number | null
          cell?: string | null
          chinese_name: string
          church?: string | null
          confirmation_no?: string | null
          created_at?: string
          email?: string | null
          entry_no?: number
          first_name?: string | null
          gender?: string | null
          id?: string
          last_name?: string | null
          need_pickup?: number | null
          paid?: boolean
          program?: string | null
          serial_no?: string | null
          topic?: string | null
          updated_at?: string
          user_notes?: string | null
        }
        Update: {
          bed?: string | null
          bus?: string | null
          can_pickup?: number | null
          cell?: string | null
          chinese_name?: string
          church?: string | null
          confirmation_no?: string | null
          created_at?: string
          email?: string | null
          entry_no?: number
          first_name?: string | null
          gender?: string | null
          id?: string
          last_name?: string | null
          need_pickup?: number | null
          paid?: boolean
          program?: string | null
          serial_no?: string | null
          topic?: string | null
          updated_at?: string
          user_notes?: string | null
        }
        Relationships: []
      }
      service_applications: {
        Row: {
          created_at: string
          gender: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          service_project: string
          wechat: string | null
        }
        Insert: {
          created_at?: string
          gender?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          service_project: string
          wechat?: string | null
        }
        Update: {
          created_at?: string
          gender?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          service_project?: string
          wechat?: string | null
        }
        Relationships: []
      }
      sunday_class_schedule: {
        Row: {
          class_location: string | null
          class_name: string | null
          course_id: string | null
          course_name: string | null
          created_at: string
          id: string
          notes: string | null
          slot_time: string
          sort_order: number
          student_count: number
          teacher_name: string | null
          track: string | null
          updated_at: string
          weekly_topic: string | null
        }
        Insert: {
          class_location?: string | null
          class_name?: string | null
          course_id?: string | null
          course_name?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          slot_time: string
          sort_order?: number
          student_count?: number
          teacher_name?: string | null
          track?: string | null
          updated_at?: string
          weekly_topic?: string | null
        }
        Update: {
          class_location?: string | null
          class_name?: string | null
          course_id?: string | null
          course_name?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          slot_time?: string
          sort_order?: number
          student_count?: number
          teacher_name?: string | null
          track?: string | null
          updated_at?: string
          weekly_topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sunday_class_schedule_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "sunday_school_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      sunday_school_checkins: {
        Row: {
          checkin_date: string
          contact: string | null
          course_id: string | null
          course_name: string | null
          created_at: string
          email: string | null
          id: string
          name: string
        }
        Insert: {
          checkin_date: string
          contact?: string | null
          course_id?: string | null
          course_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
        }
        Update: {
          checkin_date?: string
          contact?: string | null
          course_id?: string | null
          course_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sunday_school_checkins_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "sunday_school_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      sunday_school_courses: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      sunday_school_teachers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          last_messages_seen_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          last_messages_seen_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          last_messages_seen_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "viewer" | "super_admin"
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
      app_role: ["admin", "user", "viewer", "super_admin"],
    },
  },
} as const
