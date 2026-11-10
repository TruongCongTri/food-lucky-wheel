import { legalMetadata, renderLegal } from "../legal";

export async function generateMetadata({ params }: PageProps<"/[locale]/terms">) {
  return legalMetadata((await params).locale, "terms");
}

export default async function TermsPage({ params }: PageProps<"/[locale]/terms">) {
  return renderLegal((await params).locale, "terms");
}
