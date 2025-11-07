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

import React, { useState } from 'react';
import { Box, Typography, TextField, InputAdornment, IconButton, Tooltip, Grid, Paper, Avatar } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import LockIcon from '@mui/icons-material/Lock';
import KeyIcon from '@mui/icons-material/VpnKey';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

const PROVIDER_ICONS = {
  openai: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/openai.svg',
  google: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/googlecloud.svg',
  anthropic: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/anthropic.svg',
  huggingface: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/huggingface.svg',
  mistral: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/mistral.svg',
  ollama: 'https://ollama.com/public/ollama-logo.svg',
  unknown: '',
};

const PROVIDER_LABELS = {
  openai: 'OpenAI',
  google: 'Google',
  anthropic: 'Anthropic',
  huggingface: 'Hugging Face',
  mistral: 'Mistral',
  ollama: 'Ollama',
  unknown: 'Unknown',
};

function detectProviderFromKey(key: string): keyof typeof PROVIDER_ICONS {
  if (!key) return 'unknown';
  if (/^sk-/.test(key)) return 'openai';
  if (/^hf_/.test(key)) return 'huggingface';
  if (/^g-(cp|ai|sk)-/.test(key) || /google/i.test(key)) return 'google';
  if (/^anthropic-/.test(key) || /claude/i.test(key)) return 'anthropic';
  if (/^mistral-/.test(key)) return 'mistral';
  if (/^ollama-/.test(key)) return 'ollama';
  return 'unknown';
}

function getProviderHelpUrl(provider: string): string {
  switch (provider) {
    case 'openai': return 'https://platform.openai.com/account/api-keys';
    case 'google': return 'https://cloud.google.com/vertex-ai/docs/generative-ai/api-keys';
    case 'anthropic': return 'https://console.anthropic.com/settings/keys';
    case 'huggingface': return 'https://huggingface.co/settings/tokens';
    case 'mistral': return 'https://docs.mistral.ai/platform/api/#section/Authentication';
    case 'ollama': return 'https://ollama.com/';
    default: return '';
  }
}

const PROVIDER_ORDER = ['openai', 'google', 'anthropic', 'huggingface', 'mistral', 'ollama'];

const SettingsAI: React.FC = () => {
  const theme = useTheme();
  const [apiKey, setApiKey] = useState('');
  const [touched, setTouched] = useState(false);
  const provider = detectProviderFromKey(apiKey);
  const isValid = !!apiKey && provider !== 'unknown';

  // For demo: store in localStorage (replace with secure storage in production)
  React.useEffect(() => {
    const saved = localStorage.getItem('ai_api_key');
    if (saved) setApiKey(saved);
  }, []);
  React.useEffect(() => {
    if (apiKey) localStorage.setItem('ai_api_key', apiKey);
  }, [apiKey]);

  return (
    <Box sx={{ maxWidth: 520, mx: 'auto', mt: 4, p: 3 }}>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
        AI Model Provider Settings
      </Typography>
      <Typography variant="body2" sx={{ mb: 3, color: theme.palette.text.secondary }}>
        Enter your API key for any supported provider. The parser features (PDF/DOC) will only be enabled when a valid key is set. Your key is auto-detected and never sent anywhere except to the selected provider.
      </Typography>
      <Paper elevation={2} sx={{ p: 3, mb: 2, borderRadius: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={2}>
            <Avatar
              src={PROVIDER_ICONS[provider]}
              sx={{ width: 48, height: 48, bgcolor: provider === 'unknown' ? theme.palette.grey[300] : undefined }}
            >
              {provider === 'unknown' ? <KeyIcon fontSize="large" /> : null}
            </Avatar>
          </Grid>
          <Grid item xs={10}>
            <TextField
              label="API Key"
              variant="outlined"
              fullWidth
              value={apiKey}
              onChange={e => { setApiKey(e.target.value); setTouched(true); }}
              onBlur={() => setTouched(true)}
              type="password"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    {isValid ? (
                      <Tooltip title={`Detected: ${PROVIDER_LABELS[provider]}`}> <CheckCircleIcon color="success" /> </Tooltip>
                    ) : apiKey && touched ? (
                      <Tooltip title="Unknown or invalid key"><ErrorIcon color="error" /></Tooltip>
                    ) : null}
                    {getProviderHelpUrl(provider) && (
                      <Tooltip title={`Get a key for ${PROVIDER_LABELS[provider]}`}> <IconButton size="small" onClick={() => window.open(getProviderHelpUrl(provider), '_blank')}> <OpenInNewIcon fontSize="small" /> </IconButton> </Tooltip>
                    )}
                  </InputAdornment>
                ),
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon color={isValid ? 'success' : 'disabled'} />
                  </InputAdornment>
                ),
              }}
              autoComplete="off"
            />
          </Grid>
        </Grid>
        <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
          {PROVIDER_ORDER.map(p => (
            <Tooltip key={p} title={PROVIDER_LABELS[p]}>
              <Avatar src={PROVIDER_ICONS[p]} sx={{ width: 32, height: 32, opacity: provider === p ? 1 : 0.4, border: provider === p ? `2px solid ${theme.palette.primary.main}` : undefined, bgcolor: theme.palette.background.paper, mx: 0.5 }} />
            </Tooltip>
          ))}
        </Box>
      </Paper>
      <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
        Supported: OpenAI, Google, Anthropic, Hugging Face, Mistral, Ollama, and more. Your key is stored locally and never shared.
      </Typography>
    </Box>
  );
};

export default SettingsAI;
