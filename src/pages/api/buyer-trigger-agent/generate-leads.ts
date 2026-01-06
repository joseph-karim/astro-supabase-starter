import type { APIRoute } from 'astro';
import Exa from 'exa-js';
import type { TriggerSignalConfiguration, CompanySignal } from '../../../lib/voc-triggers/types';
import { 
  detectSignalsForCompany, 
  calculateCompositeScore,
  rankCompaniesBySignals 
} from '../../../lib/voc-triggers/signal-translation';
import { getEnvVars } from '../../../utils/database';

export const prerender = false;

interface LeadCriteria {
  industry: string;
  targetBuyer: string;
  signals: string[];
  buyerJourneyStage: string;
  // VoC-based signal configurations
  signalConfigurations?: TriggerSignalConfiguration[];
  // ICP details for targeted search
  icp?: {
    targetIndustries?: string[];
    companySize?: string;
    targetTitles?: string[];
    geography?: string;
    painPoints?: string[];
  };
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
 * IMPORTANT: Searches for PROSPECTS (companies that would BUY), not competitors
 */
async function discoverCompaniesWithVoCSignals(criteria: {
  industry: string;
  targetBuyer: string;
  buyerJourneyStage: string;
  signalConfigurations: TriggerSignalConfiguration[];
  // ICP details for proper prospect search
  icp?: {
    targetIndustries?: string[];
    companySize?: string;
    painPoints?: string[];
  };
}) {
  const envVars = getEnvVars(['EXA_API_KEY', 'PERPLEXITY_API_KEY', 'ANTHROPIC_API_KEY']);
  const exaApiKey = envVars.EXA_API_KEY;
  const perplexityApiKey = envVars.PERPLEXITY_API_KEY;

  if (!exaApiKey) {
    console.warn('[VoC Leads] Missing EXA_API_KEY');
    return [];
  }

  const exa = new Exa(exaApiKey);

  // Build PROSPECT search queries using ICP data
  const icp = criteria.icp || {};
  const targetIndustries = icp.targetIndustries?.slice(0, 3) || [];
  const targetTitles = icp.targetTitles?.slice(0, 2) || [criteria.targetBuyer || 'sales'];
  const geography = icp.geography || '';
  
  // Extract signal-based search terms
  const signalKeywords = criteria.signalConfigurations.flatMap(config => 
    config.signals
      .filter(s => s.queryParameters?.keywords?.length)
      .flatMap(s => s.queryParameters.keywords || [])
  ).slice(0, 6);

  // Build multiple search queries targeting PROSPECTS, not competitors
  const industryFilter = targetIndustries.length > 0 
    ? targetIndustries.join(' OR ') 
    : 'technology OR saas OR software';
  
  const geoFilter = geography ? ` ${geography}` : '';
  
  const searchQueries = [
    // Search for companies in target industries hiring target roles
    `(${industryFilter}) companies hiring (${targetTitles.join(' OR ')})${geoFilter}`,
    // Search for companies showing expansion/growth signals
    `(${industryFilter}) company (expanding OR growing OR scaling)${geoFilter} ${signalKeywords.slice(0, 2).join(' ')}`,
    // Search for companies discussing relevant pain points
    icp.painPoints?.length 
      ? `(${industryFilter}) "${icp.painPoints[0]}"${geoFilter}`
      : `(${industryFilter}) "looking for solutions"${geoFilter}`,
  ];

  console.log(`[VoC Leads] Searching for PROSPECTS (not competitors)`);
  console.log(`[VoC Leads] Queries:`, searchQueries);

  try {
    // Run multiple searches in parallel to find diverse prospects
    const allResults: any[] = [];
    
    for (const query of searchQueries.slice(0, 2)) {
      try {
        const results = await exa.searchAndContents(query, {
          type: 'auto',
          numResults: 15,
          text: { maxCharacters: 500 },
        });
        allResults.push(...results.results);
      } catch (e) {
        console.warn(`[VoC Leads] Query failed: ${query}`, e);
      }
    }

    // Dedupe by domain
    const seenDomains = new Set<string>();
    const uniqueResults = allResults.filter(r => {
      try {
        const domain = new URL(r.url).hostname.replace('www.', '');
        if (seenDomains.has(domain)) return false;
        seenDomains.add(domain);
        return true;
      } catch {
        return false;
      }
    });

    console.log(`[VoC Leads] Found ${uniqueResults.length} unique potential prospects`);

    // Enrich and score each prospect
    const leads = await Promise.all(
      uniqueResults.slice(0, 25).map(async (result) => {
        const companyName = extractCompanyName(result.url, result.title || '');
        const domain = extractDomain(result.url);
        
        // Quick enrichment from Perplexity if available
        let enrichment = {
          employees: 0,
          revenue: 'Unknown',
          location: 'Unknown',
          description: result.text?.slice(0, 200) || ''
        };
        
        if (perplexityApiKey) {
          try {
            enrichment = await enrichCompanyWithPerplexity(companyName, domain, perplexityApiKey);
          } catch (e) {
            console.warn(`[VoC Leads] Enrichment failed for ${companyName}`);
          }
        }

        // Score based on signal matches
        const matchedSignals = findMatchingSignals(result.text || '', criteria.signalConfigurations);
        const score = Math.min(100, 50 + (matchedSignals.length * 10));

        return {
          company: companyName,
          domain: domain,
          website: `https://${domain}`,
          location: enrichment.location,
          employees: enrichment.employees,
          revenue: enrichment.revenue,
          description: enrichment.description,
          score: score,
          signals: matchedSignals.map(s => ({
            type: s.type,
            evidence: s.evidence,
            confidence: s.confidence
          })),
          matchReason: matchedSignals.length > 0 
            ? `${matchedSignals.length} buying signal${matchedSignals.length > 1 ? 's' : ''} detected`
            : 'Matches target profile',
          evidenceUrl: result.url,
          sourceSnippet: result.text?.slice(0, 300)
        };
      })
    );

    // Sort by score and return top results
    const sortedLeads = leads
      .filter(l => l.score > 40)
      .sort((a, b) => b.score - a.score)
      .slice(0, 25);

    console.log(`[VoC Leads] Returning ${sortedLeads.length} qualified prospects`);
    return sortedLeads;

  } catch (error) {
    console.error('[VoC Leads] Error:', error);
    return [];
  }
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

/**
 * Quick company enrichment using Perplexity
 */
async function enrichCompanyWithPerplexity(
  companyName: string,
  domain: string,
  apiKey: string
): Promise<{ employees: number; revenue: string; location: string; description: string }> {
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{
          role: 'user',
          content: `Quick facts about ${companyName} (${domain}): employee count, headquarters location, estimated revenue, and one-sentence description. Format: EMPLOYEES: [number], LOCATION: [city], REVENUE: [amount], DESCRIPTION: [one sentence]`
        }],
        max_tokens: 200,
        temperature: 0.1
      })
    });

    if (!response.ok) throw new Error('Perplexity API error');
    
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    
    const employeesMatch = text.match(/EMPLOYEES:\s*(\d[\d,]*)/i);
    const locationMatch = text.match(/LOCATION:\s*([^,\n]+)/i);
    const revenueMatch = text.match(/REVENUE:\s*([^\n]+)/i);
    const descMatch = text.match(/DESCRIPTION:\s*([^\n]+)/i);
    
    return {
      employees: employeesMatch ? parseInt(employeesMatch[1].replace(/,/g, '')) : 0,
      location: locationMatch?.[1]?.trim() || 'Unknown',
      revenue: revenueMatch?.[1]?.trim() || 'Unknown',
      description: descMatch?.[1]?.trim() || ''
    };
  } catch {
    return { employees: 0, revenue: 'Unknown', location: 'Unknown', description: '' };
  }
}

