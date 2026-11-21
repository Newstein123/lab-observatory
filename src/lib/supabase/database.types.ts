
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
            "accessories": {
                  Row: {
                    "created_at": string,"id": string,"kind": string,"manufacturer": string | null,"model": string | null,"name": string,"notes": string | null,"owner_id": string,"spec": NonNullable<Json>,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"kind": string,"manufacturer"?: string | null,"model"?: string | null,"name": string,"notes"?: string | null,"owner_id"?: string,"spec": NonNullable<Json>,"status": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"kind"?: string,"manufacturer"?: string | null,"model"?: string | null,"name"?: string,"notes"?: string | null,"owner_id"?: string,"spec"?: NonNullable<Json>,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"configuration_components": {
                  Row: {
                    "component_type": string,"configuration_id": string,"spec": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "component_type": string,"configuration_id": string,"spec": NonNullable<Json>
                  }
                  Update: {
                    "component_type"?: string,"configuration_id"?: string,"spec"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "configuration_components_configuration_id_fkey"
      columns: ["configuration_id"]
isOneToOne: false
      referencedRelation: "telescope_configurations"
      referencedColumns: ["id"]
    }
                  ]
                },"observation_projects": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"name": string,"owner_id": string,"target_ids": (string)[],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"name": string,"owner_id"?: string,"target_ids"?: (string)[],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"name"?: string,"owner_id"?: string,"target_ids"?: (string)[],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"project_sessions": {
                  Row: {
                    "added_at": string,"project_id": string,"session_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_at"?: string,"project_id": string,"session_id": string
                  }
                  Update: {
                    "added_at"?: string,"project_id"?: string,"session_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_sessions_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "observation_projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_sessions_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "simulation_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"session_configurations": {
                  Row: {
                    "configuration_id": string | null,"configuration_version": number | null,"modified_from_saved": boolean,"session_id": string,"snapshot": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "configuration_id"?: string | null,"configuration_version"?: number | null,"modified_from_saved"?: boolean,"session_id": string,"snapshot": NonNullable<Json>
                  }
                  Update: {
                    "configuration_id"?: string | null,"configuration_version"?: number | null,"modified_from_saved"?: boolean,"session_id"?: string,"snapshot"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "session_configurations_session_id_fkey"
      columns: ["session_id"]
isOneToOne: true
      referencedRelation: "simulation_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"simulation_results": {
                  Row: {
                    "assumptions": (string)[],"created_at": string,"engine_version": string,"result": NonNullable<Json>,"session_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assumptions"?: (string)[],"created_at"?: string,"engine_version": string,"result": NonNullable<Json>,"session_id": string
                  }
                  Update: {
                    "assumptions"?: (string)[],"created_at"?: string,"engine_version"?: string,"result"?: NonNullable<Json>,"session_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "simulation_results_session_id_fkey"
      columns: ["session_id"]
isOneToOne: true
      referencedRelation: "simulation_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"simulation_sessions": {
                  Row: {
                    "conditions": NonNullable<Json>,"created_at": string,"exposure": Json | null,"id": string,"mode": string,"name": string,"owner_id": string,"simulation_version": string,"target_id": string,"target_snapshot": NonNullable<Json>,"view_settings": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "conditions"?: NonNullable<Json>,"created_at"?: string,"exposure"?: Json | null,"id"?: string,"mode": string,"name": string,"owner_id"?: string,"simulation_version": string,"target_id": string,"target_snapshot": NonNullable<Json>,"view_settings": NonNullable<Json>
                  }
                  Update: {
                    "conditions"?: NonNullable<Json>,"created_at"?: string,"exposure"?: Json | null,"id"?: string,"mode"?: string,"name"?: string,"owner_id"?: string,"simulation_version"?: string,"target_id"?: string,"target_snapshot"?: NonNullable<Json>,"view_settings"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"telescope_configurations": {
                  Row: {
                    "aperture_mm": number,"catalog_ref": string | null,"created_at": string,"focal_length_mm": number,"id": string,"name": string,"notes": string | null,"optical_design": string | null,"owner_id": string,"profile_id": string | null,"status": string,"telescope_label": string | null,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "aperture_mm": number,"catalog_ref"?: string | null,"created_at"?: string,"focal_length_mm": number,"id"?: string,"name": string,"notes"?: string | null,"optical_design"?: string | null,"owner_id"?: string,"profile_id"?: string | null,"status": string,"telescope_label"?: string | null,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "aperture_mm"?: number,"catalog_ref"?: string | null,"created_at"?: string,"focal_length_mm"?: number,"id"?: string,"name"?: string,"notes"?: string | null,"optical_design"?: string | null,"owner_id"?: string,"profile_id"?: string | null,"status"?: string,"telescope_label"?: string | null,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "telescope_configurations_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "telescope_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"telescope_profiles": {
                  Row: {
                    "aperture_mm": number,"created_at": string,"focal_length_mm": number,"id": string,"manufacturer": string | null,"model": string | null,"mount_type": string,"name": string,"notes": string | null,"optical_design": string,"owner_id": string,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aperture_mm": number,"created_at"?: string,"focal_length_mm": number,"id"?: string,"manufacturer"?: string | null,"model"?: string | null,"mount_type": string,"name": string,"notes"?: string | null,"optical_design": string,"owner_id"?: string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "aperture_mm"?: number,"created_at"?: string,"focal_length_mm"?: number,"id"?: string,"manufacturer"?: string | null,"model"?: string | null,"mount_type"?: string,"name"?: string,"notes"?: string | null,"optical_design"?: string,"owner_id"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "create_session":
{ Args: { "p_session": Json }; Returns: string
                           },
"duplicate_configuration":
{ Args: { "p_id": string }; Returns: string
                           },
"is_valid_component":
{ Args: { "component_type": string,"spec": Json }; Returns: boolean
                           },
"is_valid_conditions":
{ Args: { "c": Json }; Returns: boolean
                           },
"is_valid_view_site":
{ Args: { "v": Json }; Returns: boolean
                           },
"json_number_between":
{ Args: { "hi": number,"key": string,"lo": number,"s": Json }; Returns: boolean
                           },
"json_optional_boolean":
{ Args: { "key": string,"s": Json }; Returns: boolean
                           },
"json_optional_number_between":
{ Args: { "hi": number,"key": string,"lo": number,"s": Json }; Returns: boolean
                           },
"json_optional_text":
{ Args: { "key": string,"max_len": number,"s": Json }; Returns: boolean
                           },
"save_configuration":
{ Args: { "p_id": string,"p_spec": Json }; Returns: string
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
