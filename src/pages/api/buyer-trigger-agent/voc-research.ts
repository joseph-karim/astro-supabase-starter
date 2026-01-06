/**
 * VoC Research Pipeline API
 * 
 * Orchestrates the full voice-of-customer trigger discovery flow:
 * 1. Website analysis
 * 2. Review mining
 * 3. Reddit/forum analysis
 * 4. Trigger synthesis
 * 5. Signal configuration generation
 */

import type { APIRoute } from 'astro';
import {
  extractTriggersFromWebsite,
  extractTriggersFromReddit,
  synthesizeTriggerPatterns,
  searchRedditWithExa,
  mineCompetitorReviews
} from '../../../lib/voc-triggers/extraction';
import {
  generateSignalConfigurations
} from '../../../lib/voc-triggers/signal-translation';
import type { TriggerPattern, TriggerSignalConfiguration, VoCResearchSession, WebsiteAnalysis } from '../../../lib/voc-triggers/types';

export const prerender = false;

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function jsonResponse(payload: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('Cache-Control', 'no-store');
  for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value);
  return new Response(JSON.stringify(payload), { ...init, headers });
}

async function parseJsonBody(request: Request): Promise<any> {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.toLowerCase().includes('application/json')) {
    return await request.json();
  }
  const raw = await request.text();
  if (!raw) return {};
  return JSON.parse(raw);
}

