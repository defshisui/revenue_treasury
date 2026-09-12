import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import logoSystem from '../assets/logo-system.png';
import CitizenLayout from './CitizenLayout';
import { getEncryptedItem } from './citizenSecurity';

export default function CitizenPortal() {
  const navigate = useNavigate();

  const [user, setUser] = useState<{ fullname: string; firstName: string }>({
    fullname: 'RENZ MILLARES',
    firstName: 'RENZ',
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Services');

  // FAQ accordion state
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  // Modals state
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [trackingIdInput, setTrackingIdInput] = useState('');
  const [trackedResult, setTrackedResult] = useState<any | null>(null);

  const [isCalculatorModalOpen, setIsCalculatorModalOpen] = useState(false);
  const [calcType, setCalcType] = useState<'rpt' | 'btax' | 'stall'>('rpt');
  const [calcInput, setCalcInput] = useState({ marketValue: '500000', grossSales: '1200000', stallSqm: '12' });
  const [calcResult, setCalcResult] = useState<number | null>(null);

  useEffect(() => {
    const checkUserSession = async () => {
      try {
        const encData =
          (await getEncryptedItem('currentUser')) ||
          (await getEncryptedItem('user'));
        let target = encData;

        if (encData && typeof encData === 'object') {
          target =
            (encData as any).user && typeof (encData as any).user === 'object'
              ? (encData as any).user
              : encData;
        }

        if (!target) {
          const raw =
            localStorage.getItem('currentUser') ||
            localStorage.getItem('user') ||
            sessionStorage.getItem('currentUser') ||
            sessionStorage.getItem('user');
          if (raw) {
            const parsed = JSON.parse(raw);
            target =
              parsed.user && typeof parsed.user === 'object'
                ? parsed.user
                : parsed;
          }
        }

        if (target) {
          const fullName =
            target.fullname ||
            target.name ||
            target.fullName ||
            target.firstName ||
            target.email ||
            'RENZ MILLARES';
          const nameParts = String(fullName).trim().split(' ');
          const firstName = nameParts[0].toUpperCase();

          setUser({
            fullname: String(fullName),
            firstName,
          });
        }
      } catch (e) {
        console.error('Failed to parse user session', e);
      }
    };

    checkUserSession();
  }, []);

  // Category filter items
  const categories = [
    'All Services',
    'Real Property Tax',
    'Business Taxes',
    'Market & Vendors',
    'Regulatory & Treasury',
  ];

  // 6 Priority Services (Image 2 UI style)
  const priorityServices = [
    {
      id: 'rpt-service',
      title: 'Real Property Tax (RPT)',
      category: 'Real Property Tax',
      tag: 'Annual & Quarterly Assessment',
      description:
        'Annual real property tax filing and payment with early settlement discounts for land, buildings, and machinery.',
      requirements: [
        'Latest Tax Declaration (TD)',
        'Previous Official Receipt (OR)',
        'Valid Government ID / QCID',
        'Transfer Certificate of Title (TCT)',
      ],
      actionLabel: 'File Property Tax Assessment',
      actionPath: '/real-property-tax-hub',
      iconBg: 'bg-blue-50 text-blue-700',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      id: 'btax-service',
      title: 'Business Tax Assessment',
      category: 'Business Taxes',
      tag: 'Annual Business Renewal',
      description:
        'Gross sales declaration, regulatory fee computation, and local business tax clearance processing.',
      requirements: [
        'Audited Financial Statement / BIR 1701/1702',
        "Previous Year Official Receipt & Mayor's Permit",
        'Barangay Business Clearance',
        'Valid Government-issued ID',
      ],
      actionLabel: 'Assess Business Tax',
      actionPath: '/business-tax-assessment',
      iconBg: 'bg-indigo-50 text-indigo-700',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: 'stall-service',
      title: 'City-Owned Market Stall Lease',
      category: 'Market & Vendors',
      tag: 'Public Market Rental',
      description:
        'Application for vacant public wet and dry market stalls in Galas, Kamuning, Murphy, and other city markets.',
      requirements: [
        "Certificate of Residency / Voter's ID",
        'Barangay Clearance & Police Clearance',
        '2x2 Recent ID Pictures',
        'Sanitary Health Certificate',
      ],
      actionLabel: 'Apply for Market Stall',
      actionPath: '/citizen-portal-stall',
      iconBg: 'bg-emerald-50 text-emerald-700',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      id: 'hawker-service',
      title: 'Street Hawker & Vendor Registration',
      category: 'Market & Vendors',
      tag: 'Special Vending Permit',
      description:
        'Registration and designation permit for mobile hawkers and sidewalk vendors in designated vending zones.',
      requirements: [
        'Barangay Indigency / Endorsement',
        'Proof of Residence in the City',
        'Hawkers Special Zone Clearance',
        'Valid Government ID',
      ],
      actionLabel: 'Register Hawker Permit',
      actionPath: '/hawker-application',
      iconBg: 'bg-amber-50 text-amber-700',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      ),
    },
    {
      id: 'regulatory-service',
      title: 'Regulatory Fees & Clearances',
      category: 'Regulatory & Treasury',
      tag: 'Treasury Clearances',
      description:
        'Settlement of sanitary inspection fees, building inspection certificates, fire safety, and environmental permits.',
      requirements: [
        'Inspection Assessment Order',
        'Community Tax Certificate (Cedula)',
        'Zoning Compliance Certificate',
        'Proof of Payment of Previous Fees',
      ],
      actionLabel: 'Pay Regulatory Fees',
      actionPath: '/business-tax-assessment',
      iconBg: 'bg-purple-50 text-purple-700',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      id: 'ledger-service',
      title: 'Stall Account Management & Ledger',
      category: 'Market & Vendors',
      tag: 'Vendor Account Portal',
      description:
        'Check monthly stall rental dues, view payment ledger, settled receipts, and contract renewal schedule.',
      requirements: [
        'Stall Award Notice / Contract of Lease',
        'Stall Number & Market Location Code',
        'Registered Vendor Account ID',
        'Latest Payment Slip / Official Receipt',
      ],
      actionLabel: 'Manage Stall Account',
      actionPath: '/citizen-portal-stall-manage-account',
      iconBg: 'bg-cyan-50 text-cyan-700',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
    },
  ];

  // 7 Modules (Images 3 & 4 UI style)
  const modulesList = [
    {
      id: 'mod-rpt',
      title: 'Real Property Tax Hub',
      subtitle: 'Assessor & Treasury Services',
      description:
        'Comprehensive land, building, and machinery assessment hub with automated discounts, assessment verification, and tax clearance.',
      category: 'Real Property Tax',
      features: [
        'Early Bird 20% Discount',
        'Online Title Verification',
        'Instant Electronic Receipt',
        'Tax Clearance Generation',
      ],
      primaryLabel: 'Explore Property Tax',
      primaryPath: '/real-property-tax-hub',
      secondaryLabel: 'Compute Assessment',
      secondaryAction: () => {
        setCalcType('rpt');
        setIsCalculatorModalOpen(true);
      },
      iconBg: 'bg-blue-50 text-blue-700 border border-blue-200',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      id: 'mod-btax',
      title: 'Business Tax Assessment & Clearances',
      subtitle: 'BPLO & Treasury Assessment',
      description:
        'Compute annual business taxes based on graduated gross sales brackets, regulatory fees, garbage fees, and sanitary charges.',
      category: 'Business Taxes',
      features: [
        'Automated Bracket Computation',
        'Quarter Payment Option',
        "Mayor's Permit Clearance",
        'BIR Gross Reconciliation',
      ],
      primaryLabel: 'Assess Business Tax',
      primaryPath: '/business-tax-assessment',
      secondaryLabel: 'Declare Gross Sales',
      secondaryAction: () => {
        setCalcType('btax');
        setIsCalculatorModalOpen(true);
      },
      iconBg: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: 'mod-city-stall',
      title: 'City-Owned Market Stalls',
      subtitle: 'Public Market Administration',
      description:
        'Apply for public market stalls across 8 city wet/dry markets, process stall renewals, extension permits, and change of line.',
      category: 'Market & Vendors',
      features: [
        'Galas, Kamuning & Murphy',
        'Stall Transfer & Repair Permits',
        'Verified Awarding System',
        'Subsidized Utility Rates',
      ],
      primaryLabel: 'Apply Market Stall',
      primaryPath: '/citizen-portal-stall',
      secondaryLabel: 'Manage Stall Account',
      secondaryAction: () => navigate('/citizen-portal-stall-manage-account'),
      iconBg: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      id: 'mod-pvt-stall',
      title: 'Private Market & Commercial Stalls',
      subtitle: 'Commercial Stall Registry',
      description:
        'Regulatory oversight, annual inspection compliance, and account verification for private market operators and leased stalls.',
      category: 'Market & Vendors',
      features: [
        'Commercial Operator Clearance',
        'Lease Verification',
        'Sanitation Standards Audit',
        'Masterlist Record Check',
      ],
      primaryLabel: 'Manage Private Stall',
      primaryPath: '/private-manage-account',
      secondaryLabel: 'Check Operator Status',
      secondaryAction: () => navigate('/market-vendor-tab'),
      iconBg: 'bg-teal-50 text-teal-700 border border-teal-200',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
        </svg>
      ),
    },
    {
      id: 'mod-hawker',
      title: 'Hawkers & Mobile Vendors Program',
      subtitle: 'Sidewalk & Hawker Regulation',
      description:
        'Special registration and identification for street vendors, mobile carts, food trucks, and night market designated areas.',
      category: 'Market & Vendors',
      features: [
        'Designated Zone Mapping',
        'Official Hawker ID Card',
        'Micro-business Protection',
        'Simplified Document Filing',
      ],
      primaryLabel: 'Apply Hawker Permit',
      primaryPath: '/hawker-application',
      secondaryLabel: 'View Vending Guidelines',
      secondaryAction: () => navigate('/market-vendor-tab'),
      iconBg: 'bg-amber-50 text-amber-700 border border-amber-200',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      ),
    },
    {
      id: 'mod-regulatory',
      title: 'Regulatory Fees & Community Tax (Cedula)',
      subtitle: 'City Treasury Collections',
      description:
        'One-stop settlement for Community Tax Certificate (Cedula), weights and measures sealing, garbage fees, and inspection clearances.',
      category: 'Regulatory & Treasury',
      features: [
        'Online Cedula Issuance',
        'Weights & Measures Seal',
        'Inspection Clearances',
        'Digital Payment Gateways',
      ],
      primaryLabel: 'Pay Regulatory Fees',
      primaryPath: '/business-tax-assessment',
      secondaryLabel: 'Get Cedula / CTC',
      secondaryAction: () => navigate('/business-tax-assessment'),
      iconBg: 'bg-purple-50 text-purple-700 border border-purple-200',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      id: 'mod-payment-hub',
      title: 'Treasury Payment & Electronic Receipts Hub',
      subtitle: 'Official Electronic Receipts (e-OR)',
      description:
        'Check and track all tax assessments, view verified payments, download government official receipts (e-OR), and generate proof of tax settlement.',
      category: 'Regulatory & Treasury',
      features: [
        'Real-time Payment Status',
        'Tamper-proof QR e-OR',
        'Complete Audit Trail',
        'Instant Tax Clearance',
      ],
      primaryLabel: 'Open Payment Tracker',
      primaryPath: '/citizen-portal-stall-status',
      secondaryLabel: 'View Application History',
      secondaryAction: () => navigate('/citizen-portal-stall-status'),
      iconBg: 'bg-sky-50 text-sky-700 border border-sky-200',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
    },
  ];

  // FAQs list
  const faqs = [
    {
      q: 'How do I avail of the early payment discount for Real Property Tax?',
      a: 'Property owners who pay their annual Real Property Tax on or before December 31 of the preceding year receive up to a 20% prompt payment discount. Payments made on or before March 31 of the current year receive a 10% discount.',
    },
    {
      q: 'What are the requirements to apply for a vacant stall in a city-owned public market?',
      a: "Applicants must be bonafide city residents, at least 18 years of age, provide a valid Government ID / QCID, Barangay Clearance, Police Clearance, 2x2 ID photos, and submit the online City-Owned Stall Application. Stall awards are subject to Market Committee adjudication.",
    },
    {
      q: 'How is Business Tax computed for new vs. renewing enterprises?',
      a: 'Newly registered businesses pay initial fees based on registered capital investment. Renewing businesses are assessed using statutory graduated tax brackets based on their sworn gross sales or receipts from the preceding calendar year, supported by BIR returns.',
    },
    {
      q: 'Where can I download my Official Electronic Receipt (e-OR) after payment?',
      a: 'After completing online payment via GCash, Maya, Landbank, or Online Banking, the Treasury system validates the transaction and generates a verifiable QR-coded Electronic Official Receipt (e-OR). You can download and print it immediately from the Application History / Payment Ledger page.',
    },
    {
      q: 'Can I pay my taxes and stall rentals in quarterly installments?',
      a: 'Yes. Both Real Property Taxes and Business Taxes can be settled in four equal quarterly installments due on March 31, June 30, September 30, and December 31 without interest or penalties.',
    },
  ];

  // Filter priority services
  const filteredPriorityServices = priorityServices.filter((s) => {
    const matchCat =
      selectedCategory === 'All Services' || s.category === selectedCategory;
    const matchQuery =
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.requirements.some((r) =>
        r.toLowerCase().includes(searchQuery.toLowerCase())
      );
    return matchCat && matchQuery;
  });

  // Filter 7 modules
  const filteredModules = modulesList.filter((m) => {
    const matchCat =
      selectedCategory === 'All Services' || m.category === selectedCategory;
    const matchQuery =
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.features.some((f) =>
        f.toLowerCase().includes(searchQuery.toLowerCase())
      );
    return matchCat && matchQuery;
  });

  // Calculator logic
  const handleCalculate = () => {
    if (calcType === 'rpt') {
      const val = parseFloat(calcInput.marketValue) || 0;
      // 20% assessment level * 2% basic + 1% SEF = 3% of assessed value with 20% early discount
      const assessedVal = val * 0.2;
      const baseTax = assessedVal * 0.03;
      const discounted = baseTax * 0.8;
      setCalcResult(discounted);
    } else if (calcType === 'btax') {
      const gross = parseFloat(calcInput.grossSales) || 0;
      // Standard 1.5% bracket estimate
      const tax = gross * 0.015;
      setCalcResult(tax);
    } else {
      const sqm = parseFloat(calcInput.stallSqm) || 0;
      // 35 PHP per sqm per day * 30 days
      const monthly = sqm * 35 * 30;
      setCalcResult(monthly);
    }
  };

  // Tracking query
  const handleSearchTracking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingIdInput.trim()) return;

    if (trackingIdInput.toUpperCase().includes('RPT')) {
      setTrackedResult({
        ref: trackingIdInput.toUpperCase(),
        service: 'Real Property Tax Assessment',
        date: 'Sep 10, 2026',
        status: 'Under Review',
        step: 3,
        note: 'Submitted to City Assessor Office. Evaluation of tax declaration is underway.',
      });
    } else if (
      trackingIdInput.toUpperCase().includes('STALL') ||
      trackingIdInput.toUpperCase().includes('KAMUNING')
    ) {
      setTrackedResult({
        ref: trackingIdInput.toUpperCase(),
        service: 'City Market Stall Lease Application',
        date: 'Sep 04, 2026',
        status: 'Approved',
        step: 4,
        note: 'Stall Award Approved by Market Committee. Ready for contract signing.',
      });
    } else {
      setTrackedResult({
        ref: trackingIdInput.toUpperCase(),
        service: 'Business Tax Assessment / Clearance',
        date: 'Sep 12, 2026',
        status: 'Approved',
        step: 4,
        note: 'Assessment completed. Official e-OR released.',
      });
    }
  };

  return (
    <CitizenLayout activeTitle="Help & Service Guide" activeNav="guide">
      {/* ===================== HERO BANNER ===================== */}
      <section className="relative overflow-hidden bg-gradient-to-r from-[#122261] via-[#1a3885] to-[#122456] rounded-3xl p-6 sm:p-10 lg:p-12 text-white shadow-xl flex flex-col justify-center">
        {/* Subtle Watermark Seal on the Right */}
        <div className="absolute right-[-30px] bottom-[-40px] pointer-events-none opacity-15 select-none hidden sm:block">
          <img
            src={logoSystem}
            alt=""
            className="w-96 h-96 lg:w-[420px] lg:h-[420px] object-contain drop-shadow-2xl"
          />
        </div>

        {/* Top Badges & Actions */}
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 bg-blue-500/25 text-blue-200 text-[11px] font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full border border-blue-400/30 backdrop-blur-xs">
            <span>✨</span> GovServe Revenue &amp; Treasury Portal &bull; Help &amp; Service Guide
          </span>

          <button
            onClick={() => setIsTrackingModalOpen(true)}
            className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white text-xs font-bold px-4 py-2 rounded-xl border border-white/20 backdrop-blur-sm transition-all cursor-pointer shadow-sm active:scale-98"
          >
            <svg className="w-4 h-4 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Track My Applications
          </button>
        </div>

        {/* Main Heading & Subtitle */}
        <div className="relative z-10 mt-6 max-w-3xl space-y-3">
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            Welcome, {user.fullname}!
          </h2>

          <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed max-w-2xl font-normal">
            Learn about available local tax assessments (RPT), business tax clearances, market stall leasing, street vendor permits, regulatory payments, and document requirements before applying.
          </p>
        </div>

        {/* Live Search Input */}
        <div className="relative z-10 mt-8 max-w-2xl">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search services, requirements, or tax dues (e.g. Real Property, Market Stall, Business Tax, Cedula)..."
              className="w-full pl-11 pr-4 py-3.5 bg-white text-slate-900 rounded-2xl text-xs sm:text-sm font-medium placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-400/40 shadow-lg border-0"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                &times;
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="relative z-10 mt-6 flex flex-wrap gap-2">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-md border border-slate-700'
                    : 'bg-white/10 hover:bg-white/20 text-blue-100 border border-white/15'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </section>

      {/* ===================== ACTIVE & RECENT APPLICATIONS STATUS ===================== */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight">
              Your Active &amp; Recent Applications Status
            </h3>
          </div>

          <button
            onClick={() => navigate('/citizen-portal-stall-status')}
            className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer transition-colors"
          >
            View History &rarr;
          </button>
        </div>

        {/* 3 Status Cards in Horizontal Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Item 1: RPT */}
          <div
            onClick={() => navigate('/real-property-tax-hub')}
            className="p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/20 transition-all cursor-pointer flex items-center justify-between group"
          >
            <div>
              <p className="text-xs font-extrabold text-slate-900 group-hover:text-blue-900">
                Real Property Tax Assessment
              </p>
              <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                Ref: RPT-2026-981245
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Under Review
            </span>
          </div>

          {/* Item 2: Market Stall */}
          <div
            onClick={() => navigate('/citizen-portal-stall-manage-account')}
            className="p-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/20 transition-all cursor-pointer flex items-center justify-between group"
          >
            <div>
              <p className="text-xs font-extrabold text-slate-900 group-hover:text-emerald-900">
                City Market Stall &bull; KAMUNING
              </p>
              <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                Ref: STALL-KAMUNING-0412
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Approved
            </span>
          </div>

          {/* Item 3: Business Tax Clearance */}
          <div
            onClick={() => navigate('/business-tax-assessment')}
            className="p-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/20 transition-all cursor-pointer flex items-center justify-between group"
          >
            <div>
              <p className="text-xs font-extrabold text-slate-900 group-hover:text-emerald-900">
                Business Tax Clearance
              </p>
              <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                Ref: BTAX-2026-883109
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Approved
            </span>
          </div>
        </div>
      </section>

      {/* ===================== HOW THE PROCESS WORKS (4 STEPS) ===================== */}
      <section className="space-y-6 pt-4">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            How the Revenue &amp; Treasury Application Works
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Four simple steps from application filing to official treasury clearance and electronic receipt.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Step 01 */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <span className="text-xl font-extrabold text-slate-300 font-mono">01</span>
            </div>
            <div className="space-y-1.5">
              <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">
                Select Service &amp; Requirements
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Choose the service you need (Real Property Tax, Business Tax, Market Stall, Hawker) and prepare the required digital files (Title, DTI, Cedula).
              </p>
            </div>
          </div>

          {/* Step 02 */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <span className="text-xl font-extrabold text-slate-300 font-mono">02</span>
            </div>
            <div className="space-y-1.5">
              <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">
                Fill Online Form &amp; Upload
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Provide your taxpayer details, property or business address, and upload legible photos or scanned copies of supporting documents.
              </p>
            </div>
          </div>

          {/* Step 03 */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <span className="text-xl font-extrabold text-slate-300 font-mono">03</span>
            </div>
            <div className="space-y-1.5">
              <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">
                Assessor &amp; Treasury Review
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Assigned City Assessors and Treasury officers review your case, evaluate declarations, and compute the official assessment dues.
              </p>
            </div>
          </div>

          {/* Step 04 */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-xl font-extrabold text-slate-300 font-mono">04</span>
            </div>
            <div className="space-y-1.5">
              <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">
                Approval &amp; e-OR / Clearance
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Receive real-time clearance notification, downloadable Electronic Official Receipt (e-OR), and official certificate releasing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== PRIORITY TREASURY SERVICES (6 CARDS GRID - IMAGE 2 UI) ===================== */}
      <section className="bg-white rounded-3xl p-6 sm:p-8 lg:p-10 border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider bg-blue-50 px-3 py-1 rounded-md border border-blue-200">
              PRIORITY TREASURY SERVICES
            </span>
            <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-2">
              Tax &amp; Market Transaction Types &amp; Document Checklist
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Direct computation, clear guidelines, and expedited online processing for taxpayers and vendors.
            </p>
          </div>

          <button
            onClick={() => setIsCalculatorModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-xs font-bold px-5 py-3 rounded-xl shadow-md transition-all cursor-pointer shrink-0"
          >
            Open Quick Assessment &rarr;
          </button>
        </div>

        {/* 6 Cards in 3x2 Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
          {filteredPriorityServices.map((srv) => (
            <div
              key={srv.id}
              className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between space-y-5 hover:shadow-lg hover:border-blue-300 transition-all group"
            >
              <div className="space-y-4">
                {/* Header Icon + Tag */}
                <div className="flex items-center justify-between">
                  <div className={`w-12 h-12 rounded-2xl ${srv.iconBg} flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs`}>
                    {srv.icon}
                  </div>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50/80 px-2.5 py-1 rounded-md border border-blue-100">
                    {srv.tag}
                  </span>
                </div>

                {/* Title & Description */}
                <div>
                  <h4 className="font-extrabold text-base text-slate-900 group-hover:text-blue-900 transition-colors">
                    {srv.title}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    {srv.description}
                  </p>
                </div>

                {/* Key Requirements Checklist */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Key Requirements:
                  </p>
                  <ul className="space-y-1.5">
                    {srv.requirements.map((req, rIdx) => (
                      <li key={rIdx} className="text-[11px] text-slate-600 flex items-start gap-1.5">
                        <span className="text-blue-600 font-bold shrink-0">&bull;</span>
                        <span className="leading-tight">{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={() => navigate(srv.actionPath)}
                className="w-full py-2.5 px-4 rounded-xl bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-bold text-xs transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-1.5 mt-2"
              >
                {srv.actionLabel} &rarr;
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== EXPLORE ALL MODULES (7 MODULES - IMAGES 3 & 4 UI) ===================== */}
      <section className="space-y-6 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Explore All Revenue, Treasury &amp; Market Modules
          </h2>
          <span className="text-xs font-semibold text-slate-500">
            Showing {filteredModules.length} programs
          </span>
        </div>

        {/* 2-Column Grid of Large Module Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredModules.map((mod) => (
            <div
              key={mod.id}
              className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 flex flex-col justify-between space-y-6 hover:shadow-md hover:border-slate-300 transition-all"
            >
              <div className="space-y-4">
                {/* Icon + Title + Subtitle */}
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl ${mod.iconBg} flex items-center justify-center shrink-0`}>
                    {mod.icon}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900">
                      {mod.title}
                    </h3>
                    <p className="text-[11px] font-semibold text-blue-600 mt-0.5 uppercase tracking-wide">
                      {mod.subtitle}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-500 leading-relaxed">
                  {mod.description}
                </p>

                {/* 4 Feature Badges */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {mod.features.map((feat, fIdx) => (
                    <div
                      key={fIdx}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200/70 text-[11px] font-medium text-slate-700 flex items-center gap-1.5 truncate"
                    >
                      <svg className="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="truncate">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons (Primary & Secondary) */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => navigate(mod.primaryPath)}
                  className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-bold text-xs transition-colors cursor-pointer shadow-xs text-center"
                >
                  {mod.primaryLabel} &rarr;
                </button>
                <button
                  type="button"
                  onClick={mod.secondaryAction}
                  className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs transition-colors cursor-pointer text-center"
                >
                  {mod.secondaryLabel}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== GENERAL QUALIFICATIONS & DOCUMENT REQUIREMENTS (IMAGE 5 UI) ===================== */}
      <section className="bg-[#122261] text-white rounded-3xl p-6 sm:p-8 lg:p-10 shadow-xl space-y-6">
        <div>
          <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
            General Qualification &amp; Document Requirements
          </h3>
          <p className="text-xs sm:text-sm text-blue-200 mt-1">
            Before submitting any application, make sure your digital copies are clear, legible, and uncropped.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {/* Card 1 */}
          <div className="bg-white/10 border border-white/15 rounded-2xl p-5 backdrop-blur-xs space-y-2.5">
            <div className="flex items-center gap-2 text-blue-200">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h4 className="text-xs font-bold text-white uppercase tracking-wide">
                Proof of Identity &amp; Ownership
              </h4>
            </div>
            <p className="text-xs text-blue-100/85 leading-relaxed">
              Official QCID Card, PhilSys National ID, Voter's Certification, Transfer Certificate of Title (TCT), or Notarized Lease Contract with at least 6 months residency.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-white/10 border border-white/15 rounded-2xl p-5 backdrop-blur-xs space-y-2.5">
            <div className="flex items-center gap-2 text-blue-200">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <h4 className="text-xs font-bold text-white uppercase tracking-wide">
                Barangay &amp; Zoning Clearances
              </h4>
            </div>
            <p className="text-xs text-blue-100/85 leading-relaxed">
              Issued by your Barangay Captain or authorized barangay official stating business clearance, residency, and zoning compliance for commercial operations.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-white/10 border border-white/15 rounded-2xl p-5 backdrop-blur-xs space-y-2.5">
            <div className="flex items-center gap-2 text-blue-200">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h4 className="text-xs font-bold text-white uppercase tracking-wide">
                Financial &amp; Inspection Documents
              </h4>
            </div>
            <p className="text-xs text-blue-100/85 leading-relaxed">
              Latest Tax Declaration for RPT; Audited Financial Statements or BIR Form 1701 for Business Tax; DTI/SEC registrations for stalls; Sanitary Health Permits.
            </p>
          </div>
        </div>
      </section>

      {/* ===================== FREQUENTLY ASKED QUESTIONS (FAQS) & HELP (IMAGE 5 UI) ===================== */}
      <section className="bg-white rounded-3xl p-6 sm:p-8 lg:p-10 border border-slate-200 shadow-xs space-y-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
              Frequently Asked Questions (FAQs) &amp; Help
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Got questions about local taxes, market stall rentals, or assessments? Find quick answers below.
            </p>
          </div>
        </div>

        {/* Accordion List */}
        <div className="space-y-3 pt-2">
          {faqs.map((faq, idx) => {
            const isExpanded = expandedFaq === idx;
            return (
              <div
                key={idx}
                className="border border-slate-200 rounded-2xl overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setExpandedFaq(isExpanded ? null : idx)}
                  className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 bg-white hover:bg-slate-50/80 transition-colors cursor-pointer"
                >
                  <span className="text-xs sm:text-sm font-bold text-slate-800">
                    {faq.q}
                  </span>
                  <svg
                    className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                      isExpanded ? 'rotate-180 text-blue-600' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="px-5 pb-4 pt-1 text-xs text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/50">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ===================== MODAL: TRACK APPLICATION ===================== */}
      {isTrackingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="font-extrabold text-base text-slate-900">
                  Track Application Status
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsTrackingModalOpen(false);
                  setTrackedResult(null);
                }}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSearchTracking} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Application Reference ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={trackingIdInput}
                    onChange={(e) => setTrackingIdInput(e.target.value)}
                    placeholder="e.g. RPT-2026-981245 or STALL-KAMUNING-0412"
                    className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                    required
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Track
                  </button>
                </div>
              </div>

              {/* Sample Quick Tracking Suggestions */}
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="text-[10px] text-slate-400 font-semibold">Quick tests:</span>
                <button
                  type="button"
                  onClick={() => setTrackingIdInput('RPT-2026-981245')}
                  className="text-[10px] text-blue-600 font-mono hover:underline cursor-pointer"
                >
                  RPT-2026-981245
                </button>
                <button
                  type="button"
                  onClick={() => setTrackingIdInput('STALL-KAMUNING-0412')}
                  className="text-[10px] text-blue-600 font-mono hover:underline cursor-pointer"
                >
                  STALL-KAMUNING-0412
                </button>
              </div>

              {/* Track Result Display */}
              {trackedResult && (
                <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-3 mt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-blue-900">
                      {trackedResult.service}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      trackedResult.status === 'Approved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {trackedResult.status}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-slate-500">
                    Ref: {trackedResult.ref} &bull; Filed: {trackedResult.date}
                  </p>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {trackedResult.note}
                  </p>
                </div>
              )}
            </form>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsTrackingModalOpen(false);
                  navigate('/citizen-portal-stall-status');
                }}
                className="text-xs font-bold text-blue-700 hover:text-blue-900 cursor-pointer"
              >
                Go to Full Application History &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL: QUICK ASSESSMENT CALCULATOR ===================== */}
      {isCalculatorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="font-extrabold text-base text-slate-900">
                  Quick Assessment Calculator
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsCalculatorModalOpen(false);
                  setCalcResult(null);
                }}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="flex gap-2 border-b border-slate-100 pb-3">
              <button
                type="button"
                onClick={() => {
                  setCalcType('rpt');
                  setCalcResult(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  calcType === 'rpt' ? 'bg-[#1d4ed8] text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Real Property Tax
              </button>
              <button
                type="button"
                onClick={() => {
                  setCalcType('btax');
                  setCalcResult(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  calcType === 'btax' ? 'bg-[#1d4ed8] text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Business Tax
              </button>
              <button
                type="button"
                onClick={() => {
                  setCalcType('stall');
                  setCalcResult(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  calcType === 'stall' ? 'bg-[#1d4ed8] text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Stall Rental
              </button>
            </div>

            <div className="space-y-4">
              {calcType === 'rpt' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Property Fair Market Value (PHP)
                  </label>
                  <input
                    type="number"
                    value={calcInput.marketValue}
                    onChange={(e) => setCalcInput({ ...calcInput, marketValue: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-600"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Based on 20% assessment level &bull; Includes 20% prompt payment discount.
                  </p>
                </div>
              )}

              {calcType === 'btax' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Declared Annual Gross Sales (PHP)
                  </label>
                  <input
                    type="number"
                    value={calcInput.grossSales}
                    onChange={(e) => setCalcInput({ ...calcInput, grossSales: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-600"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Computed based on graduated local revenue code tax schedules.
                  </p>
                </div>
              )}

              {calcType === 'stall' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Stall Floor Area (Square Meters)
                  </label>
                  <input
                    type="number"
                    value={calcInput.stallSqm}
                    onChange={(e) => setCalcInput({ ...calcInput, stallSqm: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-600"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Standard rate of ₱35/sqm/day for public wet/dry markets.
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={handleCalculate}
                className="w-full py-2.5 bg-[#1d4ed8] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Calculate Estimated Tax Due
              </button>

              {calcResult !== null && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-1">
                  <p className="text-xs font-semibold text-emerald-800">
                    Estimated Amount Due:
                  </p>
                  <p className="text-2xl font-black text-emerald-900 font-mono">
                    ₱{calcResult.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-emerald-700">
                    Subject to official verification by City Assessor &amp; Treasury.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </CitizenLayout>
  );
}