// The choices shown during onboarding. Kept in one place so the form and the server check agree.
export const ROLES = ["Founder or owner", "Sales", "Marketing", "Operations", "Other"] as const;
export const INDUSTRIES = [
  "Coaching or consulting",
  "Marketing agency",
  "Clinic or health",
  "Courses and education",
  "Home services",
  "Professional services",
  "Other",
] as const;
export const TEAM_SIZES = ["Just me", "2 to 5", "6 to 20", "21 to 50", "More than 50"] as const;
export const GOALS = [
  "Capture and qualify leads",
  "Follow up automatically by text and email",
  "Book more calls",
  "Team chat and lead alerts",
  "Build workflows with AI",
  "Track ads and reports",
] as const;
export const MONTHLY_LEADS = ["Under 50", "50 to 200", "200 to 1,000", "More than 1,000"] as const;
export const HEARD_FROM = ["Referral", "Social media", "Search engine", "Event", "Other"] as const;
