/** Ground-truth shape for one eval fixture, against the REAL clinical
 * form schema (packages/types/src/clinical-extraction.ts). Free-text
 * fields are scored by keyword/substring checks rather than exact
 * string equality — an honest way to score free text without
 * pretending exact-match works. */
export interface EvalExpectation {
  description: string;
  complaints: { requiredKeywords: string[] };
  modernDiagnosis: {
    acceptNull: boolean;
    acceptableSubstrings: string[];
    forbiddenSubstrings: string[];
  };
  medicines: { expectedNameKeywords: string[] };
  /** Empty array = no treatment was ever mentioned in this fixture's
   * transcript — the check is skipped (score.ts), not scored as a
   * failure. */
  treatments: { expectedNameKeywords: string[] };
  dietAvoid: { expectedKeywords: string[] };
  dietEat: { expectedKeywords: string[] };
  lifestyleMaintain: { expectedKeywords: string[] };
  followUp: { expectedValue: number; expectedUnit: string };
  /** Empty `expectedDisease` = family history was never mentioned in
   * this fixture's transcript — the check is skipped (score.ts), not
   * scored as a failure. */
  familyHistory: { expectedDisease: string; expectedRelationKeyword: string };
  /** No physical-examination finding (Ashtavidha, Srotas, Prakrithi,
   * Dosha, Agni, Ojas) was ever stated aloud in this fixture's
   * transcript — this checks the LLM didn't hallucinate any of them
   * from context, the exact failure mode the extraction prompt's
   * "only fill if the doctor states it aloud" rule exists to prevent. */
  examFindingsShouldBeEmpty: boolean;
}
