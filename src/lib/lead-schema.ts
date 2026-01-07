/**
 * Structured Lead Schema
 * Defines the data model for prospect/lead output
 */

// ============================================
// Contact Schema
// ============================================
export interface LeadContact {
  name: string;
  title: string;
  linkedInUrl?: string;
  email?: string;  // If discoverable
}

// ============================================
// Signal Schema
// ============================================
export interface DetectedSignal {
  id: string;
  type: string;           // e.g., "hiring", "funding", "expansion"
  label: string;          // Human-readable label
  evidence: string;       // What was found
  confidence: number;     // 0-100
  sourceUrl?: string;     // Where the signal was detected
  detectedAt?: string;    // ISO date string
}

// ============================================
// Company Profile Schema
// ============================================
export interface CompanyProfile {
  name: string;
  domain: string;
  website: string;
  
  // Basic Info
  description?: string;
  industry?: string;
  founded?: string;
  
  // Size & Financials
  employeeCount?: number;
  employeeRange?: string;  // e.g., "50-200"
  revenue?: string;        // e.g., "$10M-$50M"
  funding?: string;        // e.g., "Series B, $25M"
  
  // Location
  headquarters?: string;
  country?: string;
  
  // Social Links
  linkedInUrl?: string;
  twitterUrl?: string;
}

// ============================================
// Full Lead Schema
// ============================================
export interface Lead {
  // Unique identifier
  id: string;
  
  // Company Information
  company: CompanyProfile;
  
  // Decision Makers
  contacts: LeadContact[];
  
  // Scoring
  score: number;           // 0-100 composite score
  matchReason: string;     // Why this company matched
  
  // Detected Signals
  signals: DetectedSignal[];
  
  // Source Information
  sourceUrl?: string;
  sourceSnippet?: string;
  
  // Metadata
  enrichedAt: string;      // ISO date string
  dataQuality: 'high' | 'medium' | 'low';
}

// ============================================
// API Response Schema
// ============================================
export interface LeadGenerationResponse {
  success: boolean;
  leads: Lead[];
  meta: {
    totalFound: number;
    returned: number;
    searchCriteria: {
      industries: string[];
      companySize: string;
      signals: string[];
    };
    processingTimeMs: number;
  };
  errors?: string[];
}

// ============================================
// Perplexity Structured Prompts
// ============================================

export const COMPANY_ENRICHMENT_PROMPT = (companyName: string, domain: string) => `
Research ${companyName} (${domain}) and return ONLY a JSON object with this exact structure:
{
  "name": "Official company name",
  "description": "One sentence description of what they do",
  "industry": "Primary industry (e.g., SaaS, Healthcare, Fintech)",
  "founded": "Year founded or null",
  "employeeCount": number or null,
  "employeeRange": "e.g., 50-200 or null",
  "revenue": "Estimated revenue (e.g., $10M-$50M) or null",
  "headquarters": "City, State/Country",
  "linkedInUrl": "Company LinkedIn URL or null"
}
Return ONLY valid JSON, no other text.
`;

export const CONTACTS_ENRICHMENT_PROMPT = (companyName: string, domain: string, targetTitles: string[]) => `
Find key executives at ${companyName} (${domain}). Looking for: ${targetTitles.join(', ')}.
Return ONLY a JSON array with up to 3 contacts:
[
  {
    "name": "Full Name",
    "title": "Job Title",
    "linkedInUrl": "LinkedIn profile URL or null"
  }
]
Return ONLY valid JSON array, no other text.
`;

// ============================================
// Helper: Create empty lead
// ============================================
export function createEmptyLead(companyName: string, domain: string): Lead {
  return {
    id: `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    company: {
      name: companyName,
      domain: domain,
      website: `https://${domain}`,
    },
    contacts: [],
    score: 0,
    matchReason: '',
    signals: [],
    enrichedAt: new Date().toISOString(),
    dataQuality: 'low'
  };
}

// ============================================
// Helper: Calculate data quality
// ============================================
export function calculateDataQuality(lead: Lead): 'high' | 'medium' | 'low' {
  let score = 0;
  
  // Company info
  if (lead.company.description) score += 1;
  if (lead.company.industry) score += 1;
  if (lead.company.employeeCount) score += 2;
  if (lead.company.revenue) score += 1;
  if (lead.company.headquarters) score += 1;
  
  // Contacts
  if (lead.contacts.length > 0) score += 2;
  if (lead.contacts.some(c => c.linkedInUrl)) score += 1;
  
  // Signals
  if (lead.signals.length > 0) score += 2;
  
  if (score >= 8) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

// ============================================
// Helper: Parse JSON safely
// ============================================
export function safeParseJSON<T>(text: string, fallback: T): T {
  try {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return fallback;
  } catch {
    return fallback;
  }
}

