import { redirect } from "next/navigation";

// This feature isn't live yet; it's listed under "Coming soon" in the sidebar.
export default function ComingSoon() {
  redirect("/dashboard");
}
