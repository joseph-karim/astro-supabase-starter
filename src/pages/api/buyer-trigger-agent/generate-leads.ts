import type { APIRoute } from 'astro';
import Exa from 'exa-js';
import type { TriggerSignalConfiguration } from '../../../lib/voc-triggers/types';
import { getEnvVars } from '../../../utils/database';
import type { 
  Lead, 
  LeadContact, 
  CompanyProfile, 
  DetectedSignal,
  LeadGenerationResponse 
} from '../../../lib/lead-schema';
import { 
  createEmptyLead, 
  calculateDataQuality, 
  safeParseJSON,
  COMPANY_ENRICHMENT_PROMPT,
  CONTACTS_ENRICHMENT_PROMPT
} from '../../../lib/lead-schema';

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
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const {
      industry,
      targetBuyer,
      signals,
      buyerJourneyStage,
      signalConfigurations,
      icp
    } = body as LeadCriteria;

    console.log('[Generate Leads] Criteria:', { 
      industry, 
      signals: signals?.length || 0, 
      buyerJourneyStage,
      icp: icp ? 'provided' : 'not provided'
    });

    // If VoC signal configurations provided, use the enhanced flow
    if (signalConfigurations && signalConfigurations.length > 0) {
      console.log('[Generate Leads] Using VoC-based signal configurations');
      const leads = await discoverCompaniesWithVoCSignals({
        industry,
        targetBuyer,
        buyerJourneyStage,
        signalConfigurations,
        icp  // Pass ICP to the function
      });
      
      const response: LeadGenerationResponse = {
        success: true,
        leads,
        meta: {
          totalFound: leads.length,
          returned: leads.length,
          searchCriteria: {
            industries: icp?.targetIndustries || [industry],
            companySize: icp?.companySize || '50-500 employees',
            signals: signals || signalConfigurations.map(s => s.triggerName)
          },
          processingTimeMs: Date.now() - startTime
        }
      };
      
      return new Response(JSON.stringify(response), {
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

    const response: LeadGenerationResponse = {
      success: true,
      leads,
      meta: {
        totalFound: leads.length,
        returned: leads.length,
        searchCriteria: {
          industries: [industry],
          companySize: '50-500 employees',
          signals: signals || []
        },
        processingTimeMs: Date.now() - startTime
      }
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Error in /api/buyer-trigger-agent/generate-leads:', err);
    
    const errorResponse: LeadGenerationResponse = {
      success: false,
      leads: [],
      meta: {
        totalFound: 0,
        returned: 0,
        searchCriteria: { industries: [], companySize: '', signals: [] },
        processingTimeMs: Date.now() - startTime
      },
      errors: [err instanceof Error ? err.message : 'Unknown error']
    };
    
    return new Response(JSON.stringify(errorResponse), {
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
    targetTitles?: string[];
    geography?: string;
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
  const targetTitles = icp.targetTitles?.slice(0, 2) || [criteria.targetBuyer || 'decision maker'];
  const geography = icp.geography || '';
  const companySize = icp.companySize || '50-500 employees';
  
  // Parse company size range for filtering
  const sizeRange = parseCompanySize(companySize);
  
  // Domains to exclude (job boards, career sites, news aggregators, etc.)
  const excludedDomains = new Set([
    'linkedin.com', 'indeed.com', 'glassdoor.com', 'ziprecruiter.com',
    'monster.com', 'careerbuilder.com', 'lever.co', 'greenhouse.io',
    'workday.com', 'jobs.lever.co', 'boards.greenhouse.io',
    'news.ycombinator.com', 'reddit.com', 'twitter.com', 'x.com',
    'youtube.com', 'facebook.com', 'instagram.com', 'tiktok.com',
    'prnewswire.com', 'businesswire.com', 'globenewswire.com',
    'wikipedia.org', 'crunchbase.com', 'pitchbook.com',
    'g2.com', 'capterra.com', 'trustpilot.com',
    'careers.', '.jobs.', '/careers', '/jobs'
  ]);
  
  // Extract signal-based search terms
  const signalKeywords = criteria.signalConfigurations?.flatMap(config => 
    config.signals
      ?.filter(s => s.queryParameters?.keywords?.length)
      ?.flatMap(s => s.queryParameters.keywords || []) || []
  ).slice(0, 6) || [];

  // Build search queries focused on finding actual companies (not job boards)
  const industryFilter = targetIndustries.length > 0 
    ? targetIndustries.join(' OR ') 
    : 'B2B services OR professional services OR consulting';
  
  const geoFilter = geography ? ` ${geography}` : '';
  
  // Size-appropriate search terms
  const sizeTerms = sizeRange.max <= 50 
    ? 'startup OR "small business" OR boutique OR agency'
    : sizeRange.max <= 200 
    ? 'mid-size OR growing OR "series A" OR "series B"'
    : 'enterprise OR established';
  
  const searchQueries = [
    // Search for companies matching size and industry
    `site:.com (${industryFilter}) company (${sizeTerms})${geoFilter} -careers -jobs -hiring`,
    // Search for companies with growth indicators
    `(${industryFilter}) (${sizeTerms}) "about us" OR "our team"${geoFilter} -careers -jobs`,
    // Search based on pain points if available
    ...(icp.painPoints?.length 
      ? [`(${industryFilter}) company "${icp.painPoints[0]}"${geoFilter}`]
      : []),
  ];

  console.log(`[VoC Leads] ICP: ${companySize}, Industries: ${targetIndustries.join(', ')}`);
  console.log(`[VoC Leads] Size range: ${sizeRange.min}-${sizeRange.max} employees`);
  console.log(`[VoC Leads] Queries:`, searchQueries.slice(0, 2));

  try {
    // Run searches
    const allResults: any[] = [];
    
    for (const query of searchQueries.slice(0, 2)) {
      try {
        const results = await exa.searchAndContents(query, {
          type: 'auto',
          numResults: 20,
          text: { maxCharacters: 500 },
        });
        allResults.push(...results.results);
      } catch (e) {
        console.warn(`[VoC Leads] Query failed: ${query}`, e);
      }
    }

    // Filter and dedupe results
    const seenDomains = new Set<string>();
    const filteredResults = allResults.filter(r => {
      try {
        const url = new URL(r.url);
        const domain = url.hostname.replace('www.', '');
        const fullUrl = r.url.toLowerCase();
        
        // Skip if already seen
        if (seenDomains.has(domain)) return false;
        
        // Skip excluded domains
        if ([...excludedDomains].some(ex => domain.includes(ex) || fullUrl.includes(ex))) {
          console.log(`[VoC Leads] Excluded: ${domain}`);
          return false;
        }
        
        // Skip career/jobs pages
        if (fullUrl.includes('/career') || fullUrl.includes('/job') || fullUrl.includes('/hiring')) {
          return false;
        }
        
        seenDomains.add(domain);
        return true;
      } catch {
        return false;
      }
    });

    console.log(`[VoC Leads] After filtering: ${filteredResults.length} results (from ${allResults.length})`);

    // Enrich and filter by company size
    const leads: Lead[] = [];
    const targetTitles = icp.targetTitles || [];
    
    for (const result of filteredResults.slice(0, 30)) {
      const companyName = extractCompanyName(result.url, result.title || '');
      const domain = extractDomain(result.url);
      
      // Create base lead structure
      const lead = createEmptyLead(companyName, domain);
      
      // Full enrichment from Perplexity (includes contacts)
      if (perplexityApiKey) {
        try {
          const enrichment = await enrichCompanyWithPerplexity(companyName, domain, perplexityApiKey, targetTitles);
          
          // Merge enriched company data
          lead.company = {
            ...lead.company,
            ...enrichment.company
          };
          lead.contacts = enrichment.contacts;
        } catch (e) {
          console.warn(`[VoC Leads] Enrichment failed for ${companyName}`);
        }
      }
      
      // Fallback description from search result
      if (!lead.company.description && result.text) {
        lead.company.description = result.text.slice(0, 200);
      }

      // FILTER BY COMPANY SIZE
      if (lead.company.employeeCount && lead.company.employeeCount > 0) {
        if (lead.company.employeeCount < sizeRange.min || lead.company.employeeCount > sizeRange.max * 1.5) {
          console.log(`[VoC Leads] Size mismatch: ${companyName} has ${lead.company.employeeCount} employees (want ${sizeRange.min}-${sizeRange.max})`);
          continue; // Skip this company
        }
      }

      // Score based on signal matches + data quality
      const matchedSignals = findMatchingSignals(result.text || '', criteria.signalConfigurations || []);
      let score = Math.min(100, 50 + (matchedSignals.length * 10));
      
      // Bonus for having contacts
      if (lead.contacts.length > 0) {
        score = Math.min(100, score + 5);
      }
      
      // Bonus for having company info
      if (lead.company.employeeCount) score = Math.min(100, score + 3);
      if (lead.company.industry) score = Math.min(100, score + 2);

      // Map detected signals to schema
      lead.signals = matchedSignals.map((s, idx) => ({
        id: `signal_${idx}`,
        type: s.type,
        label: s.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        evidence: s.evidence,
        confidence: s.confidence,
        sourceUrl: result.url
      }));
      
      lead.score = score;
      lead.matchReason = matchedSignals.length > 0 
        ? `${matchedSignals.length} buying signal${matchedSignals.length > 1 ? 's' : ''} detected`
        : 'Matches target profile';
      lead.sourceUrl = result.url;
      lead.sourceSnippet = result.text?.slice(0, 300);
      lead.dataQuality = calculateDataQuality(lead);
      
      leads.push(lead);
      
      // Stop if we have enough leads
      if (leads.length >= 25) break;
    }

    // Sort by score and return
    const sortedLeads = leads
      .sort((a, b) => b.score - a.score)
      .slice(0, 25);

    console.log(`[VoC Leads] Returning ${sortedLeads.length} qualified prospects (filtered by size: ${companySize})`);
    return sortedLeads;

  } catch (error) {
    console.error('[VoC Leads] Error:', error);
    return [];
  }
}

/**
 * Parse company size string into min/max employee range
 */
function parseCompanySize(sizeStr: string): { min: number; max: number } {
  const ranges: Record<string, { min: number; max: number }> = {
    '1-10 employees': { min: 1, max: 10 },
    '11-50 employees': { min: 11, max: 50 },
    '50-200 employees': { min: 50, max: 200 },
    '200-1000 employees': { min: 200, max: 1000 },
    '1000+ employees': { min: 1000, max: 50000 },
  };
  
  // Try exact match first
  if (ranges[sizeStr]) return ranges[sizeStr];
  
  // Try to parse from string like "50-500 employees"
  const match = sizeStr.match(/(\d+)[-–](\d+)/);
  if (match) {
    return { min: parseInt(match[1]), max: parseInt(match[2]) };
  }
  
  // Default to mid-market
  return { min: 50, max: 500 };
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

interface EnrichmentResult {
  company: Partial<CompanyProfile>;
  contacts: LeadContact[];
}

/**
 * Full company enrichment using Perplexity with structured JSON output
 */
async function enrichCompanyWithPerplexity(
  companyName: string,
  domain: string,
  apiKey: string,
  targetTitles?: string[]
): Promise<EnrichmentResult> {
  const defaultResult: EnrichmentResult = {
    company: {
      name: companyName,
      domain: domain,
      website: `https://${domain}`
    },
    contacts: []
  };

  try {
    // First call: Get company info with structured JSON prompt
    const companyResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{
          role: 'user',
          content: COMPANY_ENRICHMENT_PROMPT(companyName, domain)
        }],
        max_tokens: 400,
        temperature: 0.1
      })
    });

    if (companyResponse.ok) {
      const companyData = await companyResponse.json();
      const companyText = companyData.choices?.[0]?.message?.content || '';
      
      // Parse structured JSON response
      const parsed = safeParseJSON<any>(companyText, {});
      
      defaultResult.company = {
        name: parsed.name || companyName,
        domain: domain,
        website: `https://${domain}`,
        description: parsed.description || undefined,
        industry: parsed.industry || undefined,
        founded: parsed.founded?.toString() || undefined,
        employeeCount: typeof parsed.employeeCount === 'number' ? parsed.employeeCount : undefined,
        employeeRange: parsed.employeeRange || undefined,
        revenue: parsed.revenue || undefined,
        headquarters: parsed.headquarters || undefined,
        linkedInUrl: parsed.linkedInUrl || undefined
      };
    }

    // Second call: Find key contacts with structured JSON prompt
    const titles = targetTitles?.length ? targetTitles : ['CEO', 'Founder', 'VP Sales', 'Head of Growth'];
    
    const contactsResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{
          role: 'user',
          content: CONTACTS_ENRICHMENT_PROMPT(companyName, domain, titles)
        }],
        max_tokens: 400,
        temperature: 0.1
      })
    });

    if (contactsResponse.ok) {
      const contactsData = await contactsResponse.json();
      const contactsText = contactsData.choices?.[0]?.message?.content || '';
      
      // Parse structured JSON array
      const parsed = safeParseJSON<any[]>(contactsText, []);
      
      if (Array.isArray(parsed)) {
        defaultResult.contacts = parsed.slice(0, 3).map(c => ({
          name: c.name || 'Unknown',
          title: c.title || 'Executive',
          linkedInUrl: c.linkedInUrl && c.linkedInUrl !== 'null' ? c.linkedInUrl : undefined
        }));
      }
    }

    return defaultResult;
  } catch (err) {
    console.warn(`[Enrichment] Failed for ${companyName}:`, err);
    return defaultResult;
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
    const leads: Lead[] = [];
    
    for (const result of exaResults.results.slice(0, 5)) {
      const companyName = extractCompanyName(result.url, result.title || '');
      const domain = extractDomain(result.url);

      console.log(`[Lead] Analyzing ${companyName}...`);

      // Use Perplexity to detect specific signals for this company
      const signalAnalysis = await detectSignalsWithPerplexity(
        companyName,
        criteria.signals,
        perplexityApiKey
      );

      if (!signalAnalysis.hasSignals) {
        continue;
      }

      // Create lead using the new schema
      const lead = createEmptyLead(companyName, domain);
      
      // Update company info
      lead.company.headquarters = signalAnalysis.location || undefined;
      lead.company.employeeCount = signalAnalysis.employees || undefined;
      lead.company.revenue = signalAnalysis.revenue || undefined;
      
      // Map signals to new format
      lead.signals = signalAnalysis.matchingSignals.map((signal: string, idx: number) => ({
        id: `signal_${idx}`,
        type: signal.replace(/ /g, '_'),
        label: signal,
        evidence: signalAnalysis.primarySignal || '',
        confidence: signalAnalysis.score,
        sourceUrl: result.url
      }));
      
      lead.score = signalAnalysis.score;
      lead.matchReason = `${signalAnalysis.matchingSignals.length} matching signal${signalAnalysis.matchingSignals.length > 1 ? 's' : ''} detected`;
      lead.sourceUrl = result.url;
      lead.dataQuality = calculateDataQuality(lead);
      
      leads.push(lead);
    }

    // Sort by score and return top 3
    leads.sort((a, b) => b.score - a.score);
    return leads.slice(0, 3);

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
