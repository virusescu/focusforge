# Game Economy

Coins are a **score**, not a currency. Nothing can be bought with them. They
accumulate through a season and determine the prestige rank. The economy has
four parts: **coins**, the **daily challenge**, **streaks** and **seasons**.

- **Pure logic** lives in `src/utils/gameEconomy.ts` (no side effects; tested in `gameEconomy.test.ts`).
- **Orchestration** lives in `src/contexts/GameContext.tsx`: it listens for `timer-saved` and `objective-neutralized`, calls the pure functions, and writes the results to the DB.
- **UI**: the header (coin counter, `+N ⟐` flash, streak bars, season timer, rank), the left sidebar readout and `VaultPage`.

Related docs: [architecture.md](architecture.md) · [database.md](database.md)

---

## Session reward

Computed by `calculateSessionReward` when a session of at least 60 s ends.

```
minutes      = floor(durationSeconds / 60)
milestone    = 2.0 if minutes ≥ 60   (SUPER_FORGE)
               1.5 if minutes ≥ 30   (DEEP_FOCUS)
               1.2 if minutes ≥ 15   (FOCUS_LOCKED)
               1.0 otherwise
pausePenalty = min(pauseCount × 0.05, 0.5)
adjusted     = max(milestone − pausePenalty, 0.5)
streak       = getStreakMultiplier(current_streak_days)
daily        = 2.0 if (qualifying sessions today, including this one) ≥ 3 else 1.0

coins = round(minutes × adjusted × streak × daily)
```

- A **qualifying session** is one of 30+ minutes. Only qualifying sessions count toward the daily challenge.
- **Pause penalty:** a pause only counts if the session is resumed, or ended while paused. Being paused for 60 s ends the session.
- **Example:** 50 min, no pauses, streak day 3, daily bonus active → `50 × 1.5 × 2.0 × 2.0 = 300 ⟐`.

## Objective bounty

`calculateObjectiveBounty` runs when an objective is neutralized.

```
base  = category.coin_bounty   (Hard 50 · Normal 25 · Easy 10 by default;
                                15 if the objective has no category;
                                new categories default to 25)
coins = round(base × getStreakMultiplier(current_streak_days))
```

Daily and milestone multipliers do not apply to bounties.

## Streak multiplier

| `current_streak_days` | 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|
| Multiplier | 1.0× | 1.25× | 1.5× | 2.0× | 3.0× |

## Daily challenge

- **Goal:** complete **3 qualifying sessions (30+ min)** in one calendar day.
- **Reward:** once the third one ends, every session reward for the rest of that day gets ×2. The third session already gets it.
- **Reset:** `sessions_today` is reset to 0 whenever `sessions_today_date` isn't today.

## Streaks

A streak counts **consecutive work days (Mon–Fri)** on which the daily challenge
was completed. Weekends are skipped: Friday connects to Monday.

When the daily challenge is completed **on a work day**:

1. If the last streak day was the previous work day, or there is no streak yet, the streak advances by 1 (capped at 4).
2. Otherwise, unless it was already advanced today, the streak restarts at 1.
3. When it reaches 4, `streaks_completed` goes up by one, the streak resets to 0, and the "streak complete" sound plays.

Completing the challenge on a weekend does not advance the streak.

**Display:** a streak counts as broken when `streak_last_date` is neither today
nor the previous work day. The UI then shows 0. Broken streaks cannot be
repaired; the next completed challenge starts again at day 1.

> **Quirk:** the stored streak resets to 0 as soon as it reaches 4, and rewards
> use the stored value, so in practice the 3.0× (day 4) multiplier is never
> applied. The highest multiplier that actually applies is 2.0× (day 3).

## Prestige ranks

The rank is the highest title whose `unlock_threshold` ≤ `total_coins_earned`
this season. There are 12 titles, 5 000 coins apart:

| # | Title | Threshold |
|---|---|---|
| 1 | 🔰 Initiate | 5 000 |
| 2 | ⚙️ Operator | 10 000 |
| 3 | 🎯 Focused | 15 000 |
| 4 | 🧠 Deep Worker | 20 000 |
| 5 | 🔥 Streak Master | 25 000 |
| 6 | ⚒️ Forge Adept | 30 000 |
| 7 | 🏗️ Neural Architect | 35 000 |
| 8 | 💎 Apex Operator | 40 000 |
| 9 | ✨ Transcendent | 45 000 |
| 10 | ⭐ Forge Legend | 50 000 |
| 11 | 🔱 Eternal Flame | 55 000 |
| 12 | 🌀 Singularity | 60 000 |

The titles are seeded in `seedPrestigeTitles()` in `db.ts`.

## Seasons

One season per calendar quarter:

| Season | Months | Name | Badge colour |
|---|---|---|---|
| S1 | Jan–Mar | Spring Focused | `#4ade80` green |
| S2 | Apr–Jun | Summer Grind | `#f0c040` gold |
| S3 | Jul–Sep | Fall Steady | `#ee682b` orange |
| S4 | Oct–Dec | Winter Peak | `#00f2ff` cyan |

- `initOrGetActiveSeason` returns the active season, or creates one for the current quarter along with its `game_state` row.
- Once `end_date` has passed, `SeasonTransitionModal` appears. `startNewSeason` calls `archiveSeason`, which saves a snapshot to `game_season_archives` and deactivates the old season, then creates the new one.
- Coins, streaks, the daily challenge and rank all reset with the new season. Archives are kept permanently and listed in the Vault.

## Feedback

| Event | Sound | Visual |
|---|---|---|
| Coins earned | `playCoinEarned` | `+N ⟐` flash next to the header coin counter (about 2.5 s) |
| Daily challenge completed | `playDailyBonusUnlocked` | Vault shows `2x ACTIVE` |
| Streak reaches 4 | `playStreakMilestone` | Header streak bars |

## Removed features

These existed in earlier versions and have been removed. Old ledger rows and
tables may still mention them:

- **Tool shop:** 8 purchasable tools that gave passive coins per hour and active session multipliers.
- **Streak extension:** spending coins to repair a broken streak.
- **Reward toasts:** a popup after each session showing a breakdown of the reward.
