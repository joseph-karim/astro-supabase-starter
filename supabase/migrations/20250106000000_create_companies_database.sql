-- Create companies table for lead generation
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  website TEXT,
  industry TEXT NOT NULL,
  company_size TEXT NOT NULL, -- e.g., "10-50", "100-500", "1000+"
  employee_count INTEGER,
  revenue_range TEXT, -- e.g., "$1M-$5M", "$50M-$100M"
  location TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create company signals table
CREATE TABLE IF NOT EXISTS company_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL, -- hiring, funding, expansion, leadership_change, tech_adoption, product_launch, awards, regulatory
  signal_description TEXT NOT NULL,
  signal_date DATE NOT NULL,
  evidence_url TEXT,
  relevance_score DECIMAL(3,2) DEFAULT 0.5, -- 0.0 to 1.0
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry);
CREATE INDEX IF NOT EXISTS idx_companies_size ON companies(company_size);
CREATE INDEX IF NOT EXISTS idx_company_signals_type ON company_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_company_signals_company ON company_signals(company_id);
CREATE INDEX IF NOT EXISTS idx_company_signals_date ON company_signals(signal_date DESC);

-- Insert SaaS companies
INSERT INTO companies (name, industry, company_size, employee_count, revenue_range, location, description) VALUES
('TechFlow Systems', 'SaaS', '100-500', 280, '$38M-$50M', 'Austin, TX', 'Cloud-based workflow automation platform for enterprises'),
('CloudNine Analytics', 'SaaS', '50-100', 75, '$10M-$25M', 'San Francisco, CA', 'Business intelligence and data analytics SaaS'),
('DataStream Inc', 'SaaS', '200-500', 340, '$50M-$100M', 'Seattle, WA', 'Real-time data pipeline and ETL solutions'),
('Velocity Platform', 'SaaS', '100-500', 195, '$25M-$50M', 'Denver, CO', 'Project management and collaboration software'),
('Quantum Labs', 'SaaS', '50-100', 85, '$15M-$25M', 'Boston, MA', 'AI-powered customer service automation'),
('Nexus Software', 'SaaS', '500-1000', 650, '$100M-$250M', 'New York, NY', 'Enterprise resource planning platform'),
('Prism Analytics', 'SaaS', '100-500', 220, '$30M-$50M', 'Chicago, IL', 'Marketing analytics and attribution software'),
('Elevate Cloud', 'SaaS', '50-100', 90, '$10M-$25M', 'Portland, OR', 'HR and talent management platform'),
('Insight Engine', 'SaaS', '200-500', 310, '$50M-$75M', 'Atlanta, GA', 'Customer data platform and analytics'),
('Summit Systems', 'SaaS', '100-500', 175, '$25M-$50M', 'Miami, FL', 'Supply chain management software');

-- Insert Marketing/Agency companies
INSERT INTO companies (name, industry, company_size, employee_count, revenue_range, location, description) VALUES
('BrandCraft Agency', 'Marketing', '50-100', 68, '$8M-$15M', 'Los Angeles, CA', 'Full-service digital marketing and branding agency'),
('GrowthLab Marketing', 'Marketing', '20-50', 35, '$3M-$8M', 'Nashville, TN', 'Performance marketing and growth hacking specialists'),
('Velocity Digital', 'Marketing', '100-500', 145, '$20M-$35M', 'Dallas, TX', 'Multi-channel digital advertising agency'),
('Creative Pulse', 'Marketing', '50-100', 72, '$10M-$15M', 'Minneapolis, MN', 'Content marketing and social media agency'),
('Momentum Media', 'Marketing', '20-50', 42, '$5M-$10M', 'Phoenix, AZ', 'Video production and influencer marketing'),
('Peak Performance Marketing', 'Marketing', '50-100', 88, '$12M-$20M', 'Charlotte, NC', 'B2B demand generation and ABM specialists'),
('Amplify Group', 'Marketing', '100-500', 160, '$25M-$40M', 'Philadelphia, PA', 'Integrated marketing communications agency'),
('Catalyst Creative', 'Marketing', '20-50', 38, '$4M-$8M', 'Salt Lake City, UT', 'Brand strategy and creative design studio');

