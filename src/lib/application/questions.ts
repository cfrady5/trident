/**
 * Company application definition. One source for the form UI, server-side
 * validation, conditional logic, the review screen and the mapping of answers
 * into the company intelligence profile. Pure module (client + server safe).
 */

export type QuestionType = "text" | "textarea" | "url" | "email" | "select" | "multiselect" | "credentials";

export interface Option {
  value: string;
  label: string;
}

export interface Question {
  key: string;
  stage: number;
  label: string;
  help?: string;
  type: QuestionType;
  options?: Option[];
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  showIf?: { key: string; equals: string[] };
  /** Section of the company intelligence profile this answer populates. */
  factSection?: string;
}

export interface Stage {
  number: number;
  slug: string;
  title: string;
  intro: string;
}

export const STAGES: Stage[] = [
  { number: 1, slug: "company", title: "Company identification", intro: "The basics. This creates your company profile." },
  { number: 2, slug: "technology", title: "Technology profile", intro: "What you've built and the problem it solves, in your words." },
  { number: 3, slug: "validation", title: "Validation and traction", intro: "Awards, selections and milestones. Each claim can carry a source so we present it exactly." },
  { number: 4, slug: "objectives", title: "Commercial objectives", intro: "Where you want to sell and what's in the way." },
  { number: 5, slug: "brand", title: "Brand and marketing", intro: "What exists today. Upload what you have; nothing needs to be polished." },
  { number: 6, slug: "engagement", title: "Engagement preferences", intro: "Budget and timing help us recommend the right scope, not the biggest one." },
  { number: 7, slug: "review", title: "Review and submit", intro: "Confirm everything is accurate before you submit." },
];

const opts = (...pairs: [string, string][]): Option[] => pairs.map(([value, label]) => ({ value, label }));

export const INDUSTRIES = opts(
  ["defense", "Defense and national security"], ["aerospace", "Aerospace and space"], ["advanced_manufacturing", "Advanced manufacturing"],
  ["energy", "Energy and climate"], ["health", "Health and biotechnology"], ["software_ai", "Software, data and AI"],
  ["communications", "Communications and networking"], ["materials", "Advanced materials"], ["other", "Other emerging technology"],
);

export const BUYER_TYPES = opts(
  ["defense_programs", "Defense programs"], ["prime_contractors", "Prime contractors"], ["commercial_enterprise", "Commercial enterprises"],
  ["commercial_operators", "Commercial operators"], ["civil_agencies", "Civil agencies"], ["state_local", "State and local government"],
  ["investors", "Investors"], ["research_institutions", "Research institutions"], ["channel_partners", "Channel partners"],
);

