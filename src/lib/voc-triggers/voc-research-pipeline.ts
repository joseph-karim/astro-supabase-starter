import type {
  TriggerPattern,
  TriggerSignalConfiguration,
  VoCResearchSession,
  WebsiteAnalysis
} from './types';
import {
  extractTriggersFromWebsite,
  extractTriggersFromReddit,
  synthesizeTriggerPatterns,
  searchRedditWithExa,
  mineCompetitorReviews
} from './extraction';
import { generateSignalConfigurations } from './signal-translation';

export interface VoCResearchInput {
  website: string;
  companyName: string;
  industry?: string;
  competitors?: string[];
  targetCompanySize?: string;
  // API keys passed from the route (which has proper access to import.meta.env)
  apiKeys?: {
    anthropic?: string;
    exa?: string;
    perplexity?: string;
  };
}

function getEnv(key: string): string | undefined {
  // Try multiple access patterns for maximum compatibility across environments
  // 1. Direct process.env (most reliable in Node.js)
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  // 2. import.meta.env (Astro/Vite - note: dynamic access may not work)
  try {
    const meta = import.meta as any;
    if (meta?.env?.[key]) return meta.env[key];
  } catch {
    // ignore
  }
  // 3. globalThis fallback
  try {
    const g = globalThis as any;
    if (g?.process?.env?.[key]) return g.process.env[key];
  } catch {
    // ignore
  }
  return undefined;
}

function normalizeWebsiteAnalysis(
  input: any,
  params: { companyName: string; website: string; industry?: string; competitors?: string[] }
): WebsiteAnalysis {
  const fallback = createFallbackWebsiteAnalysis(params);
  if (!input || typeof input !== 'object') return fallback;

  const companyProfile =
    (input as any).companyProfile && typeof (input as any).companyProfile === 'object'
      ? (input as any).companyProfile
      : {};

  return {
    companyProfile: {
      name:
        typeof companyProfile.name === 'string' && companyProfile.name.trim().length > 0
          ? companyProfile.name
          : params.companyName,
      industry:
        typeof companyProfile.industry === 'string' && companyProfile.industry.trim().length > 0
          ? companyProfile.industry
          : params.industry || fallback.companyProfile.industry,
      services: Array.isArray(companyProfile.services)
        ? companyProfile.services
            .filter((s: any) => typeof s === 'string' && s.trim())
            .slice(0, 12)
        : [],
      positioning: typeof companyProfile.positioning === 'string' ? companyProfile.positioning : '',
      targetMarkets: Array.isArray(companyProfile.targetMarkets)
        ? companyProfile.targetMarkets
            .filter((s: any) => typeof s === 'string' && s.trim())
            .slice(0, 12)
        : []
    },
    caseStudies: Array.isArray((input as any).caseStudies) ? (input as any).caseStudies : [],
    testimonials: Array.isArray((input as any).testimonials) ? (input as any).testimonials : [],
    competitors: Array.isArray((input as any).competitors)
      ? (input as any).competitors.filter((c: any) => typeof c === 'string' && c.trim()).slice(0, 10)
      : params.competitors || fallback.competitors
  };
}

function createFallbackWebsiteAnalysis(params: {
  companyName: string;
  website: string;
  industry?: string;
  competitors?: string[];
}): WebsiteAnalysis {
  return {
    companyProfile: {
      name: params.companyName,
      industry: params.industry || 'Technology',
      services: [],
      positioning: '',
      targetMarkets: []
    },
    caseStudies: [],
    testimonials: [],
    competitors: params.competitors || []
  };
}

