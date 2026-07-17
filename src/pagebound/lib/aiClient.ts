import { groqComplete } from './groq';
import { geminiComplete } from './gemini';
import type { AiMessage, AiProviderId, AiProviderConfig, AiCompleteOptions } from './aiTypes';

export type { AiMessage, AiProviderId, AiProviderConfig, AiCompleteOptions };

/**
 * Single entry point for every AI call in the app (Polish, OCR-fix,
 * Introduction, Index, AI-assisted chapter splitting). Each consumer takes
 * an AiProviderConfig instead of a raw apiKey/model pair so switching
 * providers doesn't require touching every call site — only this dispatcher
 * needed to know both providers exist.
 */
export async function aiComplete(
  config: AiProviderConfig,
  messages: AiMessage[],
  opts: AiCompleteOptions = {}
): Promise<string> {
  if (config.provider === 'gemini') {
    return geminiComplete(config.apiKey, config.model, messages, opts);
  }
  return groqComplete(config.apiKey, config.model, messages, opts);
}
