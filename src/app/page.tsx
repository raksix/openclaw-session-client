import { redirect } from "next/navigation";

export default function Home() {
  // For now, redirect to login
  // In future, check auth status and redirect accordingly
  redirect("/login");
}
