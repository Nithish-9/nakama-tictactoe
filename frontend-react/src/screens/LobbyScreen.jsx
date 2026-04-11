import React from 'react';

function LobbyScreen({ user, onLogout }) {
  return (
    <div className="glass-card">
      <h2 className="glow-text">Welcome, {user.username}</h2>
      <p>Ready for a match?</p>
      
      <button className="btn-primary">Create 3x3 Arena</button>
      <button style={{background: 'rgba(255,255,255,0.1)', color: 'white'}}>Join Random Match</button>
      
      <button 
        onClick={onLogout}
        style={{marginTop: '30px', background: 'transparent', color: '#ff4b2b', fontSize: '0.8rem'}}
      >
        Logout
      </button>
    </div>
  );
}

export default LobbyScreen;