-- Insert Consulting firms
INSERT INTO companies (name, industry, company_size, employee_count, revenue_range, location, description) VALUES
('Apex Advisors', 'Consulting', '100-500', 225, '$35M-$50M', 'Washington, DC', 'Management consulting for Fortune 500 companies'),
('Strategic Partners Group', 'Consulting', '50-100', 82, '$12M-$20M', 'Houston, TX', 'Business strategy and operations consulting'),
('Transform Consulting', 'Consulting', '200-500', 310, '$60M-$85M', 'San Diego, CA', 'Digital transformation and change management'),
('Vanguard Advisory', 'Consulting', '100-500', 165, '$28M-$45M', 'Columbus, OH', 'Financial and risk management consulting'),
('Pinnacle Group', 'Consulting', '50-100', 95, '$15M-$25M', 'Indianapolis, IN', 'HR and organizational development consulting'),
('Catalyst Advisors', 'Consulting', '20-50', 45, '$6M-$12M', 'Raleigh, NC', 'Tech startup and growth stage consulting'),
('Meridian Consulting', 'Consulting', '100-500', 180, '$30M-$50M', 'Detroit, MI', 'Supply chain and operations excellence'),
('Insight Partners', 'Consulting', '50-100', 78, '$10M-$18M', 'Milwaukee, WI', 'Data analytics and business intelligence consulting');

-- Insert Manufacturing companies
INSERT INTO companies (name, industry, company_size, employee_count, revenue_range, location, description) VALUES
('Meridian Manufacturing', 'Manufacturing', '500-1000', 780, '$150M-$250M', 'Cleveland, OH', 'Industrial equipment and machinery manufacturer'),
('Precision Tools Corp', 'Manufacturing', '200-500', 340, '$75M-$125M', 'Pittsburgh, PA', 'Precision machining and tooling solutions'),
('Industrial Solutions', 'Manufacturing', '500-1000', 920, '$200M-$350M', 'Cincinnati, OH', 'Automotive parts and components manufacturer'),
('Advanced Materials Inc', 'Manufacturing', '100-500', 245, '$50M-$85M', 'St. Louis, MO', 'Specialty chemicals and advanced materials'),
('Summit Fabrication', 'Manufacturing', '200-500', 385, '$80M-$140M', 'Kansas City, MO', 'Custom metal fabrication and welding'),
('Precision Dynamics', 'Manufacturing', '100-500', 195, '$45M-$75M', 'Tulsa, OK', 'Medical device manufacturing'),
('TechForge Industries', 'Manufacturing', '500-1000', 650, '$175M-$275M', 'Louisville, KY', 'Industrial automation equipment'),
('Quantum Manufacturing', 'Manufacturing', '200-500', 295, '$65M-$110M', 'Buffalo, NY', 'Electronics and semiconductor components');

-- Insert E-commerce companies
INSERT INTO companies (name, industry, company_size, employee_count, revenue_range, location, description) VALUES
('ShopNexus', 'E-commerce', '100-500', 210, '$40M-$65M', 'Las Vegas, NV', 'Multi-brand e-commerce marketplace'),
('DirectShip Pro', 'E-commerce', '50-100', 92, '$15M-$28M', 'Tampa, FL', 'Dropshipping and fulfillment platform'),
('MarketPlace Solutions', 'E-commerce', '200-500', 335, '$70M-$120M', 'Orlando, FL', 'E-commerce infrastructure and logistics'),
('Retail Engine', 'E-commerce', '100-500', 175, '$32M-$55M', 'Richmond, VA', 'Omnichannel retail technology platform'),
('Commerce Cloud', 'E-commerce', '50-100', 88, '$12M-$22M', 'Providence, RI', 'Headless e-commerce and API platform');

-- Insert Finance/Fintech companies
INSERT INTO companies (name, industry, company_size, employee_count, revenue_range, location, description) VALUES
('FinTech Innovations', 'Fintech', '100-500', 245, '$45M-$75M', 'Charlotte, NC', 'Digital banking and payment solutions'),
('Quantum Capital', 'Finance', '50-100', 85, '$18M-$30M', 'Hartford, CT', 'Investment management and advisory services'),
('PayStream Solutions', 'Fintech', '200-500', 310, '$65M-$110M', 'Salt Lake City, UT', 'B2B payment processing and automation'),
('WealthBridge', 'Fintech', '100-500', 165, '$28M-$48M', 'Minneapolis, MN', 'Robo-advisor and wealth management platform'),
('LendingTree Pro', 'Fintech', '50-100', 95, '$15M-$25M', 'Austin, TX', 'Small business lending marketplace'),
('InsureTech Group', 'Fintech', '100-500', 190, '$35M-$60M', 'Des Moines, IA', 'Insurance technology and underwriting platform');

