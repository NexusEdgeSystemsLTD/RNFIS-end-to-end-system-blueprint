-- Phase 3: Hash-chained audit attestation
-- Add hash chain columns to audit_log
ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS prev_hash text,
  ADD COLUMN IF NOT EXISTS entry_hash text,
  ADD COLUMN IF NOT EXISTS sequence_number bigserial;

-- Trigger function to compute hash chain on insert
CREATE OR REPLACE FUNCTION public.audit_chain_hash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_prev text;
  v_payload text;
BEGIN
  SELECT entry_hash INTO v_prev
    FROM public.audit_log
    WHERE entry_hash IS NOT NULL
    ORDER BY sequence_number DESC
    LIMIT 1;

  NEW.prev_hash := COALESCE(v_prev, repeat('0', 64));

  v_payload := NEW.prev_hash
    || '|' || COALESCE(NEW.actor_id::text, '')
    || '|' || COALESCE(NEW.actor_email, '')
    || '|' || NEW.entity_type
    || '|' || COALESCE(NEW.entity_id::text, '')
    || '|' || NEW.action
    || '|' || COALESCE(NEW.details::text, '')
    || '|' || NEW.created_at::text;

  NEW.entry_hash := encode(extensions.digest(v_payload, 'sha256'), 'hex');
  RETURN NEW;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DROP TRIGGER IF EXISTS audit_chain_hash_trg ON public.audit_log;
CREATE TRIGGER audit_chain_hash_trg
  BEFORE INSERT ON public.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_chain_hash();

-- Verification function: returns rows where the chain is broken
CREATE OR REPLACE FUNCTION public.verify_audit_chain()
RETURNS TABLE(broken_at_id uuid, broken_at_seq bigint, reason text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  r record;
  v_expected_prev text := repeat('0', 64);
  v_recomputed text;
  v_payload text;
BEGIN
  FOR r IN
    SELECT * FROM public.audit_log ORDER BY sequence_number ASC
  LOOP
    IF r.prev_hash IS DISTINCT FROM v_expected_prev THEN
      broken_at_id := r.id; broken_at_seq := r.sequence_number;
      reason := 'prev_hash mismatch';
      RETURN NEXT;
    END IF;

    v_payload := r.prev_hash
      || '|' || COALESCE(r.actor_id::text, '')
      || '|' || COALESCE(r.actor_email, '')
      || '|' || r.entity_type
      || '|' || COALESCE(r.entity_id::text, '')
      || '|' || r.action
      || '|' || COALESCE(r.details::text, '')
      || '|' || r.created_at::text;
    v_recomputed := encode(extensions.digest(v_payload, 'sha256'), 'hex');

    IF v_recomputed IS DISTINCT FROM r.entry_hash THEN
      broken_at_id := r.id; broken_at_seq := r.sequence_number;
      reason := 'entry_hash mismatch';
      RETURN NEXT;
    END IF;

    v_expected_prev := r.entry_hash;
  END LOOP;
  RETURN;
END;
$$;

-- Backfill existing rows so the chain is consistent from day one
DO $$
DECLARE
  r record;
  v_prev text := repeat('0', 64);
  v_payload text;
  v_hash text;
BEGIN
  FOR r IN SELECT * FROM public.audit_log ORDER BY sequence_number ASC, created_at ASC LOOP
    v_payload := v_prev
      || '|' || COALESCE(r.actor_id::text, '')
      || '|' || COALESCE(r.actor_email, '')
      || '|' || r.entity_type
      || '|' || COALESCE(r.entity_id::text, '')
      || '|' || r.action
      || '|' || COALESCE(r.details::text, '')
      || '|' || r.created_at::text;
    v_hash := encode(extensions.digest(v_payload, 'sha256'), 'hex');
    UPDATE public.audit_log SET prev_hash = v_prev, entry_hash = v_hash WHERE id = r.id;
    v_prev := v_hash;
  END LOOP;
END $$;
