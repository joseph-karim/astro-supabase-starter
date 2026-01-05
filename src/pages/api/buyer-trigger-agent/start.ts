import type { APIRoute } from 'astro';
import { supabase } from '../../../utils/database';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { email } = await request.json();

    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Valid email is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!supabase) {
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create new onboarding session
    const { data: session, error } = await supabase
      .from('onboarding_sessions')
      .insert({
        email,
        current_step: 1,
        completed: false,
        session_data: {}
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating session:', error);
      return new Response(JSON.stringify({ error: 'Failed to create session' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ sessionId: session.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Error in /api/buyer-trigger-agent/start:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
