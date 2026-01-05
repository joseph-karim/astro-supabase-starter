import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const POST: APIRoute = async ({ request }) => {
  try {
    const { website_url, email } = await request.json();

    if (!website_url ||!email) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate URL
    let url: URL;
    try {
      url = new URL(website_url);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid URL' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create onboarding session
    const { data: session, error } = await supabase
      .from('onboarding_sessions')
      .insert({
        website_url: url.toString(),
        email,
        status: 'crawling',
        milestones: {
          started: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create session:', error);
      return new Response(JSON.stringify({ error: 'Failed to create session' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Start async crawl and analysis (in a real implementation this would be a background job)
    startWebsiteAnalysis(session.id, url.toString()).catch(console.error);

    return new Response(
      JSON.stringify({
        session_id: session.id,
        status: 'crawling'
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (err) {
    console.error('Start endpoint error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Background job to crawl and analyze website
async function startWebsiteAnalysis(sessionId: string, websiteUrl: string) {
  try {
    // Update status to analyzing
    await supabase
      .from('onboarding_sessions')
      .update({ status: 'analyzing' })
      .eq('id', sessionId);

    // TODO: Integrate with Firecrawl or Crawl4AI
    // For now, simulate with a delay and mock data
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // TODO: Use LLM to extract business profile
    // For now, use mock data
    const mockBusinessProfile = {
      services: [
        'Operational Excellence Consulting',
        'Digital Transformation Advisory',
        'Process Automation Implementation'
      ],
      icp: {
        industries: ['Manufacturing', 'Distribution'],
        companySize: '100-500',
        geography: ['United States', 'Canada']
      },
      positioning: 'We help mid-market manufacturers modernize operations and scale efficiently'
    };

    // Update session with extracted profile
    await supabase
      .from('onboarding_sessions')
      .update({
        business_profile: mockBusinessProfile,
        status: 'analyzing',
        milestones: {
          started: new Date().toISOString(),
          crawl_completed: new Date().toISOString()
        }
      })
      .eq('id', sessionId);
  } catch (err) {
    console.error('Website analysis error:', err);
    await supabase
      .from('onboarding_sessions')
      .update({
        status: 'error',
        error_message: 'Failed to analyze website'
      })
      .eq('id', sessionId);
  }
}
