// src/services/marketService.ts

export interface LeaseRecord {
  leaseId: string;
  firstName: string;
  lastName: string;
  marketName: string;
  section: string;
  stallNumber: string;
  leaseStatus: "Active" | "Termination Requested" | "For Termination" | "Terminated" | "Inactive";
  amountDue: number;
  helperApprovalStatus: string;
  advancePaymentStatus: string;
  paymentStatus: "Pending Payment" | "For Payment Verification" | "Payment Information Requested" | "Paid";
  paymentMethod?: string; // Tracks the selected e-payment channel (GCash, Maya, Landbank, QR Ph, etc.)
}

const MODE: "LOCALSTORAGE" | "ONLINE" = "ONLINE"; 
const API_BASE_URL = "http://localhost:3000"; // Update with your actual server URL when deployed

export async function getLeases(): Promise<LeaseRecord[]> {
  if (MODE === "ONLINE") {
    try {
      const res = await fetch(`${API_BASE_URL}/market-leases`);
      if (!res.ok) throw new Error("Failed to fetch leases from database");
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
  // Ensure paymentMethod is explicitly included and falls back to Cash / Direct only if entirely blank
  const payload = {
    ...newLease,
    paymentMethod: newLease.paymentMethod && newLease.paymentMethod.trim() !== "" 
      ? newLease.paymentMethod 
      : "Cash / Direct"
  };

  if (MODE === "ONLINE") {
    try {
      const res = await fetch(`${API_BASE_URL}/market-leases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save lease to database");
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

export async function updateLease(updatedRecord: LeaseRecord): Promise<void> {
  const payload = {
    ...updatedRecord,
    paymentMethod: updatedRecord.paymentMethod && updatedRecord.paymentMethod.trim() !== "" 
      ? updatedRecord.paymentMethod 
      : "Cash / Direct"
  };

  if (MODE === "ONLINE") {
    try {
      const res = await fetch(`${API_BASE_URL}/market-leases/${payload.leaseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update lease in database");
      return;
    } catch (error) {
      console.error("Online update error:", error);
      throw error;
    }
  }

  // Local storage fallback
  const existing = await getLeases();
  const updated = existing.map((item) => (item.leaseId === payload.leaseId ? payload : item));
  localStorage.setItem("market_leases", JSON.stringify(updated));
}

export async function deleteLease(leaseId: string): Promise<void> {
  if (MODE === "ONLINE") {
    try {
      const res = await fetch(`${API_BASE_URL}/market-leases/${leaseId}`, {
        method: "DELETE",
      });
      
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.message || `Failed to delete lease from database (Status: ${res.status})`);
      }
      return;
    } catch (error) {
      console.error("Online delete error:", error);
      throw error;
    }
  }

  // Local storage fallback
  const existing = await getLeases();
  const updated = existing.filter((item) => item.leaseId !== leaseId);
  localStorage.setItem("market_leases", JSON.stringify(updated));
}