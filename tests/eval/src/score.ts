import type { ClinicalExtraction } from "@kal-scribe/types";
import type { EvalExpectation } from "./expectation.js";

export interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

function containsAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((needle) => lower.includes(needle.toLowerCase()));
}

function anyItemMatches(items: string[], keyword: string): boolean {
  const lower = keyword.toLowerCase();
  return items.some((item) => item.toLowerCase().includes(lower));
}

/** Scores one extraction against one fixture's hand-labeled
 * expectations, against the REAL clinical form schema. Each check is
 * pass/fail and independently reported — the point is a readable
 * before/after over time (architecture.md §18, §20 principle 7), not
 * a single opaque percentage. */
export function scoreExtraction(
  extraction: ClinicalExtraction,
  expected: EvalExpectation,
): CheckResult[] {
  const checks: CheckResult[] = [];

  checks.push({
    name: "complaints mentions expected keywords",
    passed: expected.complaints.requiredKeywords.every((kw) => anyItemMatches(extraction.complaints, kw)),
    detail: `got: [${extraction.complaints.join(", ")}]`,
  });

  const diagnosisText = extraction.modernDiagnosis;
  const diagnosisOk = diagnosisText === null
    ? expected.modernDiagnosis.acceptNull
    : containsAny(diagnosisText, expected.modernDiagnosis.acceptableSubstrings) &&
      !containsAny(diagnosisText, expected.modernDiagnosis.forbiddenSubstrings);
  checks.push({
    name: "modernDiagnosis is null or an acceptable stated diagnosis (never fabricated)",
    passed: diagnosisOk,
    detail: `got: ${diagnosisText === null ? "null" : `"${diagnosisText}"`}`,
  });

  const medicineNames = extraction.medicines.map((m) => m.medicineName);
  for (const keyword of expected.medicines.expectedNameKeywords) {
    checks.push({
      name: `medicines includes "${keyword}"`,
      passed: anyItemMatches(medicineNames, keyword),
      detail: `got: [${medicineNames.join(", ")}]`,
    });
  }
  checks.push({
    name: "medicines[].matchConfidence left null by the LLM (deterministic step fills it later)",
    passed: extraction.medicines.every((m) => m.matchConfidence === null),
    detail: `got: [${extraction.medicines.map((m) => m.matchConfidence).join(", ")}]`,
  });

  // Empty expectedNameKeywords means this fixture's transcript never
  // mentioned a treatment — skip the check (an empty-array .some()
  // would otherwise always report a false failure).
  if (expected.treatments.expectedNameKeywords.length > 0) {
    const treatmentNames = extraction.treatments.map((t) => t.treatmentName);
    checks.push({
      name: "treatments includes an expected treatment",
      passed: expected.treatments.expectedNameKeywords.some((kw) => anyItemMatches(treatmentNames, kw)),
      detail: `got: [${treatmentNames.join(", ")}]`,
    });
  }

  for (const keyword of expected.dietAvoid.expectedKeywords) {
    checks.push({
      name: `dietAvoid mentions "${keyword}"`,
      passed: anyItemMatches(extraction.dietAvoid, keyword),
      detail: `got: [${extraction.dietAvoid.join(", ")}]`,
    });
  }
  for (const keyword of expected.dietEat.expectedKeywords) {
    checks.push({
      name: `dietEat mentions "${keyword}"`,
      passed: anyItemMatches(extraction.dietEat, keyword),
      detail: `got: [${extraction.dietEat.join(", ")}]`,
    });
  }
  for (const keyword of expected.lifestyleMaintain.expectedKeywords) {
    checks.push({
      name: `lifestyleMaintain mentions "${keyword}"`,
      passed: anyItemMatches(extraction.lifestyleMaintain, keyword),
      detail: `got: [${extraction.lifestyleMaintain.join(", ")}]`,
    });
  }

  checks.push({
    name: "followUpValue/Unit matches the stated follow-up",
    passed: extraction.followUpValue === expected.followUp.expectedValue &&
      extraction.followUpUnit === expected.followUp.expectedUnit,
    detail: `got: ${extraction.followUpValue} ${extraction.followUpUnit}`,
  });

  // Empty expectedDisease means this fixture's transcript never
  // mentioned family history at all — skip the check rather than
  // fabricate a lookup against a disease key of "" (which would
  // always report a false failure, not a real signal).
  if (expected.familyHistory.expectedDisease) {
    const familyRelations = extraction.familyHistory?.[expected.familyHistory.expectedDisease] ?? [];
    checks.push({
      name: `familyHistory["${expected.familyHistory.expectedDisease}"] includes "${expected.familyHistory.expectedRelationKeyword}"`,
      passed: anyItemMatches(familyRelations, expected.familyHistory.expectedRelationKeyword),
      detail: `got: ${JSON.stringify(extraction.familyHistory)}`,
    });
  }

  if (expected.examFindingsShouldBeEmpty) {
    const ashtavidhaAllNull = Object.values(extraction.ashtavidhaPariksha).every((v) => v === null);
    const srotasEmpty = Object.keys(extraction.srotasPariksha).length === 0;
    const finalAssessmentAllNull =
      extraction.prakrithi === null &&
      extraction.dosha === null &&
      extraction.agni === null &&
      extraction.ojas === null;
    checks.push({
      name: "no physical-examination findings hallucinated (none were stated aloud in this transcript)",
      passed: ashtavidhaAllNull && srotasEmpty && finalAssessmentAllNull,
      detail: `ashtavidha: ${JSON.stringify(extraction.ashtavidhaPariksha)}, srotas keys: [${Object.keys(extraction.srotasPariksha).join(", ")}], prakrithi/dosha/agni/ojas: ${extraction.prakrithi}/${extraction.dosha}/${extraction.agni}/${extraction.ojas}`,
    });
  }

  return checks;
}
