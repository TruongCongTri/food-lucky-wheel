import type { Dictionary } from "@/i18n/dictionaries";
import { Reveal } from "@/components/Reveal/Reveal";
import styles from "./Steps.module.css";

export function Steps({ t }: { t: Dictionary["steps"] }) {
  return (
    <Reveal className={styles.steps}>
      <div className={styles.head} data-reveal>
        <span className={styles.index}>{t.index}</span>
        <h2 className={styles.title}>{t.title}</h2>
      </div>
      <ol className={styles.list}>
        {t.items.map((item, i) => (
          <li key={i} className={styles.item}>
            <span className={styles.rule} data-line />
            <div className={styles.row} data-reveal>
              <span className={styles.num}>{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h3 className={styles.itemTitle}>{item.title}</h3>
                <p className={styles.text}>{item.text}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </Reveal>
  );
}
