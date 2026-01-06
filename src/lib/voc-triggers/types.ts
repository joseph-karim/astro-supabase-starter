/**
 * VoC-First Trigger Discovery Types
 * 
 * Core data structures for voice-of-customer trigger extraction
 * and signal mapping.
 */

// Trigger type classifications
export type TriggerType = 'TIMING' | 'PROBLEM' | 'RE_ENGAGEMENT' | 'AUTHORITY';

// Evidence source types
export type EvidenceSource = 
  | 'g2_review' 
  | 'capterra_review' 
  | 'trustradius_review'
  | 'reddit_post' 
  | 'reddit_comment'
  | 'case_study' 
  | 'testimonial'
  | 'forum_post'
  | 'linkedin_post';

// Signal confidence levels
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

// Cost tiers for data sources
export type CostTier = 'free' | 'low' | 'medium' | 'high';

// Signal source types
export type SourceType = 'api' | 'rss' | 'scrape' | 'manual';

/**
 * Single piece of evidence for a trigger pattern
 */
export interface TriggerEvidence {
  id: string;
  source: EvidenceSource;
  sourceUrl?: string;
  text: string;
  triggerType: TriggerType;
  buyerContext: {
    role?: string;
    companySize?: string;
    industry?: string;
    stage?: string;
  };
  urgency: 'immediate' | '30_days' | 'quarter' | 'year' | 'unknown';
  competitorMentioned?: string;
  timestamp?: Date;
  extractedAt: Date;
}

/**
 * Aggregated trigger pattern from multiple evidence sources
 */
export interface TriggerPattern {
  id: string;
  name: string;
  description: string;
  triggerType: TriggerType;
  evidence: TriggerEvidence[];
  frequencyScore: number; // 0-1, how often this appears
  confidenceScore: number; // 0-1, reliability as buying signal
  observableComponents: string[]; // What we can detect externally
  typicalTimeline: string; // When buying happens after trigger
  messagingAngle: string; // How to reference in outreach
  keywords: string[]; // Key phrases that indicate this trigger
}

/**
 * Data source for monitoring a signal
 */
export interface SignalSource {
  name: string;
  sourceType: SourceType;
  endpoint?: string;
  queryTemplate?: string;
  rateLimit?: string;
  costTier: CostTier;
  freshness: string; // How often updated
  apiKey?: string; // Environment variable name
}

/**
 * Individual signal configuration within a trigger
 */
export interface SignalConfig {
  signalName: string;
  dataSource: string;
  queryMethod: SourceType;
  queryParameters: {
    keywords?: string[];
    jobTitles?: string[];
    filters?: Record<string, any>;
    geography?: string;
    timeWindow?: string;
  };
  interpretation: string;
  confidence: ConfidenceLevel;
  freshnessWindow: number; // Days
}

/**
 * Complete signal configuration for a trigger pattern
 */
export interface TriggerSignalConfiguration {
  triggerName: string;
  triggerType: TriggerType;
  sourceEvidence: string; // Summary of VoC evidence
  signals: SignalConfig[];
  combinationLogic: string; // e.g., "signal_a AND (signal_b OR signal_c)"
  scoringWeights: Record<string, number>;
  timingWindow: {
    minDays: number;
    maxDays: number;
    idealDays: number;
  };
  messagingAngle: string;
}

/**
 * Detected signal for a specific company
 */
export interface CompanySignal {
  id: string;
  companyId: string;
  companyName: string;
  companyUrl?: string;
  signalType: string;
  triggerPattern: string;
  detectedAt: Date;
  evidence: {
    source: string;
    data: Record<string, any>;
    url?: string;
  };
  confidence: number; // 0-100
  recommendedAction: string;
  messagingContext: string;
  score: number;
}

/**
 * VoC Research session data
 */
export interface VoCResearchSession {
  id: string;
  companyName: string;
  website: string;
  industry?: string;
  services?: string[];
  targetCompanySize?: string;
  competitors?: string[];
  
