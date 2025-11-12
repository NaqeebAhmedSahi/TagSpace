import React, { useState, useEffect } from 'react';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  Divider,
} from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

interface DatabaseConnection {
  id: string;
  name: string;
  type: 'mysql' | 'postgresql' | 'sqlite';
  connected: boolean;
}

interface DatabasePanelProps {
  open: boolean;
  onClose: () => void;
  onConnectionSelect?: (connectionId: string | null) => void;
  activeConnectionId?: string | null;
}

export default function DatabasePanel({ open, onClose, onConnectionSelect, activeConnectionId }: DatabasePanelProps) {
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [newConnectionDialog, setNewConnectionDialog] = useState(false);
  const [connectionType, setConnectionType] = useState<'mysql' | 'postgresql' | 'sqlite'>('mysql');
  const [connectionName, setConnectionName] = useState('');
  const [connectionConfig, setConnectionConfig] = useState<any>({});

  useEffect(() => {
    loadConnections();
  }, []);

  useEffect(() => {
    // Refresh connections when dialog closes after successful creation
    if (!newConnectionDialog) {
      loadConnections();
    }
  }, [newConnectionDialog]);

  const loadConnections = async () => {
    try {
      // @ts-ignore
      const conns = await window.electronIO?.database?.getConnections();
      console.log('Loaded connections:', conns);
      setConnections(conns || []);
    } catch (error) {
      console.error('Failed to load connections:', error);
      setConnections([]);
    }
  };

  const handleCreateConnection = async () => {
    // Validate required fields
    if (!connectionName) {
      alert('Please enter a connection name');
      return;
    }

    if (connectionType !== 'sqlite') {
      if (!connectionConfig.host) {
        alert('Please enter a host');
        return;
      }
      if (!connectionConfig.user) {
        alert('Please enter a username');
        return;
      }
    } else {
      if (!connectionConfig.database) {
        alert('Please enter a database file path');
        return;
      }
    }

    try {
      let config = { ...connectionConfig };
      let database = undefined;

      // For SQLite, the database path goes in the database parameter
      if (connectionType === 'sqlite') {
        database = { database: connectionConfig.database || '' };
        config = { readOnlyMode: false };
      } else {
        // Set default ports if not provided
        if (!config.port) {
          config.port = connectionType === 'mysql' ? 3306 : 5432;
        }
      }

      // @ts-ignore
      const result = await window.electronIO?.database?.createConnection(
        connectionName,
        connectionType,
        config,
        database
      );
      
      if (result?.success) {
        setNewConnectionDialog(false);
        setConnectionName('');
        setConnectionConfig({});
        setConnectionType('mysql');
        // Reload connections list to show the newly created connection
        await loadConnections();
        // Auto-select the new connection
        if (result.connectionId && onConnectionSelect) {
          onConnectionSelect(result.connectionId);
        }
      } else {
        alert(`Failed to create connection: ${result?.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      alert(`Error: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleDeleteConnection = async (connectionId: string) => {
    if (!window.confirm('Are you sure you want to delete this connection?')) {
      return;
    }
    try {
      // @ts-ignore
      const result = await window.electronIO?.database?.disconnect(connectionId);
      if (result.success) {
        await loadConnections();
      } else {
        alert(`Failed to delete connection: ${result?.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to delete connection:', error);
      alert('Error deleting connection');
    }
  };

  const handleReconnect = async (connectionId: string) => {
    try {
      // Wait for main to signal that DB handlers are registered to avoid invoke race.
      try {
        // @ts-ignore
        const waitFn = window.electronIO?.database?.waitForHandlers;
        if (waitFn) {
          // @ts-ignore
          const ready = await waitFn();
          console.log('database handlers ready?', ready);
        }
      } catch (e) {
        console.warn('waitForHandlers failed', e);
      }

      // helper: try an invoke function up to N times if error says "No handler registered"
      const tryInvokeWithRetries = async (fn: () => Promise<any>, name: string) => {
        const maxAttempts = 3;
        for (let i = 0; i < maxAttempts; i++) {
          try {
            const res = await fn();
            return res;
          } catch (err: any) {
            const msg = String(err?.message || err);
            console.warn(`${name} invoke failed (attempt ${i + 1}):`, msg);
            // If it's not the specific "No handler registered" error, stop retrying
            if (!msg.includes('No handler registered')) throw err;
            // otherwise wait a bit and retry
            await new Promise((r) => setTimeout(r, 250 * (i + 1)));
          }
        }
        return null;
      };

      // Try to reconnect to an existing connection
      // @ts-ignore
      // Log available database bridge methods for debugging
      try {
        // eslint-disable-next-line no-console
        console.log('DB bridge methods:', Object.keys(window.electronIO?.database || {}));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Failed to enumerate DB bridge methods', e);
      }

      let result: any = null;

      // 1) Try debug invoke if available (with retries for the "no handler" race)
      if (window.electronIO?.database?.reconnectDebug) {
        // @ts-ignore
        result = await tryInvokeWithRetries(() => window.electronIO.database.reconnectDebug(connectionId), 'reconnectDebug');
        // eslint-disable-next-line no-console
        console.log('reconnectDebug result:', result);
      }

      // 2) If no result yet, try normal invoke reconnect
      if (!result && window.electronIO?.database?.reconnect) {
        // @ts-ignore
        result = await tryInvokeWithRetries(() => window.electronIO.database.reconnect(connectionId), 'reconnect');
        // eslint-disable-next-line no-console
        console.log('reconnect result:', result);
      }

      // 3) If still no result, try send-style fallback
      if (!result) {
        try {
          // eslint-disable-next-line no-console
          console.log('Attempting send-style fallback: reconnectSend');
          // @ts-ignore
          if (window.electronIO?.database?.reconnectSend) {
            // @ts-ignore
            result = await window.electronIO.database.reconnectSend(connectionId);
            // eslint-disable-next-line no-console
            console.log('reconnectSend result:', result);
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('reconnectSend failed:', err);
          result = { success: false, error: String(err) };
        }
      }
      if (result?.success) {
        await loadConnections();
        if (onConnectionSelect) {
          onConnectionSelect(connectionId);
        }
        alert('Connected successfully');
      } else {
        alert(`Failed to reconnect: ${result?.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      alert(`Error: ${error?.message || 'Unknown error'}`);
    }
  };

  return (
    <>
      <Drawer anchor="left" open={open} onClose={onClose}>
        <Box sx={{ width: 300, p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Database Connections
            </Typography>
            <Button 
              size="small" 
              onClick={onClose}
              title="Close panel"
            >
              ✕
            </Button>
          </Box>
          
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            fullWidth
            onClick={() => setNewConnectionDialog(true)}
            sx={{ mb: 2 }}
          >
            New Connection
          </Button>
          
          <Divider sx={{ my: 2 }} />
          
          <List sx={{ flex: 1, overflow: 'auto' }}>
            {connections.length === 0 ? (
              <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                <Typography variant="body2">No connections yet</Typography>
                <Typography variant="caption">Click "New Connection" to add one</Typography>
              </Box>
            ) : (
              connections.map((conn) => (
                <ListItem 
                  key={conn.id} 
                  disablePadding
                  sx={{
                    mb: 1,
                    backgroundColor: activeConnectionId === conn.id ? 'action.selected' : 'transparent',
                    borderRadius: 1,
                  }}
                >
                  <ListItemButton
                    selected={activeConnectionId === conn.id}
                    onClick={() => {
                      if (onConnectionSelect) {
                        onConnectionSelect(conn.id);
                      }
                    }}
                    sx={{ py: 1 }}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <StorageIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary={conn.name}
                      secondary={`${conn.type} - ${conn.connected ? '✓ Connected' : '⊘ Disconnected'}`}
                      primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItemButton>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {!conn.connected && (
                      <Button
                        size="small"
                        color="primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReconnect(conn.id);
                        }}
                        title="Reconnect"
                      >
                        ↻
                      </Button>
                    )}
                    <Button
                      size="small"
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConnection(conn.id);
                      }}
                      title="Delete connection"
                    >
                      <DeleteIcon fontSize="small" />
                    </Button>
                  </Box>
                </ListItem>
              ))
            )}
          </List>
        </Box>
      </Drawer>

      <Dialog open={newConnectionDialog} onClose={() => setNewConnectionDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Database Connection</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Database Type</InputLabel>
            <Select
              value={connectionType}
              onChange={(e) => setConnectionType(e.target.value as any)}
            >
              <MenuItem value="mysql">MySQL</MenuItem>
              <MenuItem value="postgresql">PostgreSQL</MenuItem>
              <MenuItem value="sqlite">SQLite</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Connection Name"
            value={connectionName}
            onChange={(e) => setConnectionName(e.target.value)}
            sx={{ mt: 2 }}
          />
          {connectionType !== 'sqlite' && (
            <>
              <TextField
                fullWidth
                required
                label="Host"
                placeholder="localhost or IP address"
                value={connectionConfig.host || ''}
                onChange={(e) => setConnectionConfig({ ...connectionConfig, host: e.target.value })}
                sx={{ mt: 2 }}
              />
              <TextField
                fullWidth
                label="Port"
                type="number"
                placeholder={connectionType === 'mysql' ? '3306' : '5432'}
                value={connectionConfig.port || ''}
                onChange={(e) => setConnectionConfig({ ...connectionConfig, port: parseInt(e.target.value) })}
                sx={{ mt: 2 }}
              />
              <TextField
                fullWidth
                required
                label="Username"
                placeholder="database user"
                value={connectionConfig.user || ''}
                onChange={(e) => setConnectionConfig({ ...connectionConfig, user: e.target.value })}
                sx={{ mt: 2 }}
              />
              <TextField
                fullWidth
                label="Password"
                type="password"
                placeholder="leave empty if no password required"
                value={connectionConfig.password || ''}
                onChange={(e) => setConnectionConfig({ ...connectionConfig, password: e.target.value })}
                sx={{ mt: 2 }}
              />
              <TextField
                fullWidth
                label="Database (Optional)"
                placeholder="default database to connect to"
                value={connectionConfig.defaultDatabase || ''}
                onChange={(e) => setConnectionConfig({ ...connectionConfig, defaultDatabase: e.target.value })}
                sx={{ mt: 2 }}
              />
            </>
          )}
          {connectionType === 'sqlite' && (
            <TextField
              fullWidth
              required
              label="Database File Path"
              placeholder="/path/to/database.db or C:\path\to\database.db"
              value={connectionConfig.database || ''}
              onChange={(e) => setConnectionConfig({ ...connectionConfig, database: e.target.value })}
              sx={{ mt: 2 }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewConnectionDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateConnection} variant="contained">
            Connect
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}