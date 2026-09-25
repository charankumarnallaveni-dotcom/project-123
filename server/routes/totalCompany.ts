import { Router, Request, Response } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { INITIAL_PDF_LEADS } from '../../src/data/pdfLeadsData';

export const totalCompanyRouter = Router();

// Multer memory storage for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
});

// Domain normalization
export function extractRootDomain(url?: string): string {
  if (!url || typeof url !== 'string') return '';
  try {
    const withProto = url.startsWith('http') ? url : `https://${url}`;
    const parsed = new URL(withProto);
    return parsed.hostname.replace(/^www\./, '').toLowerCase().trim();
  } catch {
    return url
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .split('?')[0]
      .trim();
  }
}

// Name normalization to catch company duplicates
export function normalizeCompanyName(name?: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(
      /\b(private\s+limited|pvt\s+ltd|ltd|limited|inc|incorporated|llc|corp|corporation|technologies|solutions|services|group|co|software|enterprises)\b/gi,
      ''
    )
    .replace(/[^a-z0-9]/gi, '')
    .trim();
}

// In-memory existing companies registry for server-side duplicate detection
interface ServerCompanyRecord {
  id: string;
  name: string;
  website?: string;
  industry?: string;
  linkedin_url?: string;
  location?: string;
  employee_count?: string;
  source?: string;
  created_at?: string;
}

// In-memory total_company_list database table
export interface ServerTotalCompanyRecord {
  id: string;
  name: string;
  industry?: string;
  website?: string;
  linkedin_url?: string;
  employee_count?: string;
  location?: string;
  source: string;
  notes?: string;
  import_status: 'imported' | 'valid' | 'duplicate_skipped' | 'error' | 'invalid';
  error_log?: string;
  validation_errors?: string[];
  raw_row_data?: Record<string, any>;
  batch_id?: string;
  row_number?: number;
  imported_by?: string;
  created_at: string;
  updated_at?: string;
}

// Initialize server company database with seed companies and known enterprises
const serverCompanyDatabase: ServerCompanyRecord[] = [
  // Known enterprise anchors
  { id: 'srv_c_1', name: 'Infosys Limited', website: 'https://www.infosys.com', industry: 'Information Technology' },
  { id: 'srv_c_2', name: 'Tata Consultancy Services', website: 'https://www.tcs.com', industry: 'IT & Consulting' },
  { id: 'srv_c_3', name: 'Wipro Limited', website: 'https://www.wipro.com', industry: 'IT Services' },
  { id: 'srv_c_4', name: 'HCL Technologies', website: 'https://www.hcltech.com', industry: 'Technology Services' },
  { id: 'srv_c_5', name: 'Cognizant', website: 'https://www.cognizant.com', industry: 'IT Consulting' },
  { id: 'srv_c_6', name: 'Tech Mahindra', website: 'https://www.techmahindra.com', industry: 'IT Services' },
  { id: 'srv_c_7', name: 'Razorpay Software', website: 'https://razorpay.com', industry: 'FinTech' },
  { id: 'srv_c_8', name: 'Swiggy', website: 'https://swiggy.com', industry: 'FoodTech' },
  { id: 'srv_c_9', name: 'Zomato Limited', website: 'https://zomato.com', industry: 'Food Delivery' },
  { id: 'srv_c_10', name: 'Accenture India', website: 'https://accenture.com', industry: 'Consulting' },
];

// Add unique companies from INITIAL_PDF_LEADS
INITIAL_PDF_LEADS.forEach((lead) => {
  const exists = serverCompanyDatabase.some(
    (c) => c.name.toLowerCase().trim() === lead.company_name.toLowerCase().trim()
  );
  if (!exists && lead.company_name) {
    serverCompanyDatabase.push({
      id: 'srv_' + lead.id,
      name: lead.company_name,
      website: lead.website,
      industry: lead.industry,
      linkedin_url: lead.linkedin_url,
      location: lead.location,
      employee_count: lead.employee_count,
      source: 'seed_pdf_leads',
      created_at: new Date().toISOString(),
    });
  }
});

