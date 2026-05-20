
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('ministry_admin','ferwafa_admin','club_official','referee','var_officer','public_viewer');
CREATE TYPE public.match_status AS ENUM ('scheduled','live','halftime','completed','postponed','abandoned');
CREATE TYPE public.match_event_type AS ENUM ('goal','own_goal','penalty_goal','penalty_miss','yellow_card','red_card','second_yellow','substitution','var_review','injury','offside','foul','kickoff','halftime','fulltime');
CREATE TYPE public.discipline_type AS ENUM ('warning','fine','suspension','ban','probation');
CREATE TYPE public.discipline_status AS ENUM ('pending','active','served','appealed','overturned');
CREATE TYPE public.var_outcome AS ENUM ('goal_awarded','goal_disallowed','penalty_awarded','penalty_overturned','red_card_issued','no_action','inconclusive');
CREATE TYPE public.player_position AS ENUM ('GK','DEF','MID','FWD');
CREATE TYPE public.referee_level AS ENUM ('national','elite','caf','fifa');

-- TABLES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT, club_id UUID, avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL, assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(user_id, role)
);

CREATE TABLE public.clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, short_code TEXT NOT NULL UNIQUE,
  division TEXT NOT NULL DEFAULT 'Premier League', founded_year INTEGER,
  home_stadium TEXT, city TEXT, logo_url TEXT, primary_color TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_club_fk FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE SET NULL;

CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL, date_of_birth DATE NOT NULL, nationality TEXT NOT NULL DEFAULT 'Rwanda',
  jersey_number INTEGER, position public.player_position NOT NULL,
  club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
  license_number TEXT UNIQUE, license_active BOOLEAN NOT NULL DEFAULT true,
  appearances INTEGER NOT NULL DEFAULT 0, goals INTEGER NOT NULL DEFAULT 0,
  yellow_cards INTEGER NOT NULL DEFAULT 0, red_cards INTEGER NOT NULL DEFAULT 0, photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.referees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL, license_number TEXT NOT NULL UNIQUE,
  level public.referee_level NOT NULL DEFAULT 'national', specialization TEXT,
  active BOOLEAN NOT NULL DEFAULT true, matches_officiated INTEGER NOT NULL DEFAULT 0,
  performance_rating NUMERIC(3,2) DEFAULT 7.50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_code TEXT NOT NULL UNIQUE, competition TEXT NOT NULL DEFAULT 'Rwanda Premier League', matchday INTEGER,
  home_club_id UUID NOT NULL REFERENCES public.clubs(id),
  away_club_id UUID NOT NULL REFERENCES public.clubs(id),
  kickoff_at TIMESTAMPTZ NOT NULL, venue TEXT NOT NULL,
  referee_id UUID REFERENCES public.referees(id), var_officer_id UUID REFERENCES auth.users(id),
  status public.match_status NOT NULL DEFAULT 'scheduled',
  home_score INTEGER NOT NULL DEFAULT 0, away_score INTEGER NOT NULL DEFAULT 0,
  current_minute INTEGER NOT NULL DEFAULT 0, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (home_club_id <> away_club_id)
);

CREATE TABLE public.match_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  minute INTEGER NOT NULL, event_type public.match_event_type NOT NULL,
  club_id UUID REFERENCES public.clubs(id),
  player_id UUID REFERENCES public.players(id),
  secondary_player_id UUID REFERENCES public.players(id),
  notes TEXT, recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.discipline_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number TEXT NOT NULL UNIQUE,
  player_id UUID REFERENCES public.players(id),
  referee_id UUID REFERENCES public.referees(id),
  club_id UUID REFERENCES public.clubs(id),
  match_id UUID REFERENCES public.matches(id),
  discipline_type public.discipline_type NOT NULL, reason TEXT NOT NULL,
  suspension_matches INTEGER DEFAULT 0, fine_amount NUMERIC(12,2) DEFAULT 0,
  status public.discipline_status NOT NULL DEFAULT 'pending',
  issued_by UUID REFERENCES auth.users(id), issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_until DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.var_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  minute INTEGER NOT NULL, incident_type TEXT NOT NULL, on_field_decision TEXT,
  outcome public.var_outcome NOT NULL, reviewed_by UUID REFERENCES auth.users(id),
  duration_seconds INTEGER, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id), actor_email TEXT,
  action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id UUID,
  details JSONB, ip_address TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_players_club ON public.players(club_id);
CREATE INDEX idx_matches_kickoff ON public.matches(kickoff_at DESC);
CREATE INDEX idx_matches_status ON public.matches(status);
CREATE INDEX idx_match_events_match ON public.match_events(match_id, minute);
CREATE INDEX idx_discipline_status ON public.discipline_records(status);
CREATE INDEX idx_audit_actor ON public.audit_log(actor_id);
CREATE INDEX idx_audit_created ON public.audit_log(created_at DESC);

