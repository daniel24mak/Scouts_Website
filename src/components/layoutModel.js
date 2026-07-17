export function isDashboardPath(pathname = "") {
  return pathname === "/dashboard"
    || pathname.startsWith("/dashboard/")
    || pathname.startsWith("/admin")
    || pathname.startsWith("/chiefs");
}
