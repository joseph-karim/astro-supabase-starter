/**
 * Trigger-to-Signal Translation Engine
 * 
 * Converts discovered VoC trigger patterns into actionable
 * signal monitoring configurations using free/low-cost data sources.
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  TriggerPattern,
  TriggerSignalConfiguration,
  SignalConfig,
  CompanySignal,
  FREE_SIGNAL_SOURCES,
  SIGNAL_BASE_SCORES,
  SIGNAL_HALF_LIVES
} from './types';

// Available free data sources for signal detection
const AVAILABLE_SIGNAL_SOURCES = `
FREE SOURCES (Always available):
- SEC EDGAR API: 8-K filings, executive changes, M&A announcements, material events
- Google News RSS: Funding announcements, executive hires, compliance events, product launches
- Indeed Jobs RSS: Job postings by title, location, company
- LinkedIn Jobs (limited): Job postings, company pages
- Crunchbase News RSS: Funding rounds, acquisitions
- Building permit databases (local gov): Facility expansion, new offices
- Regulatory databases: FDA warnings, OSHA violations, EPA, SEC actions

LOW-COST SOURCES:
- Exa Search API: Real-time web search, company discovery
- Perplexity API: Research and signal verification

MONITORING METHODS:
- RSS feed polling (real-time to daily)
- API queries (on-demand or scheduled)
- Web scraping with Jina Reader (as needed)
- News alerts via Google News RSS
`;

/**
 * Generate signal configurations from trigger patterns
 */
export async function generateSignalConfigurations(
  triggerPatterns: TriggerPattern[],
  businessContext: {
    companyName: string;
    industry: string;
    services: string[];
    targetCompanySize: string;
  },
  apiKey: string
): Promise<TriggerSignalConfiguration[]> {
  const anthropic = new Anthropic({ apiKey });

  const prompt = `You are configuring a buyer signal detection system.

BUSINESS CONTEXT:
- Company: ${businessContext.companyName}
- Industry: ${businessContext.industry}
- Services: ${businessContext.services.join(', ')}
- Target Company Size: ${businessContext.targetCompanySize}

DISCOVERED TRIGGER PATTERNS:
${JSON.stringify(triggerPatterns, null, 2)}

AVAILABLE DATA SOURCES:
${AVAILABLE_SIGNAL_SOURCES}

For each trigger pattern, create a signal configuration. Output as JSON array:
[
  {
    "triggerName": "snake_case_name",
    "triggerType": "TIMING|PROBLEM|RE_ENGAGEMENT|AUTHORITY",
    "sourceEvidence": "Brief summary of VoC evidence supporting this trigger",
    "signals": [
      {
        "signalName": "specific_observable_signal",
        "dataSource": "Source name from available list",
        "queryMethod": "api|rss|scrape",
        "queryParameters": {
          "keywords": ["relevant", "keywords"],
          "jobTitles": ["if applicable"],
          "filters": {},
          "timeWindow": "30 days"
        },
        "interpretation": "What this signal means when detected",
        "confidence": "HIGH|MEDIUM|LOW",
        "freshnessWindow": 30
      }
    ],
    "combinationLogic": "signal_a AND (signal_b OR signal_c)",
    "scoringWeights": {
      "signal_name": 0.5
    },
    "timingWindow": {
      "minDays": 0,
      "maxDays": 90,
      "idealDays": 30
    },
    "messagingAngle": "How to reference this trigger in outreach"
  }
]

RULES:
1. Prioritize FREE sources over paid sources
2. Each trigger should have 2-4 observable signals
3. Use combination logic to reduce false positives
4. Set realistic timing windows based on the trigger type
5. Include specific, actionable query parameters
6. Focus on signals that are time-bound (not evergreen)

SIGNAL PRIORITY ORDER:
1. Direct signals (job posting filled, funding announced)
2. Proxy signals (hiring surge, tech stack change)
3. Contextual signals (industry news, competitor moves)`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 6000,
    messages: [{ role: 'user', content: prompt }]
  });

  const content = message.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  const jsonMatch = content.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return [];
  }

  return JSON.parse(jsonMatch[0]);
}

