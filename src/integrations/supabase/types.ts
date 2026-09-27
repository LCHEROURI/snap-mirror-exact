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
      goal_checkins: {
        Row: {
          created_at: string
          goal_id: string
          id: string
          note: string | null
          progress: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          goal_id: string
          id?: string
          note?: string | null
          progress?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          goal_id?: string
          id?: string
          note?: string | null
          progress?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_checkins_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          description: string | null
          id: string
          progress: number
          status: string
          target_date: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          progress?: number
          status?: string
          target_date?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          progress?: number
          status?: string
          target_date?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          completed_at: string
          created_at: string
          id: string
          message_count: number
          mood_score: number | null
          preview: string | null
          session_id: string | null
          session_type: string
          started_at: string
          title: string
          updated_at: string
          user_id: string
          word_count: number
        }
        Insert: {
          completed_at?: string
          created_at?: string
          id?: string
          message_count?: number
          mood_score?: number | null
          preview?: string | null
          session_id?: string | null
          session_type?: string
          started_at?: string
          title?: string
          updated_at?: string
          user_id?: string
          word_count?: number
        }
        Update: {
          completed_at?: string
          created_at?: string
          id?: string
          message_count?: number
          mood_score?: number | null
          preview?: string | null
          session_id?: string | null
          session_type?: string
          started_at?: string
          title?: string
          updated_at?: string
          user_id?: string
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "journal_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
          user_id?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "journal_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          mood_score: number | null
          session_type: string
          started_at: string
          status: string
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          mood_score?: number | null
          session_type?: string
          started_at?: string
          status?: string
          title?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          mood_score?: number | null
          session_type?: string
          started_at?: string
          status?: string
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      memories: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: string
          importance: number
          kind: string
          source_session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          importance?: number
          kind?: string
          source_session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          importance?: number
          kind?: string
          source_session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memories_source_session_id_fkey"
            columns: ["source_session_id"]
            isOneToOne: false
            referencedRelation: "journal_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      mood_entries: {
        Row: {
          id: string
          note: string | null
          recorded_at: string
          score: number
          session_id: string | null
          user_id: string
        }
        Insert: {
          id?: string
          note?: string | null
          recorded_at?: string
          score: number
          session_id?: string | null
          user_id: string
        }
        Update: {
          id?: string
          note?: string | null
          recorded_at?: string
          score?: number
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mood_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "journal_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          created_at: string
          id: string
          name: string
          relationship: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          relationship?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          relationship?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ai_memory_enabled: boolean
          created_at: string
          display_name: string | null
          id: string
          journaling_intention: string | null
          onboarded_at: string | null
          reminder_preference: string
          updated_at: string
        }
        Insert: {
          ai_memory_enabled?: boolean
          created_at?: string
          display_name?: string | null
          id: string
          journaling_intention?: string | null
          onboarded_at?: string | null
          reminder_preference?: string
          updated_at?: string
        }
        Update: {
          ai_memory_enabled?: boolean
          created_at?: string
          display_name?: string | null
          id?: string
          journaling_intention?: string | null
          onboarded_at?: string | null
          reminder_preference?: string
          updated_at?: string
        }
        Relationships: []
      }
      session_goals: {
        Row: {
          goal_id: string
          session_id: string
          user_id: string
        }
        Insert: {
          goal_id: string
          session_id: string
          user_id: string
        }
        Update: {
          goal_id?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_goals_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_goals_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "journal_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_people: {
        Row: {
          person_id: string
          session_id: string
          user_id: string
        }
        Insert: {
          person_id: string
          session_id: string
          user_id: string
        }
        Update: {
          person_id?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_people_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_people_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "journal_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_summaries: {
        Row: {
          created_at: string
          id: string
          mood_score: number | null
          next_prompt: string | null
          notable_moments: string[]
          session_id: string
          summary: string
          themes: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mood_score?: number | null
          next_prompt?: string | null
          notable_moments?: string[]
          session_id: string
          summary: string
          themes?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mood_score?: number | null
          next_prompt?: string | null
          notable_moments?: string[]
          session_id?: string
          summary?: string
          themes?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_summaries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "journal_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_topics: {
        Row: {
          session_id: string
          topic_id: string
          user_id: string
        }
        Insert: {
          session_id: string
          topic_id: string
          user_id: string
        }
        Update: {
          session_id?: string
          topic_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_topics_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "journal_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      weekly_reports: {
        Row: {
          content: Json
          created_at: string
          id: string
          user_id: string
          week_start: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          user_id: string
          week_start: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
