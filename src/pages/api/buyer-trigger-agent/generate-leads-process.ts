import Exa from 'exa-js';
import type { TriggerSignalConfiguration } from '../../../lib/voc-triggers/types';
import { getEnvVars, supabase } from '../../../utils/database';
import type { Lead } from '../../../lib/lead-schema';
import { 
  createEmptyLead, 
  calculateDataQuality, 
  safeParseJSON,
  COMPANY_ENRICHMENT_PROMPT,
  CONTACTS_ENRICHMENT_PROMPT
} from '../../../lib/lead-schema';

interface LeadCriteria {
  industry: string;
  targetBuyer: string;
  signals: string[];
  buyerJourneyStage: string;
  signalConfigurations?: TriggerSignalConfiguration[];
  icp?: {
    targetIndustries?: string[];
    companySize?: string;
    targetTitles?: string[];
    geography?: string;
    painPoints?: string[];
  };
}

/**
 * Process lead generation job
 * Called asynchronously after job is queued
 */
export async function processLeadGeneration(jobId: string, input: LeadCriteria) {
  const startTime = Date.now();
  
  const updateJob = async (patch: Record<string, any>) => {
    if (!supabase) return;
    await supabase
      .from('lead_generation_jobs')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', jobId);
  };

  try {
    await updateJob({ status: 'running', status_message: 'Starting lead search...' });

    const { industry, signals, buyerJourneyStage, signalConfigurations, icp } = input;

    // Get API keys
    const envVars = getEnvVars(['EXA_API_KEY', 'PERPLEXITY_API_KEY']);
    const exaApiKey = envVars.EXA_API_KEY;
    const perplexityApiKey = envVars.PERPLEXITY_API_KEY || undefined;

    if (!exaApiKey) {
      throw new Error('EXA_API_KEY not configured');
    }

    const exa = new Exa(exaApiKey);

    // Use VoC flow if signal configurations provided
    let leads: Lead[] = [];
    
    if (signalConfigurations && signalConfigurations.length > 0) {
      await updateJob({ status_message: 'Searching for companies with buying signals...' });
      leads = await discoverCompaniesWithVoCSignals(
        { industry, buyerJourneyStage, signalConfigurations, icp, signals },
        exa,
        perplexityApiKey,
        async (msg) => await updateJob({ status_message: msg })
      );
    } else {
      await updateJob({ status_message: 'Running standard search...' });
      leads = await discoverCompaniesWithSignals(
        input,
        exa,
        perplexityApiKey,
        async (msg) => await updateJob({ status_message: msg })
      );
    }

    const processingTimeMs = Date.now() - startTime;

    // Save results
    await updateJob({
      status: 'completed',
      status_message: `Found ${leads.length} leads`,
      result: {
        success: true,
        leads,
        meta: {
          totalFound: leads.length,
          returned: leads.length,
          searchCriteria: {
            industries: icp?.targetIndustries || [industry],
            companySize: icp?.companySize || '50-500 employees',
            signals: signals || signalConfigurations?.map(s => s.triggerName) || []
          },
          processingTimeMs
        }
      }
    });

  } catch (error) {
    console.error(`[Lead Gen Job ${jobId}] Error:`, error);
    await updateJob({
      status: 'failed',
      status_message: 'Failed',
      error: { message: error instanceof Error ? error.message : 'Unknown error' }
    });
  }
}

/**
 * VoC-based lead discovery with parallel enrichment
 */
