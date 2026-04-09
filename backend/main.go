package main

import (
	"context"
	"database/sql"

	"github.com/Nithish-9/nakama-tictactoe/core"
	"github.com/heroiclabs/nakama-common/runtime"
)

func InitModule(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, initializer runtime.Initializer) error {
	logger.Info("Initializing Tic-Tac-Toe module")

	if err := initializer.RegisterRpc("find_match", core.FindMatch); err != nil {
		logger.Error("Failed to register find_match RPC: %v", err)
		return err
	}

	if err := initializer.RegisterMatch("tic_tac_toe", core.NewMatch); err != nil {
		logger.Error("Failed to register match handler: %v", err)
		return err
	}

	logger.Info("Tic-Tac-Toe module initialized successfully")
	return nil
}
