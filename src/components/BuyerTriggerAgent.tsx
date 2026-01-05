import { useState } from 'react';
import './BuyerTriggerAgent.css';

interface SessionData {
  email: string;
  companyName: string;
  website: string;
  industry: string;
  targetBuyer: string;
  buyerJourneyStage: string;
  painPoints: string[];
  signals: string[];
  frequency: string;
}

export default function BuyerTriggerAgent() {
  const [step, setStep] = useState(1);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [data, setData] = useState<SessionData>({
    email: '',
    companyName: '',
    website: '',
    industry: '',
    targetBuyer: '',
    buyerJourneyStage: '',
    painPoints: [],
    signals: [],
    frequency: 'daily'
  });

  const totalSteps = 9;

  // Signal types available for selection
  const signalTypes = [
    { id: 'hiring', label: 'Hiring for specific roles', description: 'Track when companies hire for roles that indicate need' },
    { id: 'funding', label: 'Funding rounds', description: 'Companies that just raised money often invest in growth' },
    { id: 'tech_adoption', label: 'Technology adoption', description: 'Companies adopting specific tech stacks' },
    { id: 'leadership_change', label: 'Leadership changes', description: 'New executives often bring new priorities' },
    { id: 'expansion', label: 'Office expansion', description: 'Opening new locations signals growth' },
    { id: 'product_launch', label: 'Product launches', description: 'New products need marketing and support' },
    { id: 'awards', label: 'Awards & recognition', description: 'Recognition creates buying windows' },
    { id: 'regulatory', label: 'Regulatory changes', description: 'Compliance changes create urgent needs' }
  ];

  const painPointOptions = [
    'Sales team can\'t identify buyers early enough',
    'Missing deals because competitors get there first',
    'Outbound feels like cold calling',
    'Can\'t scale personalized outreach',
    'No visibility into buyer timing signals',
    'Marketing qualified leads aren\'t sales ready'
  ];

  const handleNext = async () => {
    if (step === 1) {
      // Initialize session
      await initializeSession();
    } else if (step === totalSteps) {
      // Complete onboarding
      await completeOnboarding();
    } else {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const initializeSession = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/buyer-trigger-agent/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email })
      });

      if (!response.ok) throw new Error('Failed to start session');

      const result = await response.json();
      setSessionId(result.sessionId);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const completeOnboarding = async () => {
    setLoading(true);
    setError(null);

    try {
      // Save complete session data
      const response = await fetch(`/api/buyer-trigger-agent/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          ...data
        })
      });

      if (!response.ok) throw new Error('Failed to complete onboarding');

      setStep(totalSteps + 1); // Show success screen
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const updateData = (field: keyof SessionData, value: any) => {
    setData({ ...data, [field]: value });
  };

  const toggleArrayItem = (field: 'painPoints' | 'signals', item: string) => {
    const current = data[field];
    const updated = current.includes(item)
      ? current.filter(i => i !== item)
      : [...current, item];
    updateData(field, updated);
  };

  const canProceed = () => {
    switch (step) {
      case 1: return data.email.includes('@');
      case 2: return data.companyName.length > 0;
      case 3: return data.website.length > 0;
      case 4: return data.industry.length > 0;
      case 5: return data.targetBuyer.length > 0;
      case 6: return data.painPoints.length > 0;
      case 7: return data.buyerJourneyStage.length > 0;
      case 8: return data.signals.length > 0;
      case 9: return data.frequency.length > 0;
      default: return true;
    }
  };

  if (step === totalSteps + 1) {
    return (
      <div className="bta-container">
        <div className="bta-success">
          <div className="bta-success-icon">✓</div>
          <h2>You're all set!</h2>
          <p>We're now scanning for companies matching your trigger criteria.</p>
          <p>You'll receive your first batch of qualified leads within 24 hours at <strong>{data.email}</strong></p>
          <div className="bta-success-actions">
            <a href="/dashboard" className="bta-btn bta-btn-primary">View Dashboard</a>
            <a href="/" className="bta-btn bta-btn-secondary">Back to Home</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bta-container">
      <div className="bta-wizard">
        {/* Progress Bar */}
        <div className="bta-progress">
          <div className="bta-progress-bar" style={{ width: `${(step / totalSteps) * 100}%` }} />
          <div className="bta-progress-text">Step {step} of {totalSteps}</div>
        </div>

        {/* Step Content */}
        <div className="bta-content">
          {step === 1 && (
            <div className="bta-step">
              <h2>Let's find companies ready to buy</h2>
              <p className="bta-subtitle">Enter your email to get started. No credit card required.</p>

              <div className="bta-field">
                <label>Email Address</label>
                <input
                  type="email"
                  value={data.email}
                  onChange={(e) => updateData('email', e.target.value)}
                  placeholder="you@company.com"
                  autoFocus
                />
              </div>

              {error && <div className="bta-error">{error}</div>}
            </div>
          )}

          {step === 2 && (
            <div className="bta-step">
              <h2>What's your company name?</h2>
              <p className="bta-subtitle">We'll use this to personalize your experience.</p>

              <div className="bta-field">
                <label>Company Name</label>
                <input
                  type="text"
                  value={data.companyName}
                  onChange={(e) => updateData('companyName', e.target.value)}
                  placeholder="Acme Corp"
                  autoFocus
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="bta-step">
              <h2>What's your company website?</h2>
              <p className="bta-subtitle">We'll analyze your positioning to better understand your ideal customers.</p>

              <div className="bta-field">
                <label>Website URL</label>
                <input
                  type="url"
                  value={data.website}
                  onChange={(e) => updateData('website', e.target.value)}
                  placeholder="https://acme.com"
                  autoFocus
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="bta-step">
              <h2>What industry are you in?</h2>
              <p className="bta-subtitle">This helps us understand the buying patterns in your market.</p>

              <div className="bta-field">
                <label>Industry</label>
                <select
                  value={data.industry}
                  onChange={(e) => updateData('industry', e.target.value)}
                  autoFocus
                >
                  <option value="">Select an industry...</option>
                  <option value="saas">SaaS / Software</option>
                  <option value="marketing">Marketing Agency</option>
                  <option value="consulting">Consulting</option>
                  <option value="legal">Legal Services</option>
                  <option value="accounting">Accounting / Finance</option>
                  <option value="design">Design Agency</option>
                  <option value="recruiting">Recruiting</option>
                  <option value="other">Other Professional Services</option>
                </select>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="bta-step">
              <h2>Who's your ideal buyer?</h2>
              <p className="bta-subtitle">Be specific. For example: "VP Marketing at Series B SaaS companies"</p>

              <div className="bta-field">
                <label>Target Buyer Profile</label>
                <textarea
                  value={data.targetBuyer}
                  onChange={(e) => updateData('targetBuyer', e.target.value)}
                  placeholder="VP Marketing at B2B SaaS companies with 50-200 employees, focused on demand generation..."
                  rows={4}
                  autoFocus
                />
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="bta-step">
              <h2>What problems keep your prospects up at night?</h2>
              <p className="bta-subtitle">Select all that apply. We'll use this to identify relevant buying signals.</p>

              <div className="bta-checkbox-grid">
                {painPointOptions.map(option => (
                  <label key={option} className="bta-checkbox">
                    <input
                      type="checkbox"
                      checked={data.painPoints.includes(option)}
                      onChange={() => toggleArrayItem('painPoints', option)}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="bta-step">
              <h2>When in the buyer journey do you want to engage?</h2>
              <p className="bta-subtitle">Earlier = more opportunities but more nurturing required.</p>

              <div className="bta-radio-group">
                <label className="bta-radio">
                  <input
                    type="radio"
                    name="journey"
                    value="awareness"
                    checked={data.buyerJourneyStage === 'awareness'}
                    onChange={(e) => updateData('buyerJourneyStage', e.target.value)}
                  />
                  <div>
                    <strong>Early (Awareness)</strong>
                    <p>Just starting to experience the problem</p>
                  </div>
                </label>

                <label className="bta-radio">
                  <input
                    type="radio"
                    name="journey"
                    value="consideration"
                    checked={data.buyerJourneyStage === 'consideration'}
                    onChange={(e) => updateData('buyerJourneyStage', e.target.value)}
                  />
                  <div>
                    <strong>Middle (Consideration)</strong>
                    <p>Actively researching solutions</p>
                  </div>
                </label>

                <label className="bta-radio">
                  <input
                    type="radio"
                    name="journey"
                    value="decision"
                    checked={data.buyerJourneyStage === 'decision'}
                    onChange={(e) => updateData('buyerJourneyStage', e.target.value)}
                  />
                  <div>
                    <strong>Late (Decision)</strong>
                    <p>Ready to buy, evaluating vendors</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {step === 8 && (
            <div className="bta-step">
              <h2>Which signals matter most to you?</h2>
              <p className="bta-subtitle">We'll monitor these triggers and alert you when companies match.</p>

              <div className="bta-signal-grid">
                {signalTypes.map(signal => (
                  <label key={signal.id} className="bta-signal-card">
                    <input
                      type="checkbox"
                      checked={data.signals.includes(signal.id)}
                      onChange={() => toggleArrayItem('signals', signal.id)}
                    />
                    <div className="bta-signal-content">
                      <strong>{signal.label}</strong>
                      <p>{signal.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 9 && (
            <div className="bta-step">
              <h2>How often do you want updates?</h2>
              <p className="bta-subtitle">Choose your notification frequency.</p>

              <div className="bta-radio-group">
                <label className="bta-radio">
                  <input
                    type="radio"
                    name="frequency"
                    value="realtime"
                    checked={data.frequency === 'realtime'}
                    onChange={(e) => updateData('frequency', e.target.value)}
                  />
                  <div>
                    <strong>Real-time</strong>
                    <p>Instant alerts when new matches are found</p>
                  </div>
                </label>

                <label className="bta-radio">
                  <input
                    type="radio"
                    name="frequency"
                    value="daily"
                    checked={data.frequency === 'daily'}
                    onChange={(e) => updateData('frequency', e.target.value)}
                  />
                  <div>
                    <strong>Daily Digest</strong>
                    <p>One email per day with all new matches</p>
                  </div>
                </label>

                <label className="bta-radio">
                  <input
                    type="radio"
                    name="frequency"
                    value="weekly"
                    checked={data.frequency === 'weekly'}
                    onChange={(e) => updateData('frequency', e.target.value)}
                  />
                  <div>
                    <strong>Weekly Summary</strong>
                    <p>Weekly roundup of all matches</p>
                  </div>
                </label>
              </div>

              {error && <div className="bta-error">{error}</div>}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="bta-nav">
          {step > 1 && (
            <button
              onClick={handleBack}
              className="bta-btn bta-btn-secondary"
              disabled={loading}
            >
              Back
            </button>
          )}

          <div className="bta-nav-spacer" />

          <button
            onClick={handleNext}
            className="bta-btn bta-btn-primary"
            disabled={!canProceed() || loading}
          >
            {loading ? 'Processing...' : step === totalSteps ? 'Complete Setup' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
