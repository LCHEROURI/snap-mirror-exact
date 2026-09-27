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
      ai_usage: {
        Row: {
          created_at: string
          id: number
          kind: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          kind: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: never
          kind?: string
          user_id?: string
        }
        Relationships: []
      }
      entry_people: {
        Row: {
          created_at: string
          entry_id: string
          person_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_id: string
          person_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          entry_id?: string
          person_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entry_people_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_people_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_topics: {
        Row: {
          created_at: string
          entry_id: string
          topic_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_id: string
          topic_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          entry_id?: string
          topic_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entry_topics_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
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
          user_id?: string
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
          created_from_entry_id: string | null
          description: string | null
          id: string
          next_actions: Json
          progress: number
          status: string
          target_date: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_from_entry_id?: string | null
          description?: string | null
          id?: string
          next_actions?: Json
          progress?: number
          status?: string
          target_date?: string | null
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          created_from_entry_id?: string | null
          description?: string | null
          id?: string
          next_actions?: Json
          progress?: number
          status?: string
          target_date?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_created_from_entry_id_fkey"
            columns: ["created_from_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          analysis: Json | null
          analysis_error: string | null
          analysis_status: string
          analyzed_at: string | null
          completed_at: string
          created_at: string
          dismissed_goal_candidates: string[]
          id: string
          message_count: number
          mood_score: number | null
          narrative: string | null
          preview: string | null
          session_id: string | null
          session_type: string
          started_at: string
          summary: string | null
          summary_embedding: unknown
          summary_embedding_status: string
          title: string
          updated_at: string
          user_id: string
          word_count: number
        }
        Insert: {
          analysis?: Json | null
          analysis_error?: string | null
          analysis_status?: string
          analyzed_at?: string | null
          completed_at?: string
          created_at?: string
          dismissed_goal_candidates?: string[]
          id?: string
          message_count?: number
          mood_score?: number | null
          narrative?: string | null
          preview?: string | null
          session_id?: string | null
          session_type?: string
          started_at?: string
          summary?: string | null
          summary_embedding?: unknown
          summary_embedding_status?: string
          title?: string
          updated_at?: string
          user_id?: string
          word_count?: number
        }
        Update: {
          analysis?: Json | null
          analysis_error?: string | null
          analysis_status?: string
          analyzed_at?: string | null
          completed_at?: string
          created_at?: string
          dismissed_goal_candidates?: string[]
          id?: string
          message_count?: number
          mood_score?: number | null
          narrative?: string | null
          preview?: string | null
          session_id?: string | null
          session_type?: string
          started_at?: string
          summary?: string | null
          summary_embedding?: unknown
          summary_embedding_status?: string
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
          client_item_id: string | null
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          client_item_id?: string | null
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
          user_id?: string
        }
        Update: {
          client_item_id?: string | null
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
          rolling_summary: string | null
          rolling_summary_count: number
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
          rolling_summary?: string | null
          rolling_summary_count?: number
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
          rolling_summary?: string | null
          rolling_summary_count?: number
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
          confidence_score: number
          content: string
          created_at: string
          embedding: string | null
          embedding_error: string | null
          embedding_model: string | null
          embedding_status: string
          embedding_v: unknown
          id: string
          importance: number
          importance_score: number
          journal_entry_id: string | null
          kind: string
          last_referenced_at: string | null
          memory_type: string
          previous_content: string | null
          source_session_id: string | null
          superseded_by: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence_score?: number
          content: string
          created_at?: string
          embedding?: string | null
          embedding_error?: string | null
          embedding_model?: string | null
          embedding_status?: string
          embedding_v?: unknown
          id?: string
          importance?: number
          importance_score?: number
          journal_entry_id?: string | null
          kind?: string
          last_referenced_at?: string | null
          memory_type?: string
          previous_content?: string | null
          source_session_id?: string | null
          superseded_by?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          confidence_score?: number
          content?: string
          created_at?: string
          embedding?: string | null
          embedding_error?: string | null
          embedding_model?: string | null
          embedding_status?: string
          embedding_v?: unknown
          id?: string
          importance?: number
          importance_score?: number
          journal_entry_id?: string | null
          kind?: string
          last_referenced_at?: string | null
          memory_type?: string
          previous_content?: string | null
          source_session_id?: string | null
          superseded_by?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memories_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memories_source_session_id_fkey"
            columns: ["source_session_id"]
            isOneToOne: false
            referencedRelation: "journal_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memories_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "memories"
            referencedColumns: ["id"]
          },
        ]
      }
      mood_entries: {
        Row: {
          id: string
          journal_entry_id: string | null
          label: string | null
          note: string | null
          recorded_at: string
          score: number
          session_id: string | null
          user_id: string
        }
        Insert: {
          id?: string
          journal_entry_id?: string | null
          label?: string | null
          note?: string | null
          recorded_at?: string
          score: number
          session_id?: string | null
          user_id?: string
        }
        Update: {
          id?: string
          journal_entry_id?: string | null
          label?: string | null
          note?: string | null
          recorded_at?: string
          score?: number
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mood_entries_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
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
          name_key: string | null
          notes: string | null
          relationship: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          name_key?: string | null
          notes?: string | null
          relationship?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          name_key?: string | null
          notes?: string | null
          relationship?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ai_memory_enabled: boolean
          auto_play_responses: boolean
          created_at: string
          display_name: string | null
          first_name: string | null
          id: string
          journaling_intention: string | null
          onboarded_at: string | null
          preferred_interaction: string
          reflection_reminders_enabled: boolean
          reflection_style: string | null
          reminder_preference: string
          theme: string
          timezone: string | null
          updated_at: string
          voice_enabled: boolean
          voice_name: string | null
          weekly_report_enabled: boolean
        }
        Insert: {
          ai_memory_enabled?: boolean
          auto_play_responses?: boolean
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id: string
          journaling_intention?: string | null
          onboarded_at?: string | null
          preferred_interaction?: string
          reflection_reminders_enabled?: boolean
          reflection_style?: string | null
          reminder_preference?: string
          theme?: string
          timezone?: string | null
          updated_at?: string
          voice_enabled?: boolean
          voice_name?: string | null
          weekly_report_enabled?: boolean
        }
        Update: {
          ai_memory_enabled?: boolean
          auto_play_responses?: boolean
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id?: string
          journaling_intention?: string | null
          onboarded_at?: string | null
          preferred_interaction?: string
          reflection_reminders_enabled?: boolean
          reflection_style?: string | null
          reminder_preference?: string
          theme?: string
          timezone?: string | null
          updated_at?: string
          voice_enabled?: boolean
          voice_name?: string | null
          weekly_report_enabled?: boolean
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
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      weekly_reports: {
        Row: {
          challenges: Json
          content: Json
          created_at: string
          decisions: Json
          entry_count: number
          goal_progress: Json
          id: string
          next_week: Json
          patterns: Json
          summary: string | null
          themes: Json
          updated_at: string
          user_id: string
          week_end: string | null
          week_start: string
          wins: Json
          worth_noticing: string | null
        }
        Insert: {
          challenges?: Json
          content?: Json
          created_at?: string
          decisions?: Json
          entry_count?: number
          goal_progress?: Json
          id?: string
          next_week?: Json
          patterns?: Json
          summary?: string | null
          themes?: Json
          updated_at?: string
          user_id?: string
          week_end?: string | null
          week_start: string
          wins?: Json
          worth_noticing?: string | null
        }
        Update: {
          challenges?: Json
          content?: Json
          created_at?: string
          decisions?: Json
          entry_count?: number
          goal_progress?: Json
          id?: string
          next_week?: Json
          patterns?: Json
          summary?: string | null
          themes?: Json
          updated_at?: string
          user_id?: string
          week_end?: string | null
          week_start?: string
          wins?: Json
          worth_noticing?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_ai_quota: {
        Args: { p_kind: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      delete_all_memories: { Args: never; Returns: undefined }
      delete_all_personal_data: { Args: never; Returns: undefined }
      delete_journal_entry: { Args: { p_entry_id: string }; Returns: undefined }
      delete_journal_history: { Args: never; Returns: undefined }
      match_entries: {
        Args: {
          from_ts?: string
          match_count?: number
          min_similarity?: number
          query_embedding: unknown
          to_ts?: string
        }
        Returns: {
          completed_at: string
          id: string
          similarity: number
          summary: string
          title: string
        }[]
      }
      match_memories: {
        Args: {
          match_count?: number
          min_similarity?: number
          query_embedding: unknown
        }
        Returns: {
          content: string
          created_at: string
          id: string
          journal_entry_id: string
          memory_type: string
          similarity: number
        }[]
      }
      merge_people: {
        Args: { source_id: string; target_id: string }
        Returns: undefined
      }
      merge_topics: {
        Args: { source_id: string; target_id: string }
        Returns: undefined
      }
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
