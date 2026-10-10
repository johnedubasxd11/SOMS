
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
            "accomplishment_reports": {
                  Row: {
                    "approved_at": string | null,"attendance_count": number,"budget_spent": number,"created_at": string,"created_by": string,"endorsed_at": string | null,"id": string,"liquidation_summary": string | null,"organization_id": string,"outcomes": string | null,"proposal_id": string | null,"reference_number": string,"reviewed_at": string | null,"reviewer_remarks": string | null,"school_year_id": string,"status": Database["public"]['Enums']["submission_status"],"submitted_at": string | null,"summary": string | null,"title": string,"updated_at": string,"version": number
                  }
                  Insert: {
                    "approved_at"?: string | null,"attendance_count"?: number,"budget_spent"?: number,"created_at"?: string,"created_by": string,"endorsed_at"?: string | null,"id"?: string,"liquidation_summary"?: string | null,"organization_id": string,"outcomes"?: string | null,"proposal_id"?: string | null,"reference_number"?: string,"reviewed_at"?: string | null,"reviewer_remarks"?: string | null,"school_year_id": string,"status"?: Database["public"]['Enums']["submission_status"],"submitted_at"?: string | null,"summary"?: string | null,"title": string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "approved_at"?: string | null,"attendance_count"?: number,"budget_spent"?: number,"created_at"?: string,"created_by"?: string,"endorsed_at"?: string | null,"id"?: string,"liquidation_summary"?: string | null,"organization_id"?: string,"outcomes"?: string | null,"proposal_id"?: string | null,"reference_number"?: string,"reviewed_at"?: string | null,"reviewer_remarks"?: string | null,"school_year_id"?: string,"status"?: Database["public"]['Enums']["submission_status"],"submitted_at"?: string | null,"summary"?: string | null,"title"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "accomplishment_reports_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "accomplishment_reports_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "accomplishment_reports_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["organization_id"]
    },{
      foreignKeyName: "accomplishment_reports_proposal_id_fkey"
      columns: ["proposal_id"]
isOneToOne: false
      referencedRelation: "activity_proposals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "accomplishment_reports_proposal_id_fkey"
      columns: ["proposal_id"]
isOneToOne: false
      referencedRelation: "v_activity_proposal_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "accomplishment_reports_proposal_id_fkey"
      columns: ["proposal_id"]
isOneToOne: false
      referencedRelation: "v_calendar_events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "accomplishment_reports_proposal_id_fkey"
      columns: ["proposal_id"]
isOneToOne: false
      referencedRelation: "v_venue_conflicts"
      referencedColumns: ["conflicting_id"]
    },{
      foreignKeyName: "accomplishment_reports_proposal_id_fkey"
      columns: ["proposal_id"]
isOneToOne: false
      referencedRelation: "v_venue_conflicts"
      referencedColumns: ["proposal_id"]
    },{
      foreignKeyName: "accomplishment_reports_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "school_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "accomplishment_reports_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "v_activity_summary_by_college"
      referencedColumns: ["school_year_id"]
    },{
      foreignKeyName: "accomplishment_reports_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["school_year_id"]
    }
                  ]
                },"accreditation_items": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"is_required": boolean,"school_year_id": string,"sort_order": number,"title": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"is_required"?: boolean,"school_year_id": string,"sort_order"?: number,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"is_required"?: boolean,"school_year_id"?: string,"sort_order"?: number,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "accreditation_items_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "school_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "accreditation_items_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "v_activity_summary_by_college"
      referencedColumns: ["school_year_id"]
    },{
      foreignKeyName: "accreditation_items_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["school_year_id"]
    }
                  ]
                },"accreditation_submissions": {
                  Row: {
                    "created_at": string,"file_name": string,"id": string,"item_id": string,"mime_type": string,"organization_id": string,"remarks": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"size_bytes": number,"status": Database["public"]['Enums']["accreditation_submission_status"],"storage_path": string,"submitted_at": string,"submitted_by": string | null,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"file_name": string,"id"?: string,"item_id": string,"mime_type": string,"organization_id": string,"remarks"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"size_bytes": number,"status"?: Database["public"]['Enums']["accreditation_submission_status"],"storage_path": string,"submitted_at"?: string,"submitted_by"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"file_name"?: string,"id"?: string,"item_id"?: string,"mime_type"?: string,"organization_id"?: string,"remarks"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"size_bytes"?: number,"status"?: Database["public"]['Enums']["accreditation_submission_status"],"storage_path"?: string,"submitted_at"?: string,"submitted_by"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "accreditation_submissions_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "accreditation_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "accreditation_submissions_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "accreditation_submissions_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["organization_id"]
    },{
      foreignKeyName: "accreditation_submissions_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "accreditation_submissions_submitted_by_fkey"
      columns: ["submitted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"activity_proposals": {
                  Row: {
                    "activity_date": string,"approved_at": string | null,"budget": number,"created_at": string,"created_by": string,"description": string | null,"end_time": string | null,"endorsed_at": string | null,"id": string,"objectives": string | null,"organization_id": string,"participants_count": number,"reference_number": string,"reviewed_at": string | null,"reviewer_remarks": string | null,"school_year_id": string,"source_of_funds": string | null,"start_time": string | null,"status": Database["public"]['Enums']["submission_status"],"submitted_at": string | null,"title": string,"updated_at": string,"venue": string,"venue_id": string | null,"version": number
                  }
                  Insert: {
                    "activity_date": string,"approved_at"?: string | null,"budget"?: number,"created_at"?: string,"created_by": string,"description"?: string | null,"end_time"?: string | null,"endorsed_at"?: string | null,"id"?: string,"objectives"?: string | null,"organization_id": string,"participants_count"?: number,"reference_number"?: string,"reviewed_at"?: string | null,"reviewer_remarks"?: string | null,"school_year_id": string,"source_of_funds"?: string | null,"start_time"?: string | null,"status"?: Database["public"]['Enums']["submission_status"],"submitted_at"?: string | null,"title": string,"updated_at"?: string,"venue": string,"venue_id"?: string | null,"version"?: number
                  }
                  Update: {
                    "activity_date"?: string,"approved_at"?: string | null,"budget"?: number,"created_at"?: string,"created_by"?: string,"description"?: string | null,"end_time"?: string | null,"endorsed_at"?: string | null,"id"?: string,"objectives"?: string | null,"organization_id"?: string,"participants_count"?: number,"reference_number"?: string,"reviewed_at"?: string | null,"reviewer_remarks"?: string | null,"school_year_id"?: string,"source_of_funds"?: string | null,"start_time"?: string | null,"status"?: Database["public"]['Enums']["submission_status"],"submitted_at"?: string | null,"title"?: string,"updated_at"?: string,"venue"?: string,"venue_id"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_proposals_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_proposals_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_proposals_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["organization_id"]
    },{
      foreignKeyName: "activity_proposals_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "school_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_proposals_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "v_activity_summary_by_college"
      referencedColumns: ["school_year_id"]
    },{
      foreignKeyName: "activity_proposals_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["school_year_id"]
    },{
      foreignKeyName: "activity_proposals_venue_id_fkey"
      columns: ["venue_id"]
isOneToOne: false
      referencedRelation: "venues"
      referencedColumns: ["id"]
    }
                  ]
                },"advisers": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"organization_id": string,"profile_id": string,"school_year_id": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"organization_id": string,"profile_id": string,"school_year_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"organization_id"?: string,"profile_id"?: string,"school_year_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "advisers_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "advisers_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["organization_id"]
    },{
      foreignKeyName: "advisers_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "advisers_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "school_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "advisers_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "v_activity_summary_by_college"
      referencedColumns: ["school_year_id"]
    },{
      foreignKeyName: "advisers_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["school_year_id"]
    }
                  ]
                },"announcement_targets": {
                  Row: {
                    "announcement_id": string,"college_id": string | null,"created_at": string,"id": string,"organization_id": string | null
                  }
                  Insert: {
                    "announcement_id": string,"college_id"?: string | null,"created_at"?: string,"id"?: string,"organization_id"?: string | null
                  }
                  Update: {
                    "announcement_id"?: string,"college_id"?: string | null,"created_at"?: string,"id"?: string,"organization_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcement_targets_announcement_id_fkey"
      columns: ["announcement_id"]
isOneToOne: false
      referencedRelation: "announcements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "announcement_targets_college_id_fkey"
      columns: ["college_id"]
isOneToOne: false
      referencedRelation: "colleges"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "announcement_targets_college_id_fkey"
      columns: ["college_id"]
isOneToOne: false
      referencedRelation: "v_activity_summary_by_college"
      referencedColumns: ["college_id"]
    },{
      foreignKeyName: "announcement_targets_college_id_fkey"
      columns: ["college_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["college_id"]
    },{
      foreignKeyName: "announcement_targets_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "announcement_targets_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["organization_id"]
    }
                  ]
                },"announcements": {
                  Row: {
                    "attachment_file_name": string | null,"attachment_mime_type": string | null,"attachment_path": string | null,"attachment_size_bytes": number | null,"body": string,"created_at": string,"created_by": string | null,"expires_at": string | null,"id": string,"is_pinned": boolean,"target_type": Database["public"]['Enums']["announcement_target_type"],"title": string,"updated_at": string
                  }
                  Insert: {
                    "attachment_file_name"?: string | null,"attachment_mime_type"?: string | null,"attachment_path"?: string | null,"attachment_size_bytes"?: number | null,"body": string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string | null,"id"?: string,"is_pinned"?: boolean,"target_type"?: Database["public"]['Enums']["announcement_target_type"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "attachment_file_name"?: string | null,"attachment_mime_type"?: string | null,"attachment_path"?: string | null,"attachment_size_bytes"?: number | null,"body"?: string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string | null,"id"?: string,"is_pinned"?: boolean,"target_type"?: Database["public"]['Enums']["announcement_target_type"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"approval_chain_steps": {
                  Row: {
                    "chain_id": string,"created_at": string,"id": string,"step_number": number,"step_role": Database["public"]['Enums']["approval_step_role"],"updated_at": string
                  }
                  Insert: {
                    "chain_id": string,"created_at"?: string,"id"?: string,"step_number": number,"step_role": Database["public"]['Enums']["approval_step_role"],"updated_at"?: string
                  }
                  Update: {
                    "chain_id"?: string,"created_at"?: string,"id"?: string,"step_number"?: number,"step_role"?: Database["public"]['Enums']["approval_step_role"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "approval_chain_steps_chain_id_fkey"
      columns: ["chain_id"]
isOneToOne: false
      referencedRelation: "approval_chains"
      referencedColumns: ["id"]
    }
                  ]
                },"approval_chains": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"name": string,"record_type": Database["public"]['Enums']["record_type"],"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string,"record_type": Database["public"]['Enums']["record_type"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string,"record_type"?: Database["public"]['Enums']["record_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "approval_chains_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"approval_records": {
                  Row: {
                    "acted_at": string | null,"acted_by": string | null,"created_at": string,"id": string,"organization_id": string,"record_id": string,"record_type": Database["public"]['Enums']["record_type"],"remarks": string | null,"status": Database["public"]['Enums']["approval_step_status"],"step_number": number,"step_role": Database["public"]['Enums']["approval_step_role"],"updated_at": string,"version": number
                  }
                  Insert: {
                    "acted_at"?: string | null,"acted_by"?: string | null,"created_at"?: string,"id"?: string,"organization_id": string,"record_id": string,"record_type": Database["public"]['Enums']["record_type"],"remarks"?: string | null,"status"?: Database["public"]['Enums']["approval_step_status"],"step_number": number,"step_role": Database["public"]['Enums']["approval_step_role"],"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "acted_at"?: string | null,"acted_by"?: string | null,"created_at"?: string,"id"?: string,"organization_id"?: string,"record_id"?: string,"record_type"?: Database["public"]['Enums']["record_type"],"remarks"?: string | null,"status"?: Database["public"]['Enums']["approval_step_status"],"step_number"?: number,"step_role"?: Database["public"]['Enums']["approval_step_role"],"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "approval_records_acted_by_fkey"
      columns: ["acted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approval_records_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approval_records_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["organization_id"]
    }
                  ]
                },"audit_documents": {
                  Row: {
                    "approved_at": string | null,"created_at": string,"created_by": string,"description": string | null,"doc_type": Database["public"]['Enums']["audit_doc_type"],"endorsed_at": string | null,"id": string,"organization_id": string,"reference_number": string,"reviewed_at": string | null,"reviewer_remarks": string | null,"school_year_id": string,"semester": Database["public"]['Enums']["semester"],"status": Database["public"]['Enums']["submission_status"],"submitted_at": string | null,"title": string,"updated_at": string,"version": number
                  }
                  Insert: {
                    "approved_at"?: string | null,"created_at"?: string,"created_by": string,"description"?: string | null,"doc_type"?: Database["public"]['Enums']["audit_doc_type"],"endorsed_at"?: string | null,"id"?: string,"organization_id": string,"reference_number"?: string,"reviewed_at"?: string | null,"reviewer_remarks"?: string | null,"school_year_id": string,"semester"?: Database["public"]['Enums']["semester"],"status"?: Database["public"]['Enums']["submission_status"],"submitted_at"?: string | null,"title": string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "approved_at"?: string | null,"created_at"?: string,"created_by"?: string,"description"?: string | null,"doc_type"?: Database["public"]['Enums']["audit_doc_type"],"endorsed_at"?: string | null,"id"?: string,"organization_id"?: string,"reference_number"?: string,"reviewed_at"?: string | null,"reviewer_remarks"?: string | null,"school_year_id"?: string,"semester"?: Database["public"]['Enums']["semester"],"status"?: Database["public"]['Enums']["submission_status"],"submitted_at"?: string | null,"title"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_documents_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_documents_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_documents_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["organization_id"]
    },{
      foreignKeyName: "audit_documents_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "school_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_documents_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "v_activity_summary_by_college"
      referencedColumns: ["school_year_id"]
    },{
      foreignKeyName: "audit_documents_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["school_year_id"]
    }
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"changed_by": string | null,"changed_by_email": string | null,"created_at": string,"id": number,"new_data": Json | null,"old_data": Json | null,"record_id": string | null,"table_name": string
                  }
                  Insert: {
                    "action": string,"changed_by"?: string | null,"changed_by_email"?: string | null,"created_at"?: string,"id"?: never,"new_data"?: Json | null,"old_data"?: Json | null,"record_id"?: string | null,"table_name": string
                  }
                  Update: {
                    "action"?: string,"changed_by"?: string | null,"changed_by_email"?: string | null,"created_at"?: string,"id"?: never,"new_data"?: Json | null,"old_data"?: Json | null,"record_id"?: string | null,"table_name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"colleges": {
                  Row: {
                    "code": string,"created_at": string,"id": string,"is_active": boolean,"name": string,"updated_at": string
                  }
                  Insert: {
                    "code": string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"documents": {
                  Row: {
                    "bucket": string,"category": Database["public"]['Enums']["document_category"] | null,"created_at": string,"doc_type": Database["public"]['Enums']["document_kind"],"file_name": string,"id": string,"is_active": boolean,"mime_type": string,"organization_id": string,"parent_id": string | null,"record_id": string | null,"record_type": Database["public"]['Enums']["record_type"] | null,"size_bytes": number,"storage_path": string,"updated_at": string,"uploaded_by": string,"version": number
                  }
                  Insert: {
                    "bucket": string,"category"?: Database["public"]['Enums']["document_category"] | null,"created_at"?: string,"doc_type": Database["public"]['Enums']["document_kind"],"file_name": string,"id"?: string,"is_active"?: boolean,"mime_type": string,"organization_id": string,"parent_id"?: string | null,"record_id"?: string | null,"record_type"?: Database["public"]['Enums']["record_type"] | null,"size_bytes": number,"storage_path": string,"updated_at"?: string,"uploaded_by": string,"version"?: number
                  }
                  Update: {
                    "bucket"?: string,"category"?: Database["public"]['Enums']["document_category"] | null,"created_at"?: string,"doc_type"?: Database["public"]['Enums']["document_kind"],"file_name"?: string,"id"?: string,"is_active"?: boolean,"mime_type"?: string,"organization_id"?: string,"parent_id"?: string | null,"record_id"?: string | null,"record_type"?: Database["public"]['Enums']["record_type"] | null,"size_bytes"?: number,"storage_path"?: string,"updated_at"?: string,"uploaded_by"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "documents_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["organization_id"]
    },{
      foreignKeyName: "documents_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "v_document_latest"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"hardcopy_records": {
                  Row: {
                    "created_at": string,"id": string,"organization_id": string,"received": boolean,"received_at": string | null,"received_by": string | null,"receiver_name": string | null,"record_id": string,"record_type": Database["public"]['Enums']["record_type"],"reference_number": string,"remarks": string | null,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"organization_id": string,"received"?: boolean,"received_at"?: string | null,"received_by"?: string | null,"receiver_name"?: string | null,"record_id": string,"record_type": Database["public"]['Enums']["record_type"],"reference_number": string,"remarks"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"organization_id"?: string,"received"?: boolean,"received_at"?: string | null,"received_by"?: string | null,"receiver_name"?: string | null,"record_id"?: string,"record_type"?: Database["public"]['Enums']["record_type"],"reference_number"?: string,"remarks"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "hardcopy_records_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hardcopy_records_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["organization_id"]
    },{
      foreignKeyName: "hardcopy_records_received_by_fkey"
      columns: ["received_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"created_at": string,"emailed_at": string | null,"id": string,"is_read": boolean,"link": string | null,"read_at": string | null,"record_id": string | null,"record_type": Database["public"]['Enums']["record_type"] | null,"title": string,"type": Database["public"]['Enums']["notification_type"],"user_id": string
                  }
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"emailed_at"?: string | null,"id"?: string,"is_read"?: boolean,"link"?: string | null,"read_at"?: string | null,"record_id"?: string | null,"record_type"?: Database["public"]['Enums']["record_type"] | null,"title": string,"type"?: Database["public"]['Enums']["notification_type"],"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"emailed_at"?: string | null,"id"?: string,"is_read"?: boolean,"link"?: string | null,"read_at"?: string | null,"record_id"?: string | null,"record_type"?: Database["public"]['Enums']["record_type"] | null,"title"?: string,"type"?: Database["public"]['Enums']["notification_type"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"officer_terms": {
                  Row: {
                    "created_at": string,"id": string,"notes": string | null,"organization_id": string,"reviewed_at": string | null,"reviewed_by": string | null,"school_year_id": string,"status": Database["public"]['Enums']["officer_term_status"],"submitted_at": string | null,"submitted_by": string | null,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"notes"?: string | null,"organization_id": string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"school_year_id": string,"status"?: Database["public"]['Enums']["officer_term_status"],"submitted_at"?: string | null,"submitted_by"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"notes"?: string | null,"organization_id"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"school_year_id"?: string,"status"?: Database["public"]['Enums']["officer_term_status"],"submitted_at"?: string | null,"submitted_by"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "officer_terms_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "officer_terms_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["organization_id"]
    },{
      foreignKeyName: "officer_terms_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "officer_terms_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "school_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "officer_terms_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "v_activity_summary_by_college"
      referencedColumns: ["school_year_id"]
    },{
      foreignKeyName: "officer_terms_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["school_year_id"]
    },{
      foreignKeyName: "officer_terms_submitted_by_fkey"
      columns: ["submitted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"organization_officers": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"organization_id": string,"position": string,"profile_id": string,"school_year_id": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"organization_id": string,"position": string,"profile_id": string,"school_year_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"organization_id"?: string,"position"?: string,"profile_id"?: string,"school_year_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organization_officers_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "organization_officers_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["organization_id"]
    },{
      foreignKeyName: "organization_officers_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "organization_officers_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "school_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "organization_officers_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "v_activity_summary_by_college"
      referencedColumns: ["school_year_id"]
    },{
      foreignKeyName: "organization_officers_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["school_year_id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "accreditation_status": Database["public"]['Enums']["accreditation_status"],"accreditation_valid_until": string | null,"code": string,"college_id": string,"created_at": string,"description": string | null,"id": string,"is_active": boolean,"logo_path": string | null,"membership_count": number,"name": string,"updated_at": string
                  }
                  Insert: {
                    "accreditation_status"?: Database["public"]['Enums']["accreditation_status"],"accreditation_valid_until"?: string | null,"code": string,"college_id": string,"created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"logo_path"?: string | null,"membership_count"?: number,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "accreditation_status"?: Database["public"]['Enums']["accreditation_status"],"accreditation_valid_until"?: string | null,"code"?: string,"college_id"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"logo_path"?: string | null,"membership_count"?: number,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organizations_college_id_fkey"
      columns: ["college_id"]
isOneToOne: false
      referencedRelation: "colleges"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "organizations_college_id_fkey"
      columns: ["college_id"]
isOneToOne: false
      referencedRelation: "v_activity_summary_by_college"
      referencedColumns: ["college_id"]
    },{
      foreignKeyName: "organizations_college_id_fkey"
      columns: ["college_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["college_id"]
    }
                  ]
                },"other_documents": {
                  Row: {
                    "approved_at": string | null,"category": Database["public"]['Enums']["document_category"],"created_at": string,"created_by": string,"description": string | null,"endorsed_at": string | null,"id": string,"organization_id": string,"reference_number": string,"reviewed_at": string | null,"reviewer_remarks": string | null,"school_year_id": string,"status": Database["public"]['Enums']["submission_status"],"submitted_at": string | null,"title": string,"updated_at": string,"version": number
                  }
                  Insert: {
                    "approved_at"?: string | null,"category"?: Database["public"]['Enums']["document_category"],"created_at"?: string,"created_by": string,"description"?: string | null,"endorsed_at"?: string | null,"id"?: string,"organization_id": string,"reference_number"?: string,"reviewed_at"?: string | null,"reviewer_remarks"?: string | null,"school_year_id": string,"status"?: Database["public"]['Enums']["submission_status"],"submitted_at"?: string | null,"title": string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "approved_at"?: string | null,"category"?: Database["public"]['Enums']["document_category"],"created_at"?: string,"created_by"?: string,"description"?: string | null,"endorsed_at"?: string | null,"id"?: string,"organization_id"?: string,"reference_number"?: string,"reviewed_at"?: string | null,"reviewer_remarks"?: string | null,"school_year_id"?: string,"status"?: Database["public"]['Enums']["submission_status"],"submitted_at"?: string | null,"title"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "other_documents_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "other_documents_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "other_documents_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["organization_id"]
    },{
      foreignKeyName: "other_documents_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "school_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "other_documents_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "v_activity_summary_by_college"
      referencedColumns: ["school_year_id"]
    },{
      foreignKeyName: "other_documents_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["school_year_id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "college_id": string | null,"created_at": string,"email": string,"full_name": string,"id": string,"is_active": boolean,"last_sign_in_at": string | null,"organization_id": string | null,"position": string | null,"role": Database["public"]['Enums']["user_role"],"updated_at": string
                  }
                  Insert: {
                    "college_id"?: string | null,"created_at"?: string,"email": string,"full_name": string,"id": string,"is_active"?: boolean,"last_sign_in_at"?: string | null,"organization_id"?: string | null,"position"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string
                  }
                  Update: {
                    "college_id"?: string | null,"created_at"?: string,"email"?: string,"full_name"?: string,"id"?: string,"is_active"?: boolean,"last_sign_in_at"?: string | null,"organization_id"?: string | null,"position"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_college_id_fkey"
      columns: ["college_id"]
isOneToOne: false
      referencedRelation: "colleges"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profiles_college_id_fkey"
      columns: ["college_id"]
isOneToOne: false
      referencedRelation: "v_activity_summary_by_college"
      referencedColumns: ["college_id"]
    },{
      foreignKeyName: "profiles_college_id_fkey"
      columns: ["college_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["college_id"]
    },{
      foreignKeyName: "profiles_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profiles_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["organization_id"]
    }
                  ]
                },"rate_limits": {
                  Row: {
                    "attempts": number,"blocked_until": string | null,"key": string,"updated_at": string,"window_started": string
                  }
                  Insert: {
                    "attempts"?: number,"blocked_until"?: string | null,"key": string,"updated_at"?: string,"window_started"?: string
                  }
                  Update: {
                    "attempts"?: number,"blocked_until"?: string | null,"key"?: string,"updated_at"?: string,"window_started"?: string
                  }
                  Relationships: [
                    
                  ]
                },"requirements": {
                  Row: {
                    "assigned_by": string | null,"completed_at": string | null,"created_at": string,"description": string | null,"due_date": string | null,"id": string,"organization_id": string,"reminded_at": string | null,"school_year_id": string,"status": Database["public"]['Enums']["requirement_status"],"title": string,"updated_at": string
                  }
                  Insert: {
                    "assigned_by"?: string | null,"completed_at"?: string | null,"created_at"?: string,"description"?: string | null,"due_date"?: string | null,"id"?: string,"organization_id": string,"reminded_at"?: string | null,"school_year_id": string,"status"?: Database["public"]['Enums']["requirement_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "assigned_by"?: string | null,"completed_at"?: string | null,"created_at"?: string,"description"?: string | null,"due_date"?: string | null,"id"?: string,"organization_id"?: string,"reminded_at"?: string | null,"school_year_id"?: string,"status"?: Database["public"]['Enums']["requirement_status"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "requirements_assigned_by_fkey"
      columns: ["assigned_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "requirements_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "requirements_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["organization_id"]
    },{
      foreignKeyName: "requirements_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "school_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "requirements_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "v_activity_summary_by_college"
      referencedColumns: ["school_year_id"]
    },{
      foreignKeyName: "requirements_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["school_year_id"]
    }
                  ]
                },"review_logs": {
                  Row: {
                    "action": Database["public"]['Enums']["review_action"],"actor_id": string | null,"actor_name": string | null,"actor_role": Database["public"]['Enums']["user_role"] | null,"created_at": string,"from_status": Database["public"]['Enums']["submission_status"] | null,"id": number,"organization_id": string | null,"record_id": string,"record_type": Database["public"]['Enums']["record_type"],"remarks": string | null,"to_status": Database["public"]['Enums']["submission_status"] | null
                  }
                  Insert: {
                    "action": Database["public"]['Enums']["review_action"],"actor_id"?: string | null,"actor_name"?: string | null,"actor_role"?: Database["public"]['Enums']["user_role"] | null,"created_at"?: string,"from_status"?: Database["public"]['Enums']["submission_status"] | null,"id"?: never,"organization_id"?: string | null,"record_id": string,"record_type": Database["public"]['Enums']["record_type"],"remarks"?: string | null,"to_status"?: Database["public"]['Enums']["submission_status"] | null
                  }
                  Update: {
                    "action"?: Database["public"]['Enums']["review_action"],"actor_id"?: string | null,"actor_name"?: string | null,"actor_role"?: Database["public"]['Enums']["user_role"] | null,"created_at"?: string,"from_status"?: Database["public"]['Enums']["submission_status"] | null,"id"?: never,"organization_id"?: string | null,"record_id"?: string,"record_type"?: Database["public"]['Enums']["record_type"],"remarks"?: string | null,"to_status"?: Database["public"]['Enums']["submission_status"] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "review_logs_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "review_logs_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "review_logs_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["organization_id"]
    }
                  ]
                },"school_years": {
                  Row: {
                    "created_at": string,"end_date": string,"id": string,"is_archived": boolean,"is_current": boolean,"name": string,"start_date": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"end_date": string,"id"?: string,"is_archived"?: boolean,"is_current"?: boolean,"name": string,"start_date": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"end_date"?: string,"id"?: string,"is_archived"?: boolean,"is_current"?: boolean,"name"?: string,"start_date"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"system_settings": {
                  Row: {
                    "description": string | null,"key": string,"updated_at": string,"updated_by": string | null,"value": NonNullable<Json>
                  }
                  Insert: {
                    "description"?: string | null,"key": string,"updated_at"?: string,"updated_by"?: string | null,"value": NonNullable<Json>
                  }
                  Update: {
                    "description"?: string | null,"key"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "system_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"templates": {
                  Row: {
                    "category": Database["public"]['Enums']["template_category"],"created_at": string,"description": string | null,"file_name": string,"id": string,"is_active": boolean,"mime_type": string,"name": string,"parent_id": string | null,"size_bytes": number,"storage_path": string,"updated_at": string,"uploaded_by": string | null,"version": number
                  }
                  Insert: {
                    "category"?: Database["public"]['Enums']["template_category"],"created_at"?: string,"description"?: string | null,"file_name": string,"id"?: string,"is_active"?: boolean,"mime_type": string,"name": string,"parent_id"?: string | null,"size_bytes": number,"storage_path": string,"updated_at"?: string,"uploaded_by"?: string | null,"version"?: number
                  }
                  Update: {
                    "category"?: Database["public"]['Enums']["template_category"],"created_at"?: string,"description"?: string | null,"file_name"?: string,"id"?: string,"is_active"?: boolean,"mime_type"?: string,"name"?: string,"parent_id"?: string | null,"size_bytes"?: number,"storage_path"?: string,"updated_at"?: string,"uploaded_by"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "templates_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "templates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "templates_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"venues": {
                  Row: {
                    "capacity": number | null,"created_at": string,"id": string,"is_active": boolean,"location": string | null,"name": string,"updated_at": string
                  }
                  Insert: {
                    "capacity"?: number | null,"created_at"?: string,"id"?: string,"is_active"?: boolean,"location"?: string | null,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "capacity"?: number | null,"created_at"?: string,"id"?: string,"is_active"?: boolean,"location"?: string | null,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "v_accomplishment_report_list": {
                  Row: {
                    "activity_title": string | null,"approved_at": string | null,"attachment_count": number | null,"attendance_count": number | null,"budget_spent": number | null,"college_name": string | null,"copy_status": Database["public"]['Enums']["copy_status"] | null,"created_at": string | null,"created_by": string | null,"created_by_name": string | null,"endorsed_at": string | null,"hardcopy_received": boolean | null,"hardcopy_received_at": string | null,"hardcopy_receiver_name": string | null,"id": string | null,"liquidation_summary": string | null,"organization_code": string | null,"organization_id": string | null,"organization_name": string | null,"outcomes": string | null,"proposal_id": string | null,"reference_number": string | null,"reviewed_at": string | null,"reviewer_remarks": string | null,"school_year_id": string | null,"school_year_name": string | null,"status": Database["public"]['Enums']["submission_status"] | null,"submitted_at": string | null,"summary": string | null,"title": string | null,"updated_at": string | null,"version": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "accomplishment_reports_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "accomplishment_reports_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "accomplishment_reports_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["organization_id"]
    },{
      foreignKeyName: "accomplishment_reports_proposal_id_fkey"
      columns: ["proposal_id"]
isOneToOne: false
      referencedRelation: "activity_proposals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "accomplishment_reports_proposal_id_fkey"
      columns: ["proposal_id"]
isOneToOne: false
      referencedRelation: "v_activity_proposal_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "accomplishment_reports_proposal_id_fkey"
      columns: ["proposal_id"]
isOneToOne: false
      referencedRelation: "v_calendar_events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "accomplishment_reports_proposal_id_fkey"
      columns: ["proposal_id"]
isOneToOne: false
      referencedRelation: "v_venue_conflicts"
      referencedColumns: ["conflicting_id"]
    },{
      foreignKeyName: "accomplishment_reports_proposal_id_fkey"
      columns: ["proposal_id"]
isOneToOne: false
      referencedRelation: "v_venue_conflicts"
      referencedColumns: ["proposal_id"]
    },{
      foreignKeyName: "accomplishment_reports_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "school_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "accomplishment_reports_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "v_activity_summary_by_college"
      referencedColumns: ["school_year_id"]
    },{
      foreignKeyName: "accomplishment_reports_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["school_year_id"]
    }
                  ]
                },"v_activity_proposal_list": {
                  Row: {
                    "activity_date": string | null,"approved_at": string | null,"attachment_count": number | null,"budget": number | null,"college_name": string | null,"copy_status": Database["public"]['Enums']["copy_status"] | null,"created_at": string | null,"created_by": string | null,"created_by_name": string | null,"description": string | null,"end_time": string | null,"endorsed_at": string | null,"hardcopy_received": boolean | null,"hardcopy_received_at": string | null,"hardcopy_receiver_name": string | null,"id": string | null,"objectives": string | null,"organization_code": string | null,"organization_id": string | null,"organization_name": string | null,"participants_count": number | null,"reference_number": string | null,"reviewed_at": string | null,"reviewer_remarks": string | null,"school_year_id": string | null,"school_year_name": string | null,"source_of_funds": string | null,"start_time": string | null,"status": Database["public"]['Enums']["submission_status"] | null,"submitted_at": string | null,"title": string | null,"updated_at": string | null,"venue": string | null,"venue_id": string | null,"venue_location": string | null,"venue_name": string | null,"version": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_proposals_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_proposals_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_proposals_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["organization_id"]
    },{
      foreignKeyName: "activity_proposals_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "school_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_proposals_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "v_activity_summary_by_college"
      referencedColumns: ["school_year_id"]
    },{
      foreignKeyName: "activity_proposals_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["school_year_id"]
    },{
      foreignKeyName: "activity_proposals_venue_id_fkey"
      columns: ["venue_id"]
isOneToOne: false
      referencedRelation: "venues"
      referencedColumns: ["id"]
    }
                  ]
                },"v_activity_summary_by_college": {
                  Row: {
                    "approved_budget": number | null,"approved_proposals": number | null,"approved_reports": number | null,"college_code": string | null,"college_id": string | null,"college_name": string | null,"organization_count": number | null,"pending_proposals": number | null,"school_year_id": string | null,"school_year_name": string | null,"total_audit_documents": number | null,"total_proposals": number | null,"total_reports": number | null
                  }
                  Relationships: [
                    
                  ]
                },"v_audit_document_list": {
                  Row: {
                    "approved_at": string | null,"attachment_count": number | null,"college_name": string | null,"copy_status": Database["public"]['Enums']["copy_status"] | null,"created_at": string | null,"created_by": string | null,"created_by_name": string | null,"description": string | null,"doc_type": Database["public"]['Enums']["audit_doc_type"] | null,"endorsed_at": string | null,"hardcopy_received": boolean | null,"hardcopy_received_at": string | null,"hardcopy_receiver_name": string | null,"id": string | null,"organization_code": string | null,"organization_id": string | null,"organization_name": string | null,"reference_number": string | null,"reviewed_at": string | null,"reviewer_remarks": string | null,"school_year_id": string | null,"school_year_name": string | null,"semester": Database["public"]['Enums']["semester"] | null,"status": Database["public"]['Enums']["submission_status"] | null,"submitted_at": string | null,"title": string | null,"updated_at": string | null,"version": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_documents_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_documents_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_documents_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["organization_id"]
    },{
      foreignKeyName: "audit_documents_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "school_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_documents_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "v_activity_summary_by_college"
      referencedColumns: ["school_year_id"]
    },{
      foreignKeyName: "audit_documents_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["school_year_id"]
    }
                  ]
                },"v_calendar_events": {
                  Row: {
                    "activity_date": string | null,"college_id": string | null,"college_name": string | null,"created_at": string | null,"end_time": string | null,"id": string | null,"organization_id": string | null,"organization_name": string | null,"reference_number": string | null,"school_year_id": string | null,"start_time": string | null,"status": Database["public"]['Enums']["submission_status"] | null,"title": string | null,"venue": string | null,"venue_id": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_proposals_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_proposals_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["organization_id"]
    },{
      foreignKeyName: "activity_proposals_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "school_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_proposals_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "v_activity_summary_by_college"
      referencedColumns: ["school_year_id"]
    },{
      foreignKeyName: "activity_proposals_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["school_year_id"]
    },{
      foreignKeyName: "activity_proposals_venue_id_fkey"
      columns: ["venue_id"]
isOneToOne: false
      referencedRelation: "venues"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "organizations_college_id_fkey"
      columns: ["college_id"]
isOneToOne: false
      referencedRelation: "colleges"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "organizations_college_id_fkey"
      columns: ["college_id"]
isOneToOne: false
      referencedRelation: "v_activity_summary_by_college"
      referencedColumns: ["college_id"]
    },{
      foreignKeyName: "organizations_college_id_fkey"
      columns: ["college_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["college_id"]
    }
                  ]
                },"v_document_latest": {
                  Row: {
                    "bucket": string | null,"category": Database["public"]['Enums']["document_category"] | null,"created_at": string | null,"doc_type": Database["public"]['Enums']["document_kind"] | null,"file_name": string | null,"id": string | null,"is_active": boolean | null,"mime_type": string | null,"organization_id": string | null,"parent_id": string | null,"record_id": string | null,"record_type": Database["public"]['Enums']["record_type"] | null,"size_bytes": number | null,"storage_path": string | null,"updated_at": string | null,"uploaded_by": string | null,"version": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "documents_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["organization_id"]
    },{
      foreignKeyName: "documents_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "v_document_latest"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"v_organization_summary": {
                  Row: {
                    "accreditation_status": Database["public"]['Enums']["accreditation_status"] | null,"approved_audit_documents": number | null,"approved_budget": number | null,"approved_proposals": number | null,"approved_reports": number | null,"college_id": string | null,"college_name": string | null,"completed_requirements": number | null,"is_active": boolean | null,"membership_count": number | null,"open_requirements": number | null,"organization_code": string | null,"organization_id": string | null,"organization_name": string | null,"overdue_requirements": number | null,"pending_proposals": number | null,"rejected_proposals": number | null,"school_year_id": string | null,"school_year_name": string | null,"total_audit_documents": number | null,"total_proposals": number | null,"total_reports": number | null,"total_requirements": number | null
                  }
                  Relationships: [
                    
                  ]
                },"v_other_document_list": {
                  Row: {
                    "approved_at": string | null,"attachment_count": number | null,"category": Database["public"]['Enums']["document_category"] | null,"college_name": string | null,"copy_status": Database["public"]['Enums']["copy_status"] | null,"created_at": string | null,"created_by": string | null,"created_by_name": string | null,"description": string | null,"endorsed_at": string | null,"hardcopy_received": boolean | null,"hardcopy_received_at": string | null,"id": string | null,"organization_code": string | null,"organization_id": string | null,"organization_name": string | null,"reference_number": string | null,"reviewed_at": string | null,"reviewer_remarks": string | null,"school_year_id": string | null,"school_year_name": string | null,"status": Database["public"]['Enums']["submission_status"] | null,"submitted_at": string | null,"title": string | null,"updated_at": string | null,"version": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "other_documents_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "other_documents_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "other_documents_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["organization_id"]
    },{
      foreignKeyName: "other_documents_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "school_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "other_documents_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "v_activity_summary_by_college"
      referencedColumns: ["school_year_id"]
    },{
      foreignKeyName: "other_documents_school_year_id_fkey"
      columns: ["school_year_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["school_year_id"]
    }
                  ]
                },"v_pending_approval": {
                  Row: {
                    "approval_record_id": string | null,"organization_id": string | null,"organization_name": string | null,"record_id": string | null,"record_type": Database["public"]['Enums']["record_type"] | null,"reference_number": string | null,"step_created_at": string | null,"step_number": number | null,"step_role": Database["public"]['Enums']["approval_step_role"] | null,"submission_status": Database["public"]['Enums']["submission_status"] | null,"submitted_at": string | null,"title": string | null,"version": number | null
                  }
                  Relationships: [
                    
                  ]
                },"v_venue_conflicts": {
                  Row: {
                    "activity_date": string | null,"conflicting_id": string | null,"conflicting_organization_id": string | null,"conflicting_organization_name": string | null,"conflicting_reference": string | null,"conflicting_status": Database["public"]['Enums']["submission_status"] | null,"conflicting_title": string | null,"organization_id": string | null,"organization_name": string | null,"overlap_end": string | null,"overlap_start": string | null,"proposal_id": string | null,"reference_number": string | null,"status": Database["public"]['Enums']["submission_status"] | null,"title": string | null,"venue_id": string | null,"venue_name": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_proposals_organization_id_fkey"
      columns: ["conflicting_organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_proposals_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_proposals_organization_id_fkey"
      columns: ["conflicting_organization_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["organization_id"]
    },{
      foreignKeyName: "activity_proposals_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "v_organization_summary"
      referencedColumns: ["organization_id"]
    },{
      foreignKeyName: "activity_proposals_venue_id_fkey"
      columns: ["venue_id"]
isOneToOne: false
      referencedRelation: "venues"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "add_review_comment":
{ Args: { "p_record_id": string,"p_record_type": Database["public"]['Enums']["record_type"],"p_remarks": string }; Returns: undefined
                           },
"can_access_org_path":
{ Args: { "p_org_segment": string }; Returns: boolean
                           },
"can_view_org":
{ Args: { "p_organization_id": string }; Returns: boolean
                           },
"check_rate_limit":
{ Args: { "p_block_seconds"?: number,"p_key": string,"p_max_attempts"?: number,"p_window_seconds"?: number }; Returns: Json
                           },
"ensure_approval_instance":
{ Args: { "p_record_id": string,"p_record_type": Database["public"]['Enums']["record_type"] }; Returns: undefined
                           },
"find_venue_conflicts":
{ Args: { "p_date": string,"p_end"?: string,"p_exclude_id"?: string,"p_start"?: string,"p_venue_id": string }; Returns: {
              "end_time": string,"organization_name": string,"record_id": string,"reference_number": string,"start_time": string,"status": Database["public"]['Enums']["submission_status"],"title": string
            }[]
                           },
"generate_reference_number":
{ Args: { "p_prefix"?: string }; Returns: string
                           },
"get_my_advised_org_ids":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"get_my_college_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"get_my_org_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"get_my_profile":
{ Args: Record<PropertyKey, never>; Returns: {
              "college_id": string | null,
"created_at": string,
"email": string,
"full_name": string,
"id": string,
"is_active": boolean,
"last_sign_in_at": string | null,
"organization_id": string | null,
"position": string | null,
"role": Database["public"]['Enums']["user_role"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"get_my_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["user_role"]
                           },
"instantiate_approval_chain":
{ Args: { "p_organization_id": string,"p_record_id": string,"p_record_type": Database["public"]['Enums']["record_type"],"p_version": number }; Returns: undefined
                           },
"is_adviser_of":
{ Args: { "p_organization_id": string }; Returns: boolean
                           },
"is_dean_of":
{ Args: { "p_college_id": string }; Returns: boolean
                           },
"is_dean_of_org":
{ Args: { "p_organization_id": string }; Returns: boolean
                           },
"is_osa":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_super_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"mark_hardcopy_received":
{ Args: { "p_received_at"?: string,"p_receiver_name": string,"p_record_id": string,"p_record_type": Database["public"]['Enums']["record_type"],"p_remarks"?: string }; Returns: string
                           },
"notify_announcement_recipients":
{ Args: { "p_announcement_id": string }; Returns: number
                           },
"notify_approval_step":
{ Args: { "p_body": string,"p_organization_id": string,"p_record_id": string,"p_record_type": Database["public"]['Enums']["record_type"],"p_step_role": Database["public"]['Enums']["approval_step_role"],"p_title": string,"p_type": Database["public"]['Enums']["notification_type"] }; Returns: undefined
                           },
"notify_org_officers":
{ Args: { "p_body"?: string,"p_link"?: string,"p_organization_id": string,"p_title": string,"p_type": Database["public"]['Enums']["notification_type"] }; Returns: string[]
                           },
"notify_user":
{ Args: { "p_body"?: string,"p_link"?: string,"p_record_id"?: string,"p_record_type"?: Database["public"]['Enums']["record_type"],"p_title": string,"p_type": Database["public"]['Enums']["notification_type"],"p_user_id": string }; Returns: string
                           },
"record_type_table":
{ Args: { "p_record_type": Database["public"]['Enums']["record_type"] }; Returns: string
                           },
"submission_path":
{ Args: { "p_record_id": string,"p_record_type": Database["public"]['Enums']["record_type"] }; Returns: string
                           },
"sweep_requirements":
{ Args: { "p_reminder_days"?: number }; Returns: number
                           },
"transition_submission":
{ Args: { "p_record_id": string,"p_record_type": Database["public"]['Enums']["record_type"],"p_remarks"?: string,"p_to_status": Database["public"]['Enums']["submission_status"] }; Returns: Database["public"]['Enums']["submission_status"]
                           }
          }
          Enums: {
            "accreditation_status": "pending"|"accredited"|"conditional"|"not_accredited","accreditation_submission_status": "pending"|"approved"|"rejected","announcement_target_type": "all"|"college"|"organization","approval_step_role": "adviser"|"dean"|"osa_admin","approval_step_status": "pending"|"approved"|"rejected"|"revision_requested"|"cancelled","audit_doc_type": "financial_statement"|"receipt"|"audit_report"|"other","copy_status": "softcopy_only"|"hardcopy_received"|"complete","document_category": "constitution_by_laws"|"resolution"|"memo"|"minutes"|"other","document_kind": "proposal"|"report"|"audit"|"other"|"logo","notification_type": "status_change"|"comment"|"requirement"|"reminder"|"system","officer_term_status": "draft"|"submitted"|"approved"|"rejected","record_type": "activity_proposal"|"accomplishment_report"|"audit_document"|"other_document","requirement_status": "open"|"completed"|"overdue"|"waived","review_action": "created"|"submitted"|"resubmitted"|"withdrawn"|"endorsed"|"commented"|"started_review"|"revision_requested"|"approved"|"rejected"|"hardcopy_received"|"step_approved","semester": "first"|"second"|"summer","submission_status": "draft"|"submitted"|"endorsed"|"under_review"|"revision_requested"|"approved"|"rejected","template_category": "proposal_form"|"liquidation_form"|"accomplishment_report"|"other","user_role": "super_admin"|"osa_admin"|"adviser"|"officer"|"dean"
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
            "accreditation_status": ["pending", "accredited", "conditional", "not_accredited"],"accreditation_submission_status": ["pending", "approved", "rejected"],"announcement_target_type": ["all", "college", "organization"],"approval_step_role": ["adviser", "dean", "osa_admin"],"approval_step_status": ["pending", "approved", "rejected", "revision_requested", "cancelled"],"audit_doc_type": ["financial_statement", "receipt", "audit_report", "other"],"copy_status": ["softcopy_only", "hardcopy_received", "complete"],"document_category": ["constitution_by_laws", "resolution", "memo", "minutes", "other"],"document_kind": ["proposal", "report", "audit", "other", "logo"],"notification_type": ["status_change", "comment", "requirement", "reminder", "system"],"officer_term_status": ["draft", "submitted", "approved", "rejected"],"record_type": ["activity_proposal", "accomplishment_report", "audit_document", "other_document"],"requirement_status": ["open", "completed", "overdue", "waived"],"review_action": ["created", "submitted", "resubmitted", "withdrawn", "endorsed", "commented", "started_review", "revision_requested", "approved", "rejected", "hardcopy_received", "step_approved"],"semester": ["first", "second", "summer"],"submission_status": ["draft", "submitted", "endorsed", "under_review", "revision_requested", "approved", "rejected"],"template_category": ["proposal_form", "liquidation_form", "accomplishment_report", "other"],"user_role": ["super_admin", "osa_admin", "adviser", "officer", "dean"]
          }
        }
} as const
