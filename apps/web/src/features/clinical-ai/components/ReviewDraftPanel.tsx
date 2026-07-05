"use client";

import { useState } from "react";
import type {
  ClinicalExtraction,
  ConsultationAiResult,
  ExtractedMedicine,
  ExtractedTreatment,
} from "@kal-scribe/types";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { RiskFlagBanner } from "./RiskFlagBanner";
import { SoapNoteView } from "./SoapNoteView";
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
        <span className="material-symbols-outlined text-lg text-[var(--color-primary)]">
          {icon}
        </span>
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
      <label className="mb-2 block text-[11px] font-extrabold uppercase tracking-widest text-[var(--color-on-surface-variant)]">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Not mentioned"}
        className="w-full bg-[var(--color-surface-container-low)] rounded-2xl py-3 px-4 text-sm font-medium text-[var(--color-on-surface)] placeholder:text-[var(--color-outline)]/40 form-input-focus transition-all"
      />
    </div>
  );
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
          value={medicine.name}
          onChange={(e) => onChange({ ...medicine, name: e.target.value })}
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
      <div className="grid grid-cols-3 gap-2">
        {(["dosage", "frequency", "duration"] as const).map((field) => (
          <div key={field}>
            <span className="mb-1 block text-[9px] font-bold text-[var(--color-on-surface-variant)]">
              {field[0]!.toUpperCase() + field.slice(1)}
            </span>
            <input
              type="text"
              value={medicine[field] ?? ""}
              onChange={(e) => onChange({ ...medicine, [field]: e.target.value || null })}
              className="w-full bg-white rounded-xl py-2 px-3 text-sm text-[var(--color-on-surface)] form-input-focus transition-all"
            />
          </div>
        ))}
      </div>
      <input
        type="text"
        value={medicine.instructions ?? ""}
        onChange={(e) => onChange({ ...medicine, instructions: e.target.value || null })}
        placeholder="Instructions (e.g. before food)"
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
          value={treatment.name}
          onChange={(e) => onChange({ ...treatment, name: e.target.value })}
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
      <input
        type="text"
        value={treatment.notes ?? ""}
        onChange={(e) => onChange({ ...treatment, notes: e.target.value || null })}
        placeholder="Notes"
        className="w-full bg-white rounded-xl py-2 px-3 text-sm text-[var(--color-on-surface)] placeholder:text-[var(--color-outline)]/40 form-input-focus transition-all"
      />
    </div>
  );
}

