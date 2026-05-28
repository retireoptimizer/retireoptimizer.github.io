import * as Comlink from 'comlink';
import type { EngineWorkerAPI } from './worker';

let workerInstance: Worker | null = null;
let proxy: Comlink.Remote<EngineWorkerAPI> | null = null;

/** Lazy-init the singleton engine worker + Comlink proxy. */
export function getEngineWorker(): Comlink.Remote<EngineWorkerAPI> {
  if (!proxy) {
    workerInstance = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    proxy = Comlink.wrap<EngineWorkerAPI>(workerInstance);
  }
  return proxy;
}

/** Terminate the worker. Use this when worker source changes during dev — the
 *  worker bundle is loaded once on first call and won't pick up code changes
 *  without explicit termination. Also used by the UI's "Reload Engine" button. */
export function disposeEngineWorker() {
  if (workerInstance) workerInstance.terminate();
  workerInstance = null;
  proxy = null;
}

// Auto-dispose the worker on Vite hot module replacement — otherwise the worker
// instance survives module reloads, freezing in whatever code was bundled when
// the page first opened. This is the root cause of "I edited the engine but the
// optimizer still produces old output" in dev.
if (import.meta.hot) {
  import.meta.hot.dispose(() => disposeEngineWorker());
  // Also dispose if either the worker entry or the optimizer module reloads.
  import.meta.hot.accept(['./worker.ts', './optimizer.ts', './projection.ts'], () => {
    disposeEngineWorker();
  });
}
