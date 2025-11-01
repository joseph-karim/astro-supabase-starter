export const AI_REFERRERS = [
  'perplexity.ai',
  'chat.openai.com',
  'you.com',
  'brave.com',
  'duckduckgo.com',
  'neeva.com',
  'phind.com',
  'bing.com/chat',
  'bard.google.com',
  'claude.ai'
];

export const isAIReferrer = (ref?: string): boolean => {
  if (!ref) return false;
  return AI_REFERRERS.some(host => ref.includes(host));
};
