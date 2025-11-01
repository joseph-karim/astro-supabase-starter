/*
  # Create AEO (Answer Engine Optimization) Schema

  1. New Tables
    - `claims`
      - `id` (uuid, primary key)
      - `slug` (text, unique) - URL-friendly identifier
      - `h1` (text) - Main headline
      - `tl_dr` (text) - Summary description
      - `pull_quotes` (text[]) - Array of quotable statements
      - `proof_table` (jsonb) - Structured proof data
      - `csv_url` (text) - Link to downloadable dataset
      - `jsonld` (jsonb) - Schema.org structured data
      - `updated_at` (timestamptz) - Last modification timestamp
      - `published` (boolean) - Visibility flag
    
    - `tests`
      - `id` (uuid, primary key)
      - `claim_id` (uuid, foreign key) - Links to claims table
      - `engine` (text) - Answer engine name (perplexity, chatgpt, etc)
      - `query` (text) - Test query used
      - `appeared` (boolean) - Whether claim appeared in results
      - `cited` (boolean) - Whether claim was cited
      - `clickable` (boolean) - Whether citation was clickable
      - `screenshot_url` (text) - URL to screenshot evidence
      - `created_at` (timestamptz) - Test timestamp
    
    - `events`
      - `id` (uuid, primary key)
      - `claim_slug` (text) - Associated claim identifier
      - `referrer` (text) - HTTP referrer
      - `is_ai_referrer` (boolean) - Whether from AI engine
      - `page` (text) - Page path
      - `event_type` (text) - Event category (session, cta_view, cta_click, meeting_booked)
      - `meta` (jsonb) - Additional event metadata
      - `created_at` (timestamptz) - Event timestamp
    
    - `leads`
      - `id` (uuid, primary key)
      - `email` (text) - Contact email
      - `company` (text) - Company name
      - `icp` (jsonb) - Ideal customer profile data
      - `pains` (text[]) - Array of pain points
      - `proof_links` (text[]) - URLs to proof materials
      - `competitors` (text[]) - Competitor URLs
      - `created_at` (timestamptz) - Submission timestamp

  2. Security
    - Enable RLS on all tables
    - Claims: Public read for published claims only
    - Tests: Admin-only (no anon access)
    - Events: Anon insert allowed for tracking
    - Leads: Anon insert allowed for form submissions
*/

-- CLAIMS TABLE
CREATE TABLE IF NOT EXISTS public.claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  h1 text NOT NULL,
  tl_dr text NOT NULL,
  pull_quotes text[] NOT NULL DEFAULT '{}',
  proof_table jsonb,
  csv_url text,
  jsonld jsonb,
  updated_at timestamptz DEFAULT now(),
  published boolean DEFAULT false
);

-- TESTS TABLE
CREATE TABLE IF NOT EXISTS public.tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid REFERENCES public.claims(id) ON DELETE CASCADE,
  engine text NOT NULL,
  query text NOT NULL,
  appeared boolean DEFAULT false,
  cited boolean DEFAULT false,
  clickable boolean DEFAULT false,
  screenshot_url text,
  created_at timestamptz DEFAULT now()
);

-- EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_slug text NOT NULL,
  referrer text,
  is_ai_referrer boolean DEFAULT false,
  page text NOT NULL,
  event_type text NOT NULL,
  meta jsonb,
  created_at timestamptz DEFAULT now()
);

-- LEADS TABLE
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  company text,
  icp jsonb,
  pains text[] DEFAULT '{}',
  proof_links text[] DEFAULT '{}',
  competitors text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Claims: Public read for published claims
CREATE POLICY "Claims can be viewed by anyone when published"
  ON public.claims
  FOR SELECT
  USING (published = true);

-- Events: Anonymous users can insert tracking events
CREATE POLICY "Events can be inserted by anyone"
  ON public.events
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Leads: Anonymous users can submit leads
CREATE POLICY "Leads can be inserted by anyone"
  ON public.leads
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Tests: No anon policies (admin/service-role only)