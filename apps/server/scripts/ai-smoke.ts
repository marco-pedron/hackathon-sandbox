// Loads the OCR model and the LLM from the local cache, runs one short completion,
// prints "ready". Phase 0 acceptance: passes with Wi-Fi off after ai:download.
import { close, completion, loadModel, unloadModel } from '@qvac/sdk';
import { SMOKE_LLM, SMOKE_OCR } from './models.js';

const t0 = performance.now();
const ms = (from: number) => `${Math.round(performance.now() - from)} ms`;
let exitCode = 0;

try {
  let t = performance.now();
  const ocrId = await loadModel({ modelSrc: SMOKE_OCR });
  console.log(`▸ ${SMOKE_OCR.name} loaded in ${ms(t)}`);

  t = performance.now();
  const llmId = await loadModel({ modelSrc: SMOKE_LLM });
  console.log(`▸ ${SMOKE_LLM.name} loaded in ${ms(t)}`);

  t = performance.now();
  const run = completion({
    modelId: llmId,
    history: [{ role: 'user', content: 'Reply with exactly one word: ready /no_think' }],
    stream: false,
  });
  const final = await run.final;
  console.log(`▸ completion in ${ms(t)}: ${JSON.stringify(final.contentText.trim())}`);

  await unloadModel({ modelId: ocrId, clearStorage: false });
  await unloadModel({ modelId: llmId, clearStorage: false });
  console.log(`ready (total ${ms(t0)})`);
} catch (err) {
  console.error('✖ ai:smoke failed:', err);
  exitCode = 1;
} finally {
  await close();
}
process.exit(exitCode);
