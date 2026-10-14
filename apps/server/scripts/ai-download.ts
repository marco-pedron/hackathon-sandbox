// Downloads every candidate QVAC model into the SDK cache (default ~/.qvac/models).
// Needs network once; after this, ai:smoke must pass offline.
import { close, downloadAsset, loadModel, unloadModel } from '@qvac/sdk';
import { CANDIDATES, SMOKE_LLM, SMOKE_OCR } from './models.js';

try {
  for (const model of CANDIDATES) {
    const mb = (model.expectedSize / 1e6).toFixed(0);
    console.log(`▸ downloading ${model.name} (${mb} MB)`);
    let last = -1;
    await downloadAsset({
      assetSrc: model,
      onProgress: (p) => {
        const pct = Math.floor(p.percentage);
        if (pct >= last + 10) {
          last = pct;
          process.stdout.write(` ${pct}%`);
        }
      },
    });
    console.log(' done');
  }
  // Load once while online, so anything fetched at load time (e.g. the OCR
  // detector companion) is cached too.
  const ocrId = await loadModel({ modelSrc: SMOKE_OCR });
  await unloadModel({ modelId: ocrId, clearStorage: false });
  console.log(`▸ load check ok: ${SMOKE_OCR.name}`);
  const llmId = await loadModel({ modelSrc: SMOKE_LLM });
  await unloadModel({ modelId: llmId, clearStorage: false });
  console.log(`▸ load check ok: ${SMOKE_LLM.name}`);
  console.log('all models cached');
} finally {
  await close();
}
