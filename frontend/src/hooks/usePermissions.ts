import { useCallback } from "react";

export function usePermissions(activeRole: string) {

  const normalizedRole = (activeRole || "").toLowerCase();

  const isAdmin = normalizedRole === "admin";

  const canCreate = useCallback((_module?: string) => {
    if (isAdmin) return true;
    if (normalizedRole === "treasury-staff") return true;
    return false;
  }, [isAdmin, normalizedRole]);

  const canApprove = useCallback(() => {
    if (isAdmin) return true;
    return normalizedRole === "treasury-staff";
  }, [isAdmin, normalizedRole]);

  const canDelete = useCallback(() => {
    return isAdmin;
  }, [isAdmin]);

  const canViewAudit = useCallback(() => {
    if (isAdmin) return true;
    return normalizedRole === "auditor";
  }, [isAdmin, normalizedRole]);

  const canManageUsers = useCallback(() => {
    return isAdmin;
  }, [isAdmin]);

  return { canCreate, canApprove, canDelete, canViewAudit, canManageUsers };
}