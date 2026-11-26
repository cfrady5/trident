import Link from "next/link";
import { env } from "@/lib/env";

/** Visible in every non-production environment so dev modes are never mistaken for live integrations. */
export function DevBanner() {
  const e = env();
  if (e.APP_ENV === "production") return null;
  const modes = [e.AUTH_PROVIDER === "local" && "local auth", e.EMAIL_PROVIDER === "dev_outbox" && "email outbox", e.STORAGE_PROVIDER === "local" && "local storage", e.AI_PROVIDER === "none" && "AI off"].filter(Boolean);
  return (
    <div className="border-b border-gold/30 bg-carbon px-5 py-1.5 text-center text-[12px] text-ivory-70">
      <span className="label !text-[10.5px] text-gold">{e.APP_ENV} environment</span>
      <span className="mx-2">·</span>
      {modes.join(" · ") || "all integrations live"}
      {e.EMAIL_PROVIDER === "dev_outbox" && (
        <>
          <span className="mx-2">·</span>
          <Link href="/dev/outbox" className="underline decoration-ivory/30 underline-offset-2 hover:text-ivory">Open outbox</Link>
        </>
      )}
    </div>
  );
}
