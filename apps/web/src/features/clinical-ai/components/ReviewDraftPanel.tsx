"use client";

import { useState } from "react";
import type {
  BpPosition,
  ClinicalExtraction,
  ConsultationAiResult,
  ExtractedMedicine,
  ExtractedTreatment,
  FollowUpUnit,
  Pressure,
  QuantityUnit,
  SrotasEntry,
  SrotasKey,
  StrokeDirection,
} from "@kal-scribe/types";
import { SROTAS_DISTURBANCE_TYPES, SROTAS_KEYS } from "@kal-scribe/types";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { RiskFlagBanner } from "./RiskFlagBanner";
import { StringListEditor } from "./StringListEditor";

export interface ReviewDraftPanelProps {
  result: ConsultationAiResult | null;
  draft: ClinicalExtraction | null;
  isPolling: boolean;
  isSaving: boolean;
  error: string | null;
  onChange: (next: ClinicalExtraction) => void;
  onAccept: () => void;
  onDiscard: () => void;
}

const STATUS_LABELS: Record<ConsultationAiResult["status"], string> = {
  draft: "AI draft — not yet reviewed",
  edited: "Edited by doctor",
  accepted: "Accepted",
  discarded: "Discarded",
};

const STATUS_CLASSES: Record<ConsultationAiResult["status"], string> = {
  draft: "bg-[var(--color-accent)]/10 text-[var(--color-accent)]",
  edited: "bg-[var(--color-primary)]/10 text-[var(--color-primary)]",
  accepted: "bg-emerald-50 text-emerald-700",
  discarded: "bg-[var(--color-surface-container-low)] text-[var(--color-on-surface-variant)]",
};

// ── Option lists (mirrors the live CMS form exactly — see
// docs/modules/clinical-extraction-schema.md for the source-of-truth
// derivation) ──

const DOSHA_OPTIONS = [
  "Vata", "Vata Pitta", "Vata Kapha", "Pitta", "Pitta Vata",
  "Pitta Kapha", "Kapha", "Kapha Vata", "Kapha Pitta", "Vata Pitta Kapha",
];
const AGNI_OPTIONS = ["Sama (Normal)", "Manda (Low)", "Vishama (Variable)", "Tikshna (Sharp)"];
const OJAS_OPTIONS = ["Pravara (Optimal)", "Ojo Kshayam (Depleted)", "Ojo Vyapat (Vitiated)", "Ojo Visramsa (Displaced)"];
const BP_POSITIONS: BpPosition[] = ["Sitting", "Standing", "Lying"];
const QUANTITY_UNITS: QuantityUnit[] = ["mL", "gm", "tabs", "tspn", "Patch"];
const ANUPANA_PRESETS = ["Warm Water", "Plain Water", "Jeera Water (Warm)", "Ghee", "Milk", "Honey"];
const TIMING_PRESETS = ["Before Meals", "With Meals", "After Meals"];
const STROKE_OPTIONS: { value: StrokeDirection; label: string }[] = [
  { value: "anuloma", label: "Anuloma (with the hair)" },
  { value: "pratiloma", label: "Pratiloma (against the hair)" },
];
const PRESSURE_OPTIONS: Pressure[] = ["high", "medium", "low"];
const FOLLOWUP_UNITS: FollowUpUnit[] = ["days", "weeks", "months"];

const ASHTAVIDHA_FIELDS: { key: keyof ClinicalExtraction["ashtavidhaPariksha"]; label: string; subtitle: string; options: string[] }[] = [
  { key: "nadi", label: "Nadi", subtitle: "Pulse", options: DOSHA_OPTIONS },
  { key: "mutra", label: "Mutra", subtitle: "Urine", options: ["Prakritam (Normal)", "Vikritam (Abnormal)"] },
  { key: "mala", label: "Mala", subtitle: "Stool", options: ["Samyak Mala Pravruti (Regular)", "Mala Sanga / Vibhanda (Constipated)", "Drava Mala Pravruti (Loose)", "Vishama Mala Pravruti (Irregular)"] },
  { key: "jivha", label: "Jivha", subtitle: "Tongue", options: ["Lipta (Coated)", "Nirlipta (Non-coated)", "Sputana (Cracked)"] },
  { key: "shabda", label: "Shabda", subtitle: "Speech", options: ["Prakritam (Normal)", "Vishama (Irregular)", "Durbala (Weak)"] },
  { key: "sparsha", label: "Sparsha", subtitle: "Touch", options: ["Ushna (Hot)", "Sheeta (Cold)", "Sushka (Dry)", "Ruksha (Rough)", "Sukshma (Sensitive)", "Snigdha (Oily)"] },
  { key: "drik", label: "Drik", subtitle: "Eyes", options: ["Prakritam (Normal)", "Vikritam (Abnormal)"] },
  { key: "akruti", label: "Akruti", subtitle: "Built", options: ["Sthula (Obese)", "Madhyama (Medium)", "Krisha (Lean)"] },
];

