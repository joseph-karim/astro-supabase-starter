import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    
    // Validate required fields
    if (!data.email || !data.name) {
      return new Response(JSON.stringify({ error: 'Name and email are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Try to save to Supabase if configured
    const supabaseUrl = import.meta.env.SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.SUPABASE_ANON_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const { error } = await supabase.from('leads').insert({
        email: data.email,
        company: data.name, // Using name field for now
        icp: {
          name: data.name,
          store_url: data.store_url,
          message: data.message,
          source: data.source
        },
        created_at: new Date().toISOString()
      });

      if (error) {
        console.error('Supabase error:', error);
        // Continue anyway - we don't want to block the user
      }
    }

    // TODO: Integrate with Folk CRM API
    // Folk CRM API endpoint: https://api.folk.app/v1/persons
    // See: https://help.folk.app/en/articles/11666479-folk-api-beta
    
    // For now, log the lead data
    console.log('New lead:', {
      name: data.name,
      email: data.email,
      store_url: data.store_url,
      message: data.message,
      submitted_at: data.submitted_at
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Lead submission error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

