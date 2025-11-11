import { useState, useEffect, useCallback } from 'react';
import { PROVIDER_MODELS, testLangChainConfig, detectProviderFromKey } from './langchain';
import type { LangChainConfig } from './langchain';

const AI_CONFIG_KEY = 'ai_config';

export function useAIConfig() {
  const [config, setConfig] = useState<LangChainConfig | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  // Load config from database (and listen for external reload requests)
  useEffect(() => {
    let mounted = true;

    const loadConfig = async () => {
      try {
        // Initialize database
        if (window.electronIO?.ipcRenderer) {
          await window.electronIO.ipcRenderer.invoke('ai-keys-init');
        }

        // Try to load active key from database
        if (window.electronIO?.ipcRenderer) {
          try {
            const activeKey = await window.electronIO.ipcRenderer.invoke('ai-key-get-active');
            if (mounted && activeKey && activeKey.api_key) {
              setConfig({
                provider: activeKey.provider,
                apiKey: activeKey.api_key,
                model:
                  activeKey.model ||
                  PROVIDER_MODELS[activeKey.provider as keyof typeof PROVIDER_MODELS]?.[0] ||
                  '',
                temperature: activeKey.temperature || 0.7,
                baseUrl: activeKey.base_url || undefined,
              });
              setIsLoadingConfig(false);
              return;
            }
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('Failed to load active AI key from database:', e);
          }
        }

        // Fallback to localStorage for backward compatibility
        const apiKey = localStorage.getItem('ai_api_key');
        const saved = localStorage.getItem(AI_CONFIG_KEY);
        let savedConfig: Partial<LangChainConfig> = {};
        if (saved) {
          try {
            savedConfig = JSON.parse(saved);
          } catch {
            // ignore
          }
        }

        if (apiKey) {
          const provider = savedConfig.provider || detectProviderFromKey(apiKey);
          if (provider !== 'unknown') {
            if (!mounted) return;
            setConfig({
              provider,
              apiKey,
              model:
                savedConfig.model || PROVIDER_MODELS[provider as keyof typeof PROVIDER_MODELS]?.[0] || '',
              temperature: savedConfig.temperature || 0.7,
            });
            setIsLoadingConfig(false);
            return;
          }
        }

        if (!mounted) return;
        // No config found
        setConfig(null);
        setIsLoadingConfig(false);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error loading AI config:', error);
        if (!mounted) return;
        setConfig(null);
        setIsLoadingConfig(false);
      }
    };

    // Do initial load
    loadConfig();

    // Listen for requests to reload AI config
    const onApiKeyCheck = () => {
      loadConfig();
    };

    try {
      window.addEventListener('ai_api_key_check', onApiKeyCheck as EventListener);
    } catch (e) {
      // ignore in non-window environments
    }

    return () => {
      mounted = false;
      try {
        window.removeEventListener('ai_api_key_check', onApiKeyCheck as EventListener);
      } catch (e) {
        // ignore
      }
    };
  }, []);

  const [isValid, setIsValid] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Persist non-secret parts to localStorage for backward compatibility
  useEffect(() => {
    if (config && config.apiKey) {
      const configWithoutKey = { ...config } as any;
      delete configWithoutKey.apiKey;
      try {
        localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(configWithoutKey));
        localStorage.setItem('ai_api_key', config.apiKey);
      } catch (e) {
        // ignore
      }
    }
  }, [config]);

  // Validate config whenever it changes (debounced)
  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    const validate = async () => {
      if (!config || !config.apiKey || config.apiKey.trim().length === 0) {
        setIsValid(false);
        setIsLoading(false);
        return;
      }

      // Auto-detect provider if not set
      if (!config.provider || config.provider === 'unknown') {
        const detected = detectProviderFromKey(config.apiKey);
        if (detected !== 'unknown') {
          setConfig((prev) => (prev ? { ...prev, provider: detected } : prev));
        }
      }

      setIsLoading(true);
      setError(null);

      timeoutId = setTimeout(async () => {
        try {
          const detectedProvider = detectProviderFromKey(config.apiKey);
          if (detectedProvider === 'unknown' && (!config.provider || config.provider === 'unknown')) {
            if (mounted) {
              setIsValid(false);
              setError('Unable to detect provider from API key format');
              setIsLoading(false);
            }
            return;
          }

          const valid = await testLangChainConfig(config);
          if (mounted) {
            const providerIsDetected = detectedProvider !== 'unknown' || (config.provider && config.provider !== 'unknown');
            setIsValid(valid || providerIsDetected);
            if (!valid && !providerIsDetected) {
              setError('Invalid API key or configuration');
            } else if (!valid && providerIsDetected) {
              setError(null);
            } else {
              setError(null);
            }
          }
        } catch (err) {
          if (mounted) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error';
            const detectedProvider = detectProviderFromKey(config.apiKey);
            if (detectedProvider !== 'unknown') {
              setIsValid(true);
              setError(null);
            } else {
              setError(errorMsg);
              setIsValid(false);
            }
          }
        } finally {
          if (mounted) setIsLoading(false);
        }
      }, 500);

      return () => {
        if (timeoutId) clearTimeout(timeoutId);
      };
    };

    validate();

    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [config?.apiKey, config?.provider]);

  const updateConfig = useCallback((updates: Partial<LangChainConfig> | LangChainConfig) => {
    setConfig((prev) => {
      if (prev) return { ...prev, ...updates } as LangChainConfig;
      if ((updates as LangChainConfig).provider && (updates as LangChainConfig).apiKey) return updates as LangChainConfig;
      return prev;
    });
  }, []);

  const clearConfig = useCallback(() => {
    setConfig(null);
    setIsValid(false);
    setError(null);
    try {
      localStorage.removeItem(AI_CONFIG_KEY);
      localStorage.removeItem('ai_api_key');
    } catch (e) {
      // ignore
    }
  }, []);

  const getAvailableModels = useCallback(() => {
    if (!config?.provider) return [];
    return PROVIDER_MODELS[config.provider as keyof typeof PROVIDER_MODELS] || [];
  }, [config?.provider]);

  const validateConfig = useCallback(async () => {
    if (!config || !config.apiKey || config.apiKey.trim().length === 0) {
      setIsValid(false);
      setError('API key is required');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const detectedProvider = detectProviderFromKey(config.apiKey);
      if (detectedProvider === 'unknown' && (!config.provider || config.provider === 'unknown')) {
        setIsValid(false);
        setError('Unable to detect provider from API key format');
        setIsLoading(false);
        return false;
      }

      const valid = await testLangChainConfig(config);
      const providerIsDetected = detectedProvider !== 'unknown' || (config.provider && config.provider !== 'unknown');
      setIsValid(valid || providerIsDetected);
      if (!valid && !providerIsDetected) {
        setError('Invalid API key or configuration');
        return false;
      } else if (!valid && providerIsDetected) {
        setError(null);
        return true;
      } else {
        setError(null);
        return true;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      const detectedProvider = detectProviderFromKey(config.apiKey);
      if (detectedProvider !== 'unknown') {
        setIsValid(true);
        setError(null);
        return true;
      }
      setError(errorMsg);
      setIsValid(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [config]);

  return {
    config,
    isValid,
    isLoading: isLoading || isLoadingConfig,
    error,
    updateConfig,
    clearConfig,
    getAvailableModels,
    validateConfig,
  };
}
