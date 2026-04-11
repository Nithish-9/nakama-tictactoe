package main

import (
	"context"
	"database/sql"

	"github.com/Nithish-9/nakama-tictactoe/core"
	"github.com/heroiclabs/nakama-common/runtime"
)

func InitModule(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, initializer runtime.Initializer) error {
	logger.Info("Initializing Tic-Tac-Toe module")

	if err := initializer.RegisterMatch("tic_tac_toe", core.TicTacToeGame); err != nil {
		logger.Error("Failed to register match handler: %v", err)
		return err
	}

	if err := initializer.RegisterRpc("create_match", core.CreateMatch); err != nil {
		logger.Error("Failed to register create_match RPC: %v", err)
		return err
	}

	if err := initializer.RegisterRpc("find_match", core.FindMatch); err != nil {
		logger.Error("Failed to register find_match RPC: %v", err)
		return err
	}

	if err := initializer.RegisterRpc("list_live_matches", core.ListLiveMatches); err != nil {
		logger.Error("Failed to register list_live_matches RPC: %v", err)
		return err
	}

	if err := initializer.RegisterRpc("get_leaderboard", core.GetLeaderboard); err != nil {
		logger.Error("Failed to register get_leaderboard RPC: %v", err)
		return err
	}

	logger.Info("Tic-Tac-Toe module initialized successfully")
	return nil
}
