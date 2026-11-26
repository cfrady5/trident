import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="November 26, 2026">
      <h2>What we collect</h2>
      <ul>
        <li>Account information: your name and business email, used for passwordless sign-in.</li>
        <li>Application information: the answers and files you submit about your company.</li>
        <li>Assessment answers and the results we calculate from them.</li>
        <li>Public information about your company, such as your public website, which we research only with your consent.</li>
        <li>Basic technical logs needed to run and secure the service.</li>
      </ul>
      <h2>How we use it</h2>
      <p>To evaluate your application, prepare assessments and proposals, deliver services you engage us for and communicate with you about them. We do not sell personal information and we do not send high-volume unsolicited email.</p>
      <h2>Automated processing</h2>
      <p>Some research and drafting steps may use AI services. Their output is treated as a draft: it is never presented to you or anyone else as fact until a person at Trident has reviewed it, and AI output never becomes an approved fact about your company without your confirmation.</p>
      <h2>Information we cannot accept</h2>
      <p>Do not send classified information, controlled unclassified information (CUI), export-controlled technical data, confidential third-party information or other information we are not authorized to process. Files are quarantined on upload and reviewed by a person; we delete material we should not hold.</p>
      <h2>Who processes data for us</h2>
      <p>Hosting and database (Vercel, Supabase), transactional email (Resend) and, where enabled, AI processing (Anthropic) and privacy-conscious analytics (PostHog, only with your consent). [CONFIRM: final processor list and data processing agreements]</p>
      <h2>Retention</h2>
      <p>We keep application and assessment data for as long as needed for the purposes above, and delete inactive applications after 24 months. [CONFIRM: retention periods]</p>
      <h2>Your choices</h2>
      <p>You can request an export or deletion of your data from your account settings at any time. We confirm each request by email.</p>
      <h2>Cookies</h2>
      <p>We use one essential cookie to keep you signed in. Analytics cookies are set only if you accept them.</p>
    </LegalPage>
  );
}
