import type { APIRoute } from 'astro';
import { supabase } from '../../../utils/database';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const {
      sessionId,
      companyName,
      website,
      industry,
      targetBuyer,
      buyerJourneyStage,
      painPoints,
      signals,
      frequency
    } = body;

    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Session ID is required' }), {
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

    // Update onboarding session with complete data
    const { error: sessionError } = await supabase
      .from('onboarding_sessions')
      .update({
        company_name: companyName,
        website_url: website,
        industry,
        target_buyer: targetBuyer,
        buyer_journey_stage: buyerJourneyStage,
        current_step: 9,
        completed: true,
        session_data: {
          painPoints,
          signals,
          frequency
        }
      })
      .eq('id', sessionId);

    if (sessionError) {
      console.error('Error updating session:', sessionError);
      return new Response(JSON.stringify({ error: 'Failed to update session' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

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

    // Get session email for subscription
    const { data: session } = await supabase
      .from('onboarding_sessions')
      .select('email')
      .eq('id', sessionId)
      .single();

    // Create subscription
    if (session?.email) {
      const { error: subError } = await supabase
        .from('buyer_trigger_subscriptions')
        .insert({
          session_id: sessionId,
          email: session.email,
          frequency: frequency || 'daily',
          active: true
        });

      if (subError) {
        console.error('Error creating subscription:', subError);
        // Don't fail the request if subscription fails, just log it
      }
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
