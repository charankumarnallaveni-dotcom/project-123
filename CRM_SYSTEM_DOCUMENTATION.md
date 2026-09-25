# Placemein CRM — System Architecture & Feature Documentation

> **Product Name:** Placemein CRM — Recruitment Automation & CRA Sourcing CRM  
> **Deployment Target:** placemein-crm.in (Vercel) / Node.js Express & Vite SPA  
> **Backend Architecture:** Supabase PostgreSQL + Server API Router + Resilient Offline Client Fallback Store  
> **Target Audience:** Internal Corporate Relations Associate (CRA) Team & Leadership  

---

## 1. Executive Summary & Core Platform Overview

Placemein CRM is an internal-only recruitment outreach and pipeline automation platform purpose-built for Placemein's Corporate Relations Associate (CRA) team. The system streamlines end-to-end recruitment partnerships: discovering corporate job postings, extracting HR/recruiter contact coordinates, managing outreach campaigns across email and phone, tracking candidate placements, and calculating performance-driven CRA incentives based on verified Job Description (JD) purchases and conversions.

The platform provides shared team visibility so all CRAs collaborate on a unified dataset without artificial silos, while strictly segregating administrative leadership functions through role-based access control.

---

## 2. Dual Portal Architecture & Role-Based Access Control (RBAC)

The application provides two specialized, dedicated operating modes:

### 2.1 CRA Employee Portal (Day-to-Day Operations)
- **Target Role:** Corporate Relations Associates (`role: 'cra'`)
- **Key Modules:**
  - **Employee Dashboard:** High-level daily activity metrics, outreach call/mail targets, upcoming reminders, and recent company interactions.
  - **HR Sourcing & Lead Discovery:** Direct job posting search, automated HR contact extraction, manual search fallbacks, and quick intake.
  - **JD Intake & Verification:** Capture incoming Job Descriptions from clients, parse requirements, associate with companies, and submit for verification.
  - **Shared CRM Contacts Directory:** Complete list of all corporate HR contacts, outreach statuses (Contacted, Replied, Interested, JD Received, Converted), and interaction history.
  - **Multi-Channel Outreach Tracker:** Track email and call sequences, log responses, schedule follow-ups, and log outcomes.
  - **Team Lead Shared Sheets:** Collaborative Google Sheets-style spreadsheet view organized by SPOC or aggregated across the team.
  - **Task & Reminder Management:** Snoozeable notifications, automated daily call reminders, and overdue follow-up queues.
  - **Performance Tracker:** Individual target achievements, daily calling logs, and placement pipeline tracking.

### 2.2 Admin Leadership Portal (Executive Oversight & Governance)
- **Target Role:** Leadership / Administrators (`role: 'admin'`)
- **Access Gate:** Protected by credential authentication (`AdminLoginModal.tsx` and secure server token validation).
- **Exclusive Admin Modules:**
  - **Master CRM Explorer (Full Data Visibility):** Complete superset view of all contacts, companies, JDs, campaigns, and CRA activity without "assigned to me" filters.
  - **Salary & Incentive Engine:** Automated compensation calculation based on converted/purchased JDs with configurable per-JD payout rates and periodic payout approval workflows.
  - **Employee Management:** Full CRUD control panel over CRA personnel: add employees, edit credentials/compensation rates, toggle active/inactive status.
  - **Company Directory Governance:** Exclusive authority to edit company profiles, resolve duplicates, and merge duplicate organizational accounts.

### 2.3 Access & Permission Matrix

| Feature / Operation | CRA Employee Role | Admin Leadership Role | Enforcement Point |
|---|---|---|---|
| **View Leads & Contacts** | Full Read (Shared) | Full Read (Unrestricted) | UI & API |
| **Add Single Contact / Lead** | Permitted | Permitted | `api.createContact` |
| **Import Leads (HTML)** | Permitted | Permitted | `HTMLLeadsImportModal.tsx` |
| **View Total Company Directory** | Full Read | Full Read | UI & API |
| **Create New Company** | Permitted | Permitted | `api.createCompany` |
| **Edit Existing Company Details** | **Strictly Forbidden** | **Permitted** | UI (`canEditCompany`) + API (`api.updateCompany`) + Server (`PUT /companies/:id` 403 Forbidden) |
| **Bulk Import Companies** | Restricted / Admin-Only | **Permitted** | `BulkCompanyImportModal.tsx` |
| **Merge Duplicate Companies** | Restricted / Admin-Only | **Permitted** | `AdminPortalPage.tsx` |
| **CRA Salary & Payout Calculation** | Hidden / Inaccessible | **Permitted** | `AdminSalaryPage.tsx` |
| **Employee CRUD & Rates Management** | Hidden / Inaccessible | **Permitted** | `AdminPortalPage.tsx` (Users tab) |
| **JD Intake & Sourcing** | Permitted | Permitted | `JDIntakePage.tsx` |
| **JD Conversion / Purchase Approval** | View status | **Full Control** | `AdminSalaryPage.tsx` & `AdminPortalPage.tsx` |

