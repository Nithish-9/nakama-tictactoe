package core

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/heroiclabs/nakama-common/runtime"
)

// MatchState defines the internal state of a game session.
type MatchState struct {
	Board     []string          `json:"board"`
	Marks     map[string]string `json:"marks"`
	Turn      string            `json:"turn"`
	MoveCount int               `json:"move_count"`
	GameOver  bool              `json:"game_over"`
	Winner    string            `json:"winner"`
	Mode      string            `json:"mode"`
	// Reconnect grace period
	DisconnectedUser string `json:"disconnected_user"` // userID who left
	DisconnectTick   int64  `json:"disconnect_tick"`   // tick when they left
}

const ReconnectGraceTicks = 30

type TicTacToeMatch struct{}

func (m *TicTacToeMatch) MatchInit(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, params map[string]interface{}) (interface{}, int, string) {
	mode, _ := params["mode"].(string)
	if mode == "" {
		mode = "classic"
	}

	state := &MatchState{
		Board:     make([]string, 9),
		Marks:     make(map[string]string),
		MoveCount: 0,
		GameOver:  false,
		Mode:      mode,
	}

	label := fmt.Sprintf(`{"mode":"%s"}`, mode)
	return state, 10, label
}

func (m *TicTacToeMatch) MatchJoinAttempt(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presence runtime.Presence, metadata map[string]string) (interface{}, bool, string) {
	s := state.(*MatchState)
	if len(s.Marks) >= 2 {
		return s, false, "Match is full"
	}
	return s, true, ""
}

func (m *TicTacToeMatch) MatchJoin(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presences []runtime.Presence) interface{} {
	s := state.(*MatchState)
	for _, p := range presences {
		if len(s.Marks) < 2 {
			if len(s.Marks) == 0 {
				s.Marks[p.GetUserId()] = "X"
				s.Turn = p.GetUserId()
			} else {
				s.Marks[p.GetUserId()] = "O"
			}
		}
		// Player reconnected — clear grace period
		if p.GetUserId() == s.DisconnectedUser {
			logger.Info("Player reconnected: %s", p.GetUserId())
			s.DisconnectedUser = ""
			s.DisconnectTick = 0
		}
	}

	if len(s.Marks) == 2 && !s.GameOver {
		BroadcastState(dispatcher, s, 2)
	}
	return s
}

func (m *TicTacToeMatch) MatchLoop(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, messages []runtime.MatchData) interface{} {
	s := state.(*MatchState)

	// Check grace period expiry
	if s.DisconnectedUser != "" && !s.GameOver {
		if tick-s.DisconnectTick >= ReconnectGraceTicks {
			logger.Info("Grace period expired, ending match. Disconnected: %s", s.DisconnectedUser)
			s.GameOver = true
			// Remaining player wins
			for id := range s.Marks {
				if id != s.DisconnectedUser {
					s.Winner = id
					break
				}
			}
			BroadcastState(dispatcher, s, 3)
			return s
		}
	}

	for _, msg := range messages {
		if msg.GetOpCode() == 1 {
			var move struct {
				Index int `json:"index"`
			}
			if err := json.Unmarshal(msg.GetData(), &move); err != nil {
				continue
			}

			userID := msg.GetUserId()
			if s.GameOver || s.Turn != userID || move.Index < 0 || move.Index > 8 || s.Board[move.Index] != "" {
				continue
			}

			s.Board[move.Index] = s.Marks[userID]
			s.MoveCount++

			if winMark := CheckWinner(s.Board, 3, move.Index); winMark != "" {
				s.GameOver = true
				s.Winner = userID
				UpdateLeaderboard(ctx, logger, nk, userID, 10)
			} else if s.MoveCount == 9 {
				s.GameOver = true
				s.Winner = "draw"
			} else {
				for id := range s.Marks {
					if id != s.Turn {
						s.Turn = id
						break
					}
				}
			}

			BroadcastState(dispatcher, s, 2)
		}
	}
	return s
}

func (m *TicTacToeMatch) MatchLeave(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presences []runtime.Presence) interface{} {
	s := state.(*MatchState)
	if !s.GameOver && len(presences) > 0 {
		// Start grace period instead of ending immediately
		s.DisconnectedUser = presences[0].GetUserId()
		s.DisconnectTick = tick
		logger.Info("Player disconnected, starting grace period: %s", s.DisconnectedUser)
	}
	return s
}

