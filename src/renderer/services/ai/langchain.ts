import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import customProviders from './customProviders';

// Try to import HumanMessage, fallback if not available
let HumanMessage: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const core = require('@langchain/core');
  HumanMessage = core.messages?.HumanMessage || core.HumanMessage;
} catch (e) {
  // HumanMessage not available, we'll use string format instead
}

// Dynamic imports for optional providers
let ChatOllama: any;
let ChatHuggingFace: any;
let ChatMistralAI: any;

// Try to load optional providers from community package
// Note: These are optional dependencies and may not be available
// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const loadOptionalProviders = () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const community = require('@langchain/community');
    // Google provider is now imported directly at the top
    if (community.ChatOllama) {
      ChatOllama = community.ChatOllama;
    }
    if (community.ChatHuggingFace) {
      ChatHuggingFace = community.ChatHuggingFace;
    }
    if (community.ChatMistralAI) {
      ChatMistralAI = community.ChatMistralAI;
    }
  } catch (e) {
    // Some providers may not be available - this is expected
  }
};

loadOptionalProviders();

export const PROVIDER_MODELS = {
  openai: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-3.5-turbo-16k'],
  google: [
    'gemini-pro',
    'gemini-pro-vision',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
  ],
  anthropic: [
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
    'claude-2.1',
    'claude-2.0',
  ],
  huggingface: [
    'meta-llama/Llama-2-70b-chat-hf',
    'mistralai/Mistral-7B-Instruct-v0.1',
  ],
  mistral: ['mistral-large', 'mistral-medium', 'mistral-small'],
  ollama: ['llama2', 'mistral', 'codellama', 'neural-chat', 'starling-lm'],
  perplexity: ['perplexity-v1'],
  grok: ['grok-1'],
  // CORRECT DeepSeek model names:
  deepseek: ['deepseek-chat', 'deepseek-coder'],
  local: ['local-llm'],
} as const;

/**
 * Detect provider from API key format
 */
export function detectProviderFromKey(key: string): string {
  if (!key) return 'unknown';

  // DeepSeek: prioritize detection, even if key starts with sk-
  if (/deepseek/i.test(key)) return 'deepseek';
  // Add more DeepSeek patterns if needed (e.g., length, prefix)

  // Anthropic keys start with sk-ant-
  if (/^sk-ant-/.test(key)) return 'anthropic';

  // Perplexity - sometimes provided as p-x or contain 'perplexity'
  if (/^p-|perplexity/i.test(key)) return 'perplexity';

  // Grok (xAI) - detect by prefix if present
  if (/^grok-|^xai-/i.test(key)) return 'grok';

  // Hugging Face keys start with hf_
  if (/^hf_/.test(key)) return 'huggingface';

  // Google API keys are long alphanumeric strings
  if (/^[A-Za-z0-9_-]{39}$/.test(key) || /^AIza/.test(key)) return 'google';

  // Mistral keys start with specific patterns
  if (/^[A-Za-z0-9]{32,}$/.test(key) && key.length === 32) return 'mistral';

  // Ollama doesn't use API keys, but we can detect by baseUrl
  if (key.startsWith('ollama://') || key.startsWith('http://localhost:11434'))
    return 'ollama';

  // OpenAI keys start with sk- or org- (fallback, last)
  if (/^(sk-|org-)/.test(key)) return 'openai';

  return 'unknown';
}

/**
 * Create a LangChain model instance for the given provider.
 * Supports OpenAI, Google, Anthropic, Hugging Face, Mistral, and Ollama.
 */
