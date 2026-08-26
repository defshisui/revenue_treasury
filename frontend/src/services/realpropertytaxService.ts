// src/services/realpropertytaxService.ts

export interface RPTApplicationRecord {
  id: string;
  controlNumber?: string;
  referenceNumber?: string;
  email?: string;
  mobileNumber?: string;
  service?: string;
  filedDate?: string;
  status: string;
  penalty?: number;
  applicantName: string;
  ownerName?: string;
  applicantType?: string;
  propertyLocation?: string;
  barangay?: string;
  propertyType?: string;
  propertyDetails?: {
    pin: string;
    titleNumber: string;
    lotAreaSqM: number;
    address: string;
    currentValuation?: number;
  };
  pin?: string;
  taxDeclarationNumber?: string;
  documents?: string[] | Record<string, any> | {
    id: string;
    name: string;
    type: string;
    status: 'Verified' | 'Rejected' | 'Pending';
    uploadedAt: string;
  }[];
  auditLogs?: {
    id: string;
    timestamp: string;
    officer: string;
    action: string;
  }[];
  notificationLogs?: {
    id: string;
    timestamp: string;
    type: 'Email' | 'SMS';
    message: string;
    status: 'Delivered' | 'Pending';
  }[];
  assignedOfficer?: string;
  paymentStatus?: 'Paid' | 'Pending' | 'Unpaid';
  [key: string]: any;
}

const API_BASE_URL = 'http://localhost:3000';

export const getRPTApplications = async (): Promise<RPTApplicationRecord[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/citizen-rpt-applications`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    
    // Maps database column fields into the expected frontend TypeScript interface structure[cite: 7]
    return data.map((row: any) => ({
      id: row.id,
      controlNumber: row.control_number || row.controlNumber,
      referenceNumber: row.reference_number || row.referenceNumber,
      email: row.email,
      mobileNumber: row.mobile_number || row.mobileNumber,
      service: row.service,
      filedDate: row.filed_date || row.filedDate,
      status: row.status || 'Pending',
      penalty: row.penalty ? parseFloat(row.penalty) : 0,
      applicantName: row.applicant_name || row.applicantName,
      ownerName: row.owner_name || row.ownerName,
      applicantType: row.applicant_type || row.applicantType,
      barangay: row.barangay,
      propertyType: row.property_type || row.propertyType,
      pin: row.pin,
      taxDeclarationNumber: row.tax_declaration_number || row.taxDeclarationNumber,
      propertyLocation: row.property_location || row.propertyLocation,
      assignedOfficer: row.assigned_officer || row.assignedOfficer,
      paymentStatus: row.payment_status || row.paymentStatus,
      documents: row.documents || []
    }));
  } catch (error) {
    console.error('Failed to fetch RPT applications from server:', error);
    return [];
  }
};

export const saveRPTApplication = async (application: Partial<RPTApplicationRecord>, rawFiles?: File[]): Promise<any> => {
  try {
    const formData = new FormData();

    // Append standard application properties to multipart form data
    Object.keys(application).forEach((key) => {
      const value = application[key];
      if (value !== undefined && value !== null) {
        if (typeof value === 'object') {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, String(value));
        }
      }
    });

    // Append physical file uploads if provided[cite: 7]
    if (rawFiles && rawFiles.length > 0) {
      rawFiles.forEach((file) => {
        formData.append('documents', file);
      });
    }

    const response = await fetch(`${API_BASE_URL}/citizen-rpt-applications`, {
      method: 'POST',
      body: formData, // Automatically handles multipart boundaries
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to save application: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error persisting RPT application:', error);
    throw error;
  }
};