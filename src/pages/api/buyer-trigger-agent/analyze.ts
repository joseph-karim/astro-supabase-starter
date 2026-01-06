import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { website, companyName } = body;

    if (!website) {
      return new Response(JSON.stringify({ error: 'Website URL is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[Analyze] Starting analysis for ${website}`);

    // Step 1: Scrape website content
    const websiteContent = await scrapeWebsite(website);

    if (!websiteContent) {
      return new Response(JSON.stringify({
        error: 'Failed to scrape website. Please check the URL and try again.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[Analyze] Scraped ${websiteContent.length} characters from website`);

    // Step 2: Use AI to analyze business and generate ICP
    const analysis = await analyzeBusinessWithAI(websiteContent, companyName || extractCompanyName(website));

    console.log(`[Analyze] Generated analysis for ${analysis.companyProfile.name}`);

    return new Response(JSON.stringify(analysis), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Error in /api/buyer-trigger-agent/analyze:', err);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: err instanceof Error ? err.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

async function scrapeWebsite(url: string): Promise<string | null> {
  try {
    const crawl4aiEndpoint =
      import.meta.env.CRAWL4AI_ENDPOINT ?? (globalThis as any).process?.env?.CRAWL4AI_ENDPOINT;
    if (crawl4aiEndpoint) {
      const crawl4aiContent = await scrapeWithCrawl4AI(crawl4aiEndpoint, url);
      if (crawl4aiContent) return crawl4aiContent.slice(0, 10000);
    }

    // Use Jina Reader API - free, no API key needed for basic usage
    const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`;

    const response = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/plain',
        'X-Return-Format': 'markdown'
      }
    });

    if (!response.ok) {
      console.error(`Jina Reader failed: ${response.status}`);
      return null;
    }

    const markdown = await response.text();

    // Limit to first 10000 characters to avoid token limits
    return markdown.slice(0, 10000);

  } catch (error) {
    console.error('Website scraping error:', error);
    return null;
  }
}

async function scrapeWithCrawl4AI(endpoint: string, url: string): Promise<string | null> {
  try {
    const timeoutMs = 30_000;

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

async function analyzeBusinessWithAI(websiteContent: string, companyName: string) {
  const apiKey = import.meta.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.warn('ANTHROPIC_API_KEY not set, using fallback analysis');
    return generateFallbackAnalysis(companyName);
  }

  try {
    const anthropic = new Anthropic({ apiKey });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Analyze this company's website content and generate an ideal customer profile (ICP) and signal recommendations.

Website content:
${websiteContent}

Return a JSON object with this exact structure:
{
  "companyProfile": {
    "name": "Company name",
    "industry": "Primary industry category",
    "size": "Estimated company size",
    "revenue": "Estimated revenue range",
    "description": "One-sentence description of what they do"
  },
  "idealCustomerProfile": {
    "title": "Target buyer job title (e.g., VP of Operations)",
    "companySize": "Target company size range",
    "industry": "Target industry",
    "revenue": "Target revenue range",
    "painPoints": ["Pain point 1", "Pain point 2", "Pain point 3"]
  },
  "recommendedSignals": [
    {
      "id": "signal_type" (one of: hiring, funding, expansion, leadership_change, tech_adoption, product_launch, awards, regulatory),
      "label": "User-friendly label",
      "reason": "Why this signal matters for this specific business",
      "priority": "high|medium|low",
      "enabled": true|false
    }
  ],
  "confidence": 0.85
}

Focus on:
1. Understanding what services/products they offer
2. Who they serve (their target market)
3. What signals would indicate their ideal customers are ready to buy
4. Why each signal is relevant to THEIR specific business model`
      }]
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Extract JSON from response (Claude sometimes wraps it in markdown)
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Claude response');
    }

    const analysis = JSON.parse(jsonMatch[0]);
    return analysis;

  } catch (error) {
    console.error('AI analysis error:', error);
    return generateFallbackAnalysis(companyName);
  }
}

function generateFallbackAnalysis(companyName: string) {
  // Intelligent fallback if AI isn't available
  return {
    companyProfile: {
      name: companyName,
      industry: 'Professional Services',
      size: '10-50 employees',
      revenue: '$1M-$5M',
      description: 'B2B professional services firm'
    },
    idealCustomerProfile: {
      title: 'VP of Operations',
      companySize: '100-500 employees',
      industry: 'Technology',
      revenue: '$10M-$50M',
      painPoints: [
        'Scaling operations efficiently',
        'Managing growing complexity',
        'Improving process efficiency'
      ]
    },
    recommendedSignals: [
      {
        id: 'leadership_change',
        label: 'New executive hired',
        reason: 'New leaders often bring budget and mandate for change',
        priority: 'high',
        enabled: true
      },
      {
        id: 'funding',
        label: 'Funding announced',
        reason: 'Fresh capital means budget for investments',
        priority: 'high',
        enabled: true
      },
      {
        id: 'expansion',
        label: 'Company expansion',
        reason: 'Growth creates immediate operational needs',
        priority: 'medium',
        enabled: true
      }
    ],
    confidence: 0.6
  };
}

function extractCompanyName(url: string): string {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    const name = domain.split('.')[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return 'Your Company';
  }
}
