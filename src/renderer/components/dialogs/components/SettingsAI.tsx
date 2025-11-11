/**
 * BWS Vittoria - universal file and folder organizer
 * Copyright (C) 2024-present BWS Vittoria GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License (version 3) as
 * published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// Material UI components
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  Grid,
  Paper,
  Avatar,
  Modal,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Chip,
  Alert,
  Divider,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

// Material UI icons
import LockIcon from '@mui/icons-material/Lock';
import KeyIcon from '@mui/icons-material/VpnKey';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import DeleteIcon from '@mui/icons-material/Delete';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import PowerOffIcon from '@mui/icons-material/PowerOff';
// import Switch from '@mui/material/Switch';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction';

// Custom hooks and services
import { useAIConfig } from '../../../services/ai/useAIConfig';
import { PROVIDER_MODELS } from '../../../services/ai/langchain';
// import { SettingsTab } from '../SettingsDialog';
import TsButton from '-/components/TsButton';

// Event name for parser features to check API key status
export const API_KEY_CHECK_EVENT = 'ai_api_key_check';

// Event name for redirecting to AI settings
export const REDIRECT_TO_AI_SETTINGS_EVENT = 'redirect_to_ai_settings';

const PROVIDER_ICONS: Record<string, string> = {
  openai: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/openai.svg',
  google: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/googlecloud.svg',
  anthropic: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/anthropic.svg',
  huggingface: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/huggingface.svg',
  mistral: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/mistral.svg',
  ollama: 'https://ollama.com/public/ollama-logo.svg',
  perplexity: 'https://www.perplexity.ai/favicon.ico',
  grok: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/xai.svg',
  deepseek: 'https://deepseek.ai/favicon.ico',
  unknown: '',
};

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  google: 'Google',
  anthropic: 'Anthropic',
  huggingface: 'Hugging Face',
  mistral: 'Mistral',
  ollama: 'Ollama / Local',
  perplexity: 'Perplexity',
  grok: 'Grok',
  deepseek: 'DeepSeek',
  unknown: 'Unknown',
};

const PROVIDER_COLORS: Record<string, string> = {
  openai: '#10a37f',
  google: '#4285f4',
  anthropic: '#d97757',
  huggingface: '#ffd21e',
  mistral: '#5b21b6',
  ollama: '#3b82f6',
  perplexity: '#6f42c1',
  grok: '#ff6b6b',
  deepseek: '#0ea5a4',
  unknown: '#9e9e9e',
};

function getProviderHelpUrl(provider: string): string {
  switch (provider) {
    case 'openai':
      return 'https://platform.openai.com/account/api-keys';
    case 'google':
      return 'https://cloud.google.com/vertex-ai/docs/generative-ai/api-keys';
    case 'anthropic':
      return 'https://console.anthropic.com/settings/keys';
    case 'huggingface':
      return 'https://huggingface.co/settings/tokens';
    case 'mistral':
      return 'https://docs.mistral.ai/platform/api/#section/Authentication';
    case 'ollama':
      return 'https://ollama.com/';
    case 'perplexity':
      return 'https://www.perplexity.ai/';
    case 'grok':
      return 'https://x.ai/';
    case 'deepseek':
      return 'https://deepseek.ai/';
    default:
      return '';
  }
}

const PROVIDER_ORDER = [
  'openai',
  'google',
  'anthropic',
  'perplexity',
  'grok',
  'deepseek',
  'huggingface',
  'mistral',
  'ollama',
];

interface Props {
  closeSettings?: () => void;
}

function SettingsAI({ closeSettings }: Props): React.ReactElement {
  const { t } = useTranslation();
  const theme = useTheme();
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [touched, setTouched] = useState(false);
  const [redirectModal, setRedirectModal] = useState<{ isOpen: boolean; feature: 'pdf' | 'doc' | null }>({ 
    isOpen: false, 
    feature: null 
  });
  
  const {
    config,
    isValid: configValid,
    isLoading,
    error,
    updateConfig,
  // getAvailableModels,
    validateConfig,
  } = useAIConfig();
  
  const [isValidating, setIsValidating] = useState(false);
  const [savedKeys, setSavedKeys] = useState<any[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  
  const [provider, setProvider] = useState(config?.provider || '');
  const isValid = !!apiKey && provider && provider !== 'unknown' && configValid;
  const models = provider && provider !== 'unknown' ? (PROVIDER_MODELS[provider as keyof typeof PROVIDER_MODELS] || []) : [];
  const selectedModel = config?.model || models[0] || '';

  // Load saved keys from database
  const loadSavedKeys = useCallback(async () => {
    if (!window.electronIO?.ipcRenderer) return;
    setLoadingKeys(true);
    try {
      await window.electronIO.ipcRenderer.invoke('ai-keys-init');
      const keys = await window.electronIO.ipcRenderer.invoke('ai-keys-get-all');
      setSavedKeys(keys || []);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to load saved keys:', e);
    } finally {
      setLoadingKeys(false);
    }
  }, []);

  // Load saved keys on mount
  useEffect(() => {
    loadSavedKeys();
  }, [loadSavedKeys]);

  // Handle incoming redirect requests
  useEffect(() => {
    const handleRedirect = (e: Event) => {
      const customEvent = e as CustomEvent<{ feature: 'pdf' | 'doc' }>;
      setRedirectModal({ isOpen: true, feature: customEvent.detail.feature });
    };
    
    window.addEventListener(REDIRECT_TO_AI_SETTINGS_EVENT, handleRedirect);
    return () => window.removeEventListener(REDIRECT_TO_AI_SETTINGS_EVENT, handleRedirect);
  }, []);

  // Load API key from config (for input field)
  useEffect(() => {
    // Don't auto-fill from config - let user enter new keys
    // The active key is already loaded in useAIConfig
  }, [config]);

  // Remove auto-detection: only update config when provider is explicitly selected and key is entered
  useEffect(() => {
    if (provider && apiKey && apiKey.trim().length > 0) {
      const newConfig = {
        provider,
        apiKey: apiKey.trim(),
        model: config?.model || PROVIDER_MODELS[provider as keyof typeof PROVIDER_MODELS]?.[0] || '',
        temperature: config?.temperature || 0.7,
      };
      updateConfig(newConfig);
      localStorage.setItem('ai_api_key', apiKey.trim());
    } else {
      localStorage.removeItem('ai_api_key');
    }
  }, [provider, apiKey]);

  // Close redirect modal
  const handleCloseRedirectModal = useCallback(() => {
    setRedirectModal({ isOpen: false, feature: null });
  }, []);

  const handleOpenSettings = useCallback(() => {
    handleCloseRedirectModal();
    // The settings dialog is already open, just focus on this tab
    if (closeSettings) {
      // If we need to close and reopen, we could do that here
      // For now, just close the modal
    }
  }, [closeSettings, handleCloseRedirectModal]);

  const handleValidate = useCallback(async () => {
    if (!provider || provider === 'unknown' || !apiKey || apiKey.trim().length === 0) {
      setTouched(true);
      setIsValidating(false);
      return;
    }
    // Some providers require a baseUrl (Perplexity, Grok). DeepSeek will default to the public API URL.
    if (['perplexity', 'grok'].includes(provider) && (!baseUrl || baseUrl.trim().length === 0)) {
      // Inform the user clearly
      // eslint-disable-next-line no-alert
      alert(t('core:baseUrlRequired') || 'This provider requires an API Base URL to be configured in AI settings. Please enter the base URL and try again.');
      setIsValidating(false);
      return;
    }
    setIsValidating(true);
    setTouched(true);
    const baseUrlToSave = provider === 'deepseek' ? (baseUrl || 'https://api.deepseek.com') : (baseUrl || null);
    const newConfig = {
      provider,
      apiKey: apiKey.trim(),
      model: selectedModel || PROVIDER_MODELS[provider as keyof typeof PROVIDER_MODELS]?.[0] || '',
      temperature: config?.temperature || 0.7,
      baseUrl: baseUrlToSave || undefined,
    };
    updateConfig(newConfig);
    setTimeout(async () => {
      try {
        const valid = await validateConfig();
        if (valid && window.electronIO?.ipcRenderer) {
          await window.electronIO.ipcRenderer.invoke('ai-keys-init');
          const result = await window.electronIO.ipcRenderer.invoke(
            'ai-key-save',
            provider,
            apiKey.trim(),
            selectedModel || PROVIDER_MODELS[provider as keyof typeof PROVIDER_MODELS]?.[0] || '',
            config?.temperature || 0.7,
            baseUrlToSave,
          );
          if (result?.success) {
            const allKeys = await window.electronIO.ipcRenderer.invoke('ai-keys-get-all');
            if (!allKeys || allKeys.length === 0 || (config && configValid)) {
              await window.electronIO.ipcRenderer.invoke('ai-key-set-active', result.id, true);
            }
            await loadSavedKeys();
            setApiKey('');
            setBaseUrl('');
            try { window.dispatchEvent(new Event(API_KEY_CHECK_EVENT)); } catch (e) { /* ignore */ }
          }
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Validation error:', e);
      } finally {
        setIsValidating(false);
      }
    }, 100);
  }, [provider, apiKey, baseUrl, config, selectedModel, updateConfig, validateConfig, configValid, loadSavedKeys]);

  const handleSetActive = useCallback(async (id: number, isActive: boolean) => {
    if (!window.electronIO?.ipcRenderer) return;
    try {
      const result = await window.electronIO.ipcRenderer.invoke('ai-key-set-active', id, isActive);
      if (result?.success) {
        await loadSavedKeys();
        // Reload active config
        const activeKey = await window.electronIO.ipcRenderer.invoke('ai-key-get-active');
        if (activeKey) {
          updateConfig({
            provider: activeKey.provider,
            apiKey: activeKey.api_key,
            model: activeKey.model || '',
                temperature: activeKey.temperature || 0.7,
                baseUrl: activeKey.base_url || undefined,
          });
          try { window.dispatchEvent(new Event(API_KEY_CHECK_EVENT)); } catch (e) { /* ignore */ }
        } else {
          updateConfig(null);
          try { window.dispatchEvent(new Event(API_KEY_CHECK_EVENT)); } catch (e) { /* ignore */ }
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to set active key:', e);
    }
  }, [loadSavedKeys, updateConfig]);

  const handleDeleteKey = useCallback(async (id: number) => {
    if (!window.electronIO?.ipcRenderer) return;
    if (!confirm(t('core:confirmDeleteKey') || 'Are you sure you want to delete this API key?')) {
      return;
    }
    try {
      const result = await window.electronIO.ipcRenderer.invoke('ai-key-delete', id);
      if (result?.success) {
        await loadSavedKeys();
        // If deleted key was active, load new active key
        const activeKey = await window.electronIO.ipcRenderer.invoke('ai-key-get-active');
        if (activeKey) {
          updateConfig({
            provider: activeKey.provider,
            apiKey: activeKey.api_key,
            model: activeKey.model || '',
            temperature: activeKey.temperature || 0.7,
            baseUrl: activeKey.base_url || undefined,
          });
          try { window.dispatchEvent(new Event(API_KEY_CHECK_EVENT)); } catch (e) { /* ignore */ }
        } else {
          updateConfig(null);
          try { window.dispatchEvent(new Event(API_KEY_CHECK_EVENT)); } catch (e) { /* ignore */ }
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to delete key:', e);
    }
  }, [loadSavedKeys, updateConfig, t]);

  return (
    <Box 
      sx={{ 
        maxWidth: 600,
        mx: 'auto',
        mt: 2,
        p: 3,
        maxHeight: 'calc(100vh - 170px)',
        overflow: 'auto',
        '&::-webkit-scrollbar': {
          width: '8px',
          height: '8px',
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '4px',
        },
        '&::-webkit-scrollbar-track': {
          backgroundColor: 'rgba(0, 0, 0, 0.05)',
        }
      }}
    >
      {/* Provider selection dropdown */}
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel id="provider-select-label">{t('core:aiProvider') || 'AI Provider'}</InputLabel>
        <Select
          labelId="provider-select-label"
          value={provider}
          label={t('core:aiProvider') || 'AI Provider'}
          onChange={e => setProvider(e.target.value)}
        >
          <MenuItem value="" disabled>{t('core:selectProvider') || 'Select a provider'}</MenuItem>
          {PROVIDER_ORDER.map(p => (
            <MenuItem key={p} value={p}>{PROVIDER_LABELS[p]}</MenuItem>
          ))}
        </Select>
      </FormControl>
      {/* Provider selected above — the detailed key/model editor is shown below in the panel */}
      {/* Feature redirect modal */}
      <Modal
        open={redirectModal.isOpen}
        onClose={handleCloseRedirectModal}
        aria-labelledby="redirect-modal-title"
      >
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 420,
            bgcolor: 'background.paper',
            boxShadow: 24,
            p: 4,
            borderRadius: 3,
            outline: 'none',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <ErrorIcon color="warning" sx={{ mr: 1, fontSize: 32 }} />
            <Typography id="redirect-modal-title" variant="h6" component="h2" sx={{ fontWeight: 600 }}>
              {t('core:aiKeyRequired') || 'AI API Key Required'}
            </Typography>
          </Box>
          <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary' }}>
            {t('core:aiKeyRequiredMessage') || 
              `To use the ${redirectModal.feature?.toUpperCase()} parser feature, you need to configure an AI provider API key. 
              Please enter your API key for any supported provider (OpenAI, Google, Anthropic, etc.).`}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button onClick={handleCloseRedirectModal} variant="outlined">
              {t('core:cancel') || 'Cancel'}
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleOpenSettings}
              startIcon={<SettingsIcon />}
            >
              {t('core:configureAISettings') || 'Configure AI Settings'}
            </Button>
          </Box>
        </Box>
      </Modal>

      <Typography variant="h5" sx={{ mb: 1, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
        <KeyIcon color="primary" />
        {t('core:aiModelProviderSettings') || 'AI Model Provider Settings'}
      </Typography>
      
      <Typography 
        variant="body2" 
        sx={{ mb: 3, color: 'text.secondary' }}
      >
        {t('core:aiSettingsDescription') || 
          'Select a provider above, then enter its API key and optional base URL below. PDF and document parser features will only be enabled when a valid provider and key are configured.'}
      </Typography>

      {isValid && provider !== 'unknown' && (
        <Alert 
          severity="success" 
          icon={<CheckCircleIcon />}
          sx={{ mb: 3 }}
        >
          {t('core:aiKeyValid') || `${PROVIDER_LABELS[provider]} API key is configured. Format looks valid.`}
        </Alert>
      )}

      {error && touched && (
        <Alert 
          severity="error" 
          icon={<ErrorIcon />}
          sx={{ mb: 3 }}
        >
          {error}
        </Alert>
      )}

      {!isValid && !error && provider !== 'unknown' && apiKey.length > 0 && (
        <Alert 
          severity="info" 
          sx={{ mb: 3 }}
        >
          {t('core:aiKeyFormatValid') || `${PROVIDER_LABELS[provider]} API key format detected. The key will be validated when you use it.`}
        </Alert>
      )}

      <Paper 
        elevation={2} 
        sx={{ 
          p: 3, 
          mb: 3, 
          borderRadius: 3,
          border: provider !== 'unknown' ? `2px solid ${PROVIDER_COLORS[provider] || theme.palette.primary.main}` : undefined,
        }}
      >
        <Grid container spacing={3} alignItems="flex-start">
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Avatar
                src={PROVIDER_ICONS[provider]}
                sx={{ 
                  width: 56, 
                  height: 56, 
                  bgcolor: provider === 'unknown' ? 'grey.300' : PROVIDER_COLORS[provider],
                  border: `2px solid ${theme.palette.background.paper}`,
                }}
              >
                {provider === 'unknown' ? <KeyIcon fontSize="large" /> : null}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {PROVIDER_LABELS[provider] || 'Unknown Provider'}
                </Typography>
                {provider !== 'unknown' && (
                  <Chip 
                    label={t('core:selected') || 'Selected'} 
                    size="small" 
                    color="primary" 
                    sx={{ mt: 0.5 }}
                  />
                )}
              </Box>
              {getProviderHelpUrl(provider) && (
                <Tooltip title={t('core:getAPIKey') || 'Get API Key'}>
                  <IconButton
                    onClick={() => window.open(getProviderHelpUrl(provider), '_blank')}
                    color="primary"
                  >
                    <OpenInNewIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Grid>

          <Grid item xs={12}>
            <TextField
              label={t('core:aiProviderAPIKey') || 'AI Provider API Key'}
              variant="outlined"
              fullWidth
              value={apiKey}
              onChange={(e) => {
                const newKey = e.target.value;
                setApiKey(newKey);
                setTouched(true);
              }}
              error={touched && !isValid && apiKey.length > 0}
              helperText={
                touched && !isValid && apiKey.length > 0
                    ? (error || t('core:invalidAPIKey') || 'Invalid API key')
                  : provider !== 'unknown' 
                    ? t('core:providerSelected') || `${PROVIDER_LABELS[provider]} selected`
                    : t('core:enterAPIKey') || 'Enter your API key to get started'
              }
              type={showKey ? 'text' : 'password'}
              onBlur={() => setTouched(true)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon color={isValid ? 'success' : 'disabled'} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowKey(!showKey)}
                      edge="end"
                      size="small"
                      sx={{ mr: 1 }}
                    >
                      {showKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                    {(isLoading || isValidating) && (
                      <CircularProgress size={20} sx={{ mr: 1 }} />
                    )}
                  </InputAdornment>
                ),
              }}
              autoComplete="off"
              placeholder={t('core:apiKeyPlaceholder') || 'sk-... or your API key'}
            />
            {/* Base URL for providers that require an endpoint (Perplexity, Grok, DeepSeek, Ollama) */}
            {(provider === 'perplexity' || provider === 'grok' || provider === 'deepseek' || provider === 'ollama') && (
              <Box sx={{ mt: 2 }}>
                <TextField
                  label={t('core:apiBaseUrl') || 'API Base URL (optional)'}
                  variant="outlined"
                  fullWidth
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  helperText={t('core:apiBaseUrlHelp') || 'Provide a base URL for providers that require a custom endpoint (e.g. Ollama, Perplexity).'}
                />
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 1, mt: 2, justifyContent: 'flex-end' }}>
              <TsButton
                variant="outlined"
                onClick={handleValidate}
                disabled={!apiKey || apiKey.trim().length === 0 || isLoading || isValidating}
                startIcon={isValidating ? <CircularProgress size={16} /> : <VerifiedUserIcon />}
              >
                {isValidating 
                  ? (t('core:validating') || 'Validating...')
                  : (t('core:validateAPIKey') || 'Validate API Key')
                }
              </TsButton>
            </Box>
          </Grid>

          {provider !== 'unknown' && models.length > 0 && (
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <FormControl fullWidth>
                <InputLabel>{t('core:aiModel') || 'AI Model'}</InputLabel>
                <Select
                  value={selectedModel}
                  onChange={(e) => {
                    const model = e.target.value;
                    updateConfig({ ...config, model });
                  }}
                  label={t('core:aiModel') || 'AI Model'}
                >
                  {models.map((model) => (
                    <MenuItem key={model} value={model}>
                      {model}
                    </MenuItem>
                  ))}
                </Select>
                <Typography variant="caption" color="warning.main" sx={{ mt: 1, display: 'block' }}>
                  Model field is <b>required</b> for all providers. Please enter the exact model name manually (e.g. <code>models/gemini-2.5-pro</code> for Google Gemini, <code>deepseek-chat</code> for DeepSeek, etc).<br />
                  Auto-detection is not supported.
                </Typography>
              </FormControl>
            </Grid>
          )}
        </Grid>
      </Paper>

      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
          {t('core:supportedProviders') || 'Supported Providers'}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            gap: 1.5,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {PROVIDER_ORDER.map((p) => (
            <Tooltip key={p} title={PROVIDER_LABELS[p] || p}>
              <Chip
                icon={
                  <Avatar
                    src={PROVIDER_ICONS[p]}
                    sx={{
                      width: 20,
                      height: 20,
                      bgcolor: 'transparent',
                    }}
                  />
                }
                label={PROVIDER_LABELS[p] || p}
                variant={provider === p ? 'filled' : 'outlined'}
                color={provider === p ? 'primary' : 'default'}
                sx={{
                  border: provider === p ? `2px solid ${PROVIDER_COLORS[p]}` : undefined,
                  bgcolor: provider === p ? `${PROVIDER_COLORS[p]}15` : undefined,
                }}
              />
            </Tooltip>
          ))}
        </Box>
      </Box>

      {/* Saved API Keys Section */}
      {savedKeys.length > 0 && (
        <Paper elevation={2} sx={{ p: 3, mt: 3, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <KeyIcon color="primary" />
            {t('core:savedAPIKeys') || 'Saved API Keys'}
          </Typography>
          {loadingKeys ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <List>
              {savedKeys.map((key) => (
                <ListItem
                  key={key.id}
                  sx={{
                    border: key.is_active ? `2px solid ${theme.palette.primary.main}` : '2px solid transparent',
                    borderRadius: 2,
                    mb: 1,
                    bgcolor: key.is_active ? theme.palette.action.selected : 'transparent',
                  }}
                >
                  <Avatar
                    src={PROVIDER_ICONS[key.provider]}
                    sx={{
                      width: 40,
                      height: 40,
                      mr: 2,
                      bgcolor: PROVIDER_COLORS[key.provider] || theme.palette.primary.main,
                    }}
                  />
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {PROVIDER_LABELS[key.provider] || key.provider}
                        </Typography>
                        {key.is_active && (
                          <Chip
                            label={t('core:active') || 'Active'}
                            size="small"
                            color="primary"
                            icon={<PowerSettingsNewIcon />}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {t('core:model') || 'Model'}: {key.model || 'Default'}
                        </Typography>
                        {key.base_url && (
                          <Typography variant="body2" color="text.secondary">
                            {t('core:baseUrl') || 'Base URL'}: {key.base_url}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary">
                          {key.api_key.substring(0, 8)}...{key.api_key.substring(key.api_key.length - 4)}
                        </Typography>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Tooltip title={key.is_active ? (t('core:deactivate') || 'Deactivate') : (t('core:activate') || 'Activate')}>
                        <IconButton
                          edge="end"
                          onClick={() => handleSetActive(key.id, !key.is_active)}
                          color={key.is_active ? 'primary' : 'default'}
                        >
                          {key.is_active ? <PowerSettingsNewIcon /> : <PowerOffIcon />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('core:delete') || 'Delete'}>
                        <IconButton
                          edge="end"
                          onClick={() => handleDeleteKey(key.id)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </Paper>
      )}

      <Alert severity="info" sx={{ mt: 2 }}>
        <Typography variant="caption">
          {t('core:aiKeyPrivacy') || 
            'Your API keys are stored locally in the database and never shared. They are only used to communicate with the selected AI provider.'}
        </Typography>
      </Alert>
    </Box>
  );
}

export default SettingsAI;