---

## 3. Dual Import Pipeline Architecture

To prevent data ambiguity and cross-contamination between individual prospective leads and master organizational profiles, the platform implements **two completely separate and independent import pipelines**:

```
                                  IMPORT PIPELINES
                                         │
        ┌────────────────────────────────┴────────────────────────────────┐
        ▼                                                                 ▼
[1] HTML LEADS IMPORT PIPELINE                               [2] BULK COMPANY IMPORT PIPELINE
    Component: HTMLLeadsImportModal.tsx                          Component: BulkCompanyImportModal.tsx
    Input: Scraped/pasted web HTML                               Input: CSV, Excel (.xlsx, .xls), or Delimited text
    Entity: HRContact (recruiter/lead records)                   Entity: Company (master organization directory)
    Destination: 'hr_contacts' table in Supabase                 Destination: 'companies' master directory
    Validation: Name, Email, Phone, Title                        Validation: Required company_name, domain normalization
    Duplicate Handling: Matched against existing contacts        Duplicate Handling: Case-insensitive name & domain match
    Permissions: CRA & Admin                                     Permissions: Admin Leadership
```

### 3.1 Pipeline 1: HTML Leads Importer (`HTMLLeadsImportModal.tsx`)
- **Strict Scope:** Extracts individual prospective recruiter and candidate contact records (`HRContact`) from scraped or pasted HTML markup (LinkedIn Recruiter profiles, job boards, talent pools).
- **Hard Restriction:** This pipeline **never** writes to the master `companies` table. Extracted leads are linked to an existing company from the company directory or designated default account.
- **Parsing Mechanics:**
  - Employs client-side DOM parser to extract structural entity lockups (`.artdeco-entity-lockup`, `tr`, `li`, `div[class*="result"]`).
  - Regex-driven extraction for email addresses, 10-digit Indian phone numbers (`+91`), and LinkedIn member profiles (`/in/*`).
  - Pre-import preview table allowing editing of names, designations, emails, phone numbers, and company linkage.
  - Multi-select controls with selective commit into the CRM contacts repository.

### 3.2 Pipeline 2: Bulk Company List Importer (`BulkCompanyImportModal.tsx`)
- **Strict Scope:** Bulk loads multi-row corporate organizational records into the master **"Total Company List"**.
- **File Format Support:** `.xlsx`, `.xls`, `.csv`, or pasted comma/tab-delimited raw text.
- **Data Validation & Resiliency:**
  - **Required Fields:** Company Name (must be at least 2 characters).
  - **Optional Fields:** Industry, Website URL, LinkedIn Company URL, Headcount / Employee Size, Location / HQ City, Strategic Notes.
  - **Tolerant Headers:** Automatically handles header aliases (e.g., `company_name`, `Company`, `organization`, `headcount`, `size`, `url`).
  - **Per-Row Error Isolation:** A formatting failure on one row reports a specific error badge for that row without failing the entire batch.
  - **Duplicate Detection:** Checks candidate company names and normalized root domains against both the existing database and repeated entries in the same file. Duplicate rows are highlighted in amber and defaulted to deselected so existing records remain uncorrupted.
  - **Sample Download:** Built-in downloadable CSV template with pre-formatted column headers.

---

## 4. Company Record Edit Restriction (Strict Admin-Only)

Editing company master records is strictly limited to users with the `admin` role. CRAs can associate contacts with existing companies and register new companies during lead intake, but cannot modify existing company profiles once established.

### 4.1 UI-Level Enforcement
In `CompanyDetailsModal.tsx`:
```typescript
const canEditCompany = currentUser?.role === 'admin';
```
- Non-admin users see readonly details without inline edit inputs.
- Edit trigger buttons, inputs, and save actions are withheld from CRA users.

### 4.2 Client Service Enforcement
In `src/services/api.ts`:
```typescript
async updateCompany(id: string, updates: Partial<Company>): Promise<Company> {
  const current = clientFallbackStore.getCurrentUser();
  if (current && current.role !== 'admin') {
    throw new Error('Forbidden: Only Admin leadership can edit existing company records.');
  }
  // Proceed to update Supabase or server proxy...
}
```

### 4.3 Backend Server Route Enforcement
In `server/routes/index.ts`:
```typescript
apiRouter.put('/companies/:id', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ detail: 'Authentication required' });
  const isAdmin = checkAdminAuthorization(authHeader);
  if (!isAdmin) {
    return res.status(403).json({
      detail: 'Forbidden: Only Admin leadership accounts can edit company records.',
    });
  }
  // Proceed with update...
});
```

