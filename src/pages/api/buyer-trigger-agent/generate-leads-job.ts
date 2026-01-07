import type { APIRoute } from 'astro';
import { jsonResponse, requestId, OPTIONS_OK } from './_http';
import { supabase } from '../../../utils/database';

export const prerender = false;

export const OPTIONS: APIRoute = OPTIONS_OK;

/**
 * Get lead generation job status and results
 */
export const GET: APIRoute = async ({ url }) => {
  const rid = requestId();
  const jobId = url.searchParams.get('jobId');
  
  if (!jobId) {
    return jsonResponse({ error: 'jobId is required', requestId: rid }, { status: 400 });
  }

  if (!supabase) {
    return jsonResponse({ error: 'Supabase client not configured' }, { status: 500 });
  }

  const { data: job, error } = await supabase
    .from('lead_generation_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error) {
    console.error(`[Lead Gen Job ${jobId}] Error fetching job:`, error);
    return jsonResponse({ error: 'Failed to fetch job', details: error.message, requestId: rid }, { status: 500 });
  }

  if (!job) {
    return jsonResponse({ error: 'Job not found', requestId: rid }, { status: 404 });
  }

  return jsonResponse(job, { status: 200 });
};

