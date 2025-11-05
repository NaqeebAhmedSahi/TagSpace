import React from 'react';
import { useUserContext } from '-/hooks/useUserContext';
import Login from '-/components/Login';

function AuthGate({ children }: { children: React.ReactNode }) {
  const userContext = useUserContext();

  // If the context or the helper says the user is not logged in, show the demo login
  if (!userContext || typeof userContext.isLoggedIn !== 'function') {
    return <Login />;
  }

  if (!userContext.isLoggedIn()) {
    return <Login />;
  }

  return <div>{children}</div>;
}

export default AuthGate;
