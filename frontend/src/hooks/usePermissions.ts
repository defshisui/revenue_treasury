// src/hooks/usePermissions.ts
import { useCallback } from "react";

export function usePermissions(activeRole: string) {
  // Normalize the role to lowercase to ensure it matches the database perfectly
  const normalizedRole = (activeRole || "").toLowerCase();

  // Prefix with underscore to fix the "value is never read" warning
  const canCreate = useCallback((_module?: string) => {
    // Admins and staff can create/process records; Auditors cannot.
    if (normalizedRole === "admin") return true;
    if (normalizedRole === "treasury-staff") return true;
    if (normalizedRole === "auditor") return false;
    return false;
  }, [normalizedRole]);

  const canApprove = useCallback(() => {
    // Admins and staff can approve applications
    return ["admin", "treasury-staff"].includes(normalizedRole);
  }, [normalizedRole]);

  const canDelete = useCallback(() => {
    // Strictly ONLY admins can delete records (like deleting users or applications)
    return ["admin"].includes(normalizedRole);
  }, [normalizedRole]);

  const canViewAudit = useCallback(() => {
    // Admins and Auditors can view the system audit trail
    return ["admin", "auditor"].includes(normalizedRole);
  }, [normalizedRole]);

  const canManageUsers = useCallback(() => {
    // Strictly ONLY admins can access the User Management tab
    return ["admin"].includes(normalizedRole);
  }, [normalizedRole]);

  return { canCreate, canApprove, canDelete, canViewAudit, canManageUsers };
}