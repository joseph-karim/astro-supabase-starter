/**
 * VoC Trigger Extraction Utilities
 * 
 * Functions for extracting buyer triggers from various sources:
 * - Reviews (G2, Capterra, etc.)
 * - Reddit/forums
 * - Website content (case studies, testimonials)
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  TriggerEvidence,
  TriggerPattern,
  TriggerType,
  EvidenceSource,
  WebsiteAnalysis,
  TRIGGER_PHRASES,
  SUBREDDIT_MAP
} from './types';

/**
 * Extract triggers from review content using Claude
 */
export async function extractTriggersFromReviews(
  reviews: { text: string; source: EvidenceSource; url?: string; date?: string }[],
  companyContext: { name: string; industry: string; services: string[] },
  apiKey: string
): Promise<TriggerEvidence[]> {
  const anthropic = new Anthropic({ apiKey });

  const prompt = `Analyze these product/service reviews and extract buyer triggers.

COMPANY CONTEXT:
- Name: ${companyContext.name}
- Industry: ${companyContext.industry}
- Services: ${companyContext.services.join(', ')}

REVIEWS TO ANALYZE:
${reviews.map((r, i) => `
[Review ${i + 1}] (Source: ${r.source})
${r.text}
`).join('\n---\n')}

For each review, identify buyer triggers using this framework:

1. TRIGGER EVENT: What specific situation caused them to start looking?
   - Look for phrases like: "when we...", "after our...", "once we realized...", "following the..."

2. TRIGGER TYPE: Classify as one of:
   - TIMING: New role, fiscal year, contract renewal, audit deadline
   - PROBLEM: System failure, compliance issue, growth bottleneck, team scaling
   - RE_ENGAGEMENT: Previous solution failed, vendor relationship soured
   - AUTHORITY: New decision-maker, board pressure, investor requirement

3. OBSERVABLE COMPONENT: What part of this trigger could be detected externally?
   - Job posting that would precede this hire
   - Public event that would trigger this need
   - Seasonality pattern (Q4 budget, tax season, etc.)

4. TIMELINE INDICATOR: How urgent was the need?
   - "immediate", "30_days", "quarter", "year"

5. BUYER CONTEXT: Extract any mentioned:
   - Job role/title
   - Company size indicators
   - Industry

6. COMPETITOR CONTEXT: What were they switching FROM?

Output as a JSON array of trigger evidence objects:
[
  {
    "reviewIndex": 1,
    "triggerType": "TIMING|PROBLEM|RE_ENGAGEMENT|AUTHORITY",
    "triggerText": "exact quote showing the trigger",
    "observableComponent": "what can be detected externally",
    "urgency": "immediate|30_days|quarter|year|unknown",
    "buyerContext": {
      "role": "if mentioned",
      "companySize": "if mentioned",
      "industry": "if mentioned"
    },
    "competitorMentioned": "if any",
    "confidence": "HIGH|MEDIUM|LOW"
  }
]

Only include reviews that have clear trigger indicators. Skip reviews that are just feature feedback or general praise without a clear "why now" moment.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }]
  });

  const content = message.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  // Extract JSON from response
  const jsonMatch = content.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return [];
  }

  const extracted = JSON.parse(jsonMatch[0]);
  
  // Transform to TriggerEvidence format
  return extracted.map((item: any, idx: number) => ({
    id: `review-${Date.now()}-${idx}`,
    source: reviews[item.reviewIndex - 1]?.source || 'g2_review',
    sourceUrl: reviews[item.reviewIndex - 1]?.url,
    text: item.triggerText,
    triggerType: item.triggerType as TriggerType,
    buyerContext: item.buyerContext || {},
    urgency: item.urgency || 'unknown',
    competitorMentioned: item.competitorMentioned,
    extractedAt: new Date()
  }));
}

/**
 * Extract triggers from Reddit posts/comments
 */
export async function extractTriggersFromReddit(
  posts: { title: string; body: string; subreddit: string; url: string; comments?: string[] }[],
  companyContext: { name: string; industry: string; category: string },
  apiKey: string
): Promise<TriggerEvidence[]> {
  const anthropic = new Anthropic({ apiKey });

  const prompt = `Analyze these Reddit posts/comments and extract buying triggers for ${companyContext.category} solutions.

CONTEXT:
- Industry: ${companyContext.industry}
- Solution Category: ${companyContext.category}

REDDIT CONTENT TO ANALYZE:
${posts.map((p, i) => `
[Post ${i + 1}] r/${p.subreddit}
Title: ${p.title}
Body: ${p.body}
${p.comments?.length ? `Top Comments:\n${p.comments.slice(0, 3).join('\n---\n')}` : ''}
`).join('\n======\n')}

For each post, identify:

1. BUYER CONTEXT
   - Role/title mentioned
   - Company size indicators ("small team", "enterprise", "startup")
   - Industry clues

2. TRIGGER SITUATION
   - What prompted them to post/search?
   - Is this active buying (looking for solution) or passive research?

3. OBSERVABLE PROXIES
   - What external events would correlate with this trigger?
   - Example: "We just closed Series A" → monitor Crunchbase
   - Example: "New VP of Ops" → monitor job postings + LinkedIn

4. COMPETITOR INTELLIGENCE
   - What are they switching FROM?
   - What features/capabilities are missing from current solution?

5. BUYING TIMELINE
   - How urgent is their need?
   - What deadline or event is driving timing?

Output as JSON array:
[
  {
    "postIndex": 1,
    "triggerType": "TIMING|PROBLEM|RE_ENGAGEMENT|AUTHORITY",
    "triggerSummary": "brief description of the trigger",
    "keyQuote": "most relevant quote",
    "observableProxy": "what external signal would indicate this",
    "urgency": "immediate|30_days|quarter|year|unknown",
    "buyerContext": {
      "role": "if mentioned",
      "companySize": "if mentioned",
      "industry": "if mentioned"
    },
    "competitorMentioned": "if any",
    "isActiveBuying": true/false
  }
]

Focus on extracting PATTERNS that repeat across multiple posts—these indicate reliable triggers.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4000,
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

  const extracted = JSON.parse(jsonMatch[0]);

  return extracted.map((item: any, idx: number) => ({
    id: `reddit-${Date.now()}-${idx}`,
    source: 'reddit_post' as EvidenceSource,
    sourceUrl: posts[item.postIndex - 1]?.url,
    text: item.keyQuote || item.triggerSummary,
    triggerType: item.triggerType as TriggerType,
    buyerContext: item.buyerContext || {},
    urgency: item.urgency || 'unknown',
    competitorMentioned: item.competitorMentioned,
    extractedAt: new Date()
  }));
}

