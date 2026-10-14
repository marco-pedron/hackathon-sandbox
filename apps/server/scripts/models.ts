import {
  MMPROJ_SMOLVLM2_500M_MULTIMODAL_Q8_0,
  OCR_LATIN,
  QWEN3_1_7B_INST_Q4,
  QWEN3_600M_INST_Q4,
  SMOLVLM2_500M_MULTIMODAL_Q8_0,
} from '@qvac/sdk';

// Models used by ai:smoke (OCR + text LLM). Phase 3 picks the final ones via ai:eval.
export const SMOKE_OCR = OCR_LATIN;
export const SMOKE_LLM = QWEN3_1_7B_INST_Q4;

// Everything Phase 3 may try, cached now so the event needs no downloads:
// a smaller LLM fallback and a vision-language pair for the poor-OCR path.
export const CANDIDATES = [
  OCR_LATIN,
  QWEN3_1_7B_INST_Q4,
  QWEN3_600M_INST_Q4,
  SMOLVLM2_500M_MULTIMODAL_Q8_0,
  MMPROJ_SMOLVLM2_500M_MULTIMODAL_Q8_0,
];
