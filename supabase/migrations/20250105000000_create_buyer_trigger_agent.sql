-- Buyer Trigger Agent Database Schema
-- Self-serve onboarding system for discovering buyer timing signals

-- Onboarding Sessions
CREATE TABLE IF NOT EXISTS onboarding_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  company_name TEXT,
  website_url TEXT,
  industry TEXT,
  target_buyer TEXT,
  buyer_journey_stage TEXT,
  current_step INTEGER DEFAULT 1,
  completed BOOLEAN DEFAULT false,
  session_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Signal Configurations (what the user wants to track)
CREATE TABLE IF NOT EXISTS signal_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES onboarding_sessions(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL, -- 'hiring', 'funding', 'tech_adoption', 'leadership_change', etc.
  signal_description TEXT,
  priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high'
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Discovered Leads (companies matching the trigger criteria)
CREATE TABLE IF NOT EXISTS buyer_trigger_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES onboarding_sessions(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  domain TEXT,
  signal_matched TEXT[], -- Array of signal types that matched
  confidence_score NUMERIC(3,2), -- 0.00 to 1.00
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  contact_info JSONB DEFAULT '{}'::jsonb,
  enrichment_data JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'new' -- 'new', 'contacted', 'qualified', 'disqualified'
);

-- Signal Matches (specific instances of signals detected)
CREATE TABLE IF NOT EXISTS signal_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES buyer_trigger_leads(id) ON DELETE CASCADE,
  signal_config_id UUID REFERENCES signal_configurations(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,
  evidence_url TEXT,
  evidence_snippet TEXT,
  detected_at TIMESTAMPTZ,
  confidence_score NUMERIC(3,2),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Buyer Trigger Subscriptions (for ongoing monitoring)
CREATE TABLE IF NOT EXISTS buyer_trigger_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES onboarding_sessions(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  frequency TEXT DEFAULT 'daily', -- 'realtime', 'daily', 'weekly'
  active BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_email ON onboarding_sessions(email);
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_completed ON onboarding_sessions(completed);
CREATE INDEX IF NOT EXISTS idx_signal_configs_session ON signal_configurations(session_id);
CREATE INDEX IF NOT EXISTS idx_buyer_trigger_leads_session ON buyer_trigger_leads(session_id);
CREATE INDEX IF NOT EXISTS idx_buyer_trigger_leads_status ON buyer_trigger_leads(status);
CREATE INDEX IF NOT EXISTS idx_signal_matches_lead ON signal_matches(lead_id);
CREATE INDEX IF NOT EXISTS idx_signal_matches_config ON signal_matches(signal_config_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_session ON buyer_trigger_subscriptions(session_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON buyer_trigger_subscriptions(active);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_onboarding_sessions_updated_at BEFORE UPDATE ON onboarding_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_buyer_trigger_subscriptions_updated_at BEFORE UPDATE ON buyer_trigger_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE onboarding_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_trigger_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_trigger_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow public access for self-serve onboarding)
CREATE POLICY "Allow public insert on onboarding_sessions" ON onboarding_sessions
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow public read own sessions" ON onboarding_sessions
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow public update own sessions" ON onboarding_sessions
  FOR UPDATE TO anon USING (true);

CREATE POLICY "Allow public insert on signal_configurations" ON signal_configurations
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow public read signal_configurations" ON signal_configurations
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow public read buyer_trigger_leads" ON buyer_trigger_leads
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow public read signal_matches" ON signal_matches
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow public insert on buyer_trigger_subscriptions" ON buyer_trigger_subscriptions
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow public read buyer_trigger_subscriptions" ON buyer_trigger_subscriptions
  FOR SELECT TO anon USING (true);
