import React, { useState, useEffect } from "react";
import AuthScreen  from "./screens/AuthScreen.jsx";
import LobbyScreen from "./screens/LobbyScreen.jsx";
import TicTacToe   from "./components/game/TicTacToe.jsx";
import { restoreSession, getSocket, disconnectSocket, writeLeaderboardScore } from "./api/nakama.js";
import "./index.css";

const SCREEN = {
  LOADING: "loading",
  AUTH:    "auth",
  LOBBY:   "lobby",
  GAME:    "game",
};

export default function App() {
  const [screen,       setScreen]       = useState(SCREEN.LOADING);
  const [session,      setSession]      = useState(null);
  const [username,     setUsername]     = useState("");
  const [match,        setMatch]        = useState(null);
  const [mySymbol,     setMySymbol]     = useState("X");
  const [opponentName, setOpponentName] = useState("Opponent");

  useEffect(() => {
    async function tryRestore() {
      const saved = await restoreSession();
      if (saved) {
        const storedName = localStorage.getItem("username") || "Player";
        setSession(saved);
        setUsername(storedName);
        setScreen(SCREEN.LOBBY);
      } else {
        setScreen(SCREEN.AUTH);
      }
    }
    tryRestore();
  }, []);

  function handleAuth(sess, uname) {
    localStorage.setItem("username", uname);
    setSession(sess);
    setUsername(uname);
    setScreen(SCREEN.LOBBY);
  }

  function handleMatchFound(joinedMatch, symbol, oppName) {
    setMatch(joinedMatch);
    setMySymbol(symbol);
    setOpponentName(oppName);
    setScreen(SCREEN.GAME);
  }

  async function handleGameEnd(result) {
    if (result && result.winner && result.winner !== "draw") {
      try {
        const delta = result.winner === mySymbol ? 1 : 0;
        if (delta > 0) await writeLeaderboardScore(session, delta);
      } catch { /* non-critical */ }
    }
    setMatch(null);
    setScreen(SCREEN.LOBBY);
  }

  async function handleLogout() {
    await disconnectSocket();
    localStorage.removeItem("username");
    setSession(null);
    setUsername("");
    setScreen(SCREEN.AUTH);
  }

  if (screen === SCREEN.LOADING) {
    return (
      <div style={{
        minHeight: "100vh",
        display:   "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 48, height: 48,
            border: "3px solid rgba(0,212,255,0.2)",
            borderTopColor: "var(--cyan)",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }} />
          <p style={{ fontFamily: "var(--font-display)", fontSize: "0.7rem", letterSpacing: "0.2em", color: "rgba(160,180,220,0.5)" }}>
            LOADING…
          </p>
        </div>
      </div>
    );
  }

  if (screen === SCREEN.AUTH) {
    return <AuthScreen onAuth={handleAuth} />;
  }

  if (screen === SCREEN.LOBBY) {
    return (
      <LobbyScreen
        session={session}
        username={username}
        onMatchFound={handleMatchFound}
        onLogout={handleLogout}
      />
    );
  }

  if (screen === SCREEN.GAME) {
    return (
      <TicTacToe
        session={session}
        socket={getSocket()}
        match={match}
        mySymbol={mySymbol}
        opponentName={opponentName}
        myName={username}
        onGameEnd={handleGameEnd}
      />
    );
  }

  return null;
}
