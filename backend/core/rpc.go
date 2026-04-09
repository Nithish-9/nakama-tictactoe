package core

import (
	"context"
	"database/sql"
	"encoding/json"

	"github.com/heroiclabs/nakama-common/runtime"
)

func FindMatch(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	matchID, err := nk.MatchCreate(ctx, "tic_tac_toe", map[string]interface{}{})
	if err != nil {
		return "", err
	}

	response, _ := json.Marshal(map[string]string{"match_id": matchID})
	return string(response), nil
}

func NewMatch(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule) (runtime.Match, error) {
	return &TicTacToeMatch{}, nil
}
