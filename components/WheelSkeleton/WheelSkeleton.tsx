import styles from "./WheelSkeleton.module.css";

export function WheelSkeleton({ label }: { label: string }) {
  return (
    // The wheel replaces this when it streams in; the gate tells the preload
    // curtain to wait for the real wheel (see lib/appReady.ts).
    <div className={styles.wrap} role="status" data-ready-gate="wheel">
      <div className={styles.disc} />
      <span className="visually-hidden">{label}</span>
    </div>
  );
}
