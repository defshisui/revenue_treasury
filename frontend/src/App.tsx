import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./components/ThemeContext";

const LandingPage = lazy(() => import("./pages/LandingPage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const RealPropertyTax = lazy(() => import("./pages/RealPropertyTax"));
const BusinessTax = lazy(() => import("./pages/BusinessTax"));
const RegulatoryFees = lazy(() => import("./pages/RegulatoryFees"));
const MarketRental = lazy(() => import("./pages/MarketRental"));
const Profile = lazy(() => import("./pages/Profile"));
const CitizenProfile = lazy(() => import("./citizen-portal/CitizenProfile"));
const LegacyTreasuryApp = lazy(() => import("./LegacyTreasuryApp"));

const CitizenPortal = lazy(() => import("./citizen-portal/market-stall"));
const StallApplication = lazy(() => import("./citizen-portal/city-owned-stall"));
const CityStallStatus = lazy(() => import("./citizen-portal/city-owned-status"));
const CityStallManageAccount = lazy(() => import("./citizen-portal/city-owned-manage-account"));
const PrivateManageAccount = lazy(() => import("./citizen-portal/private-manage-account"));
const HawkerApplication = lazy(() => import("./citizen-portal/hawker-application"));

const RealPropertyApplication = lazy(() => import("./citizen-portal/real-property-tax"));

const BusinessTaxAssessmentView = lazy(() => import("./citizen-portal/Business-Tax-Assessment-View"));
const ApplicationHistory = lazy(() => import("./citizen-portal/ApplicationHistory"));

function PageLoader() {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Loading module...</span>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/real-property-tax" element={<RealPropertyTax />} />
            <Route path="/business-tax" element={<BusinessTax />} />
            <Route path="/regulatory-fees" element={<RegulatoryFees />} />
            <Route path="/market-rental" element={<MarketRental />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/edit-profile" element={<CitizenProfile />} />
            <Route path="/legacy-treasury" element={<LegacyTreasuryApp />} />
            <Route path="/citizen-portal" element={<CitizenPortal />} />
            <Route path="/citizen-portal-stall" element={<StallApplication />} />
            <Route path="/citizen-portal-stall-status" element={<CityStallStatus />} />
            <Route path="/citizen-portal-stall-manage-account" element={<CityStallManageAccount />} />
            <Route path="/private-manage-account" element={<PrivateManageAccount />} />
            <Route path="/hawker-application" element={<HawkerApplication />} />
            <Route path="/real-property-tax-hub" element={<Navigate to="/citizen-rpt" replace />} />
            <Route path="/citizen-rpt/*" element={<RealPropertyApplication />} />
            <Route path="/real-property-application" element={<RealPropertyApplication />} />
            <Route path="/business-tax-assessment" element={<BusinessTaxAssessmentView />} />
            <Route path="/application-history" element={<ApplicationHistory />} />
            <Route path="/market-vendor-tab" element={<Navigate to="/citizen-portal-stall" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}