-- Insert Healthcare companies
INSERT INTO companies (name, industry, company_size, employee_count, revenue_range, location, description) VALUES
('HealthBridge Systems', 'Healthcare', '200-500', 380, '$85M-$140M', 'Nashville, TN', 'Hospital management and EMR software'),
('MedTech Innovations', 'Healthcare', '100-500', 225, '$50M-$85M', 'Birmingham, AL', 'Medical device and diagnostic equipment'),
('CareConnect', 'Healthcare', '50-100', 92, '$15M-$28M', 'Oklahoma City, OK', 'Telemedicine and remote patient monitoring'),
('Precision Health', 'Healthcare', '100-500', 175, '$38M-$65M', 'Omaha, NE', 'Personalized medicine and genomics testing'),
('VitalSigns Analytics', 'Healthcare', '50-100', 78, '$12M-$22M', 'Boise, ID', 'Healthcare data analytics and population health');

-- Insert Real Estate/PropTech companies
INSERT INTO companies (name, industry, company_size, employee_count, revenue_range, location, description) VALUES
('PropTech Innovations', 'Real Estate', '100-500', 195, '$35M-$58M', 'Denver, CO', 'Commercial real estate management platform'),
('SpaceWorks', 'Real Estate', '50-100', 85, '$14M-$24M', 'Portland, OR', 'Co-working and flexible office space provider'),
('RealEstate Engine', 'Real Estate', '200-500', 295, '$62M-$105M', 'Phoenix, AZ', 'Property management and leasing software'),
('BuildTech Solutions', 'Real Estate', '100-500', 165, '$28M-$48M', 'San Antonio, TX', 'Construction project management platform');

-- Now insert signals for companies (mix of recent and older signals)
-- SaaS company signals
INSERT INTO company_signals (company_id, signal_type, signal_description, signal_date, evidence_url, relevance_score) VALUES
((SELECT id FROM companies WHERE name = 'TechFlow Systems'), 'leadership_change', 'New VP of Operations hired from Salesforce', CURRENT_DATE - INTERVAL '47 days', 'https://linkedin.com/posts/techflow-vp-ops', 0.92),
((SELECT id FROM companies WHERE name = 'TechFlow Systems'), 'hiring', 'Opening 12 new positions in operations and customer success', CURRENT_DATE - INTERVAL '14 days', 'https://techflow.com/careers', 0.85),
((SELECT id FROM companies WHERE name = 'TechFlow Systems'), 'expansion', 'Opening new office in Chicago for Midwest expansion', CURRENT_DATE - INTERVAL '30 days', 'https://techcrunch.com/techflow-expansion', 0.78),

((SELECT id FROM companies WHERE name = 'CloudNine Analytics'), 'funding', 'Series B funding round ($28M) led by Sequoia Capital', CURRENT_DATE - INTERVAL '22 days', 'https://crunchbase.com/cloudnine-series-b', 0.95),
((SELECT id FROM companies WHERE name = 'CloudNine Analytics'), 'tech_adoption', 'Migrating to Kubernetes and microservices architecture', CURRENT_DATE - INTERVAL '8 days', 'https://cloudnine.com/blog/tech-migration', 0.72),

((SELECT id FROM companies WHERE name = 'DataStream Inc'), 'product_launch', 'Launching real-time CDC product for enterprise customers', CURRENT_DATE - INTERVAL '5 days', 'https://datastream.com/press/new-product', 0.88),
((SELECT id FROM companies WHERE name = 'DataStream Inc'), 'awards', 'Named Gartner Magic Quadrant Leader for data integration', CURRENT_DATE - INTERVAL '60 days', 'https://gartner.com/magic-quadrant', 0.81),

((SELECT id FROM companies WHERE name = 'Velocity Platform'), 'hiring', 'Hiring 8 enterprise sales representatives', CURRENT_DATE - INTERVAL '12 days', 'https://velocity.com/careers', 0.79),
((SELECT id FROM companies WHERE name = 'Velocity Platform'), 'leadership_change', 'New Chief Revenue Officer from Asana', CURRENT_DATE - INTERVAL '35 days', 'https://linkedin.com/velocity-new-cro', 0.87),

((SELECT id FROM companies WHERE name = 'Quantum Labs'), 'funding', 'Series A funding ($15M) from Andreessen Horowitz', CURRENT_DATE - INTERVAL '18 days', 'https://crunchbase.com/quantum-labs-series-a', 0.93),
((SELECT id FROM companies WHERE name = 'Quantum Labs'), 'expansion', 'Expanding to European market with London office', CURRENT_DATE - INTERVAL '40 days', 'https://quantumlabs.ai/press/europe', 0.76),

