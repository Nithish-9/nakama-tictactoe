import React, { useState, useEffect } from "react";
import AuthScreen  from "./screens/AuthScreen.jsx";
import LobbyScreen from "./screens/LobbyScreen.jsx";
import TicTacToe   from "./components/game/TicTacToe.jsx";
import {
  restoreSession, 
  getSocket, 
  connectSocket, 
  disconnectSocket, 
  writeLeaderboardScore 
} from "./api/nakama.js";
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

        try {
          await connectSocket(saved);

          // 2. Check if there was an ongoing match
          const lastMatchId = localStorage.getItem("active_match_id");
          const lastSymbol = localStorage.getItem("my_symbol") || "X";
          const lastOpponent = localStorage.getItem("opponent_name") || "Opponent";
          
          if (lastMatchId) {
            setMatch({ match_id: lastMatchId });
            setMySymbol(lastSymbol);
            setOpponentName(lastOpponent);
            setScreen(SCREEN.GAME);
          } else {
            setScreen(SCREEN.LOBBY);
          }
        } catch (err) {
          console.error("Socket restoration failed", err);
          setScreen(SCREEN.LOBBY);
        }
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
    connectSocket(sess).then(() => {
      setScreen(SCREEN.LOBBY);
    });
  }

  function handleMatchFound(joinedMatch, symbol, oppName) {

    localStorage.setItem("active_match_id", joinedMatch.match_id);
    localStorage.setItem("my_symbol", symbol);
    localStorage.setItem("opponent_name", oppName);

    setMatch(joinedMatch);
    setMySymbol(symbol);
    setOpponentName(oppName);
    setScreen(SCREEN.GAME);
  }

  async function handleGameEnd(result) {

    localStorage.removeItem("active_match_id");
    localStorage.removeItem("my_symbol");
    localStorage.removeItem("opponent_name");

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
    localStorage.removeItem("active_match_id");
    setSession(null);
    setUsername("");
    setScreen(SCREEN.AUTH);
  }

  if (screen === SCREEN.LOADING) {
    return (
      <div className="loading-container" style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div className="loader-spinner" style={{
            width: 48, height: 48,
            border: "3px solid rgba(0,212,255,0.2)",
            borderTopColor: "cyan",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }} />
          <p style={{ letterSpacing: "0.2em", color: "rgba(160,180,220,0.5)", fontSize: "0.8rem" }}>
            RECONNECTING…
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