const PERSONAL_HISTORY_FIELDS: { key: keyof ClinicalExtraction["personalHistory"]; label: string; multi: boolean; options: string[] }[] = [
  { key: "bowel", label: "Bowel", multi: false, options: ["Normal", "Hard/Constipated", "Soft/Loose", "Irregular"] },
  { key: "bladder", label: "Urination", multi: true, options: ["Normal (4–6×/day)", "Frequent (7+/day)", "Reduced [Quantity]", "Burning", "Painful", "Nocturnal"] },
  { key: "sleep", label: "Sleep", multi: false, options: ["Sound (7-8 hrs)", "Adequate but Light", "Insufficient (<6 hrs)", "Disturbed/Interrupted", "Insomnia", "Excessive (>9 hrs)"] },
  { key: "appetite", label: "Appetite", multi: false, options: ["Normal", "Low", "Variable", "Sharp"] },
  { key: "diet", label: "Diet Type", multi: false, options: ["Vegetarian", "Eggetarian", "Non-Vegetarian", "Vegan", "Jain Vegetarian"] },
  { key: "eatingOut", label: "Eating Out", multi: false, options: ["Rarely/Never", "One meal a week", "3-4 meals a week", "4+ meals a week"] },
  { key: "addiction", label: "Habits", multi: true, options: ["None", "Tobacco (smoking)", "Tobacco (chewing)", "Vaping", "Alcohol — Occasional", "Alcohol — Regular", "Caffeine (excessive)", "Betel nut/Paan"] },
  { key: "exercise", label: "Exercise", multi: false, options: ["Sedentary: little or no exercise", "Yoga/Pranayama Only", "Exercise 1-3 times/week", "Exercise 4-5 times/week", "Daily exercise or intense exercise 3-4 times/week", "Intense exercise 6-7 times/week", "Very intense exercise daily, or physical job"] },
];

const MENSTRUAL_OPTIONS = ["Regular", "Irregular", "Scanty", "Heavy", "Clotty", "Painful", "Perimenopause", "Menopause", "Hysterectomy", "Pregnant", "Postpartum/Breastfeeding", "Not Started"];
const FAMILY_DISEASES = ["Diabetes", "Thyroid", "Blood Pressure", "Heart Diseases", "Arthritis", "Respiratory Issues", "Cancer"];
const FAMILY_RELATIONS = ["Father", "Mother", "Siblings", "Grandparents"];
const FAMILY_OTHER_KEY = "_other";
const SROTAS_LABELS: Record<string, string> = {
  pranavaha: "Pranavaha", annavaha: "Annavaha", udakavaha: "Udakavaha", rasavaha: "Rasavaha",
  raktavaha: "Raktavaha", mamsavaha: "Mamsavaha", medovaha: "Medovaha", asthivaha: "Asthivaha",
  majjavaha: "Majjavaha", shukravaha: "Shukravaha (male)", artavavaha: "Artavavaha (female)",
  purishavaha: "Purishavaha", mutravaha: "Mutravaha", swedavaha: "Swedavaha", manovaha: "Manovaha",
};

// ── Small field primitives ──

function fieldLabelClass() {
  return "mb-2 block text-[11px] font-extrabold uppercase tracking-widest text-[var(--color-on-surface-variant)]";
}
function selectClass() {
  return "w-full appearance-none bg-[var(--color-surface-container-low)] rounded-2xl py-3 px-4 text-sm font-medium text-[var(--color-on-surface)] form-input-focus transition-all";
}
function inputClass() {
  return "w-full bg-[var(--color-surface-container-low)] rounded-2xl py-3 px-4 text-sm font-medium text-[var(--color-on-surface)] placeholder:text-[var(--color-outline)]/40 form-input-focus transition-all";
}

function SingleSelectField({
  label,
  value,
  options,
  onChange,
  allowOther = false,
}: {
  label: string;
  value: string | null;
  options: string[];
  onChange: (next: string | null) => void;
  allowOther?: boolean;
}) {
  const isCustom = allowOther && value !== null && value !== "" && !options.includes(value);
  return (
    <div>
      <label className={fieldLabelClass()}>{label}</label>
      <select
        value={isCustom ? "__other__" : (value ?? "")}
        onChange={(e) => {
          if (e.target.value === "__other__") onChange("");
          else onChange(e.target.value || null);
        }}
        className={selectClass()}
      >
        <option value="">Not stated</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
        {allowOther && <option value="__other__">Other</option>}
      </select>
      {allowOther && (isCustom || value === "") && (
        <input
          type="text"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Please specify..."
          className={`${inputClass()} mt-2`}
        />
      )}
    </div>
  );
}

