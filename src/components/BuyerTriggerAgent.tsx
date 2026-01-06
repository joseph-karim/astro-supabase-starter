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
  // ICP fields
  icp: {
    targetIndustries: string[];
    companySize: string;
    targetTitles: string[];
    geography: string;
    painPoints: string[];
  };
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
  domain?: string;
  website?: string;
  location: string;
  employees: number;
  revenue: string;
  description?: string;
  score: number;
  primarySignal?: string;
  tags?: string[];
  matchReason: string;
  convergenceBonus?: boolean;
  signals?: { type: string; evidence?: string; confidence: number }[];
  sourceSnippet?: string;
  evidenceUrl?: string;
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
    useVoCResearch: false,
    icp: {
      targetIndustries: [],
      companySize: '50-500 employees',
      targetTitles: [],
      geography: '',
      painPoints: []
    }
  });

  const totalSteps = 4; // Added ICP step

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
    } else if (step === 4) {
      // Generate leads after final step (now step 4)
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
        // Use the full VoC research pipeline (async job + polling to avoid request timeouts)
        setResearchStatus('Starting deep research...');

        const startResponse = await fetch('/api/buyer-trigger-agent/voc-research-start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            website: data.website,
            companyName: data.companyName,
            competitors: data.competitors,
            industry: data.industry || undefined
          })
        });

        if (!startResponse.ok) {
          let message = 'Failed to run VoC research';
          try {
            const err = await startResponse.json();
            if (err?.error) message = err.error;
            if (err?.details) message += `: ${err.details}`;
            if (err?.requestId) message += ` (requestId: ${err.requestId})`;
          } catch {
            try {
              const text = await startResponse.text();
              if (text) message += `: ${text}`;
            } catch {
              // ignore
            }
          }
          throw new Error(message);
        }

        const { jobId } = await startResponse.json();
        if (!jobId) throw new Error('VoC research job failed to start');

        const startedAt = Date.now();
        const maxWaitMs = 12 * 60 * 1000; // 12 minutes

        let result: any = null;
        while (Date.now() - startedAt < maxWaitMs) {
          const jobResponse = await fetch(`/api/buyer-trigger-agent/voc-research-job?jobId=${encodeURIComponent(jobId)}`);
          if (!jobResponse.ok) {
            throw new Error(`VoC research job error (jobId: ${jobId})`);
          }
          const job = await jobResponse.json();

          if (job?.statusMessage) setResearchStatus(job.statusMessage);

          if (job?.status === 'completed') {
            result = job.result;
            break;
          }
          if (job?.status === 'failed') {
            const msg = job?.error?.message || 'VoC research failed';
            throw new Error(msg);
          }

          await new Promise((r) => setTimeout(r, 2000));
        }

        if (!result) {
          throw new Error(`VoC research timed out (jobId: ${jobId})`);
        }

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

        // Pre-populate ICP from analysis
        const industry = result.websiteAnalysis?.companyProfile?.industry || 'Technology';
        const targetMarkets = result.websiteAnalysis?.companyProfile?.targetMarkets || [];
        
        setData({
          ...data,
          industry,
          signals: triggerSignals.slice(0, 3).map((s: any) => s.id),
          icp: {
            ...data.icp,
            targetIndustries: targetMarkets.length > 0 ? targetMarkets : [industry],
            targetTitles: [data.targetBuyer || 'Decision Maker'],
            painPoints: result.websiteAnalysis?.companyProfile?.services || []
          }
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
            .map((s: any) => s.id),
          icp: {
            targetIndustries: [result.idealCustomerProfile.industry || result.companyProfile.industry],
            companySize: result.idealCustomerProfile.companySize || '50-500 employees',
            targetTitles: [result.idealCustomerProfile.title],
            geography: '',
            painPoints: result.idealCustomerProfile.painPoints || []
          }
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
      // Build request payload with ICP data
      const payload: any = {
        industry: data.industry,
        targetBuyer: data.targetBuyer,
        signals: data.signals,
        buyerJourneyStage: data.buyerJourneyStage,
        // Include ICP for more targeted search
        icp: {
          targetIndustries: data.icp.targetIndustries,
          companySize: data.icp.companySize,
          targetTitles: data.icp.targetTitles,
          geography: data.icp.geography,
          painPoints: data.icp.painPoints
        }
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
      case 2: return data.icp.targetIndustries.length > 0 && data.icp.companySize.length > 0;
      case 3: return analysis !== null && data.signals.length > 0;
      case 4: return data.buyerJourneyStage.length > 0;
      default: return true;
    }
  };

  const [expandedLead, setExpandedLead] = useState<number | null>(null);

  if (step === totalSteps + 1) {
    return (
      <div className="bta-container">
        <div className="bta-report">
          <div className="bta-report-header">
            <h2>Found {leads.length} potential prospects</h2>
            <p className="bta-report-subtitle">
              Companies matching your criteria with buying signals detected
            </p>
          </div>

          <div className="bta-leads">
            {leads.map((lead, idx) => (
              <div 
                key={idx} 
                className={`bta-lead-card ${expandedLead === idx ? 'bta-lead-expanded' : ''}`}
              >
                <div 
                  className="bta-lead-header"
                  onClick={() => setExpandedLead(expandedLead === idx ? null : idx)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="bta-lead-info">
                    <div className="bta-lead-company-row">
                      <span className="bta-lead-company">{lead.company}</span>
                      {lead.signals && lead.signals.length > 1 && (
                        <span className="bta-convergence-badge">{lead.signals.length} signals</span>
                      )}
                    </div>
                    {lead.domain && (
                      <a 
                        href={lead.website || `https://${lead.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bta-lead-domain"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {lead.domain} ↗
                      </a>
                    )}
                    <div className="bta-lead-meta">
                      {lead.location !== 'Unknown' && <span>{lead.location}</span>}
                      {lead.employees > 0 && <span>{lead.employees.toLocaleString()} employees</span>}
                      {lead.revenue !== 'Unknown' && <span>{lead.revenue}</span>}
                    </div>
                  </div>
                  <div className="bta-lead-score-box">
                    <div className="bta-lead-score">{lead.score}</div>
                    <div className="bta-lead-score-label">score</div>
                  </div>
                </div>

                {lead.description && (
                  <p className="bta-lead-description">{lead.description}</p>
                )}

                {lead.signals && lead.signals.length > 0 && (
                  <div className="bta-lead-signals">
                    <div className="bta-signals-label">Detected Signals:</div>
                    <div className="bta-signals-list">
                      {lead.signals.map((sig, i) => (
                        <div key={i} className="bta-signal-item">
                          <span className="bta-signal-name">{sig.type.replace(/_/g, ' ')}</span>
                          <span className="bta-signal-conf">{sig.confidence}%</span>
                          {sig.evidence && expandedLead === idx && (
                            <div className="bta-signal-evidence">{sig.evidence}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {expandedLead === idx && (
                  <div className="bta-lead-details">
                    {lead.sourceSnippet && (
                      <div className="bta-lead-snippet">
                        <div className="bta-snippet-label">Source Context:</div>
                        <p>{lead.sourceSnippet}</p>
                      </div>
                    )}
                    {lead.evidenceUrl && (
                      <a 
                        href={lead.evidenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bta-evidence-link"
                      >
                        View Source →
                      </a>
                    )}
                  </div>
                )}

                <div className="bta-lead-footer">
                  <span className="bta-match-reason">{lead.matchReason}</span>
                  <button 
                    className="bta-expand-btn"
                    onClick={() => setExpandedLead(expandedLead === idx ? null : idx)}
                  >
                    {expandedLead === idx ? 'Less' : 'More'}
                  </button>
                </div>
              </div>
            ))}

            {leads.length === 0 && (
              <div className="bta-no-leads">
                <p>No prospects found matching your criteria. Try adjusting your signals or industry.</p>
                <button className="bta-btn bta-btn-secondary" onClick={() => setStep(2)}>
                  Adjust Criteria
                </button>
              </div>
            )}
          </div>

          <div className="bta-cta-section">
            <h3>Get daily updates with fresh prospects</h3>
            <p>Enter your email to receive new matches automatically.</p>

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
                New Search
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

          {step === 2 && (
            <div className="bta-step">
              <h2>Define your ideal customer</h2>
              <p className="bta-subtitle">We've pre-filled this based on your website. Edit to refine who you're looking for:</p>

              <div className="bta-field">
                <label>Target Industries</label>
                <input
                  type="text"
                  value={data.icp.targetIndustries.join(', ')}
                  onChange={(e) => setData({
                    ...data,
                    icp: { ...data.icp, targetIndustries: e.target.value.split(',').map(s => s.trim()).filter(s => s) }
                  })}
                  placeholder="SaaS, Technology, E-commerce"
                />
                <p className="bta-helper">Industries your ideal customers operate in (comma-separated)</p>
              </div>

              <div className="bta-field">
                <label>Company Size</label>
                <select
                  value={data.icp.companySize}
                  onChange={(e) => setData({
                    ...data,
                    icp: { ...data.icp, companySize: e.target.value }
                  })}
                >
                  <option value="1-10 employees">1-10 employees (Startup)</option>
                  <option value="11-50 employees">11-50 employees (Small)</option>
                  <option value="50-200 employees">50-200 employees (Mid-Market)</option>
                  <option value="200-1000 employees">200-1000 employees (Mid-Enterprise)</option>
                  <option value="1000+ employees">1000+ employees (Enterprise)</option>
                </select>
              </div>

              <div className="bta-field">
                <label>Target Job Titles</label>
                <input
                  type="text"
                  value={data.icp.targetTitles.join(', ')}
                  onChange={(e) => setData({
                    ...data,
                    icp: { ...data.icp, targetTitles: e.target.value.split(',').map(s => s.trim()).filter(s => s) }
                  })}
                  placeholder="VP Sales, Head of Growth, CEO"
                />
                <p className="bta-helper">Decision makers you want to reach (comma-separated)</p>
              </div>

              <div className="bta-field">
                <label>Geographic Focus (optional)</label>
                <input
                  type="text"
                  value={data.icp.geography}
                  onChange={(e) => setData({
                    ...data,
                    icp: { ...data.icp, geography: e.target.value }
                  })}
                  placeholder="US, North America, Global"
                />
              </div>

              <div className="bta-field">
                <label>Pain Points / Use Cases</label>
                <textarea
                  value={data.icp.painPoints.join('\n')}
                  onChange={(e) => setData({
                    ...data,
                    icp: { ...data.icp, painPoints: e.target.value.split('\n').map(s => s.trim()).filter(s => s) }
                  })}
                  placeholder="Struggling to scale outbound&#10;Missing early buying signals&#10;Can't personalize at scale"
                  rows={4}
                />
                <p className="bta-helper">Problems your prospects face (one per line)</p>
              </div>
            </div>
          )}

          {step === 3 && analysis && (
            <div className="bta-step">
              <h2>Choose buying signals to track</h2>
              <p className="bta-subtitle">Select events that indicate a company is ready to buy:</p>

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
          )}

          {step === 4 && (
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
            {analyzing ? 'Analyzing Website...' : 
             loading ? 'Finding Prospects...' : 
             step === 1 ? 'Analyze My Business' : 
             step === 2 ? 'Confirm ICP' :
             step === 3 ? 'Select Signals' :
             step === totalSteps ? 'Find Prospects' : 
             'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
