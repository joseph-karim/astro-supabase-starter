import type { APIRoute } from 'astro';
import { runVoCResearchPipeline } from '../../../lib/voc-triggers/voc-research-pipeline';
import { jsonResponse, parseJsonBody, requestId, OPTIONS_OK } from './_http';
import { getEnvVars } from '../../../utils/database';

export const prerender = false;

type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

type Job = {
  id: string;
  status: JobStatus;
  statusMessage: string;
  createdAt: string;
  updatedAt: string;
  result?: any;
  error?: { message: string };
};

function jobsStore(): Map<string, Job> {
  const g = globalThis as any;
  if (!g.__vocResearchJobs) g.__vocResearchJobs = new Map();
  return g.__vocResearchJobs as Map<string, Job>;
}

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

    const jobs = jobsStore();
    const now = new Date().toISOString();
    const job: Job = {
      id: jobId,
      status: 'queued',
      statusMessage: 'Queued',
      createdAt: now,
      updatedAt: now
    };
    jobs.set(jobId, job);

    setTimeout(() => jobs.delete(jobId), 60 * 60 * 1000);

    void (async () => {
      const update = (patch: Partial<Job>) => {
        const current = jobs.get(jobId);
        if (!current) return;
        jobs.set(jobId, { ...current, ...patch, updatedAt: new Date().toISOString() });
      };

      update({ status: 'running', statusMessage: 'Loading API keys...' });

      try {
        // Get API keys from environment variables (set in Netlify dashboard)
        const envVars = getEnvVars(['ANTHROPIC_API_KEY', 'EXA_API_KEY', 'PERPLEXITY_API_KEY']);
        
        // Validate we have the required key
        if (!envVars.ANTHROPIC_API_KEY) {
          throw new Error('ANTHROPIC_API_KEY not configured. Add it to Netlify Environment Variables.');
        }

        update({ statusMessage: 'Starting research...' });

        const result = await runVoCResearchPipeline(
          { 
            website, 
            companyName, 
            industry, 
            competitors, 
            targetCompanySize,
            apiKeys: {
              anthropic: envVars.ANTHROPIC_API_KEY || undefined,
              exa: envVars.EXA_API_KEY || undefined,
              perplexity: envVars.PERPLEXITY_API_KEY || undefined
            }
          },
          jobId,
          (msg) => update({ statusMessage: msg })
        );
        update({ status: 'completed', statusMessage: 'Complete', result });
      } catch (error) {
        console.error(`[VoC Research Job ${jobId}] Error:`, error);
        update({
          status: 'failed',
          statusMessage: 'Failed',
          error: { message: error instanceof Error ? error.message : 'Unknown error' }
        });
      }
    })();

    return jsonResponse({ jobId }, { status: 202 });
  } catch (error) {
    return jsonResponse(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error', jobId },
      { status: 500 }
    );
  }
};

