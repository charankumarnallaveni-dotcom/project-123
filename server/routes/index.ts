import { Router, Request, Response } from 'express';
import { totalCompanyRouter } from './totalCompany';
import { hrGoogleSearchRouter } from './hrGoogleSearch';

export const apiRouter = Router();

// In-memory data store for fallback backend operations
let mockUsers = [
  {
    id: 'usr_admin_aravind',
    name: 'Aravind Reddy',
    email: 'aravindaravind3953@gmail.com',
    role: 'admin',
    emp_id: 'PM-CEO',
    monthly_jd_target: 20,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'usr_cra_charan',
    name: 'Charan',
    email: 'charankumarnallaveni@gmail.com',
    role: 'admin',
    emp_id: 'PM-EMP-001',
    monthly_jd_target: 20,
    is_active: true,
    created_at: new Date().toISOString(),
  }
];

// Auth Endpoints
apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  const cleanEmail = (email || '').trim().toLowerCase();
  
  const user = mockUsers.find(u => u.email.toLowerCase() === cleanEmail) || {
    id: 'usr_cra_' + Math.random().toString(36).substring(7),
    name: cleanEmail.split('@')[0] || 'User',
    email: cleanEmail,
    role: cleanEmail.includes('admin') || cleanEmail.includes('aravind') || cleanEmail.includes('charan') ? 'admin' : 'cra',
    emp_id: 'PM-EMP-099',
    monthly_jd_target: 20,
    is_active: true,
    created_at: new Date().toISOString(),
  };

  const token = 'token_' + Buffer.from(cleanEmail).toString('base64');
  return res.json({
    access_token: token,
    token_type: 'bearer',
    user,
  });
});

apiRouter.post('/auth/logout', (req: Request, res: Response) => {
  return res.json({ success: true, message: 'Logged out successfully' });
});

apiRouter.get('/auth/me', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.json(mockUsers[0]);
  }
  return res.json(mockUsers[0]);
});

apiRouter.post('/auth/register', (req: Request, res: Response) => {
  const { email, name, role } = req.body || {};
  const newUser = {
    id: 'usr_' + Math.random().toString(36).substring(7),
    name: name || 'New User',
    email: email || 'user@placemein.com',
    role: role || 'cra',
    emp_id: 'PM-EMP-' + Math.floor(100 + Math.random() * 900),
    monthly_jd_target: 20,
    is_active: true,
    created_at: new Date().toISOString(),
  };
  mockUsers.push(newUser);
  return res.json({ access_token: 'token_reg_' + Date.now(), user: newUser });
});

apiRouter.post('/auth/forgot-password', (req: Request, res: Response) => {
  return res.json({ success: true, message: 'Password reset link sent' });
});

apiRouter.post('/auth/reset-password', (req: Request, res: Response) => {
  return res.json({ success: true, message: 'Password has been reset' });
});

// Dashboard stats endpoint
apiRouter.get('/dashboard/stats', (req: Request, res: Response) => {
  return res.json({
    total_verified_opportunities: 48,
    total_contacts: 164,
    total_companies: 52,
    active_campaign_count: 5,
    outreach_by_channel: [
      { channel: 'call', count: 42 },
      { channel: 'mail', count: 68 },
      { channel: 'whatsapp', count: 35 },
      { channel: 'linkedin', count: 19 },
    ],
    outreach_by_status: [
      { status: 'sent', count: 95 },
      { status: 'replied', count: 42 },
      { status: 'not_started', count: 27 },
    ],
    total_jds_received: 38,
    total_eligible_opportunities: 29,
    overall_conversion_rate: 26.5,
    unique_companies_onboarded: 45,
    active_placement_drives: 8,
  });
});

// Companies endpoints
apiRouter.put('/companies/:id', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  // Verify admin authorization
  if (!authHeader) {
    return res.status(401).json({ detail: 'Authentication required' });
  }

  // Check role: allow if token corresponds to admin or contains admin indicator
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const decoded = Buffer.from(token.replace(/^token_/, ''), 'base64').toString('utf8').toLowerCase();
  const isAdmin = decoded.includes('admin') || decoded.includes('aravind') || decoded.includes('charan') || req.body?.is_admin === true;

  if (!isAdmin) {
    return res.status(403).json({
      detail: 'Forbidden: Only Admin role can edit existing company records.',
    });
  }

  return res.json({
    id: req.params.id,
    ...req.body,
    updated_at: new Date().toISOString(),
  });
});

apiRouter.patch('/companies/:id', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ detail: 'Authentication required' });
  }
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const decoded = Buffer.from(token.replace(/^token_/, ''), 'base64').toString('utf8').toLowerCase();
  const isAdmin = decoded.includes('admin') || decoded.includes('aravind') || decoded.includes('charan') || req.body?.is_admin === true;

  if (!isAdmin) {
    return res.status(403).json({
      detail: 'Forbidden: Only Admin role can edit existing company records.',
    });
  }

  return res.json({
    id: req.params.id,
    ...req.body,
    updated_at: new Date().toISOString(),
  });
});

// Users endpoint
apiRouter.get('/users/', (req: Request, res: Response) => {
  return res.json(mockUsers);
});

apiRouter.get('/admin/users', (req: Request, res: Response) => {
  return res.json(mockUsers);
});

// Total Company List & Bulk Importer Endpoints
apiRouter.use('/total-companies', totalCompanyRouter);

// Backend Row-Level Security (RLS) Policy Endpoint
apiRouter.get('/schema/rls', (req: Request, res: Response) => {
  return res.json({
    status: 'active',
    policy_target: 'assigned_to',
    enforcement: 'CRAs can only retrieve/access records where assigned_to matches their own User ID (auth.uid())',
    tables: ['tasks', 'contacts', 'companies', 'jds', 'outreach_records'],
    sql_file: '/supabase/schema.sql',
    migration_file: '/supabase/migrations/20260925_rls_assigned_to.sql',
  });
});

// Aliases for bulk company importer workflows
apiRouter.post('/companies/bulk-validate', (req: Request, res: Response, next) => {
  req.url = '/validate';
  totalCompanyRouter(req, res, next);
});
apiRouter.post('/companies/bulk-commit', (req: Request, res: Response, next) => {
  req.url = '/commit';
  totalCompanyRouter(req, res, next);
});

// Google Search HR (Restricted to Hyderabad, Bengaluru, Chennai, Pune only) & Contact Autofill
apiRouter.use('/contacts', hrGoogleSearchRouter);

// Catch-all 404 for remaining unhandled endpoints to trigger client-side fallback
apiRouter.use('*', (req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not implemented on server, use client fallback' });
});
