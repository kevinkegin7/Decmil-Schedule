
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
            "agent_runs": {
                  Row: {
                    "agent": string,"error": string | null,"finished_at": string | null,"id": string,"input_summary": NonNullable<Json>,"output_summary": NonNullable<Json>,"run_type": string,"started_at": string,"status": string,"triggered_by": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "agent": string,"error"?: string | null,"finished_at"?: string | null,"id"?: string,"input_summary"?: NonNullable<Json>,"output_summary"?: NonNullable<Json>,"run_type": string,"started_at"?: string,"status"?: string,"triggered_by": string,"user_id": string
                  }
                  Update: {
                    "agent"?: string,"error"?: string | null,"finished_at"?: string | null,"id"?: string,"input_summary"?: NonNullable<Json>,"output_summary"?: NonNullable<Json>,"run_type"?: string,"started_at"?: string,"status"?: string,"triggered_by"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"audit_logs": {
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
                },"data_sources": {
                  Row: {
                    "access_method": string,"base_url": string | null,"category": string,"code": string,"documentation_url": string | null,"name": string,"permitted_use_note": string,"refresh_cadence": string
                  }
                  ComputedFields: never
                  Insert: {
                    "access_method": string,"base_url"?: string | null,"category": string,"code": string,"documentation_url"?: string | null,"name": string,"permitted_use_note": string,"refresh_cadence": string
                  }
                  Update: {
                    "access_method"?: string,"base_url"?: string | null,"category"?: string,"code"?: string,"documentation_url"?: string | null,"name"?: string,"permitted_use_note"?: string,"refresh_cadence"?: string
                  }
                  Relationships: [
                    
                  ]
                },"employers": {
                  Row: {
                    "ats_board_token": string | null,"ats_provider": string | null,"careers_url": string | null,"careers_url_source": string | null,"careers_url_verified_at": string | null,"created_at": string,"description": string | null,"fein": string | null,"hq_city": string | null,"hq_state": string | null,"id": string,"industries": (string)[],"is_sample": boolean,"last_refreshed_at": string | null,"name": string,"normalized_name": string,"operating_states": (string)[],"size_band": string | null,"updated_at": string,"user_id": string,"website_url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ats_board_token"?: string | null,"ats_provider"?: string | null,"careers_url"?: string | null,"careers_url_source"?: string | null,"careers_url_verified_at"?: string | null,"created_at"?: string,"description"?: string | null,"fein"?: string | null,"hq_city"?: string | null,"hq_state"?: string | null,"id"?: string,"industries"?: (string)[],"is_sample"?: boolean,"last_refreshed_at"?: string | null,"name": string,"normalized_name": string,"operating_states"?: (string)[],"size_band"?: string | null,"updated_at"?: string,"user_id": string,"website_url"?: string | null
                  }
                  Update: {
                    "ats_board_token"?: string | null,"ats_provider"?: string | null,"careers_url"?: string | null,"careers_url_source"?: string | null,"careers_url_verified_at"?: string | null,"created_at"?: string,"description"?: string | null,"fein"?: string | null,"hq_city"?: string | null,"hq_state"?: string | null,"id"?: string,"industries"?: (string)[],"is_sample"?: boolean,"last_refreshed_at"?: string | null,"name"?: string,"normalized_name"?: string,"operating_states"?: (string)[],"size_band"?: string | null,"updated_at"?: string,"user_id"?: string,"website_url"?: string | null
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
                },"immigration_profiles": {
                  Row: {
                    "australian_residence_status": string,"citizenships": (string)[],"country_of_birth": string | null,"current_employer_has_us_affiliate": string,"degree_field": string | null,"highest_degree": string,"notes": string | null,"post_degree_experience_years": number | null,"updated_at": string,"us_degree_equivalency_evaluated": boolean,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "australian_residence_status"?: string,"citizenships"?: (string)[],"country_of_birth"?: string | null,"current_employer_has_us_affiliate"?: string,"degree_field"?: string | null,"highest_degree"?: string,"notes"?: string | null,"post_degree_experience_years"?: number | null,"updated_at"?: string,"us_degree_equivalency_evaluated"?: boolean,"user_id": string
                  }
                  Update: {
                    "australian_residence_status"?: string,"citizenships"?: (string)[],"country_of_birth"?: string | null,"current_employer_has_us_affiliate"?: string,"degree_field"?: string | null,"highest_degree"?: string,"notes"?: string | null,"post_degree_experience_years"?: number | null,"updated_at"?: string,"us_degree_equivalency_evaluated"?: boolean,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"job_matches": {
                  Row: {
                    "algorithm_version": string,"band": string,"components": NonNullable<Json>,"computed_at": string,"flags": (string)[],"id": string,"inputs_hash": string,"job_id": string,"run_id": string | null,"score": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "algorithm_version": string,"band": string,"components": NonNullable<Json>,"computed_at"?: string,"flags"?: (string)[],"id"?: string,"inputs_hash": string,"job_id": string,"run_id"?: string | null,"score": number,"user_id": string
                  }
                  Update: {
                    "algorithm_version"?: string,"band"?: string,"components"?: NonNullable<Json>,"computed_at"?: string,"flags"?: (string)[],"id"?: string,"inputs_hash"?: string,"job_id"?: string,"run_id"?: string | null,"score"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_matches_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "job_opportunities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_matches_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "agent_runs"
      referencedColumns: ["id"]
    }
                  ]
                },"job_opportunities": {
                  Row: {
                    "city": string | null,"created_at": string,"department": string | null,"description_text": string | null,"employer_id": string,"employment_type": string | null,"external_id": string,"first_seen_at": string,"id": string,"is_remote": boolean,"is_sample": boolean,"last_seen_at": string,"location_text": string | null,"posted_at": string | null,"requires_security_clearance": boolean,"requires_us_citizenship": boolean,"retrieved_at": string,"salary_confidence": string,"salary_currency": string,"salary_max": number | null,"salary_min": number | null,"salary_period": string | null,"salary_source": string,"source": string,"source_url": string,"sponsorship_excerpt": string | null,"sponsorship_statement": string,"state": string | null,"status": string,"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "city"?: string | null,"created_at"?: string,"department"?: string | null,"description_text"?: string | null,"employer_id": string,"employment_type"?: string | null,"external_id": string,"first_seen_at"?: string,"id"?: string,"is_remote"?: boolean,"is_sample"?: boolean,"last_seen_at"?: string,"location_text"?: string | null,"posted_at"?: string | null,"requires_security_clearance"?: boolean,"requires_us_citizenship"?: boolean,"retrieved_at": string,"salary_confidence"?: string,"salary_currency"?: string,"salary_max"?: number | null,"salary_min"?: number | null,"salary_period"?: string | null,"salary_source"?: string,"source": string,"source_url": string,"sponsorship_excerpt"?: string | null,"sponsorship_statement"?: string,"state"?: string | null,"status"?: string,"title": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "city"?: string | null,"created_at"?: string,"department"?: string | null,"description_text"?: string | null,"employer_id"?: string,"employment_type"?: string | null,"external_id"?: string,"first_seen_at"?: string,"id"?: string,"is_remote"?: boolean,"is_sample"?: boolean,"last_seen_at"?: string,"location_text"?: string | null,"posted_at"?: string | null,"requires_security_clearance"?: boolean,"requires_us_citizenship"?: boolean,"retrieved_at"?: string,"salary_confidence"?: string,"salary_currency"?: string,"salary_max"?: number | null,"salary_min"?: number | null,"salary_period"?: string | null,"salary_source"?: string,"source"?: string,"source_url"?: string,"sponsorship_excerpt"?: string | null,"sponsorship_statement"?: string,"state"?: string | null,"status"?: string,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_opportunities_employer_id_fkey"
      columns: ["employer_id"]
isOneToOne: false
      referencedRelation: "employers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "job_opportunities_source_fkey"
      columns: ["source"]
isOneToOne: false
      referencedRelation: "data_sources"
      referencedColumns: ["code"]
    }
                  ]
                },"pathway_assessments": {
                  Row: {
                    "algorithm_version": string,"assessed_at": string,"attorney_review_recommended": boolean,"eligibility": string,"headline": string,"id": string,"inputs_hash": string,"pathway": string,"reason": string,"reconsider_when": string | null,"requirements": NonNullable<Json>,"run_id": string | null,"source_codes": (string)[],"uncertainty_flags": (string)[],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "algorithm_version": string,"assessed_at"?: string,"attorney_review_recommended"?: boolean,"eligibility": string,"headline": string,"id"?: string,"inputs_hash": string,"pathway": string,"reason": string,"reconsider_when"?: string | null,"requirements"?: NonNullable<Json>,"run_id"?: string | null,"source_codes": (string)[],"uncertainty_flags"?: (string)[],"user_id": string
                  }
                  Update: {
                    "algorithm_version"?: string,"assessed_at"?: string,"attorney_review_recommended"?: boolean,"eligibility"?: string,"headline"?: string,"id"?: string,"inputs_hash"?: string,"pathway"?: string,"reason"?: string,"reconsider_when"?: string | null,"requirements"?: NonNullable<Json>,"run_id"?: string | null,"source_codes"?: (string)[],"uncertainty_flags"?: (string)[],"user_id"?: string
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
                },"ref_authoritative_sources": {
                  Row: {
                    "authority": string,"code": string,"last_verified_at": string | null,"title": string,"topics": (string)[],"url": string,"verification_note": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "authority": string,"code": string,"last_verified_at"?: string | null,"title": string,"topics"?: (string)[],"url": string,"verification_note"?: string | null
                  }
                  Update: {
                    "authority"?: string,"code"?: string,"last_verified_at"?: string | null,"title"?: string,"topics"?: (string)[],"url"?: string,"verification_note"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"saved_employers": {
                  Row: {
                    "created_at": string,"employer_id": string,"id": string,"note": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"employer_id": string,"id"?: string,"note"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"employer_id"?: string,"id"?: string,"note"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "saved_employers_employer_id_fkey"
      columns: ["employer_id"]
isOneToOne: false
      referencedRelation: "employers"
      referencedColumns: ["id"]
    }
                  ]
                },"saved_jobs": {
                  Row: {
                    "created_at": string,"id": string,"job_id": string,"note": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"job_id": string,"note"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"job_id"?: string,"note"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "saved_jobs_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "job_opportunities"
      referencedColumns: ["id"]
    }
                  ]
                },"sponsorship_evidence": {
                  Row: {
                    "category": string | null,"confidence": string,"created_at": string,"employer_id": string,"evidence_type": string,"excerpt": string | null,"filing_count": number | null,"fiscal_year": number | null,"id": string,"is_sample": boolean,"job_id": string | null,"notes": string | null,"retrieved_at": string,"soc_codes": (string)[],"source": string,"source_title": string | null,"source_url": string | null,"updated_at": string,"user_id": string,"verified_at": string | null,"verified_by": string | null,"visa_classes": (string)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: never,"confidence": string,"created_at"?: string,"employer_id": string,"evidence_type": string,"excerpt"?: string | null,"filing_count"?: number | null,"fiscal_year"?: number | null,"id"?: string,"is_sample"?: boolean,"job_id"?: string | null,"notes"?: string | null,"retrieved_at": string,"soc_codes"?: (string)[],"source": string,"source_title"?: string | null,"source_url"?: string | null,"updated_at"?: string,"user_id": string,"verified_at"?: string | null,"verified_by"?: string | null,"visa_classes"?: (string)[]
                  }
                  Update: {
                    "category"?: never,"confidence"?: string,"created_at"?: string,"employer_id"?: string,"evidence_type"?: string,"excerpt"?: string | null,"filing_count"?: number | null,"fiscal_year"?: number | null,"id"?: string,"is_sample"?: boolean,"job_id"?: string | null,"notes"?: string | null,"retrieved_at"?: string,"soc_codes"?: (string)[],"source"?: string,"source_title"?: string | null,"source_url"?: string | null,"updated_at"?: string,"user_id"?: string,"verified_at"?: string | null,"verified_by"?: string | null,"visa_classes"?: (string)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "sponsorship_evidence_employer_id_fkey"
      columns: ["employer_id"]
isOneToOne: false
      referencedRelation: "employers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sponsorship_evidence_job_id_fkey"
      columns: ["job_id"]
isOneToOne: false
      referencedRelation: "job_opportunities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sponsorship_evidence_source_fkey"
      columns: ["source"]
isOneToOne: false
      referencedRelation: "data_sources"
      referencedColumns: ["code"]
    }
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
"load_starter_immigration_profile":
{ Args: Record<PropertyKey, never>; Returns: undefined
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
