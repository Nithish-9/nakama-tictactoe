package core

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/heroiclabs/nakama-common/runtime"
)

type MatchState struct {
	Board        []string          `json:"board"`
	Size         int               `json:"size"`
	Marks        map[string]string `json:"marks"`
	Turn         string            `json:"turn"`
	MoveCount    int               `json:"move_count"`
	GameOver     bool              `json:"game_over"`
	Winner       string            `json:"winner"`
	LastTurnTick int64             `json:"last_turn_tick"`
}

type TicTacToeMatch struct{}

func (m *TicTacToeMatch) MatchInit(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, params map[string]interface{}) (interface{}, int, string) {
	size := 3
	if s, ok := params["size"].(float64); ok {
		size = int(s)
	}

	matchName := "Unnamed Match"
	if n, ok := params["name"].(string); ok {
		matchName = n
	}

	state := &MatchState{
		Board:     make([]string, size*size),
		Size:      size,
		Marks:     make(map[string]string),
		MoveCount: 0,
		GameOver:  false,
	}

	label := fmt.Sprintf(`{"name":"%s", "size":%d, "open":true}`, matchName, size)
	return state, 10, label
}

func (m *TicTacToeMatch) MatchJoinAttempt(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presence runtime.Presence, metadata map[string]string) (interface{}, bool, string) {
	return state, true, ""
}

func (m *TicTacToeMatch) MatchJoin(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presences []runtime.Presence) interface{} {
	s := state.(*MatchState)
	for _, p := range presences {

		if len(s.Marks) == 0 {
			s.Marks[p.GetUserId()] = "X"
			s.Turn = p.GetUserId()
		} else if len(s.Marks) == 1 {
			s.Marks[p.GetUserId()] = "O"
		}
	}
	return s
}

func (m *TicTacToeMatch) MatchLoop(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, messages []runtime.MatchData) interface{} {
	s := state.(*MatchState)

	for _, msg := range messages {

		if msg.GetOpCode() == 1 {
			var move struct {
				Index int `json:"index"`
			}
			if err := json.Unmarshal(msg.GetData(), &move); err != nil {
				continue
			}

			userID := msg.GetUserId()
			mark, isPlayer := s.Marks[userID]

			if !isPlayer || s.Turn != userID || s.Board[move.Index] != "" || s.GameOver {
				continue
			}

			s.Board[move.Index] = mark
			s.MoveCount++

			if winMark := CheckWinner(s.Board, s.Size, move.Index); winMark != "" {
				s.GameOver = true
				s.Winner = userID
				// Update Leaderboard
				UpdateLeaderboard(ctx, nk, s.Winner, 10)
				for id := range s.Marks {
					if id != s.Winner {
						UpdateLeaderboard(ctx, nk, id, -10)
					}
				}
			} else if s.MoveCount == s.Size*s.Size {
				s.GameOver = true
				s.Winner = "draw"
			} else {
				// Switch turn
				for id := range s.Marks {
					if id != s.Turn {
						s.Turn = id
						break
					}
				}
			}
			// Broadcast the updated state to everyone (OpCode 2 = State Update)
			data, _ := json.Marshal(s)
			dispatcher.BroadcastMessage(2, data, nil, nil, true)
		}
	}
	return s
}

func (m *TicTacToeMatch) MatchLeave(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presences []runtime.Presence) interface{} {
	return state
}

func (m *TicTacToeMatch) MatchTerminate(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, graceSeconds int) interface{} {
	return state
}

func (m *TicTacToeMatch) MatchSignal(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, data string) (interface{}, string) {
	return state, ""
}
