export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type AiProviderId = 'groq' | 'gemini';

export interface AiProviderConfig {
  provider: AiProviderId;
  apiKey: string;
  model: string;
}

export interface AiCompleteOptions {
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
}