// In-memory storage for total_company_list audit table
const totalCompanyListStore: ServerTotalCompanyRecord[] = [
  {
    id: 'tcl_seed_1',
    name: 'Adrosonic IT Solutions',
    industry: 'Cyber Security',
    website: 'https://adrosonic.com',
    linkedin_url: 'https://www.linkedin.com/company/adrosonic',
    employee_count: '250-500 employees',
    location: 'Mumbai / Hyderabad',
    source: 'seed_audit',
    notes: 'Initial seed audit entry',
    import_status: 'imported',
    batch_id: 'BATCH_INITIAL_SEED',
    row_number: 1,
    imported_by: 'System Administrator',
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'tcl_seed_2',
    name: 'Infosys Limited',
    industry: 'Information Technology',
    website: 'https://www.infosys.com',
    source: 'seed_audit',
    notes: 'Duplicate detection sample test',
    import_status: 'duplicate_skipped',
    error_log: 'Duplicate detected: Matches existing company record "Infosys Limited"',
    validation_errors: ['Duplicate company'],
    batch_id: 'BATCH_INITIAL_SEED',
    row_number: 2,
    imported_by: 'System Administrator',
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'tcl_seed_3',
    name: '',
    source: 'seed_audit',
    notes: 'Validation failure sample test',
    import_status: 'error',
    error_log: 'Validation failed: Company name is required',
    validation_errors: ['Company name is required', 'Company name must be at least 2 characters'],
    batch_id: 'BATCH_INITIAL_SEED',
    row_number: 3,
    imported_by: 'System Administrator',
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
];

// Helper: Extract column value flexibly from raw row object
function extractColumnValue(row: Record<string, any>, candidateKeys: string[]): string {
  for (const candidate of candidateKeys) {
    for (const key of Object.keys(row)) {
      const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanCandidate = candidate.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanKey === cleanCandidate || cleanKey.includes(cleanCandidate)) {
        const val = row[key];
        if (val !== undefined && val !== null) {
          return String(val).trim();
        }
      }
    }
  }
  return '';
}

