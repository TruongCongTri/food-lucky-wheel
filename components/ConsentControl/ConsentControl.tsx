"use client";

import { useEffect, useState } from "react";
import { geoConsentDate, withdrawGeoConsent } from "@/lib/geoConsent";
import styles from "./ConsentControl.module.css";

type Props = {
  locale: string;
  labels: { withdraw: string; withdrawn: string; consentGiven: string; consentNone: string };
};

/** Shows the on-device location-consent status and lets the user withdraw it. */
export function ConsentControl({ locale, labels }: Props) {
  const [state, setState] = useState<{ at: string | null; withdrawn: boolean } | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read device storage after mount
    setState({ at: geoConsentDate(), withdrawn: false });
  }, []);

  if (!state) return null;

  if (state.withdrawn) {
    return (
      <p className={styles.box} role="status">
        {labels.withdrawn}
      </p>
    );
  }

  if (!state.at) {
    return <p className={styles.box}>{labels.consentNone}</p>;
  }

  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" }).format(
    new Date(state.at),
  );

  return (
    <div className={styles.box}>
      <p>{labels.consentGiven.replace("{date}", date)}</p>
      <button
        type="button"
        className={styles.button}
        onClick={() => {
          withdrawGeoConsent();
          setState({ at: null, withdrawn: true });
        }}
      >
        {labels.withdraw}
      </button>
    </div>
  );
}