export const QUESTIONS: Question[] = [
  // Stage 1
  { key: "company_name", stage: 1, label: "Company name", type: "text", required: true, maxLength: 200, factSection: "corporate_identity" },
  { key: "website", stage: 1, label: "Website", type: "url", required: true, placeholder: "https://", help: "We review your public website as part of the research we run after you submit.", factSection: "digital_assets" },
  { key: "industry", stage: 1, label: "Primary industry", type: "select", options: INDUSTRIES, required: true, factSection: "corporate_identity" },
  { key: "headquarters", stage: 1, label: "Headquarters", type: "text", required: true, placeholder: "City, State", maxLength: 120, factSection: "corporate_identity" },
  { key: "employee_range", stage: 1, label: "Employees", type: "select", required: true, options: opts(["1-10", "1 to 10"], ["11-25", "11 to 25"], ["26-50", "26 to 50"], ["51-200", "51 to 200"], ["201+", "More than 200"]), factSection: "corporate_identity" },
  { key: "contact_name", stage: 1, label: "Your name", type: "text", required: true, maxLength: 120 },
  { key: "contact_role", stage: 1, label: "Your role", type: "text", required: true, maxLength: 120 },
  { key: "linkedin_url", stage: 1, label: "LinkedIn company page", type: "url", placeholder: "https://www.linkedin.com/company/…", factSection: "digital_assets" },
  { key: "company_maturity", stage: 1, label: "Company stage", type: "select", required: true, options: opts(["pre_seed", "Pre-seed or research spinout"], ["seed", "Seed"], ["early", "Early revenue"], ["growth", "Growth"], ["established", "Established"]), factSection: "corporate_identity" },

  // Stage 2
  { key: "technology_name", stage: 2, label: "Technology or product name", type: "text", required: true, maxLength: 160, factSection: "technology" },
  { key: "technology_description", stage: 2, label: "Describe the technology", help: "Plain language is best. Do not include export-controlled technical data.", type: "textarea", required: true, maxLength: 3000, factSection: "technology" },
  { key: "problem_solved", stage: 2, label: "What problem does it solve, and for whom?", type: "textarea", required: true, maxLength: 2000, factSection: "technology" },
  { key: "core_differentiators", stage: 2, label: "What makes it different from the alternatives?", type: "textarea", required: true, maxLength: 2000, factSection: "technology" },
  { key: "product_maturity", stage: 2, label: "Product maturity", type: "select", required: true, options: opts(["research", "Research or proof of concept"], ["prototype", "Working prototype"], ["pilot", "Pilot or field testing"], ["early_commercial", "Early commercial availability"], ["scaling", "Commercially available and scaling"]), factSection: "product" },
  { key: "commercial_use_cases", stage: 2, label: "Commercial use cases", type: "textarea", maxLength: 2000, factSection: "market" },
  { key: "existing_customers", stage: 2, label: "Existing customers you can name publicly", help: "Only list customers who have agreed to be named.", type: "textarea", maxLength: 1000, factSection: "credential" },
  { key: "technical_capabilities", stage: 2, label: "Primary technical capabilities", type: "textarea", maxLength: 2000, factSection: "technology" },
  { key: "commercial_availability", stage: 2, label: "Can a commercial customer buy it today?", type: "select", options: opts(["no", "Not yet"], ["pilot", "Through a pilot or early-access program"], ["yes", "Yes"]), factSection: "product" },
  { key: "roadmap_summary", stage: 2, label: "Product roadmap, in a few sentences", type: "textarea", maxLength: 1500, factSection: "product" },

  // Stage 3
  { key: "sbir_status", stage: 3, label: "Small Business Innovation Research (SBIR) or Small Business Technology Transfer (STTR) status", type: "select", required: true, options: opts(["awarded", "We have received an award"], ["applied", "We have applied"], ["none", "Not applicable"]), factSection: "credential" },
  { key: "sbir_agency", stage: 3, label: "Awarding agency", type: "text", maxLength: 160, showIf: { key: "sbir_status", equals: ["awarded"] }, factSection: "credential" },
  { key: "sbir_phase", stage: 3, label: "Most recent phase", type: "select", options: opts(["phase_i", "Phase I"], ["phase_ii", "Phase II"], ["phase_iii", "Phase III"], ["direct_to_phase_ii", "Direct to Phase II"]), showIf: { key: "sbir_status", equals: ["awarded"] }, factSection: "credential" },
  { key: "credentials", stage: 3, label: "Awards, selections, contracts and milestones", help: "Add each one with a public source if you have it. Use exact status language: for example, 'Selected as Awardable on [marketplace]', not 'won a contract'.", type: "credentials", factSection: "credential" },
  { key: "funding_stage", stage: 3, label: "Private funding", type: "select", options: opts(["none", "None"], ["grants_only", "Grants and awards only"], ["pre_seed", "Pre-seed"], ["seed", "Seed"], ["series_a", "Series A"], ["series_b_plus", "Series B or later"]), factSection: "credential" },
  { key: "revenue_range", stage: 3, label: "Annual revenue", help: "Kept internal. Used to recommend a realistic scope.", type: "select", options: opts(["pre_revenue", "Pre-revenue"], ["under_250k", "Under $250K"], ["250k_1m", "$250K to $1M"], ["1m_5m", "$1M to $5M"], ["over_5m", "Over $5M"], ["prefer_not", "Prefer not to say"]), factSection: "credential" },
  { key: "patents_certifications", stage: 3, label: "Patents or certifications", type: "textarea", maxLength: 1000, factSection: "credential" },

  // Stage 4
  { key: "target_industries", stage: 4, label: "Target industries", type: "multiselect", options: INDUSTRIES, factSection: "market" },
  { key: "target_buyers", stage: 4, label: "Target buyer types", type: "multiselect", options: BUYER_TYPES, required: true, factSection: "market" },
  { key: "commercial_markets", stage: 4, label: "Commercial markets you're pursuing", type: "textarea", maxLength: 1500, factSection: "market" },
  { key: "acquisition_challenges", stage: 4, label: "What makes winning customers hard today?", type: "textarea", maxLength: 1500, factSection: "objectives" },
  { key: "current_sales_process", stage: 4, label: "How do you sell today?", type: "textarea", maxLength: 1500, factSection: "objectives" },
  { key: "priority_opportunities", stage: 4, label: "Priority commercial opportunities", type: "textarea", maxLength: 1500, factSection: "objectives" },
  { key: "desired_outcomes", stage: 4, label: "What would success look like in 12 months?", type: "textarea", required: true, maxLength: 1500, factSection: "objectives" },
  { key: "upcoming_milestones", stage: 4, label: "Upcoming milestones", help: "Launches, raises, conferences, pitch deadlines.", type: "textarea", maxLength: 1000, factSection: "objectives" },
  { key: "commercialization_timeline", stage: 4, label: "When do you need commercial traction?", type: "select", required: true, options: opts(["0_3", "Within 3 months"], ["3_6", "3 to 6 months"], ["6_12", "6 to 12 months"], ["12_plus", "More than 12 months"]), factSection: "objectives" },

  // Stage 5
  { key: "has_brand_guidelines", stage: 5, label: "Do you have brand guidelines?", type: "select", options: opts(["yes", "Yes"], ["partial", "A logo and some colors"], ["no", "No"]), factSection: "brand" },
  { key: "brand_colors", stage: 5, label: "Brand colors", placeholder: "#000000, #E6A73B", type: "text", maxLength: 300, showIf: { key: "has_brand_guidelines", equals: ["yes", "partial"] }, factSection: "brand" },
  { key: "brand_fonts", stage: 5, label: "Brand fonts", type: "text", maxLength: 300, showIf: { key: "has_brand_guidelines", equals: ["yes", "partial"] }, factSection: "brand" },
  { key: "social_accounts", stage: 5, label: "Social media accounts", type: "textarea", placeholder: "One URL per line", maxLength: 1000, factSection: "digital_assets" },
  { key: "marketing_staff", stage: 5, label: "Who handles marketing today?", type: "select", options: opts(["nobody", "Nobody specifically"], ["founder", "A founder"], ["part_time", "A part-time person or contractor"], ["dedicated", "A dedicated person or team"]), factSection: "preferences" },
  { key: "current_marketing_activities", stage: 5, label: "Current marketing activities", type: "textarea", maxLength: 1500, factSection: "preferences" },
  { key: "known_competitors", stage: 5, label: "Known competitors or alternatives", type: "textarea", maxLength: 1000, factSection: "competitor" },
  { key: "brand_preferences", stage: 5, label: "Brand preferences", help: "Brands you admire, things to avoid.", type: "textarea", maxLength: 1000, factSection: "brand" },

  // Stage 6
  { key: "services_of_interest", stage: 6, label: "Services of interest", type: "multiselect", options: [], factSection: "preferences" },
  { key: "monthly_budget", stage: 6, label: "Monthly marketing budget", type: "select", required: true, options: opts(["under_1500", "Under $1,500"], ["1500_3500", "$1,500 to $3,500"], ["3500_6500", "$3,500 to $6,500"], ["6500_plus", "Over $6,500"], ["undecided", "Not yet decided"]), factSection: "preferences" },
  { key: "project_budget", stage: 6, label: "One-time project budget", type: "select", required: true, options: opts(["under_2500", "Under $2,500"], ["2500_7500", "$2,500 to $7,500"], ["7500_20000", "$7,500 to $20,000"], ["20000_plus", "Over $20,000"], ["undecided", "Not yet decided"]), factSection: "preferences" },
  { key: "desired_start", stage: 6, label: "Desired start", type: "select", options: opts(["asap", "As soon as possible"], ["1_month", "Within a month"], ["quarter", "This quarter"], ["later", "Later"]), factSection: "preferences" },
  { key: "decision_authority", stage: 6, label: "Your role in the decision", type: "select", required: true, options: opts(["decision_maker", "I make the decision"], ["recommender", "I recommend; someone else approves"], ["researching", "I'm researching options"]), factSection: "preferences" },
  { key: "approval_process", stage: 6, label: "Internal approval process", type: "textarea", maxLength: 800, factSection: "preferences" },
  { key: "engagement_objectives", stage: 6, label: "Primary objectives for working with Trident", type: "textarea", required: true, maxLength: 1500, factSection: "preferences" },
];

