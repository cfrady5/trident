/** Client-facing language for internal states. */
export const APPLICATION_STATUS: Record<string, { label: string; tone: "neutral" | "gold" | "warn" | "danger" | "ok"; client: string }> = {
  draft: { label: "Draft", tone: "neutral", client: "Not yet submitted. Your progress is saved." },
  submitted: { label: "Submitted", tone: "gold", client: "Received. A strategist will review it." },
  under_review: { label: "Under review", tone: "gold", client: "A strategist is reviewing your application and public information about your company." },
  needs_information: { label: "Information requested", tone: "warn", client: "We need a little more information. Update your application and submit again." },
  accepted: { label: "Accepted", tone: "ok", client: "We'd like to work with you. Expect a message about next steps." },
  declined: { label: "Not a fit right now", tone: "neutral", client: "We don't think we're the right fit at this stage." },
  withdrawn: { label: "Withdrawn", tone: "neutral", client: "This application was withdrawn." },
};

export const STAGE_LABEL: Record<string, string> = {
  identified: "Identified", invited: "Invited", application_started: "Application started", application_submitted: "Application submitted",
  research_in_progress: "Research in progress", assessment_in_progress: "Assessment in progress", assessment_reviewed: "Assessment reviewed",
  qualified: "Qualified", discovery_scheduled: "Discovery scheduled", discovery_completed: "Discovery completed", proposal_generated: "Proposal generated",
  proposal_sent: "Proposal sent", negotiation: "Negotiation", closed_won: "Closed won", closed_lost: "Closed lost", nurture: "Nurture", active_client: "Active client",
};

export const PIPELINE_STAGES = Object.keys(STAGE_LABEL);
