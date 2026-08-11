import { BrowserRouter, Routes, Route } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import RealPropertyTax from "./pages/RealPropertyTax";
import BusinessTax from "./pages/BusinessTax";
import RegulatoryFees from "./pages/RegulatoryFees";
import MarketRental from "./pages/MarketRental";
import Profile from "./pages/Profile";
import LegacyTreasuryApp from "./LegacyTreasuryApp";
/* import CitizenServicePortal from "./components/CitizenServicePortal"; */

import { ThemeProvider } from "./components/ThemeContext";



export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/real-property-tax" element={<RealPropertyTax />} />
          <Route path="/business-tax" element={<BusinessTax />} />
          <Route path="/regulatory-fees" element={<RegulatoryFees />} />
          <Route path="/market-rental" element={<MarketRental />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/legacy-treasury" element={<LegacyTreasuryApp />} />
         {/* <Route path="/citizen-services" element={<CitizenServicePortal />} /> */}
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
