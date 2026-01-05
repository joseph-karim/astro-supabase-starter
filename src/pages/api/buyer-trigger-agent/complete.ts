import type { APIRoute } from 'astro';
import { supabase } from '../../../utils/database';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const {
      email,
      companyName,
      website,
      industry,
      targetBuyer,
      buyerJourneyStage,
      painPoints,
      signals,
      frequency
    } = body;

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

    // Create onboarding session with all data in one call
    const { data: session, error: sessionError } = await supabase
      .from('onboarding_sessions')
      .insert({
        email,
        company_name: companyName,
        website_url: website,
        industry,
        target_buyer: targetBuyer,
        buyer_journey_stage: buyerJourneyStage,
        current_step: 8,
        completed: true,
        session_data: {
          painPoints,
          signals,
          frequency: frequency || 'daily'
        }
      })
      .select()
      .single();

    if (sessionError || !session) {
      console.error('Error creating session:', sessionError);
      return new Response(JSON.stringify({ error: 'Failed to create session' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const sessionId = session.id;

    // Create signal configurations
    if (signals && signals.length > 0) {
      const signalConfigs = signals.map((signalType: string) => ({
        session_id: sessionId,
        signal_type: signalType,
        priority: 'medium',
        enabled: true
      }));

      const { error: signalError } = await supabase
        .from('signal_configurations')
        .insert(signalConfigs);

      if (signalError) {
        console.error('Error creating signal configs:', signalError);
        // Don't fail the request if signals fail, just log it
      }
    }

    // Create subscription
    const { error: subError } = await supabase
      .from('buyer_trigger_subscriptions')
      .insert({
        session_id: sessionId,
        email,
        frequency: frequency || 'daily',
        active: true
      });

    if (subError) {
      console.error('Error creating subscription:', subError);
      // Don't fail the request if subscription fails, just log it
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Error in /api/buyer-trigger-agent/complete:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