func (m *TicTacToeMatch) MatchTerminate(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, graceSeconds int) interface{} {
	return state
}

func (m *TicTacToeMatch) MatchSignal(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, data string) (interface{}, string) {
	return state, ""
}

func CheckWinner(board []string, size int, lastMoveIndex int) string {
	player := board[lastMoveIndex]
	if player == "" {
		return ""
	}

	row := lastMoveIndex / size
	col := lastMoveIndex % size

	rowMatch := true
	for i := 0; i < size; i++ {
		if board[row*size+i] != player {
			rowMatch = false
			break
		}
	}
	if rowMatch {
		return player
	}

	colMatch := true
	for i := 0; i < size; i++ {
		if board[i*size+col] != player {
			colMatch = false
			break
		}
	}
	if colMatch {
		return player
	}

	if row == col {
		diagMatch := true
		for i := 0; i < size; i++ {
			if board[i*size+i] != player {
				diagMatch = false
				break
			}
		}
		if diagMatch {
			return player
		}
	}

	if row+col == size-1 {
		antiDiagMatch := true
		for i := 0; i < size; i++ {
			if board[i*size+(size-1-i)] != player {
				antiDiagMatch = false
				break
			}
		}
		if antiDiagMatch {
			return player
		}
	}

	return ""
}

func BroadcastState(dispatcher runtime.MatchDispatcher, state *MatchState, opCode int64) {
	type ClientState struct {
		Board       []string `json:"board"`
		CurrentTurn string   `json:"currentTurn"` // "X" or "O"
		GameOver    bool     `json:"game_over"`
		Winner      string   `json:"winner"` // "X", "O", or "draw"
	}

	turnSymbol := state.Marks[state.Turn] // userID → "X"/"O"

	winnerSymbol := state.Winner
	if winnerSymbol != "" && winnerSymbol != "draw" {
		winnerSymbol = state.Marks[state.Winner] // userID → "X"/"O"
	}

	clientState := ClientState{
		Board:       state.Board,
		CurrentTurn: turnSymbol,
		GameOver:    state.GameOver,
		Winner:      winnerSymbol,
	}

	data, _ := json.Marshal(clientState)
	dispatcher.BroadcastMessage(opCode, data, nil, nil, true)
}

func UpdateLeaderboard(ctx context.Context, logger runtime.Logger, nk runtime.NakamaModule, userID string, score int64) {
	metadata := map[string]interface{}{"game": "tic_tac_toe"}
	_, err := nk.LeaderboardRecordWrite(ctx, "tic_tac_toe_global", userID, "", score, 0, metadata, nil)
	if err != nil {
		logger.Error("Leaderboard write failed: %v", err)
	}
}

func AddUserToLeaderboard(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {

	userID := ctx.Value(runtime.RUNTIME_CTX_USER_ID).(string)
	username := ctx.Value(runtime.RUNTIME_CTX_USERNAME).(string)

	if username == "" {
		logger.Error("Username is empty for userID: %s", userID)
		return "", runtime.NewError("username is required", 3)
	}

	records, err := nk.StorageRead(ctx, []*runtime.StorageRead{
		{
			Collection: "user_meta",
			Key:        "leaderboard_initialized",
			UserID:     userID,
		},
	})
	if err != nil {
		logger.Error("Storage read failed: %v", err)
		return "", err
	}

	if len(records) > 0 {
		return "already_initialized", nil
	}

	_, err = nk.LeaderboardRecordWrite(
		ctx,
		"tic_tac_toe_global",
		userID,
		username,
		0,
		0,
		nil,
		nil,
	)
	if err != nil {
		logger.Error("Leaderboard write failed: %v", err)
		return "", err
	}

	valueMap := map[string]interface{}{
		"initialized": true,
	}

	jsonValue, err := json.Marshal(valueMap)
	if err != nil {
		return "", err
	}

	_, err = nk.StorageWrite(ctx, []*runtime.StorageWrite{
		{
			Collection:      "user_meta",
			Key:             "leaderboard_initialized",
			UserID:          userID,
			Value:           string(jsonValue),
			PermissionRead:  1,
			PermissionWrite: 0,
		},
	})
	if err != nil {
		logger.Error("Storage write failed: %v", err)
		return "", err
	}

	return "initialized", nil
}
