// src/hooks/usePermissions.ts
import { useCallback } from "react";

export function usePermissions(activeRole: string) {
  // Normalize the role to lowercase to ensure it matches the database perfectly
  const normalizedRole = (activeRole || "").toLowerCase();

  // Master override for admins
  const isAdmin = normalizedRole === "admin";

  const canCreate = useCallback((_module?: string) => {
    if (isAdmin) return true; // Admins can create anything
    if (normalizedRole === "treasury-staff") return true;
    return false;
  }, [isAdmin, normalizedRole]);

  const canApprove = useCallback(() => {
    if (isAdmin) return true; // Admins can approve anything
    return normalizedRole === "treasury-staff";
  }, [isAdmin, normalizedRole]);

  const canDelete = useCallback(() => {
    return isAdmin; // ONLY Admins can delete records
  }, [isAdmin]);

  const canViewAudit = useCallback(() => {
    if (isAdmin) return true; // Admins can view audit logs
    return normalizedRole === "auditor";
  }, [isAdmin, normalizedRole]);

  const canManageUsers = useCallback(() => {
    return isAdmin; // ONLY Admins can view the User Management tab
  }, [isAdmin]);

  return { canCreate, canApprove, canDelete, canViewAudit, canManageUsers };
}