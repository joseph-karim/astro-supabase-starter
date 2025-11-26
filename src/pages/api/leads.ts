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
        company: data.name,
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
      }
    }

    // Send to Folk CRM
    const folkApiKey = import.meta.env.FOLK_API_KEY;
    
    if (folkApiKey) {
      try {
        // Split name into first and last
        const nameParts = data.name.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const folkResponse = await fetch('https://api.folk.app/v1/persons', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${folkApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            firstName: firstName,
            lastName: lastName,
            emails: [{ value: data.email }],
            customFields: {
              'Store URL': data.store_url || '',
              'Message': data.message || '',
              'Source': 'Website Contact Form',
              'Submitted At': new Date().toISOString()
            }
          })
        });

        if (!folkResponse.ok) {
          const errorText = await folkResponse.text();
          console.error('Folk CRM error:', folkResponse.status, errorText);
        } else {
          console.log('Successfully added to Folk CRM');
        }
      } catch (folkError) {
        console.error('Folk CRM request failed:', folkError);
      }
    } else {
      console.log('Folk API key not configured - skipping CRM sync');
    }

    // Log the lead
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
