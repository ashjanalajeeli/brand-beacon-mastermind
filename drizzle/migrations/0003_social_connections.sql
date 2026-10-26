CREATE TABLE public.oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('linkedin','meta')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.social_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('linkedin','facebook','instagram')),
  account_id text NOT NULL,
  account_name text NOT NULL DEFAULT '',
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform, account_id)
);

CREATE INDEX social_connections_user_idx ON public.social_connections (user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_connections TO authenticated;
GRANT ALL ON public.social_connections TO service_role;
ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own social connections" ON public.social_connections FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Delete own social connections" ON public.social_connections FOR DELETE TO authenticated USING (user_id = auth.uid());
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.oauth_states TO service_role;
