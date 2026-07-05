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
 * expectations. Each check is pass/fail and independently reported —
 * the point is a readable before/after over time (architecture.md
 * §18, §20 principle 7), not a single opaque percentage. */
export function scoreExtraction(
  extraction: ClinicalExtraction,
  expected: EvalExpectation,
): CheckResult[] {
  const checks: CheckResult[] = [];

  checks.push({
    name: "chiefComplaint mentions expected keywords",
    passed: containsAny(extraction.chiefComplaint.text, expected.chiefComplaint.requiredKeywords),
    detail: `got: "${extraction.chiefComplaint.text}"`,
  });

  const diagnosisText = extraction.diagnosis.stated;
  const diagnosisOk = diagnosisText === null
    ? expected.diagnosis.acceptNull
    : containsAny(diagnosisText, expected.diagnosis.acceptableSubstrings) &&
      !containsAny(diagnosisText, expected.diagnosis.forbiddenSubstrings);
  checks.push({
    name: "diagnosis.stated is null or an acceptable stated diagnosis (never a fabricated one)",
    passed: diagnosisOk,
    detail: `got: ${diagnosisText === null ? "null" : `"${diagnosisText}"`}`,
  });

  const medicineNames = extraction.medicinesMentioned.map((m) => m.name);
  for (const expectedName of expected.medicinesMentioned.expectedNames) {
    checks.push({
      name: `medicinesMentioned includes "${expectedName}"`,
      passed: anyItemMatches(medicineNames, expectedName),
      detail: `got: [${medicineNames.join(", ")}]`,
    });
  }
  checks.push({
    name: "medicinesMentioned[].matchConfidence left null by the LLM (deterministic step fills it later)",
    passed: extraction.medicinesMentioned.every((m) => m.matchConfidence === null),
    detail: `got: [${extraction.medicinesMentioned.map((m) => m.matchConfidence).join(", ")}]`,
  });

  const treatmentNames = extraction.treatmentsMentioned.map((t) => t.name);
  const anyTreatmentMatched = expected.treatmentsMentioned.expectedNames.some((name) =>
    anyItemMatches(treatmentNames, name),
  );
  checks.push({
    name: "treatmentsMentioned includes the recommended massage",
    passed: anyTreatmentMatched,
    detail: `got: [${treatmentNames.join(", ")}]`,
  });

  for (const keyword of expected.diet.expectedRestrictionKeywords) {
    checks.push({
      name: `diet.restrictions mentions "${keyword}"`,
      passed: anyItemMatches(extraction.diet.restrictions, keyword),
      detail: `got: [${extraction.diet.restrictions.join(", ")}]`,
    });
  }
  for (const keyword of expected.diet.expectedRecommendationKeywords) {
    checks.push({
      name: `diet.recommendations mentions "${keyword}"`,
      passed: anyItemMatches(extraction.diet.recommendations, keyword),
      detail: `got: [${extraction.diet.recommendations.join(", ")}]`,
    });
  }

  checks.push({
    name: "lifestyle.sleep.mentioned",
    passed: extraction.lifestyle.sleep.mentioned === expected.lifestyle.sleepMentionedExpected,
    detail: `got: ${extraction.lifestyle.sleep.mentioned}`,
  });
  checks.push({
    name: "lifestyle.activityRecommendations mentions walking",
    passed: expected.lifestyle.activityExpectedKeywords.some((keyword) =>
      anyItemMatches(extraction.lifestyle.activityRecommendations, keyword),
    ),
    detail: `got: [${extraction.lifestyle.activityRecommendations.join(", ")}]`,
  });

  checks.push({
    name: "followUp.recommended",
    passed: extraction.followUp.recommended === expected.followUp.recommendedExpected,
    detail: `got: ${extraction.followUp.recommended}`,
  });
  checks.push({
    name: "followUp.timeframe mentions two weeks",
    passed: extraction.followUp.timeframe !== null &&
      containsAny(extraction.followUp.timeframe, expected.followUp.timeframeKeywords),
    detail: `got: ${extraction.followUp.timeframe === null ? "null" : `"${extraction.followUp.timeframe}"`}`,
  });

  checks.push({
    name: "history.familyHistoryMentioned captures the mother's arthritis, attributed correctly",
    passed: expected.history.familyHistoryExpectedKeywords.some((keyword) =>
      anyItemMatches(extraction.history.familyHistoryMentioned, keyword),
    ),
    detail: `got: [${extraction.history.familyHistoryMentioned.join(", ")}]`,
  });

  return checks;
}
