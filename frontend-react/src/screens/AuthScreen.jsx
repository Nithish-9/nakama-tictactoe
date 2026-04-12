import React, { useState } from "react";
import { authenticateDevice } from "../api/nakama";
import "./AuthScreen.css";

function generateDeviceId() {
  const stored = localStorage.getItem("device_id");
  if (stored) return stored;
  const id = "device-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  localStorage.setItem("device_id", id);
  return id;
}

export default function AuthScreen({ onAuth }) {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed || trimmed.length < 5) {
      setError("Name must be at least 5 characters");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const deviceId = generateDeviceId();
      const session  = await authenticateDevice(deviceId, trimmed);

      onAuth(session, trimmed);
    } catch (err) {
      console.error(err);
      setError("Failed to connect to server. Check Nakama is running.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="stars" aria-hidden="true">
        {[...Array(60)].map((_, i) => (
          <span key={i} className="star" style={{
            left:             `${Math.random() * 100}%`,
            top:              `${Math.random() * 100}%`,
            animationDelay:   `${Math.random() * 4}s`,
            animationDuration: `${2 + Math.random() * 4}s`,
            width:            `${1 + Math.random() * 2}px`,
            height:           `${1 + Math.random() * 2}px`,
          }} />
        ))}
      </div>

      <div className="auth-card glass-3 animate-fade-up">
        <div className="auth-logo">
          <div className="logo-grid">
            {["X","","O","","X","","O","","X"].map((s, i) => (
              <span key={i} className={`logo-cell ${s === "X" ? "x" : s === "O" ? "o" : ""}`}>
                {s}
              </span>
            ))}
          </div>
        </div>

        <div className="auth-header">
          <h1 className="auth-title">TACTIC<span className="text-cyan">X</span></h1>
          <p className="auth-sub text-dim">Multiplayer Tic-Tac-Toe · Powered by Nakama</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="field">
            <label className="label" htmlFor="username">Your Callsign</label>
            <input
              id="username"
              className="input"
              type="text"
              placeholder="Enter a nickname…"
              value={username}
              onChange={e => { setUsername(e.target.value); setError(""); }}
              maxLength={20}
              autoFocus
              autoComplete="off"
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={loading || !username.trim()}
          >
            {loading ? (
              <span className="spinner" />
            ) : (
              "ENTER THE ARENA"
            )}
          </button>
        </form>

        <p className="auth-note text-dim">
          Your device ID is used for persistent sessions — no account needed.
        </p>
      </div>
    </div>
  );
}
