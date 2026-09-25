export interface EmployeeCredential {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'cra';
  isDualRole?: boolean; // Can act as both CRA employee and Admin!
  empId: string;
  designation: string;
  spocDomain: string;
  avatarBg: string;
  passwordDefault: string;
  notes?: string;
}

export const DEFAULT_EMPLOYEE_PASSWORD = 'Password123!';

export const ALL_EMPLOYEE_CREDENTIALS: EmployeeCredential[] = [
  // --- CRA SPECIALISTS (RECRUITMENT & OUTREACH EMPLOYEES) ---
  {
    id: 'usr_cra_harish',
    name: 'Harish Reddy',
    email: 'harish.r@placemein.com',
    role: 'cra',
    empId: 'PM-101',
    designation: 'CRA Specialist',
    spocDomain: 'Cyber Security & IT Services',
    avatarBg: 'bg-purple-600',
    passwordDefault: DEFAULT_EMPLOYEE_PASSWORD,
    notes: 'Handles major IT & Cyber security corporate leads'
  },
  {
    id: 'usr_cra_namitha',
    name: 'Namitha K',
    email: 'namitha.k@placemein.com',
    role: 'cra',
    empId: 'PM-102',
    designation: 'CRA Specialist',
    spocDomain: 'Cyber Security & AI Enterprise Leads',
    avatarBg: 'bg-emerald-600',
    passwordDefault: DEFAULT_EMPLOYEE_PASSWORD,
    notes: 'Primary SPOC for Cyber Security enterprise leads'
  },
  {
    id: 'usr_cra_charan',
    name: 'Charan Kumar',
    email: 'charankumar.n@placemein.com',
    role: 'admin',
    isDualRole: true,
    empId: 'PM-103',
    designation: 'CRA Specialist & Admin Associate (Emp + Admin)',
    spocDomain: 'Gen AI & Recruitment Automation',
    avatarBg: 'bg-teal-600',
    passwordDefault: DEFAULT_EMPLOYEE_PASSWORD,
    notes: 'Dual role: Employee + Admin with full CRA sourcing and approval capabilities'
  },
  {
    id: 'usr_cra_mrudula',
    name: 'Mrudula',
    email: 'mrudula.k@placemein.com',
    role: 'cra',
    empId: 'PM-104',
    designation: 'CRA Specialist',
    spocDomain: 'Cloud Infrastructure & Enterprise Sourcing',
    avatarBg: 'bg-pink-600',
    passwordDefault: DEFAULT_EMPLOYEE_PASSWORD,
    notes: 'SPOC for Cloud Infrastructure & IT recruitment sourcing'
  },
  {
    id: 'usr_cra_solomon',
    name: 'Solomon Raj',
    email: 'solomon.r@placemein.com',
    role: 'cra',
    empId: 'PM-105',
    designation: 'CRA Specialist',
    spocDomain: 'Cloud & Cyber Security Tech',
    avatarBg: 'bg-blue-600',
    passwordDefault: DEFAULT_EMPLOYEE_PASSWORD,
    notes: 'SPOC for Cloud Security & IT sourcing'
  },
  {
    id: 'usr_admin_aravind',
    name: 'Aravind Reddy',
    email: 'aravindaravind3953@gmail.com',
    role: 'admin',
    isDualRole: true,
    empId: 'PM-CEO',
    designation: 'Founder & CEO (Emp + Admin)',
    spocDomain: 'Executive Strategy & Corporate Outreach',
    avatarBg: 'bg-amber-600',
    passwordDefault: DEFAULT_EMPLOYEE_PASSWORD,
    notes: 'Root Admin with dual role: CRA Specialist outreach and executive leadership'
  },

  // --- LEADERSHIP & ADMINS (MANAGER & TEAM LEAD) ---
  {
    id: 'usr_admin_vineela',
    name: 'Vineela Bathula',
    email: 'vineela.b@placemein.com',
    role: 'admin',
    empId: 'PM-004',
    designation: 'Manager & Talent Partner',
    spocDomain: 'Corporate Relations, Operations & HR Management',
    avatarBg: 'bg-indigo-700',
    passwordDefault: DEFAULT_EMPLOYEE_PASSWORD,
    notes: 'Managerial and administrative rights for employee rosters & leave management'
  },
  {
    id: 'usr_admin_mansi',
    name: 'Mansi Ramesh Peddi',
    email: 'mansi.p@placemein.com',
    role: 'admin',
    empId: 'PM-003',
    designation: 'CRA Team Lead & Verification Head',
    spocDomain: 'Lead Verification, JDs Governance & Approvals',
    avatarBg: 'bg-purple-700',
    passwordDefault: DEFAULT_EMPLOYEE_PASSWORD,
    notes: 'Team Lead and admin rights for verifying company leads, JDs and team performance'
  },

  // --- SUPPORTED EMAIL ALIASES FOR SEAMLESS ACCESS ---
  {
    id: 'usr_cra_harish_alt',
    name: 'Harish Reddy',
    email: 'harish.m@placemein.com',
    role: 'cra',
    empId: 'PM-101-ALT',
    designation: 'CRA Specialist (Alias)',
    spocDomain: 'Cyber Security & IT Services',
    avatarBg: 'bg-purple-600',
    passwordDefault: DEFAULT_EMPLOYEE_PASSWORD,
    notes: 'Alternative email alias for Harish Reddy'
  },
  {
    id: 'usr_cra_namitha_alt',
    name: 'Namitha S',
    email: 'namitha.s@placemein.com',
    role: 'cra',
    empId: 'PM-102-ALT',
    designation: 'CRA Specialist (Alias)',
    spocDomain: 'Cyber Security & AI',
    avatarBg: 'bg-emerald-600',
    passwordDefault: DEFAULT_EMPLOYEE_PASSWORD,
    notes: 'Alternative email alias for Namitha'
  },
  {
    id: 'usr_cra_mrudula_alt',
    name: 'Mrudula',
    email: 'mrudula@placemein.com',
    role: 'cra',
    empId: 'PM-104-ALT',
    designation: 'CRA Specialist (Alias)',
    spocDomain: 'Cloud Infrastructure & Enterprise Sourcing',
    avatarBg: 'bg-pink-600',
    passwordDefault: DEFAULT_EMPLOYEE_PASSWORD,
    notes: 'Alternative email alias for Mrudula'
  },
  {
    id: 'usr_admin_aravind_corp',
    name: 'Aravind Reddy',
    email: 'aravindreddy.l@placemein.com',
    role: 'admin',
    isDualRole: true,
    empId: 'PM-001',
    designation: 'Founder & CEO (Corporate Email)',
    spocDomain: 'Executive Leadership & Overall Strategy',
    avatarBg: 'bg-amber-600',
    passwordDefault: DEFAULT_EMPLOYEE_PASSWORD,
    notes: 'Corporate email alias for Aravind Reddy'
  }
];

