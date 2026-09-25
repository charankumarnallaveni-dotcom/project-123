/**
 * Production-grade CSV, TSV & Spreadsheet parser for HR contacts
 * Supports RFC-4180 quotes, auto-detected delimiters (comma, tab, semicolon, pipe),
 * intelligent header detection and mapping, and fallback heuristics for unlabelled data.
 */

export interface ParsedContactRow {
  id: string;
  name: string;
  title: string;
  company_name?: string;
  company_id?: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  isValid: boolean;
  warnings: string[];
}

/**
 * Split text into records and fields adhering to RFC-4180 (handling quoted fields with newlines/commas)
 */
export function parseDelimitedText(text: string): { rows: string[][]; delimiter: string } {
  if (!text || !text.trim()) return { rows: [], delimiter: ',' };

  // 1. Detect delimiter by inspecting the first few lines
  const firstLines = text.split(/\r?\n/).slice(0, 5).join('\n');
  const counts = {
    tab: (firstLines.match(/\t/g) || []).length,
    comma: (firstLines.match(/,/g) || []).length,
    semicolon: (firstLines.match(/;/g) || []).length,
    pipe: (firstLines.match(/\|/g) || []).length,
  };

  let delimiter = ',';
  if (counts.tab > counts.comma && counts.tab > counts.semicolon) {
    delimiter = '\t';
  } else if (counts.semicolon > counts.comma && counts.semicolon > counts.tab) {
    delimiter = ';';
  } else if (counts.pipe > counts.comma && counts.pipe > counts.semicolon) {
    delimiter = '|';
  }

  // 2. Parse character by character with state machine
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  const len = text.length;

  for (let i = 0; i < len; i++) {
    const char = text[i];
    const nextChar = i + 1 < len ? text[i + 1] : '';

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote: "" -> "
        currentField += '"';
        i++; // skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n in \r\n
      }
      currentRow.push(currentField.trim());
      currentField = '';
      if (currentRow.some((f) => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  // Final flush
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  return { rows, delimiter };
}

interface ColumnMap {
  nameCol: number;
  firstNameCol: number;
  lastNameCol: number;
  titleCol: number;
  companyCol: number;
  emailCol: number;
  phoneCol: number;
  linkedinCol: number;
}

const HEADER_SYNONYMS = {
  name: ['name', 'full name', 'fullname', 'contact name', 'candidate name', 'recruiter', 'person', 'talent name', 'hr name'],
  firstName: ['first name', 'firstname', 'given name'],
  lastName: ['last name', 'lastname', 'surname', 'family name'],
  title: ['title', 'job title', 'designation', 'role', 'headline', 'position', 'job', 'profession'],
  company: ['company', 'company name', 'organization', 'organisation', 'firm', 'employer', 'org', 'business', 'workplace'],
  email: ['email', 'e-mail', 'email address', 'work email', 'personal email', 'mail', 'email id', 'contact email'],
  phone: ['phone', 'mobile', 'contact no', 'phone number', 'cell', 'telephone', 'mobile no', 'whatsapp', 'tel', 'phone no', 'contact number'],
  linkedin: ['linkedin', 'linkedin url', 'profile', 'linkedin link', 'social', 'linkedin profile', 'profile url', 'url', 'profile link'],
};

function matchHeader(cell: string, list: string[]): boolean {
  const norm = cell.toLowerCase().trim().replace(/[^a-z0-9 ]/g, '');
  return list.some((term) => norm === term || norm.includes(term));
}

/**
 * Parses raw text or CSV content into structured HRContact objects
 */
export function parseHRContactsCSV(
  content: string,
  defaultCompany?: { id: string; name: string }
): { contacts: ParsedContactRow[]; hasHeaders: boolean; delimiter: string } {
  const { rows, delimiter } = parseDelimitedText(content);
  if (rows.length === 0) return { contacts: [], hasHeaders: false, delimiter };

  const firstRow = rows[0];

  // Detect if first row is a header
  const colMap: ColumnMap = {
    nameCol: -1,
    firstNameCol: -1,
    lastNameCol: -1,
    titleCol: -1,
    companyCol: -1,
    emailCol: -1,
    phoneCol: -1,
    linkedinCol: -1,
  };

  let matchedHeadersCount = 0;
  firstRow.forEach((cell, idx) => {
    if (colMap.nameCol === -1 && matchHeader(cell, HEADER_SYNONYMS.name)) {
      colMap.nameCol = idx;
      matchedHeadersCount++;
    } else if (colMap.firstNameCol === -1 && matchHeader(cell, HEADER_SYNONYMS.firstName)) {
      colMap.firstNameCol = idx;
      matchedHeadersCount++;
    } else if (colMap.lastNameCol === -1 && matchHeader(cell, HEADER_SYNONYMS.lastName)) {
      colMap.lastNameCol = idx;
      matchedHeadersCount++;
    } else if (colMap.titleCol === -1 && matchHeader(cell, HEADER_SYNONYMS.title)) {
      colMap.titleCol = idx;
      matchedHeadersCount++;
    } else if (colMap.companyCol === -1 && matchHeader(cell, HEADER_SYNONYMS.company)) {
      colMap.companyCol = idx;
      matchedHeadersCount++;
    } else if (colMap.emailCol === -1 && matchHeader(cell, HEADER_SYNONYMS.email)) {
      colMap.emailCol = idx;
      matchedHeadersCount++;
    } else if (colMap.phoneCol === -1 && matchHeader(cell, HEADER_SYNONYMS.phone)) {
      colMap.phoneCol = idx;
      matchedHeadersCount++;
    } else if (colMap.linkedinCol === -1 && matchHeader(cell, HEADER_SYNONYMS.linkedin)) {
      colMap.linkedinCol = idx;
      matchedHeadersCount++;
    }
  });

  const hasHeaders = matchedHeadersCount >= 1 || (firstRow.some((c) => /email|name|phone|title|company/i.test(c)));
  const dataRows = hasHeaders ? rows.slice(1) : rows;

  const results: ParsedContactRow[] = [];

  dataRows.forEach((row, rowIdx) => {
    if (row.length === 0 || row.every((c) => !c.trim())) return;

    let name = '';
    let title = '';
    let companyName = defaultCompany?.name || '';
    let email = '';
    let phone = '';
    let linkedinUrl = '';
    const warnings: string[] = [];

    if (hasHeaders) {
      if (colMap.nameCol !== -1 && row[colMap.nameCol]) {
        name = row[colMap.nameCol];
      } else if (colMap.firstNameCol !== -1) {
        const fn = row[colMap.firstNameCol] || '';
        const ln = colMap.lastNameCol !== -1 ? row[colMap.lastNameCol] || '' : '';
        name = `${fn} ${ln}`.trim();
      }

      if (colMap.titleCol !== -1 && row[colMap.titleCol]) {
        title = row[colMap.titleCol];
      }
      if (colMap.companyCol !== -1 && row[colMap.companyCol]) {
        companyName = row[colMap.companyCol];
      }
      if (colMap.emailCol !== -1 && row[colMap.emailCol]) {
        email = row[colMap.emailCol];
      }
      if (colMap.phoneCol !== -1 && row[colMap.phoneCol]) {
        phone = row[colMap.phoneCol];
      }
      if (colMap.linkedinCol !== -1 && row[colMap.linkedinCol]) {
        linkedinUrl = row[colMap.linkedinCol];
      }
    }

    // Heuristic fallbacks if columns weren't identified or for missing fields
    const unassignedCells = row.filter((_, idx) => {
      if (!hasHeaders) return true;
      return (
        idx !== colMap.nameCol &&
        idx !== colMap.firstNameCol &&
        idx !== colMap.lastNameCol &&
        idx !== colMap.titleCol &&
        idx !== colMap.companyCol &&
        idx !== colMap.emailCol &&
        idx !== colMap.phoneCol &&
        idx !== colMap.linkedinCol
      );
    });

    for (const cell of unassignedCells) {
      const trimmed = cell.trim();
      if (!trimmed) continue;

      // Check email
      if (!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        email = trimmed;
        continue;
      }

      // Check LinkedIn / URL
      if (!linkedinUrl && (trimmed.includes('linkedin.com') || /^https?:\/\//i.test(trimmed))) {
        linkedinUrl = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
        continue;
      }

      // Check phone (8 to 15 digits/dashes/spaces/plus)
      if (!phone && /^[+]?[\d\s-().]{8,18}$/.test(trimmed) && trimmed.replace(/\D/g, '').length >= 8) {
        phone = trimmed;
        continue;
      }

      // Check name / title if not set
      if (!name && !hasHeaders) {
        name = trimmed;
      } else if (!title && (hasHeaders || name)) {
        if (/talent|hr|recruiter|lead|director|manager|specialist|officer|head/i.test(trimmed)) {
          title = trimmed;
        } else if (!title) {
          title = trimmed;
        }
      }
    }

    // Default title if still empty
    if (!title) {
      title = 'Talent Acquisition';
    }

    // Clean values
    name = name.replace(/^["']|["']$/g, '').trim();
    title = title.replace(/^["']|["']$/g, '').trim();
    companyName = companyName.replace(/^["']|["']$/g, '').trim();
    email = email.replace(/^["']|["']$/g, '').trim();
    phone = phone.replace(/^["']|["']$/g, '').trim();
    linkedinUrl = linkedinUrl.replace(/^["']|["']$/g, '').trim();

    // Validation checks
    if (!name) {
      warnings.push('Missing contact name');
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      warnings.push('Invalid email format');
    }
    if (!email && !phone && !linkedinUrl) {
      warnings.push('No direct contact info (email, phone, or LinkedIn)');
    }

    results.push({
      id: `row_${rowIdx}_${Date.now()}`,
      name,
      title,
      company_name: companyName || defaultCompany?.name || 'Target Company',
      company_id: defaultCompany?.id,
      email: email || undefined,
      phone: phone || undefined,
      linkedin_url: linkedinUrl || undefined,
      isValid: Boolean(name && name.length >= 2),
      warnings,
    });
  });

  return { contacts: results, hasHeaders, delimiter };
}

/**
 * Generates a downloadable CSV sample template
 */
export function generateSampleCSV(): string {
  const headers = ['Company', 'Name', 'Title', 'Email', 'Phone', 'LinkedIn URL'];
  const rows = [
    ['Palo Alto Networks', 'Radhika Sharma', 'Senior Tech Recruiter', 'radhika.s@paloaltonetworks.com', '+91 98765 43210', 'https://www.linkedin.com/in/radhika-sharma'],
    ['OATI', 'Vikram Patel', 'Talent Acquisition Lead', 'vikram.patel@oati.com', '+91 98765 43211', 'https://www.linkedin.com/in/vikram-patel'],
    ['CrowdStrike', 'Varun Joshi', 'Campus Relations Lead', 'varun.joshi@crowdstrike.com', '+91 98765 43212', 'https://www.linkedin.com/in/varunjoshi'],
    ['Techolution', 'Steven Lobu', 'Talent Acquisition', 'steven@techolution.com', '+91 88068 03989', 'https://www.linkedin.com/in/stevenlobu'],
  ];

  return [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
}