/**
 * Execute signal detection for a target company
 */
export async function detectSignalsForCompany(
  companyName: string,
  companyUrl: string,
  signalConfigs: TriggerSignalConfiguration[],
  apiKeys: {
    exa?: string;
    perplexity?: string;
    anthropic: string;
  }
): Promise<CompanySignal[]> {
  const detectedSignals: CompanySignal[] = [];

  for (const config of signalConfigs) {
    for (const signal of config.signals) {
      try {
        const detected = await executeSignalQuery(
          companyName,
          companyUrl,
          signal,
          apiKeys
        );

        if (detected) {
          detectedSignals.push({
            id: `signal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            companyId: companyUrl,
            companyName,
            companyUrl,
            signalType: signal.signalName,
            triggerPattern: config.triggerName,
            detectedAt: new Date(),
            evidence: detected.evidence,
            confidence: detected.confidence,
            recommendedAction: `Engage within ${config.timingWindow.idealDays} days`,
            messagingContext: config.messagingAngle,
            score: calculateSignalScore(signal.signalName, detected.confidence)
          });
        }
      } catch (error) {
        console.error(`Signal detection error for ${signal.signalName}:`, error);
      }
    }
  }

  return detectedSignals;
}

/**
 * Execute a specific signal query
 */
async function executeSignalQuery(
  companyName: string,
  companyUrl: string,
  signal: SignalConfig,
  apiKeys: { exa?: string; perplexity?: string; anthropic: string }
): Promise<{ evidence: any; confidence: number } | null> {
  
  switch (signal.dataSource.toLowerCase()) {
    case 'google news rss':
    case 'google news':
      return await searchGoogleNews(companyName, signal.queryParameters.keywords || []);
    
    case 'indeed jobs rss':
    case 'linkedin jobs':
    case 'job boards':
      return await searchJobPostings(companyName, signal.queryParameters, apiKeys.exa);
    
    case 'crunchbase news':
    case 'crunchbase':
      return await searchFundingNews(companyName, apiKeys.exa);
    
    case 'exa search':
    case 'exa':
      if (!apiKeys.exa) return null;
      return await searchWithExa(companyName, signal.queryParameters, apiKeys.exa);
    
    case 'perplexity':
      if (!apiKeys.perplexity) return null;
      return await researchWithPerplexity(companyName, signal, apiKeys.perplexity);
    
    case 'sec edgar':
      return await searchSECFilings(companyName);
    
    default:
      // Fall back to Exa search for unknown sources
      if (apiKeys.exa) {
        return await searchWithExa(companyName, signal.queryParameters, apiKeys.exa);
      }
      return null;
  }
}

/**
 * Search Google News for company mentions
 */
async function searchGoogleNews(
  companyName: string,
  keywords: string[]
): Promise<{ evidence: any; confidence: number } | null> {
  const query = encodeURIComponent(`"${companyName}" ${keywords.join(' OR ')}`);
  const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;

  try {
    const response = await fetch(rssUrl);
    if (!response.ok) return null;

    const xml = await response.text();
    
    // Simple XML parsing for RSS items
    const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g);
    if (!itemMatches || itemMatches.length === 0) return null;

    // Check if any news items are recent (within 30 days)
    const recentItems = itemMatches.slice(0, 5);
    
    if (recentItems.length > 0) {
      const titleMatch = recentItems[0].match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = recentItems[0].match(/<link>([\s\S]*?)<\/link>/);
      
      return {
        evidence: {
          source: 'Google News',
          title: titleMatch?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '') || 'News article found',
          url: linkMatch?.[1] || '',
          matchedKeywords: keywords,
          itemCount: recentItems.length
        },
        confidence: recentItems.length >= 3 ? 80 : 60
      };
    }

    return null;
  } catch (error) {
    console.error('Google News search error:', error);
    return null;
  }
}

/**
 * Search for job postings using Exa
 */
async function searchJobPostings(
  companyName: string,
  params: SignalConfig['queryParameters'],
  exaApiKey?: string
): Promise<{ evidence: any; confidence: number } | null> {
  if (!exaApiKey) return null;

  const Exa = (await import('exa-js')).default;
  const exa = new Exa(exaApiKey);

  const jobTitles = params.jobTitles || ['VP', 'Director', 'Head of'];
  const query = `"${companyName}" (${jobTitles.map(t => `"${t}"`).join(' OR ')}) (hiring OR job OR career)`;

  try {
    const results = await exa.searchAndContents(query, {
      type: 'auto',
      numResults: 5,
      text: { maxCharacters: 500 }
    });

    if (results.results.length > 0) {
      return {
        evidence: {
          source: 'Job Search',
          jobs: results.results.map(r => ({
            title: r.title,
            url: r.url,
            snippet: r.text?.slice(0, 200)
          })),
          matchedTitles: jobTitles,
          totalFound: results.results.length
        },
        confidence: results.results.length >= 2 ? 75 : 55
      };
    }

    return null;
  } catch (error) {
    console.error('Job search error:', error);
    return null;
  }
}

/**
 * Search for funding news using Exa
 */
async function searchFundingNews(
  companyName: string,
  exaApiKey?: string
): Promise<{ evidence: any; confidence: number } | null> {
  if (!exaApiKey) return null;

  const Exa = (await import('exa-js')).default;
  const exa = new Exa(exaApiKey);

  const query = `"${companyName}" (raised OR funding OR Series OR investment) site:techcrunch.com OR site:crunchbase.com`;

  try {
    const results = await exa.searchAndContents(query, {
      type: 'auto',
      numResults: 3,
      text: { maxCharacters: 500 }
    });

    if (results.results.length > 0) {
      // Check if results are recent (title or content mentions recent funding)
      const recentIndicators = ['2024', '2025', '2026', 'today', 'this week', 'announced'];
      const hasRecentFunding = results.results.some(r => 
        recentIndicators.some(ind => 
          r.title?.toLowerCase().includes(ind) || r.text?.toLowerCase().includes(ind)
        )
      );

      if (hasRecentFunding) {
        return {
          evidence: {
            source: 'Funding News',
            articles: results.results.map(r => ({
              title: r.title,
              url: r.url,
              snippet: r.text?.slice(0, 200)
            }))
          },
          confidence: 85
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Funding search error:', error);
    return null;
  }
}

/**
 * Generic Exa search for signals
 */
async function searchWithExa(
  companyName: string,
  params: SignalConfig['queryParameters'],
  exaApiKey: string
): Promise<{ evidence: any; confidence: number } | null> {
  const Exa = (await import('exa-js')).default;
  const exa = new Exa(exaApiKey);

  const keywords = params.keywords || [];
  const query = `"${companyName}" (${keywords.join(' OR ')})`;

  try {
    const results = await exa.searchAndContents(query, {
      type: 'auto',
      numResults: 5,
      text: { maxCharacters: 500 }
    });

    if (results.results.length > 0) {
      return {
        evidence: {
          source: 'Web Search',
          results: results.results.map(r => ({
            title: r.title,
            url: r.url,
            snippet: r.text?.slice(0, 200)
          })),
          query,
          matchedKeywords: keywords
        },
        confidence: 60
      };
    }

    return null;
  } catch (error) {
    console.error('Exa search error:', error);
    return null;
  }
}

/**
 * Research company signals with Perplexity
 */
async function researchWithPerplexity(
  companyName: string,
  signal: SignalConfig,
  perplexityApiKey: string
): Promise<{ evidence: any; confidence: number } | null> {
  const prompt = `Research ${companyName} and identify if they have any of these recent signals (last 90 days):
- ${signal.interpretation}

Focus on: ${signal.queryParameters.keywords?.join(', ') || signal.signalName}

Return in this format:
SIGNAL_DETECTED: YES or NO
EVIDENCE: Brief description of what you found
CONFIDENCE: HIGH, MEDIUM, or LOW
SOURCE_URL: URL of primary source if available`;

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.2
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    const analysis = data.choices[0].message.content;

    // Parse response
    const detected = analysis.includes('SIGNAL_DETECTED: YES');
    if (!detected) return null;

    const evidenceMatch = analysis.match(/EVIDENCE:\s*(.+?)(?:\n|$)/i);
    const confidenceMatch = analysis.match(/CONFIDENCE:\s*(\w+)/i);
    const sourceMatch = analysis.match(/SOURCE_URL:\s*(\S+)/i);

    const confidenceMap: Record<string, number> = {
      'HIGH': 85,
      'MEDIUM': 65,
      'LOW': 45
    };

    return {
      evidence: {
        source: 'Perplexity Research',
        analysis: evidenceMatch?.[1] || 'Signal detected',
        sourceUrl: sourceMatch?.[1] || null
      },
      confidence: confidenceMap[confidenceMatch?.[1]?.toUpperCase() || 'MEDIUM'] || 65
    };
  } catch (error) {
    console.error('Perplexity research error:', error);
    return null;
  }
}

/**
 * Search SEC EDGAR for company filings
 */
async function searchSECFilings(
  companyName: string
): Promise<{ evidence: any; confidence: number } | null> {
  // SEC EDGAR full-text search
  const searchUrl = `https://efts.sec.gov/LATEST/search-index?q="${encodeURIComponent(companyName)}"&dateRange=custom&startdt=2024-01-01&forms=8-K`;

  try {
    const response = await fetch(searchUrl, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) return null;

    const data = await response.json();
    
    if (data.hits?.hits?.length > 0) {
      const recentFilings = data.hits.hits.slice(0, 3);
      
      return {
        evidence: {
          source: 'SEC EDGAR',
          filings: recentFilings.map((f: any) => ({
            form: f._source?.form,
            filed: f._source?.file_date,
            description: f._source?.display_names?.[0]
          })),
          totalFound: data.hits.total?.value || recentFilings.length
        },
        confidence: 90 // SEC filings are highly reliable
      };
    }

    return null;
  } catch (error) {
    console.error('SEC EDGAR search error:', error);
    return null;
  }
}

/**
 * Calculate signal score with time decay
 */
function calculateSignalScore(signalType: string, confidence: number): number {
  const baseScores: Record<string, number> = {
    executive_started_role: 8,
    funding_announced: 8,
    compliance_event: 8,
    executive_role_posted: 6,
    headcount_surge: 6,
    job_posting_velocity: 6,
    technology_change: 6,
    news_mention: 4,
    social_mention: 2
  };

  // Get base score or default to 5
  const base = baseScores[signalType] || 5;
  
  // Apply confidence multiplier
  const confidenceMultiplier = confidence / 100;
  
  return Math.round(base * confidenceMultiplier * 10);
}

/**
 * Calculate composite score for a company based on all detected signals
 */
export function calculateCompositeScore(signals: CompanySignal[]): number {
  if (signals.length === 0) return 0;

  let totalScore = 0;
  const signalTypesSeen = new Set<string>();

  for (const signal of signals) {
    // Time decay
    const ageMs = Date.now() - new Date(signal.detectedAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    
    // Half-life defaults to 30 days
    const halfLife = 30;
    const decayFactor = Math.pow(0.5, ageDays / halfLife);
    
    const decayedScore = signal.score * decayFactor;
    totalScore += decayedScore;
    signalTypesSeen.add(signal.signalType);
  }

  // Convergence bonus: multiple signal types = higher confidence
  if (signalTypesSeen.size >= 3) {
    totalScore *= 1.3; // 30% bonus for 3+ signal types
  } else if (signalTypesSeen.size >= 2) {
    totalScore *= 1.15; // 15% bonus for 2 signal types
  }

  // Normalize to 0-100 scale
  return Math.min(100, Math.round(totalScore));
}

/**
 * Rank companies by signal quality
 */
export function rankCompaniesBySignals(
  companiesWithSignals: { company: string; signals: CompanySignal[] }[]
): { company: string; signals: CompanySignal[]; compositeScore: number; rank: number }[] {
  const scored = companiesWithSignals.map(c => ({
    ...c,
    compositeScore: calculateCompositeScore(c.signals),
    rank: 0
  }));

  // Sort by composite score descending
  scored.sort((a, b) => b.compositeScore - a.compositeScore);

  // Assign ranks
  scored.forEach((c, idx) => {
    c.rank = idx + 1;
  });

  return scored;
}

