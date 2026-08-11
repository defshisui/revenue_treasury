import { useCallback } from "react";
import type { Role } from "../types/treasury";

export function usePermissions(activeRole: Role) {
  const canCreate = useCallback((module: string) => {
    if (activeRole === "Administrator" || activeRole === "Municipal Treasurer") return true;
    if (activeRole === "Auditor") return false;
    if (activeRole === "Property Assessment Officer" && module === "RPT") return true;
    if (activeRole === "Business Permit Officer" && module === "Business") return true;
    if (activeRole === "Revenue Collector" && module === "Payments") return true;
    if (activeRole === "Data Encoder") return true;
    return false;
  }, [activeRole]);

  const canApprove = useCallback(() => {
    return ["Administrator", "Municipal Treasurer", "Assistant Treasurer"].includes(activeRole);
  }, [activeRole]);

  const canDelete = useCallback(() => {
    return ["Administrator", "Municipal Treasurer"].includes(activeRole);
  }, [activeRole]);

  return { canCreate, canApprove, canDelete };
}
