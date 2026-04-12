import React, { useState, useEffect, useRef } from "react";
import ProfileCard from "../components/lobby/ProfileCard.jsx";
import GameConfig from "../components/lobby/GameConfig.jsx";
import {
  connectSocket, getSocket, findMatch, cancelMatchmaking,
  createMatch, joinMatch, getAccount, getLeaderboard, clearSession,
} from "../api/nakama";
import "./LobbyScreen.css";

export default function LobbyScreen({ session, username, onMatchFound, onLogout }) {
  const [socket,      setSocket]      = useState(null);
  const [socketReady, setSocketReady] = useState(false);
  const [matchmaking, setMatchmaking] = useState(false);
  const [mmTicket,    setMmTicket]    = useState(null);
  const [statusMsg,   setStatusMsg]   = useState("");
  const [account,     setAccount]     = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [tab,         setTab]         = useState("play");
  const [roomId,      setRoomId]      = useState("");

  const mmTimeoutRef = useRef(null);
  const mmTicketRef  = useRef(null);

  // ── Bootstrap socket + data ───────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const sock = await connectSocket(session);
        if (!mounted) return;

        sock.onmatchmakermatched = async (matched) => {
          clearTimeout(mmTimeoutRef.current);
          setMatchmaking(false);
          setStatusMsg("Match found! Joining…");

          try {
            const sorted   = [...matched.users].sort((a, b) =>
              a.presence.user_id.localeCompare(b.presence.user_id)
            );
            const myIdx    = sorted.findIndex(p => p.presence.user_id === session.user_id);
            const mySymbol = myIdx === 0 ? "X" : "O";
            const opponent = matched.users.find(p => p.presence.user_id !== session.user_id);

            const joinedMatch = await sock.joinMatch(matched.match_id ?? null, matched.token);
            console.log("matched match : "+ JSON.stringify(matched))
            console.log("Joined Match : " + JSON.stringify(joinedMatch))
            onMatchFound(joinedMatch, mySymbol, opponent?.presence.username ?? "Opponent");
          } catch (err) {
            console.error("Join match failed", err);
            setStatusMsg("Failed to join match.");
            setMatchmaking(false);
          }
        };

        setSocket(sock);
        setSocketReady(true);

        const [acct, lb] = await Promise.allSettled([
          getAccount(session),
          getLeaderboard(session, 10),
        ]);
        if (mounted) {
          if (acct.status === "fulfilled") setAccount(acct.value);
          if (lb.status  === "fulfilled") {
            setLeaderboard(lb.value?.records ?? []);
          }
        }
      } catch (err) {
        console.error("Socket connect failed", err);
        if (mounted) setStatusMsg("Connection error — is Nakama running?");
      }
    }

    bootstrap();

    return () => {
      mounted = false;
      clearTimeout(mmTimeoutRef.current);
      if (mmTicketRef.current) {
        cancelMatchmaking(getSocket(), mmTicketRef.current).catch(() => {});
        mmTicketRef.current = null;
      }
    };
  }, [session]);

  // ── Matchmaking ───────────────────────────────────────────────────────────
  async function handleFindMatch(mode) {
    if (!socketReady) return;
    setMatchmaking(true);
    setStatusMsg("Looking for an opponent…");
    try {
      const ticket = await findMatch(getSocket(), mode);
      setMmTicket(ticket);
      mmTicketRef.current = ticket;

      mmTimeoutRef.current = setTimeout(() => {
        handleCancelMM();
        setStatusMsg("No opponent found. Try again.");
      }, 60_000);
    } catch (err) {
      console.error(err);
      setMatchmaking(false);
      setStatusMsg("Matchmaking error. Please retry.");
    }
  }

  async function handleCancelMM() {
    setMatchmaking(false);
    clearTimeout(mmTimeoutRef.current);
    const ticket = mmTicketRef.current;
    if (ticket) {
      try { await cancelMatchmaking(getSocket(), ticket); } catch { /* ok */ }
      setMmTicket(null);
      mmTicketRef.current = null;
    }
    setStatusMsg("");
  }

  // ── Private room ──────────────────────────────────────────────────────────
  // Requires GameConfig to call onCreateRoom(mode) — update GameConfig:
  // onClick={() => onCreateRoom(mode)}
  async function handleCreateRoom(mode = "classic") {
    if (!socketReady) return;
    setStatusMsg("Creating room…");
    try {
      const m = await createMatch(session, mode);

      const joinedMatch = await joinMatch(getSocket(), m.match_id);
      setRoomId(m.match_id);
      setStatusMsg(`Room created! Share ID: ${m.match_id.slice(0, 8)}…`);

      getSocket().onmatchpresence = (presence) => {
        const opp = presence.joins?.find(p => p.user_id !== session.user_id);
        if (opp) {
          getSocket().onmatchpresence = null;
          onMatchFound(joinedMatch, "X", opp.username ?? "Opponent");
        }
      };
    } catch (err) {
      console.error(err);
      setStatusMsg("Failed to create room.");
    }
  }

  async function handleJoinRoom(id) {
    if (!socketReady) return;
    setStatusMsg("Joining room…");
    try {
      const joinedMatch = await joinMatch(getSocket(), id);
      const presences   = joinedMatch.presences ?? [];
      const opp         = presences.find(p => p.user_id !== session.user_id);
      onMatchFound(joinedMatch, "O", opp?.username ?? "Opponent");
    } catch (err) {
      console.error(err);
      setStatusMsg("Could not join room. Check the ID.");
    }
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  function handleLogout() {
    clearSession();
    onLogout();
  }

  // ── Derived stats ─────────────────────────────────────────────────────────
  const wallet = account?.wallet ? JSON.parse(account.wallet) : {};
  const wins   = wallet.wins   ?? 0;
  const losses = wallet.losses ?? 0;
  const streak = wallet.streak ?? 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="lobby-screen">
      {/* Top bar */}
      <header className="lobby-header glass">
        <div className="lobby-logo">
          <span className="logo-x text-cyan">X</span>
          <span className="lobby-title">TACTICX</span>
        </div>
        <div className="header-actions">
          {socketReady
            ? <span className="conn-dot connected" title="Connected to Nakama" />
            : <span className="conn-dot" title="Connecting…" />
          }
          <button className="btn btn-ghost logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <div className="lobby-body">
        {/* Left panel */}
        <aside className="lobby-left animate-fade-up" style={{ animationDelay: "0.05s" }}>
          <ProfileCard
            username={username}
            wins={wins}
            losses={losses}
            streak={streak}
          />

          <div className="tab-bar glass">
            <button
              className={`tab-btn ${tab === "play" ? "active" : ""}`}
              onClick={() => setTab("play")}
            >
              ⬡ Play
            </button>
            <button
              className={`tab-btn ${tab === "board" ? "active" : ""}`}
              onClick={() => setTab("board")}
            >
              🏆 Leaderboard
            </button>
          </div>

          {tab === "play" && (
            <GameConfig
              onFindMatch={handleFindMatch}
              onCreateRoom={handleCreateRoom}
              onJoinRoom={handleJoinRoom}
              loading={matchmaking || !socketReady}
            />
          )}

          {tab === "board" && (
            <LeaderboardPanel records={leaderboard} myUserId={session?.user_id} />
          )}
        </aside>

        {/* Right panel */}
        <main className="lobby-main animate-fade-up" style={{ animationDelay: "0.15s" }}>
          {!matchmaking && (
            <div className="lobby-hero">
              <div className="hero-grid" aria-hidden="true">
                {["X","","","","O","","","","X","","O","","","","X","","","O"].map((s, i) => (
                  <div key={i} className={`hero-cell ${s === "X" ? "hx" : s === "O" ? "ho" : ""}`}>
                    {s}
                  </div>
                ))}
              </div>
              <h2 className="hero-headline">
                Ready to<br /><span className="text-cyan glow-cyan">Dominate?</span>
              </h2>
              <p className="hero-sub text-dim">
                Server-authoritative multiplayer · Built on Nakama
              </p>
              {statusMsg && (
                <div className={`status-msg ${statusMsg.includes("error") || statusMsg.includes("Failed") ? "error" : "info"}`}>
                  {statusMsg}
                  {roomId && (
                    <div className="room-id-display">
                      <code>{roomId.slice(0, 16)}…</code>
                      <button
                        className="btn btn-ghost copy-small"
                        onClick={() => navigator.clipboard.writeText(roomId)}
                      >
                        Copy
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {matchmaking && (
            <MatchmakingWaiting onCancel={handleCancelMM} statusMsg={statusMsg} />
          )}
        </main>
      </div>
    </div>
  );
}

/* ── Matchmaking waiting ───────────────────────────────────────────────────── */
function MatchmakingWaiting({ onCancel, statusMsg }) {
  const [dots, setDots] = useState(".");
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? "." : d + "."), 600);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="mm-waiting animate-fade-in">
      <div className="mm-spinner-ring">
        <div className="mm-ring-inner" />
        <span className="mm-vs-text">VS</span>
      </div>
      <h3 className="mm-title">
        {statusMsg || "Finding opponent"}<span className="dots">{dots}</span>
      </h3>
      <p className="text-dim mm-sub">This usually takes under 30 seconds</p>
      <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
    </div>
  );
}

/* ── Leaderboard panel ────────────────────────────────────────────────────── */
function LeaderboardPanel({ records, myUserId }) {
  if (!records || records.length === 0) {
    return (
      <div className="lb-empty glass-2">
        <span className="text-dim" style={{ fontSize: "0.85rem" }}>
          No records yet. Play some games!
        </span>
      </div>
    );
  }

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="lb-panel glass-2">
      <h3 className="lb-title">Global Leaderboard</h3>
      <div className="lb-list">
        {records.map((rec, i) => (
          <div
            key={rec.owner_id}
            className={`lb-row ${rec.owner_id === myUserId ? "lb-me" : ""}`}
          >
            <span className="lb-rank">{medals[i] || `#${i + 1}`}</span>
            <span className="lb-name">{rec.username || "Anonymous"}</span>
            <span className="lb-score text-cyan">{rec.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