// Core Server-Side Validation & Duplicate Detection Engine
export function validateAndDeduplicateServerRows(
  rawRows: Record<string, any>[],
  options: {
    filename?: string;
    enteredByName?: string;
    sourceTag?: string;
    customExistingCompanies?: Array<{ name: string; website?: string }>;
  } = {}
) {
  const {
    filename = 'Uploaded Data',
    enteredByName = 'Admin',
    sourceTag = 'bulk_importer_server',
    customExistingCompanies = [],
  } = options;

  // Build existing lookups combining serverCompanyDatabase + any client-provided companies + previously imported total_company_list
  const existingNameMap = new Map<string, string>();
  const existingNormMap = new Map<string, string>();
  const existingDomainMap = new Map<string, string>();

  // 1. Index serverCompanyDatabase
  serverCompanyDatabase.forEach((c) => {
    if (c.name) {
      existingNameMap.set(c.name.trim().toLowerCase(), c.name);
      const norm = normalizeCompanyName(c.name);
      if (norm) existingNormMap.set(norm, c.name);
    }
    if (c.website) {
      const dom = extractRootDomain(c.website);
      if (dom && dom.includes('.')) existingDomainMap.set(dom, c.name);
    }
  });

  // 2. Index client-provided existing companies
  customExistingCompanies.forEach((c) => {
    if (c.name) {
      existingNameMap.set(c.name.trim().toLowerCase(), c.name);
      const norm = normalizeCompanyName(c.name);
      if (norm) existingNormMap.set(norm, c.name);
    }
    if (c.website) {
      const dom = extractRootDomain(c.website);
      if (dom && dom.includes('.')) existingDomainMap.set(dom, c.name);
    }
  });

  // 3. Index prior successful imports in total_company_list
  totalCompanyListStore.forEach((r) => {
    if (r.name && (r.import_status === 'imported' || r.import_status === 'valid')) {
      existingNameMap.set(r.name.trim().toLowerCase(), r.name);
      const norm = normalizeCompanyName(r.name);
      if (norm) existingNormMap.set(norm, r.name);
      if (r.website) {
        const dom = extractRootDomain(r.website);
        if (dom && dom.includes('.')) existingDomainMap.set(dom, r.name);
      }
    }
  });

  // Track duplicates within this batch (intra-file duplicate detection)
  const seenFileNames = new Map<string, number>();
  const seenFileNormNames = new Map<string, number>();
  const seenFileDomains = new Map<string, number>();

  const results: Array<{
    rowNumber: number;
    name: string;
    industry: string;
    website: string;
    linkedin_url: string;
    employee_count: string;
    location: string;
    notes: string;
    source: string;
    status: 'valid' | 'duplicate' | 'error';
    validationErrors: string[];
    duplicateReason?: string;
    existingMatchedName?: string;
    feedbackMessage: string;
    selected: boolean;
    serverValidationStatus: 'server_validated';
    rawRecord: Record<string, any>;
  }> = [];

  rawRows.forEach((row, idx) => {
    const rowNum = idx + 1;

    const name = extractColumnValue(row, [
      'company_name',
      'company',
      'organization',
      'name',
      'firm',
      'account',
      'client',
    ]);
    const industry = extractColumnValue(row, ['industry', 'sector', 'domain', 'vertical', 'business', 'category']);
    const website = extractColumnValue(row, ['website', 'url', 'web', 'domain', 'site', 'homepage']);
    const linkedin_url = extractColumnValue(row, [
      'linkedin_url',
      'linkedin',
      'company_linkedin',
      'li_url',
      'linkedin_profile',
    ]);
    const employee_count = extractColumnValue(row, [
      'employee_count',
      'headcount',
      'size',
      'employees',
      'strength',
      'staff',
    ]);
    const location = extractColumnValue(row, ['location', 'city', 'headquarters', 'hq', 'state', 'country', 'address']);
    const notes = extractColumnValue(row, ['notes', 'description', 'remarks', 'about', 'comment']);
    const source = extractColumnValue(row, ['source']) || sourceTag;

    const validationErrors: string[] = [];
    let status: 'valid' | 'duplicate' | 'error' = 'valid';
    let duplicateReason: string | undefined = undefined;
    let existingMatchedName: string | undefined = undefined;

    // -------------------------------------------------------------
    // SERVER-SIDE VALIDATION AGAINST REQUIRED FIELDS
    // -------------------------------------------------------------
    // 1. Company Name validation (Required)
    if (!name || name.trim().length === 0) {
      validationErrors.push('Company name is required');
      status = 'error';
    } else if (name.trim().length < 2) {
      validationErrors.push('Company name must be at least 2 characters long');
      status = 'error';
    } else if (/^(n\/a|na|none|unknown|test|untitled|demo|sample|company|null|undefined|-|\.)$/i.test(name.trim())) {
      validationErrors.push(`Invalid placeholder company name detected: "${name}"`);
      status = 'error';
    }

    // 2. Website URL validation (if provided)
    if (website) {
      if (website.includes(' ') || !website.includes('.')) {
        validationErrors.push('Invalid website domain format (must contain a valid domain extension and no spaces)');
        status = 'error';
      } else if (website.length < 4) {
        validationErrors.push('Website URL is too short');
        status = 'error';
      } else if (/^https?:\/\/$/i.test(website.trim())) {
        validationErrors.push('Incomplete website URL protocol without host');
        status = 'error';
      }
    }

    // 3. LinkedIn URL validation (if provided)
    if (linkedin_url) {
      const cleanLi = linkedin_url.toLowerCase();
      if (!cleanLi.includes('linkedin.com/')) {
        validationErrors.push('LinkedIn URL must contain "linkedin.com/"');
        status = 'error';
      }
    }

    // 4. Employee count validation (if provided)
    if (employee_count) {
      if (employee_count.startsWith('-')) {
        validationErrors.push('Employee count cannot be a negative number');
        status = 'error';
      }
    }

    // -------------------------------------------------------------
    // SERVER-SIDE DUPLICATE DETECTION AGAINST COMPANY DATABASE
    // -------------------------------------------------------------
    if (status !== 'error' && name) {
      const lowerName = name.trim().toLowerCase();
      const normName = normalizeCompanyName(name);
      const domain = website ? extractRootDomain(website) : '';

      // A. Database Duplication Checks
      if (existingNameMap.has(lowerName)) {
        status = 'duplicate';
        existingMatchedName = existingNameMap.get(lowerName);
        duplicateReason = `Exact name match with existing company record: "${existingMatchedName}"`;
      } else if (normName && existingNormMap.has(normName)) {
        status = 'duplicate';
        existingMatchedName = existingNormMap.get(normName);
        duplicateReason = `Normalized name match with existing company: "${existingMatchedName}"`;
      } else if (domain && domain.includes('.') && existingDomainMap.has(domain)) {
        status = 'duplicate';
        existingMatchedName = existingDomainMap.get(domain);
        duplicateReason = `Identical website domain (${domain}) registered under "${existingMatchedName}"`;
      }

      // B. Intra-File Duplication Checks
      if (status !== 'duplicate') {
        if (seenFileNames.has(lowerName)) {
          const firstRow = seenFileNames.get(lowerName)!;
          status = 'duplicate';
          duplicateReason = `Intra-file duplicate: exact match with Row #${firstRow} in this batch`;
        } else if (normName && seenFileNormNames.has(normName)) {
          const firstRow = seenFileNormNames.get(normName)!;
          status = 'duplicate';
          duplicateReason = `Intra-file duplicate: similar normalized name to Row #${firstRow} in this batch`;
        } else if (domain && domain.includes('.') && seenFileDomains.has(domain)) {
          const firstRow = seenFileDomains.get(domain)!;
          status = 'duplicate';
          duplicateReason = `Intra-file duplicate: shares website domain (${domain}) with Row #${firstRow}`;
        }
      }

      // Record in seen map
      if (!seenFileNames.has(lowerName)) seenFileNames.set(lowerName, rowNum);
      if (normName && !seenFileNormNames.has(normName)) seenFileNormNames.set(normName, rowNum);
      if (domain && domain.includes('.') && !seenFileDomains.has(domain)) seenFileDomains.set(domain, rowNum);
    }

    // Build concise feedback message
    let feedbackMessage = 'Passed server validation';
    if (status === 'error') {
      feedbackMessage = `Validation failed: ${validationErrors.join('; ')}`;
    } else if (status === 'duplicate') {
      feedbackMessage = duplicateReason || 'Duplicate detected';
    }

    results.push({
      rowNumber: rowNum,
      name: name || '',
      industry,
      website,
      linkedin_url,
      employee_count,
      location,
      notes: notes || `Validated from ${filename}`,
      source,
      status,
      validationErrors,
      duplicateReason,
      existingMatchedName,
      feedbackMessage,
      selected: status === 'valid',
      serverValidationStatus: 'server_validated',
      rawRecord: row,
    });
  });

  return results;
}

