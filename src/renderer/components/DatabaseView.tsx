import React, { useState, useEffect } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import HomeIcon from '@mui/icons-material/Home';
import QueryEditor from './QueryEditor';
import QueryResults from './QueryResults';
import DatabasePanel from './DatabasePanel';

interface DatabaseViewProps {
  onClose?: () => void;
}

export default function DatabaseView({ onClose }: DatabaseViewProps) {
  const [panelOpen, setPanelOpen] = useState(true);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [queryResult, setQueryResult] = useState<any>(null);

  useEffect(() => {
    loadActiveConnection();
  }, []);

  const loadActiveConnection = async () => {
    try {
      // @ts-ignore
      const connection = await window.electronIO?.database?.getActiveConnection();
      if (connection) {
        setActiveConnectionId(connection.id);
      }
    } catch (error) {
      console.error('Failed to load active connection:', error);
    }
  };

  const handleConnectionChange = (connectionId: string | null) => {
    setActiveConnectionId(connectionId);
    // @ts-ignore
    if (connectionId && window.electronIO?.database?.setActiveConnection) {
      // @ts-ignore
      window.electronIO.database.setActiveConnection(connectionId);
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', bgcolor: 'background.default', position: 'relative' }}>
      <DatabasePanel 
        open={panelOpen} 
        onClose={() => setPanelOpen(false)}
        onConnectionSelect={handleConnectionChange}
        activeConnectionId={activeConnectionId}
      />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', ml: panelOpen ? '300px' : 0, transition: 'margin-left 0.3s' }}>
        {/* Top toolbar */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderBottom: 1, borderColor: 'divider' }}>
          <Tooltip title={panelOpen ? 'Hide connections panel' : 'Show connections panel'}>
            <IconButton 
              size="small"
              onClick={() => setPanelOpen(!panelOpen)}
            >
              {panelOpen ? <CloseIcon /> : <MenuIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Back to home">
            <IconButton 
              size="small"
              onClick={onClose}
            >
              <HomeIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Content area */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <QueryEditor
              connectionId={activeConnectionId}
              onQueryResult={setQueryResult}
            />
          </Box>
          <Box sx={{ flex: 1, borderTop: 1, borderColor: 'divider', minHeight: 0, overflow: 'hidden' }}>
            <QueryResults result={queryResult} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
