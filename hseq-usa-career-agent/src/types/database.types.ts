
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "audit_logs": {
                  Row: {
                    "action": string,"created_at": string,"details": NonNullable<Json>,"entity_id": string | null,"entity_type": string,"hash": string,"id": string,"prev_hash": string,"seq": number,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"created_at"?: string,"details"?: NonNullable<Json>,"entity_id"?: string | null,"entity_type": string,"hash": string,"id"?: string,"prev_hash": string,"seq"?: never,"user_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"created_at"?: string,"details"?: NonNullable<Json>,"entity_id"?: string | null,"entity_type"?: string,"hash"?: string,"id"?: string,"prev_hash"?: string,"seq"?: never,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"career_preferences": {
                  Row: {
                    "created_at": string,"email_autonomy": string,"employer_sponsorship_required": boolean,"id": string,"preferred_email_provider": string,"preferred_industries": (string)[],"preferred_job_titles": (string)[],"preferred_states": (string)[],"relocation_willingness": boolean,"residential_work_preference": boolean,"rotational_work_preference": boolean,"salary_basis_note": string,"salary_currency": string,"salary_period": string,"target_salary_max": number,"target_salary_min": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email_autonomy"?: string,"employer_sponsorship_required"?: boolean,"id"?: string,"preferred_email_provider"?: string,"preferred_industries"?: (string)[],"preferred_job_titles"?: (string)[],"preferred_states"?: (string)[],"relocation_willingness"?: boolean,"residential_work_preference"?: boolean,"rotational_work_preference"?: boolean,"salary_basis_note"?: string,"salary_currency"?: string,"salary_period"?: string,"target_salary_max"?: number,"target_salary_min"?: number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"email_autonomy"?: string,"employer_sponsorship_required"?: boolean,"id"?: string,"preferred_email_provider"?: string,"preferred_industries"?: (string)[],"preferred_job_titles"?: (string)[],"preferred_states"?: (string)[],"relocation_willingness"?: boolean,"residential_work_preference"?: boolean,"rotational_work_preference"?: boolean,"salary_basis_note"?: string,"salary_currency"?: string,"salary_period"?: string,"target_salary_max"?: number,"target_salary_min"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"career_profiles": {
                  Row: {
                    "australian_experience_years": number | null,"core_competencies": (string)[],"created_at": string,"education_summary": string | null,"id": string,"international_experience_years": number | null,"primary_industries": (string)[],"professional_summary": string | null,"profile_status": string,"target_job_titles": (string)[],"total_experience_years": number | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "australian_experience_years"?: number | null,"core_competencies"?: (string)[],"created_at"?: string,"education_summary"?: string | null,"id"?: string,"international_experience_years"?: number | null,"primary_industries"?: (string)[],"professional_summary"?: string | null,"profile_status"?: string,"target_job_titles"?: (string)[],"total_experience_years"?: number | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "australian_experience_years"?: number | null,"core_competencies"?: (string)[],"created_at"?: string,"education_summary"?: string | null,"id"?: string,"international_experience_years"?: number | null,"primary_industries"?: (string)[],"professional_summary"?: string | null,"profile_status"?: string,"target_job_titles"?: (string)[],"total_experience_years"?: number | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"employment_history": {
                  Row: {
                    "achievements": string | null,"country": string | null,"created_at": string,"employer_name": string,"end_date": string | null,"id": string,"industry": string | null,"is_current": boolean,"job_title": string,"location": string | null,"needs_review": boolean,"project_name": string | null,"responsibilities": string | null,"start_date": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "achievements"?: string | null,"country"?: string | null,"created_at"?: string,"employer_name": string,"end_date"?: string | null,"id"?: string,"industry"?: string | null,"is_current"?: boolean,"job_title": string,"location"?: string | null,"needs_review"?: boolean,"project_name"?: string | null,"responsibilities"?: string | null,"start_date"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "achievements"?: string | null,"country"?: string | null,"created_at"?: string,"employer_name"?: string,"end_date"?: string | null,"id"?: string,"industry"?: string | null,"is_current"?: boolean,"job_title"?: string,"location"?: string | null,"needs_review"?: boolean,"project_name"?: string | null,"responsibilities"?: string | null,"start_date"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"current_employer": string | null,"current_job_title": string | null,"current_location": string | null,"email": string | null,"full_name": string | null,"id": string,"linkedin_url": string | null,"professional_summary": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"current_employer"?: string | null,"current_job_title"?: string | null,"current_location"?: string | null,"email"?: string | null,"full_name"?: string | null,"id": string,"linkedin_url"?: string | null,"professional_summary"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"current_employer"?: string | null,"current_job_title"?: string | null,"current_location"?: string | null,"email"?: string | null,"full_name"?: string | null,"id"?: string,"linkedin_url"?: string | null,"professional_summary"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"qualifications": {
                  Row: {
                    "awarding_organisation": string,"country": string | null,"created_at": string,"evidence_file_path": string | null,"expiry_date": string | null,"id": string,"issue_date": string | null,"needs_review": boolean,"qualification_name": string,"qualification_type": string,"updated_at": string,"user_id": string,"verification_status": string,"verified_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "awarding_organisation": string,"country"?: string | null,"created_at"?: string,"evidence_file_path"?: string | null,"expiry_date"?: string | null,"id"?: string,"issue_date"?: string | null,"needs_review"?: boolean,"qualification_name": string,"qualification_type": string,"updated_at"?: string,"user_id": string,"verification_status"?: string,"verified_at"?: string | null
                  }
                  Update: {
                    "awarding_organisation"?: string,"country"?: string | null,"created_at"?: string,"evidence_file_path"?: string | null,"expiry_date"?: string | null,"id"?: string,"issue_date"?: string | null,"needs_review"?: boolean,"qualification_name"?: string,"qualification_type"?: string,"updated_at"?: string,"user_id"?: string,"verification_status"?: string,"verified_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"user_controls": {
                  Row: {
                    "agents_paused": boolean,"external_comms_enabled": boolean,"outbound_paused": boolean,"pause_reason": string | null,"paused_at": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "agents_paused"?: boolean,"external_comms_enabled"?: boolean,"outbound_paused"?: boolean,"pause_reason"?: string | null,"paused_at"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "agents_paused"?: boolean,"external_comms_enabled"?: boolean,"outbound_paused"?: boolean,"pause_reason"?: string | null,"paused_at"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "fn_audit_append":
{ Args: { "p_action": string,"p_details": Json,"p_entity_id": string,"p_entity_type": string,"p_user": string }; Returns: undefined
                           },
"fn_audit_hash":
{ Args: { "p_action": string,"p_created": string,"p_details": Json,"p_entity_id": string,"p_entity_type": string,"p_prev": string,"p_user": string }; Returns: string
                           },
"fn_audit_redact":
{ Args: { "p": Json }; Returns: Json
                           },
"industry_codes":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"load_starter_profile":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"log_audit_event":
{ Args: { "p_action": string,"p_details"?: Json,"p_entity_id"?: string,"p_entity_type": string }; Returns: undefined
                           },
"us_state_codes":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"verify_audit_chain":
{ Args: Record<PropertyKey, never>; Returns: number
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
