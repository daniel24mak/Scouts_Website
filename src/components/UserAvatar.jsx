function getInitials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return `${first}${last}`.toUpperCase();
}

export default function UserAvatar({ user, name, imageUrl, size = 40, className = "" }) {
  const displayName = name ?? user?.name ?? user?.author ?? "User";
  const src = imageUrl ?? user?.profilePictureUrl ?? user?.authorProfilePictureUrl ?? null;
  const initials = getInitials(displayName);
  const style = { "--avatar-size": `${size}px` };

  return (
    <span className={`user-avatar ${className}`.trim()} style={style} aria-label={displayName} title={displayName}>
      {src ? <img src={src} alt="" loading="lazy" decoding="async" /> : <span>{initials}</span>}
    </span>
  );
}
