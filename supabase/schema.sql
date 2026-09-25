-- ============================================================================
-- PLACEMEIN CRA CRM - Supabase Backend Row-Level Security (RLS) Schema
-- ============================================================================
-- Purpose:
-- Enforces backend Row-Level Security (RLS) policies in the Supabase PostgreSQL
-- schema so that CRAs (employees) can ONLY retrieve/access records where the
-- 'assigned_to' column matches their own User ID (auth.uid()).
--
-- Admins retain global oversight across all organization records.
-- ============================================================================

-- 1. Helper function to check if the current authenticated user is an Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
  );
$$;

-- 2. Operational Tables with 'assigned_to' column
-- ----------------------------------------------------------------------------

-- PROFILES (Users and CRA credentials)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'cra', -- 'admin' | 'cra'
    emp_id TEXT,
    phone TEXT,
    is_active BOOLEAN DEFAULT true,
    is_admin BOOLEAN DEFAULT false,
    monthly_jd_target INTEGER DEFAULT 20,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TASKS (Action items and follow-ups)
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    assignee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'pending', -- 'pending' | 'in_progress' | 'completed' | 'cancelled'
    due_date TIMESTAMPTZ,
    company_id UUID,
    contact_id UUID,
    is_recurring BOOLEAN DEFAULT false,
    recurring_interval TEXT,
    last_regenerated_at TIMESTAMPTZ,
    is_dismissed BOOLEAN DEFAULT false,
    snoozed_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure assigned_to column exists on tasks if table was already created
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'assigned_to'
    ) THEN
        ALTER TABLE public.tasks ADD COLUMN assigned_to UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        UPDATE public.tasks SET assigned_to = assignee_id WHERE assigned_to IS NULL AND assignee_id IS NOT NULL;
    END IF;
END $$;

-- CONTACTS (HR Leads and verified recruiters)
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID,
    name TEXT NOT NULL,
    title TEXT,
    email TEXT,
    phone TEXT,
    linkedin_url TEXT,
    domain TEXT,
    location TEXT,
    remarks TEXT DEFAULT 'Pending',
    spoc TEXT,
    entered_by_name TEXT,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    source TEXT DEFAULT 'manual',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'assigned_to'
    ) THEN
        ALTER TABLE public.contacts ADD COLUMN assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- COMPANIES (Master employer accounts)
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    industry TEXT,
    website TEXT,
    linkedin_url TEXT,
    employee_count TEXT,
    location TEXT,
    notes TEXT,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    source TEXT DEFAULT 'manual',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'assigned_to'
    ) THEN
        ALTER TABLE public.companies ADD COLUMN assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- JDS (Job descriptions and hiring opportunities)
CREATE TABLE IF NOT EXISTS public.jds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    company_id UUID,
    raw_text TEXT,
    is_verified BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'active',
    is_purchased BOOLEAN DEFAULT false,
    purchase_date TIMESTAMPTZ,
    client_notes TEXT,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'jds' AND column_name = 'assigned_to'
    ) THEN
        ALTER TABLE public.jds ADD COLUMN assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- OUTREACH RECORDS (Communication logs across calls, mails, whatsapp, linkedin)
CREATE TABLE IF NOT EXISTS public.outreach_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
    channel TEXT NOT NULL,
    status TEXT NOT NULL,
    notes TEXT,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'outreach_records' AND column_name = 'assigned_to'
    ) THEN
        ALTER TABLE public.outreach_records ADD COLUMN assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. High-Performance Indexing on assigned_to
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_contacts_assigned_to ON public.contacts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_companies_assigned_to ON public.companies(assigned_to);
CREATE INDEX IF NOT EXISTS idx_jds_assigned_to ON public.jds(assigned_to);
CREATE INDEX IF NOT EXISTS idx_outreach_records_assigned_to ON public.outreach_records(assigned_to);

-- 4. Enable Row-Level Security (RLS) on all operational tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_records ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies to prevent conflicts on re-execution
DROP POLICY IF EXISTS "Users can read own profile or admin can read all" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

DROP POLICY IF EXISTS "CRAs can only select tasks assigned to them" ON public.tasks;
DROP POLICY IF EXISTS "CRAs can only update tasks assigned to them" ON public.tasks;
DROP POLICY IF EXISTS "CRAs can only insert tasks assigned to them" ON public.tasks;
DROP POLICY IF EXISTS "CRAs can only delete tasks assigned to them" ON public.tasks;

DROP POLICY IF EXISTS "CRAs can only select contacts assigned to them" ON public.contacts;
DROP POLICY IF EXISTS "CRAs can only update contacts assigned to them" ON public.contacts;
DROP POLICY IF EXISTS "CRAs can only insert contacts assigned to them" ON public.contacts;
DROP POLICY IF EXISTS "CRAs can only delete contacts assigned to them" ON public.contacts;

DROP POLICY IF EXISTS "CRAs can only select companies assigned to them" ON public.companies;
DROP POLICY IF EXISTS "CRAs can only update companies assigned to them" ON public.companies;
DROP POLICY IF EXISTS "CRAs can only insert companies assigned to them" ON public.companies;

