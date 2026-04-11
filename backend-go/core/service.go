package core

import (
	"context"
	"encoding/json"

	"github.com/heroiclabs/nakama-common/runtime"
)

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
	data, _ := json.Marshal(state)
	dispatcher.BroadcastMessage(opCode, data, nil, nil, true)
}

func UpdateLeaderboard(ctx context.Context, nk runtime.NakamaModule, userID string, score int64) {
	metadata := map[string]interface{}{"game": "tic_tac_toe"}
	_, err := nk.LeaderboardRecordWrite(ctx, "tic_tac_toe_global", userID, "", score, 0, metadata, nil)
	if err != nil {

	}
}
