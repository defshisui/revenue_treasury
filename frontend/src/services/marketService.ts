export interface LeaseRecord {
  leaseId: string;
  firstName: string;
  lastName: string;
  marketName: string;
  section: string;
  stallNumber: string;
  leaseStatus:
  | "Active"
  | "Termination Requested"
  | "For Termination"
  | "Terminated"
  | "Inactive"
  | "Archived";
  amountDue: number;
  helperApprovalStatus: string;
  advancePaymentStatus: string;
  paymentStatus:
  | "Pending Payment"
  | "For Payment Verification"
  | "Payment Information Requested"
  | "Flagged Mismatch / Proof Required"
  | "Proof Submitted - For Treasury Verification"
  | "Paid"
  | string;
  paymentMethod?: string;
  officialReceiptNumber?: string;
  paymentReference?: string;
  paymentProof?: string;
  mismatchNotes?: string;
  paymentDate?: string;
}

export function detectPaymentMethod(record?: Record<string, any> | null): string {
  if (!record) return "Cash / Direct";
  const method = record.paymentMethod || record.payment_method;
  if (method && method.trim() !== "" && method.trim() !== "Not Specified") {
    return method.trim();
  }
  const receipt = record.officialReceiptNumber || record.official_receipt_number || "";
  const ref = record.paymentReference || record.payment_reference || "";

  if (receipt.startsWith("OR-PM") || receipt.includes("PM") || ref.includes("TRX") || ref.toLowerCase().includes("paymongo")) {
    return "PayMongo (QR Ph)";
  }
  if (receipt.startsWith("OR-GCASH") || receipt.includes("GCASH")) {
    return "GCash";
  }
  if (receipt.startsWith("OR-MAYA") || receipt.includes("MAYA")) {
    return "Maya";
  }
  if (receipt.startsWith("OR-LB") || receipt.includes("LINKBIZ")) {
    return "Landbank Link.BizPortal";
  }
  return "Cash / Direct";
}

import { API_BASE_URL } from "../config/api";

const MODE: "LOCALSTORAGE" | "ONLINE" = "ONLINE";

export async function getLeases(): Promise<LeaseRecord[]> {
  const localData = localStorage.getItem("market_leases");
  let localList: LeaseRecord[] = [];
  try {
    localList = localData ? JSON.parse(localData) : [];
  } catch {
    localList = [];
  }

  let deletedIds: string[] = [];
  try {
    const deletedRaw = localStorage.getItem("deleted_market_lease_ids");
    deletedIds = deletedRaw ? JSON.parse(deletedRaw) : [];
  } catch {
    deletedIds = [];
  }

  const isDeleted = (id?: string) => {
    if (!id) return false;
    const lower = String(id).trim().toLowerCase();
    return deletedIds.some((d) => d.trim().toLowerCase() === lower);
  };

  // Filter out any deleted leases from local cache
  localList = localList.filter((l) => !isDeleted(l.leaseId));

  if (MODE === "ONLINE") {
    try {
      const res = await fetch(`${API_BASE_URL}/market-leases`);

      if (res.ok) {
        const serverList = await res.json();
        if (Array.isArray(serverList)) {
          // Exclude any deleted leases from server response
          const activeServerList = serverList.filter((srv: any) => !isDeleted(srv.leaseId));

          const merged = activeServerList.map((srv: any) => {
            const loc = localList.find((l: any) => l.leaseId === srv.leaseId);
            if (loc) {
              const isLocallyArchived = String(loc.leaseStatus || "").trim().toLowerCase() === "archived";
              return {
                ...srv,
                ...loc,
                leaseStatus: isLocallyArchived ? "Archived" : (srv.leaseStatus || loc.leaseStatus),
              };
            }
            return srv;
          });

          localList.forEach((loc: any) => {
            if (!merged.some((m: any) => m.leaseId === loc.leaseId)) {
              merged.push(loc);
            }
          });

          localStorage.setItem("market_leases", JSON.stringify(merged));
          return merged;
        }
      }
    } catch (error) {
      console.warn("Online fetch error, using local market leases cache:", error);
    }
  }

  return localList;
}