  // Research outputs
  websiteAnalysis?: WebsiteAnalysis;
  reviewTriggers?: TriggerEvidence[];
  redditTriggers?: TriggerEvidence[];
  synthesizedTriggers?: TriggerPattern[];
  signalConfigurations?: TriggerSignalConfiguration[];
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Website analysis output
 */
export interface WebsiteAnalysis {
  companyProfile: {
    name: string;
    industry: string;
    services: string[];
    positioning: string;
    targetMarkets: string[];
  };
  caseStudies: {
    title: string;
    industry?: string;
    companySize?: string;
    triggerMentioned?: string;
    outcome?: string;
  }[];
  testimonials: {
    text: string;
    role?: string;
    company?: string;
    triggerIndicators?: string[];
  }[];
  competitors: string[];
}

/**
 * Review platform configuration
 */
export interface ReviewPlatformConfig {
  platform: 'g2' | 'capterra' | 'trustradius' | 'clutch' | 'google';
  searchUrl: string;
  extractionMethod: 'scrape' | 'api';
  rateLimit: number; // requests per minute
}

/**
 * Reddit analysis configuration
 */
export interface RedditConfig {
  subreddits: string[];
  searchQueries: string[];
  timeFilter: 'day' | 'week' | 'month' | 'year' | 'all';
  sortBy: 'relevance' | 'hot' | 'top' | 'new';
}

// Trigger phrase patterns for extraction
export const TRIGGER_PHRASES = {
  timing_triggers: [
    "when we hired",
    "after we raised",
    "once we hit",
    "as we scaled to",
    "when our contract with",
    "at the start of",
    "when our",
    "after the merger",
    "when we opened",
    "following our",
    "after our Series"
  ],
  problem_triggers: [
    "when .* failed",
    "after the audit found",
    "when we realized .* wasn't working",
    "once .* raised prices",
    "when we couldn't",
    "after losing .* because",
    "when compliance required",
    "after the security incident",
    "struggling with",
    "frustrated by"
  ],
  catalyst_phrases: [
    "the final straw was",
    "what really pushed us",
    "the breaking point",
    "we finally decided when",
    "that's when we knew we needed"
  ],
  urgency_indicators: [
    "immediately",
    "within .* days",
    "within .* weeks",
    "before .* deadline",
    "couldn't wait any longer",
    "mission critical",
    "board mandate",
    "urgent",
    "ASAP"
  ]
};

// Subreddit mapping by vertical
export const SUBREDDIT_MAP: Record<string, string[]> = {
  b2b_saas: [
    "r/SaaS", "r/startups", "r/Entrepreneur",
    "r/sales", "r/marketing", "r/devops",
    "r/sysadmin", "r/ITManagers"
  ],
  professional_services: [
    "r/Accounting", "r/law", "r/consulting",
    "r/smallbusiness", "r/agencies"
  ],
  ecommerce: [
    "r/ecommerce", "r/shopify", "r/FulfillmentByAmazon",
    "r/dropship", "r/digitalnomad"
  ],
  healthcare: [
    "r/medicine", "r/healthcare", "r/nursing",
    "r/healthIT", "r/physicaltherapy"
  ],
  financial_services: [
    "r/personalfinance", "r/financialindependence",
    "r/CFA", "r/FinancialCareers", "r/tax"
  ],
  technology: [
    "r/programming", "r/webdev", "r/cscareerquestions",
    "r/dataengineering", "r/MachineLearning"
  ]
};

// Review source mapping by business type
export const REVIEW_SOURCE_MAP: Record<string, { primary: string[]; secondary: string[] }> = {
  b2b_saas: {
    primary: ["G2", "Capterra", "TrustRadius"],
    secondary: ["Product Hunt", "Reddit r/SaaS"]
  },
  professional_services: {
    primary: ["Google Reviews", "Clutch", "UpCity"],
    secondary: ["Industry forums"]
  },
  ecommerce: {
    primary: ["Amazon", "Trustpilot", "Shopify App Store"],
    secondary: ["Product-specific subreddits", "YouTube reviews"]
  },
  healthcare: {
    primary: ["Healthgrades", "Vitals", "WebMD"],
    secondary: ["Patient forums"]
  },
  financial_services: {
    primary: ["NerdWallet", "Bankrate"],
    secondary: ["r/personalfinance", "r/smallbusiness"]
  }
};

// Free signal sources
export const FREE_SIGNAL_SOURCES: SignalSource[] = [
  {
    name: "SEC EDGAR",
    sourceType: "api",
    endpoint: "https://www.sec.gov/cgi-bin/browse-edgar",
    costTier: "free",
    freshness: "daily"
  },
  {
    name: "Google News RSS",
    sourceType: "rss",
    endpoint: "https://news.google.com/rss/search",
    costTier: "free",
    freshness: "real-time"
  },
  {
    name: "Indeed Jobs RSS",
    sourceType: "rss",
    endpoint: "https://www.indeed.com/rss",
    costTier: "free",
    freshness: "daily"
  },
  {
    name: "LinkedIn Jobs",
    sourceType: "scrape",
    costTier: "free",
    freshness: "daily"
  },
  {
    name: "Crunchbase News",
    sourceType: "rss",
    endpoint: "https://news.crunchbase.com/feed/",
    costTier: "free",
    freshness: "daily"
  }
];

// Signal scoring base values
export const SIGNAL_BASE_SCORES: Record<string, number> = {
  // Direct buying signals (highest)
  pricing_page_visit: 10,
  demo_request: 10,
  competitor_comparison: 9,
  
  // Strong timing signals
  executive_started_role: 8,
  funding_announced: 8,
  compliance_event: 8,
  acquisition_announced: 8,
  
  // Medium timing signals
  executive_role_posted: 6,
  headcount_surge: 6,
  job_posting_velocity: 6,
  technology_change: 6,
  
  // Weak/contextual signals
  blog_engagement: 3,
  newsletter_signup: 2,
  social_mention: 2,
  review_posted: 4
};

// Signal half-lives for time decay (in days)
export const SIGNAL_HALF_LIVES: Record<string, number> = {
  pricing_page_visit: 7,
  demo_request: 14,
  executive_started_role: 60,
  funding_announced: 90,
  compliance_event: 30,
  acquisition_announced: 60,
  executive_role_posted: 30,
  headcount_surge: 45,
  job_posting_velocity: 30,
  technology_change: 60
};

