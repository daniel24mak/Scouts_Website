export function isAdmin(user) {
  return user?.role === "admin";
}

export function isChief(user) {
  return user?.role === "chief";
}

export function canTakeAttendance(user) {
  return isAdmin(user) || isChief(user);
}

export function canPublishContent(user) {
  return isAdmin(user) || Boolean(user?.permissions?.canPublish);
}

export function canCreateGroupMeetings(user) {
  return isAdmin(user) || Boolean(user?.permissions?.canCreateGroupMeetings);
}

export function canEditScouts(user) {
  return isAdmin(user) || Boolean(user?.permissions?.canEditScouts);
}

export function canManageFormTemplates(user) {
  return isAdmin(user) || Boolean(user?.permissions?.manageFormTemplates);
}

export function canPostForms(user) {
  return isAdmin(user) || Boolean(user?.permissions?.postForms);
}

export function canViewAllForms(user) {
  return isAdmin(user) || Boolean(user?.permissions?.viewAllForms);
}

export function canUseForms(user) {
  return isChief(user) || isAdmin(user) || canManageFormTemplates(user) || canPostForms(user) || canViewAllForms(user);
}

export function canManageSystem(user) {
  return isAdmin(user);
}