/**
 * The AI draft review screen (architecture.md §6, §7 stage 12) — the
 * four-part draft (Medicines/Diet/Lifestyle/Treatments) plus
 * supporting context (chief complaint, history, diagnosis, SOAP),
 * confidence/risk indicators, editable fields, and accept/discard.
 * Every field here is AI-suggested until accepted (CLAUDE.md's "no
 * silent AI authority" rule) — the status badge and per-section
 * confidence badges keep that visible throughout, not just at the
 * top.
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
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_CLASSES[result.status]}`}
        >
          {STATUS_LABELS[result.status]}
        </span>
        <ConfidenceBadge score={draft.aiConfidence.overall} />
        {isSaving && (
          <span className="text-[11px] font-medium text-[var(--color-on-surface-variant)]">
            Saving…
          </span>
        )}
        <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]">
          {result.llmProvider}
        </span>
      </div>

      <RiskFlagBanner riskFlags={draft.riskFlags} />

      <SectionCard icon="summarize" title="Chief Complaint & Symptoms" confidence={draft.aiConfidence.perField.chiefComplaint}>
        <TextField
          label="Chief complaint"
          value={draft.chiefComplaint.text}
          onChange={(text) => onChange({ ...draft, chiefComplaint: { ...draft.chiefComplaint, text } })}
        />
        <div className="grid grid-cols-2 gap-4">
          <TextField
            label="Duration"
            value={draft.chiefComplaint.duration ?? ""}
            onChange={(duration) =>
              onChange({ ...draft, chiefComplaint: { ...draft.chiefComplaint, duration: duration || null } })
            }
          />
          <div>
            <label className="mb-2 block text-[11px] font-extrabold uppercase tracking-widest text-[var(--color-on-surface-variant)]">
              Onset
            </label>
            <select
              value={draft.chiefComplaint.onset ?? ""}
              onChange={(e) =>
                onChange({
                  ...draft,
                  chiefComplaint: {
                    ...draft.chiefComplaint,
                    onset: (e.target.value || null) as ClinicalExtraction["chiefComplaint"]["onset"],
                  },
                })
              }
              className="w-full appearance-none bg-[var(--color-surface-container-low)] rounded-2xl py-3 px-4 text-sm font-medium text-[var(--color-on-surface)] form-input-focus transition-all"
            >
              <option value="">Not stated</option>
              <option value="gradual">Gradual</option>
              <option value="sudden">Sudden</option>
            </select>
          </div>
        </div>

        {draft.symptoms.length === 0 ? (
          <p className="text-[11px] text-[var(--color-outline)]">No symptoms extracted</p>
        ) : (
          <div className="space-y-3">
            {draft.symptoms.map((symptom, index) => (
              <div key={index} className="rounded-2xl bg-[var(--color-surface-container-low)] p-4">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={symptom.description}
                    onChange={(e) => {
                      const next = [...draft.symptoms];
                      next[index] = { ...symptom, description: e.target.value };
                      onChange({ ...draft, symptoms: next });
                    }}
                    className="w-full bg-white rounded-xl py-2 px-3 text-sm font-bold text-[var(--color-on-surface)] form-input-focus transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => onChange({ ...draft, symptoms: draft.symptoms.filter((_, i) => i !== index) })}
                    aria-label="Remove symptom"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--color-outline)] transition-all hover:bg-red-50 hover:text-red-600"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-[var(--color-on-surface-variant)]">
                  {[symptom.location, symptom.duration, symptom.severity].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard icon="history_edu" title="History & Diagnosis" confidence={draft.aiConfidence.perField.diagnosis}>
        <StringListEditor
          label="Past medical history"
          items={draft.history.pastMedicalHistoryMentioned}
          onChange={(pastMedicalHistoryMentioned) =>
            onChange({ ...draft, history: { ...draft.history, pastMedicalHistoryMentioned } })
          }
        />
        <StringListEditor
          label="Family history"
          items={draft.history.familyHistoryMentioned}
          onChange={(familyHistoryMentioned) =>
            onChange({ ...draft, history: { ...draft.history, familyHistoryMentioned } })
          }
        />
        <TextField
          label="Diagnosis (only if explicitly stated by the doctor)"
          value={draft.diagnosis.stated ?? ""}
          placeholder="Not stated — never inferred"
          onChange={(stated) => onChange({ ...draft, diagnosis: { ...draft.diagnosis, stated: stated || null } })}
        />
        <StringListEditor
          label="Differential considered"
          items={draft.diagnosis.differentialMentioned}
          onChange={(differentialMentioned) =>
            onChange({ ...draft, diagnosis: { ...draft.diagnosis, differentialMentioned } })
          }
        />
      </SectionCard>

      <SectionCard icon="medication" title="Medicines" confidence={draft.aiConfidence.perField.medicinesMentioned}>
        {draft.medicinesMentioned.map((medicine, index) => (
          <MedicineRow
            key={index}
            medicine={medicine}
            onChange={(next) => {
              const list = [...draft.medicinesMentioned];
              list[index] = next;
              onChange({ ...draft, medicinesMentioned: list });
            }}
            onRemove={() =>
              onChange({ ...draft, medicinesMentioned: draft.medicinesMentioned.filter((_, i) => i !== index) })
            }
          />
        ))}
        <button
          type="button"
          onClick={() =>
            onChange({
              ...draft,
              medicinesMentioned: [
                ...draft.medicinesMentioned,
                { name: "", dosage: null, frequency: null, duration: null, instructions: null, matchConfidence: null },
              ],
            })
          }
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-[11px] font-bold text-[var(--color-primary)] transition-all hover:bg-[var(--color-primary)]/5"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Add medicine
        </button>
      </SectionCard>

      <SectionCard icon="restaurant" title="Diet">
        <StringListEditor
          label="Recommendations"
          items={draft.diet.recommendations}
          onChange={(recommendations) => onChange({ ...draft, diet: { ...draft.diet, recommendations } })}
        />
        <StringListEditor
          label="Restrictions"
          items={draft.diet.restrictions}
          onChange={(restrictions) => onChange({ ...draft, diet: { ...draft.diet, restrictions } })}
        />
      </SectionCard>

      <SectionCard icon="self_improvement" title="Lifestyle">
        <StringListEditor
          label="Recommendations"
          items={draft.lifestyle.recommendations}
          onChange={(recommendations) => onChange({ ...draft, lifestyle: { ...draft.lifestyle, recommendations } })}
        />
        <StringListEditor
          label="Activity recommendations"
          items={draft.lifestyle.activityRecommendations}
          onChange={(activityRecommendations) =>
            onChange({ ...draft, lifestyle: { ...draft.lifestyle, activityRecommendations } })
          }
        />
        <div className="grid grid-cols-2 gap-4">
          <TextField
            label="Sleep notes"
            value={draft.lifestyle.sleep.notes ?? ""}
            onChange={(notes) =>
              onChange({ ...draft, lifestyle: { ...draft.lifestyle, sleep: { ...draft.lifestyle.sleep, notes: notes || null, mentioned: true } } })
            }
          />
          <TextField
            label="Stress notes"
            value={draft.lifestyle.stress.notes ?? ""}
            onChange={(notes) =>
              onChange({ ...draft, lifestyle: { ...draft.lifestyle, stress: { ...draft.lifestyle.stress, notes: notes || null, mentioned: true } } })
            }
          />
        </div>
      </SectionCard>

      <SectionCard icon="healing" title="Treatments" confidence={draft.aiConfidence.perField.medicinesMentioned}>
        {draft.treatmentsMentioned.map((treatment, index) => (
          <TreatmentRow
            key={index}
            treatment={treatment}
            onChange={(next) => {
              const list = [...draft.treatmentsMentioned];
              list[index] = next;
              onChange({ ...draft, treatmentsMentioned: list });
            }}
            onRemove={() =>
              onChange({ ...draft, treatmentsMentioned: draft.treatmentsMentioned.filter((_, i) => i !== index) })
            }
          />
        ))}
        <button
          type="button"
          onClick={() =>
            onChange({
              ...draft,
              treatmentsMentioned: [...draft.treatmentsMentioned, { name: "", type: null, notes: null }],
            })
          }
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-[11px] font-bold text-[var(--color-primary)] transition-all hover:bg-[var(--color-primary)]/5"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Add treatment
        </button>
      </SectionCard>

      <SectionCard icon="event_repeat" title="Advice & Follow-up">
        <StringListEditor
          label="Advice given"
          items={draft.adviceGiven}
          onChange={(adviceGiven) => onChange({ ...draft, adviceGiven })}
        />
        <div className="grid grid-cols-2 gap-4">
          <TextField
            label="Follow-up timeframe"
            value={draft.followUp.timeframe ?? ""}
            onChange={(timeframe) =>
              onChange({
                ...draft,
                followUp: { ...draft.followUp, timeframe: timeframe || null, recommended: Boolean(timeframe) || draft.followUp.recommended },
              })
            }
          />
          <TextField
            label="Follow-up reason"
            value={draft.followUp.reason ?? ""}
            onChange={(reason) => onChange({ ...draft, followUp: { ...draft.followUp, reason: reason || null } })}
          />
        </div>
      </SectionCard>

      <SectionCard icon="description" title="SOAP Note" confidence={draft.aiConfidence.perField.soap}>
        <SoapNoteView soap={draft.soap} onChange={(soap) => onChange({ ...draft, soap })} />
      </SectionCard>

      <SectionCard icon="edit_note" title="Clinical Notes">
        <textarea
          value={draft.clinicalNotes}
          onChange={(e) => onChange({ ...draft, clinicalNotes: e.target.value })}
          rows={3}
          placeholder="No additional notes"
          className="w-full resize-none rounded-2xl bg-[var(--color-surface-container-low)] px-5 py-4 text-sm font-medium text-[var(--color-on-surface)] placeholder:text-[var(--color-outline)]/40 form-input-focus transition-all"
        />
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
