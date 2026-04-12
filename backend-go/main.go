package main

import (
	"context"
	"database/sql"

	"github.com/Nithish-9/nakama-tictactoe/core"
	"github.com/heroiclabs/nakama-common/runtime"
)

func InitModule(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, initializer runtime.Initializer) error {
	logger.Info("Initializing TacticX Module...")

	id := "tic_tac_toe_global"
	authoritative := true
	sortOrder := "desc"
	operator := "best"
	resetSchedule := "0 0 * * *"
	metadata := make(map[string]interface{})
	joinBoard := false

	if err := nk.LeaderboardCreate(ctx, id, authoritative, sortOrder, operator, resetSchedule, metadata, joinBoard); err != nil {
		logger.Error("Leaderboard error: %v", err)
	}

	if err := initializer.RegisterMatch("tic_tac_toe", core.TicTacToeGame); err != nil {
		return err
	}

	if err := initializer.RegisterMatchmakerMatched(func(
		ctx context.Context,
		logger runtime.Logger,
		db *sql.DB,
		nk runtime.NakamaModule,
		entries []runtime.MatchmakerEntry,
	) (string, error) {
		params := map[string]interface{}{"mode": "classic"}

		if len(entries) > 0 {
			if props := entries[0].GetProperties(); props != nil {
				if mode, ok := props["mode"].(string); ok && mode != "" {
					params["mode"] = mode
				}
			}
		}

		matchID, err := nk.MatchCreate(ctx, "tic_tac_toe", params)
		if err != nil {
			logger.Error("MatchmakerMatched: failed to create match: %v", err)
			return "", err
		}

		logger.Info("MatchmakerMatched: created authoritative match %s", matchID)
		return matchID, nil
	}); err != nil {
		return err
	}

	if err := initializer.RegisterRpc("add_user_to_leaderboard", core.AddUserToLeaderboard); err != nil {
		return err
	}

	if err := initializer.RegisterRpc("create_match", core.CreateMatch); err != nil {
		return err
	}

	if err := initializer.RegisterRpc("find_match", core.FindMatch); err != nil {
		return err
	}

	if err := initializer.RegisterRpc("list_live_matches", core.ListLiveMatches); err != nil {
		return err
	}

	if err := initializer.RegisterRpc("get_leaderboard", core.GetLeaderboard); err != nil {
		return err
	}

	logger.Info("TacticX Module Loaded.")
	return nil
}
