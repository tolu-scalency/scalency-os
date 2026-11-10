"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GOALS, HEARD_FROM, INDUSTRIES, MONTHLY_LEADS, ROLES, TEAM_SIZES } from "./options";

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
  const role = oneOf(text(fd, "role"), ROLES);
  const phone = normalisePhone(text(fd, "phone", 30));
  const businessName = text(fd, "business_name", 80);
  const website = normaliseWebsite(text(fd, "website", 200));
  const industry = oneOf(text(fd, "industry"), INDUSTRIES);
  const teamSize = oneOf(text(fd, "team_size"), TEAM_SIZES);
  const goals = fd.getAll("goals").map(String).filter((g) => (GOALS as readonly string[]).includes(g));
  const monthlyLeads = oneOf(text(fd, "monthly_leads"), MONTHLY_LEADS);
  const heardFrom = oneOf(text(fd, "heard_from"), HEARD_FROM);

  if (!fullName || !role) return { error: "Add your name and role." };
  if (phone === "invalid") return { error: "Enter your phone number like 07700 900123, or with the country code, like +44 7700 900123." };
  if (businessName.length < 2) return { error: "Add your business name." };
  if (website === "invalid") return { error: "That website address doesn't look right." };
  if (!industry || !teamSize) return { error: "Choose your industry and team size." };
  if (goals.length === 0) return { error: "Choose at least one thing you want Scalency OS to help with." };
  if (!monthlyLeads) return { error: "Choose roughly how many leads you get each month." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { error: profileError } = await supabase.from("profiles").upsert({
    user_id: auth.user.id,
    full_name: fullName,
    job_title: role,
    phone,
  });
  if (profileError) return { error: "We couldn't save your details. Please try again." };

  const { error: workspaceError } = await supabase.rpc("create_my_workspace", {
    business_name: businessName,
    details: { website, industry, team_size: teamSize, goals, monthly_leads: monthlyLeads, heard_from: heardFrom || null },
  });
  if (workspaceError) return { error: "We couldn't create your workspace. Please try again." };

  redirect("/dashboard");
}
