export type UserRole = 'admin' | 'cra';
export type SourceType = 'linkedin' | 'apollo' | 'manual' | 'import' | 'google_search';
export type OpportunityType = 'existing_post' | 'cold_outreach';
export type JDStatus = 'active' | 'converted' | 'purchased' | 'closed' | 'archived';
export type OutreachChannelType = 'call' | 'mail' | 'text' | 'whatsapp' | 'linkedin';
export type OutreachChannelStatus = 'not_started' | 'sent' | 'replied' | 'failed';
export type CampaignStatus = 'draft' | 'active' | 'completed';
export type OutcomeStatus = 'pending' | 'jd_received' | 'not_eligible' | 'eligible_active' | 'rejected' | 'community_joined' | 'converted';

export * from './attendance';

export interface CRA {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  emp_id?: string;
  phone?: string;
  join_date?: string;
  base_salary?: number;
  jd_payout_rate?: number;
  monthly_jd_target?: number;
  is_active?: boolean;
  deleted_at?: string;
  created_at: string;
}

export interface SalaryRecord {
  cra_id: string;
  cra_name: string;
  emp_id?: string;
  email: string;
  role: UserRole;
  base_salary: number;
  jd_payout_rate: number;
  monthly_jd_target: number;
  converted_jds_count: number;
  converted_jds: JD[];
  total_jds_count: number;
  total_contacts_count: number;
  jd_incentive_amount: number;
  bonus_amount: number;
  total_payout: number;
  month: string;
  status: 'draft' | 'approved' | 'paid';
}

export interface Company {
  id: string;
  name: string;
  industry?: string;
  website?: string;
  linkedin_url?: string;
  source: SourceType;
  notes?: string;
  created_by?: string;
  created_at: string;
  creator?: CRA;
  employee_count?: string;
  location?: string;
  entered_by_name?: string;
  contacts?: HRContact[];
  contacts_count?: number;
  jds?: JD[];
}

export interface HRContact {
  id: string;
  name: string;
  title?: string;
  company_id: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  source: SourceType;
  created_by?: string;
  created_at: string;
  company?: Company;
  creator?: CRA;
  entered_by_name?: string;
  domain?: string;
  location?: string;
  remarks?: string;
  spoc?: string;
}

export interface JD {
  id: string;
  title: string;
  company_id: string;
  raw_text: string;
  is_verified: boolean;
  status?: JDStatus;
  is_purchased?: boolean;
  purchase_date?: string;
  client_notes?: string;
  verification_source?: 'html_url_parser' | 'manual_entry' | 'file_ai_extract' | 'pdf_upload';
  opportunity_type: OpportunityType;
  date_found: string;
  created_by?: string;
  created_at: string;
  company?: Company;
  creator?: CRA;
}

export interface OutreachChannel {
  id: string;
  contact_id: string;
  channel: OutreachChannelType;
  status: OutreachChannelStatus;
  timestamp: string;
  notes?: string;
  call_duration_seconds?: number;
  call_outcome?: string;
  campaign_id?: string;
  created_at: string;
  contact?: HRContact;
  proof?: OutreachProof;
}

export interface OutreachProof {
  id: string;
  outreach_id: string;
  filename: string;
  mime_type: string;
  evidence_type: string;
  verification_status: 'verified' | 'needs_review' | 'not_verified';
  confidence: 'high' | 'medium' | 'low';
  summary: string;
  extracted_details: string;
  concerns: string;
  created_at: string;
}

export interface OutreachOutcome {
  id: string;
  contact_id: string;
  jd_received: boolean;
  jd_id?: string;
  is_eligible?: boolean;
  eligibility_notes?: string;
  outcome_status: OutcomeStatus;
  updated_by?: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  owner_id?: string;
  status: CampaignStatus;
  created_at: string;
  owner?: CRA;
  contacts?: HRContact[];
}

export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export interface Task {
  id: string;
  title: string;
  description?: string;
  assignee_id: string;
  assigned_by_id?: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_date?: string;
  company_id?: string;
  contact_id?: string;
  is_recurring?: boolean;
  recurring_frequency?: 'daily' | 'weekly' | 'monthly';
  last_regenerated_at?: string;
  is_dismissed?: boolean;
  snoozed_until?: string;
  created_at: string;
  updated_at: string;
  assignee?: CRA;
  assigned_by?: CRA;
  company?: Company;
  contact?: HRContact;
}

export interface TeamLeadStats {
  eligible_jds_this_month: number;
  drives_scheduled_this_month: number;
  attendance_today_present: number;
  attendance_today_total: number;
  attendance_today_pct: number;
  jds_received_today: number;
  interviews_scheduled_today: number;
  interviews_on_hold_month: number;
  pf_target_achievement_pct: number;
  pf_target_achieved_count: number;
  pf_target_total_goal: number;
}

export interface DashboardStats {
  total_verified_opportunities: number;
  total_contacts: number;
  total_companies: number;
  active_campaign_count: number;
  outreach_by_channel: { channel: string; count: number }[];
  outreach_by_status: { status: string; count: number }[];
  total_jds_received?: number;
  total_eligible_opportunities?: number;
  overall_conversion_rate?: number;
  unique_companies_onboarded?: number;
  active_placement_drives?: number;
  jd_received_rate?: number;
  community_funnel?: FunnelStage[];
  jd_funnel?: FunnelStage[];
}

export interface FunnelStage {
  stage_name: string;
  count: number;
  dropoff_count: number;
  dropoff_pct: number;
}

export interface ChannelMetric {
  channel: string;
  sent: number;
  replied: number;
  jds_yielded: number;
  conversion_rate: number;
}

export interface CRAPerformanceItem {
  cra_id: string;
  cra_name: string;
  cra_email: string;
  monthly_jd_target: number;
  jds_this_month: number;
  target_progress_pct: number;
  contacts_sourced: number;
  outreach_sent: number;
  outreach_by_channel: Record<string, number>;
  replies_received: number;
  jds_received: number;
  eligible_jds: number;
  conversion_rate: number;
  eligibility_rate: number;
  contact_to_jd_ratio: number;
  community_joins: number;
  community_funnel: FunnelStage[];
  jd_funnel: FunnelStage[];
  channel_performance: ChannelMetric[];
  login_at?: string;
  logout_at?: string;
  attendance_status: 'not_logged_in' | 'logged_in' | 'logged_out' | 'team_summary';
  hours_worked: number;
  sourced_roles_breakdown: { role: string; count: number }[];
  total_companies_worked: number;
  jds_sourced_all_time: number;
  jds_sourced_this_month: number;
  jds_received_this_month: number;
}

export interface CRAPerformanceResponse {
  cras: CRAPerformanceItem[];
  totals: CRAPerformanceItem;
}

export type LeaveType = 'casual' | 'sick' | 'earned' | 'unpaid' | 'other';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveRequest {
  id: string;
  cra_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string;
  status: LeaveStatus;
  reviewed_by?: string;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
  cra?: CRA;
  reviewer?: CRA;
}