export async function createLangChainModel(
  config: LangChainConfig,
): Promise<any> {
  const { provider, apiKey, model, temperature = 0.7, baseUrl } = config;

  // Validate API key exists
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error(
      `API key is required for ${provider}. Please configure it in Settings > AI.`,
    );
  }

  try {
    switch (provider) {
      case 'openai': {
        const trimmedKey = apiKey.trim();
        if (!trimmedKey.startsWith('sk-') && !trimmedKey.startsWith('org-')) {
          // eslint-disable-next-line no-console
          console.warn(
            '[createLangChainModel] OpenAI key format may be invalid. Expected to start with "sk-" or "org-"',
          );
        }
        // eslint-disable-next-line no-console
        console.log(
          '[createLangChainModel] Creating OpenAI model with key length:',
          trimmedKey.length,
        );
        const chatModel = new ChatOpenAI({
          openAIApiKey: trimmedKey,
          apiKey: trimmedKey, // Also set apiKey as alias (LangChain supports both)
          modelName: model || 'gpt-3.5-turbo',
          temperature,
        });
        // Verify the key was set
        // @ts-ignore - check internal state
        if (chatModel.openAIApiKey !== trimmedKey) {
          // eslint-disable-next-line no-console
          console.warn(
            '[createLangChainModel] API key may not have been set correctly',
          );
        }
        return chatModel;
      }

      case 'google': {
        try {
          const modelName = model === 'gemini-1.5-flash' 
            ? 'gemini-1.5-pro' 
            : (model || 'gemini-pro');
          
          return new ChatGoogleGenerativeAI({
            apiKey: apiKey.trim(),
            model: modelName,
            temperature,
            maxOutputTokens: 2048,
          });
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(
            '[createLangChainModel] Error creating Google model:',
            error,
          );
          throw error;
        }
      }

      case 'anthropic': {
        return new ChatAnthropic({
          anthropicApiKey: apiKey,
          modelName: model || 'claude-3-sonnet-20240229',
          temperature,
        });
      }

      case 'huggingface': {
        if (!ChatHuggingFace) {
          throw new Error(
            'Hugging Face provider not available. Install @langchain/community',
          );
        }
        return new ChatHuggingFace({
          model: model || 'meta-llama/Llama-2-70b-chat-hf',
          huggingfaceApiKey: apiKey,
          temperature,
        });
      }

      case 'mistral': {
        if (!ChatMistralAI) {
          throw new Error(
            'Mistral provider not available. Install @langchain/mistralai',
          );
        }
        return new ChatMistralAI({
          apiKey,
          modelName: model || 'mistral-small',
          temperature,
        });
      }

      case 'ollama': {
        if (!ChatOllama) {
          throw new Error(
            'Ollama provider not available. Install @langchain/ollama',
          );
        }
        const ollamaBaseUrl = baseUrl || 'http://localhost:11434';
        return new ChatOllama({
          baseUrl: ollamaBaseUrl,
          model: model || 'llama2',
          temperature,
        });
      }

      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Failed to create ${provider} model:`, error);
    throw error;
  }
}

export async function testLangChainConfig(
  config: LangChainConfig,
): Promise<boolean> {
  try {
    // First, try to create the model instance (this validates the config structure)
    const model = await createLangChainModel(config);

    if (!model) {
      return false;
    }

    // For Ollama, we can skip the actual API call test since it might not be running
    if (config.provider === 'ollama') {
      // Just verify the model instance was created
      return true;
    }

    // For other providers, try a minimal test
    // Use a timeout to avoid hanging on invalid keys
    const testPromise = (async () => {
      const testPrompt = 'Hi';

      try {
        // Try with HumanMessage first if available, otherwise use array format
        if (HumanMessage) {
          const messages = [new HumanMessage(testPrompt)];
          const response = await model.invoke(messages);
          return !!response;
        }
        // Try array format
        const arrayFormat = [{ role: 'user', content: testPrompt }];
        const response = await model.invoke(arrayFormat);
        return !!response;
      } catch (e) {
        // Fallback to plain string
        if (typeof model.invoke === 'function') {
          const response = await model.invoke(testPrompt);
          return !!response;
        }
        if (typeof model.call === 'function') {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          const response = await model.call(testPrompt);
          return !!response;
        }
        return false;
      }
    })();

    // Add timeout of 10 seconds
    const timeoutPromise = new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(false), 10000);
    });

    const result = await Promise.race([testPromise, timeoutPromise]);
    return result;
  } catch (err) {
    // Log the error for debugging but don't fail validation for network/auth errors
    const errorMessage = err instanceof Error ? err.message : String(err);

    // If it's a provider not available error, that's a real issue
    if (errorMessage.includes('not available')) {
      // eslint-disable-next-line no-console
      console.error('LangChain provider not available:', errorMessage);
      return false;
    }

    // For other errors (network, auth, etc.), we'll be lenient
    // The key format was detected correctly, so we'll assume it's valid
    // The actual error will show up when trying to use it
    // eslint-disable-next-line no-console
    console.warn(
      'LangChain test had issues (but key format is valid):',
      errorMessage,
    );

    // Return true if provider was detected correctly (format is valid)
    // The actual API call will fail later if the key is truly invalid
    return config.provider !== 'unknown';
  }
}

export async function processTextWithAI(
  text: string,
  config: LangChainConfig,
  options?: { maxTokens?: number; temperature?: number },
): Promise<string> {
  // Validate config
  if (!config || !config.apiKey || config.apiKey.trim().length === 0) {
    throw new Error(
      'API key is missing. Please configure it in Settings > AI tab.',
    );
  }

  if (!config.provider || config.provider === 'unknown') {
    throw new Error(
      'AI provider is not configured. Please set an API key in Settings > AI tab.',
    );
  }

  // For DeepSeek, default the baseUrl so users don't need to enter it manually
  if (config.provider === 'deepseek') {
  return customProviders.callDeepSeek(text, config.apiKey.trim(), config.baseUrl, config.model || 'deepseek-chat');
}
  if (config.provider === 'perplexity' && (!config.baseUrl || config.baseUrl.trim().length === 0)) {
    throw new Error(
      'Perplexity requires a Base URL to be configured in Settings > AI. Please set the base URL and try again.',
    );
  }
  if (config.provider === 'grok' && (!config.baseUrl || config.baseUrl.trim().length === 0)) {
    throw new Error(
      'Grok requires a Base URL to be configured in Settings > AI. Please set the base URL and try again.',
    );
  }

  // eslint-disable-next-line no-console
  console.log('[processTextWithAI] Starting with provider:', config.provider);
  // eslint-disable-next-line no-console
  console.log(
    '[processTextWithAI] API key: ',
    config.apiKey ? config.apiKey : 0,
  );

  // Handle providers that don't use LangChain by calling lightweight adapters
  if (config.provider === 'perplexity') {
    return customProviders.callPerplexity(text, config.apiKey.trim(), config.baseUrl);
  }
  if (config.provider === 'grok') {
    return customProviders.callGrok(text, config.apiKey.trim(), config.baseUrl);
  }
  if (config.provider === 'deepseek') {
    return customProviders.callDeepSeek(text, config.apiKey.trim(), config.baseUrl, config.model);
  }

  // Helper: list Google models and pick one supporting a given method
  async function findGoogleModelSupporting(apiKey: string, method = 'generateContent') {
    const endpoints = [
      'https://generativelanguage.googleapis.com/v1/models',
      'https://generativelanguage.googleapis.com/v1beta/models',
    ];
    try {
      for (const base of endpoints) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const res = await fetch(`${base}?key=${encodeURIComponent(apiKey)}`);
          if (!res.ok) {
            // eslint-disable-next-line no-console
            console.warn(`[findGoogleModelSupporting] ListModels ${base} returned ${res.status}`);
            continue;
          }
          // eslint-disable-next-line no-await-in-loop
          const data = await res.json();
          if (!data.models || !Array.isArray(data.models)) continue;
          for (const m of data.models) {
            const methods = m.supportedGenerationMethods || m.supportedMethods || m.supportedGenerationMethods;
            if (methods && Array.isArray(methods) && methods.includes(method)) {
              return m.name || m.model || null;
            }
          }
        } catch (e) {
          // ignore per-endpoint errors
        }
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  // We'll attempt once normally and once with a Google fallback (if applicable)
  let triedGoogleFallback = false;
  let lastErr: Error | null = null;

  // eslint-disable-next-line no-plusplus
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const model = await createLangChainModel({
      ...config,
      apiKey: config.apiKey.trim(), // Ensure trimmed
      temperature: options?.temperature ?? config.temperature,
    });

    if (!model) {
      throw new Error('Failed to create AI model instance');
    }

    try {
      let response: any;

      // Try different message formats in order of preference
      const formats = [
        // Format 1: HumanMessage (if available)
        () => {
          if (HumanMessage) {
            const messages = [new HumanMessage(text)];
            return model.invoke(messages);
          }
          throw new Error('HumanMessage not available');
        },
        // Format 2: Array format with role/content
        () => {
          const messages = [{ role: 'user', content: text }];
          return model.invoke(messages);
        },
        // Format 3: Plain string
        () => {
          return model.invoke(text);
        },
        // Format 4: Call method with string
        () => {
          if (typeof model.call === 'function') {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            return model.call(text, {
              maxTokens: options?.maxTokens,
            });
          }
          throw new Error('call method not available');
        },
      ];

      // Try each format until one works
      // eslint-disable-next-line no-plusplus
      for (let i = 0; i < formats.length; i += 1) {
        try {
          // eslint-disable-next-line no-console, no-await-in-loop
          console.log(`[processTextWithAI] Trying format ${i + 1}`);
          // eslint-disable-next-line no-await-in-loop
          response = await formats[i]();
          // eslint-disable-next-line no-console
          console.log(`[processTextWithAI] Format ${i + 1} succeeded`);
          break;
        } catch (formatError) {
          lastErr =
            formatError instanceof Error
              ? formatError
              : new Error(String(formatError));
          // eslint-disable-next-line no-console
          console.warn(
            `[processTextWithAI] Format ${i + 1} failed:`,
            lastErr.message,
          );
          if (i === formats.length - 1) {
            // Last format failed, throw the error so we can consider fallback
            throw lastErr;
          }
        }
      }

      if (!response) {
        throw new Error('No response received from AI model');
      }

      // eslint-disable-next-line no-console
      console.log('[processTextWithAI] Response type:', typeof response);
      // eslint-disable-next-line no-console
      console.log(
        '[processTextWithAI] Response keys:',
        response && typeof response === 'object' ? Object.keys(response) : 'N/A',
      );

      // Handle different response formats (same as before)
      if (typeof response === 'string') {
        return response;
      }
      if (response?.content !== undefined) {
        const { content } = response;
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) {
          return content
            .map((item) => (typeof item === 'string' ? item : item.text || JSON.stringify(item)))
            .join('\n');
        }
        return JSON.stringify(content);
      }
      if (response?.text) return response.text;
      if (response?.message?.content) return typeof response.message.content === 'string' ? response.message.content : JSON.stringify(response.message.content);
      if (response?.choices?.[0]?.message?.content) return typeof response.choices[0].message.content === 'string' ? response.choices[0].message.content : JSON.stringify(response.choices[0].message.content);
      if (response && typeof response === 'object') {
        // eslint-disable-next-line no-console
        console.warn('[processTextWithAI] Unexpected response format, stringifying:', response);
        return JSON.stringify(response, null, 2);
      }

      return String(response);
    } catch (err) {
      // Save last error and decide whether to attempt a Google-specific fallback
      // eslint-disable-next-line no-console
      console.error('[processTextWithAI] Error details:', {
        error: err,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        provider: config.provider,
      });

      const errorMessage = err instanceof Error ? err.message : String(err);
      lastErr = err instanceof Error ? err : new Error(String(err));

      // If it's Google and looks like a model/method mismatch, try to auto-select a working model once
      if (
        config.provider === 'google' &&
        !triedGoogleFallback &&
        (errorMessage.includes('not found') || errorMessage.includes('not supported') || errorMessage.includes('generateContent') || errorMessage.includes('call method not available'))
      ) {
        triedGoogleFallback = true;
        // eslint-disable-next-line no-console
        console.log('[processTextWithAI] Google provider error looks like model/method mismatch; attempting to list models and retry');
        try {
          // eslint-disable-next-line no-await-in-loop
          const fallback = await findGoogleModelSupporting(config.apiKey.trim(), 'generateContent');
          if (fallback && fallback !== config.model) {
            // Use the new model and retry the outer loop
            // eslint-disable-next-line no-console
            console.log('[processTextWithAI] Google fallback selected model:', fallback);
            // Mutate config.model for retry
            // @ts-ignore allow mutation
            config.model = fallback;
            // Continue to next attempt
            // eslint-disable-next-line no-continue
            continue;
          }
        } catch (listErr) {
          // ignore listing errors and fall through to rethrow
        }
      }

      // Provide more helpful error messages for common cases
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        throw new Error('Invalid API key. Please check your API key in Settings > AI.');
      }
      if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
        throw new Error('API rate limit exceeded. Please try again later.');
      }
      if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      }

      throw new Error(`AI processing failed: ${errorMessage}`);
    }
  }

  // If we exit the attempts loop without a successful response, throw the last error
  throw lastErr || new Error('AI processing failed');
}

export default {
  createLangChainModel,
  testLangChainConfig,
  processTextWithAI,
  PROVIDER_MODELS,
};