export async function saveLease(newLease: LeaseRecord): Promise<void> {
  const payload = {
    ...newLease,
    paymentMethod:
      newLease.paymentMethod && newLease.paymentMethod.trim() !== ""
        ? newLease.paymentMethod
        : detectPaymentMethod(newLease),
  };

  try {
    const deletedRaw = localStorage.getItem("deleted_market_lease_ids");
    if (deletedRaw) {
      const deletedList: string[] = JSON.parse(deletedRaw);
      const filtered = deletedList.filter((d) => d.trim().toLowerCase() !== payload.leaseId.trim().toLowerCase());
      localStorage.setItem("deleted_market_lease_ids", JSON.stringify(filtered));
    }
  } catch (e) {
    // ignore
  }

  if (MODE === "ONLINE") {
    try {
      const res = await fetch(`${API_BASE_URL}/market-leases`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });


      const responseText = await res.text();

      let responseBody: any = {};

      try {
        responseBody = responseText ? JSON.parse(responseText) : {};
      } catch {
        responseBody = {};
      }

      if (!res.ok) {
        const errorMessage =
          responseBody.message ||
          responseBody.error ||
          responseText ||
          `Failed to save lease to database (Status: ${res.status})`;

        console.error("Market lease save failed:", {
          status: res.status,
          statusText: res.statusText,
          response: responseBody,
          payload,
        });

        throw new Error(errorMessage);
      }

      console.log("Market lease saved successfully:", payload);
      return;
    } catch (error) {
      console.error("Online save error:", error);
      throw error;
    }
  }


  const existing = await getLeases();
  const updated = [payload, ...existing];

  localStorage.setItem("market_leases", JSON.stringify(updated));
}

export async function updateLease(
  updatedRecord: LeaseRecord
): Promise<void> {
  const payload = {
    ...updatedRecord,
    paymentMethod:
      updatedRecord.paymentMethod &&
        updatedRecord.paymentMethod.trim() !== ""
        ? updatedRecord.paymentMethod
        : detectPaymentMethod(updatedRecord),
  };

  try {
    const localData = localStorage.getItem("market_leases");
    const localList = localData ? JSON.parse(localData) : [];
    const idx = localList.findIndex((l: any) => l.leaseId === payload.leaseId);
    if (idx >= 0) {
      localList[idx] = payload;
    } else {
      localList.unshift(payload);
    }
    localStorage.setItem("market_leases", JSON.stringify(localList));
  } catch (e) {
    // ignore localStorage sync error
  }

  if (MODE === "ONLINE") {
    try {
      const targetId = encodeURIComponent(payload.leaseId || (payload as any).id || "");
      const res = await fetch(
        `${API_BASE_URL}/market-leases/${targetId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const responseText = await res.text();

      let responseBody: any = {};

      try {
        responseBody = responseText ? JSON.parse(responseText) : {};
      } catch {
        responseBody = {};
      }

      if (!res.ok) {
        const errorMessage =
          responseBody.message ||
          responseBody.error ||
          responseText ||
          `Failed to update lease in database (Status: ${res.status})`;

        console.error("Market lease update failed:", {
          status: res.status,
          statusText: res.statusText,
          response: responseBody,
          payload,
        });

        throw new Error(errorMessage);
      }

      return;
    } catch (error) {
      console.error("Online update error:", error);
      throw error;
    }
  }


  const existing = await getLeases();

  const updated = existing.map((item) =>
    item.leaseId === payload.leaseId ? payload : item
  );

  localStorage.setItem("market_leases", JSON.stringify(updated));
}

export async function deleteLease(leaseId: string): Promise<void> {
  const cleanId = (leaseId || "").trim();
  if (!cleanId) return;

  // 1. Immediately remove from local market_leases cache
  try {
    const localData = localStorage.getItem("market_leases");
    if (localData) {
      const localList: LeaseRecord[] = JSON.parse(localData);
      const updated = localList.filter(
        (item: any) =>
          item.leaseId !== cleanId &&
          String(item.leaseId || "").trim().toLowerCase() !== cleanId.toLowerCase()
      );
      localStorage.setItem("market_leases", JSON.stringify(updated));
    }
  } catch (e) {
    console.warn("Error removing from local market_leases cache:", e);
  }

  // 2. Track deleted ID so polling never revives it
  try {
    const deletedRaw = localStorage.getItem("deleted_market_lease_ids");
    const deletedList: string[] = deletedRaw ? JSON.parse(deletedRaw) : [];
    if (!deletedList.some((d) => d.trim().toLowerCase() === cleanId.toLowerCase())) {
      deletedList.push(cleanId);
      localStorage.setItem("deleted_market_lease_ids", JSON.stringify(deletedList));
    }
  } catch (e) {
    console.warn("Error saving to deleted_market_lease_ids:", e);
  }

  // 3. Delete from backend database
  if (MODE === "ONLINE") {
    try {
      const targetId = encodeURIComponent(cleanId);
      const res = await fetch(`${API_BASE_URL}/market-leases/${targetId}`, {
        method: "DELETE",
      });

      const responseText = await res.text();
      let responseBody: any = {};
      try {
        responseBody = responseText ? JSON.parse(responseText) : {};
      } catch {
        responseBody = {};
      }

      if (!res.ok) {
        const errorMessage =
          responseBody.message ||
          responseBody.error ||
          responseText ||
          `Failed to delete lease from database (Status: ${res.status})`;
        console.error("Online delete error:", errorMessage);
        throw new Error(errorMessage);
      }

      return;
    } catch (error) {
      console.error("Online delete error:", error);
      throw error;
    }
  }
}