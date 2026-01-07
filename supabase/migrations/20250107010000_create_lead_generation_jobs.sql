-- Lead Generation Jobs table
-- Stores async job status for lead generation requests

CREATE TABLE IF NOT EXISTS public.lead_generation_jobs (
  id text PRIMARY KEY,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  status_message text DEFAULT 'Queued',
  input jsonb NOT NULL DEFAULT '{}',
  result jsonb,
  error jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_lead_gen_jobs_created ON public.lead_generation_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_gen_jobs_status ON public.lead_generation_jobs(status);

-- Enable RLS
ALTER TABLE public.lead_generation_jobs ENABLE ROW LEVEL SECURITY;

-- Public access for demo (in production, restrict to authenticated users)
CREATE POLICY "Lead generation jobs are publicly accessible"
  ON public.lead_generation_jobs
  FOR ALL
  USING (true)
  WITH CHECK (true);