// ----------------------------------------------------------------------------
// ENDPOINTS
// ----------------------------------------------------------------------------

/**
 * POST /api/v1/total-companies/validate
 * Accepts CSV/Excel file or raw JSON rows.
 * Performs server-side validation against required fields,
 * checks for duplicates against the company database,
 * and logs row-by-row success/failure feedback.
 */
totalCompanyRouter.post('/validate', upload.single('file') as any, (req: Request, res: Response) => {
  try {
    let rawRows: Record<string, any>[] = [];
    let filename = 'Direct Upload';

    // 1. If file uploaded via multipart
    if (req.file) {
      filename = req.file.originalname || 'uploaded_companies.xlsx';
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        return res.status(400).json({ error: 'Uploaded workbook contains no sheets.' });
      }
      const sheet = workbook.Sheets[firstSheetName];
      rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
    }
    // 2. If raw rows or csv_text sent via JSON body
    else if (req.body.csv_text && typeof req.body.csv_text === 'string') {
      filename = req.body.filename || 'pasted_companies.csv';
      const workbook = XLSX.read(req.body.csv_text, { type: 'string' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        return res.status(400).json({ error: 'Could not parse tabular data from text.' });
      }
      const sheet = workbook.Sheets[firstSheetName];
      rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
    } else if (Array.isArray(req.body.rows)) {
      rawRows = req.body.rows;
      filename = req.body.filename || 'JSON Batch';
    } else {
      return res.status(400).json({
        error: 'No valid input provided. Please upload a file (CSV/Excel) or provide rows array/csv_text.',
      });
    }

    if (rawRows.length === 0) {
      return res.status(400).json({
        error: 'The uploaded file or dataset contains no rows of data.',
      });
    }

    const customExistingCompanies = Array.isArray(req.body.existing_companies) ? req.body.existing_companies : [];
    const enteredByName = req.body.entered_by_name || 'Admin';
    const sourceTag = req.body.source_tag || 'server_bulk_importer';

    // Execute server-side validation & duplicate detection
    const validatedRows = validateAndDeduplicateServerRows(rawRows, {
      filename,
      enteredByName,
      sourceTag,
      customExistingCompanies,
    });

    const validCount = validatedRows.filter((r) => r.status === 'valid').length;
    const duplicateCount = validatedRows.filter((r) => r.status === 'duplicate').length;
    const errorCount = validatedRows.filter((r) => r.status === 'error').length;

    return res.json({
      success: true,
      source: 'server_validation_engine',
      filename,
      total_rows: validatedRows.length,
      valid_count: validCount,
      duplicate_count: duplicateCount,
      error_count: errorCount,
      rows: validatedRows,
      validated_at: new Date().toISOString(),
      validation_summary: {
        message: `Server validated ${validatedRows.length} rows: ${validCount} valid, ${duplicateCount} duplicates, ${errorCount} errors.`,
      },
    });
  } catch (err: any) {
    console.error('[Server TotalCompany] Validation error:', err);
    return res.status(500).json({
      error: 'Failed to process server-side validation.',
      detail: err.message,
    });
  }
});