async function discoverCompaniesWithVoCSignals(
  criteria: {
    industry: string;
    buyerJourneyStage: string;
    signalConfigurations: TriggerSignalConfiguration[];
    icp?: LeadCriteria['icp'];
    signals?: string[];
  },
  exa: Exa,
  perplexityApiKey: string | undefined,
  onProgress: (msg: string) => Promise<void>
): Promise<Lead[]> {
  const { industry, signalConfigurations, icp, signals } = criteria;
  
  // Parse company size
  const companySize = icp?.companySize || '50-500 employees';
  const sizeRange = parseCompanySize(companySize);

  // Filter signal configs by user selection
  const selectedConfigs = signalConfigurations.filter(config =>
    !signals || signals.length === 0 || signals.includes(config.triggerName)
  );

  // Build search queries
  const targetIndustries = icp?.targetIndustries?.slice(0, 3) || [industry || 'technology'];
  const geography = icp?.geography || '';

  const industryFilter = targetIndustries.map(i => `"${i}"`).join(' OR ');
  const geoFilter = geography ? ` ${geography}` : '';

  const searchQueries = [
    `(${industryFilter}) company (expanding OR growing OR scaling)${geoFilter} -careers -jobs`,
    `(${industryFilter}) company (hiring OR recruiting)${geoFilter} -careers -jobs`,
  ];

  await onProgress('Searching for companies...');

  // Excluded domains
  const excludedDomains = new Set([
    'linkedin.com', 'indeed.com', 'glassdoor.com', 'lever.co', 'greenhouse.io',
    'prnewswire.com', 'businesswire.com', 'twitter.com', 'facebook.com', 'wikipedia.org',
    'g2.com', 'capterra.com', 'crunchbase.com', 'youtube.com', 'medium.com'
  ]);

  // Run searches
  const allResults: any[] = [];
  for (const query of searchQueries) {
    try {
      const results = await exa.searchAndContents(query, {
        type: 'auto',
        numResults: 15,
        text: { maxCharacters: 500 },
      });
      allResults.push(...results.results);
    } catch (e) {
      console.warn(`[VoC Leads] Query failed: ${query}`);
    }
  }

  // Dedupe and filter
  const seenDomains = new Set<string>();
  const filteredResults = allResults.filter(r => {
    try {
      const domain = new URL(r.url).hostname.replace('www.', '');
      if (seenDomains.has(domain)) return false;
      if ([...excludedDomains].some(ex => domain.includes(ex))) return false;
      seenDomains.add(domain);
      return true;
    } catch {
      return false;
    }
  });

  await onProgress(`Found ${filteredResults.length} potential companies. Enriching...`);

  // Process in batches of 5 with parallel enrichment
  const leads: Lead[] = [];
  const batchSize = 5;
  const maxLeads = 15; // Limit to prevent timeouts
  
  for (let i = 0; i < filteredResults.length && leads.length < maxLeads; i += batchSize) {
    const batch = filteredResults.slice(i, i + batchSize);
    
    await onProgress(`Enriching companies ${i + 1}-${Math.min(i + batchSize, filteredResults.length)}...`);
    
    // Process batch in parallel
    const batchResults = await Promise.all(
      batch.map(async (result) => {
        const companyName = extractCompanyName(result.url, result.title || '');
        const domain = extractDomain(result.url);
        
        const lead = createEmptyLead(companyName, domain);
        
        // Quick enrichment with timeout
        if (perplexityApiKey) {
          try {
            const enrichment = await enrichWithTimeout(
              companyName, 
              domain, 
              perplexityApiKey,
              icp?.targetTitles,
              8000 // 8 second timeout per company
            );
            if (enrichment) {
              lead.company = { ...lead.company, ...enrichment.company };
              lead.contacts = enrichment.contacts;
            }
          } catch (e) {
            // Continue without enrichment
          }
        }
        
        // Use search result for description if needed
        if (!lead.company.description && result.text) {
          lead.company.description = result.text.slice(0, 200);
        }

        // Filter by size
        if (lead.company.employeeCount) {
          if (lead.company.employeeCount < sizeRange.min || lead.company.employeeCount > sizeRange.max * 1.5) {
            return null;
          }
        }

        // Score
        const matchedSignals = findMatchingSignals(result.text || '', selectedConfigs);
        let score = Math.min(100, 50 + (matchedSignals.length * 10));
        if (lead.contacts.length > 0) score = Math.min(100, score + 5);
        if (lead.company.employeeCount) score = Math.min(100, score + 3);

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
          ? `${matchedSignals.length} signal${matchedSignals.length > 1 ? 's' : ''} detected`
          : 'Matches profile';
        lead.sourceUrl = result.url;
        lead.sourceSnippet = result.text?.slice(0, 300);
        lead.dataQuality = calculateDataQuality(lead);
        
        return lead;
      })
    );
    
    // Add valid results
    for (const lead of batchResults) {
      if (lead && leads.length < maxLeads) {
        leads.push(lead);
      }
    }
  }

  // Sort and return
  return leads.sort((a, b) => b.score - a.score);
}

/**
 * Simple signal-based discovery
 */
async function discoverCompaniesWithSignals(
  criteria: LeadCriteria,
  exa: Exa,
  perplexityApiKey: string | undefined,
  onProgress: (msg: string) => Promise<void>
): Promise<Lead[]> {
  const signalMap: Record<string, string> = {
    'hiring': 'hiring OR careers',
    'funding': 'raised funding OR investment',
    'expansion': 'expansion OR new office',
    'leadership_change': 'new CEO OR appointed',
    'tech_adoption': 'implemented OR adopted',
  };

  const signalQueries = criteria.signals?.map(s => signalMap[s] || s).join(' OR ') || 'hiring';
  const searchQuery = `${criteria.industry || 'technology'} companies ${signalQueries}`;

  await onProgress('Searching for companies...');

  try {
    const results = await exa.searchAndContents(searchQuery, {
      type: 'auto',
      numResults: 10,
      text: { maxCharacters: 500 },
    });

    await onProgress(`Found ${results.results.length} companies. Processing...`);

    const leads: Lead[] = [];
    
    for (const result of results.results.slice(0, 5)) {
      const companyName = extractCompanyName(result.url, result.title || '');
      const domain = extractDomain(result.url);
      
      const lead = createEmptyLead(companyName, domain);
      lead.company.description = result.text?.slice(0, 200);
      lead.score = 70;
      lead.matchReason = 'Matches search criteria';
      lead.sourceUrl = result.url;
      lead.dataQuality = 'low';
      
      leads.push(lead);
    }

    return leads;
  } catch (error) {
    console.error('[Simple Search] Error:', error);
    return [];
  }
}

