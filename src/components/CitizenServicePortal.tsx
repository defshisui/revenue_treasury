import React, { useState } from 'react';
import './layouts/CitizenServicePortal.css';



// Types
interface ServiceDetail {
  targetUsers: string;
  serviceMethod: string;
  timePeriod: string;
  charges: string;
  paymentMethod: string;
}

interface ServiceCard {
  id: string;
  title: string;
  description: string;
  category: string;
  details: ServiceDetail;
  iconType: 'id-badge' | 'id-search' | 'building' | 'store' | 'health' | 'market';
}

// Mock Data matching the screenshots
const SERVICES_DATA: ServiceCard[] = [
  {
    id: 'qcitizen-id-eapplication',
    title: 'QCitizen ID eApplication',
    description: 'Citizen ID Application for all the residents of Quezon City.',
    category: 'QCitizen ID',
    iconType: 'id-badge',
    details: {
      targetUsers: 'Individuals who wish to acquire a QCitizen ID.',
      serviceMethod: 'Online',
      timePeriod: '1-3 days',
      charges: 'None.',
      paymentMethod: 'Not Relevant.',
    },
  },
  {
    id: 'qcid-query-portal',
    title: 'QCID Query Portal',
    description: 'QCID Application Query Portal.',
    category: 'QCitizen ID',
    iconType: 'id-search',
    details: {
      targetUsers: 'Registered QCitizen ID applicants.',
      serviceMethod: 'Online',
      timePeriod: 'Real-time',
      charges: 'None.',
      paymentMethod: 'Not Relevant.',
    },
  },
  {
    id: 'building-permit',
    title: 'Building Permit Application',
    description: 'Online application for residential and commercial building permits.',
    category: 'Clearances, Permits, and Licensing',
    iconType: 'building',
    details: {
      targetUsers: 'Property owners, contractors, and developers.',
      serviceMethod: 'Online / Hybrid',
      timePeriod: '5-7 working days',
      charges: 'Varies based on project scope.',
      paymentMethod: 'Online Banking / Over the Counter.',
    },
  },
  {
    id: 'business-permit',
    title: 'Business Permit & Licensing',
    description: 'Apply or renew business permits within the city jurisdiction.',
    category: 'Clearances, Permits, and Licensing',
    iconType: 'store',
    details: {
      targetUsers: 'Business owners and corporate representatives.',
      serviceMethod: 'Online',
      timePeriod: '2-4 working days',
      charges: 'Based on declared gross sales.',
      paymentMethod: 'E-Wallet, Credit Card, Bank Transfer.',
    },
  },
  {
    id: 'real-property-tax',
    title: 'Real Property Tax',
    description: 'Apply for real property tax assessments and payments.',
    category: 'Finance and Taxation',
    iconType: 'building',
    details: {
      targetUsers: 'Property owners.',
      serviceMethod: 'Online',
      timePeriod: '1-3 days',
      charges: 'Applicable fees.',
      paymentMethod: 'E-Wallet, Credit Card, Bank Transfer.',
    },
  },
  {
    id: 'business-tax',
    title: 'Pay Business Tax',
    description: 'Allows businesses to conveniently settle payments without the need to visit the City Treasurer Office in person.',
    category: 'Finance and Taxation',
    iconType: 'building',
    details: {
      targetUsers: 'Business owners in Municipality.',
      serviceMethod: 'Online payment processing through the CTO Business Tax Portal.',
      timePeriod: '3 days',
      charges: 'As stated in the online billing statement, inclusive of convenience fee (if any).',
      paymentMethod: 'E-Wallet, Credit Card, Bank Transfer.',
    },
  },
  {
    id: 'market-stall',
    title: 'Market Stall',
    description: 'Not sure what will write here.',
    category: 'Finance and Taxation',
    iconType: 'building',
    details: {
      targetUsers: 'Market vendors and business owners.',
      serviceMethod: 'Online.',
      timePeriod: '2-5 days',
      charges: 'Applicable fees.',
      paymentMethod: 'Online and Onsite.',
    },
  },
];

const CATEGORIES = ['ALL', 'QCitizen ID', 'Clearances, Permits, and Licensing', 'Finance and Taxation'];

