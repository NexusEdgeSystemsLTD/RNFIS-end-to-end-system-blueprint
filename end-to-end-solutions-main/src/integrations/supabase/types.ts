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
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          entry_hash: string | null
          id: string
          ip_address: string | null
          prev_hash: string | null
          sequence_number: number
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          entry_hash?: string | null
          id?: string
          ip_address?: string | null
          prev_hash?: string | null
          sequence_number?: number
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          entry_hash?: string | null
          id?: string
          ip_address?: string | null
          prev_hash?: string | null
          sequence_number?: number
        }
        Relationships: []
      }
      club_documents: {
        Row: {
          club_id: string
          created_at: string
          document_url: string | null
          due_date: string | null
          id: string
          requirement: string
          status: string
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          document_url?: string | null
          due_date?: string | null
          id?: string
          requirement: string
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          document_url?: string | null
          due_date?: string | null
          id?: string
          requirement?: string
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_documents_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          active: boolean
          city: string | null
          created_at: string
          division: string
          founded_year: number | null
          home_stadium: string | null
          id: string
          logo_url: string | null
          name: string
          points_deduction: number
          primary_color: string | null
          short_code: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          city?: string | null
          created_at?: string
          division?: string
          founded_year?: number | null
          home_stadium?: string | null
          id?: string
          logo_url?: string | null
          name: string
          points_deduction?: number
          primary_color?: string | null
          short_code: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          city?: string | null
          created_at?: string
          division?: string
          founded_year?: number | null
          home_stadium?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          points_deduction?: number
          primary_color?: string | null
          short_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      discipline_records: {
        Row: {
          appeal_decided_at: string | null
          appeal_evidence_url: string | null
          appeal_grounds: string | null
          appeal_status: string | null
          case_number: string
          club_id: string | null
          created_at: string
          decision_pdf_anchor_seq: number | null
          decision_pdf_hash: string | null
          discipline_type: Database["public"]["Enums"]["discipline_type"]
          effective_until: string | null
          fine_amount: number | null
          id: string
          issued_at: string
          issued_by: string | null
          match_id: string | null
          player_id: string | null
          reason: string
          referee_id: string | null
          status: Database["public"]["Enums"]["discipline_status"]
          suspension_matches: number | null
          updated_at: string
        }
        Insert: {
          appeal_decided_at?: string | null
          appeal_evidence_url?: string | null
          appeal_grounds?: string | null
          appeal_status?: string | null
          case_number: string
          club_id?: string | null
          created_at?: string
          decision_pdf_anchor_seq?: number | null
          decision_pdf_hash?: string | null
          discipline_type: Database["public"]["Enums"]["discipline_type"]
          effective_until?: string | null
          fine_amount?: number | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          match_id?: string | null
          player_id?: string | null
          reason: string
          referee_id?: string | null
          status?: Database["public"]["Enums"]["discipline_status"]
          suspension_matches?: number | null
          updated_at?: string
        }
        Update: {
          appeal_decided_at?: string | null
          appeal_evidence_url?: string | null
          appeal_grounds?: string | null
          appeal_status?: string | null
          case_number?: string
          club_id?: string | null
          created_at?: string
          decision_pdf_anchor_seq?: number | null
          decision_pdf_hash?: string | null
          discipline_type?: Database["public"]["Enums"]["discipline_type"]
          effective_until?: string | null
          fine_amount?: number | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          match_id?: string | null
          player_id?: string | null
          reason?: string
          referee_id?: string | null
          status?: Database["public"]["Enums"]["discipline_status"]
          suspension_matches?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discipline_records_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discipline_records_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discipline_records_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discipline_records_referee_id_fkey"
            columns: ["referee_id"]
            isOneToOne: false
            referencedRelation: "referees"
            referencedColumns: ["id"]
          },
        ]
      }
      match_events: {
        Row: {
          club_id: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["match_event_type"]
          id: string
          match_id: string
          minute: number
          notes: string | null
          player_id: string | null
          recorded_by: string | null
          secondary_player_id: string | null
        }
        Insert: {
          club_id?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["match_event_type"]
          id?: string
          match_id: string
          minute: number
          notes?: string | null
          player_id?: string | null
          recorded_by?: string | null
          secondary_player_id?: string | null
        }
        Update: {
          club_id?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["match_event_type"]
          id?: string
          match_id?: string
          minute?: number
          notes?: string | null
          player_id?: string | null
          recorded_by?: string | null
          secondary_player_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_secondary_player_id_fkey"
            columns: ["secondary_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_club_id: string
          away_score: number
          competition: string
          created_at: string
          current_minute: number
          home_club_id: string
          home_score: number
          id: string
          kickoff_at: string
          match_code: string
          matchday: number | null
          notes: string | null
          referee_id: string | null
          status: Database["public"]["Enums"]["match_status"]
          updated_at: string
          var_officer_id: string | null
          venue: string
        }
        Insert: {
          away_club_id: string
          away_score?: number
          competition?: string
          created_at?: string
          current_minute?: number
          home_club_id: string
          home_score?: number
          id?: string
          kickoff_at: string
          match_code: string
          matchday?: number | null
          notes?: string | null
          referee_id?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
          var_officer_id?: string | null
          venue: string
        }
        Update: {
          away_club_id?: string
          away_score?: number
          competition?: string
          created_at?: string
          current_minute?: number
          home_club_id?: string
          home_score?: number
          id?: string
          kickoff_at?: string
          match_code?: string
          matchday?: number | null
          notes?: string | null
          referee_id?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
          var_officer_id?: string | null
          venue?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_club_id_fkey"
            columns: ["away_club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_club_id_fkey"
            columns: ["home_club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_referee_id_fkey"
            columns: ["referee_id"]
            isOneToOne: false
            referencedRelation: "referees"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          category: string
          channel: string
          created_at: string
          error: string | null
          id: string
          recipient: string
          related_entity_id: string | null
          related_entity_type: string | null
          sent_at: string | null
          status: string
          subject: string | null
        }
        Insert: {
          body: string
          category: string
          channel: string
          created_at?: string
          error?: string | null
          id?: string
          recipient: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
        }
        Update: {
          body?: string
          category?: string
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          recipient?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: []
      }
      player_transfers: {
        Row: {
          created_at: string
          fee_amount: number | null
          from_club_id: string | null
          id: string
          notes: string | null
          player_id: string
          recorded_by: string | null
          to_club_id: string | null
          transfer_date: string
        }
        Insert: {
          created_at?: string
          fee_amount?: number | null
          from_club_id?: string | null
          id?: string
          notes?: string | null
          player_id: string
          recorded_by?: string | null
          to_club_id?: string | null
          transfer_date?: string
        }
        Update: {
          created_at?: string
          fee_amount?: number | null
          from_club_id?: string | null
          id?: string
          notes?: string | null
          player_id?: string
          recorded_by?: string | null
          to_club_id?: string | null
          transfer_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_transfers_from_club_id_fkey"
            columns: ["from_club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_transfers_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_transfers_to_club_id_fkey"
            columns: ["to_club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          appearances: number
          club_id: string | null
          conduct_score: number | null
          created_at: string
          date_of_birth: string
          full_name: string
          goals: number
          id: string
          jersey_number: number | null
          license_active: boolean
          license_number: string | null
          nationality: string
          photo_url: string | null
          position: Database["public"]["Enums"]["player_position"]
          red_cards: number
          status: Database["public"]["Enums"]["player_status"]
          updated_at: string
          yellow_cards: number
        }
        Insert: {
          appearances?: number
          club_id?: string | null
          conduct_score?: number | null
          created_at?: string
          date_of_birth: string
          full_name: string
          goals?: number
          id?: string
          jersey_number?: number | null
          license_active?: boolean
          license_number?: string | null
          nationality?: string
          photo_url?: string | null
          position: Database["public"]["Enums"]["player_position"]
          red_cards?: number
          status?: Database["public"]["Enums"]["player_status"]
          updated_at?: string
          yellow_cards?: number
        }
        Update: {
          appearances?: number
          club_id?: string | null
          conduct_score?: number | null
          created_at?: string
          date_of_birth?: string
          full_name?: string
          goals?: number
          id?: string
          jersey_number?: number | null
          license_active?: boolean
          license_number?: string | null
          nationality?: string
          photo_url?: string | null
          position?: Database["public"]["Enums"]["player_position"]
          red_cards?: number
          status?: Database["public"]["Enums"]["player_status"]
          updated_at?: string
          yellow_cards?: number
        }
        Relationships: [
          {
            foreignKeyName: "players_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          club_id: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          club_id?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          club_id?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_club_fk"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      referee_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          match_id: string
          referee_id: string
          role: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          match_id: string
          referee_id: string
          role: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          match_id?: string
          referee_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "referee_assignments_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referee_assignments_referee_id_fkey"
            columns: ["referee_id"]
            isOneToOne: false
            referencedRelation: "referees"
            referencedColumns: ["id"]
          },
        ]
      }
      referees: {
        Row: {
          active: boolean
          created_at: string
          district: string | null
          full_name: string
          grade: string | null
          id: string
          level: Database["public"]["Enums"]["referee_level"]
          license_expiry: string | null
          license_number: string
          matches_officiated: number
          performance_rating: number | null
          specialization: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          district?: string | null
          full_name: string
          grade?: string | null
          id?: string
          level?: Database["public"]["Enums"]["referee_level"]
          license_expiry?: string | null
          license_number: string
          matches_officiated?: number
          performance_rating?: number | null
          specialization?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          district?: string | null
          full_name?: string
          grade?: string | null
          id?: string
          level?: Database["public"]["Enums"]["referee_level"]
          license_expiry?: string | null
          license_number?: string
          matches_officiated?: number
          performance_rating?: number | null
          specialization?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      training_modules: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          module_name: string
          progress: number
          referee_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          module_name: string
          progress?: number
          referee_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          module_name?: string
          progress?: number
          referee_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_modules_referee_id_fkey"
            columns: ["referee_id"]
            isOneToOne: false
            referencedRelation: "referees"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      var_reviews: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          incident_type: string
          match_id: string
          minute: number
          notes: string | null
          on_field_decision: string | null
          outcome: Database["public"]["Enums"]["var_outcome"]
          reviewed_by: string | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          incident_type: string
          match_id: string
          minute: number
          notes?: string | null
          on_field_decision?: string | null
          outcome: Database["public"]["Enums"]["var_outcome"]
          reviewed_by?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          incident_type?: string
          match_id?: string
          minute?: number
          notes?: string | null
          on_field_decision?: string | null
          outcome?: Database["public"]["Enums"]["var_outcome"]
          reviewed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "var_reviews_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      audit_log_search: {
        Args: {
          _action?: string
          _entity?: string
          _from?: string
          _limit?: number
          _offset?: number
          _search?: string
          _to?: string
        }
        Returns: {
          action: string
          actor_email: string
          actor_id: string
          created_at: string
          details: Json
          entity_id: string
          entity_type: string
          entry_hash: string
          id: string
          prev_hash: string
          sequence_number: number
          total_count: number
        }[]
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      latest_audit_anchor: {
        Args: never
        Returns: {
          created_at: string
          entry_hash: string
          sequence_number: number
        }[]
      }
      verify_audit_chain: {
        Args: never
        Returns: {
          broken_at_id: string
          broken_at_seq: number
          reason: string
        }[]
      }
    }
    Enums: {
      app_role:
        | "ministry_admin"
        | "ferwafa_admin"
        | "club_official"
        | "referee"
        | "var_officer"
        | "public_viewer"
      discipline_status:
        | "pending"
        | "active"
        | "served"
        | "appealed"
        | "overturned"
      discipline_type: "warning" | "fine" | "suspension" | "ban" | "probation"
      match_event_type:
        | "goal"
        | "own_goal"
        | "penalty_goal"
        | "penalty_miss"
        | "yellow_card"
        | "red_card"
        | "second_yellow"
        | "substitution"
        | "var_review"
        | "injury"
        | "offside"
        | "foul"
        | "kickoff"
        | "halftime"
        | "fulltime"
      match_status:
        | "scheduled"
        | "live"
        | "halftime"
        | "completed"
        | "postponed"
        | "abandoned"
      player_position: "GK" | "DEF" | "MID" | "FWD"
      player_status: "eligible" | "suspended" | "injured" | "inactive"
      referee_level: "national" | "elite" | "caf" | "fifa"
      var_outcome:
        | "goal_awarded"
        | "goal_disallowed"
        | "penalty_awarded"
        | "penalty_overturned"
        | "red_card_issued"
        | "no_action"
        | "inconclusive"
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
      app_role: [
        "ministry_admin",
        "ferwafa_admin",
        "club_official",
        "referee",
        "var_officer",
        "public_viewer",
      ],
      discipline_status: [
        "pending",
        "active",
        "served",
        "appealed",
        "overturned",
      ],
      discipline_type: ["warning", "fine", "suspension", "ban", "probation"],
      match_event_type: [
        "goal",
        "own_goal",
        "penalty_goal",
        "penalty_miss",
        "yellow_card",
        "red_card",
        "second_yellow",
        "substitution",
        "var_review",
        "injury",
        "offside",
        "foul",
        "kickoff",
        "halftime",
        "fulltime",
      ],
      match_status: [
        "scheduled",
        "live",
        "halftime",
        "completed",
        "postponed",
        "abandoned",
      ],
      player_position: ["GK", "DEF", "MID", "FWD"],
      player_status: ["eligible", "suspended", "injured", "inactive"],
      referee_level: ["national", "elite", "caf", "fifa"],
      var_outcome: [
        "goal_awarded",
        "goal_disallowed",
        "penalty_awarded",
        "penalty_overturned",
        "red_card_issued",
        "no_action",
        "inconclusive",
      ],
    },
  },
} as const
