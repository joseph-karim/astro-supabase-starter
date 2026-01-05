-- Buyer Trigger Agent: Self-Serve Onboarding System
-- Database Schema

-- Onboarding sessions table
CREATE TABLE IF NOT EXISTS onboarding_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_url TEXT NOT NULL,
    email TEXT,
    status TEXT NOT NULL DEFAULT 'crawling' CHECK (status IN ('crawling', 'analyzing', 'configuring', 'searching', 'complete', 'error')),

    -- Extracted business profile from website
    business_profile JSONB,

    -- User-provided context through conversation
    user_inputs JSONB DEFAULT '{}'::jsonb,

    -- Generated configuration
    trigger_configs JSONB DEFAULT '[]'::jsonb,
    icp_criteria JSONB,

    -- Results
    lead_results JSONB DEFAULT '[]'::jsonb,
    lead_count INTEGER DEFAULT 0,

    -- Progress tracking
    milestones JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,

    -- Conversion tracking
    converted_to_trial TIMESTAMPTZ,
    converted_to_paid TIMESTAMPTZ,
    booked_call TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Signal configurations table (for paid subscribers)
CREATE TABLE IF NOT EXISTS signal_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Signal definition
    signal_type TEXT NOT NULL,
    signal_name TEXT NOT NULL,
    signal_description TEXT,

    -- Technical configuration
    sources TEXT[] NOT NULL DEFAULT '{}',
    query_params JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Timing
    lookback_days INTEGER DEFAULT 90,
    refresh_frequency TEXT DEFAULT 'daily' CHECK (refresh_frequency IN ('daily', 'weekly')),

    -- Scoring
    scoring_weight INTEGER DEFAULT 5 CHECK (scoring_weight BETWEEN 1 AND 10),

    -- Status
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES onboarding_sessions(id) ON DELETE CASCADE,
    client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Company info
    company_name TEXT NOT NULL,
    company_domain TEXT,
    company_linkedin_url TEXT,
    industry TEXT,
    employee_count INTEGER,
    revenue_estimate TEXT,
    location TEXT,

    -- Signal matches
    signals JSONB DEFAULT '[]'::jsonb,
    composite_score INTEGER DEFAULT 0 CHECK (composite_score BETWEEN 0 AND 100),

    -- Contacts
    contacts JSONB DEFAULT '[]'::jsonb,

    -- Status tracking
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'viewed', 'contacted', 'qualified', 'disqualified')),

    -- Timestamps
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Signal matches table (individual detections)
CREATE TABLE IF NOT EXISTS signal_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    signal_config_id UUID REFERENCES signal_configurations(id) ON DELETE CASCADE,

    -- Match details
    signal_type TEXT NOT NULL,
    source TEXT NOT NULL,
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Scoring
    raw_score INTEGER DEFAULT 0,
    decayed_score INTEGER DEFAULT 0,

    -- Timing
    signal_date TIMESTAMPTZ,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Subscription tracking table
CREATE TABLE IF NOT EXISTS buyer_trigger_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES onboarding_sessions(id),

    -- Subscription details
    plan TEXT NOT NULL CHECK (plan IN ('starter', 'growth', 'enterprise')),
    status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'canceled', 'past_due')),

    -- Stripe integration
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,

    -- Dates
    trial_ends_at TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_status ON onboarding_sessions(status);
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_email ON onboarding_sessions(email);
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_created_at ON onboarding_sessions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_signal_configurations_client_id ON signal_configurations(client_id);
CREATE INDEX IF NOT EXISTS idx_signal_configurations_is_active ON signal_configurations(is_active);

CREATE INDEX IF NOT EXISTS idx_leads_session_id ON leads(session_id);
CREATE INDEX IF NOT EXISTS idx_leads_client_id ON leads(client_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_composite_score ON leads(composite_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_detected_at ON leads(detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_signal_matches_lead_id ON signal_matches(lead_id);
CREATE INDEX IF NOT EXISTS idx_signal_matches_signal_config_id ON signal_matches(signal_config_id);

CREATE INDEX IF NOT EXISTS idx_buyer_trigger_subscriptions_user_id ON buyer_trigger_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_buyer_trigger_subscriptions_status ON buyer_trigger_subscriptions(status);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_onboarding_sessions_updated_at BEFORE UPDATE ON onboarding_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_signal_configurations_updated_at BEFORE UPDATE ON signal_configurations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_buyer_trigger_subscriptions_updated_at BEFORE UPDATE ON buyer_trigger_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE onboarding_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_trigger_subscriptions ENABLE ROW LEVEL SECURITY;

-- Onboarding sessions: public can create, only owner can read
CREATE POLICY "Anyone can create onboarding sessions"
    ON onboarding_sessions FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can view their own sessions by email"
    ON onboarding_sessions FOR SELECT
    USING (email = auth.jwt() ->> 'email' OR auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Users can update their own sessions"
    ON onboarding_sessions FOR UPDATE
    USING (email = auth.jwt() ->> 'email' OR auth.jwt() ->> 'role' = 'service_role');

-- Signal configurations: only owner can manage
CREATE POLICY "Users can view their own signal configs"
    ON signal_configurations FOR SELECT
    USING (client_id = auth.uid() OR auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Users can create their own signal configs"
    ON signal_configurations FOR INSERT
    WITH CHECK (client_id = auth.uid() OR auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Users can update their own signal configs"
    ON signal_configurations FOR UPDATE
    USING (client_id = auth.uid() OR auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Users can delete their own signal configs"
    ON signal_configurations FOR DELETE
    USING (client_id = auth.uid() OR auth.jwt() ->> 'role' = 'service_role');

-- Leads: users can only see their own leads
CREATE POLICY "Users can view their own leads"
    ON leads FOR SELECT
    USING (client_id = auth.uid() OR auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "System can create leads"
    ON leads FOR INSERT
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Users can update their own leads"
    ON leads FOR UPDATE
    USING (client_id = auth.uid() OR auth.jwt() ->> 'role' = 'service_role');

-- Signal matches: inherit from leads
CREATE POLICY "Users can view signal matches for their leads"
    ON signal_matches FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM leads
            WHERE leads.id = signal_matches.lead_id
            AND (leads.client_id = auth.uid() OR auth.jwt() ->> 'role' = 'service_role')
        )
    );

CREATE POLICY "System can create signal matches"
    ON signal_matches FOR INSERT
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Subscriptions: only owner can view
CREATE POLICY "Users can view their own subscription"
    ON buyer_trigger_subscriptions FOR SELECT
    USING (user_id = auth.uid() OR auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "System can manage subscriptions"
    ON buyer_trigger_subscriptions FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Grant permissions
GRANT ALL ON onboarding_sessions TO service_role;
GRANT ALL ON signal_configurations TO service_role;
GRANT ALL ON leads TO service_role;
GRANT ALL ON signal_matches TO service_role;
GRANT ALL ON buyer_trigger_subscriptions TO service_role;

GRANT SELECT, INSERT, UPDATE ON onboarding_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON signal_configurations TO authenticated;
GRANT SELECT, UPDATE ON leads TO authenticated;
GRANT SELECT ON signal_matches TO authenticated;
GRANT SELECT ON buyer_trigger_subscriptions TO authenticated;
