import React, { useEffect, useRef, useState } from "react";
import { OpCode, leaveMatch } from "../../api/nakama";
import "./TicTacToe.css";

const WIN_LINES = [
  [0,1,2],[3,4,5],[6,7,8], // rows
  [0,3,6],[1,4,7],[2,5,8], // cols
  [0,4,8],[2,4,6],         // diags
];

function checkWinner(board) {
  for (const [a,b,c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: [a,b,c] };
    }
  }
  if (board.every(Boolean)) return { winner: "draw", line: [] };
  return null;
}

export default function TicTacToe({
  session,
  socket,
  match,
  mySymbol,       // "X" or "O"
  opponentName,
  myName,
  onGameEnd,
}) {
  const [board,       setBoard]       = useState(Array(9).fill(null));
  const [currentTurn, setCurrentTurn] = useState("X"); // X always goes first
  const [result,      setResult]      = useState(null); // {winner, line}
  const [timeLeft,    setTimeLeft]    = useState(null);
  const [waiting,     setWaiting]     = useState(false);
  const [statusMsg,   setStatusMsg]   = useState("");
  const timerRef  = useRef(null);
  const boardRef  = useRef(board);
  boardRef.current = board;

  const isMyTurn = currentTurn === mySymbol && !result;

  // ── Socket listeners ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    function onMatchData(data) {
      const opCode  = data.op_code;
      const payload = JSON.parse(new TextDecoder().decode(data.data));

      if (opCode === OpCode.GAME_STATE) {
        const { board: newBoard, currentTurn: turn, timerSeconds } = payload;
        setBoard(newBoard);
        setCurrentTurn(turn);
        if (timerSeconds !== undefined) startTimer(timerSeconds);
        const res = checkWinner(newBoard);
        if (res) setResult(res);
      }

      if (opCode === OpCode.GAME_OVER) {
        const { winner, board: finalBoard, reason } = payload;
        setBoard(finalBoard);
        setResult({ winner, line: getWinLine(finalBoard, winner), reason });
        clearTimer();
      }

      if (opCode === OpCode.TIMER_TICK) {
        setTimeLeft(payload.seconds);
      }
    }

    socket.onmatchdata = onMatchData;
    return () => { socket.onmatchdata = null; };
  }, [socket, mySymbol]);

  function getWinLine(b, w) {
    if (!w || w === "draw") return [];
    for (const [a, x, c] of WIN_LINES) {
      if (b[a] === w && b[x] === w && b[c] === w) return [a, x, c];
    }
    return [];
  }

  // ── Timer ────────────────────────────────────────────────────────────────────
  function startTimer(seconds) {
    clearTimer();
    setTimeLeft(seconds);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearTimer(); return 0; }
        return t - 1;
      });
    }, 1000);
  }

  function clearTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  useEffect(() => () => clearTimer(), []);

  // ── Move ─────────────────────────────────────────────────────────────────────
  async function handleCellClick(idx) {
    if (!isMyTurn || board[idx] || result) return;

    // Optimistic update
    const next = [...board];
    next[idx]  = mySymbol;
    setBoard(next);

    // Send to server
    try {
      await socket.sendMatchState(match.match_id, OpCode.MOVE, JSON.stringify({ index: idx }));
    } catch (err) {
      console.error("Move failed", err);
      setBoard(boardRef.current); // revert
    }
  }

  // ── Leave ─────────────────────────────────────────────────────────────────────
  async function handleLeave() {
    clearTimer();
    try { await leaveMatch(socket, match.match_id); } catch { /* ok */ }
    onGameEnd(result);
  }

  // ── UI helpers ────────────────────────────────────────────────────────────────
  const winLine = result?.line ?? [];

  function cellClass(idx) {
    const val = board[idx];
    let cls   = "cell";
    if (val === "X") cls += " cell-x";
    if (val === "O") cls += " cell-o";
    if (winLine.includes(idx)) cls += " cell-win";
    if (!val && isMyTurn) cls += " cell-hoverable";
    return cls;
  }

  const myTurnLabel    = isMyTurn    ? `Your turn (${mySymbol})` : `${opponentName}'s turn`;
  const timerColor     = timeLeft !== null && timeLeft <= 10 ? "var(--pink)" : "var(--cyan)";

  return (
    <div className="game-screen">
      {/* Header bar */}
      <div className="game-header glass">
        <div className="player-info my">
          <span className={`player-symbol ${mySymbol === "X" ? "x" : "o"}`}>{mySymbol}</span>
          <span className="player-name">{myName} <span className="text-dim">(You)</span></span>
        </div>

        <div className="game-center-info">
          {timeLeft !== null && (
            <div className="timer-ring" style={{ "--timer-color": timerColor }}>
              <span className="timer-value" style={{ color: timerColor }}>{timeLeft}</span>
            </div>
          )}
          {timeLeft === null && (
            <div className="vs-badge">VS</div>
          )}
        </div>

        <div className="player-info opp">
          <span className="player-name">{opponentName || "Waiting…"}</span>
          <span className={`player-symbol ${mySymbol === "X" ? "o" : "x"}`}>
            {mySymbol === "X" ? "O" : "X"}
          </span>
        </div>
      </div>

      {/* Turn indicator */}
      <div className={`turn-indicator ${isMyTurn ? "my-turn" : "opp-turn"}`}>
        <span className="turn-dot" />
        {myTurnLabel}
      </div>

      {/* Board */}
      <div className="board-wrapper">
        <div className={`board glass-2 ${result ? "board-finished" : ""}`}>
          {board.map((val, idx) => (
            <button
              key={idx}
              className={cellClass(idx)}
              onClick={() => handleCellClick(idx)}
              disabled={!!val || !isMyTurn || !!result}
              aria-label={`Cell ${idx + 1}${val ? `, ${val}` : ""}`}
            >
              {val && (
                <span className={`cell-mark ${val === "X" ? "mark-x" : "mark-o"}`}>
                  {val}
                </span>
              )}
              {!val && isMyTurn && (
                <span className="cell-hint">{mySymbol}</span>
              )}
            </button>
          ))}

          {/* Win overlay lines */}
          {winLine.length === 3 && <WinLine line={winLine} />}
        </div>
      </div>

      {/* Match ID share */}
      <div className="match-id-bar glass">
        <span className="text-dim" style={{ fontSize: "0.7rem" }}>Match ID:</span>
        <code className="match-id-code">{match?.match_id?.slice(0, 8)}…</code>
        <button
          className="btn btn-ghost copy-btn"
          onClick={() => navigator.clipboard.writeText(match?.match_id ?? "")}
        >
          Copy
        </button>
      </div>

      {/* Result overlay */}
      {result && (
        <ResultOverlay
          result={result}
          mySymbol={mySymbol}
          myName={myName}
          opponentName={opponentName}
          onLeave={handleLeave}
        />
      )}
    </div>
  );
}

