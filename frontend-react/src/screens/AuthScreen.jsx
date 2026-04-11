import React, { useState } from 'react';

function AuthScreen({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email && password) {
      // For now, we just pass the name part of the email
      onLogin(email.split('@')[0]);
    }
  };

  return (
    <div className="glass-card">
      <h1 className="glow-text">Tic-Tac-Toe</h1>
      <p>{isLogin ? 'Welcome back' : 'Create your account'}</p>
      
      <form onSubmit={handleSubmit}>
        <input 
          type="email" 
          placeholder="Email" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          required
        />
        <input 
          type="password" 
          placeholder="Password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          required
        />
        <button type="submit" className="btn-primary">
          {isLogin ? 'Login' : 'Sign Up'}
        </button>
      </form>

      <div style={{margin: '20px 0', opacity: 0.5, fontSize: '0.8rem'}}>OR</div>

      <button className="btn-google" onClick={() => onLogin("GooglePlayer")}>
        <img 
            src="https://fonts.gstatic.com/s/i/productlogos/googleg/v6/24px.svg" 
            width="18" 
            alt="Google" 
        />
        Continue with Google
      </button>

      <p style={{ marginTop: '20px', fontSize: '0.85rem', cursor: 'pointer', opacity: 0.8 }} 
         onClick={() => setIsLogin(!isLogin)}>
        {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Login"}
      </p>
    </div>
  );
}

export default AuthScreen;