export const CitizenServicePortal: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [activeModalService, setActiveModalService] = useState<ServiceCard | null>(null);
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  // Navigation action when clicking card directly or "Go to Portal" inside Modal
  const handleGoToModule = (serviceId: string, title: string) => {
    setActiveModalService(null);
    setActiveModule(title);
  };

  const toggleCategory = (category: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  // Filter services
  const filteredServices = SERVICES_DATA.filter((service) => {
    const matchesSearch =
      service.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === 'ALL' || service.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Group services by category
  const groupedServices = filteredServices.reduce((acc, service) => {
    if (!acc[service.category]) acc[service.category] = [];
    acc[service.category].push(service);
    return acc;
  }, {} as Record<string, ServiceCard[]>);

  // Active Module View simulation
  if (activeModule) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 font-sans text-slate-800">
        <button
          onClick={() => setActiveModule(null)}
          className="text-blue-600 hover:underline flex items-center gap-2 mb-6 font-medium"
        >
          ‹ Back to Services
        </button>
        <div className="bg-white rounded-xl shadow-md p-8 border border-gray-100 max-w-4xl mx-auto">
          <div className="inline-block px-3 py-1 bg-sky-100 text-sky-800 rounded-full text-xs font-semibold mb-3">
            Module Screen
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-4">{activeModule}</h1>
          <p className="text-gray-600 mb-6">
            Welcome to the direct portal for <strong>{activeModule}</strong>. Proceed with your application process below.
          </p>
          <div className="p-12 border-2 border-dashed border-gray-200 rounded-lg text-center text-gray-400">
            [ Module Application Form / Workflow Content ]
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans text-slate-800">
      {/* Navbar Header */}
      <header className="border-b border-gray-100 px-6 py-3 flex items-center justify-between">
        {/* Left Logo Section */}
        <div className="flex items-center gap-3">
          {/* Logo Placeholder */}
          <div className="w-10 h-10 bg-slate-200 rounded flex items-center justify-center text-xs text-slate-500 font-bold border border-slate-300">
            <img src="src/assets/logo-system.png" alt="Hero Icon" className="w-10 h-10 object-contain" />
          </div>
          {/* Brand Name */}
          <span className="text-2xl font-extrabold tracking-tight text-blue-950">
            GovServe
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="flex items-center gap-8 text-sm font-semibold text-blue-950">
          <a href="#home" className="hover:text-sky-600 transition-colors">
            HOME
          </a>
          <div className="flex items-center gap-1 cursor-pointer hover:text-sky-600 transition-colors">
            <span>SERVICES</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          <a href="#charter" className="hover:text-sky-600 transition-colors">
            CITIZEN'S CHARTER
          </a>
          <a href="#contact" className="hover:text-sky-600 transition-colors">
            CONTACT US
          </a>

          {/* User Profile Dropdown */}
          <div className="flex items-center gap-2 cursor-pointer hover:text-sky-600 border-l border-gray-200 pl-6">
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium">Hi, Citizen!</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {/* Search Button Icon */}
          <button className="border border-sky-400 text-sky-500 p-2 rounded-lg hover:bg-sky-50 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-8 py-6">
        {/* Back Link */}
        <a
          href="#back"
          className="text-sky-600 font-semibold text-sm hover:underline inline-flex items-center gap-1 mb-4"
        >
          ‹ Back to Home
        </a>

        {/* Title */}
        <h1 className="text-4xl font-extrabold text-blue-950 mb-6 tracking-tight">
          List of Services
        </h1>

        {/* Search Input Box */}
        <div className="relative mb-6">
          <input
            type="text"
            placeholder="Search for a service..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-4 pr-10 py-3 rounded-md border border-gray-200 text-slate-700 text-base placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent shadow-sm"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Filter Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-blue-950 font-medium text-sm mb-2">
            <span>Filter By</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          <div className="max-w-xs">
            <label className="block text-xs font-semibold text-blue-950 mb-1">
              Category Service
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full p-2.5 bg-white border border-gray-200 rounded-md text-slate-700 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Categories Accordions & Service Cards */}
        <div className="space-y-6">
          {Object.keys(groupedServices).length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              No services found matching your criteria.
            </div>
          ) : (
            Object.entries(groupedServices).map(([category, items]) => {
              const isCollapsed = collapsedCategories[category];
              return (
                <div key={category} className="space-y-4">
                  {/* Category Header Bar */}
                  <div
                    onClick={() => toggleCategory(category)}
                    className="w-full bg-[#e8f3f8] hover:bg-[#deedf4] px-5 py-3.5 rounded-xl flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <h2 className="text-lg font-bold text-[#0e4860]">
                      {category}
                    </h2>
                    <svg
                      className={`w-5 h-5 text-[#0e4860] transition-transform duration-200 ${
                        isCollapsed ? 'transform rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {/* Cards Grid */}
                  {!isCollapsed && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 pt-1">
                      {items.map((service) => (
                        <div
                          key={service.id}
                          onClick={() => handleGoToModule(service.id, service.title)}
                          className="card-hover-effect bg-white border border-sky-100 rounded-2xl p-6 flex flex-col items-center text-center cursor-pointer shadow-sm relative group"
                        >
                          {/* Icon Container */}
                          <div className="w-20 h-20 bg-[#dbeafe] text-sky-800 rounded-2xl flex items-center justify-center mb-5">
                            {renderIcon(service.iconType)}
                          </div>

                          {/* Card Title */}
                          <h3 className="text-lg font-bold text-[#0e4860] mb-2 leading-snug">
                            {service.title}
                          </h3>

                          {/* Card Description */}
                          <p className="text-slate-500 text-xs leading-relaxed mb-6 grow">
                            {service.description}
                          </p>

                          {/* View Details Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // Prevents triggers on parent card click
                              setActiveModalService(service);
                            }}
                            className="bg-[#0f4f66] hover:bg-[#0a394a] text-white text-xs font-semibold px-5 py-2.5 rounded-md transition-colors"
                          >
                            View Details
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Details Modal */}
      {activeModalService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-8 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Close Button */}
            <button
              onClick={() => setActiveModalService(null)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Modal Title */}
            <h2 className="text-2xl font-bold text-blue-950 mb-6 pr-8">
              {activeModalService.title}
            </h2>

            {/* Modal Info Rows */}
            <div className="space-y-5 mb-8">
              {/* Target Users */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-700">Target Users</h4>
                  <p className="text-sm text-slate-500">{activeModalService.details.targetUsers}</p>
                </div>
              </div>

              {/* Service Method */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4m-4 0V11m0 0h4" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-700">Service Method</h4>
                  <p className="text-sm text-slate-500">{activeModalService.details.serviceMethod}</p>
                </div>
              </div>

              {/* Time Period */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-700">Time Period</h4>
                  <p className="text-sm text-slate-500">{activeModalService.details.timePeriod}</p>
                </div>
              </div>

              {/* Charges & Payment */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-700">Charges & Payment</h4>
                  <p className="text-sm text-slate-500">{activeModalService.details.charges}</p>
                </div>
              </div>

              {/* Payment Method */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-700">Payment Method</h4>
                  <p className="text-sm text-slate-500">{activeModalService.details.paymentMethod}</p>
                </div>
              </div>
            </div>

            {/* Direct Action Button */}
            <button
              onClick={() =>
                handleGoToModule(activeModalService.id, activeModalService.title)
              }
              className="w-full bg-[#0f4f66] hover:bg-[#0a394a] text-white font-bold py-3.5 rounded-lg transition-colors text-base"
            >
              Go to {activeModalService.title}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// SVG Icon Helper
function renderIcon(type: ServiceCard['iconType']) {
  switch (type) {
    case 'id-badge':
      return (
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V8a2 2 0 00-2-2h-4m-4 0V4a2 2 0 114 0v2m-4 0h4m-4 7a2 2 0 100-4 2 2 0 000 4zm-4 3h8" />
        </svg>
      );
    case 'id-search':
      return (
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
        </svg>
      );
    case 'building':
      return (
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4m-4 0V11m0 0h4" />
        </svg>
      );
    case 'store':
      return (
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      );
    default:
      return (
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
  }
}

export default CitizenServicePortal;