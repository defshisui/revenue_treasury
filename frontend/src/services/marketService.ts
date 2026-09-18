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
  paymongoSessionId?: string;
}

export function detectPaymentMethod(record?: Record<string, any> | null): string {
  if (!record) return "Cash / Direct";
  const method = record.paymentMethod || record.payment_method;
  if (method && String(method).trim() !== "" && String(method).trim() !== "Not Specified") {
    return String(method).trim();
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
          // Exclude any deleted leases from server response
          const activeServerList = serverList.filter((srv: any) => !isDeleted(srv));

          const merged = activeServerList.map((srv: any) => {
            const loc = localList.find((l: any) => 
              (l.leaseId && srv.leaseId && String(l.leaseId).trim().toLowerCase() === String(srv.leaseId).trim().toLowerCase()) ||
              (l.id && srv.id && String(l.id).trim() === String(srv.id).trim())
            );
            if (loc) {
              const isLocallyArchived =
                String(loc.leaseStatus || "").trim().toLowerCase() === "archived";

              // The database is authoritative for payment fields.
              // Do not let an old localStorage copy overwrite a newly
              // verified PayMongo payment/O.R. from the server.
              return {
                ...loc,
                ...srv,
                leaseStatus: isLocallyArchived
                  ? "Archived"
                  : (srv.leaseStatus || loc.leaseStatus),

                paymentStatus:
                  srv.paymentStatus ??
                  srv.payment_status ??
                  loc.paymentStatus,

                paymentMethod:
                  srv.paymentMethod ??
                  srv.payment_method ??
                  loc.paymentMethod,

                officialReceiptNumber:
                  srv.officialReceiptNumber ??
                  srv.official_receipt_number ??
                  loc.officialReceiptNumber,

                paymentReference:
                  srv.paymentReference ??
                  srv.payment_reference ??
                  loc.paymentReference,

                paymentDate:
                  srv.paymentDate ??
                  srv.payment_date ??
                  loc.paymentDate,

                paymongoSessionId:
                  srv.paymongoSessionId ??
                  srv.paymongo_session_id ??
                  loc.paymongoSessionId,
              };
            }
            return {
              ...srv,
              paymentStatus:
                srv.paymentStatus ??
                srv.payment_status ??
                "Pending Payment",
              paymentMethod:
                srv.paymentMethod ??
                srv.payment_method ??
                detectPaymentMethod(srv),
              officialReceiptNumber:
                srv.officialReceiptNumber ??
                srv.official_receipt_number ??
                "",
              paymentReference:
                srv.paymentReference ??
                srv.payment_reference ??
                "",
              paymentDate:
                srv.paymentDate ??
                srv.payment_date ??
                undefined,
              paymongoSessionId:
                srv.paymongoSessionId ??
                srv.paymongo_session_id ??
                undefined,
            };
          });

          localList.forEach((loc: any) => {
            if (!isDeleted(loc) && !merged.some((m: any) => 
              (m.leaseId && loc.leaseId && String(m.leaseId).trim().toLowerCase() === String(loc.leaseId).trim().toLowerCase()) ||
              (m.id && loc.id && String(m.id).trim() === String(loc.id).trim())
            )) {
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
  const resolvedPaymentMethod =
    newLease.paymentMethod && newLease.paymentMethod.trim() !== ""
      ? newLease.paymentMethod
      : detectPaymentMethod(newLease);

  const payload = {
    ...newLease,
    paymentMethod: resolvedPaymentMethod,
    payment_method: resolvedPaymentMethod,
    official_receipt_number: newLease.officialReceiptNumber || "",
    payment_reference: newLease.paymentReference || "",
    payment_date: newLease.paymentDate || undefined,
    paymongo_session_id: newLease.paymongoSessionId || undefined,
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
  const resolvedPaymentMethod =
    updatedRecord.paymentMethod &&
      updatedRecord.paymentMethod.trim() !== ""
      ? updatedRecord.paymentMethod
      : detectPaymentMethod(updatedRecord);

  const payload = {
    ...updatedRecord,
    paymentMethod: resolvedPaymentMethod,
    payment_method: resolvedPaymentMethod,
    official_receipt_number: updatedRecord.officialReceiptNumber || "",
    payment_reference: updatedRecord.paymentReference || "",
    payment_date: updatedRecord.paymentDate || undefined,
    paymongo_session_id: updatedRecord.paymongoSessionId || undefined,
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