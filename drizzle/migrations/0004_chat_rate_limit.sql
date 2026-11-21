-- Per-user request log used to rate limit the AI chat endpoint.
-- Only the server (service role) can read or write it.
CREATE TABLE public.chat_rate_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_rate_events_user_created_idx ON public.chat_rate_events (user_id, created_at);
ALTER TABLE public.chat_rate_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_rate_events FROM anon, authenticated;
GRANT ALL ON public.chat_rate_events TO service_role;

-- Lock oauth_states down explicitly: the server writes it with the service role.
REVOKE ALL ON public.oauth_states FROM anon, authenticated;

-- Remove a user's plans when the user is deleted, like the other tables.
DELETE FROM public.execution_plans p WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.user_id);
ALTER TABLE public.execution_plans
  ADD CONSTRAINT execution_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
