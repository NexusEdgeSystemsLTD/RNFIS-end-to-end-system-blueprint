
-- ===== TRANSFERS TABLE =====
CREATE TABLE public.player_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  from_club_id uuid REFERENCES public.clubs(id),
  to_club_id uuid REFERENCES public.clubs(id),
  transfer_date date NOT NULL DEFAULT CURRENT_DATE,
  fee_amount numeric DEFAULT 0,
  notes text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.player_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transfers_select_all" ON public.player_transfers FOR SELECT TO authenticated USING (true);
CREATE POLICY "transfers_insert_admin" ON public.player_transfers FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ministry_admin'::app_role,'ferwafa_admin'::app_role]));
CREATE INDEX idx_transfers_player ON public.player_transfers(player_id);

-- ===== AUDIT TRIGGER =====
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_email text;
  v_entity_id uuid;
  v_action text;
BEGIN
  IF v_actor IS NOT NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = v_actor;
  END IF;
  IF TG_OP = 'INSERT' THEN
    v_action := 'create'; v_entity_id := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update'; v_entity_id := NEW.id;
  ELSE
    v_action := 'delete'; v_entity_id := OLD.id;
  END IF;
  INSERT INTO public.audit_log(actor_id, actor_email, entity_type, entity_id, action, details)
  VALUES (v_actor, v_email, TG_TABLE_NAME, v_entity_id, v_action,
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END);
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER audit_matches AFTER INSERT OR UPDATE OR DELETE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_match_events AFTER INSERT OR UPDATE OR DELETE ON public.match_events
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_discipline AFTER INSERT OR UPDATE OR DELETE ON public.discipline_records
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_var AFTER INSERT OR UPDATE OR DELETE ON public.var_reviews
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_transfers AFTER INSERT OR UPDATE OR DELETE ON public.player_transfers
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_clubs AFTER INSERT OR UPDATE OR DELETE ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_players AFTER INSERT OR UPDATE OR DELETE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
