import type { APIRoute } from 'astro';
import { jsonResponse, requestId, OPTIONS_OK } from './_http';

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

export const GET: APIRoute = async ({ url }) => {
  const rid = requestId();
  const jobId = url.searchParams.get('jobId');
  if (!jobId) {
    return jsonResponse({ error: 'jobId is required', requestId: rid }, { status: 400 });
  }

  const job = jobsStore().get(jobId);
  if (!job) {
    return jsonResponse({ error: 'Job not found', requestId: rid }, { status: 404 });
  }

  return jsonResponse(job, { status: 200 });
};

