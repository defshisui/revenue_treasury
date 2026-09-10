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
  paymentStatus?: 'Paid' | 'Pending' | 'Unpaid' | 'For Payment' | 'Payment Completed';
  paymentAmount?: number;
  paymentReference?: string;
  officialReceiptNumber?: string;
  paymentMethod?: string;
  paymentDate?: string;
  paymentDueDate?: string;
  [key: string]: any;
}

import { API_BASE_URL } from '../config/api';

export const getRPTApplications = async (): Promise<RPTApplicationRecord[]> => {
  try {

    const token =
      localStorage.getItem("token") ||
      sessionStorage.getItem("token");

    if (!token) {
      return [];
    }

    const response = await fetch(
      `${API_BASE_URL}/citizen-rpt-applications`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();


    return data.map((row: any) => ({
      id: row.id,

      controlNumber:
        row.control_number ||
        row.controlNumber,

      referenceNumber:
        row.reference_number ||
        row.referenceNumber,

      email:
        row.email,

      mobileNumber:
        row.mobile_number ||
        row.mobileNumber,

      service:
        row.service,

      filedDate:
        row.filed_date ||
        row.filedDate,

      status:
        row.status ||
        'Pending',

      penalty:
        row.penalty
          ? parseFloat(row.penalty)
          : 0,

      applicantName:
        row.applicant_name ||
        row.applicantName,

      ownerName:
        row.owner_name ||
        row.ownerName,

      applicantType:
        row.applicant_type ||
        row.applicantType,

      barangay:
        row.barangay,

      propertyType:
        row.property_type ||
        row.propertyType,

      pin:
        row.pin,

      taxDeclarationNumber:
        row.tax_declaration_number ||
        row.taxDeclarationNumber,

      propertyLocation:
        row.property_location ||
        row.propertyLocation,

      assignedOfficer:
        row.assigned_officer ||
        row.assignedOfficer,

      paymentStatus:
        row.payment_status ||
        row.paymentStatus,

      paymentAmount:
        Number(
          row.payment_amount ??
          row.paymentAmount ??
          0
        ),

      paymentReference:
        row.payment_reference ||
        row.paymentReference ||
        '',

      officialReceiptNumber:
        row.official_receipt_number ||
        row.officialReceiptNumber ||
        '',

      paymentMethod:
        row.payment_method ||
        row.paymentMethod ||
        '',

      paymentDate:
        row.payment_date ||
        row.paymentDate ||
        '',

      paymentDueDate:
        row.payment_due_date ||
        row.paymentDueDate ||
        '',

      documents: (() => {
        let docs = row.documents;
        if (typeof docs === 'string') {
          try {
            docs = JSON.parse(docs);
          } catch {
            docs = [];
          }
        }
        if (docs && !Array.isArray(docs) && typeof docs === 'object') {
          docs = Object.values(docs);
        }
        if (!Array.isArray(docs)) return [];
        return docs.map((d: any, idx: number) => {
          if (typeof d === 'string') {
            return {
              id: `DOC-${idx + 1}`,
              name: d,
              type: d.toLowerCase().endsWith('.pdf') ? 'PDF' : 'IMAGE',
              url: d,
              status: 'Pending' as const,
              uploadedAt: row.filed_date || row.filedDate || '',
            };
          }
          const docName = d.name || d.fileName || `Document ${idx + 1}`;
          return {
            id: d.id || `DOC-${idx + 1}`,
            name: docName,
            type: d.type || (docName.toLowerCase().endsWith('.pdf') ? 'PDF' : 'IMAGE'),
            url: d.url || '',
            status: d.status || 'Pending',
            uploadedAt: d.uploadedAt || row.filed_date || row.filedDate || '',
          };
        });
      })(),
    }));
  } catch (error) {
    console.error(
      'Failed to fetch RPT applications from server:',
      error
    );

    return [];
  }
};


export const saveRPTApplication = async (
  application: Partial<RPTApplicationRecord>,
  rawFiles?: File[]
): Promise<any> => {
  try {
    const formData = new FormData();


    Object.keys(application).forEach((key) => {
      const value = application[key];

      if (
        value !== undefined &&
        value !== null
      ) {
        if (typeof value === 'object') {
          formData.append(
            key,
            JSON.stringify(value)
          );
        } else {
          formData.append(
            key,
            String(value)
          );
        }
      }
    });


    if (
      rawFiles &&
      rawFiles.length > 0
    ) {
      rawFiles.forEach((file) => {
        formData.append(
          'documents',
          file
        );
      });
    }

    const response = await fetch(
      `${API_BASE_URL}/citizen-rpt-applications`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData =
        await response
          .json()
          .catch(() => ({}));

      throw new Error(
        errorData.message ||
        `Failed to save application: ${response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error(
      'Error persisting RPT application:',
      error
    );

    throw error;
  }
};


export const searchRPTByTDN = async (
  tdn: string
): Promise<{
  found: boolean;
  matchedTdn?: string;
  ownerName?: string;
  totalPropertiesCount?: number;
  properties?: any[];
  message?: string;
}> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/rpt/search?tdn=${encodeURIComponent(
        tdn.trim()
      )}`
    );

    const data =
      await response.json();

    if (!response.ok) {
      return {
        found: false,
        message:
          data.message ||
          `No property records found for ${tdn}`,
      };
    }

    return data;
  } catch (error: any) {
    console.error(
      'Error searching TDN:',
      error
    );

    return {
      found: false,
      message:
        error.message ||
        'Network error while searching Tax Declaration.',
    };
  }
};


export const processGroupRPTPayment = async (
  payload: {
    items: Array<{
      id?: number | string;
      taxDeclarationNumber: string;
      ownerName: string;
      totalAmount: number;
      selectedOption?: string;
      billCoverage?: string;
    }>;
    customerName: string;
    customerEmail: string;
    paymentMethod: string;
    paymongoSessionId?: string;
  }
): Promise<any> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/citizen-rpt-payments/group`,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      const errData =
        await response
          .json()
          .catch(() => ({}));

      throw new Error(
        errData.message ||
        'Failed to process group payment'
      );
    }

    return await response.json();
  } catch (error) {
    console.error(
      'Group RPT payment error:',
      error
    );

    throw error;
  }
};


export const getLguMasterRptRecords =
  async (): Promise<any[]> => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/lgu-rpt-records`
      );

      if (!response.ok) {
        throw new Error(
          `HTTP Error: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error(
        'Error fetching LGU master records:',
        error
      );

      return [];
    }
  };


export const createLguMasterRptRecord =
  async (
    record: any
  ): Promise<any> => {
    const token =
      localStorage.getItem("token") ||
      sessionStorage.getItem("token");
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(
      `${API_BASE_URL}/lgu-rpt-records`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(record)
      }
    );

    if (!response.ok) {
      const errData =
        await response
          .json()
          .catch(() => ({}));

      throw new Error(
        errData.message ||
        'Failed to create assessment record'
      );
    }

    return await response.json();
  };


export const updateLguMasterRptRecord =
  async (
    id: string | number,
    record: any
  ): Promise<any> => {
    const token =
      localStorage.getItem("token") ||
      sessionStorage.getItem("token");
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(
      `${API_BASE_URL}/lgu-rpt-records/${id}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify(record)
      }
    );

    if (!response.ok) {
      const errData =
        await response
          .json()
          .catch(() => ({}));

      throw new Error(
        errData.message ||
        'Failed to update assessment record'
      );
    }

    return await response.json();
  };