/**
 * POST /api/v1/total-companies/commit
 * Commits records to the total_company_list table.
 * Logs row-by-row success/failure feedback.
 * Synchronizes valid imported records into active company directory.
 */
totalCompanyRouter.post('/commit', (req: Request, res: Response) => {
  try {
    const { batch_id, records, duplicate_policy = 'skip' } = req.body || {};

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'No records provided for commit.' });
    }

    const batchId = batch_id || `BATCH_${Date.now()}`;
    const commitLogs: Array<{
      row_number: number;
      company_name: string;
      status: string;
      message: string;
      timestamp: string;
    }> = [];

    let importedCount = 0;
    let duplicateSkippedCount = 0;
    let errorLoggedCount = 0;

    const committedRecords: ServerTotalCompanyRecord[] = [];

    records.forEach((r: any, idx: number) => {
      const rowNum = r.row_number || idx + 1;
      const compName = r.name || `(Missing Name Row #${rowNum})`;
      const rawStatus = r.import_status || (r.status === 'valid' ? 'imported' : r.status || 'imported');

      let finalStatus: 'imported' | 'duplicate_skipped' | 'error' = 'imported';
      let logMsg = '';

      if (rawStatus === 'duplicate' || rawStatus === 'duplicate_skipped') {
        if (duplicate_policy === 'allow_update') {
          finalStatus = 'imported';
          logMsg = `Imported (duplicate policy override: ${r.duplicateReason || 'Allowed duplicate'})`;
          importedCount++;
        } else {
          finalStatus = 'duplicate_skipped';
          logMsg = `Duplicate skipped: ${r.duplicateReason || r.error_log || 'Matches existing company'}`;
          duplicateSkippedCount++;
        }
      } else if (rawStatus === 'error' || rawStatus === 'invalid' || (r.validation_errors && r.validation_errors.length > 0)) {
        finalStatus = 'error';
        logMsg = `Validation error logged: ${(r.validation_errors || []).join('; ') || r.error_log || 'Invalid record'}`;
        errorLoggedCount++;
      } else {
        finalStatus = 'imported';
        logMsg = 'Successfully imported to total_company_list and synchronized to CRM company directory';
        importedCount++;
      }

      const totalRecord: ServerTotalCompanyRecord = {
        id: `tcl_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        name: compName,
        industry: r.industry || undefined,
        website: r.website || undefined,
        linkedin_url: r.linkedin_url || undefined,
        employee_count: r.employee_count || undefined,
        location: r.location || undefined,
        source: r.source || 'bulk_import',
        notes: r.notes || `Imported via BulkCompanyImporter | Batch: ${batchId}`,
        import_status: finalStatus,
        error_log: r.error_log || (finalStatus !== 'imported' ? logMsg : undefined),
        validation_errors: r.validation_errors || undefined,
        raw_row_data: r.raw_row_data || r.rawRecord || undefined,
        batch_id: batchId,
        row_number: rowNum,
        imported_by: r.imported_by || 'Admin',
        created_at: new Date().toISOString(),
      };

      totalCompanyListStore.unshift(totalRecord);
      committedRecords.push(totalRecord);

      // If imported, sync to active server company registry
      if (finalStatus === 'imported' && totalRecord.name && !totalRecord.name.startsWith('(Missing Name')) {
        const alreadyInRegistry = serverCompanyDatabase.some(
          (c) => c.name.toLowerCase().trim() === totalRecord.name.toLowerCase().trim()
        );
        if (!alreadyInRegistry) {
          serverCompanyDatabase.push({
            id: 'comp_' + totalRecord.id,
            name: totalRecord.name,
            website: totalRecord.website,
            industry: totalRecord.industry,
            linkedin_url: totalRecord.linkedin_url,
            location: totalRecord.location,
            employee_count: totalRecord.employee_count,
            source: totalRecord.source,
            created_at: new Date().toISOString(),
          });
        }
      }

      commitLogs.push({
        row_number: rowNum,
        company_name: compName,
        status: finalStatus,
        message: logMsg,
        timestamp: new Date().toISOString(),
      });
    });

    return res.json({
      success: true,
      batch_id: batchId,
      total_committed: committedRecords.length,
      imported_count: importedCount,
      duplicate_skipped_count: duplicateSkippedCount,
      error_logged_count: errorLoggedCount,
      records: committedRecords,
      commit_logs: commitLogs,
      message: `Committed ${committedRecords.length} records to total_company_list (${importedCount} imported, ${duplicateSkippedCount} duplicates skipped, ${errorLoggedCount} errors logged).`,
    });
  } catch (err: any) {
    console.error('[Server TotalCompany] Commit error:', err);
    return res.status(500).json({
      error: 'Failed to commit records to total_company_list table.',
      detail: err.message,
    });
  }
});

/**
 * GET /api/v1/total-companies
 * Retrieves total_company_list records with filters.
 */
totalCompanyRouter.get('/', (req: Request, res: Response) => {
  const { status, batch_id, search, limit = '200' } = req.query as Record<string, string>;

  let filtered = [...totalCompanyListStore];

  if (status && status !== 'all') {
    filtered = filtered.filter((r) => r.import_status === status);
  }

  if (batch_id && batch_id !== 'all') {
    filtered = filtered.filter((r) => r.batch_id === batch_id);
  }

  if (search && search.trim()) {
    const q = search.toLowerCase().trim();
    filtered = filtered.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.website && r.website.toLowerCase().includes(q)) ||
        (r.industry && r.industry.toLowerCase().includes(q)) ||
        (r.error_log && r.error_log.toLowerCase().includes(q)) ||
        (r.batch_id && r.batch_id.toLowerCase().includes(q))
    );
  }

  const numLimit = parseInt(limit, 10) || 200;
  return res.json(filtered.slice(0, numLimit));
});

/**
 * DELETE /api/v1/total-companies/logs
 * Clears error logs or entire batch from total_company_list table.
 */
totalCompanyRouter.delete('/logs', (req: Request, res: Response) => {
  const { batch_id } = req.query as { batch_id?: string };

  if (batch_id && batch_id !== 'all') {
    const prevCount = totalCompanyListStore.length;
    const remaining = totalCompanyListStore.filter((r) => r.batch_id !== batch_id);
    totalCompanyListStore.length = 0;
    totalCompanyListStore.push(...remaining);
    return res.json({
      success: true,
      cleared_count: prevCount - remaining.length,
      message: `Cleared records for batch ${batch_id}`,
    });
  }

  const count = totalCompanyListStore.length;
  totalCompanyListStore.length = 0;
  return res.json({
    success: true,
    cleared_count: count,
    message: 'All total_company_list audit records cleared.',
  });
});

/**
 * GET /api/v1/total-companies/stats
 * Summary stats for total_company_list
 */
totalCompanyRouter.get('/stats', (req: Request, res: Response) => {
  const total = totalCompanyListStore.length;
  const imported = totalCompanyListStore.filter((r) => r.import_status === 'imported').length;
  const duplicates = totalCompanyListStore.filter((r) => r.import_status === 'duplicate_skipped').length;
  const errors = totalCompanyListStore.filter((r) => r.import_status === 'error' || r.import_status === 'invalid').length;

  const batches = Array.from(new Set(totalCompanyListStore.map((r) => r.batch_id).filter(Boolean)));

  return res.json({
    total_records: total,
    imported,
    duplicates,
    errors,
    batch_count: batches.length,
    batches,
  });
});
