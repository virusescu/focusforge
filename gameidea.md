# FocusForge Gamification Design

## Core Concept

Transform FocusForge into an incremental idle game that rewards genuine focus behavior with persistent progression. The game mechanic is a **dopamine hack for ADHD** — using game loops and progression to reinforce focus sessions and productivity streaks.

The key insight: this is not about "beating" a game, but about leveraging reward systems to keep the brain engaged and motivated during work.

---

## The 3-Month Seasonal Loop

### Early Game (Week 1-2)
- Earn coins from completed focus sessions
- Buy first tools (Coffee Maker, Standing Desk)
- Hit first 4-day streak
- Unlock initial cosmetics

### Mid Game (Week 3-8)
- Daily 3-session challenges become routine
- Streaks break and restart; players learn rhythm
- Purchase better tools, unlock cosmetics
- Seasonal multipliers stack and compound
- Peak focus boosts (45min+ unbroken sessions) trigger

### Late Game (Week 9-12)
- Most tools purchased; passive income is solid
- Focus shifts from "what's next" to optimization
- Push for long streaks into final weeks
- Season winds down; final coin counts lock

### Season End
- All stats snapshot and archived
- Seasonal badge awarded (e.g., "Q2 2026 Focused")
- Complete reset: coins → 0, tools → gone, streaks → 0
- Archive remains accessible for reflection

---

## Coin Economy

### Base Earnings
- **Per completed session:** 50 coins
- **Session quality multiplier:** +20% coins for unbroken 45+ min sessions
- **Streak multiplier:** Current streak (1-4 days) = 1.0x to 1.5x bonus
- **Daily challenge bonus:** Complete 3 sessions in a day = 2x multiplier on all coins earned that day

### Tools (Purchasable)
Tools amplify income during both active focus and idle time:

| Tool | Cost | Effect | Type |
|------|------|--------|------|
| Coffee Maker | 200 | +5 coins/hour passive | Passive Income |
| Standing Desk | 300 | +15% coins during active sessions | Active Multiplier |
| Ergonomic Chair | 400 | +10 coins/hour passive | Passive Income |
| Noise-Canceling Headphones | 500 | +25% coins during sessions | Active Multiplier |
| Second Monitor | 750 | +20 coins/hour passive | Passive Income |
| Smart Lighting | 1000 | +30% coins during sessions | Active Multiplier |
| Productivity Suite | 1500 | +50 coins/hour passive | Passive Income |
| Elite Workstation | 2000 | +40% coins during sessions + +100 coins/hour passive | Prestige Tool |

### Cosmetics (Optional Purchases)
- Sound packs (50-200 coins): Custom completion chimes, streak fanfares
- Themes (100-300 coins): Dark mode variants, color schemes for Vault page
- Titles (150-400 coins): "The Focused," "Streak Master," "Deep Worker" displayed next to name

---

## Streak System

### How Streaks Work
- **Definition:** Consecutive work-days (Monday-Friday only)
- **Max streak:** 4 days (resets after Thursday completion)
- **Breaks:** Missing a day breaks the streak
- **Recovery:** Spend coins to extend streak by 1 day (costs scale: 100 → 500 coins depending on streak length)

### Streak Milestones
- **4-day streak completed:** Prestige unlock + cosmetic badge (e.g., "Weekly Master")
- **Multiple 4-day streaks in season:** Stacking multiplier (2nd streak = 1.1x, 3rd = 1.2x)
- **Perfect season (13 consecutive 4-day streaks):** Legendary seasonal badge

---

## UI/UX Integration

### Menu Bar Enhancement
- **Coin counter:** Live display of current coins (top-right or left sidebar)
- **Streak indicator:** Current work streak (e.g., "Day 3/4 🔥")
- **Season timer:** Days remaining in current season (e.g., "45 days left")

### Vault Page (New)
Accessible via main menu button. Contains:

- **Season Overview:**
  - Current season stats (coins earned, tools purchased, streaks completed, sessions logged)
  - Progress bars for daily challenge (sessions remaining today)
  - Streak status and "extend" button

- **Tool Inventory:**
  - All purchasable tools with costs and descriptions
  - Currently owned tools highlighted
  - Income breakdown (passive/active combined)

- **Cosmetics Store:**
  - Sound packs, themes, titles
  - Preview options before purchase

