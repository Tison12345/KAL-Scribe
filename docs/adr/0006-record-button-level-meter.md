# ADR-0006: RecordButton audio level meter — visual design

- Status: accepted
- Date: 2026-07-04
- Context: `architecture.md` §6 calls out the live audio level meter for
  `RecordButton` as something genuinely new — nothing like it exists
  in the current CMS, so neither `ui-guidelines.md` nor
  `ui-reference.md` document a pattern for it. §6 requires any such
  gap to be filled as "a deliberate, minimal extension of the existing
  look — same colors/fonts/tone, new pattern only where one doesn't
  already exist" and recorded here rather than left as silent drift.
- Decision: The level meter is a single horizontal bar, not a
  waveform, spectrum, or set of vertical bars — the simplest shape
  that reads as "input level" without adding decorative complexity
  (ui-guidelines.md's "avoid excessive animation/decoration" tone
  constraint). Structure, reusing only existing tokens/patterns:
  - Track: `bg-[var(--color-surface-container-low)] rounded-full h-2
    w-full overflow-hidden` — same track styling already used for
    other low-emphasis surface fills.
  - Fill: `bg-[var(--color-primary)] h-full rounded-full
    transition-[width] duration-75`, width driven by the instantaneous
    0–1 level from `useAudioRecorder`'s Web Audio `AnalyserNode` RMS
    calculation. No gradient, no color change at high levels (no
    red/amber "clipping" zone) — kept deliberately minimal for MVP.
  - Only rendered while `status === 'recording'` or `'paused'`; absent
    entirely in the idle/stopped state rather than shown empty, so it
    reads as "live signal," not a permanent UI fixture.
- Consequences: If a future milestone needs clipping/quality feedback
  (e.g. flag "audio quality poor" contributing to
  `ai_confidence.low_confidence_reason`, §11), that's a new visual
  state on this same bar (e.g. a red fill segment) — extend this ADR's
  design rather than introducing a second, differently-shaped meter.