-- ROLE FUNCTIONS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles public.app_role[])
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles))
$$;

-- TIMESTAMP TRIGGER
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_clubs_updated BEFORE UPDATE ON public.clubs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_players_updated BEFORE UPDATE ON public.players FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_referees_updated BEFORE UPDATE ON public.referees FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_matches_updated BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_discipline_updated BEFORE UPDATE ON public.discipline_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- AUTO PROFILE + BOOTSTRAP ADMIN
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.email);

  IF NEW.email = 'nkernest666@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'ministry_admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'public_viewer') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discipline_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.var_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_any_role(auth.uid(), ARRAY['ministry_admin','ferwafa_admin']::public.app_role[]));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'ministry_admin'));
CREATE POLICY "user_roles_insert_admin" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'ministry_admin'));
CREATE POLICY "user_roles_delete_admin" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'ministry_admin'));

CREATE POLICY "clubs_select_all" ON public.clubs FOR SELECT TO authenticated USING (true);
CREATE POLICY "clubs_insert_admin" ON public.clubs FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ministry_admin','ferwafa_admin']::public.app_role[]));
CREATE POLICY "clubs_update_admin" ON public.clubs FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['ministry_admin','ferwafa_admin']::public.app_role[]));
CREATE POLICY "clubs_delete_admin" ON public.clubs FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'ministry_admin'));

CREATE POLICY "players_select_all" ON public.players FOR SELECT TO authenticated USING (true);
CREATE POLICY "players_insert_admin" ON public.players FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ministry_admin','ferwafa_admin']::public.app_role[]));
CREATE POLICY "players_update_admin" ON public.players FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['ministry_admin','ferwafa_admin']::public.app_role[]));
CREATE POLICY "players_delete_admin" ON public.players FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'ministry_admin'));

CREATE POLICY "referees_select_all" ON public.referees FOR SELECT TO authenticated USING (true);
CREATE POLICY "referees_insert_admin" ON public.referees FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ministry_admin','ferwafa_admin']::public.app_role[]));
CREATE POLICY "referees_update_admin" ON public.referees FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['ministry_admin','ferwafa_admin']::public.app_role[]));
CREATE POLICY "referees_delete_admin" ON public.referees FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'ministry_admin'));

CREATE POLICY "matches_select_all" ON public.matches FOR SELECT TO authenticated USING (true);
CREATE POLICY "matches_insert_admin" ON public.matches FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ministry_admin','ferwafa_admin']::public.app_role[]));
CREATE POLICY "matches_update_admin_or_official" ON public.matches FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['ministry_admin','ferwafa_admin','referee','var_officer']::public.app_role[]));
CREATE POLICY "matches_delete_admin" ON public.matches FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'ministry_admin'));

CREATE POLICY "events_select_all" ON public.match_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "events_insert_official" ON public.match_events FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ministry_admin','ferwafa_admin','referee','var_officer']::public.app_role[]));
CREATE POLICY "events_update_admin" ON public.match_events FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['ministry_admin','ferwafa_admin']::public.app_role[]));
CREATE POLICY "events_delete_admin" ON public.match_events FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'ministry_admin'));

CREATE POLICY "discipline_select_all" ON public.discipline_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "discipline_insert_admin" ON public.discipline_records FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ministry_admin','ferwafa_admin']::public.app_role[]));
CREATE POLICY "discipline_update_admin" ON public.discipline_records FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['ministry_admin','ferwafa_admin']::public.app_role[]));
CREATE POLICY "discipline_delete_admin" ON public.discipline_records FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'ministry_admin'));

CREATE POLICY "var_select_all" ON public.var_reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "var_insert_official" ON public.var_reviews FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['ministry_admin','ferwafa_admin','var_officer','referee']::public.app_role[]));
CREATE POLICY "var_update_admin" ON public.var_reviews FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['ministry_admin','ferwafa_admin']::public.app_role[]));

CREATE POLICY "audit_select_admin" ON public.audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ministry_admin') OR auth.uid() = actor_id);
CREATE POLICY "audit_insert_any_authenticated" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = actor_id);

