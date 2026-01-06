import type { APIRoute } from 'astro';
import Exa from 'exa-js';
import type { TriggerSignalConfiguration, CompanySignal } from '../../../lib/voc-triggers/types';
import { 
  detectSignalsForCompany, 
  calculateCompositeScore,
  rankCompaniesBySignals 
} from '../../../lib/voc-triggers/signal-translation';
import { getSecrets } from '../../../utils/database';

export const prerender = false;

interface LeadCriteria {
  industry: string;
  targetBuyer: string;
  signals: string[];
  buyerJourneyStage: string;
  // New: VoC-based signal configurations
  signalConfigurations?: TriggerSignalConfiguration[];
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const {
      industry,
      targetBuyer,
      signals,
      buyerJourneyStage,
      signalConfigurations
    } = body as LeadCriteria;

    console.log('[Generate Leads] Criteria:', { industry, signals: signals?.length || 0, buyerJourneyStage });

    // If VoC signal configurations provided, use the enhanced flow
    if (signalConfigurations && signalConfigurations.length > 0) {
      console.log('[Generate Leads] Using VoC-based signal configurations');
      const leads = await discoverCompaniesWithVoCSignals({
        industry,
        targetBuyer,
        buyerJourneyStage,
        signalConfigurations
      });
      
      return new Response(JSON.stringify({ leads, method: 'voc-signals' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Legacy flow: use simple signal matching
    const leads = await discoverCompaniesWithSignals({
      industry,
      targetBuyer,
      signals,
      buyerJourneyStage
    });

    console.log(`[Generate Leads] Found ${leads.length} matching companies`);

    return new Response(JSON.stringify({ leads, method: 'simple-signals' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Error in /api/buyer-trigger-agent/generate-leads:', err);
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
 * Enhanced lead discovery using VoC-based signal configurations
 * Uses multi-signal scoring and convergence bonuses
 */
async function discoverCompaniesWithVoCSignals(criteria: {
  industry: string;
  targetBuyer: string;
  buyerJourneyStage: string;
  signalConfigurations: TriggerSignalConfiguration[];
}) {
  // Fetch API keys from Supabase secrets
  const secrets = await getSecrets(['EXA_API_KEY', 'PERPLEXITY_API_KEY', 'ANTHROPIC_API_KEY']);
  const exaApiKey = secrets.EXA_API_KEY;
  const perplexityApiKey = secrets.PERPLEXITY_API_KEY;
  const anthropicApiKey = secrets.ANTHROPIC_API_KEY;

  if (!exaApiKey) {
    console.warn('[VoC Leads] Missing EXA_API_KEY in Supabase secrets');
    return [];
  }

  const exa = new Exa(exaApiKey);

  // Build search queries from signal configurations
  const searchQueries = criteria.signalConfigurations.flatMap(config => 
    config.signals.map(s => s.queryParameters.keywords || []).flat()
  );

  const uniqueKeywords = [...new Set(searchQueries)].slice(0, 10);
  const searchQuery = `${criteria.industry} companies (${uniqueKeywords.join(' OR ')})`;

  console.log(`[VoC Leads] Searching: "${searchQuery.slice(0, 100)}..."`);

  try {
    // Discover companies with Exa
    const exaResults = await exa.searchAndContents(searchQuery, {
      type: 'auto',
      numResults: 15,
      text: { maxCharacters: 1000 },
      category: 'company'
    });

    console.log(`[VoC Leads] Found ${exaResults.results.length} potential companies`);

    // Detect signals for each company using VoC configurations
    const companiesWithSignals = await Promise.all(
      exaResults.results.slice(0, 8).map(async (result) => {
        const companyName = extractCompanyName(result.url, result.title || '');
        
        console.log(`[VoC Leads] Analyzing ${companyName}...`);

        const detectedSignals = await detectSignalsForCompany(
          companyName,
          result.url,
          criteria.signalConfigurations,
          {
            exa: exaApiKey || undefined,
            perplexity: perplexityApiKey || undefined,
            anthropic: anthropicApiKey || ''
          }
        );

        return {
          company: companyName,
          url: result.url,
          signals: detectedSignals
        };
      })
    );

    // Rank companies by composite signal score
    const rankedCompanies = rankCompaniesBySignals(companiesWithSignals);

    // Transform to lead format
    const leads = rankedCompanies
      .filter(c => c.compositeScore > 0)
      .slice(0, 5)
      .map(c => {
        const primarySignal = c.signals[0];
        const signalTypes = [...new Set(c.signals.map(s => s.signalType))];
        const evidenceData = primarySignal?.evidence?.data || {};
        
        return {
          company: c.company,
          location: evidenceData.location || 'Unknown',
          employees: evidenceData.employees || 0,
          revenue: evidenceData.revenue || 'Not disclosed',
          score: c.compositeScore,
          primarySignal: evidenceData.analysis || primarySignal?.signalType || 'Multiple signals detected',
          evidenceUrl: primarySignal?.evidence?.url || c.company,
          tags: signalTypes.map(s => s.replace(/_/g, ' ')),
          matchReason: `${c.signals.length} signal${c.signals.length > 1 ? 's' : ''} detected • ${criteria.buyerJourneyStage} stage`,
          signals: c.signals.map(s => ({
            type: s.signalType,
            trigger: s.triggerPattern,
            confidence: s.confidence,
            messagingContext: s.messagingContext
          })),
          convergenceBonus: signalTypes.length >= 2
        };
      });

    console.log(`[VoC Leads] Returning ${leads.length} qualified leads`);
    return leads;

  } catch (error) {
    console.error('[VoC Leads] Error:', error);
    return [];
  }
}

/**
 * Legacy lead discovery using simple signal matching
 */
async function discoverCompaniesWithSignals(criteria: LeadCriteria) {
  // Fetch API keys from Supabase secrets
  const secrets = await getSecrets(['EXA_API_KEY', 'PERPLEXITY_API_KEY']);
  const exaApiKey = secrets.EXA_API_KEY;
  const perplexityApiKey = secrets.PERPLEXITY_API_KEY;

  if (!exaApiKey || !perplexityApiKey) {
    console.warn('Missing API keys in Supabase secrets, returning empty results');
    return [];
  }

  const exa = new Exa(exaApiKey);

  // Build search queries for each signal type
  const signalQueries = criteria.signals.map(signal => {
    const signalMap: Record<string, string> = {
      'hiring': 'hiring OR careers OR job openings',
      'funding': 'raised funding OR series OR investment',
      'expansion': 'expansion OR opening new office OR new location',
      'leadership_change': 'new CEO OR new CTO OR new executive OR appointed',
      'tech_adoption': 'implemented OR adopted OR migrating to',
      'product_launch': 'launched OR announcing OR introducing new product',
      'awards': 'won award OR recognized OR named leader',
      'regulatory': 'compliance OR certification OR regulatory'
    };
    return signalMap[signal] || signal;
  });

  // Search for companies in the industry with any of the signals
  const searchQuery = `${criteria.industry} companies ${signalQueries.join(' OR ')}`;

  console.log(`[Exa] Searching: "${searchQuery}"`);

  try {
    // Use Exa to find relevant companies
    const exaResults = await exa.searchAndContents(searchQuery, {
      type: 'auto',
      numResults: 10,
      text: { maxCharacters: 1000 },
      category: 'company'
    });

    console.log(`[Exa] Found ${exaResults.results.length} results`);

    // Process top companies and detect signals with Perplexity
    const leads = await Promise.all(
      exaResults.results.slice(0, 5).map(async (result) => {
        const companyName = extractCompanyName(result.url, result.title || '');

        console.log(`[Lead] Analyzing ${companyName}...`);

        // Use Perplexity to detect specific signals for this company
        const signalAnalysis = await detectSignalsWithPerplexity(
          companyName,
          criteria.signals,
          perplexityApiKey
        );

        if (!signalAnalysis.hasSignals) {
          return null;
        }

        return {
          company: companyName,
          location: signalAnalysis.location || 'Unknown',
          employees: signalAnalysis.employees || 0,
          revenue: signalAnalysis.revenue || 'Not disclosed',
          score: signalAnalysis.score,
          primarySignal: signalAnalysis.primarySignal,
          evidenceUrl: result.url,
          tags: signalAnalysis.matchingSignals,
          matchReason: `${signalAnalysis.matchingSignals.length} matching signal${signalAnalysis.matchingSignals.length > 1 ? 's' : ''} • ${criteria.buyerJourneyStage || 'consideration'} stage`
        };
      })
    );

    // Filter out nulls and return top 3
    const validLeads = leads.filter(lead => lead !== null);
    validLeads.sort((a, b) => (b?.score || 0) - (a?.score || 0));

    return validLeads.slice(0, 3);

  } catch (error) {
    console.error('[Exa] Search error:', error);
    return [];
  }
}

async function detectSignalsWithPerplexity(
  companyName: string,
  signalTypes: string[],
  apiKey: string
) {
  const signalDescriptions = signalTypes.map(s => s.replace('_', ' ')).join(', ');

  const prompt = `Research ${companyName} and tell me:
1. Any recent signals from this list: ${signalDescriptions}
2. Company location (city, state/country)
3. Approximate employee count
4. Approximate annual revenue

Focus on the most recent 90 days. Return in this format:
SIGNALS: [list any detected signals]
LOCATION: [city, state]
EMPLOYEES: [number]
REVENUE: [amount]
PRIMARY_SIGNAL: [most significant recent signal with details]`;

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [{
          role: 'user',
          content: prompt
        }],
        max_tokens: 500,
        temperature: 0.2
      })
    });

    if (!response.ok) {
      console.error(`[Perplexity] Error: ${response.status}`);
      return {
        hasSignals: false,
        matchingSignals: [],
        score: 0
      };
    }

    const data = await response.json();
    const analysis = data.choices[0].message.content;

    console.log(`[Perplexity] Analysis for ${companyName}:`, analysis);

    // Parse the response
    const signalsMatch = analysis.match(/SIGNALS:\s*(.+?)(?:\n|$)/i);
    const locationMatch = analysis.match(/LOCATION:\s*(.+?)(?:\n|$)/i);
    const employeesMatch = analysis.match(/EMPLOYEES:\s*(.+?)(?:\n|$)/i);
    const revenueMatch = analysis.match(/REVENUE:\s*(.+?)(?:\n|$)/i);
    const primaryMatch = analysis.match(/PRIMARY_SIGNAL:\s*(.+?)(?:\n|$)/i);

    const detectedSignals = signalsMatch?.[1]?.toLowerCase() || '';
    const matchingSignals = signalTypes.filter(signal =>
      detectedSignals.includes(signal.replace('_', ' '))
    );

    const hasSignals = matchingSignals.length > 0 || detectedSignals.includes('recent') || detectedSignals.includes('announced');

    // Calculate score based on signal strength and recency
    const score = hasSignals ? Math.min(95, 70 + (matchingSignals.length * 10)) : 0;

    return {
      hasSignals,
      matchingSignals: matchingSignals.map(s => s.replace('_', ' ')),
      location: locationMatch?.[1]?.trim() || null,
      employees: employeesMatch?.[1]?.match(/\d+/)?.[0] ? parseInt(employeesMatch[1].match(/\d+/)[0]) : null,
      revenue: revenueMatch?.[1]?.trim() || null,
      primarySignal: primaryMatch?.[1]?.trim() || detectedSignals.substring(0, 100),
      score
    };

  } catch (error) {
    console.error('[Perplexity] API error:', error);
    return {
      hasSignals: false,
      matchingSignals: [],
      score: 0
    };
  }
}

function extractCompanyName(url: string, title: string): string {
  // Try to extract company name from URL or title
  try {
    const domain = new URL(url).hostname.replace('www.', '');

    // If title has company name, use it
    if (title && !title.toLowerCase().includes('home') && !title.toLowerCase().includes('welcome')) {
      const titleParts = title.split('|')[0].split('-')[0].trim();
      if (titleParts.length < 50) {
        return titleParts;
      }
    }

    // Otherwise use domain
    const name = domain.split('.')[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return title || 'Unknown Company';
  }
}
