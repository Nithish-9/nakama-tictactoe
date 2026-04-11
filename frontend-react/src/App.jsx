import React, { useState } from 'react';
import AuthScreen from './screens/AuthScreen';
import LobbyScreen from './screens/LobbyScreen';
import './styles/main.css';

function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('game_user');
    return saved ? { username: saved } : null;
  });

  const handleLogin = (username) => {
    localStorage.setItem('game_user', username);
    setUser({ username });
  };

  const handleLogout = () => {
    localStorage.removeItem('game_user');
    setUser(null);
  };

  return (
    <div className="app-container">
      <div className="background-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2 :"></div>
      </div>

      {user ? (
        <LobbyScreen user={user} onLogout={handleLogout} />
      ) : (
        <AuthScreen onLogin={handleLogin} />
      )}
    </div>
  );
}

export default App;