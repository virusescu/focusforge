# Charge Click Sounds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single generic click sound in the neutralize-objective charge mechanic with 5 escalating synth sounds (pitch rises each click), with disk-file fallback support.

**Architecture:** `SoundEngine` gains `playChargeClick(step)` for synth generation and a standalone `playChargeClickWithFile(step)` async function that tries `public/sounds/charge-{step}.mp3` first (matching the existing `playObjectiveComplete` pattern). `MainDisplay` tracks a click counter ref, increments it per charge click, resets when charge decays to 0, and calls `playChargeClickWithFile` instead of `playClick`. Charge step changes from 0.3 → 0.2 so exactly 5 clicks = neutralize.

**Tech Stack:** Web Audio API (existing SoundEngine), React refs, TypeScript

---

### Task 1: Add synthesized charge click sounds to SoundEngine

**Files:**
- Modify: `src/utils/audio.ts`

- [ ] **Step 1: Add `playChargeClick(step: number)` method to `SoundEngine`**

  Open `src/utils/audio.ts`. Add this method inside the `SoundEngine` class, after the existing `playClick()` method:

  ```ts
  playChargeClick(step: number) {
    const ctx = this.init();
    const t = ctx.currentTime;

    const configs: [number, number, number][] = [
      [300,  500,  0.060], // step 1 – low tick
      [500,  800,  0.065], // step 2 – brighter
      [800,  1200, 0.070], // step 3 – crisp
      [1200, 1800, 0.075], // step 4 – sharp
      [1800, 2800, 0.080], // step 5 – high, snappy
    ];

    const idx = Math.max(0, Math.min(4, step - 1));
    const [freqStart, freqEnd, dur] = configs[idx];

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freqStart, t);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    gain.gain.setValueAtTime(0.07, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  }
  ```

- [ ] **Step 2: Add `playChargeClickWithFile` exported async function**

  In `src/utils/audio.ts`, after the existing `playObjectiveComplete` function at the bottom of the file, add:

  ```ts
  export async function playChargeClickWithFile(step: number): Promise<void> {
    try {
      const audio = new Audio(`./sounds/charge-${step}.mp3`);
      audio.volume = 0.75;
      await audio.play();
    } catch {
      soundEngine.playChargeClick(step);
    }
  }
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add src/utils/audio.ts
  git commit -m "feat: add escalating charge click sounds to SoundEngine"
  ```

---

### Task 2: Wire escalating sounds into MainDisplay charge mechanic

**Files:**
- Modify: `src/components/MainDisplay.tsx`

- [ ] **Step 1: Import `playChargeClickWithFile`**

  In `src/components/MainDisplay.tsx`, add `playChargeClickWithFile` to the import from `../utils/audio`:

  ```ts
  // Before
  import { soundEngine } from '../utils/audio';

  // After
  import { soundEngine, playChargeClickWithFile } from '../utils/audio';
  ```

- [ ] **Step 2: Add a `clickCount` ref**

  After the existing `lastClickTime` ref (around line 27), add:

  ```ts
  const clickCount = useRef(0);
  ```

- [ ] **Step 3: Change charge step to 0.2 and use escalating sound**

  Replace the `handleChargeClick` callback body so each click advances by 0.2 (5 clicks to neutralize) and plays the step-specific sound:

  ```ts
  const handleChargeClick = useCallback(() => {
    const now = Date.now();

    clickCount.current = Math.min(clickCount.current + 1, 5);
    playChargeClickWithFile(clickCount.current);

    const newCharge = Math.min(chargeRef.current + 0.2, 1);
    setCharge(newCharge);
    chargeRef.current = newCharge;
    lastClickTime.current = now;

    if (newCharge >= 1) {
      handleNeutralize();
    }
  }, [handleNeutralize]);
  ```

- [ ] **Step 4: Reset `clickCount` when charge decays to 0**

  In the charge decay `useEffect`, after the line that sets `chargeRef.current = newCharge`, add the reset:

  ```ts
  // existing decay effect — find this block:
  const newCharge = Math.max(chargeRef.current - decayAmount, 0);
  setCharge(newCharge);
  chargeRef.current = newCharge;
  // ADD after:
  if (newCharge === 0) {
    clickCount.current = 0;
  }
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/MainDisplay.tsx
  git commit -m "feat: wire escalating charge click sounds, 5-click neutralize"
  ```

---

### Task 3: Update sounds README with new file documentation

**Files:**
- Modify: `public/sounds/README.md`

- [ ] **Step 1: Update README**

  Replace the entire content of `public/sounds/README.md` with:

  ```markdown
  # Custom Sounds

  Drop replacement audio files here. Supported formats: MP3, OGG, WAV.

  | File | Plays when |
  |------|-----------|
  | `objective-complete.mp3` | An objective is neutralized (completion boom) |
  | `charge-1.mp3` | 1st click when charging a neutralize (lowest pitch) |
  | `charge-2.mp3` | 2nd click when charging a neutralize |
  | `charge-3.mp3` | 3rd click when charging a neutralize |
  | `charge-4.mp3` | 4th click when charging a neutralize |
  | `charge-5.mp3` | 5th (final) click — triggers neutralization (highest pitch) |

  If any file is missing or fails to load, the app falls back to the synthesized sound.
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add public/sounds/README.md
  git commit -m "docs: document charge-1..5.mp3 custom sound slots"
  ```

---

### Task 4: Verify the feature works end-to-end

- [ ] **Step 1: Run the dev server**

  ```bash
  npm run tauri dev
  ```

- [ ] **Step 2: Manual test — escalating sounds**

  1. Start a focus session (spacebar)
  2. Set an active objective (click one in the sidebar)
  3. Click the active objective area in MainDisplay 5 times within 2 seconds
  4. Verify: each click sounds distinctly higher than the previous, and the 5th click triggers the neutralize animation + boom

- [ ] **Step 3: Manual test — decay resets counter**

  1. Click the objective 2–3 times
  2. Wait ~3 seconds for charge to fully decay
  3. Click again — sound should restart from step 1 (low pitch), not continue from where it left off

- [ ] **Step 4: Manual test — disk file fallback**

  1. Place any short MP3 as `public/sounds/charge-3.mp3`
  2. Reload the app
  3. Click 3 times — the 3rd click should play the custom file, others still synth
  4. Remove the file, reload — 3rd click should silently fall back to synth

- [ ] **Step 5: Run build to confirm no regressions**

  ```bash
  npm run build
  ```

  Expected: clean build, no TypeScript errors.