/**
 * Extract triggers from website content (case studies, testimonials)
 */
export async function extractTriggersFromWebsite(
  websiteContent: string,
  companyName: string,
  apiKey: string
): Promise<WebsiteAnalysis> {
  const anthropic = new Anthropic({ apiKey });

  const prompt = `Analyze this company website content and extract:
1. Company profile and positioning
2. Case study triggers (what made clients buy)
3. Testimonial triggers (why customers chose them)
4. Competitor mentions

WEBSITE CONTENT:
${websiteContent.slice(0, 15000)}

Return a JSON object:
{
  "companyProfile": {
    "name": "${companyName}",
    "industry": "primary industry",
    "services": ["list", "of", "services"],
    "positioning": "one sentence positioning statement",
    "targetMarkets": ["target", "segments"]
  },
  "caseStudies": [
    {
      "title": "case study title if found",
      "industry": "client industry",
      "companySize": "client size if mentioned",
      "triggerMentioned": "what challenge/event led them to buy",
      "outcome": "key result achieved"
    }
  ],
  "testimonials": [
    {
      "text": "testimonial quote",
      "role": "person's role",
      "company": "company name",
      "triggerIndicators": ["phrases that hint at buying trigger"]
    }
  ],
  "competitors": ["mentioned", "competitors"]
}

Focus on extracting the "why now" and "why us" from case studies and testimonials.
Look for patterns in:
- The Challenge/Problem sections
- "Before [Product]" descriptions
- What finally made them act`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }]
  });

  const content = message.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }

  return JSON.parse(jsonMatch[0]);
}

/**
 * Synthesize triggers from multiple sources into patterns
 */
export async function synthesizeTriggerPatterns(
  reviewTriggers: TriggerEvidence[],
  redditTriggers: TriggerEvidence[],
  websiteAnalysis: WebsiteAnalysis,
  apiKey: string
): Promise<TriggerPattern[]> {
  const anthropic = new Anthropic({ apiKey });

  const allEvidence = [...reviewTriggers, ...redditTriggers];
  
  const prompt = `Synthesize these trigger evidence items into distinct trigger patterns.

COMPANY CONTEXT:
${JSON.stringify(websiteAnalysis.companyProfile, null, 2)}

CASE STUDY TRIGGERS:
${JSON.stringify(websiteAnalysis.caseStudies, null, 2)}

REVIEW TRIGGERS (${reviewTriggers.length} items):
${JSON.stringify(reviewTriggers.slice(0, 20), null, 2)}

REDDIT TRIGGERS (${redditTriggers.length} items):
${JSON.stringify(redditTriggers.slice(0, 20), null, 2)}

Group similar triggers into patterns and output:
[
  {
    "name": "descriptive_pattern_name",
    "description": "What this trigger pattern represents",
    "triggerType": "TIMING|PROBLEM|RE_ENGAGEMENT|AUTHORITY",
    "evidenceCount": number of evidence items supporting this,
    "frequencyScore": 0.0-1.0 based on how common this is,
    "confidenceScore": 0.0-1.0 based on reliability as buying signal,
    "observableComponents": ["what", "can", "be", "detected"],
    "typicalTimeline": "when buying happens after trigger (e.g., '30-90 days')",
    "messagingAngle": "how to reference this in outreach",
    "keywords": ["key", "phrases", "that", "indicate", "this", "trigger"],
    "sampleEvidence": ["quote 1", "quote 2"]
  }
]

Rules:
1. Merge similar triggers into single patterns
2. Rank by frequency (how often mentioned) and confidence (how reliable as signal)
3. Focus on triggers that have OBSERVABLE external components
4. Include at least 3-5 patterns, max 8
5. Prioritize patterns that appear across multiple sources (reviews + Reddit)`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4000,
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

  const patterns = JSON.parse(jsonMatch[0]);

  return patterns.map((p: any, idx: number) => ({
    id: `pattern-${Date.now()}-${idx}`,
    name: p.name,
    description: p.description,
    triggerType: p.triggerType,
    evidence: allEvidence.filter(e => 
      p.keywords.some((kw: string) => 
        e.text.toLowerCase().includes(kw.toLowerCase())
      )
    ),
    frequencyScore: p.frequencyScore,
    confidenceScore: p.confidenceScore,
    observableComponents: p.observableComponents,
    typicalTimeline: p.typicalTimeline,
    messagingAngle: p.messagingAngle,
    keywords: p.keywords
  }));
}

