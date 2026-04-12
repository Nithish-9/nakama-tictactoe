import React from "react";
import "./ProfileCard.css";

export default function ProfileCard({ username, wins = 0, losses = 0, streak = 0 }) {
  const winRate = wins + losses > 0
    ? Math.round((wins / (wins + losses)) * 100)
    : 0;

  return (
    <div className="profile-card glass">
      <div className="profile-top">
        <div className="profile-avatar">
          <span className="avatar-letter">{username?.[0]?.toUpperCase() || "?"}</span>
          <div className="avatar-ring" />
        </div>
        <div className="profile-info">
          <h3 className="profile-name">{username}</h3>
          <span className="profile-badge text-dim">Player</span>
        </div>
      </div>

      <div className="profile-stats">
        <div className="stat">
          <span className="stat-value text-cyan">{wins}</span>
          <span className="stat-label text-dim">Wins</span>
        </div>
        <div className="stat-divider" />
        <div className="stat">
          <span className="stat-value" style={{ color: "var(--pink)" }}>{losses}</span>
          <span className="stat-label text-dim">Losses</span>
        </div>
        <div className="stat-divider" />
        <div className="stat">
          <span className="stat-value text-gold">{streak}</span>
          <span className="stat-label text-dim">Streak</span>
        </div>
        <div className="stat-divider" />
        <div className="stat">
          <span className="stat-value" style={{ color: "var(--violet)" }}>{winRate}%</span>
          <span className="stat-label text-dim">W/R</span>
        </div>
      </div>
    </div>
  );
}