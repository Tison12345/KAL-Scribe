"use client";

import { useState } from "react";
import type {
  ClinicalExtraction,
  ReviewDraft,
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
import { ChipListEditor } from "./ChipListEditor";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { RiskFlagBanner } from "./RiskFlagBanner";
import { StringListEditor } from "./StringListEditor";

export interface ReviewDraftPanelProps {
  result: ReviewDraft | null;
  draft: ClinicalExtraction | null;
  isPolling: boolean;
  isSaving: boolean;
  error: string | null;
  onChange: (next: ClinicalExtraction) => void;
  onAccept: () => void;
  onDiscard: () => void;
}

const STATUS_LABELS: Record<ReviewDraft["status"], string> = {
  draft: "AI draft — not yet reviewed",
  edited: "Edited by doctor",
  accepted: "Accepted",
  discarded: "Discarded",
};

const STATUS_CLASSES: Record<ReviewDraft["status"], string> = {
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
const QUANTITY_UNITS: QuantityUnit[] = ["mL", "gm", "tabs", "tspn", "Patch"];
const ANUPANA_PRESETS = ["Warm Water", "Plain Water", "Jeera Water (Warm)", "Ghee", "Milk", "Honey"];
const TIMING_PRESETS = ["Before Meals", "With Meals", "After Meals", "Early Morning", "Bedtime"];
const STROKE_OPTIONS: { value: StrokeDirection; label: string }[] = [
  { value: "anuloma", label: "Anuloma (With the hair)" },
  { value: "pratiloma", label: "Pratiloma (Against the hair)" },
];
const PRESSURE_OPTIONS: { value: Pressure; label: string }[] = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];
const OIL_TEMP_OPTIONS = ["Mrudu Ushna", "Sukoshna", "Ushnathara"];

const ASHTAVIDHA_FIELDS: { key: keyof ClinicalExtraction["ashtavidhaPariksha"]; label: string; subtitle: string; options: string[] }[] = [
  { key: "nadi", label: "Nadi", subtitle: "Pulse", options: DOSHA_OPTIONS },
  { key: "mutra", label: "Mutra", subtitle: "Urine", options: ["Prakritam (Normal)", "Vikritam (Abnormal)"] },
  { key: "mala", label: "Mala", subtitle: "Stool", options: ["Prakritam (Normal)", "Vikritam (Abnormal)"] },
  { key: "jivha", label: "Jivha", subtitle: "Tongue", options: ["Prakritam - Nirlipta (Non Coated)", "Vikritam - Lipta (Coated)", "Vikritam - Sputana (Cracked)"] },
  { key: "shabda", label: "Shabda", subtitle: "Speech", options: ["Prakritam (Normal)", "Vikritam - Vishama (Irregular)", "Vikritam - Durbala (Weak)"] },
  { key: "sparsha", label: "Sparsha", subtitle: "Skin", options: ["Ushna (Hot)", "Sheeta (Cold)", "Ruksha (Dry)", "Snigdha (Oily)"] },
  { key: "drik", label: "Drik", subtitle: "Eyes", options: ["Prakritam (Normal)", "Vikritam (Abnormal)"] },
  { key: "akruti", label: "Akruti", subtitle: "Structure & Stature", options: ["Prakritam (Normal)", "Vikritam (Abnormal)"] },
];

const PERSONAL_HISTORY_FIELDS: { key: keyof ClinicalExtraction["personalHistory"]; label: string; multi: boolean; options: string[] }[] = [
  { key: "bowel", label: "Bowel", multi: true, options: ["Less than 3x/week (Infrequent)", "Ranges between 3x/week to 3x/day (Regular)", "More than 3x/day (Frequent)", "Normal Formed", "Hard/Constipated", "Soft/Loose", "Mucus present", "Blood present"] },
  { key: "bladder", label: "Urination", multi: true, options: ["Normal (4–6×/day)", "Frequent (7+/day)", "Reduced [Quantity]", "Burning", "Painful", "Nocturnal"] },
  { key: "sleep", label: "Sleep", multi: false, options: ["Sound (7-8 hrs)", "Adequate but Light", "Insufficient (<6 hrs)", "Disturbed/Interrupted", "Insomnia", "Excessive (>9 hrs)"] },
  { key: "appetite", label: "Appetite", multi: false, options: ["Normal", "Low", "Variable", "Sharp"] },
  { key: "diet", label: "Diet Type", multi: false, options: ["Vegetarian", "Eggetarian", "Non-Vegetarian", "Vegan", "Jain Vegetarian"] },
  { key: "eatingOut", label: "Eating Out", multi: false, options: ["Rarely/Never", "One meal a week", "3-4 meals a week", "4+ meals a week"] },
  { key: "addiction", label: "Habits", multi: true, options: ["None", "Tobacco (smoking)", "Tobacco (chewing)", "Vaping", "Alcohol — Occasional", "Alcohol — Regular", "Caffeine (excessive)", "Betel nut/Paan"] },
  { key: "exercise", label: "Exercise", multi: false, options: ["Sedentary: little or no exercise", "Exercise 1-3 times/week", "Exercise 4-5 times/week", "Daily exercise or intense exercise 3-4 times/week", "Intense exercise 6-7 times/week", "Very intense exercise daily, or physical job"] },
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

const EMPTY_MEDICINE: ExtractedMedicine = {
  medicineName: "", quantityUnit: null, dosageMorning: null, dosageAfternoon: null,
  dosageEvening: null, dosageNight: null, anupana: null, timing: null,
  durationDays: null, instructions: null, matchConfidence: null,
};
const EMPTY_TREATMENT: ExtractedTreatment = {
  treatmentName: "", sessions: null, sessionDurationMinutes: null, durationDays: null,
  oilName: null, oilQuantityMl: null, oilTempF: null, strokeDirection: null,
  bodyPart: null, pressure: null, specialFocus: null,
};

// ── Layout primitives (mirrors KAL-clinic-management-solution's
// Prescription tab exactly — PrescriptionPanelCard.tsx, the section
// `<h3>` pattern, and the collapsible medicine/treatment row — one
// continuous panel, not per-section accordion cards) ──

function PanelCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[2.5rem] bg-white p-1.5 shadow-xl shadow-[var(--color-primary)]/5 ring-1 ring-[var(--color-outline-variant)]/20">
      <div className="rounded-[2.3rem] bg-[var(--color-surface-container-lowest)] px-10 py-8">
        {children}
      </div>
    </div>
  );
}

