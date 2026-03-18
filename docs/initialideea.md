```markdown
# PRODUCT SPECIFICATION: FocusForge (Unity Desktop)
**App Name:** FocusForge  
**Target Platform:** Windows (Windowed, 60 FPS)  
**Engine:** Unity 6 (UI Toolkit)  
**Storage:** SQLite (Local-First)  
**User Model:** Single-user, local only

---

## 1. Executive Summary
FocusForge is a high-logic, local-first productivity tool built in Unity. It uses a **"Time Slope"** mechanic to reward sustained focus with exponential resource generation. It provides granular **Interrupt Tracking** to diagnose productivity leaks and a gamification layer with currencies (Scrap, Rare Cores, Super Cores) for future factory-upgrade features.

---

## 2. Core Mechanics & Logic

### 2.1 The Time Slope (Multiplier)
The reward multiplier $M(t)$ is a step function based on continuous session time $t$ (in minutes). Resources are generated on a configurable **tick interval**.

| Focus Time ($t$) | Multiplier ($M$) | Resource Yield | Visual State |
| :--- | :--- | :--- | :--- |
| $0 \le t < 30$ | **1.0x** | Base Scrap | Basic Workshop |
| $30 \le t < 60$ | **1.5x** | +50% Yield | Powered Factory |
| $t \ge 60$ | **3.0x** | +200% Yield + 5% Rare Drop | Advanced Forge |

**Resource Tick:** Each tick awards Scrap (base currency). At $t \ge 60$, each tick has a **5% chance** of awarding a **Rare Core** instead of Scrap. Tick interval is defined in config.

**Session Reset:** When a session ends, $M(t)$ resets to 1.0x. No carry-over between sessions.

### 2.2 Streak Mechanic — Super Cores
A **Super Core** (premium currency) is awarded when the user completes **4 sessions** where $t \ge 60$ minutes. The streak counter resets after a Super Core is awarded.

> **MVP Note:** All currencies (Scrap, Rare Cores, Super Cores) are purely gamification counters. They do not unlock anything in the MVP. An Inventory table is scaffolded for future factory-upgrade features.

### 2.3 Pause Rules
To maintain psychological "stakes," pausing has strict limits:
* **Single Pause Limit:** If any single pause exceeds **3 minutes**, the session auto-terminates.
* **Frequency Limit:** If the user pauses **more than 4 times** within a rolling 1-hour window, the session auto-terminates.
* On auto-termination, earned rewards (Scrap, Rare Cores) are kept — no penalty.

> **MVP Note:** Sub-Task "Flow Persistence" (switching active sub-focus mid-session without resetting the timer) is deferred to a post-MVP phase.

---

## 3. Data Architecture (SQLite)

### 3.1 Schema Definition
```sql
-- Task Definitions (created in Planning Terminal)
CREATE TABLE Tasks (
    TaskID INTEGER PRIMARY KEY AUTOINCREMENT,
    ParentTaskID INTEGER REFERENCES Tasks(TaskID),
    Title TEXT NOT NULL,
    Category TEXT,
    IsCriticalPath INTEGER DEFAULT 0,
    IsCompleted INTEGER DEFAULT 0,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Core Session Data
CREATE TABLE Sessions (
    SessionID INTEGER PRIMARY KEY AUTOINCREMENT,
    TaskID INTEGER REFERENCES Tasks(TaskID),
    StartTime DATETIME,
    EndTime DATETIME,
    TotalScrap INTEGER DEFAULT 0,
    RareCores INTEGER DEFAULT 0,
    PeakMultiplier REAL DEFAULT 1.0,
    PauseCount INTEGER DEFAULT 0,
    TerminationReason TEXT -- [Manual, PauseTooLong, TooManyPauses]
);

-- Distraction Analysis
CREATE TABLE Interrupts (
    IntID INTEGER PRIMARY KEY AUTOINCREMENT,
    SessionID INTEGER REFERENCES Sessions(SessionID),
    Category TEXT, -- [Meeting, Colleague, BrainFog, Physical, Phone]
    Description TEXT,
    Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Inventory (scaffolded for future factory upgrades, unused in MVP)
CREATE TABLE Inventory (
    ItemID INTEGER PRIMARY KEY AUTOINCREMENT,
    ItemName TEXT NOT NULL,
    ItemType TEXT, -- [Cosmetic, Upgrade, Blueprint]
    Quantity INTEGER DEFAULT 0,
    AcquiredAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 3.2 User Settings (Local JSON File)
Settings are stored in a local `settings.json` file (easier to hand-edit than a DB table):
```json
{
    "userName": "",
    "geminiApiKey": "",
    "targetFPS": 60,
    "resourceTickSeconds": 60,
    "pauseLimitSeconds": 180,
    "maxPausesPerHour": 4,
    "streakTargetSessions": 4,
    "rareDropChance": 0.05
}
```

---

## 4. Functional Requirements

### 4.1 Planning Terminal (Pre-Production)
* **Task Management:** Define Parent Tasks and nested Sub-Tasks (CRUD).
* **Category Mapping:** Assign categories (e.g., *Dev, Ops, Admin*).
* **Prioritization:** Flag "Critical Path" tasks to appear at the top of the session launcher.

### 4.2 Active Forge (In-Production)
* **MVP Visuals:** Placeholder prefabs (colored shapes with text labels) representing the 3 factory states. Full pixel art deferred to post-MVP.
* **Controls:**
    * **Start/Stop:** User can start and stop sessions freely.
    * **Pause:** Pauses the timer. Subject to 3-minute and 4x/hour limits.
    * **Emergency Stop:** Triggers a mandatory modal to select the "Interrupt Category" and add a description.
* **Display:** Current timer, active multiplier tier, Scrap count, Rare Core count, pause budget remaining.

### 4.3 Analytics Lab (Post-Production)
* **MVP Scope:** Daily summary view — total focus time, total Scrap, total Rare Cores, session count per day.
* **Third-party charting** library for rendering (to be selected).
* **Post-MVP:** Heat maps, interrupt diagnostics pie charts, streak stats, "Most Productive Day."

---

## 5. Technical Constraints (Unity)
* **Windowing:** Standalone windowed app (non-fullscreen).
* **Performance:** `Application.targetFrameRate` set to 60.
* **API Integration:** Google Gemini API key stored in local `settings.json`. **Not used in MVP.** Future use: pre-generated TTS encouragement phrases personalized with user's name.

---

## 6. Post-MVP Roadmap (Out of Scope for MVP)
* Sub-Task Flow Persistence (mid-session context switching)
* Factory visual upgrades using Inventory / currencies
* Gemini API integration (TTS encouragement, AI session summaries)
* Advanced analytics (heat maps, interrupt pie charts, streak tracking UI)
* macOS/Linux platform support
* Asset Store UI kit integration
* Sound effects and ambient audio