package core

import (
	"context"
	"database/sql"
	"encoding/json"

	"github.com/heroiclabs/nakama-common/runtime"
)

type MatchRequest struct {
	Mode string `json:"mode"`
}

func TicTacToeGame(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule) (runtime.Match, error) {
	return &TicTacToeMatch{}, nil
}

func CreateMatch(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	var req MatchRequest
	_ = json.Unmarshal([]byte(payload), &req)
	if req.Mode == "" {
		req.Mode = "classic"
	}

	params := map[string]interface{}{"mode": req.Mode}
	matchID, err := nk.MatchCreate(ctx, "tic_tac_toe", params)
	if err != nil {
		return "", runtime.NewError("failed to create", 13)
	}

	res, _ := json.Marshal(map[string]string{"match_id": matchID})
	return string(res), nil
}

func FindMatch(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	var req MatchRequest
	_ = json.Unmarshal([]byte(payload), &req)
	if req.Mode == "" {
		req.Mode = "classic"
	}

	limit, authoritative, label := 10, true, "+label.mode:"+req.Mode
	min, max := 1, 1

	matches, err := nk.MatchList(ctx, limit, authoritative, label, &min, &max, "")
	if err != nil {
		return "", err
	}

	if len(matches) > 0 {
		res, _ := json.Marshal(map[string]string{"match_id": matches[0].MatchId})
		return string(res), nil
	}

	return CreateMatch(ctx, logger, db, nk, payload)
}

func GetLeaderboard(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	records, _, _, _, err := nk.LeaderboardRecordsList(ctx, "tic_tac_toe_global", []string{}, 10, "", 0)
	if err != nil {
		return "", err
	}

	res, _ := json.Marshal(map[string]interface{}{"records": records})
	return string(res), nil
}

func ListLiveMatches(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	matches, err := nk.MatchList(ctx, 50, true, "", nil, nil, "")
	if err != nil {
		return "", err
	}
	res, _ := json.Marshal(matches)
	return string(res), nil
}