/**
 * Find signals that match in the company content
 */
function findMatchingSignals(
  content: string,
  signalConfigs: TriggerSignalConfiguration[]
): Array<{ type: string; evidence: string; confidence: number }> {
  const contentLower = content.toLowerCase();
  const matches: Array<{ type: string; evidence: string; confidence: number }> = [];
  
  for (const config of signalConfigs) {
    for (const signal of config.signals) {
      const keywords = signal.queryParameters?.keywords || [];
      const matchedKeywords = keywords.filter(kw => 
        contentLower.includes(kw.toLowerCase())
      );
      
      if (matchedKeywords.length > 0) {
        matches.push({
          type: config.triggerName,
          evidence: `Mentions: ${matchedKeywords.join(', ')}`,
          confidence: Math.min(95, 50 + (matchedKeywords.length * 15))
        });
        break; // One match per config is enough
      }
    }
  }
  
  return matches;
}

/**
 * Legacy lead discovery using simple signal matching
 */
async function discoverCompaniesWithSignals(criteria: LeadCriteria) {
  // Get API keys from environment variables
  const envVars = getEnvVars(['EXA_API_KEY', 'PERPLEXITY_API_KEY']);
  const exaApiKey = envVars.EXA_API_KEY;
  const perplexityApiKey = envVars.PERPLEXITY_API_KEY;

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
