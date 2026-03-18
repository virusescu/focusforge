```markdown
# PRODUCT SPECIFICATION: FlowForge (Unity Desktop)
**Internal Code Name:** FlowForge  
**Target Platform:** Windows/macOS/Linux (Windowed)  
**Engine:** Unity 6 / 2023.x (UI Toolkit)  
**Storage:** SQLite (Local-First)

---

## 1. Executive Summary
FlowForge is a high-logic, local-first productivity tool built in Unity. It uses a **"Time Slope"** mechanic to reward sustained focus with exponential resource generation. Unlike traditional timers, it allows for **Context Switching** within a master session and provides granular **Interrupt Tracking** to diagnose productivity leaks.

---

## 2. Core Mechanics & Logic

### 2.1 The Time Slope (Multiplier)
The reward multiplier $M(t)$ is a step function based on continuous session time $t$ (in minutes).

| Focus Time ($t$) | Multiplier ($M$) | Resource Yield | Visual State |
| :--- | :--- | :--- | :--- |
| $0 \le t < 30$ | **1.0x** | Base Scrap | Basic Workshop |
| $30 \le t < 60$ | **1.5x** | +50% Yield | Powered Factory |
| $t \ge 60$ | **3.0x** | +200% Yield + 5% Rare Drop | Advanced Forge |

### 2.2 Sub-Task "Flow Persistence"
The system allows switching the **Active Sub-Focus** without terminating the Master Session.
* **Mechanism:** Changing a sub-task (e.g., moving from *Coding* to *Testing*) updates the `CurrentTaskID` in the session log but maintains the $t$ value for the multiplier.
* **Logic:** Prevents the "Cold Start" penalty when moving between related micro-tasks in a large feature.

### 2.3 The Protected Pause (Pause Pool)
To maintain the psychological "stakes," pausing is a finite resource.
* **Initial Pool:** 5 minutes.
* **Accrual:** $+1$ minute of pause time granted for every 20 minutes of active flow.
* **Timeout:** If the pool reaches 0, the session auto-terminates via **Emergency Stop**.

---

## 3. Data Architecture (SQLite)

### 3.1 Schema Definition
```sql
-- Core Session Data
CREATE TABLE Sessions (
    SessionID INTEGER PRIMARY KEY AUTOINCREMENT,
    StartTime DATETIME,
    EndTime DATETIME,
    TotalScrap INTEGER,
    RareCores INTEGER,
    PeakMultiplier REAL
);

-- Granular Task Tracking
CREATE TABLE SubTaskLogs (
    LogID INTEGER PRIMARY KEY AUTOINCREMENT,
    SessionID INTEGER REFERENCES Sessions(SessionID),
    TaskTitle TEXT,
    Category TEXT,
    DurationSeconds INTEGER
);

-- Distraction Analysis
CREATE TABLE Interrupts (
    IntID INTEGER PRIMARY KEY AUTOINCREMENT,
    SessionID INTEGER REFERENCES Sessions(SessionID),
    Category TEXT, -- [Meeting, Colleague, Brain Fog, Physical, Phone]
    Description TEXT,
    Timestamp DATETIME
);

-- User Configuration
CREATE TABLE Settings (
    UserName TEXT,
    GeminiAPIKey TEXT,
    TargetFPS INTEGER DEFAULT 30
);
```

---

## 4. Functional Requirements

### 4.1 Planning Terminal (Pre-Production)
* **Task Management:** Define Parent Tasks and nested Sub-Tasks.
* **Category Mapping:** Assign categories (e.g., *Dev, Ops, Admin*) to dictate resource types.
* **Prioritization:** Flag "Critical Path" tasks to appear at the top of the session launcher.

### 4.2 Active Forge (In-Production)
* **Visuals:** 16-bit pixel art factory that grows in complexity as $M(t)$ increases.
* **Controls:**
    * **Switch Focus:** A hot-bar to jump between predefined sub-tasks.
    * **Pause:** Consumes "Pause Pool" time.
    * **Emergency Stop:** Triggers a mandatory modal to select the "Interrupt Category" and add a description.

### 4.3 Analytics Lab (Post-Production)
* **Heat Maps:** Daily/Weekly flow intensity.
* **Interrupt Diagnostics:** Pie chart showing top productivity killers (e.g., "70% of stops are 'Internal Meetings'").
* **Performance:** "Most Productive Day" and "Longest Hyperfocus Streak."

---

## 5. Technical Constraints (Unity)
* **Windowing:** Built as a standalone windowed app (Non-fullscreen).
* **Performance:** `Application.targetFrameRate` capped at 30 or 60 to minimize background CPU/GPU usage during compilation.
* **API Integration:** Secure local storage for **Google Gemini API Key** for future TTS/Analysis features.

---

> **Next Step:** Would you like the C# implementation for the **`FlowSessionManager`** (handling the Multiplier and Pause Pool logic) or the **`SQLiteService`** wrapper for Unity?