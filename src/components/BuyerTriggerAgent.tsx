import React, { useState, useEffect } from 'react';
import './BuyerTriggerAgent.css';

interface BusinessProfile {
  services: string[];
  icp: {
    industries: string[];
    companySize: string;
    geography: string[];
  };
  positioning: string;
}

interface Trigger {
  id: string;
  name: string;
  description: string;
  strength: string;
}

interface OnboardingSession {
  id: string;
  status: string;
  businessProfile?: BusinessProfile;
  triggers: Trigger[];
  leadCount?: number;
}

type Step =
  | 'entry'
  | 'analyzing'
  | 'business-validation'
  | 'trigger-discovery'
  | 'icp-refinement'
  | 'generating-leads'
  | 'results-preview'
  | 'paywall'
  | 'strategy-call';

const BuyerTriggerAgent: React.FC = () => {
  const [step, setStep] = useState<Step>('entry');
  const [session, setSession] = useState<OnboardingSession | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [currentTriggerResponse, setCurrentTriggerResponse] = useState('');
  const [triggerConversation, setTriggerConversation] = useState<Array<{ role: string; content: string }>>([]);

  // Step 1: Entry Point
  const handleStartAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/buyer-trigger-agent/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website_url: websiteUrl, email })
      });

      if (!response.ok) throw new Error('Failed to start analysis');

      const data = await response.json();
      setSession(data);
      setStep('analyzing');

      // Poll for analysis completion
      pollAnalysisStatus(data.session_id);
    } catch (err) {
      setError('Something went wrong. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Poll analysis status
  const pollAnalysisStatus = async (sessionId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/buyer-trigger-agent/status/${sessionId}`);
        const data = await response.json();

        if (data.status === 'analyzing' && data.business_profile) {
          clearInterval(pollInterval);
          setBusinessProfile(data.business_profile);
          setStep('business-validation');
        } else if (data.status === 'error') {
          clearInterval(pollInterval);
          setError(data.error_message || 'Analysis failed');
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000);

    // Timeout after 2 minutes
    setTimeout(() => clearInterval(pollInterval), 120000);
  };

  // Step 3: Business Validation
  const handleConfirmBusiness = () => {
    setStep('trigger-discovery');
    initializeTriggerConversation();
  };

  const initializeTriggerConversation = () => {
    setTriggerConversation([
      {
        role: 'system',
        content: "Think about your best client win in the last year. What was happening at that company RIGHT BEFORE they reached out to you?"
      }
    ]);
  };

  // Step 4: Trigger Discovery
  const handleTriggerResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTriggerResponse.trim() || !session) return;

    const newConversation = [
      ...triggerConversation,
      { role: 'user', content: currentTriggerResponse }
    ];
    setTriggerConversation(newConversation);
    setCurrentTriggerResponse('');
    setLoading(true);

    try {
      const response = await fetch('/api/buyer-trigger-agent/trigger-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          response: currentTriggerResponse
        })
      });

      const data = await response.json();

      if (data.extracted_trigger) {
        setTriggers([...triggers, data.extracted_trigger]);
      }

      if (data.next_question) {
        setTriggerConversation([
          ...newConversation,
          { role: 'system', content: data.next_question }
        ]);
      }

      // After 3 triggers, move to ICP refinement
      if (triggers.length >= 2 && data.extracted_trigger) {
        setTimeout(() => setStep('icp-refinement'), 1000);
      }
    } catch (err) {
      setError('Failed to process response');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Step 5: ICP Refinement
  const handleICPSubmit = async () => {
    if (!session) return;
    setLoading(true);
    setStep('generating-leads');

    try {
      // Save ICP and start lead generation
      await fetch('/api/buyer-trigger-agent/generate-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session.id })
      });

      // Poll for completion
      pollLeadGeneration(session.id);
    } catch (err) {
      setError('Failed to start lead generation');
      console.error(err);
      setLoading(false);
    }
  };

  const pollLeadGeneration = async (sessionId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/buyer-trigger-agent/status/${sessionId}`);
        const data = await response.json();

        if (data.status === 'complete') {
          clearInterval(pollInterval);
          setSession(data);
          setStep('results-preview');
        } else if (data.status === 'error') {
          clearInterval(pollInterval);
          setError(data.error_message || 'Lead generation failed');
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 5000);

    setTimeout(() => clearInterval(pollInterval), 300000); // 5 min timeout
  };

  // Render current step
  return (
    <div className="buyer-trigger-agent">
      {step === 'entry' && (
        <div className="step-container entry-step">
          <div className="entry-content">
            <h1>🎯 Find Companies Ready to Buy Right Now</h1>
            <p className="subtitle">
              We'll analyze your business and find 25 companies showing buying signals for your exact services.
            </p>

            <form onSubmit={handleStartAnalysis} className="entry-form">
              <div className="form-field">
                <label htmlFor="website">Your Website URL</label>
                <input
                  type="url"
                  id="website"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://yourcompany.com"
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="email">Email (to send your leads)</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                />
              </div>

              {error && <div className="error-message">{error}</div>}

              <button type="submit" className="btn btn-primary btn-large" disabled={loading}>
                {loading ? 'Starting...' : 'Find My Leads →'}
              </button>

              <p className="form-note">⏱️ Takes 5 minutes • 🔒 No credit card required</p>
            </form>
          </div>
        </div>
      )}

      {step === 'analyzing' && (
        <div className="step-container analyzing-step">
          <div className="analyzing-content">
            <h2>🔍 Analyzing {new URL(websiteUrl).hostname}...</h2>

            <div className="progress-bar">
              <div className="progress-fill"></div>
            </div>

            <div className="progress-items">
              <div className="progress-item">✅ Found your homepage</div>
              <div className="progress-item">✅ Discovered service pages</div>
              <div className="progress-item">✅ Analyzing business model...</div>
              <div className="progress-item">⏳ Extracting ideal customer profile...</div>
            </div>

            <div className="quick-question">
              <p>💡 While we analyze, tell us:</p>
              <p className="question">What's the #1 problem you solve for clients?</p>
              <textarea
                placeholder="We help companies reduce operational costs by..."
                rows={3}
              ></textarea>
            </div>
          </div>
        </div>
      )}

      {step === 'business-validation' && businessProfile && (
        <div className="step-container validation-step">
          <div className="validation-content">
            <h2>✅ Analysis Complete</h2>

            <div className="business-profile-card">
              <h3>🏢 Your Business Profile</h3>

              <div className="profile-section">
                <h4>Primary Services:</h4>
                <ul>
                  {businessProfile.services.map((service, idx) => (
                    <li key={idx}>{service}</li>
                  ))}
                </ul>
              </div>

              <div className="profile-section">
                <h4>Target Market (we detected):</h4>
                <ul>
                  {businessProfile.icp.industries.map((industry, idx) => (
                    <li key={idx}>{industry}</li>
                  ))}
                  <li>{businessProfile.icp.companySize} employees</li>
                </ul>
              </div>

              <div className="action-buttons">
                <button className="btn btn-secondary" onClick={() => {}}>
                  ✏️ Edit this
                </button>
                <button className="btn btn-primary" onClick={handleConfirmBusiness}>
                  ✓ This is accurate
                </button>
              </div>
            </div>

            <div className="next-section">
              <h3>📍 Let's go deeper to find your best leads:</h3>
              <p className="question">
                Think about your best client win in the last year. What was happening at that
                company RIGHT BEFORE they reached out to you?
              </p>
            </div>
          </div>
        </div>
      )}

      {step === 'trigger-discovery' && (
        <div className="step-container trigger-step">
          <div className="trigger-content">
            <h2>🎯 Understanding Your Buyer Triggers</h2>

            {triggers.length > 0 && (
              <div className="triggers-found">
                <h3>Triggers Identified:</h3>
                {triggers.map((trigger, idx) => (
                  <div key={trigger.id} className="trigger-card">
                    <div className="trigger-number">{idx + 1}</div>
                    <div className="trigger-details">
                      <h4>{trigger.name}</h4>
                      <p>{trigger.description}</p>
                      <div className={`strength-badge ${trigger.strength.toLowerCase()}`}>
                        Signal strength: {trigger.strength}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="conversation">
              {triggerConversation.map((msg, idx) => (
                <div key={idx} className={`message ${msg.role}`}>
                  {msg.content}
                </div>
              ))}
            </div>

            <form onSubmit={handleTriggerResponse} className="response-form">
              <textarea
                value={currentTriggerResponse}
                onChange={(e) => setCurrentTriggerResponse(e.target.value)}
                placeholder="Tell us about the situation..."
                rows={4}
                disabled={loading}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || !currentTriggerResponse.trim()}
              >
                {loading ? 'Processing...' : 'Continue →'}
              </button>
            </form>

            {triggers.length >= 2 && (
              <button className="btn btn-secondary" onClick={() => setStep('icp-refinement')}>
                I'm done - let's find leads
              </button>
            )}
          </div>
        </div>
      )}

      {step === 'icp-refinement' && (
        <div className="step-container icp-step">
          <div className="icp-content">
            <h2>🎯 Refine Your Target Companies</h2>
            <p>Help us narrow down to the best-fit prospects:</p>

            <div className="icp-form">
              <div className="form-section">
                <h3>INDUSTRY</h3>
                <div className="checkbox-group">
                  {['Manufacturing', 'Distribution', 'Healthcare', 'Technology', 'Professional Services'].map(
                    (industry) => (
                      <label key={industry}>
                        <input type="checkbox" defaultChecked={industry === 'Manufacturing'} />
                        {industry}
                      </label>
                    )
                  )}
                </div>
              </div>

              <div className="form-section">
                <h3>COMPANY SIZE</h3>
                <div className="radio-group">
                  {['50-100', '100-500', '500-1000', '1000+'].map((size) => (
                    <label key={size}>
                      <input type="radio" name="size" value={size} defaultChecked={size === '100-500'} />
                      {size} employees
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-section">
                <h3>GEOGRAPHY</h3>
                <div className="checkbox-group">
                  {['United States', 'Canada', 'Mexico', 'Europe'].map((geo) => (
                    <label key={geo}>
                      <input type="checkbox" defaultChecked={geo === 'United States'} />
                      {geo}
                    </label>
                  ))}
                </div>
              </div>

              <button className="btn btn-primary btn-large" onClick={handleICPSubmit} disabled={loading}>
                {loading ? 'Processing...' : 'Generate My Leads →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'generating-leads' && (
        <div className="step-container generating-step">
          <div className="generating-content">
            <h2>🔍 Searching for your ideal buyers...</h2>

            <div className="progress-bar">
              <div className="progress-fill animated"></div>
            </div>

            <div className="search-progress">
              <div className="progress-item">✅ Searching company database...</div>
              <div className="progress-item">✅ Detecting buying signals...</div>
              <div className="progress-item">⏳ Cross-referencing with your ICP criteria...</div>
              <div className="progress-item">⏳ Enriching contact information...</div>
            </div>

            <div className="early-results">
              <h3>📊 Early results:</h3>
              <p>Found 847 companies matching your ICP</p>
              <ul>
                <li>├── 23 with new COO/VP Ops in last 90 days</li>
                <li>├── 12 with facility expansion announced</li>
                <li>├── 8 with recent compliance incidents</li>
                <li>└── 4 acquired by PE in last 6 months</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {step === 'results-preview' && session?.leadCount && (
        <div className="step-container results-step">
          <div className="results-content">
            <h1>🎉 Found {session.leadCount} Companies Ready to Buy</h1>
            <p>These companies match your ICP AND are showing active buying signals right now:</p>

            <div className="lead-preview">
              <div className="lead-card featured">
                <div className="lead-header">
                  <div className="lead-rank">#1</div>
                  <div className="lead-info">
                    <h3>ACME MANUFACTURING CO</h3>
                    <p>Cleveland, OH • 250 employees • Manufacturing</p>
                  </div>
                  <div className="lead-score">🔥 94</div>
                </div>

                <div className="lead-trigger">
                  <strong>🚨 TRIGGER:</strong> New COO hired (Sarah Chen) 45 days ago
                </div>

                <div className="lead-signals">
                  <strong>📋 ADDITIONAL SIGNALS:</strong>
                  <ul>
                    <li>• Filed building permit for 50K sq ft expansion</li>
                    <li>• Posted 3 "continuous improvement" roles</li>
                    <li>• PE-backed (acquired by Summit Partners 2024)</li>
                  </ul>
                </div>

                <div className="lead-contact">
                  <strong>👤 KEY CONTACT:</strong>
                  <p>Sarah Chen, Chief Operating Officer</p>
                  <p className="blurred">s████@acmemfg.com • +1 (216) ███-████</p>
                </div>

                <button className="btn btn-secondary">Unlock Full Profile</button>
              </div>

              <div className="lead-card">
                <div className="lead-header">
                  <div className="lead-rank">#2</div>
                  <div className="lead-info">
                    <h3>PRECISION DYNAMICS INC</h3>
                    <p>Detroit, MI • 180 employees • Manufacturing</p>
                  </div>
                  <div className="lead-score">🔥 91</div>
                </div>

                <div className="lead-trigger">
                  <strong>🚨 TRIGGER:</strong> FDA Warning Letter (Oct 2024)
                </div>

                <div className="lead-contact locked">
                  <strong>👤 KEY CONTACT:</strong> [Locked]
                </div>
              </div>

              <div className="locked-leads">
                <div className="locked-overlay">
                  <h3>#3 - #{session.leadCount} [LOCKED - Upgrade to View All]</h3>
                </div>
              </div>
            </div>

            <div className="lead-summary">
              <h3>📊 Your Lead Summary:</h3>
              <ul>
                <li>{session.leadCount} companies • Combined $2.4B revenue</li>
                <li>47 decision-makers identified</li>
                <li>Estimated total pipeline value: $1.2M - $3.6M</li>
              </ul>
            </div>

            <div className="cta-section">
              <div className="cta-card">
                <h3>🔓 Unlock All {session.leadCount} Leads</h3>
                <p>+ Get fresh leads delivered daily</p>
                <button className="btn btn-primary btn-large" onClick={() => setStep('paywall')}>
                  Start Free Trial →
                </button>
                <p className="pricing">7 days free, then $99/month</p>
              </div>

              <div className="divider">─── OR ───</div>

              <div className="cta-card secondary">
                <h3>🎯 Want help turning these into appointments?</h3>
                <p>Book a free strategy call - we'll show you exactly how to reach out</p>
                <button className="btn btn-secondary" onClick={() => setStep('strategy-call')}>
                  Book Strategy Call
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 'paywall' && (
        <div className="step-container paywall-step">
          <div className="paywall-content">
            <h2>🔓 Unlock Your Complete Lead Intelligence</h2>

            <div className="pricing-cards">
              <div className="pricing-card">
                <h3>STARTER</h3>
                <div className="price">$49/mo</div>
                <ul className="features">
                  <li>25 leads/week</li>
                  <li>3 triggers</li>
                  <li>Email alerts</li>
                  <li>Weekly refresh</li>
                </ul>
                <button className="btn btn-secondary">Start Trial</button>
              </div>

              <div className="pricing-card popular">
                <div className="popular-badge">⭐ POPULAR</div>
                <h3>GROWTH</h3>
                <div className="price">$199/mo</div>
                <ul className="features">
                  <li>100 leads/week</li>
                  <li>10 triggers</li>
                  <li>Slack + CRM integration</li>
                  <li>Daily refresh</li>
                  <li>Contact export</li>
                </ul>
                <button className="btn btn-primary">Start Trial</button>
              </div>
            </div>

            <p className="guarantee">✓ 7-day free trial ✓ Cancel anytime ✓ No credit card required to start</p>

            <div className="alternative-cta">
              <h3>Not ready to subscribe?</h3>
              <p>Book a free strategy call and we'll help you with the entire system:</p>
              <ul>
                <li>• Set up your complete trigger system</li>
                <li>• Write personalized outreach sequences</li>
                <li>• Manage your campaigns</li>
                <li>• Deliver booked appointments</li>
              </ul>
              <button className="btn btn-secondary" onClick={() => setStep('strategy-call')}>
                Book Strategy Call
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'strategy-call' && (
        <div className="step-container strategy-call-step">
          <div className="strategy-call-content">
            <h2>📞 Book Your Free Strategy Call</h2>
            <p>
              On this 30-minute call, we'll review your leads and show you exactly how to turn them into
              appointments.
            </p>

            <div className="call-benefits">
              <h3>What we'll cover:</h3>
              <ul>
                <li>✓ Review your 25 leads and prioritize the top 5</li>
                <li>✓ Build personalized outreach angles for each</li>
                <li>✓ Map your complete trigger system (5-10 signals)</li>
                <li>✓ Show you exactly how to turn these into appointments</li>
              </ul>
            </div>

            <div className="calendly-embed">
              <p>[Calendly embed would go here]</p>
              <button className="btn btn-primary btn-large">Schedule Call</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuyerTriggerAgent;
