import React, { useEffect, useRef, useState } from "react";
import { OpCode, leaveMatch } from "../../api/nakama";
import "./TicTacToe.css";

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function checkWinner(board) {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: [a, b, c] };
    }
  }
  if (board.every(Boolean)) return { winner: "draw", line: [] };
  return null;
}

export default function TicTacToe({
  session, socket, match, mySymbol, opponentName, myName, onGameEnd,
}) {
  const [board, setBoard]           = useState(Array(9).fill(null));
  const [currentTurn, setCurrentTurn] = useState("X");
  const [result, setResult]         = useState(null);
  const [timeLeft, setTimeLeft]     = useState(null);

  const resultRef    = useRef(null);
  const mySymbolRef  = useRef(mySymbol);

  useEffect(() => { resultRef.current   = result;   }, [result]);
  useEffect(() => { mySymbolRef.current = mySymbol; }, [mySymbol]);

  useEffect(() => {
    if (!socket) return;

    function onMatchData(data) {
      const opCode = data.op_code;
      let payload;

      try {
        const raw = data.data;
        if (typeof raw === "string") {
          payload = JSON.parse(raw);
        } else if (raw instanceof Uint8Array) {
          payload = JSON.parse(new TextDecoder().decode(raw));
        } else {
          const bytes = Uint8Array.from(Object.values(raw));
          payload = JSON.parse(new TextDecoder().decode(bytes));
        }
      } catch (err) {
        console.error("Failed to decode match data", err);
        return;
      }

      console.log("onMatchData opCode:", opCode, "payload:", payload);

      if (opCode === OpCode.GAME_STATE) {
        const { board: newBoard, currentTurn: turn } = payload;
        setBoard(newBoard);
        setCurrentTurn(turn);

        if (!resultRef.current) {
          const res = checkWinner(newBoard);
          if (res) setResult(res);
        }
      }

      if (opCode === OpCode.GAME_OVER) {
        const { winner, board: finalBoard, reason } = payload;
        setBoard(finalBoard ?? []);
        setResult({ winner, line: getWinLine(finalBoard, winner), reason });
      }

      if (opCode === OpCode.TIMER_TICK) {
        setTimeLeft(payload.seconds);
      }
    }

    socket.onmatchdata = onMatchData;
    return () => { socket.onmatchdata = () => {}; };
  }, [socket]);

  function getWinLine(b, w) {
    if (!w || w === "draw" || !b) return [];
    for (const [a, x, c] of WIN_LINES) {
      if (b[a] === w && b[x] === w && b[c] === w) return [a, x, c];
    }
    return [];
  }

  const isMyTurn = currentTurn === mySymbol && !result;

  async function handleCellClick(idx) {
    if (!isMyTurn || board[idx] || result) return;

    try {
      await socket.sendMatchState(
        match.match_id,
        OpCode.MOVE,
        JSON.stringify({ index: idx })
      );
    } catch (err) {
      console.error("Move failed", err);
    }
  }

  async function handleLeave() {
    try { await leaveMatch(socket, match.match_id); } catch {}
    onGameEnd(result);
  }

  const winLine      = result?.line ?? [];
  const timerColor   = timeLeft !== null && timeLeft <= 10 ? "var(--pink)" : "var(--cyan)";
  const myTurnLabel  = isMyTurn ? `Your turn (${mySymbol})` : `${opponentName}'s turn`;

  function cellClass(idx) {
    let cls = "cell";
    const val = board[idx];
    if (val === "X") cls += " cell-x";
    if (val === "O") cls += " cell-o";
    if (winLine.includes(idx)) cls += " cell-win";
    if (!val && isMyTurn) cls += " cell-hoverable";
    return cls;
  }

  return (
    <div className="game-screen">
      <div className="game-header glass">
        <div className="player-info my">
          <span className={`player-symbol ${mySymbol === "X" ? "x" : "o"}`}>{mySymbol}</span>
          <span className="player-name">{myName} <span className="text-dim">(You)</span></span>
        </div>
        <div className="game-center-info">
          {timeLeft !== null ? (
            <div className="timer-ring" style={{ "--timer-color": timerColor }}>
              <span className="timer-value" style={{ color: timerColor }}>{timeLeft}</span>
            </div>
          ) : (
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

      <div className={`turn-indicator ${isMyTurn ? "my-turn" : "opp-turn"}`}>
        <span className="turn-dot" />
        {myTurnLabel}
      </div>

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
                <span className={`cell-mark ${val === "X" ? "mark-x" : "mark-o"}`}>{val}</span>
              )}
              {!val && isMyTurn && (
                <span className="cell-hint">{mySymbol}</span>
              )}
            </button>
          ))}
          {winLine.length === 3 && <WinLine line={winLine} />}
        </div>
      </div>

      <div className="match-id-bar glass">
        <span className="text-dim" style={{ fontSize: "0.7rem" }}>Match ID:</span>
        <code className="match-id-code">{match?.match_id?.slice(0, 8)}…</code>
        <button className="btn btn-ghost copy-btn"
          onClick={() => navigator.clipboard.writeText(match?.match_id ?? "")}>
          Copy
        </button>
        <button className="btn btn-ghost" onClick={handleLeave}>← Leave</button>
      </div>

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



function WinLine({ line }) {
  const positions = {
    0: [1 / 6, 1 / 6], 1: [1 / 2, 1 / 6], 2: [5 / 6, 1 / 6],
    3: [1 / 6, 1 / 2], 4: [1 / 2, 1 / 2], 5: [5 / 6, 1 / 2],
    6: [1 / 6, 5 / 6], 7: [1 / 2, 5 / 6], 8: [5 / 6, 5 / 6],
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
            <span className={`rs-symbol ${mySymbol === "X" ? "o" : "x"}`}>
              {mySymbol === "X" ? "O" : "X"}
            </span>
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
