-- Migration: 20260925_rls_assigned_to.sql
-- Backend Row-Level Security (RLS) policies ensuring CRAs can only retrieve/access records where assigned_to matches auth.uid()

-- 1. Helper function to check admin role
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

-- 2. Add assigned_to columns if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'assigned_to'
    ) THEN
        ALTER TABLE public.tasks ADD COLUMN assigned_to UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        UPDATE public.tasks SET assigned_to = assignee_id WHERE assigned_to IS NULL AND assignee_id IS NOT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'assigned_to'
    ) THEN
        ALTER TABLE public.contacts ADD COLUMN assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'assigned_to'
    ) THEN
        ALTER TABLE public.companies ADD COLUMN assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'jds' AND column_name = 'assigned_to'
    ) THEN
        ALTER TABLE public.jds ADD COLUMN assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'outreach_records' AND column_name = 'assigned_to'
    ) THEN
        ALTER TABLE public.outreach_records ADD COLUMN assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Indexes for fast RLS evaluation
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_contacts_assigned_to ON public.contacts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_companies_assigned_to ON public.companies(assigned_to);
CREATE INDEX IF NOT EXISTS idx_jds_assigned_to ON public.jds(assigned_to);
CREATE INDEX IF NOT EXISTS idx_outreach_records_assigned_to ON public.outreach_records(assigned_to);

-- 4. Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_records ENABLE ROW LEVEL SECURITY;

-- 5. Strict RLS Policies for tasks
DROP POLICY IF EXISTS "CRAs can only select tasks assigned to them" ON public.tasks;
CREATE POLICY "CRAs can only select tasks assigned to them"
ON public.tasks FOR SELECT TO authenticated
USING (
  assigned_to = auth.uid()
  OR assignee_id = auth.uid()
  OR public.is_admin()
);

DROP POLICY IF EXISTS "CRAs can only update tasks assigned to them" ON public.tasks;
CREATE POLICY "CRAs can only update tasks assigned to them"
ON public.tasks FOR UPDATE TO authenticated
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

-- 6. Strict RLS Policies for contacts
DROP POLICY IF EXISTS "CRAs can only select contacts assigned to them" ON public.contacts;
CREATE POLICY "CRAs can only select contacts assigned to them"
ON public.contacts FOR SELECT TO authenticated
USING (
  assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR public.is_admin()
);

DROP POLICY IF EXISTS "CRAs can only update contacts assigned to them" ON public.contacts;
CREATE POLICY "CRAs can only update contacts assigned to them"
ON public.contacts FOR UPDATE TO authenticated
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

-- 7. Strict RLS Policies for companies
DROP POLICY IF EXISTS "CRAs can only select companies assigned to them" ON public.companies;
CREATE POLICY "CRAs can only select companies assigned to them"
ON public.companies FOR SELECT TO authenticated
USING (
  assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR public.is_admin()
);

-- 8. Strict RLS Policies for JDs
DROP POLICY IF EXISTS "CRAs can only select jds assigned to them" ON public.jds;
CREATE POLICY "CRAs can only select jds assigned to them"
ON public.jds FOR SELECT TO authenticated
USING (
  assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR public.is_admin()
);

-- 9. Strict RLS Policies for outreach records
DROP POLICY IF EXISTS "CRAs can only select outreach assigned to them" ON public.outreach_records;
CREATE POLICY "CRAs can only select outreach assigned to them"
ON public.outreach_records FOR SELECT TO authenticated
USING (
  assigned_to = auth.uid()
  OR public.is_admin()
);
