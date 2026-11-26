import { Container, Eyebrow } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <Container className="max-w-[640px] py-28">
      <Eyebrow>Permission required</Eyebrow>
      <h1 className="mt-5 font-display text-[2.5rem] font-bold leading-tight">You don&apos;t have access to this page.</h1>
      <p className="mt-4 text-ivory-70">If you think you should, ask a Trident administrator to check your role.</p>
      <ButtonLink href="/portal" variant="secondary" className="mt-8">Go to your portal</ButtonLink>
    </Container>
  );
}
