# Database

FocusForge stores everything in a **Turso (LibSQL / SQLite)** database. Each user
brings their own database: the URL and auth token are entered on the Setup
screen and kept in the Tauri store. The frontend connects directly with
`@libsql/client`. There is no server in between.

All access goes through `src/db.ts`:

- `initDbClient(url, token)` creates the singleton client; `getDb()` returns it (and throws if it isn't initialised).
- `initDb()` runs on every login and app start. It issues `CREATE TABLE IF NOT EXISTS` for every table, applies migrations, and re-seeds the prestige titles.
- Every query uses parameterised statements (`args`). Each function returns a typed object from `src/types/index.ts`.
- Every user-owned table has a `user_id` column, and every query filters on it.

Related docs: [architecture.md](architecture.md) · [economy.md](economy.md)

---

## Tables

### Core

| Table | Columns | Notes |
|---|---|---|
| `users` | `id`, `google_sub` (unique), `email`, `name`, `avatar_url`, `created_at` | Upserted on every login from the Google profile. |
| `user_settings` | `id`, `user_id`, `debug_speed` (1.0), `experience_lvl` (42), `day_start_hour` (8), `day_end_hour` (2) | Created lazily on the first `getUserSettings`. The day hours drive the Analytics day window. |
| `focus_sessions` | `id`, `user_id`, `start_time` (ISO, UTC), `duration_seconds`, `date` (YYYY-MM-DD from `start_time`) | Only sessions ≥ 60 s are saved. |
| `session_pauses` | `id`, `session_id` → `focus_sessions`, `pause_time` | One row per counted pause. Deleted together with the session. |
| `objective_categories` | `id`, `user_id`, `label`, `color`, `sort_order`, `coin_bounty` (25) | Seeded per user: Hard (50), Normal (25), Easy (10). `sort_order` is the user-chosen display order (`reorderCategories` rewrites it 0..n after a drag). |
| `buckets` | `id`, `user_id`, `name`, `color` (hex), `x`, `y`, `w` (300), `h` (420), `sort_order`, `kind` (`mission` / `unsorted` / `deadlines` / `custom`) | Panels on the Buckets canvas; `x`/`y`/`w`/`h` are world units. `sort_order` is the stacking order (higher = in front); `bringBucketToFront` sets it to the user's max + 1 after a panel is moved or resized. Every user has exactly one `mission` and one `unsorted` system bucket, created by `ensureSystemBuckets` and enforced by the partial unique index `idx_buckets_user_system` on `(user_id, kind) WHERE kind IN ('mission','unsorted')`. The `mission` row only stores the Mission panel's name, color and geometry; no objective has its `bucket_id`. The `deadlines` row does the same for the Deadlines panel (one per user, partial unique index `idx_buckets_user_deadlines`; the panel lists the objectives whose `deadline_at` is not null). System buckets cannot be deleted, and no objective can be moved into Mission or Deadlines. Deleting a custom bucket moves its objectives (open and completed) to Unsorted, appended after Unsorted's open objectives in their existing order. |
| `templates` | `id`, `user_id`, `name` (not unique), `title`, `details` (markdown), `color` (hex, the button's color), `category_id` (nullable), `sort_order`, `created_at` | Saved task shapes. `title` and `details` may contain `$placeholders`; the fields are never stored, they are derived from the text (see `utils/templates.ts`). `sort_order` is the button order everywhere (`reorderTemplates` rewrites it 0..n after a drag in the manager). `deleteCategory` sets `category_id` to NULL explicitly. Creating a task from a template inserts a normal `objectives` row with the filled-in `text` and `details`. |
| `canvas_notes` | `id`, `user_id`, `content` (markdown, '' default), `color` (hex), `x`, `y`, `w` (260), `h` (200), `sort_order`, `created_at` | Sticky notes on the Buckets canvas, in world units. `sort_order` is the stacking order among notes only (higher = in front); every note is drawn above every bucket. `bringCanvasNoteToFront` sets it to the user's max + 1 after a note is moved or resized. |
| `objectives` | `id`, `user_id`, `text`, `created_at`, `sort_order` (Mission order), `completed_at`, `category_id` → categories, `is_mission` (1 = in Mission, 0 = only in its bucket), `details` (markdown), `last_interacted_at`, `bucket_id` → buckets, `bucket_sort_order` (order inside the bucket), `deadline_at` (ISO UTC, nullable; may be in the past) | Open objectives have `completed_at IS NULL`. Completing one clears `details`. Every objective belongs to a non-mission bucket; being in Mission is a flag on top of that, so a Mission objective also appears in its bucket. |
| `alarms` | `id`, `user_id`, `title`, `time` (HH:MM), `days_of_week` (JSON array 0–6, Sun–Sat), `is_active` | |

### Game economy

| Table | Columns | Notes |
|---|---|---|
| `game_seasons` | `id`, `user_id`, `season_number` (1–4 = quarter), `year`, `start_date`, `end_date`, `is_active`, `created_at` | Unique on `(user_id, season_number, year)`. One active season per user. |
| `game_state` | `id`, `user_id`, `season_id`, `coins`, `total_coins_earned`, `current_streak_days`, `streak_last_date`, `streaks_completed`, `sessions_today`, `sessions_today_date`, `daily_bonus_active`, `peak_coins_per_hour` | One row per user per season. |
| `game_coin_transactions` | `id`, `user_id`, `season_id`, `amount`, `reason`, `metadata` (JSON), `created_at` | Append-only ledger. `reason` is `session_complete` or `objective_complete` (older rows may contain `tool_purchase`, `streak_extend` or `passive_income`). |
| `game_prestige_titles` | `id`, `name`, `display_name`, `description`, `unlock_threshold`, `icon` | Global (not per user). Re-seeded with `INSERT OR REPLACE` on every `initDb`. |
| `game_season_archives` | `id`, `user_id`, `season_id`, `season_label`, `season_name`, `badge_color`, `final_coins`, `total_coins_earned`, `total_sessions`, `total_streaks`, `tools_purchased`, `cosmetics_purchased`, `peak_coins_per_hour`, `longest_streak`, `created_at` | A snapshot written when a season ends. See the legacy notes below. |
| `game_streak_log` | `id`, `user_id`, `season_id`, `date`, `had_session`, `streak_day` | One row per work day on which the daily challenge was completed. Written, but not currently read by the UI. |

### Relationships

```
users ─┬─< user_settings
       ├─< focus_sessions ─< session_pauses
       ├─< objective_categories ─< objectives
       ├─< objectives
       ├─< buckets ─< objectives
       ├─< templates
       ├─< canvas_notes
       ├─< alarms
       └─< game_seasons ─┬─ game_state            (1 per season)
                         ├─< game_coin_transactions
                         ├─< game_streak_log
                         └─ game_season_archives  (1 per finished season)
game_prestige_titles   (global lookup)
```

Foreign keys are declared for the core tables only. The game tables link by
`user_id` / `season_id` convention.

## Coin bookkeeping

`addCoinTransaction(userId, seasonId, amount, reason, metadata?)` is the only
code that writes coins. It:

1. inserts a ledger row in `game_coin_transactions`, then
2. updates `game_state`: `coins += amount`, and `total_coins_earned += amount` only when `amount > 0`.

Prestige rank is based on `total_coins_earned`, so a negative amount would
lower the balance but not the rank.

## Migrations

There is no migration framework. `initDb()` runs idempotent steps every time:

- `ALTER TABLE ... ADD COLUMN` wrapped in `try/catch` (it fails harmlessly if the column already exists): `objectives.is_mission`, `objectives.details`, `objectives.last_interacted_at`, `objective_categories.coin_bounty`, `objectives.bucket_id`, `objectives.bucket_sort_order`, `objectives.deadline_at`.
- **Unique system buckets.** Duplicate `mission`/`unsorted` rows for a user (left by an old check-then-insert race) are merged into the lowest id, with objectives repointed to it, and then `idx_buckets_user_system` is created.
- When `coin_bounty` is first added, the seeded `Hard` and `Easy` categories are set to 50 and 10.
- **Buckets backfill (per user).** `ensureSystemBuckets(userId)` runs whenever buckets are loaded. It creates the `mission`, `unsorted` and `deadlines` system buckets if missing (`INSERT OR IGNORE`; overlapping calls for the same user share one run), then moves every objective with `bucket_id IS NULL` into Unsorted, with `bucket_sort_order = COALESCE(bucket_sort_order, sort_order)`. Existing Mission and Backlog objectives therefore all land in Unsorted, and `is_mission` and `sort_order` are left alone, so Mission order does not change. The step is a no-op once every objective has a bucket.
- The prestige thresholds are rewritten to the 5 000-step ladder, then all 12 titles are re-seeded.

To add a column, append another guarded `ALTER TABLE` block to `initDb()` and
add the field to the `CREATE TABLE` statement for fresh databases.

## Time handling

- Timestamps are stored as ISO strings in UTC (`new Date().toISOString()`).
- Queries that group or filter by calendar day convert with SQLite `date(..., 'localtime')` / `datetime(..., 'localtime')`.
- The Analytics "day" runs from 00:00 to the next day's `day_end_hour` (default 02:00), so late-night sessions count toward the previous day.

## Legacy and quirks

- **Dropped tool tables.** The tool shop has been removed. `game_tool_definitions` and `game_owned_tools` may still exist in older databases, but the code neither creates nor reads them. They are safe to drop by hand.
- **`game_season_archives.tools_purchased`** is `NOT NULL`, so new archives write `'[]'` to it.
- **`game_season_archives.cosmetics_purchased`** actually stores the JSON list of prestige titles reached that season. The column name is historical.
- **`peak_coins_per_hour`** is never updated, so it is always 0.
- **`game_state.daily_bonus_active`** is written but is effectively derived from `sessions_today >= 3`.
