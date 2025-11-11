/**
 * Simple HTTP adapters for providers that don't have a LangChain integration
 * These adapters are intentionally lightweight: they POST the prompt to a
 * configurable `baseUrl` and expect a text or json response. They use
 * Bearer token authorization by default.
 *
 * To use: provide `baseUrl` in the AI config (e.g. https://api.perplexity.ai/v1/ask)
 */
export async function callPerplexity(text: string, apiKey: string, baseUrl?: string) {
  if (!baseUrl) {
    throw new Error('Perplexity requires a baseUrl to be configured in AI settings (e.g. https://api.perplexity.ai)');
  }

  const url = baseUrl.replace(/\/$/, '') + '/v1/ask';
  const body = { question: text };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey ? `Bearer ${apiKey}` : '',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Perplexity API error: ${res.status} ${res.statusText} ${txt}`);
  }

  // Prefer text if available, otherwise JSON stringify
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const j = await res.json();
    // Try to extract a reasonable text field
    return (j.answer && (typeof j.answer === 'string' ? j.answer : JSON.stringify(j.answer))) || JSON.stringify(j);
  }
  return await res.text();
}

export async function callGrok(text: string, apiKey: string, baseUrl?: string) {
  if (!baseUrl) {
    throw new Error('Grok requires a baseUrl to be configured in AI settings (e.g. https://api.grok.ai)');
  }
  const url = baseUrl.replace(/\/$/, '') + '/v1/query';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey ? `Bearer ${apiKey}` : '',
    },
    body: JSON.stringify({ prompt: text }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Grok API error: ${res.status} ${res.statusText} ${txt}`);
  }

  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const j = await res.json();
    return (j.output && (typeof j.output === 'string' ? j.output : JSON.stringify(j.output))) || JSON.stringify(j);
  }
  return await res.text();
}

export async function callDeepSeek(text: string, apiKey: string, baseUrl?: string, model?: string): Promise<string> {
  try {
    const effectiveBaseUrl = baseUrl?.trim() || 'https://api.deepseek.com';
    const cleanBaseUrl = effectiveBaseUrl.replace(/\/$/, '');
    
    // Use correct model names - default to 'deepseek-chat'
    let effectiveModel = model || 'deepseek-chat'; // Change from const to let
    
    // Validate model name
    const validModels = ['deepseek-chat', 'deepseek-coder'];
    if (!validModels.includes(effectiveModel)) {
      console.warn(`[callDeepSeek] Invalid model '${effectiveModel}', defaulting to 'deepseek-chat'`);
      effectiveModel = 'deepseek-chat'; // This was causing the error - can't reassign const
    }
    
    console.log(`[callDeepSeek] Calling with model: ${effectiveModel}`);
    
    const response = await fetch(`${cleanBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: effectiveModel,
        messages: [
          {
            role: 'user',
            content: text
          }
        ],
        stream: false,
        temperature: 0.7,
        max_tokens: 2048
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    // Extract response from OpenAI-compatible format
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content;
    } else {
      throw new Error('Unexpected response format from DeepSeek API');
    }
  } catch (error) {
    console.error('DeepSeek API call failed:', error);
    throw error;
  }
}

export default { callPerplexity, callGrok, callDeepSeek };
