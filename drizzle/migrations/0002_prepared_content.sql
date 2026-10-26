CREATE TABLE public.prepared_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.execution_plans(id) ON DELETE CASCADE,
  content text NOT NULL,
  platforms text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'prepared' CHECK (status IN ('prepared','published')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX prepared_content_user_created_idx ON public.prepared_content (user_id, created_at);
GRANT SELECT, INSERT ON public.prepared_content TO authenticated;
GRANT ALL ON public.prepared_content TO service_role;
ALTER TABLE public.prepared_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own prepared content" ON public.prepared_content FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Create own prepared content" ON public.prepared_content FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
