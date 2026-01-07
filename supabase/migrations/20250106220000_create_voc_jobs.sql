-- VoC Research Jobs table for async job tracking
-- This replaces in-memory job storage which doesn't work on serverless

CREATE TABLE IF NOT EXISTS public.voc_research_jobs (
  id text PRIMARY KEY,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  status_message text DEFAULT 'Queued',
  input jsonb NOT NULL DEFAULT '{}',
  result jsonb,
  error jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for querying recent jobs
CREATE INDEX IF NOT EXISTS idx_voc_jobs_created ON public.voc_research_jobs(created_at DESC);

-- Enable RLS
ALTER TABLE public.voc_research_jobs ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read/write jobs (for demo purposes)
-- In production, you'd want to restrict this
CREATE POLICY "Jobs are publicly accessible for demo"
  ON public.voc_research_jobs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Auto-cleanup old jobs (older than 24 hours)
-- This would need a cron job or scheduled function in production

