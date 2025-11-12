import React, { useState, useEffect } from 'react';
import { Box, TextField, Button } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

interface QueryEditorProps {
  connectionId: string | null;
  onQueryResult: (result: any) => void;
}

export default function QueryEditor({ connectionId, onQueryResult }: QueryEditorProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const handleExecute = async () => {
    if (!connectionId || !query.trim()) return;

    setLoading(true);
    try {
      // @ts-ignore
      const result = await window.electronIO?.database?.executeQuery(connectionId, query);
      // Debug: log the raw IPC response so we can inspect what the renderer receives
      // (helps track why server shows rows but the UI displays 0 rows).
      // eslint-disable-next-line no-console
      console.log('IPC executeQuery response:', result);
      
      if (result.success) {
        // Log the normalized result shape before passing to results pane
        // eslint-disable-next-line no-console
        console.log('Normalized query result:', result.result);
        onQueryResult(result.result);
      } else {
        alert(`Query failed: ${result.error}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Button
          variant="contained"
          startIcon={<PlayArrowIcon />}
          onClick={handleExecute}
          disabled={!connectionId || loading}
        >
          Execute Query
        </Button>
      </Box>
      <Box sx={{ flex: 1, overflow: 'hidden', p: 1 }}>
        <TextField
          fullWidth
          multiline
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter your SQL query here...&#10;&#10;Example: SELECT * FROM users;"
          variant="outlined"
          sx={{
            height: '100%',
            '& .MuiInputBase-root': {
              fontFamily: 'monospace',
              fontSize: '14px',
              height: '100%',
              alignItems: 'flex-start',
            },
            '& .MuiInputBase-input': {
              height: '100% !important',
              overflow: 'auto !important',
              whiteSpace: 'pre',
            },
          }}
        />
      </Box>
    </Box>
  );
}