function MultiSelectField({
  label,
  value,
  options,
}: {
  label: string;
  value: string[];
  options: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div>
      <label className={fieldLabelClass()}>{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const selected = value.includes(opt);
          return (
            <span
              key={opt}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                selected
                  ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                  : "bg-[var(--color-surface-container-low)] text-[var(--color-on-surface-variant)]"
              }`}
            >
              {opt}
            </span>
          );
        })}
        {value.length === 0 && (
          <span className="text-[11px] text-[var(--color-outline)]">Not stated</span>
        )}
      </div>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  confidence,
  children,
}: {
  icon: string;
  title: string;
  confidence?: number;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="rounded-[2rem] bg-white ring-1 ring-[var(--color-outline-variant)]/20 shadow-lg shadow-[var(--color-primary)]/5">
      <div
        className="flex cursor-pointer select-none items-center gap-4 px-8 py-5 transition-colors hover:bg-[var(--color-surface-container-low)]/50"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <span className="material-symbols-outlined text-lg text-[var(--color-primary)]">{icon}</span>
        <h3 className="text-lg font-extrabold text-[var(--color-on-background)]">{title}</h3>
        {confidence !== undefined && <ConfidenceBadge score={confidence} />}
        <span
          className="material-symbols-outlined ml-auto text-lg text-[var(--color-on-surface-variant)] transition-transform duration-200"
          style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}
        >
          expand_more
        </span>
      </div>
      {expanded && (
        <div className="animate-[fadeIn_0.2s_ease-out] space-y-6 border-t border-[var(--color-outline-variant)]/15 px-8 pb-8 pt-6">
          {children}
        </div>
      )}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className={fieldLabelClass()}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Not mentioned"}
        className={inputClass()}
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: number | null;
  onChange: (next: number | null) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className={fieldLabelClass()}>{label}</label>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        placeholder={placeholder}
        className={inputClass()}
      />
    </div>
  );
}

function getSrotasEntry(draft: ClinicalExtraction, key: SrotasKey): SrotasEntry {
  return draft.srotasPariksha[key] ?? { status: "normal", disturbanceTypes: [], notes: "" };
}

function MedicineRow({
  medicine,
  onChange,
  onRemove,
}: {
  medicine: ExtractedMedicine;
  onChange: (next: ExtractedMedicine) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-3 rounded-2xl bg-[var(--color-surface-container-low)] p-4">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={medicine.medicineName}
          onChange={(e) => onChange({ ...medicine, medicineName: e.target.value })}
          placeholder="Medicine name"
          className="w-full bg-white rounded-xl py-2 px-3 text-sm font-bold text-[var(--color-on-surface)] form-input-focus transition-all"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove medicine"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--color-outline)] transition-all hover:bg-red-50 hover:text-red-600"
        >
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {(["dosageMorning", "dosageAfternoon", "dosageEvening", "dosageNight"] as const).map((field, i) => (
          <div key={field}>
            <span className="mb-1 block text-[9px] font-bold text-[var(--color-on-surface-variant)]">
              {["Morn", "Aft", "Eve", "Night"][i]}
            </span>
            <input
              type="number"
              value={medicine[field] ?? ""}
              onChange={(e) => onChange({ ...medicine, [field]: e.target.value ? Number(e.target.value) : null })}
              className="w-full bg-white rounded-xl py-2 px-2 text-sm text-center text-[var(--color-on-surface)] form-input-focus transition-all"
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="mb-1 block text-[9px] font-bold text-[var(--color-on-surface-variant)]">Unit</span>
          <select
            value={medicine.quantityUnit ?? ""}
            onChange={(e) => onChange({ ...medicine, quantityUnit: (e.target.value || null) as ExtractedMedicine["quantityUnit"] })}
            className="w-full appearance-none bg-white rounded-xl py-2 px-3 text-sm text-[var(--color-on-surface)] form-input-focus transition-all"
          >
            <option value="">—</option>
            {QUANTITY_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <span className="mb-1 block text-[9px] font-bold text-[var(--color-on-surface-variant)]">Duration (days)</span>
          <input
            type="number"
            value={medicine.durationDays ?? ""}
            onChange={(e) => onChange({ ...medicine, durationDays: e.target.value ? Number(e.target.value) : null })}
            className="w-full bg-white rounded-xl py-2 px-3 text-sm text-[var(--color-on-surface)] form-input-focus transition-all"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="mb-1 block text-[9px] font-bold text-[var(--color-on-surface-variant)]">Anupana</span>
          <input
            type="text"
            list="anupana-presets"
            value={medicine.anupana ?? ""}
            onChange={(e) => onChange({ ...medicine, anupana: e.target.value || null })}
            className="w-full bg-white rounded-xl py-2 px-3 text-sm text-[var(--color-on-surface)] form-input-focus transition-all"
          />
          <datalist id="anupana-presets">
            {ANUPANA_PRESETS.map((a) => <option key={a} value={a} />)}
          </datalist>
        </div>
        <div>
          <span className="mb-1 block text-[9px] font-bold text-[var(--color-on-surface-variant)]">Timing</span>
          <input
            type="text"
            list="timing-presets"
            value={medicine.timing ?? ""}
            onChange={(e) => onChange({ ...medicine, timing: e.target.value || null })}
            className="w-full bg-white rounded-xl py-2 px-3 text-sm text-[var(--color-on-surface)] form-input-focus transition-all"
          />
          <datalist id="timing-presets">
            {TIMING_PRESETS.map((t) => <option key={t} value={t} />)}
          </datalist>
        </div>
      </div>

      <input
        type="text"
        value={medicine.instructions ?? ""}
        onChange={(e) => onChange({ ...medicine, instructions: e.target.value || null })}
        placeholder="Additional instructions"
        className="w-full bg-white rounded-xl py-2 px-3 text-sm text-[var(--color-on-surface)] placeholder:text-[var(--color-outline)]/40 form-input-focus transition-all"
      />
    </div>
  );
}

function TreatmentRow({
  treatment,
  onChange,
  onRemove,
}: {
  treatment: ExtractedTreatment;
  onChange: (next: ExtractedTreatment) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-3 rounded-2xl bg-[var(--color-surface-container-low)] p-4">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={treatment.treatmentName}
          onChange={(e) => onChange({ ...treatment, treatmentName: e.target.value })}
          placeholder="Treatment name"
          className="w-full bg-white rounded-xl py-2 px-3 text-sm font-bold text-[var(--color-on-surface)] form-input-focus transition-all"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove treatment"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--color-outline)] transition-all hover:bg-red-50 hover:text-red-600"
        >
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <span className="mb-1 block text-[9px] font-bold text-[var(--color-on-surface-variant)]">Sessions</span>
          <input type="number" value={treatment.sessions ?? ""} onChange={(e) => onChange({ ...treatment, sessions: e.target.value ? Number(e.target.value) : null })} className="w-full bg-white rounded-xl py-2 px-3 text-sm text-[var(--color-on-surface)] form-input-focus transition-all" />
        </div>
        <div>
          <span className="mb-1 block text-[9px] font-bold text-[var(--color-on-surface-variant)]">Duration (mins)</span>
          <input type="number" value={treatment.sessionDurationMinutes ?? ""} onChange={(e) => onChange({ ...treatment, sessionDurationMinutes: e.target.value ? Number(e.target.value) : null })} className="w-full bg-white rounded-xl py-2 px-3 text-sm text-[var(--color-on-surface)] form-input-focus transition-all" />
        </div>
        <div>
          <span className="mb-1 block text-[9px] font-bold text-[var(--color-on-surface-variant)]">Duration (days)</span>
          <input type="number" value={treatment.durationDays ?? ""} onChange={(e) => onChange({ ...treatment, durationDays: e.target.value ? Number(e.target.value) : null })} className="w-full bg-white rounded-xl py-2 px-3 text-sm text-[var(--color-on-surface)] form-input-focus transition-all" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <span className="mb-1 block text-[9px] font-bold text-[var(--color-on-surface-variant)]">Oil name</span>
          <input type="text" value={treatment.oilName ?? ""} onChange={(e) => onChange({ ...treatment, oilName: e.target.value || null })} className="w-full bg-white rounded-xl py-2 px-3 text-sm text-[var(--color-on-surface)] form-input-focus transition-all" />
        </div>
        <div>
          <span className="mb-1 block text-[9px] font-bold text-[var(--color-on-surface-variant)]">Oil qty (ml)</span>
          <input type="number" value={treatment.oilQuantityMl ?? ""} onChange={(e) => onChange({ ...treatment, oilQuantityMl: e.target.value ? Number(e.target.value) : null })} className="w-full bg-white rounded-xl py-2 px-3 text-sm text-[var(--color-on-surface)] form-input-focus transition-all" />
        </div>
        <div>
          <span className="mb-1 block text-[9px] font-bold text-[var(--color-on-surface-variant)]">Oil temp (°F)</span>
          <input type="number" value={treatment.oilTempF ?? ""} onChange={(e) => onChange({ ...treatment, oilTempF: e.target.value ? Number(e.target.value) : null })} className="w-full bg-white rounded-xl py-2 px-3 text-sm text-[var(--color-on-surface)] form-input-focus transition-all" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <span className="mb-1 block text-[9px] font-bold text-[var(--color-on-surface-variant)]">Stroke direction</span>
          <select value={treatment.strokeDirection ?? ""} onChange={(e) => onChange({ ...treatment, strokeDirection: (e.target.value || null) as StrokeDirection | null })} className="w-full appearance-none bg-white rounded-xl py-2 px-3 text-sm text-[var(--color-on-surface)] form-input-focus transition-all">
            <option value="">—</option>
            {STROKE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <span className="mb-1 block text-[9px] font-bold text-[var(--color-on-surface-variant)]">Body part</span>
          <input type="text" value={treatment.bodyPart ?? ""} onChange={(e) => onChange({ ...treatment, bodyPart: e.target.value || null })} className="w-full bg-white rounded-xl py-2 px-3 text-sm text-[var(--color-on-surface)] form-input-focus transition-all" />
        </div>
        <div>
          <span className="mb-1 block text-[9px] font-bold text-[var(--color-on-surface-variant)]">Pressure</span>
          <select value={treatment.pressure ?? ""} onChange={(e) => onChange({ ...treatment, pressure: (e.target.value || null) as Pressure | null })} className="w-full appearance-none bg-white rounded-xl py-2 px-3 text-sm text-[var(--color-on-surface)] form-input-focus transition-all">
            <option value="">—</option>
            {PRESSURE_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <input
        type="text"
        value={treatment.specialFocus ?? ""}
        onChange={(e) => onChange({ ...treatment, specialFocus: e.target.value || null })}
        placeholder="Special focus notes"
        className="w-full bg-white rounded-xl py-2 px-3 text-sm text-[var(--color-on-surface)] placeholder:text-[var(--color-outline)]/40 form-input-focus transition-all"
      />
    </div>
  );
}

/**
 * The AI draft review screen, rebuilt against the REAL clinical form
 * fields (verified against the CMS's own source — see
 * docs/modules/clinical-extraction-schema.md), not architecture.md
 * §11's original generic placeholder. Every field here is
 * AI-suggested until accepted (CLAUDE.md's "no silent AI authority"
 * rule) — the status badge and per-section confidence badges keep
 * that visible throughout.
 */
export function ReviewDraftPanel({
  result,
  draft,
  isPolling,
  isSaving,
  error,
  onChange,
  onAccept,
  onDiscard,
}: ReviewDraftPanelProps) {
  if (error) {
    return (
      <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] font-semibold text-red-600">
        {error}
      </p>
    );
  }

  if (!result || !draft) {
    if (!isPolling) return null;
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-outline-variant)]/40 bg-[var(--color-surface-container-low)] px-5 py-4">
        <span className="material-symbols-outlined text-lg text-[var(--color-primary)]">
          hourglass_empty
        </span>
        <p className="text-sm font-medium text-[var(--color-on-surface-variant)]">
          Extracting clinical data…
        </p>
      </div>
    );
  }

  const isFinalized = result.status === "accepted" || result.status === "discarded";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 rounded-2xl bg-[var(--color-surface-container-low)] px-6 py-4">
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_CLASSES[result.status]}`}>
          {STATUS_LABELS[result.status]}
        </span>
        <ConfidenceBadge score={draft.aiConfidence.overall} />
        {isSaving && (
          <span className="ml-auto text-[11px] font-medium text-[var(--color-on-surface-variant)]">
            Saving…
          </span>
        )}
      </div>

      <RiskFlagBanner riskFlags={draft.riskFlags} />

      {/* ── Case Sheet ── */}
      <SectionCard icon="summarize" title="Case Sheet" confidence={draft.aiConfidence.perField.complaints}>
        <StringListEditor
          label="Complaints"
          items={draft.complaints}
          onChange={(complaints) => onChange({ ...draft, complaints })}
        />
        <StringListEditor
          label="Past / ongoing treatments"
          items={draft.treatmentHistory}
          onChange={(treatmentHistory) => onChange({ ...draft, treatmentHistory })}
        />

        <div className="grid grid-cols-2 gap-4">
          {PERSONAL_HISTORY_FIELDS.map(({ key, label, multi, options }) =>
            multi ? (
              <MultiSelectField
                key={key}
                label={label}
                value={draft.personalHistory[key]}
                options={options}
                onChange={(v) => onChange({ ...draft, personalHistory: { ...draft.personalHistory, [key]: v } })}
              />
            ) : (
              <SingleSelectField
                key={key}
                label={label}
                value={draft.personalHistory[key][0] ?? null}
                options={options}
                onChange={(v) =>
                  onChange({ ...draft, personalHistory: { ...draft.personalHistory, [key]: v ? [v] : [] } })
                }
              />
            ),
          )}
        </div>

        <div>
          <label className={fieldLabelClass()}>Family History</label>
          <div className="overflow-x-auto rounded-2xl bg-[var(--color-surface-container-low)] p-3">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="pb-2 pr-3 text-[10px] font-extrabold uppercase tracking-widest text-[var(--color-on-surface-variant)]">Disease</th>
                  {FAMILY_RELATIONS.map((r) => (
                    <th key={r} className="pb-2 px-2 text-center text-[10px] font-extrabold uppercase tracking-widest text-[var(--color-on-surface-variant)]">{r}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FAMILY_DISEASES.map((disease) => {
                  const relations = draft.familyHistory?.[disease] ?? [];
                  return (
                    <tr key={disease}>
                      <td className="py-1.5 pr-3 font-medium text-[var(--color-on-surface)]">{disease}</td>
                      {FAMILY_RELATIONS.map((relation) => {
                        const checked = relations.includes(relation);
                        return (
                          <td key={relation} className="py-1.5 px-2 text-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                const current = { ...(draft.familyHistory ?? {}) };
                                const next = checked
                                  ? relations.filter((r) => r !== relation)
                                  : [...relations, relation];
                                if (next.length === 0) delete current[disease];
                                else current[disease] = next;
                                onChange({ ...draft, familyHistory: Object.keys(current).length > 0 ? current : null });
                              }}
                              className="accent-[var(--color-primary)] w-4 h-4"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <input
            type="text"
            value={draft.familyHistory?.[FAMILY_OTHER_KEY]?.[0] ?? ""}
            onChange={(e) => {
              const current = { ...(draft.familyHistory ?? {}) };
              if (e.target.value.trim()) current[FAMILY_OTHER_KEY] = [e.target.value];
              else delete current[FAMILY_OTHER_KEY];
              onChange({ ...draft, familyHistory: Object.keys(current).length > 0 ? current : null });
            }}
            placeholder="Any other family condition mentioned..."
            className={`${inputClass()} mt-2`}
          />
        </div>

        {draft.gynec && (
          <div className="space-y-4 rounded-2xl bg-[var(--color-surface-container-low)]/60 p-4">
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-[var(--color-on-surface-variant)]">
              Gynecological Information
            </p>
            <MultiSelectField
              label="Menstrual state"
              value={draft.gynec.menstrualHistory}
              options={MENSTRUAL_OPTIONS}
              onChange={(v) => onChange({ ...draft, gynec: { ...draft.gynec!, menstrualHistory: v } })}
            />
            <div className="grid grid-cols-2 gap-4">
              <NumberField
                label="Days of flow"
                value={draft.gynec.daysOfFlow}
                onChange={(v) => onChange({ ...draft, gynec: { ...draft.gynec!, daysOfFlow: v } })}
              />
              <TextField
                label="Last menstrual date"
                value={draft.gynec.lastMenstrualDate ?? ""}
                onChange={(v) => onChange({ ...draft, gynec: { ...draft.gynec!, lastMenstrualDate: v || null } })}
                placeholder="YYYY-MM-DD"
              />
            </div>
            <TextField
              label="Details"
              value={draft.gynec.details ?? ""}
              onChange={(v) => onChange({ ...draft, gynec: { ...draft.gynec!, details: v || null } })}
            />
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className={fieldLabelClass()}>BP (mmHg)</label>
            <div className="flex items-center gap-2">
              <input type="number" value={draft.vitals.bpSystolic ?? ""} onChange={(e) => onChange({ ...draft, vitals: { ...draft.vitals, bpSystolic: e.target.value ? Number(e.target.value) : null } })} placeholder="sys" className="w-full bg-[var(--color-surface-container-low)] rounded-xl py-2 px-2 text-sm text-center text-[var(--color-on-surface)] form-input-focus transition-all" />
              <span className="text-[var(--color-outline)]">/</span>
              <input type="number" value={draft.vitals.bpDiastolic ?? ""} onChange={(e) => onChange({ ...draft, vitals: { ...draft.vitals, bpDiastolic: e.target.value ? Number(e.target.value) : null } })} placeholder="dia" className="w-full bg-[var(--color-surface-container-low)] rounded-xl py-2 px-2 text-sm text-center text-[var(--color-on-surface)] form-input-focus transition-all" />
            </div>
          </div>
          <SingleSelectField
            label="BP position"
            value={draft.vitals.bpPosition}
            options={BP_POSITIONS}
            onChange={(v) => onChange({ ...draft, vitals: { ...draft.vitals, bpPosition: v as BpPosition | null } })}
          />
          <NumberField label="Pulse (bpm)" value={draft.vitals.pulse} onChange={(v) => onChange({ ...draft, vitals: { ...draft.vitals, pulse: v } })} />
          <NumberField label="Temperature (°F)" value={draft.vitals.temperatureF} onChange={(v) => onChange({ ...draft, vitals: { ...draft.vitals, temperatureF: v } })} />
        </div>
      </SectionCard>

      {/* ── Detailed Assessment ── */}
      <SectionCard icon="clinical_notes" title="Detailed Assessment" confidence={draft.aiConfidence.perField.ashtavidhaPariksha}>
        <p className="text-[11px] text-[var(--color-outline)]">
          Physical-examination findings — only populated if the doctor stated them aloud, never inferred from symptoms.
        </p>
        <div className="grid grid-cols-2 gap-4">
          {ASHTAVIDHA_FIELDS.map(({ key, label, subtitle, options }) => (
            <SingleSelectField
              key={key}
              label={`${label} (${subtitle})`}
              value={draft.ashtavidhaPariksha[key]}
              options={options}
              allowOther
              onChange={(v) => onChange({ ...draft, ashtavidhaPariksha: { ...draft.ashtavidhaPariksha, [key]: v } })}
            />
          ))}
        </div>

        <div>
          <label className={fieldLabelClass()}>Srotas Pariksha</label>
          <div className="space-y-2">
            {SROTAS_KEYS.map((key) => {
              const entry = getSrotasEntry(draft, key);
              const disturbed = entry.status === "disturbed";
              return (
                <div key={key} className="rounded-2xl bg-[var(--color-surface-container-low)] p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="w-36 text-sm font-bold text-[var(--color-on-surface)]">{SROTAS_LABELS[key]}</span>
                    <div className="flex overflow-hidden rounded-lg border border-[var(--color-outline-variant)]/30">
                      {(["normal", "disturbed"] as const).map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() =>
                            onChange({
                              ...draft,
                              srotasPariksha: { ...draft.srotasPariksha, [key]: { ...entry, status, disturbanceTypes: status === "normal" ? [] : entry.disturbanceTypes, notes: status === "normal" ? "" : entry.notes } },
                            })
                          }
                          className={`px-3 py-1.5 text-xs font-bold transition-all ${
                            entry.status === status
                              ? status === "disturbed" ? "bg-amber-600 text-white" : "bg-emerald-600 text-white"
                              : "bg-white text-[var(--color-on-surface-variant)]"
                          }`}
                        >
                          {status === "normal" ? "Normal" : "Disturbed"}
                        </button>
                      ))}
                    </div>
                  </div>
                  {disturbed && (
                    <div className="mt-2 space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {SROTAS_DISTURBANCE_TYPES.map((type) => {
                          const selected = entry.disturbanceTypes.includes(type);
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => {
                                const next = selected
                                  ? entry.disturbanceTypes.filter((t) => t !== type)
                                  : [...entry.disturbanceTypes, type];
                                onChange({ ...draft, srotasPariksha: { ...draft.srotasPariksha, [key]: { ...entry, disturbanceTypes: next } } });
                              }}
                              className={`rounded-xl px-3 py-1 text-xs font-bold border transition-all ${
                                selected ? "bg-amber-600 text-white border-amber-600" : "bg-white text-[var(--color-on-surface-variant)] border-[var(--color-outline-variant)]/40"
                              }`}
                            >
                              {type}
                            </button>
                          );
                        })}
                      </div>
                      <input
                        type="text"
                        value={entry.notes}
                        onChange={(e) => onChange({ ...draft, srotasPariksha: { ...draft.srotasPariksha, [key]: { ...entry, notes: e.target.value } } })}
                        placeholder="Notes..."
                        className="w-full bg-white rounded-xl py-2 px-3 text-sm text-[var(--color-on-surface)] form-input-focus transition-all"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <SingleSelectField label="Prakrithi" value={draft.prakrithi} options={DOSHA_OPTIONS} onChange={(v) => onChange({ ...draft, prakrithi: v })} />
          <SingleSelectField label="Vikruta Dosha" value={draft.dosha} options={DOSHA_OPTIONS} onChange={(v) => onChange({ ...draft, dosha: v })} />
          <SingleSelectField label="Agni" value={draft.agni} options={AGNI_OPTIONS} onChange={(v) => onChange({ ...draft, agni: v })} />
          <SingleSelectField label="Ojas" value={draft.ojas} options={OJAS_OPTIONS} onChange={(v) => onChange({ ...draft, ojas: v })} />
        </div>

        <div>
          <label className={fieldLabelClass()}>Ama</label>
          <div className="flex gap-2">
            {(["0", "1", "2", "3"] as const).map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => onChange({ ...draft, aama: num })}
                className={`h-10 w-10 rounded-xl text-sm font-bold border transition-all ${
                  draft.aama === num ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]" : "bg-[var(--color-surface-container-low)] text-[var(--color-on-surface-variant)] border-transparent"
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        <TextField label="Vyādhi" value={draft.vyaadhi ?? ""} onChange={(v) => onChange({ ...draft, vyaadhi: v || null })} placeholder="Condition / disease" />
        <TextField
          label="Diagnosis (only if explicitly stated by the doctor — shared with patient)"
          value={draft.modernDiagnosis ?? ""}
          onChange={(v) => onChange({ ...draft, modernDiagnosis: v || null })}
          placeholder="Not stated — never inferred"
        />
        <div>
          <label className={fieldLabelClass()}>Clinical Notes (private, never shown to patient)</label>
          <textarea
            value={draft.clinicalNotes}
            onChange={(e) => onChange({ ...draft, clinicalNotes: e.target.value })}
            rows={3}
            className={`${inputClass()} resize-none`}
          />
        </div>
      </SectionCard>

      {/* ── Prescription ── */}
      <SectionCard icon="medication" title="Medicines" confidence={draft.aiConfidence.perField.medicines}>
        {draft.medicines.map((medicine, index) => (
          <MedicineRow
            key={index}
            medicine={medicine}
            onChange={(next) => {
              const list = [...draft.medicines];
              list[index] = next;
              onChange({ ...draft, medicines: list });
            }}
            onRemove={() => onChange({ ...draft, medicines: draft.medicines.filter((_, i) => i !== index) })}
          />
        ))}
        <button
          type="button"
          onClick={() =>
            onChange({
              ...draft,
              medicines: [
                ...draft.medicines,
                { medicineName: "", quantityUnit: null, dosageMorning: null, dosageAfternoon: null, dosageEvening: null, dosageNight: null, anupana: null, timing: null, durationDays: null, instructions: null, matchConfidence: null },
              ],
            })
          }
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-[11px] font-bold text-[var(--color-primary)] transition-all hover:bg-[var(--color-primary)]/5"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Add medicine
        </button>
      </SectionCard>

      <SectionCard icon="healing" title="Treatments">
        {draft.treatments.map((treatment, index) => (
          <TreatmentRow
            key={index}
            treatment={treatment}
            onChange={(next) => {
              const list = [...draft.treatments];
              list[index] = next;
              onChange({ ...draft, treatments: list });
            }}
            onRemove={() => onChange({ ...draft, treatments: draft.treatments.filter((_, i) => i !== index) })}
          />
        ))}
        <button
          type="button"
          onClick={() =>
            onChange({
              ...draft,
              treatments: [
                ...draft.treatments,
                { treatmentName: "", sessions: null, sessionDurationMinutes: null, durationDays: null, oilName: null, oilQuantityMl: null, oilTempF: null, strokeDirection: null, bodyPart: null, pressure: null, specialFocus: null },
              ],
            })
          }
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-[11px] font-bold text-[var(--color-primary)] transition-all hover:bg-[var(--color-primary)]/5"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Add treatment
        </button>
      </SectionCard>

      <SectionCard icon="labs" title="Lab Tests & Diet & Lifestyle">
        <StringListEditor label="Lab tests / scans" items={draft.labTests} onChange={(labTests) => onChange({ ...draft, labTests })} />
        <div className="grid grid-cols-2 gap-4">
          <StringListEditor label="Diet — what to eat" items={draft.dietEat} onChange={(dietEat) => onChange({ ...draft, dietEat })} />
          <StringListEditor label="Diet — what to avoid" items={draft.dietAvoid} onChange={(dietAvoid) => onChange({ ...draft, dietAvoid })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <StringListEditor label="Lifestyle — what to maintain" items={draft.lifestyleMaintain} onChange={(lifestyleMaintain) => onChange({ ...draft, lifestyleMaintain })} />
          <StringListEditor label="Lifestyle — what to avoid" items={draft.lifestyleAvoid} onChange={(lifestyleAvoid) => onChange({ ...draft, lifestyleAvoid })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <NumberField label="Follow-up in" value={draft.followUpValue} onChange={(v) => onChange({ ...draft, followUpValue: v })} />
          <div>
            <label className={fieldLabelClass()}>Unit</label>
            <select
              value={draft.followUpUnit ?? ""}
              onChange={(e) => onChange({ ...draft, followUpUnit: (e.target.value || null) as FollowUpUnit | null })}
              className={selectClass()}
            >
              <option value="">—</option>
              {FOLLOWUP_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
      </SectionCard>

      {!isFinalized && (
        <div className="flex items-center justify-end gap-3 border-t border-[var(--color-outline-variant)]/20 pt-8">
          <button
            type="button"
            onClick={onDiscard}
            className="px-8 py-4 text-sm font-bold text-[var(--color-on-surface-variant)] transition-all hover:bg-[var(--color-surface-container-low)] rounded-2xl"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="flex items-center gap-3 rounded-2xl bg-[var(--color-primary)] px-10 py-4 text-sm font-extrabold text-[var(--color-on-primary)] shadow-lg shadow-[var(--color-primary)]/30 transition-all hover:bg-[var(--color-primary-hover)] hover:shadow-xl active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-sm">check_circle</span>
            Accept & save to CMS
          </button>
        </div>
      )}

      {result.status === "accepted" && (
        <p className="text-sm font-semibold text-emerald-700">
          Accepted — prescription ref: {result.acceptedCmsPrescriptionRef}
        </p>
      )}
    </div>
  );
}
