import styles from "./WheelSkeleton.module.css";

export function WheelSkeleton({ label }: { label: string }) {
  return (
    <div className={styles.wrap} role="status">
      <div className={styles.disc} />
      <span className="visually-hidden">{label}</span>
    </div>
  );
}
