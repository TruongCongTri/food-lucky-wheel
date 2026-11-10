import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { DishManager } from "@/components/DishManager/DishManager";
import { Footer } from "@/components/Footer/Footer";
import styles from "./page.module.css";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/manage">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) return {};
  const dict = await getDictionary(locale);
  return { title: `${dict.manage.title} · ${dict.header.brand}`, robots: { index: false } };
}

export default async function ManagePage({ params }: PageProps<"/[locale]/manage">) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const dict = await getDictionary(locale);

  return (
    <main className={styles.main}>
      <header className={styles.head}>
        <div className={styles.meta}>
          <span className={styles.index}>{dict.manage.index}</span>
          <span>{dict.manage.label}</span>
        </div>
        <h1 className={styles.title}>{dict.manage.title}</h1>
        <p className={styles.subtitle}>{dict.manage.subtitle}</p>
      </header>
      <DishManager />
      <Footer t={dict.footer} locale={locale} />
    </main>
  );
}
