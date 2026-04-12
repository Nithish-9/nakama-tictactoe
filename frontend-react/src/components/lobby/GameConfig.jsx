import React, { useState } from "react";
import "./GameConfig.css";

const MODES = [
  {
    id:    "classic",
    label: "Classic",
    icon:  "⬡",
    desc:  "No timer · Pure strategy",
    color: "var(--cyan)",
  },
  {
    id:    "timed",
    label: "Timed",
    icon:  "⏱",
    desc:  "30s per move · High pressure",
    color: "var(--gold)",
  },
];

export default function GameConfig({ onFindMatch, onCreateRoom, onJoinRoom, loading }) {
  const [mode,     setMode]     = useState("classic");
  const [joinId,   setJoinId]   = useState("");
  const [showJoin, setShowJoin] = useState(false);
  const [joinErr,  setJoinErr]  = useState("");

  function handleJoin() {
    const id = joinId.trim();
    if (!id) { setJoinErr("Enter a match ID"); return; }
    setJoinErr("");
    onJoinRoom(id);
  }

  return (
    <div className="game-config glass-2">
      <h2 className="config-title">
        <span className="text-cyan">SELECT</span> MODE
      </h2>

      {/* Mode cards */}
      <div className="mode-grid">
        {MODES.map(m => (
          <button
            key={m.id}
            className={`mode-card ${mode === m.id ? "active" : ""}`}
            style={{ "--accent": m.color }}
            onClick={() => setMode(m.id)}
          >
            <span className="mode-icon">{m.icon}</span>
            <span className="mode-label">{m.label}</span>
            <span className="mode-desc text-dim">{m.desc}</span>
            {mode === m.id && <div className="mode-check">✓</div>}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="config-actions">
        <button
          className="btn btn-primary config-btn"
          onClick={() => onFindMatch(mode)}
          disabled={loading}
        >
          {loading ? <span className="spinner" /> : "🔍 Find Match"}
        </button>

        <button
          className="btn btn-ghost config-btn"
          onClick={onCreateRoom}
          disabled={loading}
        >
          ✦ Create Private Room
        </button>

        <button
          className="btn btn-ghost config-btn join-toggle"
          onClick={() => { setShowJoin(v => !v); setJoinErr(""); setJoinId(""); }}
          disabled={loading}
        >
          {showJoin ? "↑ Cancel" : "⊕ Join by ID"}
        </button>
      </div>

      {showJoin && (
        <div className="join-row animate-fade-up">
          <input
            className="input"
            type="text"
            placeholder="Paste match ID here…"
            value={joinId}
            onChange={e => { setJoinId(e.target.value); setJoinErr(""); }}
            onKeyDown={e => e.key === "Enter" && handleJoin()}
          />
          <button className="btn btn-primary" onClick={handleJoin} disabled={loading}>
            Go
          </button>
          {joinErr && <p className="join-err">{joinErr}</p>}
        </div>
      )}
    </div>
  );
}
