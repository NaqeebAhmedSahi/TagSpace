import React, { useState } from 'react';
import {
  Button,
  TextField,
  Paper,
  Typography,
  Snackbar,
  Alert,
} from '@mui/material';
import { useUserContext } from '-/hooks/useUserContext';

const TEMP_USER = {
  username: 'admin',
  password: 'secret',
};

const createFakeCognitoUser = (username: string) => ({
  attributes: { email: username },
  associateSoftwareToken: () => {},
  verifySoftwareToken: () => {},
  challengeName: '',
  challengeParam: {},
});

function Login(): React.ReactElement {
  const { loggedIn } = useUserContext();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [openSnack, setOpenSnack] = useState(false);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (username === TEMP_USER.username && password === TEMP_USER.password) {
      // set global demo user for other consumers
      // @ts-ignore
      window.ExtDemoUser = { email: username };
      // call context login with a minimal CognitoUser-like object
      if (loggedIn) {
        // @ts-ignore
        loggedIn(createFakeCognitoUser(username));
      }
    } else {
      setError('Invalid credentials. Try admin / secret');
      setOpenSnack(true);
    }
  };

  const handleCloseSnack = () => setOpenSnack(false);

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg, #f5f5f5)',
      }}
    >
      <Paper style={{ padding: 24, width: 360 }} elevation={3}>
        <Typography variant="h5" component="h1" gutterBottom>
          TagSpaces — Demo Login
        </Typography>
        <form onSubmit={submit}>
          <TextField
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            fullWidth
            margin="normal"
            autoComplete="username"
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            margin="normal"
            autoComplete="current-password"
          />
          {error && (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          )}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: 16,
            }}
          >
            <Button type="submit" variant="contained" color="primary">
              Sign in
            </Button>
          </div>
        </form>
        <Typography variant="caption" display="block" style={{ marginTop: 12 }}>
          Temp credentials: <strong>admin</strong> / <strong>secret</strong>
        </Typography>
      </Paper>
      <Snackbar
        open={openSnack}
        autoHideDuration={4000}
        onClose={handleCloseSnack}
      >
        <Alert
          onClose={handleCloseSnack}
          severity="error"
          sx={{ width: '100%' }}
        >
          {error}
        </Alert>
      </Snackbar>
    </div>
  );
}

export default Login;
