/**
 * Placemein CRA Outreach Formatters
 * Formats dates, phone numbers, and numbers according to standard Indian business norms.
 */

export function formatIndianDate(dateInput?: string | number | Date | null): string {
  if (!dateInput) return '—';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(dateInput);
  }
}

export function formatIndianDateTime(dateInput?: string | number | Date | null): string {
  if (!dateInput) return '—';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return String(dateInput);
  }
}

export function formatIndianTime(dateInput?: string | number | Date | null): string {
  if (!dateInput) return '—';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    return d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return String(dateInput);
  }
}

export function formatIndianPhone(phoneInput?: string | null): string {
  if (!phoneInput || !phoneInput.trim()) return '—';
  const clean = phoneInput.replace(/[^0-9+]/g, '');
  if (clean.length === 10 && !clean.startsWith('+')) {
    return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
  }
  if (clean.startsWith('+91') && clean.length === 13) {
    return `+91 ${clean.slice(3, 8)} ${clean.slice(8)}`;
  }
  if (clean.startsWith('91') && clean.length === 12) {
    return `+91 ${clean.slice(2, 7)} ${clean.slice(7)}`;
  }
  return phoneInput.trim();
}

export function formatIndianNumber(numInput?: number | string | null): string {
  if (numInput === undefined || numInput === null) return '0';
  const num = typeof numInput === 'string' ? parseFloat(numInput) : numInput;
  if (isNaN(num)) return '0';
  return num.toLocaleString('en-IN');
}

export function formatIndianCurrency(numInput?: number | string | null): string {
  if (numInput === undefined || numInput === null) return '₹0';
  const num = typeof numInput === 'string' ? parseFloat(numInput) : numInput;
  if (isNaN(num)) return '₹0';
  return `₹${num.toLocaleString('en-IN')}`;
}
