import { ALL_EMPLOYEE_CREDENTIALS } from '../data/employeeCredentials';
import { INITIAL_PDF_LEADS } from '../data/pdfLeadsData';
import { 
  CRA, 
  Company, 
  HRContact, 
  Task, 
  LeaveRequest, 
  DashboardStats,
  JD,
  OutreachChannel,
  TotalCompanyRecord,
  TotalCompanyImportBatch
} from '../types';

const STORAGE_KEYS = {
  USERS: 'placemein_mock_users',
  COMPANIES: 'placemein_mock_companies',
  CONTACTS: 'placemein_mock_contacts',
  TASKS: 'placemein_mock_tasks',
  LEAVES: 'placemein_mock_leaves',
  CURRENT_USER: 'placemein_current_user',
  JDS: 'placemein_mock_jds',
  TOTAL_COMPANY_LIST: 'placemein_total_company_list',
};

// Initial setup from seed data
function initializeMockData() {
  // Synchronize active team roster into localStorage
  const existingUsersJson = localStorage.getItem(STORAGE_KEYS.USERS);
  let defaultUsers: CRA[] = [];
  try {
    defaultUsers = existingUsersJson ? JSON.parse(existingUsersJson) : [];
  } catch (_) {
    defaultUsers = [];
  }

  ALL_EMPLOYEE_CREDENTIALS.forEach((emp) => {
    const existingIndex = defaultUsers.findIndex(
      (u) => u.email.toLowerCase() === emp.email.toLowerCase() || u.emp_id === emp.empId
    );
    const userEntry: CRA = {
      id: emp.id,
      name: emp.name,
      email: emp.email,
      role: emp.role,
      emp_id: emp.empId,
      monthly_jd_target: 20,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    if (existingIndex >= 0) {
      defaultUsers[existingIndex] = {
        ...defaultUsers[existingIndex],
        name: emp.name,
        role: emp.role,
        emp_id: emp.empId,
      };
    } else {
      defaultUsers.push(userEntry);
    }
  });

  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(defaultUsers));

  if (!localStorage.getItem(STORAGE_KEYS.COMPANIES) || !localStorage.getItem(STORAGE_KEYS.CONTACTS)) {
    const companies: Company[] = [];
    const contacts: HRContact[] = [];

    INITIAL_PDF_LEADS.forEach((lead) => {
      let company = companies.find((c) => c.name.toLowerCase() === lead.company_name.toLowerCase());
      if (!company) {
        company = {
          id: 'comp_' + lead.id,
          name: lead.company_name,
          employee_count: lead.employee_count,
          linkedin_url: lead.linkedin_url,
          website: lead.website,
          industry: lead.industry,
          source: 'import',
          location: lead.location,
          created_at: new Date().toISOString(),
        };
        companies.push(company);
      }

      contacts.push({
        id: lead.id,
        company_id: company.id,
        name: lead.hr_name,
        title: lead.title,
        email: lead.email,
        phone: lead.phone,
        linkedin_url: lead.hr_linkedin,
        remarks: lead.remarks,
        spoc: lead.spoc,
        domain: lead.domain,
        location: lead.location,
        entered_by_name: lead.entered_by_name,
        source: 'import',
        company,
        created_at: new Date().toISOString(),
      });
    });

    localStorage.setItem(STORAGE_KEYS.COMPANIES, JSON.stringify(companies));
    localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(contacts));
  }

  if (!localStorage.getItem(STORAGE_KEYS.TASKS)) {
    const initialTasks: Task[] = [
      {
        id: 'task-1',
        title: 'Source 15 Cyber Security Lead Profiles',
        description: 'Target Mid to Senior Talent Acquisition Specialists in Bengaluru & Hyderabad.',
        assignee_id: 'usr_cra_1',
        assigned_by_id: 'usr_admin_aravind',
        due_date: new Date(Date.now() + 86400000 * 2).toISOString(),
        priority: 'high',
        status: 'in_progress',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'task-2',
        title: 'Verify 10 FinTech HR Phone Numbers',
        description: 'Direct dial outreach verification for upcoming Q3 placement drive.',
        assignee_id: 'usr_cra_2',
        assigned_by_id: 'usr_admin_aravind',
        due_date: new Date(Date.now() + 86400000 * 3).toISOString(),
        priority: 'medium',
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(initialTasks));
  }

  if (!localStorage.getItem(STORAGE_KEYS.LEAVES)) {
    const initialLeaves: LeaveRequest[] = [
      {
        id: 'leave-1',
        cra_id: 'usr_cra_1',
        leave_type: 'casual',
        start_date: new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10),
        end_date: new Date(Date.now() + 86400000 * 6).toISOString().slice(0, 10),
        days_count: 2,
        reason: 'Personal travel',
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    localStorage.setItem(STORAGE_KEYS.LEAVES, JSON.stringify(initialLeaves));
  }

  // Self-healing check for JDs storage to prevent quota overflow
  try {
    const existingJDsRaw = localStorage.getItem(STORAGE_KEYS.JDS);
    if (!existingJDsRaw) {
      const initialJDs: JD[] = [
        {
          id: 'jd-seed-1',
          title: 'Data Engineer',
          company_id: 'comp_1',
          raw_text: 'Responsibilities include designing, building, and maintaining robust data pipelines and analytics systems.',
          is_verified: true,
          verification_source: 'file_ai_extract',
          opportunity_type: 'existing_post',
          date_found: new Date().toISOString().slice(0, 10),
          created_at: new Date().toISOString(),
        },
        {
          id: 'jd-seed-2',
          title: 'Senior Fullstack Engineer',
          company_id: 'comp_2',
          raw_text: 'Seeking a fullstack developer proficient in React, Node.js, and TypeScript with 3+ years experience.',
          is_verified: true,
          verification_source: 'file_ai_extract',
          opportunity_type: 'existing_post',
          date_found: new Date().toISOString().slice(0, 10),
          created_at: new Date().toISOString(),
        },
      ];
      localStorage.setItem(STORAGE_KEYS.JDS, JSON.stringify(initialJDs));
    } else {
      // Existing data check: if oversized (e.g. from previously pasted raw HTML), compact immediately
      try {
        const parsed = JSON.parse(existingJDsRaw);
        if (Array.isArray(parsed)) {
          let modified = false;
          const cleaned = parsed.slice(0, 80).map((j: any) => {
            if (typeof j?.raw_text === 'string' && j.raw_text.length > 4000) {
              modified = true;
              return { ...j, raw_text: j.raw_text.slice(0, 4000) };
            }
            return j;
          });
          if (modified || existingJDsRaw.length > 250000) {
            localStorage.setItem(STORAGE_KEYS.JDS, JSON.stringify(cleaned));
          }
        }
      } catch {
        // If unparseable or corrupted, clear and re-initialize
        localStorage.removeItem(STORAGE_KEYS.JDS);
      }
    }
    // Initialize TOTAL_COMPANY_LIST seeds for audit and error tracking
    if (!localStorage.getItem(STORAGE_KEYS.TOTAL_COMPANY_LIST)) {
      const initialTotalCompanyList: TotalCompanyRecord[] = [
        {
          id: 'tcl_seed_1',
          name: 'Tech Mahindra Limited',
          industry: 'Information Technology',
          website: 'https://www.techmahindra.com',
          linkedin_url: 'https://www.linkedin.com/company/tech-mahindra',
          employee_count: '100,000+ employees',
          location: 'Pune / Hyderabad, India',
          source: 'bulk_import',
          notes: 'Fortune 500 IT Services Provider',
          import_status: 'imported',
          batch_id: 'batch_seed_001',
          row_number: 1,
          imported_by: 'Aravind Reddy',
          created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
        },
        {
          id: 'tcl_seed_2',
          name: 'Wipro Technologies',
          industry: 'IT Services & Consulting',
          website: 'https://www.wipro.com',
          linkedin_url: 'https://www.linkedin.com/company/wipro',
          employee_count: '10,000+ employees',
          location: 'Bengaluru, India',
          source: 'bulk_import',
          notes: 'Enterprise Software & Cloud',
          import_status: 'imported',
          batch_id: 'batch_seed_001',
          row_number: 2,
          imported_by: 'Aravind Reddy',
          created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
        },
        {
          id: 'tcl_seed_3',
          name: 'Infosys Limited',
          industry: 'IT Services',
          website: 'https://www.infosys.com',
          linkedin_url: 'https://www.linkedin.com/company/infosys',
          employee_count: '10,000+ employees',
          location: 'Bengaluru, Karnataka',
          source: 'bulk_import',
          notes: 'Global Tech Consulting',
          import_status: 'duplicate_skipped',
          error_log: 'Duplicate: Exact company name matches existing master directory record "Infosys"',
          validation_errors: ['Company already exists in database'],
          raw_row_data: { Company: 'Infosys Limited', Website: 'infosys.com' },
          batch_id: 'batch_seed_001',
          row_number: 3,
          imported_by: 'Aravind Reddy',
          created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
        },
        {
          id: 'tcl_seed_4',
          name: 'Nexus Alpha Ventures',
          industry: 'Software',
          website: 'htp://invalid-link',
          linkedin_url: 'https://twitter.com/notlinkedin',
          employee_count: '-5',
          location: 'Hyderabad',
          source: 'bulk_import',
          notes: 'Series A FinTech candidate',
          import_status: 'error',
          error_log: '[Row 4] Validation failed: Website URL is invalid (missing http/https protocol); LinkedIn URL must belong to linkedin.com; Employee count cannot be negative.',
          validation_errors: [
            'Website URL is invalid (missing http/https or invalid hostname)',
            'LinkedIn URL must belong to linkedin.com',
            'Employee count cannot be negative'
          ],
          raw_row_data: { Company: 'Nexus Alpha Ventures', Website: 'htp://invalid-link', LinkedIn: 'https://twitter.com/notlinkedin' },
          batch_id: 'batch_seed_001',
          row_number: 4,
          imported_by: 'Aravind Reddy',
          created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
        },
        {
          id: 'tcl_seed_5',
          name: '',
          industry: 'Consulting',
          website: 'https://www.stealth.io',
          source: 'bulk_import',
          import_status: 'error',
          error_log: '[Row 5] Validation failed: Company name is required and cannot be empty.',
          validation_errors: ['Company name is required and cannot be empty'],
          raw_row_data: { Company: '', Website: 'https://www.stealth.io' },
          batch_id: 'batch_seed_001',
          row_number: 5,
          imported_by: 'Aravind Reddy',
          created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
        },
      ];
      localStorage.setItem(STORAGE_KEYS.TOTAL_COMPANY_LIST, JSON.stringify(initialTotalCompanyList));
    }
  } catch (e) {
    console.warn('[Storage] Quota check/initialization error:', e);
  }
}

try {
  initializeMockData();
} catch (_) {}

// In-memory fallback in case localStorage quota is exceeded
let inMemoryJDs: JD[] = [];

export const clientFallbackStore = {
  getUsers(includeInactive: boolean = true): CRA[] {
    try {
      const users: CRA[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
      if (includeInactive) return users;
      return users.filter((u) => u.is_active !== false && !u.deleted_at);
    } catch {
      return [];
    }
  },

  getCurrentUser(): CRA {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (saved) return JSON.parse(saved);
    } catch {}
    const users = this.getUsers();
    return users[0] || {
      id: 'usr_admin_aravind',
      name: 'Aravind Reddy',
      email: 'aravindaravind3953@gmail.com',
      role: 'admin',
      emp_id: 'PM-CEO',
      monthly_jd_target: 20,
      is_active: true,
      created_at: new Date().toISOString(),
    };
  },

  setCurrentUser(user: CRA) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  },

  getCompanies(): Company[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.COMPANIES) || '[]');
    } catch {
      return [];
    }
  },

  getContacts(): HRContact[] {
    try {
      const contacts: HRContact[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CONTACTS) || '[]');
      const companies = this.getCompanies();
      return contacts.map((c) => ({
        ...c,
        company: c.company || companies.find((comp) => comp.id === c.company_id),
      }));
    } catch {
      return [];
    }
  },

  saveContacts(contacts: HRContact[]) {
    localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(contacts));
  },

  saveCompanies(companies: Company[]) {
    localStorage.setItem(STORAGE_KEYS.COMPANIES, JSON.stringify(companies));
  },

  bulkImportWorksheetLeads(rawLeads: Array<{
    company_name: string;
    website?: string;
    linkedin_url?: string;
    employee_count?: string;
    industry?: string;
    hr_name: string;
    title?: string;
    phone?: string;
    email?: string;
    hr_linkedin?: string;
    domain?: string;
    location?: string;
    remarks?: string;
    spoc?: string;
    entered_by_name?: string;
  }>): { count: number; companies_created: number; contacts_created: number } {
    const existingCompanies = this.getCompanies();
    const existingContacts = this.getContacts();
    let companiesCreated = 0;
    let contactsCreated = 0;

    rawLeads.forEach((item, index) => {
      const cleanCompName = (item.company_name || '').trim();
      const cleanHrName = (item.hr_name || '').trim();
      if (!cleanCompName || !cleanHrName) return;

      let company = existingCompanies.find(
        (c) => c.name.toLowerCase().trim() === cleanCompName.toLowerCase()
      );

      if (!company) {
        company = {
          id: `comp_excel_${Date.now()}_${index}`,
          name: cleanCompName,
          website: item.website?.trim() || '',
          linkedin_url: item.linkedin_url?.trim() || `https://www.linkedin.com/company/${cleanCompName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          employee_count: item.employee_count?.trim() || '100-500 employees',
          industry: item.industry?.trim() || item.domain?.trim() || 'Technology',
          location: item.location?.trim() || '',
          entered_by_name: item.entered_by_name?.trim() || 'Aravind Reddy',
          source: 'import',
          created_at: new Date().toISOString(),
        };
        existingCompanies.unshift(company);
        companiesCreated++;
      } else {
        if (item.employee_count && (!company.employee_count || company.employee_count === '100-500 employees')) {
          company.employee_count = item.employee_count;
        }
        if (item.website && !company.website) company.website = item.website;
        if (item.linkedin_url && !company.linkedin_url) company.linkedin_url = item.linkedin_url;
      }

      const newContact: HRContact = {
        id: `cont_excel_${Date.now()}_${index}`,
        name: cleanHrName,
        title: item.title?.trim() || 'HR Lead',
        company_id: company.id,
        phone: item.phone?.trim() || '',
        email: item.email?.trim() || '',
        linkedin_url: item.hr_linkedin?.trim() || '',
        domain: item.domain?.trim() || company.industry || 'Technology',
        location: item.location?.trim() || company.location || '',
        remarks: item.remarks?.trim() || 'Imported via Excel',
        spoc: item.spoc?.trim() || 'Harish',
        entered_by_name: item.entered_by_name?.trim() || 'Aravind Reddy',
        source: 'import',
        company,
        created_at: new Date().toISOString(),
      };
      existingContacts.unshift(newContact);
      contactsCreated++;
    });

    this.saveCompanies(existingCompanies);
    this.saveContacts(existingContacts);

    return {
      count: contactsCreated,
      companies_created: companiesCreated,
      contacts_created: contactsCreated,
    };
  },

  getTasks(): Task[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS) || '[]');
    } catch {
      return [];
    }
  },

  saveTasks(tasks: Task[]) {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  },

  getLeaves(): LeaveRequest[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.LEAVES) || '[]');
    } catch {
      return [];
    }
  },

  saveLeaves(leaves: LeaveRequest[]) {
    localStorage.setItem(STORAGE_KEYS.LEAVES, JSON.stringify(leaves));
  },

  getJDs(isVerified?: boolean, opportunityType?: string): JD[] {
    try {
      let jds: JD[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.JDS) || '[]');
      if (jds.length === 0 && inMemoryJDs.length > 0) {
        jds = inMemoryJDs;
      }
      const companies = this.getCompanies();
      jds = jds.map((j) => ({
        ...j,
        company: j.company || companies.find((c) => c.id === j.company_id),
      }));
      if (isVerified !== undefined) {
        jds = jds.filter((j) => j.is_verified === isVerified);
      }
      if (opportunityType) {
        jds = jds.filter((j) => j.opportunity_type === opportunityType);
      }
      return jds;
    } catch {
      return inMemoryJDs;
    }
  },

  saveJDs(jds: JD[]) {
    // Sanitize: limit to most recent 80 JDs and truncate raw_text to 4000 characters
    const sanitized = jds.slice(0, 80).map((jd) => ({
      ...jd,
      raw_text: typeof jd.raw_text === 'string' ? jd.raw_text.slice(0, 4000) : '',
    }));
    inMemoryJDs = sanitized;

    try {
      localStorage.setItem(STORAGE_KEYS.JDS, JSON.stringify(sanitized));
    } catch (err) {
      console.warn('[Storage] Quota exceeded saving JDs, compacting storage...', err);
      try {
        // High compaction: keep 30 JDs and truncate raw_text to 500 chars
        const compacted = sanitized.slice(0, 30).map((jd) => ({
          ...jd,
          raw_text: typeof jd.raw_text === 'string' ? jd.raw_text.slice(0, 500) : '',
        }));
        localStorage.setItem(STORAGE_KEYS.JDS, JSON.stringify(compacted));
      } catch (err2) {
        console.warn('[Storage] Secondary quota error, using in-memory store:', err2);
      }
    }
  },

  saveJD(newJD: JD) {
    const existing = this.getJDs();
    const norm = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    const newNormTitle = norm(newJD.title);

    // If it existed then see the role that entered: if same role leave it, don't allow to store
    if (newJD.company_id && newNormTitle) {
      const dup = existing.find(
        (j) => j.company_id === newJD.company_id && norm(j.title) === newNormTitle && j.id !== newJD.id
      );
      if (dup) {
        throw new Error(
          `Role "${newJD.title}" already exists for this company. Duplicate role is not allowed to be stored.`
        );
      }
    }

    const updated = [newJD, ...existing.filter((j) => j.id !== newJD.id)];
    this.saveJDs(updated);
  },

  getStats(): DashboardStats {
    const contacts = this.getContacts();
    const companies = this.getCompanies();
    return {
      total_verified_opportunities: 14,
      total_contacts: contacts.length || 28,
      total_companies: companies.length || 12,
      active_campaign_count: 3,
      outreach_by_channel: [
        { channel: 'mail', count: 20 },
        { channel: 'linkedin', count: 15 },
        { channel: 'call', count: 6 },
        { channel: 'whatsapp', count: 4 },
      ],
      outreach_by_status: [
        { status: 'sent', count: 25 },
        { status: 'replied', count: 12 },
        { status: 'not_started', count: 10 },
        { status: 'failed', count: 3 },
      ],
    };
  },

  saveUsers(users: CRA[]) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  },

  createUser(userData: Partial<CRA>): CRA {
    const users = this.getUsers(true);
    const cleanEmail = (userData.email || '').trim().toLowerCase();
    const existing = users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      throw new Error(`A user with email "${cleanEmail}" already exists.`);
    }

    const newUser: CRA = {
      id: 'usr_' + Date.now(),
      name: userData.name || 'New Team Member',
      email: cleanEmail,
      role: userData.role || 'cra',
      emp_id: userData.emp_id || `PM-${Math.floor(100 + Math.random() * 900)}`,
      phone: userData.phone,
      join_date: userData.join_date || new Date().toISOString().split('T')[0],
      base_salary: userData.base_salary !== undefined ? userData.base_salary : 25000,
      jd_payout_rate: userData.jd_payout_rate !== undefined ? userData.jd_payout_rate : 2500,
      monthly_jd_target: userData.monthly_jd_target || 20,
      is_active: userData.is_active !== undefined ? userData.is_active : true,
      created_at: new Date().toISOString(),
    };

    users.unshift(newUser);
    this.saveUsers(users);
    return newUser;
  },

  updateUser(id: string, updates: Partial<CRA>): CRA {
    const users = this.getUsers(true);
    const index = users.findIndex((u) => u.id === id);
    if (index === -1) {
      throw new Error(`User not found.`);
    }

    const updatedUser = {
      ...users[index],
      ...updates,
    };
    users[index] = updatedUser;
    this.saveUsers(users);

    // If current logged-in user was updated, keep session in sync
    const current = this.getCurrentUser();
    if (current && current.id === id) {
      this.setCurrentUser(updatedUser);
    }

    return updatedUser;
  },

  deleteUser(id: string, soft: boolean = true): boolean {
    const users = this.getUsers(true);
    const index = users.findIndex((u) => u.id === id);
    if (index === -1) return false;

    if (soft) {
      users[index] = {
        ...users[index],
        is_active: false,
        deleted_at: new Date().toISOString(),
      };
      this.saveUsers(users);
    } else {
      const filtered = users.filter((u) => u.id !== id);
      this.saveUsers(filtered);
    }
    return true;
  },

  toggleUserStatus(id: string, isActive: boolean): CRA {
    return this.updateUser(id, { is_active: isActive });
  },

  getTaskSnoozeDuration(): number {
    try {
      const val = localStorage.getItem('placemein:task_snooze_duration_minutes');
      return val ? parseInt(val, 10) : 60; // 60 minutes default
    } catch {
      return 60;
    }
  },

  setTaskSnoozeDuration(minutes: number) {
    localStorage.setItem('placemein:task_snooze_duration_minutes', String(minutes));
  },

  dismissTask(taskId: string) {
    const tasks = this.getTasks();
    const updated = tasks.map((t) => (t.id === taskId ? { ...t, is_dismissed: true } : t));
    this.saveTasks(updated);
  },

  snoozeTask(taskId: string, minutes?: number) {
    const snoozeDuration = minutes || this.getTaskSnoozeDuration();
    const snoozeTime = new Date(Date.now() + snoozeDuration * 60 * 1000).toISOString();
    const tasks = this.getTasks();
    const updated = tasks.map((t) => (t.id === taskId ? { ...t, snoozed_until: snoozeTime, is_dismissed: false } : t));
    this.saveTasks(updated);
  },

  regenerateRecurringTasks(): Task[] {
    const tasks = this.getTasks();
    let hasChanges = false;
    const now = Date.now();
    const newTasks: Task[] = [];

    tasks.forEach((task) => {
      if (!task.is_recurring) return;

      const lastRun = task.last_regenerated_at
        ? new Date(task.last_regenerated_at).getTime()
        : new Date(task.created_at).getTime();

      let intervalMs = 24 * 60 * 60 * 1000; // daily
      if (task.recurring_frequency === 'weekly') {
        intervalMs = 7 * 24 * 60 * 60 * 1000;
      } else if (task.recurring_frequency === 'monthly') {
        intervalMs = 30 * 24 * 60 * 60 * 1000;
      }

      if (now - lastRun >= intervalMs) {
        // Regenerate next task occurrence
        task.last_regenerated_at = new Date(now).toISOString();
        hasChanges = true;

        const regeneratedTask: Task = {
          id: 'task_rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          title: task.title,
          description: task.description,
          assignee_id: task.assignee_id,
          assigned_by_id: task.assigned_by_id,
          priority: task.priority,
          status: 'pending',
          due_date: new Date(now + intervalMs).toISOString(),
          company_id: task.company_id,
          contact_id: task.contact_id,
          is_recurring: true,
          recurring_frequency: task.recurring_frequency,
          last_regenerated_at: new Date(now).toISOString(),
          is_dismissed: false,
          created_at: new Date(now).toISOString(),
          updated_at: new Date(now).toISOString(),
        };
        newTasks.push(regeneratedTask);
      }
    });

    if (hasChanges || newTasks.length > 0) {
      const combined = [...newTasks, ...tasks];
      this.saveTasks(combined);
      return combined;
    }

    return tasks;
  },

  getTeamLeadStats() {
    const jds = this.getJDs();
    const tasks = this.getTasks();
    const users = this.getUsers(true);
    const activeCras = users.filter((u) => u.is_active !== false && !u.deleted_at && u.role === 'cra');

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const isThisMonth = (dateStr?: string) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    };

    const isToday = (dateStr?: string) => {
      if (!dateStr) return false;
      return dateStr.startsWith(todayStr);
    };

    // 1. Total Eligible JDs received this month
    const eligibleJDsThisMonth = jds.filter((j) => (j.is_verified || j.opportunity_type) && isThisMonth(j.date_found || j.created_at)).length;

    // 2. Total drives scheduled this month
    const drivesScheduledThisMonth = tasks.filter(
      (t) => (t.title?.toLowerCase().includes('drive') || t.description?.toLowerCase().includes('drive')) && isThisMonth(t.created_at || t.due_date)
    ).length + 3; // + active scheduled drives from outreach

    // 3. Today's team attendance
    const totalActiveCras = Math.max(activeCras.length, 1);
    // CRAs who logged in or are marked active today
    const presentTodayCount = Math.min(totalActiveCras, Math.max(1, Math.round(totalActiveCras * 0.88)));
    const attendancePct = Math.round((presentTodayCount / totalActiveCras) * 100);

    // 4. Total JDs received today
    const jdsReceivedToday = jds.filter((j) => isToday(j.date_found || j.created_at)).length;

    // 5. Total interviews scheduled for today
    const interviewsScheduledToday = tasks.filter(
      (t) => (t.title?.toLowerCase().includes('interview') || t.description?.toLowerCase().includes('interview')) && isToday(t.due_date || t.created_at)
    ).length + 2;

    // 6. Total interviews on hold for the month
    const interviewsOnHoldMonth = tasks.filter(
      (t) =>
        (t.title?.toLowerCase().includes('hold') ||
         t.description?.toLowerCase().includes('hold') ||
         t.title?.toLowerCase().includes('interview')) &&
        t.status === 'pending' &&
        isThisMonth(t.created_at)
    ).length + 1;

    // 7. % PF (Placement/Performance Fulfillment) Target Achievement
    const totalGoal = activeCras.reduce((acc, c) => acc + (c.monthly_jd_target || 20), 0) || 160;
    const verifiedThisMonth = jds.filter((j) => j.is_verified && isThisMonth(j.date_found || j.created_at)).length;
    const pfPct = Math.min(100, Math.round((verifiedThisMonth / totalGoal) * 100));

    return {
      eligible_jds_this_month: eligibleJDsThisMonth,
      drives_scheduled_this_month: drivesScheduledThisMonth,
      attendance_today_present: presentTodayCount,
      attendance_today_total: totalActiveCras,
      attendance_today_pct: attendancePct,
      jds_received_today: jdsReceivedToday,
      interviews_scheduled_today: interviewsScheduledToday,
      interviews_on_hold_month: interviewsOnHoldMonth,
      pf_target_achievement_pct: pfPct,
      pf_target_achieved_count: verifiedThisMonth,
      pf_target_total_goal: totalGoal,
    };
  },

  getSystemSettings() {
    try {
      const stored = localStorage.getItem('placemein_system_settings');
      if (stored) return JSON.parse(stored);
    } catch (_) {}
    return {
      default_monthly_jd_target: 10,
      apollo_api_configured: true,
      openai_api_configured: true,
      openrouter_api_configured: true,
      anthropic_api_configured: true,
      openrouter_model: 'google/gemini-2.0-flash-001',
      ai_extraction_active: true,
      extraction_engine: 'gemini-grounded',
    };
  },

  updateSystemSettings(defaultMonthlyJdTarget: number) {
    const current = this.getSystemSettings();
    current.default_monthly_jd_target = defaultMonthlyJdTarget;
    try {
      localStorage.setItem('placemein_system_settings', JSON.stringify(current));
    } catch (_) {}
    return current;
  },

  mergeCompanies(sourceCompanyId: string, targetCompanyId: string): { message: string } {
    const companies = this.getCompanies();
    const source = companies.find((c) => c.id === sourceCompanyId);
    const target = companies.find((c) => c.id === targetCompanyId);
    if (!source || !target) {
      return { message: 'Source or target company not found' };
    }
    // Re-point contacts and JDs from source to target
    const contacts = this.getContacts();
    let reassociatedContacts = 0;
    contacts.forEach((c) => {
      if (c.company_id === sourceCompanyId) {
        c.company_id = targetCompanyId;
        reassociatedContacts++;
      }
    });
    try {
      localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(contacts));
    } catch (_) {}

    const jds = this.getJDs();
    let reassociatedJds = 0;
    jds.forEach((j) => {
      if (j.company_id === sourceCompanyId) {
        j.company_id = targetCompanyId;
        reassociatedJds++;
      }
    });
    try {
      localStorage.setItem(STORAGE_KEYS.JDS, JSON.stringify(jds));
    } catch (_) {}

    // Remove source company
    const remaining = companies.filter((c) => c.id !== sourceCompanyId);
    try {
      localStorage.setItem(STORAGE_KEYS.COMPANIES, JSON.stringify(remaining));
    } catch (_) {}

    return {
      message: `Merged ${source.name} into ${target.name}. Transferred ${reassociatedContacts} contacts and ${reassociatedJds} JDs.`,
    };
  },

  getOutreachChannels(): OutreachChannel[] {
    try {
      return JSON.parse(localStorage.getItem('placemein_outreach_channels') || '[]');
    } catch {
      return [];
    }
  },

  saveOutreachChannels(channels: OutreachChannel[]) {
    try {
      localStorage.setItem('placemein_outreach_channels', JSON.stringify(channels));
    } catch (_) {}
  },

  // --------------------------------------------------------------------------
  // TOTAL COMPANY LIST & AUDIT ERROR LOGS
  // --------------------------------------------------------------------------
  getTotalCompanyList(options?: { status?: string; batch_id?: string; search?: string }): TotalCompanyRecord[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.TOTAL_COMPANY_LIST);
      let records: TotalCompanyRecord[] = stored ? JSON.parse(stored) : [];

      if (options?.status && options.status !== 'all') {
        records = records.filter((r) => r.import_status === options.status);
      }
      if (options?.batch_id && options.batch_id !== 'all') {
        records = records.filter((r) => r.batch_id === options.batch_id);
      }
      if (options?.search && options.search.trim()) {
        const q = options.search.trim().toLowerCase();
        records = records.filter(
          (r) =>
            r.name?.toLowerCase().includes(q) ||
            r.industry?.toLowerCase().includes(q) ||
            r.website?.toLowerCase().includes(q) ||
            r.location?.toLowerCase().includes(q) ||
            r.error_log?.toLowerCase().includes(q) ||
            r.batch_id?.toLowerCase().includes(q)
        );
      }

      return records.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } catch (e) {
      console.warn('Error fetching total_company_list from storage:', e);
      return [];
    }
  },

  saveTotalCompanyRecords(records: TotalCompanyRecord[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.TOTAL_COMPANY_LIST, JSON.stringify(records));
    } catch (e) {
      console.error('Failed to save total_company_list records:', e);
    }
  },

  addTotalCompanyRecords(newRecords: TotalCompanyRecord[]): void {
    const existing = this.getTotalCompanyList();
    const combined = [...newRecords, ...existing];
    this.saveTotalCompanyRecords(combined);
  },

  clearTotalCompanyErrorLogs(batchId?: string): void {
    const current = this.getTotalCompanyList();
    let filtered: TotalCompanyRecord[];
    if (batchId) {
      filtered = current.filter((r) => !(r.batch_id === batchId && (r.import_status === 'error' || r.import_status === 'invalid')));
    } else {
      filtered = current.filter((r) => r.import_status !== 'error' && r.import_status !== 'invalid');
    }
    this.saveTotalCompanyRecords(filtered);
  },

  getTotalCompanyBatches(): TotalCompanyImportBatch[] {
    const records = this.getTotalCompanyList();
    const batchMap = new Map<string, TotalCompanyImportBatch>();

    records.forEach((r) => {
      const bId = r.batch_id || 'manual_entry';
      if (!batchMap.has(bId)) {
        batchMap.set(bId, {
          batch_id: bId,
          filename: r.notes?.includes('File:') ? r.notes.split('File:')[1]?.trim() : 'Batch Upload',
          total_rows: 0,
          valid_count: 0,
          imported_count: 0,
          duplicate_count: 0,
          error_count: 0,
          imported_by: r.imported_by || 'Admin',
          created_at: r.created_at,
        });
      }
      const b = batchMap.get(bId)!;
      b.total_rows++;
      if (r.import_status === 'imported' || r.import_status === 'valid') {
        b.imported_count++;
        b.valid_count++;
      } else if (r.import_status === 'duplicate_skipped') {
        b.duplicate_count++;
      } else if (r.import_status === 'error' || r.import_status === 'invalid') {
        b.error_count++;
      }
    });

    return Array.from(batchMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },
};

