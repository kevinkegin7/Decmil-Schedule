import { redirect } from "next/navigation";

// proxy.ts sends signed-out visitors on to /login.
export default function Home() {
  redirect("/dashboard");
}
