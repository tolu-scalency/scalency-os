import { redirect } from "next/navigation";

// The app opens on the dashboard. Login comes in the next step.
export default function Home() {
  redirect("/dashboard");
}