export const CONSENTS = [
  {
    key: "processing",
    version: "2026-11-v1",
    statement: "I agree that Trident may store and process the information and files in this application to evaluate and deliver services, as described in the privacy policy.",
  },
  {
    key: "public_research",
    version: "2026-11-v1",
    statement: "I agree that Trident may research publicly available information about my company, including our public website, to prepare an internal assessment.",
  },
  {
    key: "no_restricted_information",
    version: "2026-11-v1",
    statement: "I confirm this application and its files contain no classified information, controlled unclassified information (CUI), export-controlled technical data, confidential third-party information or other information Trident is not authorized to process.",
  },
] as const;

export type ConsentKey = (typeof CONSENTS)[number]["key"];

export interface CredentialEntry {
  type: "sbir_award" | "sttr_award" | "marketplace_selection" | "contract" | "funding_round" | "patent" | "certification" | "milestone" | "other";
  title: string;
  agency?: string;
  identifier?: string;
  date?: string;
  sourceUrl?: string;
  publiclyShareable?: boolean;
}

export const CREDENTIAL_TYPES: Option[] = opts(
  ["sbir_award", "SBIR award"], ["sttr_award", "STTR award"], ["marketplace_selection", "Marketplace selection (for example, Awardable)"],
  ["contract", "Publicly disclosed contract"], ["funding_round", "Funding round"], ["patent", "Patent"], ["certification", "Certification"],
  ["milestone", "Public milestone"], ["other", "Other"],
);

