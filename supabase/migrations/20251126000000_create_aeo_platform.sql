/*
  # AEO Platform Schema
  
  Complete schema for the Become the Answer client portal:
  - Client management
  - Decision query tracking
  - AI visibility snapshots
  - PDP audits
  - Feed validations
  - Off-site authority tracking
  - Agentic commerce status
*/

-- ============================================================================
-- CLIENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  domain text NOT NULL,
  shopify_store_url text,
  logo_url text,
  tier text DEFAULT 'starter' CHECK (tier IN ('starter', 'growth', 'pro', 'enterprise')),
  settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  active boolean DEFAULT true
);

CREATE INDEX idx_clients_user ON public.clients(user_id);
CREATE INDEX idx_clients_domain ON public.clients(domain);

-- ============================================================================
-- DECISION QUERIES (Decision Query Map)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.decision_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  query text NOT NULL,
  cluster text,
  tags text[] DEFAULT '{}',
  volume_estimate integer,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status text DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_queries_client ON public.decision_queries(client_id);
CREATE INDEX idx_queries_cluster ON public.decision_queries(client_id, cluster);

-- ============================================================================
-- AI VISIBILITY SNAPSHOTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.visibility_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  date date NOT NULL,
  share_of_answer numeric(5,2),
  brand_mentions integer DEFAULT 0,
  competitor_mentions jsonb DEFAULT '{}',
  platforms_data jsonb DEFAULT '{}',
  query_results jsonb DEFAULT '[]',
  raw_data jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_id, date)
);

CREATE INDEX idx_visibility_client_date ON public.visibility_snapshots(client_id, date DESC);

-- ============================================================================
-- AI CITATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.citations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  query_id uuid REFERENCES public.decision_queries(id) ON DELETE SET NULL,
  platform text NOT NULL CHECK (platform IN ('chatgpt', 'perplexity', 'claude', 'gemini', 'google_aio')),
  query_text text,
  cited_domain text,
  cited_url text,
  brand_mentioned boolean DEFAULT false,
  position integer,
  response_snippet text,
  screenshot_url text,
  tested_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_citations_client ON public.citations(client_id);
CREATE INDEX idx_citations_platform ON public.citations(client_id, platform);
CREATE INDEX idx_citations_query ON public.citations(query_id);

-- ============================================================================
-- PDP AUDITS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.pdp_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  url text NOT NULL,
  product_title text,
  overall_score numeric(5,2),
  schema_score numeric(5,2),
  extractability_score numeric(5,2),
  feed_alignment_score numeric(5,2),
  
  -- Schema details
  has_product_schema boolean DEFAULT false,
  has_offer_schema boolean DEFAULT false,
  has_faq_schema boolean DEFAULT false,
  has_review_schema boolean DEFAULT false,
  schema_issues text[] DEFAULT '{}',
  detected_schema jsonb,
  
  -- Content details
  has_spec_table boolean DEFAULT false,
  has_short_claims boolean DEFAULT false,
  has_comparison boolean DEFAULT false,
  extractability_issues text[] DEFAULT '{}',
  detected_claims text[] DEFAULT '{}',
  
  -- Recommendations
  recommendations jsonb DEFAULT '[]',
  
  audited_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_pdp_audits_client ON public.pdp_audits(client_id);
CREATE INDEX idx_pdp_audits_score ON public.pdp_audits(client_id, overall_score);

-- ============================================================================
-- FEED VALIDATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.feed_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  feed_type text NOT NULL CHECK (feed_type IN ('shopify', 'gmc', 'acp', 'custom')),
  feed_url text,
  total_products integer DEFAULT 0,
  valid_products integer DEFAULT 0,
  acp_readiness_score numeric(5,2),
  shopping_optimization_score numeric(5,2),
  
  -- Field coverage
  required_field_coverage jsonb DEFAULT '{}',
  recommended_field_coverage jsonb DEFAULT '{}',
  
  -- Issues
  critical_issues text[] DEFAULT '{}',
  warnings text[] DEFAULT '{}',
  product_issues jsonb DEFAULT '[]',
  
  validated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_feed_validations_client ON public.feed_validations(client_id);

-- ============================================================================
-- OFF-SITE MENTIONS (Authority Tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.offsite_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('reddit', 'youtube', 'blog', 'review_site', 'forum', 'social')),
  platform text,
  url text NOT NULL,
  title text,
  author text,
  sentiment text CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  engagement jsonb DEFAULT '{}',
  products_mentioned text[] DEFAULT '{}',
  is_ai_cited boolean DEFAULT false,
  content_snippet text,
  discovered_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_offsite_client ON public.offsite_mentions(client_id);
CREATE INDEX idx_offsite_source ON public.offsite_mentions(client_id, source);
CREATE INDEX idx_offsite_cited ON public.offsite_mentions(client_id, is_ai_cited);