DROP POLICY IF EXISTS "CRAs can only select jds assigned to them" ON public.jds;
DROP POLICY IF EXISTS "CRAs can only update jds assigned to them" ON public.jds;
DROP POLICY IF EXISTS "CRAs can only insert jds assigned to them" ON public.jds;

DROP POLICY IF EXISTS "CRAs can only select outreach assigned to them" ON public.outreach_records;
DROP POLICY IF EXISTS "CRAs can only insert outreach assigned to them" ON public.outreach_records;

-- 6. Strict RLS Policies: CRAs can ONLY access/retrieve records where assigned_to = auth.uid()

-- === PROFILES RLS ===
CREATE POLICY "Users can read own profile or admin can read all"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.is_admin()
);

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
  OR public.is_admin()
)
WITH CHECK (
  id = auth.uid()
  OR public.is_admin()
);

-- === TASKS RLS ===
-- Policy: CRAs can only retrieve/access tasks where assigned_to matches their own User ID
CREATE POLICY "CRAs can only select tasks assigned to them"
ON public.tasks
FOR SELECT
TO authenticated
USING (
  assigned_to = auth.uid()
  OR assignee_id = auth.uid()
  OR public.is_admin()
);

-- Policy: CRAs can only update tasks where assigned_to matches their own User ID
CREATE POLICY "CRAs can only update tasks assigned to them"
ON public.tasks
FOR UPDATE
TO authenticated
USING (
  assigned_to = auth.uid()
  OR assignee_id = auth.uid()
  OR public.is_admin()
)
WITH CHECK (
  assigned_to = auth.uid()
  OR assignee_id = auth.uid()
  OR public.is_admin()
);

-- Policy: CRAs can only insert tasks assigned to their own User ID
CREATE POLICY "CRAs can only insert tasks assigned to them"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (
  assigned_to = auth.uid()
  OR assignee_id = auth.uid()
  OR public.is_admin()
);

-- Policy: CRAs can only delete tasks assigned to their own User ID
CREATE POLICY "CRAs can only delete tasks assigned to them"
ON public.tasks
FOR DELETE
TO authenticated
USING (
  assigned_to = auth.uid()
  OR assignee_id = auth.uid()
  OR public.is_admin()
);

-- === CONTACTS / LEADS RLS ===
-- Policy: CRAs can only retrieve contacts where assigned_to matches their own User ID
CREATE POLICY "CRAs can only select contacts assigned to them"
ON public.contacts
FOR SELECT
TO authenticated
USING (
  assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR public.is_admin()
);

-- Policy: CRAs can only update contacts where assigned_to matches their own User ID
CREATE POLICY "CRAs can only update contacts assigned to them"
ON public.contacts
FOR UPDATE
TO authenticated
USING (
  assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR public.is_admin()
)
WITH CHECK (
  assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR public.is_admin()
);

-- Policy: CRAs can only insert contacts assigned to their own User ID
CREATE POLICY "CRAs can only insert contacts assigned to them"
ON public.contacts
FOR INSERT
TO authenticated
WITH CHECK (
  assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR public.is_admin()
);

-- Policy: CRAs can only delete contacts assigned to their own User ID
CREATE POLICY "CRAs can only delete contacts assigned to them"
ON public.contacts
FOR DELETE
TO authenticated
USING (
  assigned_to = auth.uid()
  OR public.is_admin()
);

-- === COMPANIES RLS ===
-- Policy: CRAs can only retrieve companies where assigned_to matches their own User ID
CREATE POLICY "CRAs can only select companies assigned to them"
ON public.companies
FOR SELECT
TO authenticated
USING (
  assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR public.is_admin()
);

CREATE POLICY "CRAs can only update companies assigned to them"
ON public.companies
FOR UPDATE
TO authenticated
USING (
  assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR public.is_admin()
)
WITH CHECK (
  assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR public.is_admin()
);

CREATE POLICY "CRAs can only insert companies assigned to them"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (
  assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR public.is_admin()
);

-- === JDS (JOB DESCRIPTIONS) RLS ===
-- Policy: CRAs can only retrieve JDs where assigned_to matches their own User ID
CREATE POLICY "CRAs can only select jds assigned to them"
ON public.jds
FOR SELECT
TO authenticated
USING (
  assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR public.is_admin()
);

CREATE POLICY "CRAs can only update jds assigned to them"
ON public.jds
FOR UPDATE
TO authenticated
USING (
  assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR public.is_admin()
)
WITH CHECK (
  assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR public.is_admin()
);

CREATE POLICY "CRAs can only insert jds assigned to them"
ON public.jds
FOR INSERT
TO authenticated
WITH CHECK (
  assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR public.is_admin()
);

-- === OUTREACH RECORDS RLS ===
-- Policy: CRAs can only retrieve outreach logs where assigned_to matches their own User ID
CREATE POLICY "CRAs can only select outreach assigned to them"
ON public.outreach_records
FOR SELECT
TO authenticated
USING (
  assigned_to = auth.uid()
  OR public.is_admin()
);

CREATE POLICY "CRAs can only insert outreach assigned to them"
ON public.outreach_records
FOR INSERT
TO authenticated
WITH CHECK (
  assigned_to = auth.uid()
  OR public.is_admin()
);
