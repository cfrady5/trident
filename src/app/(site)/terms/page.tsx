import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal";
import { site } from "@/content/site";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="November 26, 2026">
      <h2>The service</h2>
      <p>This website describes Trident&apos;s services and lets companies apply, take a readiness self-assessment and request proposals. Using the website does not create an engagement. Engagements begin only under a signed statement of work.</p>
      <h2>Prices</h2>
      <p>Published prices are starting prices for the scope described. Final pricing is confirmed in a written proposal.</p>
      <h2>Assessments</h2>
      <p>The Commercial Readiness Index is Trident&apos;s own preliminary methodology. It is not a government certification, an endorsement or a validated benchmark, and it does not predict commercial outcomes.</p>
      <h2>Independence</h2>
      <p>{site.disclaimer}</p>
      <h2>Your submissions</h2>
      <p>You confirm that you have the right to share what you submit and that it contains no classified, controlled unclassified, export-controlled or confidential third-party information.</p>
      <h2>Acceptable use</h2>
      <p>Don&apos;t attempt to access other users&apos; data, probe or disrupt the service, or submit malicious files.</p>
    </LegalPage>
  );
}