function generateFallbackSignalConfigurations(patterns: TriggerPattern[]): TriggerSignalConfiguration[] {
  const seen = new Set<string>();
  const uniquePatterns = patterns.filter((p) => {
    const key = (p?.name || '').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return uniquePatterns.slice(0, 6).map((p) => {
    const baseKeywords = (Array.isArray(p.keywords) ? p.keywords : []).filter(Boolean).slice(0, 6);
    const defaultJobTitles =
      p.name.includes('leader') || p.name.includes('executive')
        ? ['CTO', 'VP Engineering', 'VP Operations', 'Director']
        : ['VP', 'Director', 'Head of'];

    return {
      triggerName: p.name,
      triggerType: p.triggerType,
      sourceEvidence: p.description || 'Fallback configuration (LLM parsing failed).',
      signals: [
        {
          signalName: `${p.name}_news`,
          dataSource: 'Google News RSS',
          queryMethod: 'rss',
          queryParameters: { keywords: baseKeywords, timeWindow: '30 days' },
          interpretation: 'Recent news mentions that correlate with this trigger pattern.',
          confidence: 'MEDIUM',
          freshnessWindow: 30
        },
        {
          signalName: `${p.name}_jobs`,
          dataSource: 'Indeed Jobs RSS',
          queryMethod: 'rss',
          queryParameters: { jobTitles: defaultJobTitles, keywords: baseKeywords, timeWindow: '30 days' },
          interpretation: 'Recent job postings that indicate organizational change or active buying.',
          confidence: 'MEDIUM',
          freshnessWindow: 30
        }
      ],
      combinationLogic: `${p.name}_news OR ${p.name}_jobs`,
      scoringWeights: { [`${p.name}_news`]: 0.5, [`${p.name}_jobs`]: 0.5 },
      timingWindow: { minDays: 0, maxDays: 90, idealDays: 30 },
      messagingAngle: p.messagingAngle || 'Reference the change and offer a relevant quick win.'
    };
  });
}

async function scrapeWithCrawl4AI(endpoint: string, url: string): Promise<string | null> {
  try {
    const timeoutMs = 45_000;

    const fetchWithTimeout = async (input: RequestInfo | URL, init: RequestInit) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(input, { ...init, signal: controller.signal });
        return response;
      } finally {
        clearTimeout(timeoutId);
      }
    };

    let response: Response;
    if (endpoint.includes('{url}')) {
      const expanded = endpoint.replaceAll('{url}', encodeURIComponent(url));
      response = await fetchWithTimeout(expanded, {
        method: 'GET',
        headers: { Accept: 'application/json, text/plain;q=0.9' }
      });
    } else {
      response = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ url, format: 'markdown' })
      });
    }

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      const text = await response.text();
      return text || null;
    }

    const json = await response.json();
    const candidates = [
      json?.markdown,
      json?.content,
      json?.text,
      json?.data?.markdown,
      json?.data?.content,
      json?.result?.markdown,
      json?.result?.content
    ];

    const best = candidates.find((c) => typeof c === 'string' && c.trim().length > 0);
    return best ? best : null;
  } catch {
    return null;
  }
}