/* ── Win-line SVG overlay ────────────────────────────────────────────────────── */
function WinLine({ line }) {
  const positions = {
    0: [1/6, 1/6], 1: [1/2, 1/6], 2: [5/6, 1/6],
    3: [1/6, 1/2], 4: [1/2, 1/2], 5: [5/6, 1/2],
    6: [1/6, 5/6], 7: [1/2, 5/6], 8: [5/6, 5/6],
  };
  const [x1, y1] = positions[line[0]];
  const [x2, y2] = positions[line[2]];
  return (
    <svg className="win-line-svg" viewBox="0 0 1 1" preserveAspectRatio="none">
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke="rgba(255,255,255,0.6)"
        strokeWidth="0.025"
        strokeLinecap="round"
        className="win-line-draw"
      />
    </svg>
  );
}

/* ── Result overlay ─────────────────────────────────────────────────────────── */
function ResultOverlay({ result, mySymbol, myName, opponentName, onLeave }) {
  const { winner, reason } = result;
  let headline, sub, emoji, cssClass;

  if (winner === "draw") {
    headline = "DRAW"; sub = "Nobody wins this round"; emoji = "🤝"; cssClass = "draw";
  } else if (winner === mySymbol) {
    headline = "VICTORY"; sub = reason === "forfeit" ? "Opponent timed out" : "You won the match!"; emoji = "🏆"; cssClass = "win";
  } else {
    headline = "DEFEAT"; sub = reason === "forfeit" ? "You ran out of time" : "Better luck next round"; emoji = "💀"; cssClass = "loss";
  }

  return (
    <div className={`result-overlay ${cssClass}`}>
      <div className="result-card glass-3 animate-fade-up">
        <div className="result-emoji">{emoji}</div>
        <h2 className={`result-headline ${cssClass}`}>{headline}</h2>
        <p className="result-sub text-dim">{sub}</p>

        <div className="result-scores">
          <div className="rs-player">
            <span className={`rs-symbol ${mySymbol === "X" ? "x" : "o"}`}>{mySymbol}</span>
            <span className="rs-name">{myName}</span>
          </div>
          <span className="rs-vs text-dim">vs</span>
          <div className="rs-player">
            <span className={`rs-symbol ${mySymbol === "X" ? "o" : "x"}`}>{mySymbol === "X" ? "O" : "X"}</span>
            <span className="rs-name">{opponentName}</span>
          </div>
        </div>

        <button className="btn btn-primary result-btn" onClick={onLeave}>
          Back to Lobby
        </button>
      </div>
    </div>
  );
}
