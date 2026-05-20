
-- Referee enhancements
ALTER TABLE public.referees
  ADD COLUMN IF NOT EXISTS license_expiry date,
  ADD COLUMN IF NOT EXISTS district text,
  ADD COLUMN IF NOT EXISTS grade text;

-- Player eligibility & conduct
DO $$ BEGIN
  CREATE TYPE player_status AS ENUM ('eligible','suspended','injured','inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS status player_status NOT NULL DEFAULT 'eligible',
  ADD COLUMN IF NOT EXISTS conduct_score numeric(3,2) DEFAULT 1.00;

-- Club points deductions
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS points_deduction integer NOT NULL DEFAULT 0;

-- Discipline appeals
ALTER TABLE public.discipline_records
  ADD COLUMN IF NOT EXISTS appeal_status text,
  ADD COLUMN IF NOT EXISTS appeal_grounds text,
  ADD COLUMN IF NOT EXISTS appeal_decided_at timestamptz;

-- Training modules for referees
CREATE TABLE IF NOT EXISTS public.training_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referee_id uuid NOT NULL REFERENCES public.referees(id) ON DELETE CASCADE,
  module_name text NOT NULL,
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.training_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "training_select_all" ON public.training_modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "training_write_admin" ON public.training_modules FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['ministry_admin'::app_role,'ferwafa_admin'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['ministry_admin'::app_role,'ferwafa_admin'::app_role]));

-- Club licensing documents
CREATE TABLE IF NOT EXISTS public.club_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  requirement text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- complete | pending | overdue
  due_date date,
  document_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.club_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "club_docs_select_all" ON public.club_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "club_docs_write_admin" ON public.club_documents FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['ministry_admin'::app_role,'ferwafa_admin'::app_role,'club_official'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['ministry_admin'::app_role,'ferwafa_admin'::app_role,'club_official'::app_role]));

-- Referee assignments (full crew)
CREATE TABLE IF NOT EXISTS public.referee_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  referee_id uuid NOT NULL REFERENCES public.referees(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('referee','assistant_1','assistant_2','fourth_official')),
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(match_id, role)
);
ALTER TABLE public.referee_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ref_assign_select_all" ON public.referee_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_assign_write_admin" ON public.referee_assignments FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['ministry_admin'::app_role,'ferwafa_admin'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['ministry_admin'::app_role,'ferwafa_admin'::app_role]));

-- Public read for fans
CREATE POLICY "training_public_read" ON public.training_modules FOR SELECT TO anon USING (true);
CREATE POLICY "club_docs_public_read" ON public.club_documents FOR SELECT TO anon USING (false);
CREATE POLICY "ref_assign_public_read" ON public.referee_assignments FOR SELECT TO anon USING (true);
