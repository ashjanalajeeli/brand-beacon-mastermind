ALTER TABLE public.briefs ADD COLUMN competitor_scope text NOT NULL DEFAULT 'domestic' CHECK (competitor_scope IN ('domestic','international')), ADD COLUMN paid_ads boolean NOT NULL DEFAULT false, ADD COLUMN platforms text[] NOT NULL DEFAULT '{}', ADD COLUMN competitor_links text NOT NULL DEFAULT '';
CREATE TABLE public.execution_plans (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, content text NOT NULL, platforms text[] NOT NULL DEFAULT '{}', paid_ads boolean NOT NULL DEFAULT false, approved_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT ON public.execution_plans TO authenticated;
GRANT ALL ON public.execution_plans TO service_role;
ALTER TABLE public.execution_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own approved plans" ON public.execution_plans FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Approve own plans" ON public.execution_plans FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());