package core

import (
	"context"
	"database/sql"
	"encoding/json"

	"github.com/heroiclabs/nakama-common/runtime"
)

type MatchState struct {
	Board    [9]string `json:"board"`
	Turn     string    `json:"turn"`
	Players  [2]string `json:"players"`
	GameOver bool      `json:"game_over"`
	Winner   string    `json:"winner"`
}

type MoveMessage struct {
	Position int `json:"position"`
}

type TicTacToeMatch struct{}

func (m *TicTacToeMatch) MatchInit(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, params map[string]interface{}) (interface{}, int, string) {
	state := &MatchState{
		Board:    [9]string{},
		GameOver: false,
	}
	tickRate := 10 // 10 ticks per second
	label := "tic_tac_toe"
	return state, tickRate, label
}

func (m *TicTacToeMatch) MatchJoinAttempt(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presence runtime.Presence, metadata map[string]string) (interface{}, bool, string) {
	matchState := state.(*MatchState)

	filledSlots := 0
	for _, p := range matchState.Players {
		if p != "" {
			filledSlots++
		}
	}

	if filledSlots >= 2 {
		return matchState, false, "match is full"
	}

	return matchState, true, ""
}

func (m *TicTacToeMatch) MatchJoin(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presences []runtime.Presence) interface{} {
	matchState := state.(*MatchState)

	for _, p := range presences {
		if matchState.Players[0] == "" {
			matchState.Players[0] = p.GetUserId()
		} else if matchState.Players[1] == "" {
			matchState.Players[1] = p.GetUserId()
		}
	}

	if matchState.Players[0] != "" && matchState.Players[1] != "" {
		matchState.Turn = matchState.Players[0]
		broadcastState(matchState, dispatcher, logger)
	}

	return matchState
}

func (m *TicTacToeMatch) MatchLeave(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presences []runtime.Presence) interface{} {
	matchState := state.(*MatchState)
	matchState.GameOver = true
	matchState.Winner = "opponent_left"
	broadcastState(matchState, dispatcher, logger)
	return matchState
}

func (m *TicTacToeMatch) MatchLoop(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, messages []runtime.MatchData) interface{} {
	matchState := state.(*MatchState)

	if matchState.GameOver {
		return nil
	}

	for _, msg := range messages {

		if msg.GetUserId() != matchState.Turn {
			logger.Warn("Player %s tried to move out of turn", msg.GetUserId())
			continue
		}

		var move MoveMessage
		if err := json.Unmarshal(msg.GetData(), &move); err != nil {
			logger.Error("Failed to parse move: %v", err)
			continue
		}

		if move.Position < 0 || move.Position > 8 {
			logger.Warn("Invalid position %d", move.Position)
			continue
		}

		if matchState.Board[move.Position] != "" {
			logger.Warn("Cell %d already occupied", move.Position)
			continue
		}

		symbol := "X"
		if msg.GetUserId() == matchState.Players[1] {
			symbol = "O"
		}
		matchState.Board[move.Position] = symbol

		if winner := checkWinner(matchState.Board); winner != "" {
			matchState.GameOver = true
			if winner == "X" {
				matchState.Winner = matchState.Players[0]
			} else if winner == "O" {
				matchState.Winner = matchState.Players[1]
			} else {
				matchState.Winner = "draw"
			}
		} else {
			if matchState.Turn == matchState.Players[0] {
				matchState.Turn = matchState.Players[1]
			} else {
				matchState.Turn = matchState.Players[0]
			}
		}

		broadcastState(matchState, dispatcher, logger)
	}

	return matchState
}

func (m *TicTacToeMatch) MatchTerminate(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, graceSeconds int) interface{} {
	return state
}

func (m *TicTacToeMatch) MatchSignal(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, data string) (interface{}, string) {
	return state, ""
}

func checkWinner(board [9]string) string {
	winPatterns := [][3]int{
		{0, 1, 2}, {3, 4, 5}, {6, 7, 8},
		{0, 3, 6}, {1, 4, 7}, {2, 5, 8},
		{0, 4, 8}, {2, 4, 6},
	}

	for _, pattern := range winPatterns {
		a, b, c := pattern[0], pattern[1], pattern[2]
		if board[a] != "" && board[a] == board[b] && board[a] == board[c] {
			return board[a]
		}
	}

	for _, cell := range board {
		if cell == "" {
			return ""
		}
	}

	return "draw"
}

func broadcastState(state *MatchState, dispatcher runtime.MatchDispatcher, logger runtime.Logger) {
	data, err := json.Marshal(state)
	if err != nil {
		logger.Error("Failed to marshal state: %v", err)
		return
	}
	dispatcher.BroadcastMessage(1, data, nil, nil, true)
}
