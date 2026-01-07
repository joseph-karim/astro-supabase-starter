import type { APIRoute } from 'astro';
import { jsonResponse, parseJsonBody, requestId, OPTIONS_OK } from './_http';
import { supabase } from '../../../utils/database';

export const prerender = false;

export const OPTIONS: APIRoute = OPTIONS_OK;

/**
 * Start lead generation as an async job
 * Returns a jobId that can be polled for results
 */
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

    const { 
      industry, 
      targetBuyer, 
      signals, 
      buyerJourneyStage, 
      signalConfigurations,
      icp 
    } = body ?? {};

    if (!supabase) {
      return jsonResponse({ error: 'Supabase client not configured' }, { status: 500 });
    }

    // Store job in database
    const now = new Date().toISOString();
    const { error: insertError } = await supabase
      .from('lead_generation_jobs')
      .insert({
        id: jobId,
        status: 'queued',
        status_message: 'Queued',
        input: { industry, targetBuyer, signals, buyerJourneyStage, signalConfigurations, icp },
        created_at: now,
        updated_at: now
      });

    if (insertError) {
      console.error(`[Lead Gen Job ${jobId}] Error inserting job:`, insertError);
      return jsonResponse({ error: 'Failed to queue job', details: insertError.message }, { status: 500 });
    }

    // Return immediately with job ID
    // The actual processing happens via the generate-leads-process endpoint
    // which should be called by a background worker or webhook
    
    // For now, we'll trigger the processing inline but non-blocking
    // In production, this would be handled by a queue worker
    void triggerProcessing(jobId);

    return jsonResponse({ jobId, status: 'queued' }, { status: 202 });
    
  } catch (error) {
    console.error(`[Lead Gen Job ${jobId}] Error:`, error);
    return jsonResponse(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error', jobId },
      { status: 500 }
    );
  }
};

/**
 * Trigger processing by calling the process endpoint
 * This is a non-blocking call
 */
async function triggerProcessing(jobId: string) {
  try {
    // Get the job data
    if (!supabase) return;
    
    const { data: job } = await supabase
      .from('lead_generation_jobs')
      .select('*')
      .eq('id', jobId)
      .single();
    
    if (!job) return;

    // Import and run the processing function
    const { processLeadGeneration } = await import('./generate-leads-process');
    await processLeadGeneration(jobId, job.input);
    
  } catch (error) {
    console.error(`[Lead Gen Job ${jobId}] Processing trigger error:`, error);
  }
}

