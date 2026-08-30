import { BrowserRouter, Routes, Route } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import RealPropertyTax from "./pages/RealPropertyTax";
import BusinessTax from "./pages/BusinessTax";
import RegulatoryFees from "./pages/RegulatoryFees";
import MarketRental from "./pages/MarketRental";
import Profile from "./pages/Profile";
import LegacyTreasuryApp from "./LegacyTreasuryApp";

import CitizenPortal from "./citizen-portal/market-stall";
import StallApplication from "./citizen-portal/city-owned-stall";
import CityStallStatus from "./citizen-portal/city-owned-status";
import CityStallManageAccount from "./citizen-portal/city-owned-manage-account";
import PrivateManageAccount from "./citizen-portal/private-manage-account";
import HawkerApplication from "./citizen-portal/hawker-application";

/*
 * Import both components from the SAME file:
 *
 * RealPropertyApplication = actual RPT system
 * RealPropertyTaxHub      = RPT landing page
 */
import RealPropertyApplication, {
  RealPropertyTaxHub,
} from "./citizen-portal/real-property-tax";

import BusinessTaxAssessmentView from "./citizen-portal/Business-Tax-Assessment-View";
import MarketVendor from "./citizen-portal/Market-Vendor";

import { ThemeProvider } from "./components/ThemeContext";

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>

          {/* =========================
              MAIN PAGES
          ========================= */}

          <Route
            path="/"
            element={<Dashboard />}
          />

          <Route
            path="/real-property-tax"
            element={<RealPropertyTax />}
          />

          <Route
            path="/business-tax"
            element={<BusinessTax />}
          />

          <Route
            path="/regulatory-fees"
            element={<RegulatoryFees />}
          />

          <Route
            path="/market-rental"
            element={<MarketRental />}
          />

          <Route
            path="/profile"
            element={<Profile />}
          />

          <Route
            path="/legacy-treasury"
            element={<LegacyTreasuryApp />}
          />


          {/* =========================
              CITIZEN PORTAL
          ========================= */}

          <Route
            path="/citizen-portal"
            element={<CitizenPortal />}
          />

          <Route
            path="/citizen-portal-stall"
            element={<StallApplication />}
          />

          <Route
            path="/citizen-portal-stall-status"
            element={<CityStallStatus />}
          />

          <Route
            path="/citizen-portal-stall-manage-account"
            element={<CityStallManageAccount />}
          />

          <Route
            path="/private-manage-account"
            element={<PrivateManageAccount />}
          />

          <Route
            path="/hawker-application"
            element={<HawkerApplication />}
          />


          {/* =========================
              REAL PROPERTY TAX HUB
          =========================
          
          This is the landing page that should
          look like Market & Vendors / Business Tax.
          */}

          <Route
            path="/real-property-tax-hub"
            element={<RealPropertyTaxHub />}
          />


          {/* =========================
              ACTUAL RPT SYSTEM
          =========================
          
          This is the original RPT search,
          payment, assessor services, QRPh,
          receipts, etc.
          */}

          <Route
            path="/citizen-rpt/*"
            element={<RealPropertyApplication />}
          />

          <Route
            path="/real-property-application"
            element={<RealPropertyApplication />}
          />


          {/* =========================
              BUSINESS TAX
          ========================= */}

          <Route
            path="/business-tax-assessment"
            element={<BusinessTaxAssessmentView />}
          />


          {/* =========================
              MARKET VENDORS
          ========================= */}

          <Route
            path="/market-vendor-tab"
            element={<MarketVendor />}
          />

        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}