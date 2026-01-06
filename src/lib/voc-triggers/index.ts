/**
 * VoC-First Trigger Discovery & Signal Mapping
 * 
 * This module provides voice-of-customer based buyer trigger discovery
 * and signal mapping using free/low-cost data sources.
 * 
 * Core concepts:
 * - Trigger: What the buyer experiences that creates a buying moment
 * - Signal: Observable external indicator that a trigger has occurred
 * - Evidence: Actual data showing the trigger happened
 * 
 * Flow:
 * 1. Extract triggers from reviews, Reddit, case studies
 * 2. Synthesize into trigger patterns
 * 3. Map triggers to observable signals
 * 4. Monitor signals for target companies
 * 5. Score and rank leads by signal convergence
 */

// Types
export * from './types';

// Extraction utilities
export {
  extractTriggersFromReviews,
  extractTriggersFromReddit,
  extractTriggersFromWebsite,
  synthesizeTriggerPatterns,
  searchRedditWithExa,
  scrapeG2Reviews,
  mineCompetitorReviews
} from './extraction';

// Signal translation
export {
  generateSignalConfigurations,
  detectSignalsForCompany,
  calculateCompositeScore,
  rankCompaniesBySignals
} from './signal-translation';

