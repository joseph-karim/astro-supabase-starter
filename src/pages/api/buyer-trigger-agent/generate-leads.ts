import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const {
      industry,
      targetBuyer,
      signals,
      buyerJourneyStage
    } = body;

    // TODO: Implement actual lead generation with real-time data
    // For now, generate intelligent mock leads based on inputs

    const leads = generatePersonalizedLeads({
      industry,
      targetBuyer,
      signals,
      buyerJourneyStage
    });

    return new Response(JSON.stringify({ leads }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Error in /api/buyer-trigger-agent/generate-leads:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

function generatePersonalizedLeads(criteria: any) {
  const industryMap: Record<string, string[]> = {
    'saas': ['TechFlow Systems', 'CloudNine Analytics', 'DataStream Inc'],
    'marketing': ['BrandCraft Agency', 'GrowthLab Marketing', 'Velocity Digital'],
    'consulting': ['Apex Advisors', 'Strategic Partners Group', 'Transform Consulting'],
    'manufacturing': ['Meridian Manufacturing', 'Precision Tools Corp', 'Industrial Solutions'],
    'default': ['Acme Corporation', 'Vanguard Systems', 'Apex Distribution']
  };

  const signalMap: Record<string, string> = {
    'leadership_change': 'New VP Operations hired 47 days ago',
    'funding': 'Series B funding ($28M) announced',
    'expansion': 'New facility opening in Q2 2025',
    'hiring': 'Hiring 12 operations roles',
    'tech_adoption': 'Migrating to new ERP system',
    'product_launch': 'Launching new product line',
    'awards': 'Won Industry Excellence Award',
    'regulatory': 'Preparing for new compliance requirements'
  };

  const companies = industryMap[criteria.industry] || industryMap['default'];
  const selectedSignals = criteria.signals || ['leadership_change', 'funding'];

  return companies.slice(0, 3).map((company, idx) => ({
    company: company,
    location: ['Austin, TX', 'Denver, CO', 'Cleveland, OH'][idx],
    employees: [280, 195, 340][idx],
    revenue: ['$38M', '$32M', '$45M'][idx],
    score: [94, 87, 82][idx],
    primarySignal: signalMap[selectedSignals[0]] || signalMap['leadership_change'],
    tags: selectedSignals.slice(0, 2).map((s: string) => s.replace('_', ' ')),
    matchReason: `Matches your ${criteria.buyerJourneyStage || 'consideration'} stage criteria`
  }));
}
