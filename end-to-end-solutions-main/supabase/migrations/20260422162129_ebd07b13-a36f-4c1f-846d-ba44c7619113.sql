-- 1. Auto-suspension trigger on match_events (red_card / second_yellow)
CREATE OR REPLACE FUNCTION public.handle_red_card_suspension()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case text;
  v_year int := EXTRACT(YEAR FROM now())::int;
  v_exists boolean;
BEGIN
  IF NEW.event_type IN ('red_card', 'second_yellow') AND NEW.player_id IS NOT NULL THEN
    -- Idempotency: skip if a discipline record already exists for this exact event
    SELECT EXISTS (
      SELECT 1 FROM public.discipline_records
      WHERE match_id = NEW.match_id
        AND player_id = NEW.player_id
        AND reason LIKE 'Auto-generated:%minute ' || NEW.minute
    ) INTO v_exists;

    IF NOT v_exists THEN
      v_case := 'DISC-' || v_year || '-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::text, 4, '0');
      INSERT INTO public.discipline_records(
        case_number, discipline_type, player_id, club_id, match_id,
        reason, suspension_matches, fine_amount, status, issued_by
      ) VALUES (
        v_case, 'suspension', NEW.player_id, NEW.club_id, NEW.match_id,
        'Auto-generated: ' || NEW.event_type || ' at minute ' || NEW.minute,
        CASE WHEN NEW.event_type = 'red_card' THEN 2 ELSE 1 END,
        CASE WHEN NEW.event_type = 'red_card' THEN 50000 ELSE 25000 END,
        'active', NEW.recorded_by
      );
    END IF;

    UPDATE public.players SET red_cards = COALESCE(red_cards, 0) + 1 WHERE id = NEW.player_id;
  ELSIF NEW.event_type = 'yellow_card' AND NEW.player_id IS NOT NULL THEN
    UPDATE public.players SET yellow_cards = COALESCE(yellow_cards, 0) + 1 WHERE id = NEW.player_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_match_events_red_card ON public.match_events;
CREATE TRIGGER trg_match_events_red_card
  AFTER INSERT ON public.match_events
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_red_card_suspension();

-- Ensure the canonical sample case exists for testing the status flow
INSERT INTO public.discipline_records (case_number, discipline_type, reason, status, suspension_matches, fine_amount)
SELECT 'DISC-2026-4471', 'suspension', 'Sample case for status workflow QA', 'active', 1, 25000
WHERE NOT EXISTS (SELECT 1 FROM public.discipline_records WHERE case_number = 'DISC-2026-4471');

-- 2. Storage buckets for compliance documents and appeal evidence
INSERT INTO storage.buckets (id, name, public)
VALUES ('compliance-docs', 'compliance-docs', false),
       ('appeal-evidence', 'appeal-evidence', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated officials can read/write, ministry admin can manage
CREATE POLICY "compliance_docs_read_auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'compliance-docs');

CREATE POLICY "compliance_docs_write_official" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'compliance-docs'
    AND public.has_any_role(auth.uid(), ARRAY['ministry_admin','ferwafa_admin','club_official']::app_role[]));

CREATE POLICY "compliance_docs_update_official" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'compliance-docs'
    AND public.has_any_role(auth.uid(), ARRAY['ministry_admin','ferwafa_admin','club_official']::app_role[]));

CREATE POLICY "compliance_docs_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'compliance-docs'
    AND public.has_any_role(auth.uid(), ARRAY['ministry_admin','ferwafa_admin']::app_role[]));

CREATE POLICY "appeal_evidence_read_auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'appeal-evidence');

CREATE POLICY "appeal_evidence_write_auth" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'appeal-evidence');

CREATE POLICY "appeal_evidence_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'appeal-evidence'
    AND public.has_any_role(auth.uid(), ARRAY['ministry_admin','ferwafa_admin']::app_role[]));

-- 3. Audit log: add evidence_url column on discipline + appeal evidence
ALTER TABLE public.discipline_records
  ADD COLUMN IF NOT EXISTS appeal_evidence_url text,
  ADD COLUMN IF NOT EXISTS decision_pdf_hash text,
  ADD COLUMN IF NOT EXISTS decision_pdf_anchor_seq bigint;

ALTER TABLE public.club_documents
  ADD COLUMN IF NOT EXISTS storage_path text;

-- 4. Notification queue table (for assignment / license expiry / compliance overdue alerts)
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN ('email','sms','in_app')),
  recipient text NOT NULL,
  subject text,
  body text NOT NULL,
  category text NOT NULL,
  related_entity_type text,
  related_entity_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_admin" ON public.notifications
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['ministry_admin','ferwafa_admin']::app_role[]));

CREATE POLICY "notifications_insert_auth" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(status, created_at);

-- 5. Audit trail: helper RPC for paginated date-range filtering
CREATE OR REPLACE FUNCTION public.audit_log_search(
  _from timestamptz DEFAULT NULL,
  _to timestamptz DEFAULT NULL,
  _entity text DEFAULT NULL,
  _action text DEFAULT NULL,
  _search text DEFAULT NULL,
  _limit int DEFAULT 50,
  _offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid, created_at timestamptz, actor_id uuid, actor_email text,
  entity_type text, entity_id uuid, action text, details jsonb,
  prev_hash text, entry_hash text, sequence_number bigint, total_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'ministry_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  WITH filtered AS (
    SELECT a.* FROM public.audit_log a
    WHERE (_from IS NULL OR a.created_at >= _from)
      AND (_to IS NULL OR a.created_at <= _to)
      AND (_entity IS NULL OR a.entity_type = _entity)
      AND (_action IS NULL OR a.action = _action)
      AND (_search IS NULL OR _search = '' OR
           a.actor_email ILIKE '%'||_search||'%' OR
           a.entity_type ILIKE '%'||_search||'%' OR
           a.details::text ILIKE '%'||_search||'%')
  ), counted AS (SELECT COUNT(*) AS c FROM filtered)
  SELECT f.id, f.created_at, f.actor_id, f.actor_email, f.entity_type, f.entity_id,
         f.action, f.details, f.prev_hash, f.entry_hash, f.sequence_number,
         (SELECT c FROM counted)
  FROM filtered f
  ORDER BY f.sequence_number DESC
  LIMIT _limit OFFSET _offset;
END;
$$;

-- 6. RPC: latest audit anchor (for embedding in PDFs)
CREATE OR REPLACE FUNCTION public.latest_audit_anchor()
RETURNS TABLE (sequence_number bigint, entry_hash text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sequence_number, entry_hash, created_at
  FROM public.audit_log
  WHERE entry_hash IS NOT NULL
  ORDER BY sequence_number DESC LIMIT 1;
$$;