-- ============================================================================
-- AGENTIC COMMERCE STATUS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.agentic_commerce_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE UNIQUE,
  
  -- ChatGPT / OpenAI
  chatgpt_shopping_visible boolean DEFAULT false,
  chatgpt_instant_checkout boolean DEFAULT false,
  acp_feed_submitted boolean DEFAULT false,
  acp_feed_approved boolean DEFAULT false,
  
  -- Perplexity
  perplexity_merchant_applied boolean DEFAULT false,
  perplexity_merchant_approved boolean DEFAULT false,
  perplexity_buy_enabled boolean DEFAULT false,
  
  -- Stripe
  stripe_acp_enabled boolean DEFAULT false,
  
  -- Metadata
  notes text,
  last_checked timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_agentic_client ON public.agentic_commerce_status(client_id);

-- ============================================================================
-- COMPETITORS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.competitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  domain text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_competitors_client ON public.competitors(client_id);

-- ============================================================================
-- ACTIVITY LOG
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_activity_client ON public.activity_log(client_id, created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visibility_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdp_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offsite_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agentic_commerce_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Clients: Users can only see their own clients
CREATE POLICY "Users can view own clients"
  ON public.clients FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own clients"
  ON public.clients FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own clients"
  ON public.clients FOR UPDATE
  USING (auth.uid() = user_id);

-- All other tables: Access through client ownership
CREATE POLICY "Users can view own decision_queries"
  ON public.decision_queries FOR SELECT
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage own decision_queries"
  ON public.decision_queries FOR ALL
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE POLICY "Users can view own visibility_snapshots"
  ON public.visibility_snapshots FOR SELECT
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE POLICY "Users can view own citations"
  ON public.citations FOR SELECT
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE POLICY "Users can view own pdp_audits"
  ON public.pdp_audits FOR SELECT
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE POLICY "Users can view own feed_validations"
  ON public.feed_validations FOR SELECT
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE POLICY "Users can view own offsite_mentions"
  ON public.offsite_mentions FOR SELECT
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE POLICY "Users can view own agentic_commerce_status"
  ON public.agentic_commerce_status FOR SELECT
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE POLICY "Users can view own competitors"
  ON public.competitors FOR SELECT
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage own competitors"
  ON public.competitors FOR ALL
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE POLICY "Users can view own activity_log"
  ON public.activity_log FOR SELECT
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to get client dashboard summary
CREATE OR REPLACE FUNCTION get_client_dashboard(p_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  latest_visibility record;
  pdp_stats record;
  agentic_status record;
  authority_score numeric;
BEGIN
  -- Get latest visibility snapshot
  SELECT * INTO latest_visibility
  FROM public.visibility_snapshots
  WHERE client_id = p_client_id
  ORDER BY date DESC
  LIMIT 1;
  
  -- Get PDP audit stats
  SELECT 
    COUNT(*) as total_pdps,
    AVG(overall_score) as avg_score,
    SUM(CASE WHEN has_product_schema THEN 1 ELSE 0 END) as with_schema,
    SUM(CASE WHEN has_faq_schema THEN 1 ELSE 0 END) as with_faq
  INTO pdp_stats
  FROM public.pdp_audits
  WHERE client_id = p_client_id;
  
  -- Get agentic commerce status
  SELECT * INTO agentic_status
  FROM public.agentic_commerce_status
  WHERE client_id = p_client_id;
  
  -- Calculate authority score (simple version)
  SELECT COALESCE(
    (COUNT(*) FILTER (WHERE sentiment = 'positive') * 2 +
     COUNT(*) FILTER (WHERE sentiment = 'neutral') +
     COUNT(*) FILTER (WHERE is_ai_cited) * 3) / NULLIF(COUNT(*), 0) * 10,
    0
  ) INTO authority_score
  FROM public.offsite_mentions
  WHERE client_id = p_client_id;
  
  result := jsonb_build_object(
    'ai_visibility', jsonb_build_object(
      'share_of_answer', COALESCE(latest_visibility.share_of_answer, 0),
      'brand_mentions', COALESCE(latest_visibility.brand_mentions, 0),
      'last_updated', latest_visibility.date
    ),
    'pdp_health', jsonb_build_object(
      'total_pdps', COALESCE(pdp_stats.total_pdps, 0),
      'avg_score', COALESCE(pdp_stats.avg_score, 0),
      'with_schema', COALESCE(pdp_stats.with_schema, 0),
      'with_faq', COALESCE(pdp_stats.with_faq, 0)
    ),
    'agentic_readiness', jsonb_build_object(
      'chatgpt_ready', COALESCE(agentic_status.chatgpt_instant_checkout, false),
      'perplexity_ready', COALESCE(agentic_status.perplexity_buy_enabled, false),
      'feed_compliant', COALESCE(agentic_status.acp_feed_approved, false)
    ),
    'authority_score', COALESCE(authority_score, 0)
  );
  
  RETURN result;
END;
$$;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER decision_queries_updated_at
  BEFORE UPDATE ON public.decision_queries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER agentic_commerce_status_updated_at
  BEFORE UPDATE ON public.agentic_commerce_status
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();