- **Seasonal Archive:**
  - Past seasons displayed as cards
  - Each card shows: season name, final coin count, tools purchased, streaks completed, badges earned
  - Clickable to view detailed snapshot

### Post-Session Reward Notification
- Appears in sidebar after session completion (2-3 seconds)
- Shows: coins earned, streak status, daily challenge progress
- Automatically collapses; no forced interaction required
- Sound effect plays (tied to completion chime)

---

## Progression Arc & End-Game

### Why 3 Months?
- Aligned with real work quarters (Q1, Q2, Q3, Q4)
- Long enough to feel progression (buying tools, hitting streaks)
- Short enough to reset before fatigue sets in
- Natural calendar rhythm for motivation

### Season End Mechanics
1. **Stats lock:** No more coin generation after final day of season
2. **Badge awarded:** Unique badge for completed season (design varies by quarter)
3. **Archive snapshot:** Full season data stored (coins, tools, streaks, cosmetics purchased)
4. **Reset trigger:** New season starts automatically next day or on user prompt
5. **Archive access:** Anytime, view past seasons for reflection/motivation

### Seasonal Badges (Examples)
- Q1 2026: "Spring Focused" (green theme)
- Q2 2026: "Summer Grind" (gold theme)
- Q3 2026: "Fall Steady" (orange theme)
- Q4 2026: "Winter Peak" (blue theme)

---

## Dopamine Design Principles

### Timing of Rewards
- **During focus session:** Silent. Only passive income ticks quietly in background. No distractions.
- **At session completion:** Immediate, brief reward (2-3 sec animation/sound)
- **Streak milestones:** Larger celebration (longer chime, visual pop)
- **Season end:** Prestige moment (badge unlock, archive snapshot)

### Feedback Loops
1. **Immediate:** Session → coins (visual feedback in notification)
2. **Daily:** 3 sessions → daily challenge bonus (cumulative)
3. **Weekly:** 4-day streak → prestige unlock (milestone hit)
4. **Seasonal:** 13 weeks of work → badge + archive (long-term achievement)

### Avoiding Distraction
- Vault page is **separate** — not visible during focus sessions
- Sidebar notifications are **optional glance** — auto-dismiss
- Tools are **numbers-only** — passive, no animation during focus
- Only post-session interactions require engagement

---

## Mechanics Details

### Session Quality Detection
- **45+ minutes unbroken:** Triggers "peak focus" bonus
- **0 breaks** during session = quality check passes
- Bonus: +20% coins + streak bonus applies on top

### Daily Challenge Logic
- **Reset:** Midnight each day
- **Target:** 3 completed sessions
- **Reward:** 2x multiplier on ALL coins earned that day (stacks with other multipliers)
- **Failure:** No penalty; challenge resets next day

### Streak Extension Cost
- **Formula:** Base cost (100) + (current streak × 50)
  - Day 1 break: 100 coins
  - Day 2 break: 150 coins
  - Day 3 break: 200 coins
  - Day 4 break: 250 coins

### Tool Income Calculation
- **Passive income/hour:** Sum of all owned passive tools
- **Active multiplier:** Sum of all owned active tool bonuses (% of session coins)
- **Example:** Owning Standing Desk (+15%) + Noise-Canceling (+25%) = +40% on session coins

---

## Archive & Reflection

### Why Archive Matters
- Validates effort over time
- Shows seasonal progression (coin counts often increase each quarter)
- Provides motivation for next season ("I earned 50k coins last season, can I beat it?")
- Creates a personal hall-of-fame of focus achievements

### Archive Data Stored Per Season
- Season name (Q2 2026)
- Final coin count
- Total sessions completed
- Total streaks completed (count of 4-day chains)
- Tools purchased (list)
- Cosmetics purchased (list)
- Peak coins/hour achieved
- Longest streak maintained

---

## Summary

FocusForge Gamification is a **low-distraction, high-reward** system that uses:
- **Immediate feedback** (coins per session) to reinforce focus behavior
- **Medium feedback** (4-day streaks, daily challenges) to build momentum
- **Long feedback** (3-month seasons, archives) to create lasting motivation

The goal: leverage game psychology to make focus feel rewarding, not punishing. Coins are just the medium; the real dopamine comes from watching your focus discipline compound into visible progression.
