import type { Metadata } from "next";
import { PageHeader } from "@/components/site/page-header";
import { Container, Notice } from "@/components/ui/primitives";
import { AssessmentForm } from "@/components/forms/assessment-form";
import { activeFramework } from "@/lib/index/service";
import { currentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Commercial Readiness Index", description: "A free, structured assessment of your commercial readiness across six categories." };
export const dynamic = "force-dynamic";

export default async function AssessmentPage() {
  const [fw, user] = await Promise.all([activeFramework(), currentUser().catch(() => null)]);
  return (
    <>
      <PageHeader eyebrow="Commercial Readiness Index" title="Assess your commercial readiness." intro={<>Sixteen questions across six categories, about five minutes. You get an overall score, a category breakdown, your highest-impact gaps and a suggested 90-day focus. Answer &ldquo;Not sure&rdquo; whenever you don&apos;t know: missing information is reported, never scored as zero.</>}>
        <p className="max-w-2xl border-l-2 border-gold pl-4 text-caption text-ivory-70">{fw?.methodologyNote}</p>
      </PageHeader>
      <Container className="py-12">
        {fw ? <AssessmentForm framework={{ categories: fw.categories, criteria: fw.criteria }} defaults={{ name: user?.fullName ?? undefined, email: user?.email }} /> : <Notice tone="warning" title="The assessment is temporarily unavailable." />}
      </Container>
    </>
  );
}
