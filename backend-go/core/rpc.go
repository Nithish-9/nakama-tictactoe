package core

import (
	"context"
	"database/sql"
	"encoding/json"

	"github.com/heroiclabs/nakama-common/runtime"
)

type CreateMatchRequest struct {
	Name string `json:"name"`
	Size int    `json:"size"`
}

func TicTacToeGame(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule) (runtime.Match, error) {
	return &TicTacToeMatch{}, nil
}

func CreateMatch(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	var req CreateMatchRequest
	if err := json.Unmarshal([]byte(payload), &req); err != nil {
		return "", runtime.NewError("invalid payload", 3)
	}

	if req.Size < 3 {
		req.Size = 3
	}

	params := map[string]interface{}{
		"name": req.Name,
		"size": req.Size,
	}

	matchID, err := nk.MatchCreate(ctx, "tic_tac_toe", params)
	if err != nil {
		logger.Error("MatchCreate error: %v", err)
		return "", runtime.NewError("could not create match", 13)
	}

	response, _ := json.Marshal(map[string]string{"match_id": matchID})
	return string(response), nil
}

func FindMatch(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	limit := 10
	isAuthoritative := true
	labelFilter := ""
	minSize := 0
	maxSize := 1

	matches, err := nk.MatchList(ctx, limit, isAuthoritative, labelFilter, &minSize, &maxSize, "")
	if err != nil {
		return "", err
	}

	if len(matches) > 0 {
		response, _ := json.Marshal(map[string]string{"match_id": matches[0].MatchId})
		return string(response), nil
	}

	return CreateMatch(ctx, logger, db, nk, `{"name": "Quick Match", "size": 3}`)
}

func ListLiveMatches(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	limit := 50
	matches, err := nk.MatchList(ctx, limit, true, "", nil, nil, "")
	if err != nil {
		return "", err
	}

	response, _ := json.Marshal(matches)
	return string(response), nil
}

func GetLeaderboard(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	id := "tic_tac_toe_global"
	ownerIds := []string{}
	limit := 10
	cursor := ""

	records, _, _, _, err := nk.LeaderboardRecordsList(ctx, id, ownerIds, limit, cursor, 0)
	if err != nil {
		return "", err
	}

	response, _ := json.Marshal(records)
	return string(response), nil
}

func ResetPassword(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload interface{}) (string, error) {
	// 1. Cast the interface to a map (this is what Nakama produces from JSON)
	payloadMap, ok := payload.(map[string]interface{})
	if !ok {
		logger.Error("Expected payload to be an object, but got: %v", payload)
		return "", runtime.NewError("invalid payload", 3)
	}

	// 2. Extract values from the map
	email, _ := payloadMap["email"].(string)
	password, _ := payloadMap["password"].(string)

	if email == "" || password == "" {
		return "", runtime.NewError("email and password required", 3)
	}

	// 3. Database lookup
	query := "SELECT id FROM users WHERE email = $1"
	var userID string
	err := db.QueryRowContext(ctx, query, email).Scan(&userID)
	if err != nil {
		return "", runtime.NewError("user email not found", 5)
	}

	// 4. Update credentials
	err = nk.LinkEmail(ctx, userID, email, password)
	if err != nil {
		logger.Error("LinkEmail error: %v", err)
		return "", runtime.NewError("could not update credentials", 13)
	}

	logger.Info("Password updated for user: %v", email)
	res, _ := json.Marshal(map[string]bool{"success": true})
	return string(res), nil
}
