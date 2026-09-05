// src/services/hawkerservice.ts

export interface HawkerApplicationPayload {
    id: string;
    associationNumber: string;
    associationName: string;
    secRegistrationNo: string;
    dateIssued: string;
    contactNumber: string;
    chairperson: {
        firstName: string;
        middleName: string;
        lastName: string;
        email: string;
    };
    submittedBy: string;
    submitterEmail: string;
    submissionDate: string;
    status: string;
}

import { API_BASE_URL } from '../config/api';
const MODE: "LOCALSTORAGE" | "ONLINE" = "ONLINE";

export async function getHawkerApplications(): Promise<HawkerApplicationPayload[]> {
    if (MODE === "ONLINE") {
        const res = await fetch(`${API_BASE_URL}/api/hawkers`);
        if (!res.ok) {
            throw new Error('Failed to fetch hawker applications from the server.');
        }
        return res.json();
    }
    
    const data = localStorage.getItem("hawker_applications");
    return data ? JSON.parse(data) : [];
}

export async function submitHawkerApplication(payload: HawkerApplicationPayload): Promise<any> {
    if (MODE === "ONLINE") {
        // Matches the Express app.post('/api/hawkers', ...) route in server.js
        const response = await fetch(`${API_BASE_URL}/api/hawkers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error('Failed to post application record to the hawkerservice endpoint.');
        }

        return await response.json();
    }

    // LocalStorage fallback (inactive while MODE is ONLINE)
    const existing = await getHawkerApplications();
    const updated = [payload, ...existing];
    localStorage.setItem("hawker_applications", JSON.stringify(updated));
    return { success: true, data: payload };
}