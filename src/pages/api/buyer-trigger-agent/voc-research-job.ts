import type { APIRoute } from 'astro';
import { jsonResponse, requestId, OPTIONS_OK } from './_http';
import { supabase } from '../../../utils/database';

export const prerender = false;

export const OPTIONS: APIRoute = OPTIONS_OK;

export const GET: APIRoute = async ({ url }) => {
  const rid = requestId();
  const jobId = url.searchParams.get('jobId');
  
  if (!jobId) {
    return jsonResponse({ error: 'jobId is required', requestId: rid }, { status: 400 });
  }

  if (!supabase) {
    return jsonResponse({ error: 'Database not configured', requestId: rid }, { status: 500 });
  }

  // Fetch job from Supabase
  const { data: job, error } = await supabase
    .from('voc_research_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error || !job) {
    return jsonResponse({ error: 'Job not found', requestId: rid }, { status: 404 });
  }

  // Transform to expected format
  return jsonResponse({
    id: job.id,
    status: job.status,
    statusMessage: job.status_message,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
    result: job.result,
    error: job.error
  }, { status: 200 });
};