function requestId() {
  try {
    const uuid = (globalThis.crypto as any)?.randomUUID?.();
    if (uuid) return uuid;
  } catch {
    // ignore
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeWebsiteAnalysis(
  input: any,
  params: { companyName: string; website: string; industry?: string; competitors?: string[] }
): WebsiteAnalysis {
  const fallback = createFallbackWebsiteAnalysis(params);
  if (!input || typeof input !== 'object') return fallback;

  const companyProfile = (input as any).companyProfile && typeof (input as any).companyProfile === 'object'
    ? (input as any).companyProfile
    : {};

  return {
    companyProfile: {
      name: typeof companyProfile.name === 'string' && companyProfile.name.trim().length > 0 ? companyProfile.name : params.companyName,
      industry: typeof companyProfile.industry === 'string' && companyProfile.industry.trim().length > 0 ? companyProfile.industry : (params.industry || fallback.companyProfile.industry),
      services: Array.isArray(companyProfile.services) ? companyProfile.services.filter((s: any) => typeof s === 'string' && s.trim()).slice(0, 12) : [],
      positioning: typeof companyProfile.positioning === 'string' ? companyProfile.positioning : '',
      targetMarkets: Array.isArray(companyProfile.targetMarkets) ? companyProfile.targetMarkets.filter((s: any) => typeof s === 'string' && s.trim()).slice(0, 12) : []
    },
    caseStudies: Array.isArray((input as any).caseStudies) ? (input as any).caseStudies : [],
    testimonials: Array.isArray((input as any).testimonials) ? (input as any).testimonials : [],
    competitors: Array.isArray((input as any).competitors)
      ? (input as any).competitors.filter((c: any) => typeof c === 'string' && c.trim()).slice(0, 10)
      : (params.competitors || fallback.competitors)
  };
}

function createFallbackWebsiteAnalysis(params: { companyName: string; website: string; industry?: string; competitors?: string[] }): WebsiteAnalysis {
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

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const POST: APIRoute = async ({ request }) => {
  const rid = requestId();
  try {
    let body: any;
    try {
      body = await parseJsonBody(request);
    } catch (error) {
      return jsonResponse(
        {
          error: 'Invalid JSON body',
          details: error instanceof Error ? error.message : 'Unknown error',
          requestId: rid
        },
        { status: 400 }
      );
    }
    const { 
      website, 
      companyName, 
      industry,
      competitors = [],
      targetCompanySize = '50-500 employees'
    } = body;

    if (!website || !companyName) {
      return jsonResponse({ error: 'Website and company name are required' }, { status: 400 });
    }

    const anthropicApiKey =
      import.meta.env.ANTHROPIC_API_KEY ?? (globalThis as any).process?.env?.ANTHROPIC_API_KEY;
    const exaApiKey = import.meta.env.EXA_API_KEY ?? (globalThis as any).process?.env?.EXA_API_KEY;

    if (!anthropicApiKey) {
      return jsonResponse({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 });
    }

    console.log(`[VoC Research][${rid}] Starting pipeline for ${companyName}`);

    // Step 1: Scrape and analyze website
    console.log(`[VoC Research][${rid}] Step 1: Analyzing website...`);
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

    console.log(`[VoC Research][${rid}] Website analysis complete. Industry: ${websiteAnalysis.companyProfile.industry}`);

    // Step 2: Mine competitor reviews
    console.log(`[VoC Research][${rid}] Step 2: Mining competitor reviews...`);
    const competitorsToAnalyze = competitors.length > 0 
      ? competitors 
      : websiteAnalysis.competitors.slice(0, 3);

    let reviewTriggers: any[] = [];
    if (competitorsToAnalyze.length > 0) {
      try {
        reviewTriggers = await mineCompetitorReviews(competitorsToAnalyze, anthropicApiKey);
      } catch (error) {
        console.warn(`[VoC Research][${rid}] Competitor review mining failed, continuing without it:`, error);
        reviewTriggers = [];
      }
    }

    console.log(`[VoC Research][${rid}] Found ${reviewTriggers.length} triggers from reviews`);

    // Step 3: Search Reddit for triggers
    console.log(`[VoC Research][${rid}] Step 3: Analyzing Reddit discussions...`);
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

    console.log(`[VoC Research][${rid}] Found ${redditTriggers.length} triggers from Reddit`);

    // Step 4: Synthesize trigger patterns
    console.log(`[VoC Research][${rid}] Step 4: Synthesizing trigger patterns...`);
    let triggerPatterns: TriggerPattern[] = [];
    
    if (reviewTriggers.length > 0 || redditTriggers.length > 0 || websiteAnalysis.caseStudies.length > 0) {
      try {
        triggerPatterns = await synthesizeTriggerPatterns(
          reviewTriggers,
          redditTriggers,
          websiteAnalysis,
          anthropicApiKey
        );
      } catch (error) {
        console.warn(`[VoC Research][${rid}] Trigger synthesis failed, falling back to defaults:`, error);
        triggerPatterns = [];
      }
    }

    // If no triggers found, generate default patterns based on industry
    if (triggerPatterns.length === 0) {
      triggerPatterns = getDefaultTriggerPatterns(websiteAnalysis.companyProfile.industry);
    }

    console.log(`[VoC Research][${rid}] Synthesized ${triggerPatterns.length} trigger patterns`);

    // Step 5: Generate signal configurations
    console.log(`[VoC Research][${rid}] Step 5: Generating signal configurations...`);
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

    console.log(`[VoC Research][${rid}] Generated ${signalConfigurations.length} signal configurations`);

    // Compile results
    const session: Partial<VoCResearchSession> = {
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
      updatedAt: new Date()
    };

    return jsonResponse({ ...session, requestId: rid }, { status: 200 });

  } catch (err) {
    console.error(`[VoC Research][${rid}] Pipeline Error:`, err);
    return jsonResponse({
      error: 'Internal server error',
      details: err instanceof Error ? err.message : 'Unknown error',
      requestId: rid
    }, { status: 500 });
  }
};

/**
 * Scrape website using Jina Reader
 */
async function scrapeWebsite(url: string): Promise<string | null> {
  try {
    const crawl4aiEndpoint =
      import.meta.env.CRAWL4AI_ENDPOINT ?? (globalThis as any).process?.env?.CRAWL4AI_ENDPOINT;
    if (crawl4aiEndpoint) {
      const crawl4aiContent = await scrapeWithCrawl4AI(crawl4aiEndpoint, url);
      if (crawl4aiContent) return crawl4aiContent.slice(0, 20000);
    }

    const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`;

    const response = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/plain',
        'X-Return-Format': 'markdown'
      }
    });

    if (!response.ok) {
      console.error(`Website scrape failed: ${response.status}`);
      return null;
    }

    const markdown = await response.text();
    return markdown.slice(0, 20000); // Limit for LLM context

  } catch (error) {
    console.error('Website scraping error:', error);
    return null;
  }
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
        headers: { 'Accept': 'application/json, text/plain;q=0.9' }
      });
    } else {
      response = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ url, format: 'markdown' })
      });
    }

    if (!response.ok) {
      console.warn(`Crawl4AI scrape failed: ${response.status}`);
      return null;
    }

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
  } catch (error) {
    console.warn('Crawl4AI scraping error:', error);
    return null;
  }
}

/**
 * Get default trigger patterns for common industries
 */
function getDefaultTriggerPatterns(industry: string): TriggerPattern[] {
  const industryPatterns: Record<string, TriggerPattern[]> = {
    'Technology': [
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
    'SaaS': [
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

  // Return industry-specific patterns or generic technology patterns
  return industryPatterns[industry] || industryPatterns['Technology'];
}