/**
 * Search Reddit for relevant posts using Exa
 */
export async function searchRedditWithExa(
  category: string,
  industry: string,
  competitors: string[],
  exaApiKey: string
): Promise<{ title: string; body: string; subreddit: string; url: string }[]> {
  const Exa = (await import('exa-js')).default;
  const exa = new Exa(exaApiKey);

  // Build search queries
  const queries = [
    `site:reddit.com "${category}" (recommend OR looking for OR switched to)`,
    `site:reddit.com "${category}" (frustrated OR issues OR problems)`,
    ...competitors.slice(0, 2).map(c => 
      `site:reddit.com "${c}" (alternative OR replacement OR switching from)`
    )
  ];

  const results: { title: string; body: string; subreddit: string; url: string }[] = [];

  for (const query of queries.slice(0, 3)) {
    try {
      const searchResults = await exa.searchAndContents(query, {
        type: 'auto',
        numResults: 5,
        text: { maxCharacters: 2000 }
      });

      for (const result of searchResults.results) {
        const subredditMatch = result.url.match(/reddit\.com\/r\/(\w+)/);
        results.push({
          title: result.title || '',
          body: result.text || '',
          subreddit: subredditMatch?.[1] || 'unknown',
          url: result.url
        });
      }
    } catch (error) {
      console.error(`Reddit search error for query "${query}":`, error);
    }
  }

  return results;
}

/**
 * Scrape G2 reviews for a product using web scraping
 */
export async function scrapeG2Reviews(
  productSlug: string
): Promise<{ text: string; rating: number; date: string }[]> {
  // Use Jina Reader to get G2 review page content
  const url = `https://www.g2.com/products/${productSlug}/reviews`;
  const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`;

  try {
    const response = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/plain',
        'X-Return-Format': 'markdown'
      }
    });

    if (!response.ok) {
      console.error(`G2 scrape failed: ${response.status}`);
      return [];
    }

    const markdown = await response.text();
    
    // Extract review sections from markdown
    // G2 reviews typically have "What do you like best?" and "What do you dislike?" sections
    const reviewPattern = /(?:What do you like|What problems|Review of|★+)[^\n]*\n([\s\S]*?)(?=(?:What do you like|What problems|Review of|★+|$))/gi;
    const matches = [...markdown.matchAll(reviewPattern)];
    
    return matches.slice(0, 20).map((match, idx) => ({
      text: match[1]?.trim().slice(0, 1000) || '',
      rating: 4, // Default rating since extraction is complex
      date: new Date().toISOString()
    })).filter(r => r.text.length > 50);

  } catch (error) {
    console.error('G2 scraping error:', error);
    return [];
  }
}

/**
 * Search for competitor reviews and extract triggers
 */
export async function mineCompetitorReviews(
  competitors: string[],
  anthropicApiKey: string
): Promise<TriggerEvidence[]> {
  const allReviews: { text: string; source: EvidenceSource; url?: string }[] = [];

  for (const competitor of competitors.slice(0, 3)) {
    // Convert competitor name to likely G2 slug
    const slug = competitor.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    const reviews = await scrapeG2Reviews(slug);
    
    for (const review of reviews) {
      allReviews.push({
        text: review.text,
        source: 'g2_review',
        url: `https://www.g2.com/products/${slug}/reviews`
      });
    }
  }

  if (allReviews.length === 0) {
    return [];
  }

  // Extract triggers from collected reviews
  return extractTriggersFromReviews(
    allReviews,
    { name: 'Competitor Analysis', industry: 'Various', services: [] },
    anthropicApiKey
  );
}