/** Titled card wrapper — same shell as PanelCard, but with the real
 * CMS's Examination/Patient-Intake `<h2>` title pattern (Prescription's
 * tab is the one bare-shell exception, per its own component). */
function SectionCard({
  title,
  confidence,
  children,
}: {
  title: string;
  confidence?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[2.5rem] bg-white p-1.5 shadow-xl shadow-[var(--color-primary)]/5 ring-1 ring-[var(--color-outline-variant)]/20">
      <div className="rounded-[2.3rem] bg-[var(--color-surface-container-lowest)] px-10 py-8">
        <div className="mb-6 flex items-center gap-3">
          <h2 className="text-base font-extrabold uppercase tracking-wider text-[var(--color-on-background)]">
            {title}
          </h2>
          {confidence !== undefined && <ConfidenceBadge score={confidence} />}
        </div>
        <div className="space-y-8">{children}</div>
      </div>
    </div>
  );
}

type TabId = "intake" | "examination" | "prescription";
const TABS: { id: TabId; label: string }[] = [
  { id: "intake", label: "Patient Intake" },
  { id: "examination", label: "Examination" },
  { id: "prescription", label: "Prescription" },
];

function SectionDivider() {
  return <div className="border-t border-[var(--color-outline-variant)]/20" />;
}

function SectionHeader({ title, confidence }: { title: string; confidence?: number }) {
  return (
    <div className="flex items-center gap-3">
      <h3 className="text-sm font-extrabold uppercase tracking-widest text-[var(--color-on-background)]">
        {title}
      </h3>
      {confidence !== undefined && <ConfidenceBadge score={confidence} />}
    </div>
  );
}

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
function subLabelClass() {
  return "mb-1.5 block text-[10px] font-extrabold uppercase tracking-widest text-[var(--color-on-surface-variant)]";
}
function inputFieldClass() {
  return "w-full rounded-2xl border border-transparent bg-[var(--color-surface-container-low)] px-4 py-2.5 text-sm font-medium text-[var(--color-on-surface)] placeholder:text-[var(--color-outline)]/40 outline-none transition-all focus:ring-2 focus:ring-[var(--color-primary)]/20";
}

/** Select with the real CMS's manually-positioned chevron (native
 * `appearance-none` + an overlaid Material Symbol) plus the
 * select-"Other"-to-reveal-free-text pattern used throughout its
 * Prescription tab (Anupana, Timing, Oil Temperature, ...). */
