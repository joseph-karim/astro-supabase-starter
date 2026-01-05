export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string
          user_id: string | null
          name: string
          domain: string
          shopify_store_url: string | null
          logo_url: string | null
          tier: 'starter' | 'growth' | 'pro' | 'enterprise'
          settings: Json
          created_at: string
          updated_at: string
          active: boolean
        }
        Insert: {
          id?: string
          user_id?: string | null
          name: string
          domain: string
          shopify_store_url?: string | null
          logo_url?: string | null
          tier?: 'starter' | 'growth' | 'pro' | 'enterprise'
          settings?: Json
          created_at?: string
          updated_at?: string
          active?: boolean
        }
        Update: {
          id?: string
          user_id?: string | null
          name?: string
          domain?: string
          shopify_store_url?: string | null
          logo_url?: string | null
          tier?: 'starter' | 'growth' | 'pro' | 'enterprise'
          settings?: Json
          created_at?: string
          updated_at?: string
          active?: boolean
        }
      }
      decision_queries: {
        Row: {
          id: string
          client_id: string
          query: string
          cluster: string | null
          tags: string[]
          volume_estimate: number | null
          priority: 'low' | 'medium' | 'high' | 'critical'
          status: 'active' | 'paused' | 'archived'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          query: string
          cluster?: string | null
          tags?: string[]
          volume_estimate?: number | null
          priority?: 'low' | 'medium' | 'high' | 'critical'
          status?: 'active' | 'paused' | 'archived'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          query?: string
          cluster?: string | null
          tags?: string[]
          volume_estimate?: number | null
          priority?: 'low' | 'medium' | 'high' | 'critical'
          status?: 'active' | 'paused' | 'archived'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      visibility_snapshots: {
        Row: {
          id: string
          client_id: string
          date: string
          share_of_answer: number | null
          brand_mentions: number
          competitor_mentions: Json
          platforms_data: Json
          query_results: Json
          raw_data: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          date: string
          share_of_answer?: number | null
          brand_mentions?: number
          competitor_mentions?: Json
          platforms_data?: Json
          query_results?: Json
          raw_data?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          date?: string
          share_of_answer?: number | null
          brand_mentions?: number
          competitor_mentions?: Json
          platforms_data?: Json
          query_results?: Json
          raw_data?: Json | null
          created_at?: string
        }
      }
      citations: {
        Row: {
          id: string
          client_id: string
          query_id: string | null
          platform: 'chatgpt' | 'perplexity' | 'claude' | 'gemini' | 'google_aio'
          query_text: string | null
          cited_domain: string | null
          cited_url: string | null
          brand_mentioned: boolean
          position: number | null
          response_snippet: string | null
          screenshot_url: string | null
          tested_at: string
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          query_id?: string | null
          platform: 'chatgpt' | 'perplexity' | 'claude' | 'gemini' | 'google_aio'
          query_text?: string | null
          cited_domain?: string | null
          cited_url?: string | null
          brand_mentioned?: boolean
          position?: number | null
          response_snippet?: string | null
          screenshot_url?: string | null
          tested_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          query_id?: string | null
          platform?: 'chatgpt' | 'perplexity' | 'claude' | 'gemini' | 'google_aio'
          query_text?: string | null
          cited_domain?: string | null
          cited_url?: string | null
          brand_mentioned?: boolean
          position?: number | null
          response_snippet?: string | null
          screenshot_url?: string | null
          tested_at?: string
          created_at?: string
        }
      }
      pdp_audits: {
        Row: {
          id: string
          client_id: string
          url: string
          product_title: string | null
          overall_score: number | null
          schema_score: number | null
          extractability_score: number | null
          feed_alignment_score: number | null
          has_product_schema: boolean
          has_offer_schema: boolean
          has_faq_schema: boolean
          has_review_schema: boolean
          schema_issues: string[]
          detected_schema: Json | null
          has_spec_table: boolean
          has_short_claims: boolean
          has_comparison: boolean
          extractability_issues: string[]
          detected_claims: string[]
          recommendations: Json
          audited_at: string
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          url: string
          product_title?: string | null
          overall_score?: number | null
          schema_score?: number | null
          extractability_score?: number | null
          feed_alignment_score?: number | null
          has_product_schema?: boolean
          has_offer_schema?: boolean
          has_faq_schema?: boolean
          has_review_schema?: boolean
          schema_issues?: string[]
          detected_schema?: Json | null
          has_spec_table?: boolean
          has_short_claims?: boolean
          has_comparison?: boolean
          extractability_issues?: string[]
          detected_claims?: string[]
          recommendations?: Json
          audited_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          url?: string
          product_title?: string | null
          overall_score?: number | null
          schema_score?: number | null
          extractability_score?: number | null
          feed_alignment_score?: number | null
          has_product_schema?: boolean
          has_offer_schema?: boolean
          has_faq_schema?: boolean
          has_review_schema?: boolean
          schema_issues?: string[]
          detected_schema?: Json | null
          has_spec_table?: boolean
          has_short_claims?: boolean
          has_comparison?: boolean
          extractability_issues?: string[]
          detected_claims?: string[]
          recommendations?: Json
          audited_at?: string
          created_at?: string
        }
      }
      feed_validations: {
        Row: {
          id: string
          client_id: string
          feed_type: 'shopify' | 'gmc' | 'acp' | 'custom'
          feed_url: string | null
          total_products: number
          valid_products: number
          acp_readiness_score: number | null
          shopping_optimization_score: number | null
          required_field_coverage: Json
          recommended_field_coverage: Json
          critical_issues: string[]
          warnings: string[]
          product_issues: Json
          validated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          feed_type: 'shopify' | 'gmc' | 'acp' | 'custom'
          feed_url?: string | null
          total_products?: number
          valid_products?: number
          acp_readiness_score?: number | null
          shopping_optimization_score?: number | null
          required_field_coverage?: Json
          recommended_field_coverage?: Json
          critical_issues?: string[]
          warnings?: string[]
          product_issues?: Json
          validated_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          feed_type?: 'shopify' | 'gmc' | 'acp' | 'custom'
          feed_url?: string | null
          total_products?: number
          valid_products?: number
          acp_readiness_score?: number | null
          shopping_optimization_score?: number | null
          required_field_coverage?: Json
          recommended_field_coverage?: Json
          critical_issues?: string[]
          warnings?: string[]
          product_issues?: Json
          validated_at?: string
          created_at?: string
        }
      }
      offsite_mentions: {
        Row: {
          id: string
          client_id: string
          source: 'reddit' | 'youtube' | 'blog' | 'review_site' | 'forum' | 'social'
          platform: string | null
          url: string
          title: string | null
          author: string | null
          sentiment: 'positive' | 'neutral' | 'negative' | null
          engagement: Json
          products_mentioned: string[]
          is_ai_cited: boolean
          content_snippet: string | null
          discovered_at: string
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          source: 'reddit' | 'youtube' | 'blog' | 'review_site' | 'forum' | 'social'
          platform?: string | null
          url: string
          title?: string | null
          author?: string | null
          sentiment?: 'positive' | 'neutral' | 'negative' | null
          engagement?: Json
          products_mentioned?: string[]
          is_ai_cited?: boolean
          content_snippet?: string | null
          discovered_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          source?: 'reddit' | 'youtube' | 'blog' | 'review_site' | 'forum' | 'social'
          platform?: string | null
          url?: string
          title?: string | null
          author?: string | null
          sentiment?: 'positive' | 'neutral' | 'negative' | null
          engagement?: Json
          products_mentioned?: string[]
          is_ai_cited?: boolean
          content_snippet?: string | null
          discovered_at?: string
          created_at?: string
        }
      }
      agentic_commerce_status: {
        Row: {
          id: string
          client_id: string
          chatgpt_shopping_visible: boolean
          chatgpt_instant_checkout: boolean
          acp_feed_submitted: boolean
          acp_feed_approved: boolean
          perplexity_merchant_applied: boolean
          perplexity_merchant_approved: boolean
          perplexity_buy_enabled: boolean
          stripe_acp_enabled: boolean
          notes: string | null
          last_checked: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          chatgpt_shopping_visible?: boolean
          chatgpt_instant_checkout?: boolean
          acp_feed_submitted?: boolean
          acp_feed_approved?: boolean
          perplexity_merchant_applied?: boolean
          perplexity_merchant_approved?: boolean
          perplexity_buy_enabled?: boolean
          stripe_acp_enabled?: boolean
          notes?: string | null
          last_checked?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          chatgpt_shopping_visible?: boolean
          chatgpt_instant_checkout?: boolean
          acp_feed_submitted?: boolean
          acp_feed_approved?: boolean
          perplexity_merchant_applied?: boolean
          perplexity_merchant_approved?: boolean
          perplexity_buy_enabled?: boolean
          stripe_acp_enabled?: boolean
          notes?: string | null
          last_checked?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      competitors: {
        Row: {
          id: string
          client_id: string
          name: string
          domain: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          name: string
          domain: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          name?: string
          domain?: string
          notes?: string | null
          created_at?: string
        }
      }
      // Buyer Trigger Agent tables
      onboarding_sessions: {
        Row: {
          id: string
          email: string
          company_name: string | null
          website_url: string | null
          industry: string | null
          target_buyer: string | null
          buyer_journey_stage: string | null
          current_step: number
          completed: boolean
          session_data: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          company_name?: string | null
          website_url?: string | null
          industry?: string | null
          target_buyer?: string | null
          buyer_journey_stage?: string | null
          current_step?: number
          completed?: boolean
          session_data?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          company_name?: string | null
          website_url?: string | null
          industry?: string | null
          target_buyer?: string | null
          buyer_journey_stage?: string | null
          current_step?: number
          completed?: boolean
          session_data?: Json
          created_at?: string
          updated_at?: string
        }
      }
      signal_configurations: {
        Row: {
          id: string
          session_id: string
          signal_type: string
          signal_description: string | null
          priority: string
          enabled: boolean
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          signal_type: string
          signal_description?: string | null
          priority?: string
          enabled?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          signal_type?: string
          signal_description?: string | null
          priority?: string
          enabled?: boolean
          created_at?: string
        }
      }
      buyer_trigger_leads: {
        Row: {
          id: string
          session_id: string
          company_name: string
          domain: string | null
          signal_matched: string[]
          confidence_score: number | null
          discovered_at: string
          contact_info: Json
          enrichment_data: Json
          status: string
        }
        Insert: {
          id?: string
          session_id: string
          company_name: string
          domain?: string | null
          signal_matched?: string[]
          confidence_score?: number | null
          discovered_at?: string
          contact_info?: Json
          enrichment_data?: Json
          status?: string
        }
        Update: {
          id?: string
          session_id?: string
          company_name?: string
          domain?: string | null
          signal_matched?: string[]
          confidence_score?: number | null
          discovered_at?: string
          contact_info?: Json
          enrichment_data?: Json
          status?: string
        }
      }
      signal_matches: {
        Row: {
          id: string
          lead_id: string
          signal_config_id: string
          signal_type: string
          evidence_url: string | null
          evidence_snippet: string | null
          detected_at: string | null
          confidence_score: number | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          signal_config_id: string
          signal_type: string
          evidence_url?: string | null
          evidence_snippet?: string | null
          detected_at?: string | null
          confidence_score?: number | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          lead_id?: string
          signal_config_id?: string
          signal_type?: string
          evidence_url?: string | null
          evidence_snippet?: string | null
          detected_at?: string | null
          confidence_score?: number | null
          metadata?: Json
          created_at?: string
        }
      }
      buyer_trigger_subscriptions: {
        Row: {
          id: string
          session_id: string
          email: string
          frequency: string
          active: boolean
          last_sent_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          email: string
          frequency?: string
          active?: boolean
          last_sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          email?: string
          frequency?: string
          active?: boolean
          last_sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      // Existing tables
      claims: {
        Row: {
          id: string
          slug: string
          h1: string
          tl_dr: string
          pull_quotes: string[]
          proof_table: Json | null
          csv_url: string | null
          jsonld: Json | null
          updated_at: string
          published: boolean
        }
        Insert: {
          id?: string
          slug: string
          h1: string
          tl_dr: string
          pull_quotes?: string[]
          proof_table?: Json | null
          csv_url?: string | null
          jsonld?: Json | null
          updated_at?: string
          published?: boolean
        }
        Update: {
          id?: string
          slug?: string
          h1?: string
          tl_dr?: string
          pull_quotes?: string[]
          proof_table?: Json | null
          csv_url?: string | null
          jsonld?: Json | null
          updated_at?: string
          published?: boolean
        }
      }
      events: {
        Row: {
          id: string
          claim_slug: string
          referrer: string | null
          is_ai_referrer: boolean
          page: string
          event_type: string
          meta: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          claim_slug: string
          referrer?: string | null
          is_ai_referrer?: boolean
          page: string
          event_type: string
          meta?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          claim_slug?: string
          referrer?: string | null
          is_ai_referrer?: boolean
          page?: string
          event_type?: string
          meta?: Json | null
          created_at?: string
        }
      }
      leads: {
        Row: {
          id: string
          email: string
          company: string | null
          icp: Json | null
          pains: string[]
          proof_links: string[]
          competitors: string[]
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          company?: string | null
          icp?: Json | null
          pains?: string[]
          proof_links?: string[]
          competitors?: string[]
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          company?: string | null
          icp?: Json | null
          pains?: string[]
          proof_links?: string[]
          competitors?: string[]
          created_at?: string
        }
      }
    }
    Functions: {
      get_client_dashboard: {
        Args: { p_client_id: string }
        Returns: Json
      }
    }
  }
}

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']

export type Client = Database['public']['Tables']['clients']['Row']
export type DecisionQuery = Database['public']['Tables']['decision_queries']['Row']
export type VisibilitySnapshot = Database['public']['Tables']['visibility_snapshots']['Row']
export type Citation = Database['public']['Tables']['citations']['Row']
export type PDPAudit = Database['public']['Tables']['pdp_audits']['Row']
export type FeedValidation = Database['public']['Tables']['feed_validations']['Row']
export type OffsiteMention = Database['public']['Tables']['offsite_mentions']['Row']
export type AgenticCommerceStatus = Database['public']['Tables']['agentic_commerce_status']['Row']
export type Competitor = Database['public']['Tables']['competitors']['Row']
export type OnboardingSession = Database['public']['Tables']['onboarding_sessions']['Row']
export type SignalConfiguration = Database['public']['Tables']['signal_configurations']['Row']
export type BuyerTriggerLead = Database['public']['Tables']['buyer_trigger_leads']['Row']
export type SignalMatch = Database['public']['Tables']['signal_matches']['Row']
export type BuyerTriggerSubscription = Database['public']['Tables']['buyer_trigger_subscriptions']['Row']
