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

/** Terminate the worker (rarely needed; useful on hot-reload edge cases). */
export function disposeEngineWorker() {
  if (workerInstance) workerInstance.terminate();
  workerInstance = null;
  proxy = null;
}