/**
 * Enrichment with timeout
 */
async function enrichWithTimeout(
  companyName: string,
  domain: string,
  apiKey: string,
  targetTitles?: string[],
  timeoutMs: number = 8000
): Promise<{ company: any; contacts: any[] } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Company info
    const companyResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: COMPANY_ENRICHMENT_PROMPT(companyName, domain) }],
        max_tokens: 300,
        temperature: 0.1
      }),
      signal: controller.signal
    });

    if (!companyResponse.ok) {
      clearTimeout(timeout);
      return null;
    }

    const companyData = await companyResponse.json();
    const companyText = companyData.choices?.[0]?.message?.content || '';
    
    // Type for parsed company data
    interface ParsedCompany {
      name?: string;
      description?: string;
      industry?: string;
      employeeCount?: number;
      revenue?: string;
      headquarters?: string;
      linkedInUrl?: string;
    }
    
    const company = safeParseJSON<ParsedCompany>(companyText, {});

    // Contacts (skip if running low on time)
    let contacts: any[] = [];
    const elapsed = Date.now();
    if (timeoutMs - elapsed > 3000) {
      try {
        const titles = targetTitles?.length ? targetTitles : ['CEO', 'VP Sales'];
        const contactsResponse = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'sonar',
            messages: [{ role: 'user', content: CONTACTS_ENRICHMENT_PROMPT(companyName, domain, titles) }],
            max_tokens: 300,
            temperature: 0.1
          }),
          signal: controller.signal
        });

        if (contactsResponse.ok) {
          const contactsData = await contactsResponse.json();
          const contactsText = contactsData.choices?.[0]?.message?.content || '';
          const parsed = safeParseJSON<any[]>(contactsText, []);
          if (Array.isArray(parsed)) {
            contacts = parsed.slice(0, 3).map(c => ({
              name: c.name || 'Unknown',
              title: c.title || 'Executive',
              linkedInUrl: c.linkedInUrl && c.linkedInUrl !== 'null' ? c.linkedInUrl : undefined
            }));
          }
        }
      } catch {
        // Skip contacts on error
      }
    }

    clearTimeout(timeout);
    
    return {
      company: {
        name: company.name || companyName,
        domain,
        website: `https://${domain}`,
        description: company.description,
        industry: company.industry,
        employeeCount: typeof company.employeeCount === 'number' ? company.employeeCount : undefined,
        revenue: company.revenue,
        headquarters: company.headquarters,
        linkedInUrl: company.linkedInUrl
      },
      contacts
    };
  } catch (error) {
    clearTimeout(timeout);
    return null;
  }
}

// Helper functions
function parseCompanySize(sizeStr: string): { min: number; max: number } {
  const ranges: Record<string, { min: number; max: number }> = {
    '1-10 employees': { min: 1, max: 10 },
    '11-50 employees': { min: 11, max: 50 },
    '51-200 employees': { min: 51, max: 200 },
    '201-500 employees': { min: 201, max: 500 },
    '501-1000 employees': { min: 501, max: 1000 },
    '1001-5000 employees': { min: 1001, max: 5000 },
    '5000+ employees': { min: 5001, max: 100000 },
  };
  return ranges[sizeStr] || { min: 50, max: 500 };
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function extractCompanyName(url: string, title: string): string {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    if (title && !title.toLowerCase().includes('home')) {
      const name = title.split('|')[0].split('-')[0].trim();
      if (name.length < 50) return name;
    }
    const name = domain.split('.')[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return title || 'Unknown';
  }
}

function findMatchingSignals(
  content: string,
  signalConfigs: TriggerSignalConfiguration[]
): Array<{ type: string; evidence: string; confidence: number }> {
  const contentLower = content.toLowerCase();
  const matches: Array<{ type: string; evidence: string; confidence: number }> = [];

  for (const config of signalConfigs) {
    for (const signal of config.signals || []) {
      const keywords = signal.queryParameters?.keywords || [];
      if (keywords.some(kw => contentLower.includes(kw.toLowerCase()))) {
        matches.push({
          type: signal.signalName,
          evidence: signal.interpretation || '',
          confidence: signal.confidence === 'HIGH' ? 75 : signal.confidence === 'MEDIUM' ? 60 : 40
        });
        break; // One match per config
      }
    }
  }
  return matches;
}