((SELECT id FROM companies WHERE name = 'Nexus Software'), 'regulatory', 'Preparing for SOC 2 Type 2 compliance certification', CURRENT_DATE - INTERVAL '25 days', 'https://nexus.com/compliance', 0.68),
((SELECT id FROM companies WHERE name = 'Nexus Software'), 'product_launch', 'Launching mobile app for field workers', CURRENT_DATE - INTERVAL '10 days', 'https://nexus.com/mobile-launch', 0.74),

-- Marketing agency signals
((SELECT id FROM companies WHERE name = 'BrandCraft Agency'), 'hiring', 'Hiring creative director and 5 account managers', CURRENT_DATE - INTERVAL '20 days', 'https://brandcraft.com/careers', 0.82),
((SELECT id FROM companies WHERE name = 'BrandCraft Agency'), 'awards', 'Won 3 Webby Awards for digital campaigns', CURRENT_DATE - INTERVAL '45 days', 'https://webbyawards.com/winners', 0.79),

((SELECT id FROM companies WHERE name = 'GrowthLab Marketing'), 'expansion', 'Opening new office in Austin, TX', CURRENT_DATE - INTERVAL '15 days', 'https://growthlab.com/expansion', 0.84),
((SELECT id FROM companies WHERE name = 'GrowthLab Marketing'), 'leadership_change', 'New VP of Client Services from Ogilvy', CURRENT_DATE - INTERVAL '28 days', 'https://linkedin.com/growthlab-vp', 0.88),

((SELECT id FROM companies WHERE name = 'Velocity Digital'), 'tech_adoption', 'Implementing AI-powered ad optimization platform', CURRENT_DATE - INTERVAL '32 days', 'https://velocitydigital.com/ai-platform', 0.71),
((SELECT id FROM companies WHERE name = 'Velocity Digital'), 'hiring', 'Hiring 15 data analysts and media buyers', CURRENT_DATE - INTERVAL '7 days', 'https://velocitydigital.com/jobs', 0.86),

-- Consulting firm signals
((SELECT id FROM companies WHERE name = 'Apex Advisors'), 'leadership_change', 'New Managing Partner from McKinsey', CURRENT_DATE - INTERVAL '52 days', 'https://linkedin.com/apex-new-mp', 0.91),
((SELECT id FROM companies WHERE name = 'Apex Advisors'), 'expansion', 'Expanding into healthcare consulting practice', CURRENT_DATE - INTERVAL '19 days', 'https://apexadvisors.com/healthcare', 0.77),

((SELECT id FROM companies WHERE name = 'Transform Consulting'), 'hiring', 'Hiring 20 consultants for digital transformation practice', CURRENT_DATE - INTERVAL '11 days', 'https://transformconsulting.com/careers', 0.89),
((SELECT id FROM companies WHERE name = 'Transform Consulting'), 'tech_adoption', 'Partnering with ServiceNow for enterprise implementations', CURRENT_DATE - INTERVAL '24 days', 'https://transform.com/servicenow', 0.73),

-- Manufacturing signals
((SELECT id FROM companies WHERE name = 'Meridian Manufacturing'), 'expansion', 'Building new 200,000 sq ft facility in Tennessee', CURRENT_DATE - INTERVAL '38 days', 'https://meridianmfg.com/expansion', 0.92),
((SELECT id FROM companies WHERE name = 'Meridian Manufacturing'), 'tech_adoption', 'Implementing IoT sensors and predictive maintenance', CURRENT_DATE - INTERVAL '16 days', 'https://meridian.com/iot', 0.75),

((SELECT id FROM companies WHERE name = 'Precision Tools Corp'), 'leadership_change', 'New VP of Manufacturing from Boeing', CURRENT_DATE - INTERVAL '41 days', 'https://linkedin.com/precision-vp', 0.87),
((SELECT id FROM companies WHERE name = 'Precision Tools Corp'), 'hiring', 'Hiring 25 skilled machinists and engineers', CURRENT_DATE - INTERVAL '9 days', 'https://precisiontools.com/jobs', 0.84),

((SELECT id FROM companies WHERE name = 'Industrial Solutions'), 'regulatory', 'Preparing for ISO 9001:2015 recertification', CURRENT_DATE - INTERVAL '27 days', 'https://industrialsolutions.com/iso', 0.66),
((SELECT id FROM companies WHERE name = 'Industrial Solutions'), 'product_launch', 'Launching new automotive electric vehicle components line', CURRENT_DATE - INTERVAL '13 days', 'https://industrial.com/ev-launch', 0.88),