async function scrapeWebsite(url: string): Promise<string | null> {
  try {
    const crawl4aiEndpoint = getEnv('CRAWL4AI_ENDPOINT');
    if (crawl4aiEndpoint) {
      const crawl4aiContent = await scrapeWithCrawl4AI(crawl4aiEndpoint, url);
      if (crawl4aiContent) return crawl4aiContent.slice(0, 20000);
    }

    const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`;
    const response = await fetch(jinaUrl, {
      headers: {
        Accept: 'text/plain',
        'X-Return-Format': 'markdown'
      }
    });

    if (!response.ok) return null;
    const markdown = await response.text();
    return markdown.slice(0, 20000);
  } catch {
    return null;
  }
}

function getDefaultTriggerPatterns(industry: string): TriggerPattern[] {
  const industryPatterns: Record<string, TriggerPattern[]> = {
    Technology: [
      {
        id: 'default-new-leader',
        name: 'new_technical_leader',
        description: 'New CTO/VP Engineering brings new technology priorities',
        triggerType: 'TIMING',
        evidence: [],
        frequencyScore: 0.7,
        confidenceScore: 0.8,
        observableComponents: ['Executive job posting', 'LinkedIn profile change'],
        typicalTimeline: '30-90 days after hire',
        messagingAngle: 'Reference common challenges new tech leaders face in first 100 days',
        keywords: ['new CTO', 'VP Engineering', 'technical leadership']
      },
      {
        id: 'default-funding',
        name: 'post_funding_scaling',
        description: 'Recent funding triggers rapid scaling and tool investment',
        triggerType: 'TIMING',
        evidence: [],
        frequencyScore: 0.8,
        confidenceScore: 0.85,
        observableComponents: ['Funding announcement', 'Hiring surge'],
        typicalTimeline: '3-6 months post-funding',
        messagingAngle: 'Reference growth challenges that come with scaling post-funding',
        keywords: ['Series A', 'Series B', 'raised funding', 'investment']
      },
      {
        id: 'default-compliance',
        name: 'compliance_requirement',
        description: 'SOC 2/ISO/compliance requirements drive tool adoption',
        triggerType: 'PROBLEM',
        evidence: [],
        frequencyScore: 0.6,
        confidenceScore: 0.9,
        observableComponents: ['Compliance job posting', 'Enterprise sales push'],
        typicalTimeline: 'Immediate need',
        messagingAngle: 'Reference specific compliance requirements and timeline pressure',
        keywords: ['SOC 2', 'compliance', 'security audit', 'enterprise customers']
      }
    ],
    'Professional Services': [
      {
        id: 'default-agency-churn',
        name: 'agency_dissatisfaction',
        description: 'Frustration with current agency/vendor triggers search',
        triggerType: 'PROBLEM',
        evidence: [],
        frequencyScore: 0.7,
        confidenceScore: 0.75,
        observableComponents: ['Negative reviews', 'LinkedIn posts about agency search'],
        typicalTimeline: 'Immediate to 30 days',
        messagingAngle: 'Reference common agency pain points without badmouthing competitors',
        keywords: ['frustrated', 'looking for agency', 'switching agencies']
      },
      {
        id: 'default-new-marketing-leader',
        name: 'new_marketing_leader',
        description: 'New CMO/VP Marketing brings new agency relationships',
        triggerType: 'TIMING',
        evidence: [],
        frequencyScore: 0.8,
        confidenceScore: 0.85,
        observableComponents: ['Marketing leadership job posting', 'LinkedIn hire announcement'],
        typicalTimeline: '30-90 days after hire',
        messagingAngle: 'Reference quick wins new marketing leaders need',
        keywords: ['CMO', 'VP Marketing', 'marketing leader']
      }
    ],
    SaaS: [
      {
        id: 'default-tool-sunset',
        name: 'tool_sunsetting',
        description: 'Current tool being deprecated forces migration',
        triggerType: 'PROBLEM',
        evidence: [],
        frequencyScore: 0.5,
        confidenceScore: 0.95,
        observableComponents: ['Vendor EOL announcement', 'Migration discussions on Reddit'],
        typicalTimeline: 'Based on sunset deadline',
        messagingAngle: 'Offer migration support and timeline alignment',
        keywords: ['sunsetting', 'end of life', 'migrating from', 'replacement']
      },
      {
        id: 'default-scale-pain',
        name: 'scaling_pain',
        description: 'Current tool hitting scale limits triggers upgrade',
        triggerType: 'PROBLEM',
        evidence: [],
        frequencyScore: 0.7,
        confidenceScore: 0.8,
        observableComponents: ['Headcount growth', 'Usage complaints on reviews'],
        typicalTimeline: '30-60 days',
        messagingAngle: 'Reference specific scale thresholds and performance needs',
        keywords: ['scaling', 'performance issues', 'hitting limits', 'outgrowing']
      }
    ]
  };

  return industryPatterns[industry] || industryPatterns.Technology;
}

export async function runVoCResearchPipeline(
  input: VoCResearchInput,
  rid: string,
  onProgress?: (status: string) => void
): Promise<Partial<VoCResearchSession> & { requestId: string }> {
  const { website, companyName, industry, competitors = [], targetCompanySize = '50-500 employees', apiKeys } = input;

  // Prefer passed API keys (from route which has proper import.meta.env access)
  // Fall back to getEnv() for backward compatibility
  const anthropicApiKey = apiKeys?.anthropic || getEnv('ANTHROPIC_API_KEY');
  const exaApiKey = apiKeys?.exa || getEnv('EXA_API_KEY');

  if (!anthropicApiKey) {
    // Log diagnostic info to help debug
    console.error(`[VoC Research][${rid}] ANTHROPIC_API_KEY not found. Diagnostics:`, {
      passedKey: apiKeys?.anthropic ? 'present' : 'missing',
      getEnvResult: getEnv('ANTHROPIC_API_KEY') ? 'present' : 'missing',
      processEnvExists: typeof process !== 'undefined' && !!process.env,
      nodeEnv: typeof process !== 'undefined' ? process.env.NODE_ENV : 'N/A'
    });
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const progress = (message: string) => {
    onProgress?.(message);
    console.log(`[VoC Research][${rid}] ${message}`);
  };

  progress(`Starting pipeline for ${companyName}`);

  progress('Step 1: Analyzing website...');
  const websiteContent = await scrapeWebsite(website);

  let websiteAnalysis: WebsiteAnalysis = createFallbackWebsiteAnalysis({ companyName, website, industry, competitors });
  if (websiteContent) {
    try {
      const extracted = await extractTriggersFromWebsite(websiteContent, companyName, anthropicApiKey);
      websiteAnalysis = normalizeWebsiteAnalysis(extracted, { companyName, website, industry, competitors });
    } catch (error) {
      console.warn(`[VoC Research][${rid}] Website extraction failed, using fallback analysis:`, error);
      websiteAnalysis = createFallbackWebsiteAnalysis({ companyName, website, industry, competitors });
    }
  }

  progress(`Website analysis complete. Industry: ${websiteAnalysis.companyProfile.industry}`);

  progress('Step 2: Mining competitor reviews...');
  const competitorsToAnalyze = competitors.length > 0 ? competitors : websiteAnalysis.competitors.slice(0, 3);

  let reviewTriggers: any[] = [];
  if (competitorsToAnalyze.length > 0) {
    try {
      reviewTriggers = await mineCompetitorReviews(competitorsToAnalyze, anthropicApiKey);
    } catch (error) {
      console.warn(`[VoC Research][${rid}] Competitor review mining failed, continuing without it:`, error);
      reviewTriggers = [];
    }
  }

  progress(`Found ${reviewTriggers.length} triggers from reviews`);

  progress('Step 3: Analyzing Reddit discussions...');
  let redditTriggers: any[] = [];

  if (exaApiKey) {
    try {
      const category = websiteAnalysis.companyProfile.services?.[0] || industry || 'software';
      const redditPosts = await searchRedditWithExa(
        category,
        websiteAnalysis.companyProfile.industry,
        competitorsToAnalyze,
        exaApiKey
      );

      if (redditPosts.length > 0) {
        redditTriggers = await extractTriggersFromReddit(
          redditPosts,
          {
            name: companyName,
            industry: websiteAnalysis.companyProfile.industry,
            category
          },
          anthropicApiKey
        );
      }
    } catch (error) {
      console.warn(`[VoC Research][${rid}] Reddit analysis failed, continuing without it:`, error);
      redditTriggers = [];
    }
  }

  progress(`Found ${redditTriggers.length} triggers from Reddit`);

  progress('Step 4: Synthesizing trigger patterns...');
  let triggerPatterns: TriggerPattern[] = [];

  if (reviewTriggers.length > 0 || redditTriggers.length > 0 || websiteAnalysis.caseStudies.length > 0) {
    try {
      triggerPatterns = await synthesizeTriggerPatterns(reviewTriggers, redditTriggers, websiteAnalysis, anthropicApiKey);
    } catch (error) {
      console.warn(`[VoC Research][${rid}] Trigger synthesis failed, falling back to defaults:`, error);
      triggerPatterns = [];
    }
  }

  if (triggerPatterns.length === 0) {
    triggerPatterns = getDefaultTriggerPatterns(websiteAnalysis.companyProfile.industry);
  }

  progress(`Synthesized ${triggerPatterns.length} trigger patterns`);

  progress('Step 5: Generating signal configurations...');
  let signalConfigurations: TriggerSignalConfiguration[] = [];

  try {
    signalConfigurations = await generateSignalConfigurations(
      triggerPatterns,
      {
        companyName,
        industry: websiteAnalysis.companyProfile.industry,
        services: websiteAnalysis.companyProfile.services || [],
        targetCompanySize
      },
      anthropicApiKey
    );
  } catch (error) {
    console.warn(`[VoC Research][${rid}] Signal configuration generation failed, using fallback configs:`, error);
    signalConfigurations = generateFallbackSignalConfigurations(triggerPatterns);
  }

  if (!Array.isArray(signalConfigurations) || signalConfigurations.length === 0) {
    signalConfigurations = generateFallbackSignalConfigurations(triggerPatterns);
  }

  progress(`Generated ${signalConfigurations.length} signal configurations`);

  const session: Partial<VoCResearchSession> & { requestId: string } = {
    id: `voc-${Date.now()}`,
    companyName,
    website,
    industry: websiteAnalysis.companyProfile.industry,
    services: websiteAnalysis.companyProfile.services,
    targetCompanySize,
    competitors: competitorsToAnalyze,
    websiteAnalysis,
    reviewTriggers,
    redditTriggers,
    synthesizedTriggers: triggerPatterns,
    signalConfigurations,
    createdAt: new Date(),
    updatedAt: new Date(),
    requestId: rid
  };

  return session;
}

