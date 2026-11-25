"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GOALS, HEARD_FROM, MONTHLY_LEADS, ROLES, TEAM_SIZES } from "./options";

export type OnboardingState = { error?: string };

const text = (fd: FormData, k: string, max = 200) => String(fd.get(k) ?? "").trim().slice(0, max);
const oneOf = (value: string, list: readonly string[]) => (list.includes(value) ? value : "");

/** UK numbers typed as 07… become +447…; anything else must already start with + and the country code. */
function normalisePhone(raw: string) {
  const digits = raw.replace(/[\s()-]/g, "");
  if (!digits) return null;
  if (/^07\d{9}$/.test(digits)) return "+44" + digits.slice(1);
  if (/^\+[1-9]\d{6,14}$/.test(digits)) return digits;
  return "invalid";
}

function normaliseWebsite(raw: string) {
  if (!raw) return null;
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(url).toString();
  } catch {
    return "invalid";
  }
}

// Saves the person's profile, then creates their workspace with the lead-gen pipeline.
export async function finishOnboarding(_prev: OnboardingState, fd: FormData): Promise<OnboardingState> {
  const fullName = text(fd, "full_name", 120);
  // "Other" comes with the person's own words in a box underneath.
  const pick = (value: string, otherField: string) => (value === "Other" ? text(fd, otherField, 60) || null : value);
  const roleChoice = oneOf(text(fd, "role"), ROLES);
  const role = roleChoice ? pick(roleChoice, "role_other") : null;
  const phone = normalisePhone(text(fd, "phone", 30));
  const businessName = text(fd, "business_name", 80);
  const website = normaliseWebsite(text(fd, "website", 200));
  // Industry is free text: people pick a suggestion or type their own niche.
  const industryTyped = text(fd, "industry", 60);
  const industry = industryTyped && industryTyped !== "Other" ? industryTyped : text(fd, "industry_other", 60) || null;
  const teamSize = oneOf(text(fd, "team_size"), TEAM_SIZES);
  const goals = fd.getAll("goals").map(String).filter((g) => (GOALS as readonly string[]).includes(g));
  const monthlyLeads = oneOf(text(fd, "monthly_leads"), MONTHLY_LEADS);
  const heardChoice = oneOf(text(fd, "heard_from"), HEARD_FROM);
  const heardFrom = heardChoice ? pick(heardChoice, "heard_from_other") ?? "Other" : null;

  if (!fullName || !role) return { error: roleChoice === "Other" ? "Tell us your role." : "Add your name and role." };
  if (phone === "invalid") return { error: "Enter your phone number like 07700 900123, or with the country code, like +44 7700 900123." };
  if (businessName.length < 2) return { error: "Add your business name." };
  if (website === "invalid") return { error: "That website address doesn't look right." };
  if (!industry || !teamSize) return { error: !industry ? "Tell us your industry or niche." : "Choose your team size." };
  if (goals.length === 0) return { error: "Choose at least one thing you want Scalency to help with." };
  if (!monthlyLeads) return { error: "Choose roughly how many leads you get each month." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { error: profileError } = await supabase.from("profiles").upsert({
    user_id: auth.user.id,
    full_name: fullName,
    job_title: role,
    phone,
    email: auth.user.email,
  });
  if (profileError) return { error: "We couldn't save your details. Please try again." };

  const { error: workspaceError } = await supabase.rpc("create_my_workspace", {
    business_name: businessName,
    details: { website, industry, team_size: teamSize, goals, monthly_leads: monthlyLeads, heard_from: heardFrom || null },
  });
  if (workspaceError) return { error: "We couldn't create your workspace. Please try again." };

  redirect("/ai-builder?welcome=1");
}
