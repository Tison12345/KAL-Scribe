/** Ground-truth shape for one eval fixture. Deliberately not
 * ClinicalExtraction itself — free-text fields (chiefComplaint.text,
 * soap.*) can't be scored by exact string equality against an LLM's
 * output, so expectations are keyword/substring checks instead, which
 * is an honest way to score free text rather than pretending
 * exact-match works (see tests/eval/README or the Milestone 7 log
 * entry for the reasoning). */
export interface EvalExpectation {
  description: string;
  chiefComplaint: { requiredKeywords: string[] };
  diagnosis: {
    acceptNull: boolean;
    acceptableSubstrings: string[];
    forbiddenSubstrings: string[];
  };
  medicinesMentioned: { expectedNames: string[] };
  treatmentsMentioned: { expectedNames: string[] };
  diet: {
    expectedRestrictionKeywords: string[];
    expectedRecommendationKeywords: string[];
  };
  lifestyle: {
    sleepMentionedExpected: boolean;
    activityExpectedKeywords: string[];
  };
  followUp: {
    recommendedExpected: boolean;
    timeframeKeywords: string[];
  };
  history: { familyHistoryExpectedKeywords: string[] };
}
