-- Auto-suspension trigger for red cards
CREATE OR REPLACE FUNCTION public.handle_red_card_suspension()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case text;
  v_year int := EXTRACT(YEAR FROM now())::int;
BEGIN
  IF NEW.event_type IN ('red_card', 'second_yellow') AND NEW.player_id IS NOT NULL THEN
    v_case := 'DISC-' || v_year || '-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::text, 4, '0');

    INSERT INTO public.discipline_records(
      case_number, discipline_type, player_id, club_id, match_id,
      reason, suspension_matches, fine_amount, status, issued_by
    ) VALUES (
      v_case, 'suspension', NEW.player_id, NEW.club_id, NEW.match_id,
      'Auto-generated: ' || NEW.event_type || ' at minute ' || NEW.minute,
      1, 0, 'active', NEW.recorded_by
    );

    UPDATE public.players
    SET red_cards = COALESCE(red_cards, 0) + 1
    WHERE id = NEW.player_id;
  ELSIF NEW.event_type = 'yellow_card' AND NEW.player_id IS NOT NULL THEN
    UPDATE public.players
    SET yellow_cards = COALESCE(yellow_cards, 0) + 1
    WHERE id = NEW.player_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_red_card_suspension ON public.match_events;
CREATE TRIGGER trg_red_card_suspension
AFTER INSERT ON public.match_events
FOR EACH ROW EXECUTE FUNCTION public.handle_red_card_suspension();

-- Public (anon) read access for fan-facing page
CREATE POLICY "clubs_public_read" ON public.clubs FOR SELECT TO anon USING (true);
CREATE POLICY "matches_public_read" ON public.matches FOR SELECT TO anon USING (true);
CREATE POLICY "players_public_read" ON public.players FOR SELECT TO anon USING (true);
CREATE POLICY "match_events_public_read" ON public.match_events FOR SELECT TO anon USING (true);

-- Realtime
ALTER TABLE public.matches REPLICA IDENTITY FULL;
ALTER TABLE public.match_events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_events;