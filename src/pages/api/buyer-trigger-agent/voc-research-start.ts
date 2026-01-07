import type { APIRoute } from 'astro';
import { runVoCResearchPipeline } from '../../../lib/voc-triggers/voc-research-pipeline';
import { jsonResponse, parseJsonBody, requestId, OPTIONS_OK } from './_http';
import { getEnvVars, supabase } from '../../../utils/database';

export const prerender = false;

export const OPTIONS: APIRoute = OPTIONS_OK;

export const POST: APIRoute = async ({ request }) => {
  const jobId = requestId();
  
  try {
    let body: any;
    try {
      body = await parseJsonBody(request);
    } catch (error) {
      return jsonResponse(
        { error: 'Invalid JSON body', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 400 }
      );
    }

    const { website, companyName, industry, competitors = [], targetCompanySize = '50-500 employees' } = body ?? {};

    if (!website || !companyName) {
      return jsonResponse({ error: 'Website and company name are required' }, { status: 400 });
    }

    // Check if Supabase is configured
    if (!supabase) {
      return jsonResponse({ error: 'Database not configured' }, { status: 500 });
    }

    // Create job in Supabase
    const { error: insertError } = await supabase
      .from('voc_research_jobs')
      .insert({
        id: jobId,
        status: 'queued',
        status_message: 'Queued',
        input: { website, companyName, industry, competitors, targetCompanySize }
      });

    if (insertError) {
      console.error('[VoC Job] Failed to create job:', insertError);
      return jsonResponse({ error: 'Failed to create job', details: insertError.message }, { status: 500 });
    }

    // Start the async pipeline (fire and forget)
    void runJobAsync(jobId, { website, companyName, industry, competitors, targetCompanySize });

    return jsonResponse({ jobId }, { status: 202 });
  } catch (error) {
    return jsonResponse(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error', jobId },
      { status: 500 }
    );
  }
};

async function runJobAsync(
  jobId: string,
  input: { website: string; companyName: string; industry?: string; competitors: string[]; targetCompanySize: string }
) {
  const updateJob = async (updates: { status?: string; status_message?: string; result?: any; error?: any }) => {
    if (!supabase) return;
    await supabase
      .from('voc_research_jobs')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', jobId);
  };

  try {
    await updateJob({ status: 'running', status_message: 'Loading API keys...' });

    // Get API keys
    const envVars = getEnvVars(['ANTHROPIC_API_KEY', 'EXA_API_KEY', 'PERPLEXITY_API_KEY']);
    
    if (!envVars.ANTHROPIC_API_KEY) {
      await updateJob({ 
        status: 'failed', 
        status_message: 'Failed',
        error: { message: 'ANTHROPIC_API_KEY not configured. Add it to Netlify Environment Variables.' }
      });
      return;
    }

    await updateJob({ status_message: 'Starting research...' });

    const result = await runVoCResearchPipeline(
      { 
        ...input,
        apiKeys: {
          anthropic: envVars.ANTHROPIC_API_KEY || undefined,
          exa: envVars.EXA_API_KEY || undefined,
          perplexity: envVars.PERPLEXITY_API_KEY || undefined
        }
      },
      jobId,
      async (msg) => {
        await updateJob({ status_message: msg });
      }
    );

    await updateJob({ status: 'completed', status_message: 'Complete', result });
  } catch (error) {
    console.error(`[VoC Research Job ${jobId}] Error:`, error);
    await updateJob({
      status: 'failed',
      status_message: 'Failed',
      error: { message: error instanceof Error ? error.message : 'Unknown error' }
    });
  }
}
