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
  extractTriggersFromReviews,
  extractTriggersFromReddit,
  synthesizeTriggerPatterns,
  searchRedditWithExa,
  mineCompetitorReviews
} from '../../../lib/voc-triggers/extraction';
import {
  generateSignalConfigurations
} from '../../../lib/voc-triggers/signal-translation';
import type { VoCResearchSession, TriggerPattern } from '../../../lib/voc-triggers/types';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { 
      website, 
      companyName, 
      industry,
      competitors = [],
      targetCompanySize = '50-500 employees'
    } = body;

    if (!website || !companyName) {
      return new Response(JSON.stringify({ 
        error: 'Website and company name are required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const anthropicApiKey = import.meta.env.ANTHROPIC_API_KEY;
    const exaApiKey = import.meta.env.EXA_API_KEY;

    if (!anthropicApiKey) {
      return new Response(JSON.stringify({ 
        error: 'ANTHROPIC_API_KEY is not configured' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[VoC Research] Starting pipeline for ${companyName}`);

    // Step 1: Scrape and analyze website
    console.log('[VoC Research] Step 1: Analyzing website...');
    const websiteContent = await scrapeWebsite(website);
    
    let websiteAnalysis;
    if (websiteContent) {
      websiteAnalysis = await extractTriggersFromWebsite(
        websiteContent,
        companyName,
        anthropicApiKey
      );
    } else {
      // Fallback website analysis
      websiteAnalysis = {
        companyProfile: {
          name: companyName,
          industry: industry || 'Technology',
          services: [],
          positioning: '',
          targetMarkets: []
        },
        caseStudies: [],
        testimonials: [],
        competitors: competitors
      };
    }

    console.log(`[VoC Research] Website analysis complete. Industry: ${websiteAnalysis.companyProfile.industry}`);

    // Step 2: Mine competitor reviews
    console.log('[VoC Research] Step 2: Mining competitor reviews...');
    const competitorsToAnalyze = competitors.length > 0 
      ? competitors 
      : websiteAnalysis.competitors.slice(0, 3);

    let reviewTriggers: any[] = [];
    if (competitorsToAnalyze.length > 0) {
      reviewTriggers = await mineCompetitorReviews(
        competitorsToAnalyze,
        anthropicApiKey
      );
    }

    console.log(`[VoC Research] Found ${reviewTriggers.length} triggers from reviews`);

    // Step 3: Search Reddit for triggers
    console.log('[VoC Research] Step 3: Analyzing Reddit discussions...');
    let redditTriggers: any[] = [];
    
    if (exaApiKey) {
      const category = websiteAnalysis.companyProfile.services[0] || industry || 'software';
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
    }

    console.log(`[VoC Research] Found ${redditTriggers.length} triggers from Reddit`);

    // Step 4: Synthesize trigger patterns
    console.log('[VoC Research] Step 4: Synthesizing trigger patterns...');
    let triggerPatterns: TriggerPattern[] = [];
    
    if (reviewTriggers.length > 0 || redditTriggers.length > 0 || websiteAnalysis.caseStudies.length > 0) {
      triggerPatterns = await synthesizeTriggerPatterns(
        reviewTriggers,
        redditTriggers,
        websiteAnalysis,
        anthropicApiKey
      );
    }

    // If no triggers found, generate default patterns based on industry
    if (triggerPatterns.length === 0) {
      triggerPatterns = getDefaultTriggerPatterns(websiteAnalysis.companyProfile.industry);
    }

    console.log(`[VoC Research] Synthesized ${triggerPatterns.length} trigger patterns`);

    // Step 5: Generate signal configurations
    console.log('[VoC Research] Step 5: Generating signal configurations...');
    const signalConfigurations = await generateSignalConfigurations(
      triggerPatterns,
      {
        companyName,
        industry: websiteAnalysis.companyProfile.industry,
        services: websiteAnalysis.companyProfile.services,
        targetCompanySize
      },
      anthropicApiKey
    );

    console.log(`[VoC Research] Generated ${signalConfigurations.length} signal configurations`);

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

    return new Response(JSON.stringify(session), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('VoC Research Pipeline Error:', err);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: err instanceof Error ? err.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

/**
 * Scrape website using Jina Reader
 */
async function scrapeWebsite(url: string): Promise<string | null> {
  try {
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