function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = "—",
  allowOther = false,
}: {
  label?: string;
  value: string | null;
  onChange: (next: string | null) => void;
  options: string[];
  placeholder?: string;
  allowOther?: boolean;
}) {
  const v = value ?? "";
  const isOther = allowOther && v !== "" && !options.includes(v);
  return (
    <div>
      {label && <span className={subLabelClass()}>{label}</span>}
      <div className="relative">
        <select
          value={isOther ? "__other__" : v}
          onChange={(e) => onChange(e.target.value === "__other__" ? "" : (e.target.value || null))}
          className="w-full cursor-pointer appearance-none rounded-2xl border border-transparent bg-[var(--color-surface-container-low)] py-2.5 pl-4 pr-9 text-sm font-medium text-[var(--color-on-surface)] outline-none transition-all focus:ring-2 focus:ring-[var(--color-primary)]/20"
        >
          <option value="">{placeholder}</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
          {allowOther && <option value="__other__">Other</option>}
        </select>
        <span className="material-symbols-outlined pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-lg text-[var(--color-outline)]">
          expand_more
        </span>
      </div>
      {allowOther && isOther && (
        <input
          type="text"
          value={v}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Please specify..."
          className={`${inputFieldClass()} mt-2`}
        />
      )}
    </div>
  );
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

// ── Medicines (collapsible-row-in-place, matching the real CMS) ──

function MedicineListItem({
  medicine,
  expanded,
  onToggle,
  onChange,
  onRemove,
}: {
  medicine: ExtractedMedicine;
  expanded: boolean;
  onToggle: () => void;
  onChange: (next: ExtractedMedicine) => void;
  onRemove: () => void;
}) {
  const summary = [medicine.quantityUnit, medicine.timing, medicine.durationDays ? `${medicine.durationDays} day(s)` : null]
    .filter(Boolean)
    .join(" · ");

  if (!expanded) {
    return (
      <div className="overflow-hidden rounded-2xl bg-[var(--color-surface-container-lowest)] ring-1 ring-[var(--color-outline-variant)]/10">
        <div
          className="flex cursor-pointer items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--color-surface-container-low)]/50"
          onClick={onToggle}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[var(--color-on-surface)]">
              {medicine.medicineName || "Untitled medicine"}
            </p>
            {summary && <p className="mt-0.5 truncate text-xs text-[var(--color-on-surface-variant)]">{summary}</p>}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              aria-label="Edit medicine"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-on-surface-variant)] transition-colors hover:bg-[var(--color-surface-container-low)]"
            >
              <span className="material-symbols-outlined text-lg">edit</span>
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              aria-label="Delete medicine"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-outline)] transition-colors hover:bg-red-50 hover:text-red-500"
            >
              <span className="material-symbols-outlined text-lg">delete</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-[var(--color-surface-container-lowest)] ring-1 ring-[var(--color-outline-variant)]/10">
      <div className="space-y-5 p-5">
        <div>
          <span className={subLabelClass()}>Medicine</span>
          <input
            type="text"
            value={medicine.medicineName}
            onChange={(e) => onChange({ ...medicine, medicineName: e.target.value })}
            placeholder="Medicine name"
            className={inputFieldClass()}
          />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {(["dosageMorning", "dosageAfternoon", "dosageEvening", "dosageNight"] as const).map((field, i) => (
            <div key={field} className="flex items-end gap-3">
              {i > 0 && <span className="mb-4 text-xs font-bold text-[var(--color-outline)]">-</span>}
              <div>
                <input
                  type="number"
                  value={medicine[field] ?? ""}
                  onChange={(e) => onChange({ ...medicine, [field]: e.target.value ? Number(e.target.value) : null })}
                  className="w-12 rounded-xl border border-transparent bg-[var(--color-surface-container-low)] px-1.5 py-2.5 text-center text-sm font-medium text-[var(--color-on-surface)] outline-none transition-all focus:ring-2 focus:ring-[var(--color-primary)]/20 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <p className="mt-0.5 text-[9px] font-semibold text-[var(--color-outline)]">
                  {["Morn", "Aft", "Eve", "Night"][i]}
                </p>
              </div>
            </div>
          ))}
          <div className="min-w-[100px] flex-1">
            <SelectField
              label="Unit"
              value={medicine.quantityUnit}
              onChange={(v) => onChange({ ...medicine, quantityUnit: v as QuantityUnit | null })}
              options={QUANTITY_UNITS}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="When to Take"
            value={medicine.timing}
            onChange={(v) => onChange({ ...medicine, timing: v })}
            options={TIMING_PRESETS}
            allowOther
          />
          <SelectField
            label="Anupana"
            value={medicine.anupana}
            onChange={(v) => onChange({ ...medicine, anupana: v })}
            options={ANUPANA_PRESETS}
            allowOther
          />
        </div>

        <div>
          <span className={subLabelClass()}>No. of Days</span>
          <input
            type="number"
            value={medicine.durationDays ?? ""}
            onChange={(e) => onChange({ ...medicine, durationDays: e.target.value ? Number(e.target.value) : null })}
            placeholder="days"
            className={inputFieldClass()}
          />
        </div>

        <div>
          <span className={subLabelClass()}>Additional Instructions</span>
          <textarea
            value={medicine.instructions ?? ""}
            onChange={(e) => onChange({ ...medicine, instructions: e.target.value || null })}
            rows={2}
            className={`${inputFieldClass()} resize-none`}
          />
        </div>

        <div className="flex items-center justify-between border-t border-[var(--color-outline-variant)]/10 pt-2">
          <button
            type="button"
            onClick={onRemove}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-[var(--color-outline)] transition-colors hover:bg-red-50 hover:text-red-500"
          >
            <span className="material-symbols-outlined text-base">delete</span>
            Remove
          </button>
          <button
            type="button"
            onClick={onToggle}
            aria-label="Done editing medicine"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-white shadow-sm transition-all hover:bg-[var(--color-primary-hover)] active:scale-[0.95]"
          >
            <span className="material-symbols-outlined text-lg">add</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function MedicinesSection({
  medicines,
  confidence,
  onChange,
}: {
  medicines: ExtractedMedicine[];
  confidence?: number;
  onChange: (next: ExtractedMedicine[]) => void;
}) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  return (
    <section className="space-y-6">
      <SectionHeader title="Medicines" confidence={confidence} />
      {medicines.length > 0 && (
        <div className="space-y-4">
          {medicines.map((medicine, index) => (
            <MedicineListItem
              key={index}
              medicine={medicine}
              expanded={expandedIndex === index}
              onToggle={() => setExpandedIndex((cur) => (cur === index ? null : index))}
              onChange={(next) => {
                const list = [...medicines];
                list[index] = next;
                onChange(list);
              }}
              onRemove={() => {
                onChange(medicines.filter((_, i) => i !== index));
                setExpandedIndex(null);
              }}
            />
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          onChange([...medicines, EMPTY_MEDICINE]);
          setExpandedIndex(medicines.length);
        }}
        className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)]/5"
      >
        <span className="material-symbols-outlined text-lg">add</span>
        Add Medicine
      </button>
    </section>
  );
}

