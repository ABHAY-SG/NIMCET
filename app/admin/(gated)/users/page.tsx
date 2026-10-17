import { redirect } from "next/navigation";

// The old aggregated "Users" page is superseded by /admin/students (real
// Auth-backed data). Keep the route alive so old bookmarks never 404.
export default function UsersRedirect() {
  redirect("/admin/students");
}