export type Answers = Record<string, unknown>;

export function isVisible(q: Question, answers: Answers): boolean {
  if (!q.showIf) return true;
  const v = answers[q.showIf.key];
  return typeof v === "string" && q.showIf.equals.includes(v);
}

const URL_RE = /^https?:\/\/[^\s/$.?#][^\s]*\.[^\s]+$/i;

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);
}

/** Returns an error message or null. Normalization lives in normalizeAnswer. */
export function validateAnswer(q: Question, value: unknown, serviceSlugs: string[] = []): string | null {
  if (isEmpty(value)) return q.required ? `${q.label} is required.` : null;
  switch (q.type) {
    case "text":
    case "textarea":
    case "email":
      if (typeof value !== "string") return "Enter text.";
      if (q.maxLength && value.length > q.maxLength) return `Keep this under ${q.maxLength} characters.`;
      if (q.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Enter a valid email address.";
      return null;
    case "url": {
      if (typeof value !== "string") return "Enter a URL.";
      const v = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
      return URL_RE.test(v) && v.length <= 500 ? null : "Enter a valid web address.";
    }
    case "select":
      return typeof value === "string" && (q.options ?? []).some((o) => o.value === value) ? null : "Choose an option.";
    case "multiselect": {
      if (!Array.isArray(value) || value.length > 30) return "Choose from the list.";
      const allowed = q.key === "services_of_interest" ? serviceSlugs : (q.options ?? []).map((o) => o.value);
      return value.every((v) => typeof v === "string" && allowed.includes(v)) ? null : "Choose from the list.";
    }
    case "credentials": {
      if (!Array.isArray(value) || value.length > 25) return "Add up to 25 entries.";
      for (const [i, c] of value.entries()) {
        const e = c as CredentialEntry;
        if (!e || typeof e !== "object") return `Entry ${i + 1} is invalid.`;
        if (!CREDENTIAL_TYPES.some((t) => t.value === e.type)) return `Entry ${i + 1}: choose a type.`;
        if (typeof e.title !== "string" || !e.title.trim() || e.title.length > 200) return `Entry ${i + 1}: add a short title.`;
        if (e.sourceUrl && (typeof e.sourceUrl !== "string" || !URL_RE.test(e.sourceUrl))) return `Entry ${i + 1}: the source must be a full URL.`;
        if (e.date && (typeof e.date !== "string" || !/^\d{4}-\d{2}(-\d{2})?$/.test(e.date))) return `Entry ${i + 1}: use YYYY-MM or YYYY-MM-DD.`;
        for (const f of ["agency", "identifier"] as const) if (e[f] && (typeof e[f] !== "string" || e[f]!.length > 200)) return `Entry ${i + 1}: ${f} is too long.`;
      }
      return null;
    }
  }
}

export function normalizeAnswer(q: Question, value: unknown): unknown {
  if (typeof value === "string") {
    const t = value.trim();
    if (q.type === "url" && t && !/^https?:\/\//i.test(t)) return `https://${t}`;
    return t;
  }
  return value;
}

export function questionsForStage(stage: number): Question[] {
  return QUESTIONS.filter((q) => q.stage === stage);
}

export function stageErrors(stage: number, answers: Answers, serviceSlugs: string[] = []): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const q of questionsForStage(stage)) {
    if (!isVisible(q, answers)) continue;
    const err = validateAnswer(q, answers[q.key], serviceSlugs);
    if (err) errors[q.key] = err;
  }
  return errors;
}

export function allErrors(answers: Answers, serviceSlugs: string[] = []): Record<string, string> {
  return Object.assign({}, ...STAGES.slice(0, 6).map((s) => stageErrors(s.number, answers, serviceSlugs)));
}

export function questionByKey(key: string): Question | undefined {
  return QUESTIONS.find((q) => q.key === key);
}

export function displayValue(q: Question, value: unknown): string {
  if (isEmpty(value)) return "—";
  if (q.type === "select") return q.options?.find((o) => o.value === value)?.label ?? String(value);
  if (q.type === "multiselect" && Array.isArray(value)) {
    return value.map((v) => q.options?.find((o) => o.value === v)?.label ?? String(v)).join(", ");
  }
  if (q.type === "credentials" && Array.isArray(value)) return `${value.length} ${value.length === 1 ? "entry" : "entries"}`;
  return String(value);
}

export function stageProgress(answers: Answers): { stage: number; answered: number; total: number }[] {
  return STAGES.slice(0, 6).map((s) => {
    const qs = questionsForStage(s.number).filter((q) => isVisible(q, answers));
    return { stage: s.number, answered: qs.filter((q) => !isEmpty(answers[q.key])).length, total: qs.length };
  });
}