export function getFormattedCredentialsText(): string {
  let output = '=== PLACEMEIN EMPLOYEE & LEADERSHIP LOGIN CREDENTIALS ===\n';
  output += `Universal Default Password: ${DEFAULT_EMPLOYEE_PASSWORD}\n\n`;

  output += '--- CRA SPECIALISTS (EMPLOYEES & DUAL-ROLE LEADS) ---\n';
  ALL_EMPLOYEE_CREDENTIALS.filter(e => e.role === 'cra' || e.isDualRole).forEach(e => {
    output += `• ${e.name} (${e.empId}) | Designation: ${e.designation}\n`;
    output += `  Email: ${e.email}\n`;
    output += `  Password: ${e.passwordDefault}\n`;
    output += `  Domain: ${e.spocDomain}\n\n`;
  });

  output += '--- LEADERSHIP & ADMINS (MANAGER & TEAM LEAD) ---\n';
  ALL_EMPLOYEE_CREDENTIALS.filter(e => e.role === 'admin').forEach(e => {
    output += `• ${e.name} (${e.empId}) | Designation: ${e.designation}\n`;
    output += `  Email: ${e.email}\n`;
    output += `  Password: ${e.passwordDefault}\n`;
    output += `  Domain: ${e.spocDomain}\n\n`;
  });

  return output;
}
