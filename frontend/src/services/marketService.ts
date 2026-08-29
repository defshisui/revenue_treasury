// src/services/marketService.ts

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
    | "Inactive";
  amountDue: number;
  helperApprovalStatus: string;
  advancePaymentStatus: string;
  paymentStatus:
    | "Pending Payment"
    | "For Payment Verification"
    | "Payment Information Requested"
    | "Paid";
  paymentMethod?: string;
}

import { API_BASE_URL } from "../config/api";

const MODE: "LOCALSTORAGE" | "ONLINE" = "ONLINE";

export async function getLeases(): Promise<LeaseRecord[]> {
  if (MODE === "ONLINE") {
    try {
      const res = await fetch(`${API_BASE_URL}/market-leases`);

      if (!res.ok) {
        const responseText = await res.text();

        let errorBody: any = {};

        try {
          errorBody = responseText ? JSON.parse(responseText) : {};
        } catch {
          errorBody = {};
        }

        throw new Error(
          errorBody.message ||
            errorBody.error ||
            responseText ||
            `Failed to fetch leases from database (Status: ${res.status})`
        );
      }

      return await res.json();
    } catch (error) {
      console.error("Online fetch error:", error);
      return [];
    }
  }

  // Local storage fallback
  const data = localStorage.getItem("market_leases");
  return data ? JSON.parse(data) : [];
}

export async function saveLease(newLease: LeaseRecord): Promise<void> {
  const payload = {
    ...newLease,
    paymentMethod:
      newLease.paymentMethod && newLease.paymentMethod.trim() !== ""
        ? newLease.paymentMethod
        : "Cash / Direct",
  };

  if (MODE === "ONLINE") {
    try {
      const res = await fetch(`${API_BASE_URL}/market-leases`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      // Read the backend response so we can show the actual error.
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

  // Local storage fallback
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
        : "Cash / Direct",
  };

  if (MODE === "ONLINE") {
    try {
      const res = await fetch(
        `${API_BASE_URL}/market-leases/${payload.leaseId}`,
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

  // Local storage fallback
  const existing = await getLeases();

  const updated = existing.map((item) =>
    item.leaseId === payload.leaseId ? payload : item
  );

  localStorage.setItem("market_leases", JSON.stringify(updated));
}

export async function deleteLease(leaseId: string): Promise<void> {
  if (MODE === "ONLINE") {
    try {
      const res = await fetch(
        `${API_BASE_URL}/market-leases/${leaseId}`,
        {
          method: "DELETE",
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
          `Failed to delete lease from database (Status: ${res.status})`;

        throw new Error(errorMessage);
      }

      return;
    } catch (error) {
      console.error("Online delete error:", error);
      throw error;
    }
  }

  // Local storage fallback
  const existing = await getLeases();

  const updated = existing.filter(
    (item) => item.leaseId !== leaseId
  );

  localStorage.setItem("market_leases", JSON.stringify(updated));
}