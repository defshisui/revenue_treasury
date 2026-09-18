export interface LeaseRecord {
  id?: string;
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
  let deletedIds: string[] = [];
  try {
    const deletedRaw = localStorage.getItem("deleted_market_lease_ids");
    deletedIds = deletedRaw ? JSON.parse(deletedRaw) : [];
  } catch {
    deletedIds = [];
  }

  const isDeleted = (item?: any) => {
    if (!item) return false;
    const lId = item.leaseId ? String(item.leaseId).trim().toLowerCase() : "";
    const rId = item.id !== undefined && item.id !== null ? String(item.id).trim().toLowerCase() : "";
    const sId = item.lease_id ? String(item.lease_id).trim().toLowerCase() : "";

    return deletedIds.some((d) => {
      const target = d.trim().toLowerCase();
      return (lId && lId === target) || (rId && rId === target) || (sId && sId === target);
    });
  };

  const localData = localStorage.getItem("market_leases");
  let localList: LeaseRecord[] = [];
  try {
    localList = localData ? JSON.parse(localData) : [];
  } catch {
    localList = [];
  }

  // Filter out any deleted leases from local cache
  localList = localList.filter((l) => !isDeleted(l));

  if (MODE === "ONLINE") {
    try {
      const res = await fetch(`${API_BASE_URL}/market-leases`);

      if (res.ok) {
        const serverList = await res.json();
        if (Array.isArray(serverList)) {
          // IMPORTANT:
          // The database/API is the source of truth when ONLINE.
          // Do NOT merge old localStorage records back into the server result.
          // Otherwise, records deleted by an admin from the database can
          // reappear in the citizen portal from an older browser cache.
          const activeServerList = serverList.filter((srv: any) => !isDeleted(srv));

          // Replace the local cache with the current database result.
          // This also clears stale records when the backend returns [].
          localStorage.setItem("market_leases", JSON.stringify(activeServerList));
          return activeServerList;
        }
      }
    } catch (error) {
      // ONLINE mode must not fall back to stale localStorage records.
      // Returning [] prevents deleted database records from reappearing
      // when the API is temporarily unavailable.
      console.warn("Online fetch error; not using stale local market leases cache:", error);
      return [];
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

  if (MODE === "ONLINE") {
    try {
      const targetId = encodeURIComponent(
        payload.leaseId || (payload as any).id || ""
      );

      if (!targetId) {
        throw new Error("Lease ID is required to update this record.");
      }

      // Use the same authentication token as the rest of the admin system.
      const token =
        localStorage.getItem("token") ||
        sessionStorage.getItem("token") ||
        "";

      const res = await fetch(
        `${API_BASE_URL}/market-leases/${targetId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token
              ? {
                  Authorization: `Bearer ${token}`,
                }
              : {}),
          },
          body: JSON.stringify(payload),
        }
      );

      const responseText = await res.text();

      let responseBody: any = {};
      try {
        responseBody = responseText
          ? JSON.parse(responseText)
          : {};
      } catch {
        responseBody = {};
      }

      if (!res.ok) {
        const errorMessage =
          responseBody.error ||
          responseBody.message ||
          responseText ||
          `Failed to update lease in database (Status: ${res.status})`;

        console.error("[updateLease] Backend update failed:", {
          status: res.status,
          statusText: res.statusText,
          url: `${API_BASE_URL}/market-leases/${targetId}`,
          response: responseBody,
          payload,
        });

        throw new Error(errorMessage);
      }

      console.log(
        "[updateLease] Database update successful:",
        responseBody.lease || payload
      );

      // IMPORTANT:
      // Synchronize localStorage ONLY after the database update succeeds.
      // This prevents the browser cache from showing changes that were
      // never actually saved to PostgreSQL.
      try {
        const localData = localStorage.getItem("market_leases");
        const localList: any[] = localData
          ? JSON.parse(localData)
          : [];

        const updatedLease =
          responseBody?.lease || payload;

        const idx = localList.findIndex(
          (item: any) =>
            String(item.leaseId || "").trim().toLowerCase() ===
            String(
              updatedLease.leaseId || payload.leaseId || ""
            )
              .trim()
              .toLowerCase() ||
            (
              item.id !== undefined &&
              updatedLease.id !== undefined &&
              String(item.id).trim() ===
                String(updatedLease.id).trim()
            )
        );

        if (idx >= 0) {
          localList[idx] = {
            ...localList[idx],
            ...updatedLease,
          };
        } else {
          localList.unshift(updatedLease);
        }

        localStorage.setItem(
          "market_leases",
          JSON.stringify(localList)
        );
      } catch (cacheError) {
        console.warn(
          "[updateLease] Database update succeeded, but local cache synchronization failed:",
          cacheError
        );
      }

      return;
    } catch (error) {
      console.error("[updateLease] Online update error:", error);
      throw error;
    }
  }

  // LOCALSTORAGE mode
  const existing = await getLeases();

  const updated = existing.map((item) =>
    item.leaseId === payload.leaseId ? payload : item
  );

  localStorage.setItem(
    "market_leases",
    JSON.stringify(updated)
  );
}

export async function deleteLease(leaseId: string, recordId?: string | number): Promise<void> {
  const cleanId = (leaseId || "").trim();
  const cleanRecordId = recordId !== undefined && recordId !== null ? String(recordId).trim() : "";
  if (!cleanId && !cleanRecordId) return;

  // 1. Immediately remove from local market_leases cache
  try {
    const localData = localStorage.getItem("market_leases");
    if (localData) {
      const localList: any[] = JSON.parse(localData);
      const updated = localList.filter((item: any) => {
        const itemLId = item.leaseId ? String(item.leaseId).trim().toLowerCase() : "";
        const itemId = item.id !== undefined && item.id !== null ? String(item.id).trim().toLowerCase() : "";
        
        const matchLease = cleanId && itemLId === cleanId.toLowerCase();
        const matchRecord = cleanRecordId && itemId === cleanRecordId.toLowerCase();
        return !matchLease && !matchRecord;
      });
      localStorage.setItem("market_leases", JSON.stringify(updated));
    }
  } catch (e) {
    console.warn("Error removing from local market_leases cache:", e);
  }

  // 2. Track deleted IDs so polling never revives it
  try {
    const deletedRaw = localStorage.getItem("deleted_market_lease_ids");
    const deletedList: string[] = deletedRaw ? JSON.parse(deletedRaw) : [];
    if (cleanId && !deletedList.some((d) => d.trim().toLowerCase() === cleanId.toLowerCase())) {
      deletedList.push(cleanId);
    }
    if (cleanRecordId && !deletedList.some((d) => d.trim().toLowerCase() === cleanRecordId.toLowerCase())) {
      deletedList.push(cleanRecordId);
    }
    localStorage.setItem("deleted_market_lease_ids", JSON.stringify(deletedList));
  } catch (e) {
    console.warn("Error saving to deleted_market_lease_ids:", e);
  }

  // 3. Delete from backend database
  if (MODE === "ONLINE") {
    try {
      const target = cleanId || cleanRecordId;
      const targetId = encodeURIComponent(target);
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
        console.error("[deleteLease] Backend delete failed:", res.status, responseBody.message || responseText);
      } else {
        console.log(`[deleteLease] Backend confirmed deletion of '${target}'. Deleted count: ${responseBody.deletedCount ?? 'unknown'}`);
      }

      return;
    } catch (error) {
      console.warn("[deleteLease] Network error during backend delete (local deletion still applied):", error);
      return;
    }
  }
}