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
  competitors: string[];
  useVoCResearch: boolean;
}

interface Analysis {
  companyProfile: any;
  idealCustomerProfile: any;
  recommendedSignals: any[];
  confidence: number;
}

interface VoCResearch {
  websiteAnalysis: any;
  synthesizedTriggers: any[];
  signalConfigurations: any[];
}

interface Lead {
  company: string;
  location: string;
  employees: number;
  revenue: string;
  score: number;
  primarySignal: string;
  tags: string[];
  matchReason: string;
  convergenceBonus?: boolean;
  signals?: { type: string; trigger: string; confidence: number; messagingContext: string }[];
}

export default function BuyerTriggerAgent() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [vocResearch, setVocResearch] = useState<VoCResearch | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [researchStatus, setResearchStatus] = useState<string>('');

  const [data, setData] = useState<SessionData>({
    email: '',
    companyName: '',
    website: '',
    industry: '',
    targetBuyer: '',
    buyerJourneyStage: '',
    painPoints: [],
    signals: [],
    frequency: 'daily',
    competitors: [],
    useVoCResearch: false
  });

  const totalSteps = 3;

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
      // Analyze website after step 1
      await analyzeWebsite();
    } else if (step === 3) {
      // Generate leads after final step
      await generateLeads();
    } else {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const analyzeWebsite = async () => {
    setAnalyzing(true);
    setError(null);

    try {
      if (data.useVoCResearch) {
        // Use the full VoC research pipeline
        setResearchStatus('Analyzing your website...');
        
        const response = await fetch('/api/buyer-trigger-agent/voc-research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            website: data.website,
            companyName: data.companyName,
            competitors: data.competitors
          })
        });

        if (!response.ok) {
          let message = 'Failed to run VoC research';
          try {
            const err = await response.json();
            if (err?.error) message = err.error;
            if (err?.details) message += `: ${err.details}`;
            if (err?.requestId) message += ` (requestId: ${err.requestId})`;
          } catch {
            try {
              const text = await response.text();
              if (text) message += `: ${text}`;
            } catch {
              // ignore
            }
          }
          throw new Error(message);
        }

        const result = await response.json();
        setVocResearch(result);

        // Convert VoC triggers to analysis format for display
        const triggerSignals = result.signalConfigurations?.map((config: any) => ({
          id: config.triggerName,
          label: config.triggerName.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          reason: config.messagingAngle,
          priority: config.signals?.some((s: any) => s.confidence === 'HIGH') ? 'high' : 'medium',
          enabled: true
        })) || [];

        setAnalysis({
          companyProfile: result.websiteAnalysis?.companyProfile || { industry: 'Technology' },
          idealCustomerProfile: {
            title: data.targetBuyer || 'Decision Maker',
            companySize: '50-500 employees'
          },
          recommendedSignals: triggerSignals,
          confidence: 0.85
        });

        setData({
          ...data,
          industry: result.websiteAnalysis?.companyProfile?.industry || 'Technology',
          signals: triggerSignals.slice(0, 3).map((s: any) => s.id)
        });

        setResearchStatus('');
        setStep(2);
      } else {
        // Standard analysis
        const response = await fetch('/api/buyer-trigger-agent/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            website: data.website,
            companyName: data.companyName
          })
        });

        if (!response.ok) {
          let message = 'Failed to analyze website';
          try {
            const err = await response.json();
            if (err?.error) message = err.error;
            if (err?.details) message += `: ${err.details}`;
          } catch {
            // ignore
          }
          throw new Error(message);
        }

        const result = await response.json();
        setAnalysis(result);

        // Pre-fill ICP and signals from analysis
        setData({
          ...data,
          industry: result.companyProfile.industry,
          targetBuyer: result.idealCustomerProfile.title,
          signals: result.recommendedSignals
            .filter((s: any) => s.enabled)
            .map((s: any) => s.id)
        });

        setStep(2);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setAnalyzing(false);
      setResearchStatus('');
    }
  };

  const generateLeads = async () => {
    setLoading(true);
    setError(null);

    try {
      // Build request payload
      const payload: any = {
        industry: data.industry,
        targetBuyer: data.targetBuyer,
        signals: data.signals,
        buyerJourneyStage: data.buyerJourneyStage
      };

      // If VoC research was used, include signal configurations for enhanced lead gen
      if (data.useVoCResearch && vocResearch?.signalConfigurations) {
        payload.signalConfigurations = vocResearch.signalConfigurations;
      }

      const response = await fetch('/api/buyer-trigger-agent/generate-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let message = 'Failed to generate leads';
        try {
          const err = await response.json();
          if (err?.error) message = err.error;
          if (err?.details) message += `: ${err.details}`;
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      const result = await response.json();
      setLeads(result.leads);
      setStep(totalSteps + 1);
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
      case 1: return data.companyName.length > 0 && data.website.length > 0;
      case 2: return analysis !== null && data.signals.length > 0;
      case 3: return data.buyerJourneyStage.length > 0;
      default: return true;
    }
  };

  if (step === totalSteps + 1) {
    return (
      <div className="bta-container">
        <div className="bta-report">
          <div className="bta-report-header">
            <h2>Here are {leads.length} companies ready to buy</h2>
            <p className="bta-report-subtitle">Based on your criteria: {data.industry} companies showing {data.signals.length} signal types</p>
          </div>

          <div className="bta-leads">
            {leads.map((lead, idx) => (
              <div key={idx} className={`bta-lead-card ${lead.convergenceBonus ? 'bta-lead-convergence' : ''}`}>
                <div className="bta-lead-header">
                  <div>
                    <div className="bta-lead-company">
                      {lead.company}
                      {lead.convergenceBonus && <span className="bta-convergence-badge">Multi-Signal</span>}
                    </div>
                    <div className="bta-lead-meta">{lead.location} • {lead.employees} employees • {lead.revenue} revenue</div>
                  </div>
                  <div className="bta-lead-score">{lead.score}</div>
                </div>
                <div className="bta-lead-signal">
                  <span className="bta-signal-label">Primary Signal:</span> {lead.primarySignal}
                </div>
                {lead.signals && lead.signals.length > 0 && (
                  <div className="bta-lead-signals-detail">
                    {lead.signals.map((sig, i) => (
                      <div key={i} className="bta-signal-detail">
                        <span className="bta-signal-type">{sig.type.replace(/_/g, ' ')}</span>
                        <span className="bta-signal-confidence">{sig.confidence}% conf</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="bta-lead-tags">
                  {lead.tags.map((tag, i) => (
                    <span key={i} className="bta-tag">{tag}</span>
                  ))}
                </div>
                <div className="bta-lead-match">{lead.matchReason}</div>
              </div>
            ))}

            {leads.length > 0 && (
              <div className="bta-more-leads">+ more qualified leads available with full subscription</div>
            )}
          </div>

          <div className="bta-cta-section">
            <h3>Get daily updates with fresh leads</h3>
            <p>Enter your email to receive new matches automatically, customize signals, and track your pipeline.</p>

            <div className="bta-field">
              <input
                type="email"
                value={data.email}
                onChange={(e) => updateData('email', e.target.value)}
                placeholder="you@company.com"
              />
            </div>

            <div className="bta-cta-actions">
              <button className="bta-btn bta-btn-primary" disabled={!data.email.includes('@')}>
                Get Daily Notifications
              </button>
              <button className="bta-btn bta-btn-secondary" onClick={() => setStep(1)}>
                Do Another Search
              </button>
            </div>
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
              <h2>Let's find companies ready to buy from you</h2>
              <p className="bta-subtitle">We'll analyze your website and generate a personalized list of leads showing buying signals.</p>

              <div className="bta-field">
                <label>Your Company Name</label>
                <input
                  type="text"
                  value={data.companyName}
                  onChange={(e) => updateData('companyName', e.target.value)}
                  placeholder="Acme Corp"
                  autoFocus
                />
              </div>

              <div className="bta-field">
                <label>Your Website</label>
                <input
                  type="url"
                  value={data.website}
                  onChange={(e) => updateData('website', e.target.value)}
                  placeholder="https://acme.com"
                />
              </div>

              <div className="bta-field">
                <label>Competitors (optional)</label>
                <input
                  type="text"
                  value={data.competitors.join(', ')}
                  onChange={(e) => updateData('competitors', e.target.value.split(',').map(c => c.trim()).filter(c => c))}
                  placeholder="Competitor 1, Competitor 2"
                />
                <p className="bta-helper">We'll mine competitor reviews to discover real buyer triggers</p>
              </div>

              <label className="bta-checkbox-option">
                <input
                  type="checkbox"
                  checked={data.useVoCResearch}
                  onChange={(e) => updateData('useVoCResearch', e.target.checked)}
                />
                <div>
                  <strong>Deep Research Mode</strong>
                  <p className="bta-helper">Mine reviews, Reddit, and case studies to discover actual buyer triggers (takes 30-60 seconds)</p>
                </div>
              </label>

              {analyzing && (
                <div className="bta-analyzing">
                  🔍 {researchStatus || 'Analyzing your website to understand your business...'}
                </div>
              )}
              {error && <div className="bta-error">{error}</div>}
            </div>
          )}

          {step === 2 && analysis && (
            <div className="bta-step">
              <h2>We found your ideal customers</h2>
              <p className="bta-subtitle">Based on analyzing {data.website}, here's who we think you should target:</p>

              <div className="bta-analysis-box">
                <div className="bta-analysis-item">
                  <div className="bta-analysis-label">Your Industry</div>
                  <div className="bta-analysis-value">{analysis.companyProfile.industry}</div>
                </div>
                <div className="bta-analysis-item">
                  <div className="bta-analysis-label">Your Ideal Buyer</div>
                  <div className="bta-analysis-value">{analysis.idealCustomerProfile.title}</div>
                </div>
                <div className="bta-analysis-item">
                  <div className="bta-analysis-label">Target Company Size</div>
                  <div className="bta-analysis-value">{analysis.idealCustomerProfile.companySize}</div>
                </div>
              </div>

              <div className="bta-field">
                <label>Select the signals that indicate readiness to buy</label>
                <p className="bta-helper">We've pre-selected the most relevant signals for your business:</p>

                <div className="bta-signal-grid">
                  {analysis.recommendedSignals.map((signal: any) => (
                    <label key={signal.id} className="bta-signal-card">
                      <input
                        type="checkbox"
                        checked={data.signals.includes(signal.id)}
                        onChange={() => toggleArrayItem('signals', signal.id)}
                      />
                      <div className="bta-signal-content">
                        <strong>{signal.label}</strong>
                        <p>{signal.reason}</p>
                        {signal.priority === 'high' && <span className="bta-priority-badge">High Priority</span>}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="bta-step">
              <h2>When should we reach out?</h2>
              <p className="bta-subtitle">Choose the buyer journey stage where you want to engage.</p>

              <div className="bta-radio-group">
                <label className="bta-radio">
                  <input
                    type="radio"
                    name="journey"
                    value="awareness"
                    checked={data.buyerJourneyStage === 'awareness'}
                    onChange={(e) => updateData('buyerJourneyStage', e.target.value)}
                    autoFocus
                  />
                  <div>
                    <strong>Early (Awareness)</strong>
                    <p>Just starting to experience the problem - more opportunities, more nurturing needed</p>
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
                    <p>Actively researching solutions - balanced volume and readiness</p>
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
                    <p>Ready to buy, evaluating vendors - highest intent, lowest volume</p>
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
            disabled={!canProceed() || loading || analyzing}
          >
            {analyzing ? 'Analyzing Website...' : loading ? 'Generating Leads...' : step === 1 ? 'Analyze My Business' : step === totalSteps ? 'Show Me the Leads' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