// ── Treatments (same collapsible-row pattern) ──

function TreatmentListItem({
  treatment,
  expanded,
  onToggle,
  onChange,
  onRemove,
}: {
  treatment: ExtractedTreatment;
  expanded: boolean;
  onToggle: () => void;
  onChange: (next: ExtractedTreatment) => void;
  onRemove: () => void;
}) {
  const summary = [treatment.sessions ? `${treatment.sessions} session(s)` : null, treatment.bodyPart]
    .filter(Boolean)
    .join(" · ");

  if (!expanded) {
    return (
      <div className="overflow-hidden rounded-2xl bg-[var(--color-surface-container-lowest)] ring-1 ring-[var(--color-outline-variant)]/10">
        <div
          className="flex cursor-pointer items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--color-surface-container-low)]/50"
          onClick={onToggle}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[var(--color-on-surface)]">
              {treatment.treatmentName || "Untitled treatment"}
            </p>
            {summary && <p className="mt-0.5 truncate text-xs text-[var(--color-on-surface-variant)]">{summary}</p>}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              aria-label="Edit treatment"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-on-surface-variant)] transition-colors hover:bg-[var(--color-surface-container-low)]"
            >
              <span className="material-symbols-outlined text-lg">edit</span>
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              aria-label="Delete treatment"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-outline)] transition-colors hover:bg-red-50 hover:text-red-500"
            >
              <span className="material-symbols-outlined text-lg">delete</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-[var(--color-surface-container-lowest)] ring-1 ring-[var(--color-outline-variant)]/10">
      <div className="space-y-5 p-5">
        <div>
          <span className={subLabelClass()}>Treatment</span>
          <input
            type="text"
            value={treatment.treatmentName}
            onChange={(e) => onChange({ ...treatment, treatmentName: e.target.value })}
            placeholder="Treatment name"
            className={inputFieldClass()}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <span className={subLabelClass()}>Sessions</span>
            <input type="number" value={treatment.sessions ?? ""} onChange={(e) => onChange({ ...treatment, sessions: e.target.value ? Number(e.target.value) : null })} placeholder="Number" className={inputFieldClass()} />
          </div>
          <div>
            <span className={subLabelClass()}>Duration (mins)</span>
            <input type="number" value={treatment.sessionDurationMinutes ?? ""} onChange={(e) => onChange({ ...treatment, sessionDurationMinutes: e.target.value ? Number(e.target.value) : null })} placeholder="mins" className={inputFieldClass()} />
          </div>
          <div>
            <span className={subLabelClass()}>Duration (days)</span>
            <input type="number" value={treatment.durationDays ?? ""} onChange={(e) => onChange({ ...treatment, durationDays: e.target.value ? Number(e.target.value) : null })} className={inputFieldClass()} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <span className={subLabelClass()}>Oil Name</span>
            <input type="text" value={treatment.oilName ?? ""} onChange={(e) => onChange({ ...treatment, oilName: e.target.value || null })} placeholder="Search and select oil(s)..." className={inputFieldClass()} />
          </div>
          <div>
            <span className={subLabelClass()}>Oil Qty (ml)</span>
            <input type="number" value={treatment.oilQuantityMl ?? ""} onChange={(e) => onChange({ ...treatment, oilQuantityMl: e.target.value ? Number(e.target.value) : null })} className={inputFieldClass()} />
          </div>
          <SelectField label="Oil Temperature" value={treatment.oilTempF} onChange={(v) => onChange({ ...treatment, oilTempF: v })} options={OIL_TEMP_OPTIONS} placeholder="Select temperature" allowOther />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SelectField
            label="Stroke Direction"
            value={treatment.strokeDirection}
            onChange={(v) => onChange({ ...treatment, strokeDirection: v as StrokeDirection | null })}
            options={STROKE_OPTIONS.map((s) => s.value)}
            placeholder="Select direction"
          />
          <div>
            <span className={subLabelClass()}>Body Part</span>
            <input type="text" value={treatment.bodyPart ?? ""} onChange={(e) => onChange({ ...treatment, bodyPart: e.target.value || null })} placeholder="Select body part" className={inputFieldClass()} />
          </div>
          <SelectField
            label="Pressure"
            value={treatment.pressure}
            onChange={(v) => onChange({ ...treatment, pressure: v as Pressure | null })}
            options={PRESSURE_OPTIONS.map((p) => p.value)}
            placeholder="Select pressure"
          />
        </div>

        <div>
          <span className={subLabelClass()}>Special Focus Notes</span>
          <textarea
            value={treatment.specialFocus ?? ""}
            onChange={(e) => onChange({ ...treatment, specialFocus: e.target.value || null })}
            placeholder="Any special instructions for the therapist"
            rows={2}
            className={`${inputFieldClass()} resize-none`}
          />
        </div>

        <div className="flex items-center justify-between border-t border-[var(--color-outline-variant)]/10 pt-2">
          <button
            type="button"
            onClick={onRemove}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-[var(--color-outline)] transition-colors hover:bg-red-50 hover:text-red-500"
          >
            <span className="material-symbols-outlined text-base">delete</span>
            Remove
          </button>
          <button
            type="button"
            onClick={onToggle}
            aria-label="Done editing treatment"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-white shadow-sm transition-all hover:bg-[var(--color-primary-hover)] active:scale-[0.95]"
          >
            <span className="material-symbols-outlined text-lg">add</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function TreatmentsSection({
  treatments,
  onChange,
}: {
  treatments: ExtractedTreatment[];
  onChange: (next: ExtractedTreatment[]) => void;
}) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  return (
    <section className="space-y-6">
      <SectionHeader title="Treatments" />
      {treatments.length > 0 && (
        <div className="space-y-4">
          {treatments.map((treatment, index) => (
            <TreatmentListItem
              key={index}
              treatment={treatment}
              expanded={expandedIndex === index}
              onToggle={() => setExpandedIndex((cur) => (cur === index ? null : index))}
              onChange={(next) => {
                const list = [...treatments];
                list[index] = next;
                onChange(list);
              }}
              onRemove={() => {
                onChange(treatments.filter((_, i) => i !== index));
                setExpandedIndex(null);
              }}
            />
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          onChange([...treatments, EMPTY_TREATMENT]);
          setExpandedIndex(treatments.length);
        }}
        className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)]/5"
      >
        <span className="material-symbols-outlined text-lg">add</span>
        Add Treatment
      </button>
    </section>
  );
}