-- E-commerce signals
((SELECT id FROM companies WHERE name = 'ShopNexus'), 'funding', 'Series C funding ($45M) from Tiger Global', CURRENT_DATE - INTERVAL '21 days', 'https://crunchbase.com/shopnexus-series-c', 0.94),
((SELECT id FROM companies WHERE name = 'ShopNexus'), 'hiring', 'Hiring 10 senior engineers for platform rebuild', CURRENT_DATE - INTERVAL '6 days', 'https://shopnexus.com/careers', 0.81),

((SELECT id FROM companies WHERE name = 'MarketPlace Solutions'), 'expansion', 'Expanding warehouse network with 3 new fulfillment centers', CURRENT_DATE - INTERVAL '29 days', 'https://marketplace.com/expansion', 0.85),
((SELECT id FROM companies WHERE name = 'MarketPlace Solutions'), 'tech_adoption', 'Implementing robotics and warehouse automation', CURRENT_DATE - INTERVAL '17 days', 'https://marketplace.com/robotics', 0.78),

-- Fintech signals
((SELECT id FROM companies WHERE name = 'FinTech Innovations'), 'regulatory', 'Completing SOC 2 Type 2 and PCI DSS Level 1 certification', CURRENT_DATE - INTERVAL '33 days', 'https://fintech.com/compliance', 0.72),
((SELECT id FROM companies WHERE name = 'FinTech Innovations'), 'funding', 'Series B funding ($32M) from Ribbit Capital', CURRENT_DATE - INTERVAL '26 days', 'https://crunchbase.com/fintech-series-b', 0.91),

((SELECT id FROM companies WHERE name = 'PayStream Solutions'), 'product_launch', 'Launching embedded payments API for SaaS companies', CURRENT_DATE - INTERVAL '8 days', 'https://paystream.com/embedded-payments', 0.86),
((SELECT id FROM companies WHERE name = 'PayStream Solutions'), 'leadership_change', 'New Chief Product Officer from Stripe', CURRENT_DATE - INTERVAL '44 days', 'https://linkedin.com/paystream-cpo', 0.89),

-- Healthcare signals
((SELECT id FROM companies WHERE name = 'HealthBridge Systems'), 'expansion', 'Acquiring smaller EMR competitor for $75M', CURRENT_DATE - INTERVAL '23 days', 'https://healthbridge.com/acquisition', 0.93),
((SELECT id FROM companies WHERE name = 'HealthBridge Systems'), 'hiring', 'Hiring 18 healthcare IT consultants', CURRENT_DATE - INTERVAL '14 days', 'https://healthbridge.com/careers', 0.82),

((SELECT id FROM companies WHERE name = 'MedTech Innovations'), 'regulatory', 'Received FDA 510(k) clearance for new diagnostic device', CURRENT_DATE - INTERVAL '36 days', 'https://fda.gov/510k-clearances', 0.95),
((SELECT id FROM companies WHERE name = 'MedTech Innovations'), 'awards', 'Won Medical Design Excellence Award', CURRENT_DATE - INTERVAL '48 days', 'https://mdea.com/winners', 0.77),

-- Real Estate signals
((SELECT id FROM companies WHERE name = 'PropTech Innovations'), 'tech_adoption', 'Implementing AI-powered property valuation models', CURRENT_DATE - INTERVAL '31 days', 'https://proptech.com/ai-valuation', 0.74),
((SELECT id FROM companies WHERE name = 'PropTech Innovations'), 'leadership_change', 'New CTO from WeWork', CURRENT_DATE - INTERVAL '39 days', 'https://linkedin.com/proptech-cto', 0.86),

((SELECT id FROM companies WHERE name = 'RealEstate Engine'), 'funding', 'Series B funding ($38M) from Fifth Wall Ventures', CURRENT_DATE - INTERVAL '16 days', 'https://crunchbase.com/realestate-series-b', 0.92),
((SELECT id FROM companies WHERE name = 'RealEstate Engine'), 'expansion', 'Expanding to 15 new markets across Southeast US', CURRENT_DATE - INTERVAL '20 days', 'https://realestate.com/expansion', 0.83);

-- Enable RLS on companies tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_signals ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Companies are publicly readable"
  ON companies FOR SELECT
  USING (true);

CREATE POLICY "Company signals are publicly readable"
  ON company_signals FOR SELECT
  USING (true);