-- SEED CLUBS
INSERT INTO public.clubs (name, short_code, founded_year, home_stadium, city, primary_color) VALUES
('APR FC','APR',1986,'Kigali Pele Stadium','Kigali','#0046AD'),
('Rayon Sports','RAY',1965,'Kigali Pele Stadium','Kigali','#00A859'),
('Police FC','POL',1968,'Kigali Pele Stadium','Kigali','#1A1A6C'),
('AS Kigali','ASK',2002,'Kigali Pele Stadium','Kigali','#E30613'),
('Mukura Victory','MUK',1965,'Huye Stadium','Huye','#FFCC00'),
('Etincelles FC','ETI',1980,'Umuganda Stadium','Rubavu','#FF6600'),
('Bugesera FC','BUG',2010,'Nyamata Stadium','Bugesera','#00B5E2'),
('Kiyovu Sports','KIY',1968,'Kigali Pele Stadium','Kigali','#7B1FA2');

-- SEED PLAYERS (with explicit DATE casts)
INSERT INTO public.players (full_name, date_of_birth, jersey_number, position, club_id, license_number, appearances, goals, yellow_cards) VALUES
('Jacques Tuyisenge', DATE '1993-02-12', 9, 'FWD', (SELECT id FROM public.clubs WHERE short_code='APR'), 'RWA-2024-0001', 24, 12, 3),
('Olivier Niyonzima', DATE '1996-05-08', 1, 'GK', (SELECT id FROM public.clubs WHERE short_code='APR'), 'RWA-2024-0002', 23, 0, 1),
('Yannick Mukunzi', DATE '1995-09-21', 10, 'MID', (SELECT id FROM public.clubs WHERE short_code='RAY'), 'RWA-2024-0003', 22, 7, 4),
('Eric Rutanga', DATE '1994-04-15', 4, 'DEF', (SELECT id FROM public.clubs WHERE short_code='RAY'), 'RWA-2024-0004', 24, 1, 5),
('Djihad Bizimana', DATE '1997-08-18', 8, 'MID', (SELECT id FROM public.clubs WHERE short_code='POL'), 'RWA-2024-0005', 21, 4, 2),
('Eric Ndayishimiye', DATE '1995-11-30', 5, 'DEF', (SELECT id FROM public.clubs WHERE short_code='POL'), 'RWA-2024-0006', 23, 2, 3),
('Bonfils Kayitare', DATE '1994-07-14', 11, 'FWD', (SELECT id FROM public.clubs WHERE short_code='ASK'), 'RWA-2024-0007', 22, 9, 2),
('Ramadhan Niyongabire', DATE '1996-03-22', 2, 'DEF', (SELECT id FROM public.clubs WHERE short_code='ASK'), 'RWA-2024-0008', 24, 0, 4),
('Jean Niyo', DATE '1998-01-10', 7, 'MID', (SELECT id FROM public.clubs WHERE short_code='MUK'), 'RWA-2024-0009', 20, 3, 1),
('Patrick Mwizerwa', DATE '1995-06-25', 9, 'FWD', (SELECT id FROM public.clubs WHERE short_code='MUK'), 'RWA-2024-0010', 22, 8, 3),
('Innocent Habyarimana', DATE '1997-12-05', 10, 'MID', (SELECT id FROM public.clubs WHERE short_code='ETI'), 'RWA-2024-0011', 19, 5, 2),
('Jean-Bosco Ruboneka', DATE '1996-04-18', 3, 'DEF', (SELECT id FROM public.clubs WHERE short_code='ETI'), 'RWA-2024-0012', 21, 1, 3),
('Thierry Manzi', DATE '1998-09-09', 6, 'MID', (SELECT id FROM public.clubs WHERE short_code='BUG'), 'RWA-2024-0013', 20, 2, 4),
('Kevin Muhire', DATE '1999-02-14', 9, 'FWD', (SELECT id FROM public.clubs WHERE short_code='BUG'), 'RWA-2024-0014', 18, 6, 1),
('Ange Mutsinzi', DATE '1997-07-07', 8, 'MID', (SELECT id FROM public.clubs WHERE short_code='KIY'), 'RWA-2024-0015', 21, 4, 2),
('Fitina Omborenga', DATE '1996-10-29', 1, 'GK', (SELECT id FROM public.clubs WHERE short_code='KIY'), 'RWA-2024-0016', 22, 0, 1);

-- SEED REFEREES
INSERT INTO public.referees (full_name, license_number, level, specialization, matches_officiated, performance_rating) VALUES
('Samuel Uwikunda','REF-RWA-001','fifa','Centre Referee',127,8.4),
('Jean-Claude Ishimwe','REF-RWA-002','caf','Centre Referee',98,7.9),
('Marie-Claire Mukamana','REF-RWA-003','elite','Assistant Referee',64,8.1),
('Eric Bizimungu','REF-RWA-004','national','Centre Referee',42,7.6);

