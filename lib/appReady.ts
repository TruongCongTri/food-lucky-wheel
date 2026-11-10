/**
 * Readiness registry for the preload curtain (see components/Intro).
 * Components register what must be ready before the curtain lifts; each task
 * has its own timeout, so one slow font/photo can never hold the app hostage.
 * When the app has hydrated and every task has settled, the curtain is told to
 * lift (it still waits its minimum, and lifts at its maximum regardless).
 * No-ops once the curtain is gone (e.g. after client-side navigation).
 */
type IntroBridge = { ready(): void; progress(done: number, total: number): void };

let total = 0;
let done = 0;
let hydrated = false;

const bridge = () => (window as unknown as { __intro?: IntroBridge }).__intro;
const active = () => document.documentElement.dataset.intro === "play";

function report() {
  bridge()?.progress(done, total);
  if (hydrated && done >= total) bridge()?.ready();
}

/** Hold the curtain until `task` settles, or `timeoutMs` passes. */
export function waitFor(task: Promise<unknown> | undefined | null, timeoutMs: number) {
  if (!active() || !task) return;
  total++;
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    done++;
    report();
  };
  task.then(finish, finish);
  setTimeout(finish, timeoutMs);
  report();
}

/*
 * Ready gates: parts of the page that hydrate in a LATER React commit (e.g. the
 * wheel, inside a <Suspense> boundary) declare themselves in the HTML with
 * data-ready-gate="name". The root provider registers every gate it finds on
 * mount, and the component opens its gate when it's truly ready.
 */
const gates = new Map<string, () => void>();
const openedEarly = new Set<string>();

/** Hold the curtain until openGate(name) is called (or the timeout). */
export function expectGate(name: string, timeoutMs: number) {
  if (!active() || gates.has(name)) return;
  let open!: () => void;
  const opened = new Promise<void>((r) => (open = r));
  gates.set(name, open);
  if (openedEarly.has(name)) open();
  waitFor(opened, timeoutMs);
}

export function openGate(name: string) {
  const open = gates.get(name);
  if (open) open();
  else openedEarly.add(name);
}

/** Called once by the root provider after hydration (after child effects registered). */
export function markHydrated() {
  if (hydrated) return;
  hydrated = true;
  total++;
  done++;
  if (active()) report();
}