---

## 5. CRA Salary & Incentive Calculation Engine

The platform includes an automated salary and incentive calculation module (`AdminSalaryPage.tsx`) accessible exclusively in the Admin Leadership Portal.

### 5.1 Business Logic & Calculation Formula
Each CRA receives a compensation package comprising:
1. **Base Monthly Salary:** Defined per employee (default ₹25,000/month).
2. **JD Conversion Incentive:** A payout earned for each client engagement or Job Description sourced by the CRA that transitions into a confirmed **"Converted"** or **"Purchased"** drive.
3. **Discretionary Bonus:** Admin-adjustable monthly performance bonus.

$$\text{Total Monthly Payout} = \text{Base Salary} + (\text{Converted JDs Count} \times \text{JD Payout Rate}) + \text{Discretionary Bonus}$$

### 5.2 Key Features
- **Configurable Payout Rate:** Admin can configure the global default payout rate (e.g. ₹2,500 per converted JD) or customize specific rates per CRA without hardcoding.
- **Periodic Time-Bound Filtering:** Filter calculations by month (e.g., `2026-09`, `2026-08`) or custom time ranges.
- **Conversion Trigger Identification:** JDs marked with `is_purchased: true` or status `converted` / `purchased` are automatically tallied against the originating CRA.
- **Drill-Down Inspection Modal:** Admins can click on any CRA's record to view the specific JDs attributed to them and toggle conversion status in real time with immediate recalculation.
- **Payout Approval Lifecycle:** Tracks payout statuses per employee: `Draft` $\rightarrow$ `Approved` $\rightarrow$ `Paid`.
- **Export to CSV:** Generates executive payroll summaries with complete financial breakdowns.

---

## 6. Full Data Visibility Module (`AdminFullDataPage.tsx`)

Admins require unfiltered visibility into all operations across the firm:
- **Superset Views:**
  - **Master Contacts Directory:** All recruiter leads across all team SPOCs with real-time filtering by CRA, status, and search terms.
  - **Total Company Directory:** All client organizations with direct links to edit company details and trigger bulk imports.
  - **Job Descriptions & Requirements:** All incoming roles, salary bands, and verification statuses.
  - **Outreach Logs & Telephony:** All email and phone interactions logged by CRAs with timestamps, call notes, and outcomes.
- **Data Export:** Complete export capability to CSV for analytics and offline reporting.

---

## 7. Employee Management Control Panel (`AdminPortalPage.tsx`)

Admins maintain complete administrative authority over the CRA team:
- **Add Employee:** Create CRA or Admin accounts with initial base salaries, JD conversion rates, monthly targets, phone numbers, and joining dates.
- **Inline Editing:** Update employee compensation parameters, assigned roles, and credentials.
- **Active Status Toggle:** Deactivate departing team members or re-enable existing accounts without corrupting historical lead attribution.

---

## 8. Database Schema & Data Models

### 8.1 Supabase Tables & Schema Definitions

```sql
-- 1. COMPANIES (Master Organization Directory)
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  industry TEXT,
  website TEXT,
  linkedin_url TEXT,
  employee_count TEXT,
  location TEXT,
  notes TEXT,
  entered_by_name TEXT,
  created_by UUID REFERENCES cra_profiles(id),
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. HR_CONTACTS (Individual Recruiter / HR Leads)
CREATE TABLE hr_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  spoc TEXT,
  entered_by_name TEXT,
  source TEXT DEFAULT 'manual',
  opportunity_type TEXT DEFAULT 'existing_post',
  status TEXT DEFAULT 'Not Contacted',
  outreach_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. JDS (Job Descriptions & Client Hiring Drives)
CREATE TABLE jds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  raw_text TEXT,
  is_verified BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active', -- 'active' | 'converted' | 'purchased'
  is_purchased BOOLEAN DEFAULT false,
  purchase_date TIMESTAMPTZ,
  client_notes TEXT,
  created_by UUID REFERENCES cra_profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. CRA_PROFILES (Employee Personnel & Compensation Config)
CREATE TABLE cra_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'cra', -- 'admin' | 'cra'
  emp_id TEXT,
  phone TEXT,
  join_date DATE,
  base_salary NUMERIC DEFAULT 25000,
  jd_payout_rate NUMERIC DEFAULT 2500,
  monthly_jd_target INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 9. Verification & Operational Guidelines

- **Environment Setup:** Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are populated in production. In offline or development sandboxes, the application seamlessly operates via `clientFallbackStore.ts` with complete data persistence in `localStorage`.
- **Port & Runtime:** Built on Vite 5, React 18, Tailwind CSS v4, and Node.js 22 Express server (`PORT 3000`).
- **Production Build:** Verified with `npm run build` with chunk splitting for vendor React, Lucide icons, and Supabase SDK.