/**
 * The AI draft review screen, rebuilt against the REAL clinical form
 * fields (verified against the CMS's own source — see
 * docs/modules/clinical-extraction-schema.md) and, for Medicines/
 * Treatments/Lab Tests/Diet/Lifestyle/Follow-up, against the real
 * CMS's actual Prescription tab component structure (one continuous
 * panel, collapsible-in-place rows, chip inputs — not per-section
 * accordion cards). Every field here is AI-suggested until accepted
 * (CLAUDE.md's "no silent AI authority" rule) — the status banner and
 * inline per-section confidence badges keep that visible without
 * reintroducing a card-per-section layout.
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
    <ReviewDraftPanelBody
      result={result}
      draft={draft}
      isSaving={isSaving}
      isFinalized={isFinalized}
      onChange={onChange}
      onAccept={onAccept}
      onDiscard={onDiscard}
    />
  );
}

function ReviewDraftPanelBody({
  result,
  draft,
  isSaving,
  isFinalized,
  onChange,
  onAccept,
  onDiscard,
}: {
  result: ReviewDraft;
  draft: ClinicalExtraction;
  isSaving: boolean;
  isFinalized: boolean;
  onChange: (next: ClinicalExtraction) => void;
  onAccept: () => void;
  onDiscard: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("intake");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 rounded-2xl bg-[var(--color-surface-container-low)] px-6 py-4">
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_CLASSES[result.status]}`}>
          {STATUS_LABELS[result.status]}
        </span>
        <ConfidenceBadge score={draft.aiConfidence.overall} />
        <span className="text-[11px] font-medium text-[var(--color-on-surface-variant)]">
          Run {result.runNumber} · {result.provider}/{result.model}
        </span>
        {isSaving && (
          <span className="ml-auto text-[11px] font-medium text-[var(--color-on-surface-variant)]">
            Saving…
          </span>
        )}
      </div>

      <RiskFlagBanner riskFlags={draft.riskFlags} />

      {/* Tab switcher — matches KAL-clinic-management-solution's
          Patient Intake / Examination / Prescription pill group
          exactly (app/(app)/appointments/[id]/clinical/page.tsx).
          Unlike the real one, switching here is never gated — every
          field is AI-suggested and editable regardless of what's
          filled elsewhere, so there's no "finish this before you can
          see that" rule to enforce. */}
      <div className="flex max-w-xl gap-1 rounded-2xl bg-[var(--color-surface-container-low)] p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 whitespace-nowrap rounded-xl px-6 py-3 text-sm font-bold transition-all ${
              activeTab === tab.id
                ? "bg-white text-[var(--color-primary)] shadow-md"
                : "text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "intake" && (
        <SectionCard title="Patient Reported" confidence={draft.aiConfidence.perField.complaints}>
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
        </SectionCard>
      )}

      {activeTab === "examination" && (
        <div className="space-y-6">
          <SectionCard title="Case Sheet">
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={fieldLabelClass()}>BP (mmHg)</label>
                <div className="flex items-center gap-2">
                  <input type="number" value={draft.vitals.bpSystolic ?? ""} onChange={(e) => onChange({ ...draft, vitals: { ...draft.vitals, bpSystolic: e.target.value ? Number(e.target.value) : null } })} placeholder="sys" className="w-full bg-[var(--color-surface-container-low)] rounded-xl py-2 px-2 text-sm text-center text-[var(--color-on-surface)] form-input-focus transition-all" />
                  <span className="text-[var(--color-outline)]">/</span>
                  <input type="number" value={draft.vitals.bpDiastolic ?? ""} onChange={(e) => onChange({ ...draft, vitals: { ...draft.vitals, bpDiastolic: e.target.value ? Number(e.target.value) : null } })} placeholder="dia" className="w-full bg-[var(--color-surface-container-low)] rounded-xl py-2 px-2 text-sm text-center text-[var(--color-on-surface)] form-input-focus transition-all" />
                </div>
              </div>
              <NumberField label="Pulse (bpm)" value={draft.vitals.pulse} onChange={(v) => onChange({ ...draft, vitals: { ...draft.vitals, pulse: v } })} />
              <NumberField label="Temperature (°F)" value={draft.vitals.temperatureF} onChange={(v) => onChange({ ...draft, vitals: { ...draft.vitals, temperatureF: v } })} />
            </div>
          </SectionCard>

          <SectionCard title="Detailed Assessment" confidence={draft.aiConfidence.perField.ashtavidhaPariksha}>
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
        </div>
      )}

      {activeTab === "prescription" && (
        <div className="space-y-6">
          <PanelCard>
            <div className="space-y-10">
          {/* ── Prescription (matches KAL-clinic-management-solution's
              Prescription tab exactly from here down) ── */}
          <MedicinesSection
            medicines={draft.medicines}
            confidence={draft.aiConfidence.perField.medicines}
            onChange={(medicines) => onChange({ ...draft, medicines })}
          />

          <SectionDivider />

          <TreatmentsSection
            treatments={draft.treatments}
            onChange={(treatments) => onChange({ ...draft, treatments })}
          />

          <SectionDivider />

          <section className="space-y-6">
            <SectionHeader title="Lab Tests and Scans" />
            <ChipListEditor
              items={draft.labTests}
              onChange={(labTests) => onChange({ ...draft, labTests })}
              placeholder="Search or type a test..."
            />
          </section>

          <SectionDivider />

          <section className="space-y-6">
            <SectionHeader title="Diet" />
            <div className="space-y-5">
              <div>
                <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-widest text-[var(--color-on-surface-variant)]">
                  What to Eat
                </span>
                <ChipListEditor items={draft.dietEat} onChange={(dietEat) => onChange({ ...draft, dietEat })} placeholder="Search or type foods to include..." />
              </div>
              <div>
                <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-widest text-[var(--color-on-surface-variant)]">
                  What to Avoid
                </span>
                <ChipListEditor items={draft.dietAvoid} onChange={(dietAvoid) => onChange({ ...draft, dietAvoid })} placeholder="Search or type foods to avoid..." />
              </div>
            </div>
          </section>

          <SectionDivider />

          <section className="space-y-6">
            <SectionHeader title="Lifestyle" />
            <div className="space-y-5">
              <div>
                <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-widest text-[var(--color-on-surface-variant)]">
                  What to Maintain
                </span>
                <ChipListEditor items={draft.lifestyleMaintain} onChange={(lifestyleMaintain) => onChange({ ...draft, lifestyleMaintain })} placeholder="Search or type..." />
              </div>
              <div>
                <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-widest text-[var(--color-on-surface-variant)]">
                  What to Avoid
                </span>
                <ChipListEditor items={draft.lifestyleAvoid} onChange={(lifestyleAvoid) => onChange({ ...draft, lifestyleAvoid })} placeholder="Search or type..." />
              </div>
            </div>
          </section>
        </div>
      </PanelCard>

      <PanelCard>
        <section className="space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-widest text-[var(--color-on-background)]">
            Next Follow-up
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium text-[var(--color-on-surface)]">
              Recommended next visit after
            </label>
            <input
              type="number"
              value={draft.followUpValue ?? ""}
              onChange={(e) => onChange({ ...draft, followUpValue: e.target.value ? Number(e.target.value) : null })}
              placeholder="—"
              className="w-20 rounded-xl border border-transparent bg-[var(--color-surface-container-low)] px-3 py-2 text-center text-sm font-medium text-[var(--color-on-surface)] outline-none transition-all focus:ring-2 focus:ring-[var(--color-primary)]/20 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <select
              value={draft.followUpUnit ?? "days"}
              onChange={(e) => onChange({ ...draft, followUpUnit: e.target.value as FollowUpUnit })}
              className="cursor-pointer rounded-xl border border-transparent bg-[var(--color-surface-container-low)] px-3 py-2 text-sm font-medium text-[var(--color-on-surface)] outline-none transition-all focus:ring-2 focus:ring-[var(--color-primary)]/20"
            >
              <option value="days">Day(s)</option>
              <option value="weeks">Week(s)</option>
              <option value="months">Month(s)</option>
            </select>
          </div>
        </section>
          </PanelCard>
        </div>
      )}

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
