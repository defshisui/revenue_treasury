import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config/api';
import { UnifiedHeader } from './UnifiedHeader';
import { UnifiedFooter } from './UnifiedFooter';
import {
  createPayMongoQrPaymentIntent,
  createQrPhPaymentMethod,
  attachQrPhPaymentMethod,
} from '../services/paymongoService';
export interface BusinessTaxAssessmentViewProps {
  isCollapsed?: boolean;
}
type ActiveScreen = 'home' | 'assessment-list' | 'appointments-list';
interface AttachmentFile {
  name: string;
  url: string;
}
interface AssessmentRecord {
  id: string;
  trackingNumber: string;
  businessName: string;
  businessOwner: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  paymentStatus: 'PAID' | 'UNPAID';
  applicationDate: string;
  psicCode?: string;
  grossSales?: number;
  tin?: string;
  attachments?: AttachmentFile[];
  remarks?: string;
  computedFees?: {
    lbt?: number;
    mayorsPermit?: number;
    sanitaryFee?: number;
    garbageFee?: number;
    fireSafetyFee?: number;
    total?: number;
  };
}
interface AppointmentRecord {
  id: string;
  department: string;
  appointmentType: string;
  businessName?: string;
  tin?: string;
  address?: string;
  description?: string;
  fullName: string;
  email: string;
  phone: string;
  date: string;
  timeSlot?: string;
  remarks?: string;
  status: 'PENDING' | 'APPROVED' | 'CANCELLED';
  createdAt: string;
}
export const BusinessTaxAssessmentView: React.FC<BusinessTaxAssessmentViewProps> = ({ isCollapsed = false }) => {
  const [currentScreen, setCurrentScreen] = useState<ActiveScreen>('home');
  const [isModalOpen, setIsModalOpen] = useState<false | 'appointment' | 'tax-bill' | 'or-number' | 'sales-declaration'>(false);
  const [selectedAssessmentView, setSelectedAssessmentView] = useState<AssessmentRecord | null>(null);
  const [user, setUser] = useState<{ fullname: string; email: string; initials: string; firstName: string; token: string } | null>(null);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [userAppointments, setUserAppointments] = useState<AppointmentRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchType, setSearchType] = useState<string>('Tracking/MP No.');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const pageSize = 10;
  const [isPaymentStep, setIsPaymentStep] = useState<boolean>(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [qrReferenceNumber, setQrReferenceNumber] = useState<string>("");
  const [qrPaymentIntentId, setQrPaymentIntentId] = useState<string>('');
  const [qrError, setQrError] = useState<string>('');
  const [paymentAssessment, setPaymentAssessment] = useState<AssessmentRecord | null>(null);
  const [qrSecondsRemaining, setQrSecondsRemaining] = useState<number>(300);
  const [qrPaymentPaid, setQrPaymentPaid] = useState<boolean>(false);
  const [paymentConfirmedAt, setPaymentConfirmedAt] = useState<Date | null>(null);

  // Market-Stall-style payment success confirmation.
  const [isPaymentSuccess, setIsPaymentSuccess] = useState<boolean>(false);
  const handlePayMongoBusinessTaxQrPayment = async (record: AssessmentRecord) => {
    setIsProcessingPayment(true);
    setQrCodeUrl('');
    setQrReferenceNumber('');
    setQrPaymentIntentId('');
    setQrError('');
    setQrPaymentPaid(false);
    setPaymentConfirmedAt(null);
    setQrSecondsRemaining(300);
    const computedAmount = Number(record.computedFees?.total || 0);
    if (!Number.isFinite(computedAmount) || computedAmount <= 0) {
      setIsProcessingPayment(false);
      setQrError(
        'Your assessment has not been approved for payment yet. Please wait for the Treasurer\'s Office to complete the assessment.'
      );
      return;
    }
    try {
      const paymentIntent = await createPayMongoQrPaymentIntent({
        amount: computedAmount,
        type: 'BUSINESS_TAX',
        businessTrackingNumber: record.trackingNumber,
        customerName: record.businessOwner || user?.fullname || 'Business Taxpayer',
        customerEmail: user?.email || 'taxpayer@gov.ph',
        description: `Business Tax Assessment Payment (${record.trackingNumber})`,
      });
      setQrPaymentIntentId(paymentIntent.paymentIntentId);
      setQrReferenceNumber(paymentIntent.referenceNumber);
      const paymentMethodId = await createQrPhPaymentMethod(
        paymentIntent.publicKey,
        300
      );
      const attachedPayment = await attachQrPhPaymentMethod(
        paymentIntent.paymentIntentId,
        paymentMethodId,
        paymentIntent.clientKey,
        paymentIntent.publicKey
      );
      const imageUrl =
        attachedPayment?.attributes?.next_action?.code?.image_url ||
        attachedPayment?.next_action?.code?.image_url ||
        attachedPayment?.attributes?.next_action?.qr_code?.image_url ||
        attachedPayment?.qr_code?.image_url ||
        '';
      if (!imageUrl) {
        console.error('PayMongo QR response:', attachedPayment);
        throw new Error(
          'PayMongo did not return the QRPh code image. Please try again.'
        );
      }
      setQrCodeUrl(imageUrl);
    } catch (err: any) {
      console.error('PayMongo Business Tax QRPh payment error:', err);
      setQrError(
        err?.message ||
        'Unable to generate the PayMongo QRPh code. Please try again.'
      );
    } finally {
      setIsProcessingPayment(false);
    }
  };
  useEffect(() => {
    if (!isPaymentStep || !qrCodeUrl || qrPaymentPaid) return;
    const timer = window.setInterval(() => {
      setQrSecondsRemaining((seconds) => {
        if (seconds <= 1) {
          window.clearInterval(timer);
          setQrCodeUrl('');
          if (paymentAssessment) void handlePayMongoBusinessTaxQrPayment(paymentAssessment);
          return 300;
        }
        return seconds - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isPaymentStep, qrCodeUrl, qrPaymentPaid, paymentAssessment]);

  useEffect(() => {
    if (!isPaymentStep || !qrPaymentIntentId || qrPaymentPaid) return;
    const poll = window.setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/payments/qr-status/${encodeURIComponent(qrPaymentIntentId)}`);
        if (!response.ok) return;
        const data = await response.json();
        if (data.paid) {
          setQrPaymentPaid(true);
          setPaymentConfirmedAt(new Date());
          setQrSecondsRemaining(0);
          setQrCodeUrl('');

          // Match the Market Stall payment flow:
          // close the QR/payment modal completely, then show
          // a separate animated payment-success screen.
          await fetchAssessments();
          setIsPaymentStep(false);
          setQrPaymentIntentId('');
          setQrError('');
          setIsPaymentSuccess(true);
        }
      } catch (error) {
        console.error('QR payment status check failed:', error);
      }
    }, 3000);
    return () => window.clearInterval(poll);
  }, [isPaymentStep, qrPaymentIntentId, qrPaymentPaid]);

  const openBusinessTaxPayment = (record: AssessmentRecord) => {
    setPaymentAssessment(record);
    setSelectedAssessmentView(null);
    setIsPaymentStep(true);
    void handlePayMongoBusinessTaxQrPayment(record);
  };
  const closeBusinessTaxPayment = () => {
    if (isProcessingPayment) return;
    setIsPaymentStep(false);
    setIsPaymentSuccess(false);
    setPaymentAssessment(null);
    setQrCodeUrl('');
    setQrReferenceNumber('');
    setQrPaymentIntentId('');
    setQrError('');
    setPaymentConfirmedAt(null);
    setQrPaymentPaid(false);
  };
  const [taxBillForm, setTaxBillForm] = useState({ permitNo: '', taxBillNo: '', tin: '' });
  const [orForm, setOrForm] = useState({ permitNo: '', orNo: '', tin: '' });
  const [salesForm, setSalesForm] = useState({
    businessName: '',
    grossSales: '',
    year: '2026',
    psicCode: '47110',
    tin: '',
    file: null as File | null
  });
  const [captchaNum1, setCaptchaNum1] = useState(0);
  const [captchaNum2, setCaptchaNum2] = useState(0);
  const [captchaInput, setCaptchaInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [aptForm, setAptForm] = useState({
    department: 'City Treasurer\'s Office',
    appointmentType: '',
    businessName: '',
    tin: '',
    address: '',
    description: '',
    fullName: user?.fullname || '',
    email: user?.email || '',
    phone: '',
    date: '',
    timeSlot: '09:00 AM - 10:00 AM',
    remarks: '',
  });
  useEffect(() => {
    const checkUserSession = () => {
      const rawData = localStorage.getItem('currentUser') ||
        localStorage.getItem('user') ||
        sessionStorage.getItem('currentUser') ||
        sessionStorage.getItem('user');
      if (!rawData) return null;
      try {
        const parsed = JSON.parse(rawData);
        const target = parsed.user && typeof parsed.user === 'object' ? parsed.user : parsed;
        const fullName = target.fullname || target.name || target.fullName || target.firstName || target.email;
        if (!fullName) return null;
        const email = target.email || "";
        const token = parsed.token || target.token || "";
        const nameParts = String(fullName).trim().split(" ");
        const firstName = nameParts[0];
        const initials = nameParts.length > 1
          ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
          : nameParts[0].slice(0, 2).toUpperCase();
        return { fullname: String(fullName), email, firstName, initials, token };
      } catch (e) {
        console.error("Failed to parse user session", e);
        return null;
      }
    };
    const activeUser = checkUserSession();
    setUser(activeUser);
    if (activeUser) {
      setAptForm(prev => ({
        ...prev,
        fullName: activeUser.fullname,
        email: activeUser.email
      }));
    }
  }, []);
  useEffect(() => {
    if (currentScreen === 'assessment-list' && user) {
      fetchAssessments();
    } else if (currentScreen === 'appointments-list' && user) {
      fetchUserAppointments();
    }
  }, [currentScreen, user, statusFilter, currentPage]);
  const fetchAssessments = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const queryParams = new URLSearchParams();
      if (statusFilter !== 'ALL') queryParams.append('status', statusFilter);
      if (user?.email) queryParams.append('email', user.email);
      queryParams.append('page', currentPage.toString());
      queryParams.append('limit', pageSize.toString());
      if (searchQuery) queryParams.append('search', searchQuery);
      queryParams.append('searchType', searchType);
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (user?.token) headers['Authorization'] = `Bearer ${user.token}`;
      const response = await fetch(`${API_BASE_URL}/business-assessments?${queryParams.toString()}`, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch assessments: ${response.statusText}`);
      }
      const data = await response.json();
      setAssessments(Array.isArray(data) ? data : (data.assessments || []));
      setTotalPages(data.totalPages || 1);
    } catch (err: any) {
      console.error("Error fetching assessments:", err);
      setFetchError(err.message || "Failed to load records from server.");
    } finally {
      setLoading(false);
    }
  };
  const fetchUserAppointments = async () => {
    setLoading(true);
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (user?.token) headers['Authorization'] = `Bearer ${user.token}`;
      const res = await fetch(`${API_BASE_URL}/appointments?email=${encodeURIComponent(user?.email || '')}`, { headers });
      if (!res.ok) throw new Error("Failed to fetch appointments.");
      const data = await res.json();
      setUserAppointments(Array.isArray(data) ? data : (data.appointments || []));
    } catch (err: any) {
      console.error("Error fetching appointments:", err);
      setUserAppointments([]);
    } finally {
      setLoading(false);
    }
  };
  const handleAppointmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = aptForm.phone.trim();
    if (!/^\d{11}$/.test(cleanPhone)) {
      alert("Please enter a valid 11-digit phone number (e.g., 09123456789).");
      return;
    }
    if (parseInt(captchaInput.trim(), 10) !== captchaNum1 + captchaNum2) {
      alert("Incorrect CAPTCHA answer. Please solve the math problem correctly.");
      return;
    }
    setSubmitting(true);
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (user?.token) headers['Authorization'] = `Bearer ${user.token}`;
      const res = await fetch(`${API_BASE_URL}/appointments`, {
        method: 'POST',
        headers,
        body: JSON.stringify(aptForm)
      });
      if (!res.ok) throw new Error("Failed to submit appointment request.");
      alert("Appointment submitted successfully. You can track its status under 'My Appointments'.");
      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message || "An error occurred.");
    } finally {
      setSubmitting(false);
    }
  };
  const handleTaxBillVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    setVerificationResult(null);
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (user?.token) headers['Authorization'] = `Bearer ${user.token}`;
      const res = isModalOpen === 'tax-bill'
        ? await fetch(`${API_BASE_URL}/verify/tax-bill`, { method: 'POST', headers, body: JSON.stringify(taxBillForm) })
        : await fetch(`${API_BASE_URL}/verify/or-number`, { method: 'POST', headers, body: JSON.stringify(orForm) });
      const textResponse = await res.text();
      let data;
      try {
        data = JSON.parse(textResponse);
      } catch (parseErr) {
        throw new Error(`Server returned invalid response (Status ${res.status}). Please check backend API logs.`);
      }
      if (!res.ok) {
        throw new Error(data.message || `Server responded with status code ${res.status}`);
      }
      setVerificationResult(data);
    } catch (err: any) {
      alert(`Verification Error: ${err.message}`);
    } finally {
      setVerifying(false);
    }
  };
  const handleSalesDeclarationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('businessName', salesForm.businessName);
    formData.append('grossSales', salesForm.grossSales);
    formData.append('year', salesForm.year);
    formData.append('psicCode', salesForm.psicCode);
    formData.append('tin', salesForm.tin);
    if (salesForm.file) formData.append('financialStatement', salesForm.file);
    if (user?.email) formData.append('email', user.email);
    setSubmitting(true);
    try {
      const headers: HeadersInit = {};
      if (user?.token) headers['Authorization'] = `Bearer ${user.token}`;
      const res = await fetch(`${API_BASE_URL}/business-assessments/sales-declaration`, {
        method: 'POST',
        headers,
        body: formData
      });
      if (!res.ok) throw new Error("Failed to submit sales declaration.");
      alert("Sales declaration submitted successfully.");
      setIsModalOpen(false);
      fetchAssessments();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };
  const openModal = (type: 'appointment' | 'tax-bill' | 'or-number' | 'sales-declaration') => {
    if (type === 'appointment') {
      setCaptchaNum1(Math.floor(Math.random() * 10) + 1);
      setCaptchaNum2(Math.floor(Math.random() * 10) + 1);
      setCaptchaInput('');
    }
    setVerificationResult(null);
    setIsModalOpen(type);
  };
  const closeModal = () => {
    setIsModalOpen(false);
    setVerificationResult(null);
  };
  return (
    <div
      style={{
        marginLeft: isCollapsed ? "80px" : "0px",
        width: isCollapsed ? "calc(100% - 80px)" : "100%",
      }}
      className="min-h-screen bg-slate-100 text-slate-800 pt-0 transition-all duration-300 box-border flex flex-col justify-between"
    >
      <div>
        <UnifiedHeader />
        <div className="max-w-6xl mx-auto px-4 py-8">
          {currentScreen === 'home' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between text-center">
                  <div>
                    <h4 className="text-slate-800 font-semibold text-base mb-3">Proceed and Pay Online</h4>
                    <p className="text-xs text-slate-500 leading-relaxed mb-6">
                      You can now submit your Online Sales Declaration along with your Financial Statements and other requirements online. Assessment and settlement of payment can also be done through this portal.
                    </p>
                  </div>
                  <div>
                    <button onClick={() => setCurrentScreen('assessment-list')} className="w-full sm:w-auto px-6 py-2.5 bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold rounded-full shadow-md transition-all cursor-pointer">
                      PROCEED WITH BUSINESS TAX ASSESSMENT
                    </button>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between text-center">
                  <div>
                    <h3 className="text-blue-900 font-bold text-sm tracking-wider uppercase mb-1">Appointment</h3>
                    <h4 className="text-slate-800 font-semibold text-base mb-3">&nbsp;</h4>
                    <p className="text-xs text-slate-500 leading-relaxed mb-6">
                      Do you have any concerns regarding your Business Tax Assessment? Schedule an appointment or track your existing appointments below:
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-center gap-2">
                    <button onClick={() => openModal('appointment')} className="px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold rounded-full shadow-md transition-all cursor-pointer">
                      SET AN APPOINTMENT
                    </button>
                    <button onClick={() => setCurrentScreen('appointments-list')} className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-full shadow-md transition-all cursor-pointer">
                      VIEW MY APPOINTMENTS
                    </button>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center">
                <h3 className="text-blue-900 font-bold text-sm tracking-wider uppercase mb-2">
                  TAX BILL NUMBER AND O.R. NUMBER VERIFICATION
                </h3>
                <p className="text-xs text-slate-500 mb-6">
                  Do you want to verify your Tax Bill Number or O.R. Number?<br />Just click below
                </p>
                <div className="flex flex-col sm:flex-row justify-center items-center gap-3">
                  <button onClick={() => openModal('tax-bill')} className="w-full sm:w-auto px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold rounded-full shadow-md transition-all cursor-pointer">
                    TAX BILL NUMBER VERIFICATION
                  </button>
                  <button onClick={() => openModal('or-number')} className="w-full sm:w-auto px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold rounded-full shadow-md transition-all cursor-pointer">
                    O.R. NUMBER VERIFICATION
                  </button>
                </div>
              </div>
            </div>
          ) : currentScreen === 'appointments-list' ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button onClick={() => setCurrentScreen('home')} className="text-xs text-blue-700 hover:underline font-semibold flex items-center gap-1 cursor-pointer">
                  Back to Home
                </button>
                <button onClick={() => openModal('appointment')} className="px-4 py-2 bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold rounded-md shadow-xs cursor-pointer">
                  + Request New Appointment
                </button>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-lg mt-4">
                <table className="w-full text-left text-xs">
                  <thead className="bg-blue-900 text-white font-semibold">
                    <tr>
                      <th className="p-3">DEPARTMENT</th>
                      <th className="p-3">APPOINTMENT TYPE</th>
                      <th className="p-3">BUSINESS NAME</th>
                      <th className="p-3">SCHEDULE DATE & TIME</th>
                      <th className="p-3 text-center">STATUS</th>
                      <th className="p-3">REMARKS / NOTES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6} className="p-8 text-center text-slate-500">Loading appointments...</td></tr>
                    ) : userAppointments.length === 0 ? (
                      <tr><td colSpan={6} className="p-8 text-center text-slate-400">No appointments found. Click "Request New Appointment" to schedule one.</td></tr>
                    ) : (
                      userAppointments.map(apt => (
                        <tr key={apt.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="p-3 font-medium">{apt.department}</td>
                          <td className="p-3 text-blue-600 font-semibold">{apt.appointmentType}</td>
                          <td className="p-3">{apt.businessName || 'N/A'}</td>
                          <td className="p-3 font-mono">{apt.date} ({apt.timeSlot || 'All Day'})</td>
                          <td className="p-3 text-center">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${apt.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800  ' :
                              apt.status === 'CANCELLED' ? 'bg-rose-100 text-rose-800  ' :
                                'bg-amber-100 text-amber-800  '
                              }`}>
                              {apt.status}
                            </span>
                          </td>
                          <td className="p-3 italic text-slate-500">{apt.remarks || 'Under review by municipal staff.'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setCurrentScreen('home')} className="text-xs text-blue-700 hover:underline font-semibold flex items-center gap-1 cursor-pointer">
                  Back to Home
                </button>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button onClick={() => openModal('sales-declaration')} className="px-4 py-2 bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold rounded-md shadow-xs cursor-pointer">
                    SUBMIT ONLINE SALES DECLARATION
                  </button>
                </div>
              </div>
              <div className="flex flex-col md:flex-row justify-between items-center gap-3 pt-4 border-t border-slate-200">
                <div className="w-full md:w-64">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Application Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                    className="w-full p-2 text-xs border border-slate-300 rounded bg-slate-50"
                  >
                    <option value="ALL">ALL</option>
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                  <div className="w-full sm:w-48">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Search By:</label>
                    <select
                      value={searchType}
                      onChange={(e) => setSearchType(e.target.value)}
                      className="w-full p-2 text-xs border border-slate-300 rounded bg-slate-50"
                    >
                      <option value="Tracking/MP No.">Tracking/MP No.</option>
                      <option value="Business Name">Business Name</option>
                    </select>
                  </div>
                  <div className="w-full sm:w-64 pt-5">
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search..."
                        className="w-full p-2 text-xs border border-slate-300 rounded bg-slate-50"
                      />
                      <button onClick={() => { setCurrentPage(1); fetchAssessments(); }} className="px-3 py-2 bg-slate-200 text-slate-700 text-xs font-semibold rounded cursor-pointer">
                        Search
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-blue-900 text-white font-semibold">
                    <tr>
                      <th className="p-3">TRACKING/MAYOR'S PERMIT NUMBER ↕</th>
                      <th className="p-3">BUSINESS NAME</th>
                      <th className="p-3">BUSINESS OWNER</th>
                      <th className="p-3">APPLICATION STATUS</th>
                      <th className="p-3">PAYMENT STATUS</th>
                      <th className="p-3">APPLICATION DATE</th>
                      <th className="p-3">ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500 bg-slate-50">
                          Loading records from server...
                        </td>
                      </tr>
                    ) : fetchError ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-rose-500 bg-slate-50">
                          Error: {fetchError}
                        </td>
                      </tr>
                    ) : assessments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400 bg-slate-50">
                          No data available in table
                        </td>
                      </tr>
                    ) : (
                      assessments.map((item) => (
                        <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="p-3 font-medium">{item.trackingNumber}</td>
                          <td className="p-3">{item.businessName}</td>
                          <td className="p-3">{item.businessOwner}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800  ' :
                              item.status === 'REJECTED' ? 'bg-rose-100 text-rose-800  ' :
                                'bg-amber-100 text-amber-800  '
                              }`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.paymentStatus === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800  '
                              : 'bg-amber-100 text-amber-800  '
                              }`}>
                              {item.paymentStatus}
                            </span>
                          </td>
                          <td className="p-3">{new Date(item.applicationDate).toLocaleDateString()}</td>
                          <td className="p-3">
                            <button
                              onClick={() => setSelectedAssessmentView(item)}
                              className="text-blue-600 hover:underline font-semibold cursor-pointer"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-500 pt-2">
                <span>Page {currentPage} of {totalPages}</span>
                <div className="flex gap-1">
                  <button
                    disabled={currentPage <= 1 || loading}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    className="px-3 py-1 border border-slate-300 rounded disabled:opacity-40 cursor-pointer hover:bg-slate-100"
                  >
                    Previous
                  </button>
                  <button
                    disabled={currentPage >= totalPages || loading}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    className="px-3 py-1 border border-slate-300 rounded disabled:opacity-40 cursor-pointer hover:bg-slate-100"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <UnifiedFooter />
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          {isModalOpen === 'appointment' && (
            <form onSubmit={handleAppointmentSubmit} className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[94vh] overflow-y-auto">
              <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50">
                <h3 className="font-bold text-sm text-slate-800">Schedule Municipal Appointment</h3>
                <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer">✕</button>
              </div>
              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-red-600 mb-1">* Department</label>
                  <select
                    value={aptForm.department}
                    onChange={(e) => setAptForm({ ...aptForm, department: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded bg-slate-50"
                  >
                    <option>City Treasurer's Office</option>
                    <option>Business Permits and Licensing Department (BPLD)</option>
                    <option>Zoning and Urban Planning Office</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-red-600 mb-1">* Appointment Type / Purpose</label>
                  <select
                    required
                    value={aptForm.appointmentType}
                    onChange={(e) => setAptForm({ ...aptForm, appointmentType: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded bg-slate-50"
                  >
                    <option value="">Select appointment purpose...</option>
                    <option value="Business Tax Assessment Review">Business Tax Assessment Review</option>
                    <option value="Payment Verification & Clearance">Payment Verification & Clearance Issuance</option>
                    <option value="New Mayor's Permit Application Filing">New Mayor's Permit Application Filing</option>
                    <option value="Renewal Consultation">Renewal Consultation & Discrepancy Resolution</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Registered Business Name</label>
                    <input
                      type="text"
                      value={aptForm.businessName}
                      onChange={(e) => setAptForm({ ...aptForm, businessName: e.target.value })}
                      placeholder="Enter business name"
                      className="w-full p-2 border border-slate-300 rounded bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Tax Identification Number (TIN)</label>
                    <input
                      type="text"
                      value={aptForm.tin}
                      onChange={(e) => setAptForm({ ...aptForm, tin: e.target.value })}
                      placeholder="000-000-000-000"
                      className="w-full p-2 border border-slate-300 rounded bg-slate-50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Business / Office Address</label>
                  <input
                    type="text"
                    value={aptForm.address}
                    onChange={(e) => setAptForm({ ...aptForm, address: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded bg-slate-50"
                    placeholder="Street, Barangay, City"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Detailed Concern / Description</label>
                  <input
                    type="text"
                    value={aptForm.description}
                    onChange={(e) => setAptForm({ ...aptForm, description: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded bg-slate-50"
                    placeholder="Provide details regarding your assessment inquiry"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-red-600 mb-1">* Full Name</label>
                  <input
                    required
                    type="text"
                    value={aptForm.fullName}
                    onChange={(e) => setAptForm({ ...aptForm, fullName: e.target.value })}
                    placeholder="Enter full name"
                    className="w-full p-2 border border-slate-300 rounded bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-red-600 mb-1">* Email Address</label>
                  <input
                    required
                    type="email"
                    value={aptForm.email}
                    onChange={(e) => setAptForm({ ...aptForm, email: e.target.value })}
                    placeholder="Enter email address"
                    className="w-full p-2 border border-slate-300 rounded bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-red-600 mb-1">* Phone Number (Exact 11 Digits)</label>
                  <input
                    required
                    type="text"
                    maxLength={11}
                    value={aptForm.phone}
                    onChange={(e) => setAptForm({ ...aptForm, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                    placeholder="09123456789"
                    className="w-full p-2 border border-slate-300 rounded bg-slate-50 font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Must be exactly 11 digits (e.g. 09XXXXXXXXX). Current count: {aptForm.phone.length}/11</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-red-600 mb-1">* Preferred Date</label>
                    <input
                      required
                      type="date"
                      value={aptForm.date}
                      onChange={(e) => setAptForm({ ...aptForm, date: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-red-600 mb-1">* Time Slot</label>
                    <select
                      value={aptForm.timeSlot}
                      onChange={(e) => setAptForm({ ...aptForm, timeSlot: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded bg-slate-50"
                    >
                      <option value="08:00 AM - 09:00 AM">08:00 AM - 09:00 AM</option>
                      <option value="09:00 AM - 10:00 AM">09:00 AM - 10:00 AM</option>
                      <option value="10:00 AM - 11:00 AM">10:00 AM - 11:00 AM</option>
                      <option value="01:00 PM - 02:00 PM">01:00 PM - 02:00 PM</option>
                      <option value="02:00 PM - 03:00 PM">02:00 PM - 03:00 PM</option>
                      <option value="03:00 PM - 04:00 PM">03:00 PM - 04:00 PM</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Additional Remarks (Optional)</label>
                  <textarea
                    rows={2}
                    value={aptForm.remarks}
                    onChange={(e) => setAptForm({ ...aptForm, remarks: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded bg-slate-50 resize-none"
                    placeholder="Any special instructions or accessibility requests..."
                  />
                </div>
                <div className="p-3 border border-slate-300 rounded bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className="bg-blue-100 text-blue-800 px-2.5 py-1 rounded font-mono">
                      {captchaNum1} + {captchaNum2} = ?
                    </span>
                    <span className="text-slate-600">Security Verification</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      required
                      type="number"
                      value={captchaInput}
                      onChange={(e) => setCaptchaInput(e.target.value)}
                      placeholder="Answer"
                      className="w-20 p-1.5 text-xs text-center border border-slate-300 rounded bg-white font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setCaptchaNum1(Math.floor(Math.random() * 10) + 1);
                        setCaptchaNum2(Math.floor(Math.random() * 10) + 1);
                        setCaptchaInput('');
                      }}
                      className="text-[10px] text-blue-600 hover:underline font-bold cursor-pointer"
                    >
                      Refresh
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 px-6 py-3 border-t border-slate-200 bg-slate-50">
                <button type="button" onClick={closeModal} className="px-4 py-2 border border-slate-300 rounded font-semibold hover:bg-slate-100 cursor-pointer">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow-xs cursor-pointer">
                  {submitting ? 'Submitting...' : 'SUBMIT APPOINTMENT'}
                </button>
              </div>
            </form>
          )}
          {isModalOpen === 'tax-bill' && (
            <form onSubmit={handleTaxBillVerification} className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
              <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50">
                <h3 className="font-bold text-sm text-slate-800">TAX BILL NUMBER VERIFICATION</h3>
                <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer">✕</button>
              </div>
              <div className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tax Identification Number (TIN)</label>
                  <input
                    required
                    type="text"
                    value={taxBillForm.tin}
                    onChange={(e) => setTaxBillForm({ ...taxBillForm, tin: e.target.value })}
                    placeholder="000-000-000-000"
                    className="w-full p-2.5 border border-slate-300 rounded bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Mayor's Permit Number</label>
                  <input
                    required
                    type="text"
                    value={taxBillForm.permitNo}
                    onChange={(e) => setTaxBillForm({ ...taxBillForm, permitNo: e.target.value })}
                    placeholder="Enter Mayor's Permit No."
                    className="w-full p-2.5 border border-slate-300 rounded bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tax Bill Number</label>
                  <input
                    required
                    type="text"
                    value={taxBillForm.taxBillNo}
                    onChange={(e) => setTaxBillForm({ ...taxBillForm, taxBillNo: e.target.value })}
                    placeholder="Enter Tax Bill No."
                    className="w-full p-2.5 border border-slate-300 rounded bg-slate-50"
                  />
                </div>
                {verificationResult && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 font-mono">
                    <p className="font-bold">Status: {verificationResult.status || 'Verified Successfully'}</p>
                    {verificationResult.message && <p>{verificationResult.message}</p>}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 px-6 py-3 border-t border-slate-200 bg-slate-50">
                <button type="button" onClick={closeModal} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded shadow-xs cursor-pointer">Close</button>
                <button type="submit" disabled={verifying} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded shadow-xs cursor-pointer">
                  {verifying ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            </form>
          )}
          {isModalOpen === 'or-number' && (
            <form onSubmit={handleTaxBillVerification} className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
              <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50">
                <h3 className="font-bold text-sm text-slate-800">O.R. NUMBER VERIFICATION</h3>
                <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer">✕</button>
              </div>
              <div className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tax Identification Number (TIN)</label>
                  <input
                    required
                    type="text"
                    value={orForm.tin}
                    onChange={(e) => setOrForm({ ...orForm, tin: e.target.value })}
                    placeholder="000-000-000-000"
                    className="w-full p-2.5 border border-slate-300 rounded bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Mayor's Permit Number</label>
                  <input
                    required
                    type="text"
                    value={orForm.permitNo}
                    onChange={(e) => setOrForm({ ...orForm, permitNo: e.target.value })}
                    placeholder="Enter Mayor's Permit No."
                    className="w-full p-2.5 border border-slate-300 rounded bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">O.R. Number</label>
                  <input
                    required
                    type="text"
                    value={orForm.orNo}
                    onChange={(e) => setOrForm({ ...orForm, orNo: e.target.value })}
                    placeholder="Enter Official Receipt (O.R.) No."
                    className="w-full p-2.5 border border-slate-300 rounded bg-slate-50"
                  />
                </div>
                {verificationResult && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 font-mono">
                    <p className="font-bold">Official Receipt Verified Successfully</p>
                    <p>Paid Amount: ₱{verificationResult.amount || 'N/A'}</p>
                    {verificationResult.status && <p>Status: {verificationResult.status}</p>}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 px-6 py-3 border-t border-slate-200 bg-slate-50">
                <button type="button" onClick={closeModal} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded shadow-xs cursor-pointer">Close</button>
                <button type="submit" disabled={verifying} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded shadow-xs cursor-pointer">
                  {verifying ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            </form>
          )}
          {isModalOpen === 'sales-declaration' && (
            <form onSubmit={handleSalesDeclarationSubmit} className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
              <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50">
                <h3 className="font-bold text-sm text-slate-800">SUBMIT ONLINE SALES DECLARATION</h3>
                <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer">✕</button>
              </div>
              <div className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Business Name</label>
                  <input
                    required
                    type="text"
                    value={salesForm.businessName}
                    onChange={(e) => setSalesForm({ ...salesForm, businessName: e.target.value })}
                    placeholder="Enter registered business name"
                    className="w-full p-2.5 border border-slate-300 rounded bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tax Identification Number (TIN)</label>
                  <input
                    required
                    type="text"
                    value={salesForm.tin}
                    onChange={(e) => setSalesForm({ ...salesForm, tin: e.target.value })}
                    placeholder="000-000-000-000"
                    className="w-full p-2.5 border border-slate-300 rounded bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">PSIC Code (Line of Business)</label>
                  <select
                    value={salesForm.psicCode}
                    onChange={(e) => setSalesForm({ ...salesForm, psicCode: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded bg-slate-50"
                  >
                    <option value="47110">47110 - Retail Sale in Non-Specialized Stores (Supermarkets/Sari-Sari)</option>
                    <option value="56101">56101 - Restaurants and Mobile Food Service Activities</option>
                    <option value="62010">62010 - Computer Programming, Consultancy and Related Activities</option>
                    <option value="45200">45200 - Maintenance and Repair of Motor Vehicles</option>
                    <option value="10710">10710 - Manufacture of Bakery Products</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Gross Sales / Receipts (PHP)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={salesForm.grossSales}
                    onChange={(e) => setSalesForm({ ...salesForm, grossSales: e.target.value })}
                    placeholder="0.00"
                    className="w-full p-2.5 border border-slate-300 rounded bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tax Year</label>
                  <input
                    required
                    type="text"
                    value={salesForm.year}
                    onChange={(e) => setSalesForm({ ...salesForm, year: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Financial Statement / ITR (PDF/Image)</label>
                  <input
                    required
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(e) => setSalesForm({ ...salesForm, file: e.target.files ? e.target.files[0] : null })}
                    className="w-full p-2 border border-slate-300 rounded bg-slate-50 text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 px-6 py-3 border-t border-slate-200 bg-slate-50">
                <button type="button" onClick={closeModal} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded shadow-xs cursor-pointer">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded shadow-xs cursor-pointer">
                  {submitting ? 'Submitting...' : 'Submit Declaration'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
      {selectedAssessmentView && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full max-h-[94vh] overflow-y-auto p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide">
                  Assessment Filing Details
                </h3>
                <p className="text-xs font-mono text-blue-600">{selectedAssessmentView.trackingNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAssessmentView(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer font-bold text-lg"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 text-xs max-h-[60vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div>
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Business Name</span>
                  <span className="font-semibold text-slate-800">{selectedAssessmentView.businessName}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Owner</span>
                  <span className="font-semibold text-slate-800">{selectedAssessmentView.businessOwner}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">TIN</span>
                  <span className="font-mono font-medium text-slate-700">{selectedAssessmentView.tin || 'N/A'}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Status</span>
                  <span className={`inline-block px-2 py-0.5 rounded font-bold text-[10px] mt-0.5 ${selectedAssessmentView.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                    selectedAssessmentView.status === 'REJECTED' ? 'bg-rose-100 text-rose-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                    {selectedAssessmentView.status}
                  </span>
                </div>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1">
                <div className="font-semibold text-slate-700">Application Date:</div>
                <div className="text-slate-600">{new Date(selectedAssessmentView.applicationDate).toLocaleDateString()}</div>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                <div className="font-semibold text-slate-700">Submitted Financial Documents:</div>
                {selectedAssessmentView.attachments && selectedAssessmentView.attachments.length > 0 ? (
                  selectedAssessmentView.attachments.map((file, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white px-3 py-2 rounded-xl border border-slate-200">
                      <span className="font-medium text-slate-800 truncate max-w-[220px] flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        {file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => window.open(file.url, '_blank', 'noopener,noreferrer')}
                        className="text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        Preview Document
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 italic">No files attached.</p>
                )}
              </div>
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                <div className="font-semibold text-slate-700">Treasurer's Office Remarks:</div>
                <div className="text-slate-600 italic">
                  {selectedAssessmentView.remarks || 'No remarks provided yet. Your declaration is currently under review.'}
                </div>
              </div>
              <div className="flex items-center justify-between bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <span className="font-semibold text-slate-700">Payment Status:</span>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${selectedAssessmentView.paymentStatus === 'PAID'
                  ? 'bg-emerald-100 text-emerald-800  '
                  : 'bg-amber-100 text-amber-800  '
                  }`}>
                  {selectedAssessmentView.paymentStatus}
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-200 gap-2">
              {selectedAssessmentView.status === 'APPROVED' &&
                selectedAssessmentView.paymentStatus !== 'PAID' && (
                  <button
                    type="button"
                    disabled={isProcessingPayment}
                    onClick={() => openBusinessTaxPayment(selectedAssessmentView)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isProcessingPayment ? "Generating QR..." : "Proceed to Digital Payment →"}
                  </button>
                )}
              {selectedAssessmentView.paymentStatus === 'PAID' && (
                <span className="px-3 py-2 bg-emerald-100 text-emerald-800 font-bold rounded-xl text-xs">
                  Payment PAID
                </span>
              )}
              <button
                type="button"
                onClick={() => setSelectedAssessmentView(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs ml-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {isPaymentStep && paymentAssessment && (
        <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto overscroll-contain">
          <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-5xl max-h-[96vh] shadow-2xl border border-slate-200 overflow-y-auto my-auto">
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 min-w-0">

                <div className="p-4 sm:p-6 lg:p-8 lg:border-r border-slate-200 min-w-0">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                    Business Tax Payment
                  </h2>

                  <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1 break-all">
                    ({paymentAssessment.trackingNumber})
                  </p>

                  <p className="text-sm text-slate-500 mt-3">
                    Business Tax Assessment ({paymentAssessment.businessName})
                  </p>

                  <p className="text-sm text-slate-600 mt-4">
                    Billed to{" "}
                    <span className="font-bold text-slate-900">
                      {user?.fullname || "Business Taxpayer"}
                    </span>
                    {user?.email && (
                      <>
                        ,{" "}
                        <span className="text-slate-600">{user.email}</span>
                      </>
                    )}
                  </p>

                  <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50/60 p-5">
                    <p className="text-xs font-black uppercase tracking-wide text-blue-900 mb-3">
                      Computed Local Government Statutory Fees (RA 7160)
                    </p>

                    <div className="space-y-0 text-sm">
                      <div className="flex justify-between items-center gap-4 py-2 border-b border-blue-200">
                        <span className="text-slate-600">Local Business Tax (LBT)</span>
                        <span className="font-bold text-slate-900 whitespace-nowrap">
                          ₱{Number(paymentAssessment.computedFees?.lbt || 0).toLocaleString("en-PH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>

                      <div className="flex justify-between items-center gap-4 py-2 border-b border-blue-200">
                        <span className="text-slate-600">Mayor's Permit Fee</span>
                        <span className="font-bold text-slate-900 whitespace-nowrap">
                          ₱{Number(paymentAssessment.computedFees?.mayorsPermit || 0).toLocaleString("en-PH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>

                      <div className="flex justify-between items-center gap-4 py-2 border-b border-blue-200">
                        <span className="text-slate-600">Sanitary Inspection Fee</span>
                        <span className="font-bold text-slate-900 whitespace-nowrap">
                          ₱{Number(paymentAssessment.computedFees?.sanitaryFee || 0).toLocaleString("en-PH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>

                      <div className="flex justify-between items-center gap-4 py-2 border-b border-blue-200">
                        <span className="text-slate-600">Garbage Fee</span>
                        <span className="font-bold text-slate-900 whitespace-nowrap">
                          ₱{Number(paymentAssessment.computedFees?.garbageFee || 0).toLocaleString("en-PH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>

                      <div className="flex justify-between items-center gap-4 py-2">
                        <span className="text-slate-600">Fire Safety Inspection Fee (10% BFP share)</span>
                        <span className="font-bold text-slate-900 whitespace-nowrap ml-3">
                          ₱{Number(paymentAssessment.computedFees?.fireSafetyFee || 0).toLocaleString("en-PH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center gap-4 mt-3 pt-3 border-t border-blue-300">
                      <span className="font-black text-blue-800">Total Payable Assessment</span>
                      <span className="font-black text-lg text-blue-700 whitespace-nowrap">
                        ₱{Number(paymentAssessment.computedFees?.total || 0).toLocaleString("en-PH", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 pt-5 border-t border-slate-200">
                    <p className="text-4xl sm:text-5xl font-black text-emerald-600">
                      ₱{Number(paymentAssessment.computedFees?.total || 0).toLocaleString("en-PH", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>

                    <div className="flex justify-between items-center mt-8 text-sm">
                      <span className="text-slate-600">Subtotal</span>
                      <span className="font-bold text-slate-900">
                        ₱{Number(paymentAssessment.computedFees?.total || 0).toLocaleString("en-PH", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>

                    <div className="flex justify-between items-center mt-4 text-sm">
                      <span className="text-slate-600">Payment Fees</span>
                      <span className="font-semibold text-slate-900">Free</span>
                    </div>

                    <div className="flex justify-between items-center mt-5 pt-5 border-t border-slate-200">
                      <span className="font-black text-slate-900">Total Due</span>
                      <span className="font-black text-lg text-slate-900">
                        ₱{Number(paymentAssessment.computedFees?.total || 0).toLocaleString("en-PH", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-6 lg:p-8 bg-slate-50/60 flex flex-col items-center min-w-0">
                  <div className="w-full text-center">
                    <p className="text-base sm:text-lg font-black text-slate-900">Scan QR Ph code to pay</p>
                    <p className="text-xs text-slate-500 mt-2">Use your supported banking or e-wallet app.</p>
                  </div>

                  {isProcessingPayment && !qrCodeUrl && (
                    <div className="w-full max-w-sm mt-5 rounded-2xl border border-slate-200 bg-white p-6 sm:p-10 flex flex-col items-center text-center shadow-sm">
                      <div className="h-10 w-10 border-4 border-blue-200 border-t-blue-700 rounded-full animate-spin mb-4" />
                      <p className="text-sm font-bold text-slate-800">Generating QR Ph code...</p>
                      <p className="text-xs text-slate-500 mt-1">Please wait while PayMongo prepares your secure payment.</p>
                    </div>
                  )}

                  {!isProcessingPayment && qrError && !qrCodeUrl && (
                    <div className="w-full max-w-sm mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:p-5 text-center">
                      <p className="text-xs font-bold text-rose-700">{qrError}</p>
                      <button type="button" onClick={() => void handlePayMongoBusinessTaxQrPayment(paymentAssessment)} className="mt-4 px-5 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold">Generate QR Again</button>
                    </div>
                  )}

                  {qrCodeUrl && !qrPaymentPaid && (
                    <div className="w-full flex flex-col items-center mt-5">
                      <div className="w-full max-w-sm rounded-xl border border-blue-200 bg-blue-50 px-3 sm:px-4 py-3 text-center mb-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">QR Code Refreshes In</p>
                        <p className="text-xl sm:text-2xl font-black tabular-nums text-blue-700">{Math.floor(qrSecondsRemaining / 60)}:{String(qrSecondsRemaining % 60).padStart(2, "0")}</p>
                        {qrReferenceNumber && <p className="text-[10px] font-mono text-slate-500 mt-1">Ref: {qrReferenceNumber}</p>}
                      </div>
                      <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-md max-w-full">
                        <img src={qrCodeUrl} alt="PayMongo Dynamic QR Ph payment code" className="w-[min(72vw,18rem)] h-[min(72vw,18rem)] max-w-full object-contain" />
                      </div>
                      <p className="text-xs text-slate-500 text-center mt-3 max-w-sm px-2">Scan the QR code with your preferred supported payment app. Your payment will be confirmed automatically through PayMongo.</p>
                      <div className="mt-4 flex items-center gap-2 text-xs font-bold text-blue-700">
                        <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" /> Waiting for payment...
                      </div>
                    </div>
                  )}
                </div>              </div>

              <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5 border-t border-slate-200 bg-white flex justify-end sticky bottom-0">
                <button
                  type="button"
                  onClick={closeBusinessTaxPayment}
                  disabled={isProcessingPayment}
                  className="px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 font-bold text-sm transition-colors"
                >
                  Close
                </button>
              </div>
            </>
          </div>
        </div>
      )}
      {/* Payment Success Screen - same clean style as RPT */}
      {isPaymentSuccess && paymentAssessment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-md overflow-y-auto overscroll-contain">
          <div className="relative w-full max-w-lg max-h-[94vh] overflow-y-auto rounded-2xl sm:rounded-[28px] bg-white p-5 sm:p-8 shadow-2xl text-center">
            <div className="mx-auto mb-4 sm:mb-5 h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg viewBox="0 0 52 52" className="h-10 w-10 sm:h-12 sm:w-12 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M14 27l8 8 17-19" /></svg>
            </div>
            <p className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">PAYMENT CONFIRMED</p>
            <h2 className="mt-3 sm:mt-4 text-xl sm:text-2xl font-black text-slate-900">Payment Successful!</h2>
            <p className="mt-2 text-sm text-slate-500">Your Business Tax payment has been confirmed.</p>
            <div className="mt-5 rounded-2xl bg-slate-50 border border-slate-200 p-4 sm:p-5 text-left space-y-3 text-sm overflow-x-auto">
              <div className="flex justify-between gap-4"><span className="text-slate-500">Service</span><span className="font-bold text-right">Business Tax Assessment</span></div>
              <div className="flex justify-between gap-4"><span className="text-slate-500">Amount Paid</span><span className="font-black">₱{Number(paymentAssessment.computedFees?.total || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
              <div className="flex justify-between gap-4"><span className="text-slate-500">Reference</span><span className="font-mono font-bold text-right break-all">{qrReferenceNumber || paymentAssessment.trackingNumber || "Confirmed"}</span></div>
              {paymentConfirmedAt && <div className="flex justify-between gap-4"><span className="text-slate-500">Date</span><span className="font-bold text-right">{paymentConfirmedAt.toLocaleString("en-PH")}</span></div>}
            </div>
            <button type="button" onClick={() => { setIsPaymentSuccess(false); setPaymentAssessment(null); setQrPaymentPaid(false); setPaymentConfirmedAt(null); setQrReferenceNumber(""); setCurrentScreen('assessment-list'); setCurrentPage(1); }} className="mt-6 w-full rounded-xl bg-[#1D3F99] hover:bg-[#17357F] text-white py-3 font-extrabold text-sm">Done</button>
          </div>
        </div>
      )}

    </div>
  );
};
export default BusinessTaxAssessmentView;