-- SEED MATCHES
INSERT INTO public.matches (match_code, matchday, home_club_id, away_club_id, kickoff_at, venue, referee_id, status, home_score, away_score, current_minute) VALUES
('RPL-2025-021', 21, (SELECT id FROM public.clubs WHERE short_code='APR'), (SELECT id FROM public.clubs WHERE short_code='RAY'), now() - interval '7 days', 'Kigali Pele Stadium', (SELECT id FROM public.referees WHERE license_number='REF-RWA-001'), 'completed', 2, 1, 90),
('RPL-2025-022', 21, (SELECT id FROM public.clubs WHERE short_code='POL'), (SELECT id FROM public.clubs WHERE short_code='ASK'), now() - interval '6 days', 'Kigali Pele Stadium', (SELECT id FROM public.referees WHERE license_number='REF-RWA-002'), 'completed', 1, 1, 90),
('RPL-2025-023', 22, (SELECT id FROM public.clubs WHERE short_code='MUK'), (SELECT id FROM public.clubs WHERE short_code='ETI'), now() - interval '3 days', 'Huye Stadium', (SELECT id FROM public.referees WHERE license_number='REF-RWA-004'), 'completed', 3, 0, 90),
('RPL-2025-024', 22, (SELECT id FROM public.clubs WHERE short_code='BUG'), (SELECT id FROM public.clubs WHERE short_code='KIY'), now() - interval '45 minutes', 'Nyamata Stadium', (SELECT id FROM public.referees WHERE license_number='REF-RWA-003'), 'live', 1, 0, 38),
('RPL-2025-025', 23, (SELECT id FROM public.clubs WHERE short_code='APR'), (SELECT id FROM public.clubs WHERE short_code='POL'), now() + interval '2 days', 'Kigali Pele Stadium', (SELECT id FROM public.referees WHERE license_number='REF-RWA-001'), 'scheduled', 0, 0, 0),
('RPL-2025-026', 23, (SELECT id FROM public.clubs WHERE short_code='RAY'), (SELECT id FROM public.clubs WHERE short_code='MUK'), now() + interval '5 days', 'Kigali Pele Stadium', (SELECT id FROM public.referees WHERE license_number='REF-RWA-002'), 'scheduled', 0, 0, 0);

-- EVENTS for live match
INSERT INTO public.match_events (match_id, minute, event_type, club_id, player_id, notes) VALUES
((SELECT id FROM public.matches WHERE match_code='RPL-2025-024'), 0, 'kickoff', NULL, NULL, 'Match started'),
((SELECT id FROM public.matches WHERE match_code='RPL-2025-024'), 14, 'yellow_card', (SELECT id FROM public.clubs WHERE short_code='BUG'), (SELECT id FROM public.players WHERE license_number='RWA-2024-0014'), 'Tactical foul'),
((SELECT id FROM public.matches WHERE match_code='RPL-2025-024'), 27, 'goal', (SELECT id FROM public.clubs WHERE short_code='BUG'), (SELECT id FROM public.players WHERE license_number='RWA-2024-0014'), 'Right-foot finish');

-- EVENTS for completed APR vs RAY
INSERT INTO public.match_events (match_id, minute, event_type, club_id, player_id, notes) VALUES
((SELECT id FROM public.matches WHERE match_code='RPL-2025-021'), 0, 'kickoff', NULL, NULL, 'Kickoff'),
((SELECT id FROM public.matches WHERE match_code='RPL-2025-021'), 23, 'goal', (SELECT id FROM public.clubs WHERE short_code='APR'), (SELECT id FROM public.players WHERE license_number='RWA-2024-0001'), 'Header from corner'),
((SELECT id FROM public.matches WHERE match_code='RPL-2025-021'), 56, 'goal', (SELECT id FROM public.clubs WHERE short_code='RAY'), (SELECT id FROM public.players WHERE license_number='RWA-2024-0003'), 'Long-range strike'),
((SELECT id FROM public.matches WHERE match_code='RPL-2025-021'), 78, 'penalty_goal', (SELECT id FROM public.clubs WHERE short_code='APR'), (SELECT id FROM public.players WHERE license_number='RWA-2024-0001'), 'Penalty'),
((SELECT id FROM public.matches WHERE match_code='RPL-2025-021'), 90, 'fulltime', NULL, NULL, 'Full time');

-- DISCIPLINE
INSERT INTO public.discipline_records (case_number, player_id, club_id, discipline_type, reason, suspension_matches, status)
VALUES ('RNFIS-DISC-2025-001', (SELECT id FROM public.players WHERE license_number='RWA-2024-0014'), (SELECT id FROM public.clubs WHERE short_code='BUG'), 'warning', 'Accumulation of 4 yellow cards', 0, 'active');
