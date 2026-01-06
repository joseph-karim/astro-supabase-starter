import type { APIRoute } from 'astro';
import { runVoCResearchPipeline } from '../../../lib/voc-triggers/voc-research-pipeline';
import { jsonResponse, parseJsonBody, requestId, OPTIONS_OK } from './_http';

export const prerender = false;

export const OPTIONS: APIRoute = OPTIONS_OK;

export const POST: APIRoute = async ({ request }) => {
  const rid = requestId();
  try {
    let body: any;
    try {
      body = await parseJsonBody(request);
    } catch (error) {
      return jsonResponse(
        {
          error: 'Invalid JSON body',
          details: error instanceof Error ? error.message : 'Unknown error',
          requestId: rid
        },
        { status: 400 }
      );
    }
    const { 
      website, 
      companyName, 
      industry,
      competitors = [],
      targetCompanySize = '50-500 employees'
    } = body;

    if (!website || !companyName) {
      return jsonResponse({ error: 'Website and company name are required' }, { status: 400 });
    }

    const session = await runVoCResearchPipeline(
      { website, companyName, industry, competitors, targetCompanySize },
      rid
    );

    return jsonResponse(session, { status: 200 });

  } catch (err) {
    console.error(`[VoC Research][${rid}] Pipeline Error:`, err);
    return jsonResponse({
      error: 'Internal server error',
      details: err instanceof Error ? err.message : 'Unknown error',
      requestId: rid
    }, { status: 500 });
  }
};