export const deleteLguMasterRptRecord =
  async (
    id: string | number
  ): Promise<any> => {
    const token =
      localStorage.getItem("token") ||
      sessionStorage.getItem("token");
    const headers: HeadersInit = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(
      `${API_BASE_URL}/lgu-rpt-records/${id}`,
      {
        method: 'DELETE',
        headers
      }
    );

    if (!response.ok) {
      const errData =
        await response
          .json()
          .catch(() => ({}));

      throw new Error(
        errData.message ||
        'Failed to delete assessment record'
      );
    }

    return await response.json();
  };

export const deleteRptApplication =
  async (
    id: string | number
  ): Promise<any> => {
    const token =
      localStorage.getItem("token") ||
      sessionStorage.getItem("token");
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(
      `${API_BASE_URL}/citizen-rpt-applications/${id}`,
      {
        method: 'DELETE',
        headers
      }
    );

    if (!response.ok) {
      const errData =
        await response
          .json()
          .catch(() => ({}));

      throw new Error(
        errData.message ||
        'Failed to delete RPT application'
      );
    }

    return await response.json();
  };


export const updateRptApplicationStatus =
  async (
    id: string,
    status: string,
    notes?: string,
    options?: {
      paymentAmount?: number;
      paymentStatus?: string;
      paymentDueDate?: string;
      assignedOfficer?: string;
      officialReceiptNumber?: string;
      paymentMethod?: string;
      paymentReference?: string;
      paymentDate?: string;
    }
  ): Promise<any> => {
    const token =
      localStorage.getItem("token") ||
      sessionStorage.getItem("token");
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(
      `${API_BASE_URL}/citizen-rpt-applications/${id}/status`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          status,
          notes,
          ...(options || {})
        })
      }
    );

    if (!response.ok) {
      const errData =
        await response
          .json()
          .catch(() => ({}));

      throw new Error(
        errData.message ||
        'Failed to update application status'
      );
    }

    return await response.json();
  };


export const createRPTServiceCheckout =
  async (
    payload: {
      applicationId: string;
      amount: number;
      customerName: string;
      customerEmail: string;
      customerPhone?: string;
      service: string;
      description?: string;
    }
  ): Promise<{
    checkoutUrl: string;
    sessionId: string;
    referenceNumber: string;
  }> => {
    const response = await fetch(
      `${API_BASE_URL}/api/payments/create-checkout-session`,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json'
        },
        body: JSON.stringify({
          type: 'RPT_SERVICE',
          amount: payload.amount,
          rptApplicationId:
            payload.applicationId,
          rptService:
            payload.service,
          customerName:
            payload.customerName,
          customerEmail:
            payload.customerEmail,
          customerPhone:
            payload.customerPhone,
          description:
            payload.description ||
            `${payload.service} - RPT Service Application`,
          frontendRedirectUrl:
            window.location.origin
        })
      }
    );

    const data =
      await response
        .json()
        .catch(() => ({}));

    if (
      !response.ok ||
      !data.checkoutUrl
    ) {
      throw new Error(
        data.error ||
        data.message ||
        'Unable to create the RPT service payment checkout.'
      );
    }

    return {
      checkoutUrl:
        data.checkoutUrl,
      sessionId:
        data.sessionId,
      referenceNumber:
        data.referenceNumber
    };
  };


export const verifyRPTServicePayment =
  async (
    sessionId: string
  ): Promise<any> => {
    const response = await fetch(
      `${API_BASE_URL}/api/payments/verify-session`,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json'
        },
        body: JSON.stringify({
          sessionId
        })
      }
    );

    const data =
      await response
        .json()
        .catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        'Unable to verify the RPT service payment.'
      );
    }

    return data;
  };



export const createTransferTaxCheckout =
  createRPTServiceCheckout;

export const verifyTransferTaxPayment =
  verifyRPTServicePayment;