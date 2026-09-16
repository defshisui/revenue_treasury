
import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Subsystem } from "../types/treasury";
import { usePermissions } from "../hooks/usePermissions";

import logo from "../assets/logo-system.png";

interface TreasurySidebarProps {
  activeTab: Subsystem;
  isCollapsed: boolean;
  setIsCollapsed: Dispatch<SetStateAction<boolean>>;
  setActiveTab: Dispatch<SetStateAction<Subsystem>>;

  canCreate?: (module: string) => boolean;
  canApprove?: () => boolean;
  canDelete?: () => boolean;
}

interface NavItem {
  id: Subsystem;
  label: string;
  hasDropdown?: boolean;
  isGovernance?: boolean;
}

const renderNavIcon = (id: Subsystem) => {
  switch (id) {
    case "dashboard":
      return (
        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="7" height="9" x="3" y="3" rx="1"/>
          <rect width="7" height="5" x="14" y="3" rx="1"/>
          <rect width="7" height="9" x="14" y="12" rx="1"/>
          <rect width="7" height="5" x="3" y="16" rx="1"/>
        </svg>
      );
    case "rpt":
      return (
        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      );
    case "business":
      return (
        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="14" x="2" y="7" rx="2" ry="2"/>
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
        </svg>
      );
    case "market":
      return (
        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3h18v4H3z"/>
          <path d="M3 7v13a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V7"/>
          <path d="M8 12h8"/>
        </svg>
      );
    case "users":
      return (
        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      );
    case "audit":
      return (
        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
      );
    case "fraud":
      return (
        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      );
    case "reports":
      return (
        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"/>
          <line x1="12" y1="20" x2="12" y2="4"/>
          <line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
      );
    default:
      return null;
  }
};

const navigationItems: NavItem[] = [
  { id: "dashboard", label: "Treasury Dashboard" },
  { id: "rpt", label: "Real Property Tax Management" },
  { id: "business", label: "Business Tax & Regulatory Fee Payment" },
  { id: "market", label: "Market Stall Management", hasDropdown: true },
  { id: "users", label: "User & Access Control", isGovernance: true },
  { id: "audit", label: "Audit Trail Management", isGovernance: true },
  { id: "fraud", label: "Fraud Monitoring", isGovernance: true },
  { id: "reports", label: "Financial Reports", isGovernance: true },
];

export default function TreasurySidebar({
  activeTab,
  isCollapsed,
  setIsCollapsed,
  setActiveTab,
}: TreasurySidebarProps) {
  const [isMarketOpen, setIsMarketOpen] = useState(true);

  const userRole = localStorage.getItem("user_role") || "treasury-staff";

  const { canManageUsers, canViewAudit } = usePermissions(userRole);

  const visibleItems = navigationItems.filter(item => {
    if (item.id === "users") return canManageUsers();
    if (item.id === "audit") return canViewAudit();
    return true;
  });

  const isMarketActive = ["market", "market-city", "hawker"].includes(activeTab);

  const handleTabClick = (item: NavItem) => {
    setActiveTab(item.id);
    if (item.id === "market") {
      if (isCollapsed) setIsCollapsed(false);
      // If already viewing market, allow toggling; if coming from another module, keep it open
      if (isMarketActive) {
        setIsMarketOpen((prev) => !prev);
      } else {
        setIsMarketOpen(true);
      }
    } else {
      // Hide market dropdown when user is looking at any other module
      setIsMarketOpen(false);
    }
  };

  return (
    <aside
      className={`h-screen fixed top-0 left-0 shrink-0 bg-[#0b132b] border-r border-[#1c2541] flex flex-col p-4 z-50 transition-[width] duration-300 shadow-xl ${isCollapsed ? "w-20" : "w-64"
        }`}
      style={{ backgroundColor: "#0b132b" }}
    >

      <div className="flex items-center gap-3 px-1 py-1">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm">

          <img src={logo} alt="System Logo" className="w-10 h-10 object-contain" />
        </div>
        {!isCollapsed && (
          <div className="min-w-0">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-white truncate">
              Treasury & Revenue
            </h2>
            <p className="text-sm font-bold text-white tracking-tight truncate">GovServe</p>
          </div>
        )}
      </div>


      <div className="mt-6">
        <button
          onClick={() => setIsCollapsed((current) => !current)}
          className="w-full flex items-center gap-3 p-2 rounded-lg bg-[#1c2541] border border-[#2d3748] text-slate-300 hover:bg-[#3a506b] transition-colors cursor-pointer"
          title="Toggle Sidebar"
          aria-label="Toggle Sidebar"
        >
          <span className="w-5 shrink-0 text-center flex justify-center text-slate-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </span>
          {!isCollapsed && (
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 truncate">
              Menu
            </span>
          )}
        </button>
      </div>


      <nav className="flex-1 min-h-0 space-y-1 mt-6 overflow-y-auto [scrollbar-thin] [scrollbar-color:--theme(--colors-gray-700/40%)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-700/40 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-700/70 transition-colors">
        {!isCollapsed && (
          <p className="text-xs font-semibold uppercase text-slate-400 tracking-wider px-3 mb-2">MODULES</p>
        )}

        {visibleItems.map((item, index) => {
          const isMarketGroup = item.id === "market";

          const firstGovernanceIndex = visibleItems.findIndex(i => i.isGovernance);

          return (
            <div key={item.id}>
              {index === firstGovernanceIndex && !isCollapsed && (
                <p className="text-xs font-semibold uppercase text-slate-400 tracking-wider px-3 mt-6 mb-2">
                  Governance
                </p>
              )}


              <button
                onClick={() => handleTabClick(item)}
                title={item.label}
                className={`w-full min-w-0 flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer ${activeTab === item.id || (isMarketGroup && ["market-city", "hawker"].includes(activeTab))
                  ? "bg-[#1d4ed8] text-white shadow-sm font-bold"
                  : "hover:bg-[#1c2541] text-gray-300 hover:text-white"
                  }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-5 shrink-0 flex items-center justify-center" aria-hidden="true">
                    {renderNavIcon(item.id)}
                  </span>
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </div>

                {isMarketGroup && !isCollapsed && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMarketOpen((prev) => !prev);
                    }}
                    className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
                  >
                    <svg
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${isMarketOpen ? "rotate-180" : "rotate-0"
                        }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                )}
              </button>


              {isMarketGroup && isMarketOpen && !isCollapsed && (
                <div className="mt-1 ml-4 pl-3 border-l-2 border-[#1c2541] space-y-1">
                  <button
                    onClick={() => {
                      setActiveTab("market-city");
                      setIsMarketOpen(true);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between cursor-pointer ${activeTab === "market-city"
                      ? "bg-[#1d4ed8] text-white font-bold"
                      : "text-slate-400 hover:text-white hover:bg-[#1c2541]"
                      }`}
                  >
                    <span className="truncate">City-Owned Market</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab("hawker");
                      setIsMarketOpen(true);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between cursor-pointer ${activeTab === "hawker"
                      ? "bg-[#1d4ed8] text-white font-bold"
                      : "text-slate-400 hover:text-white hover:bg-[#1c2541]"
                      }`}
                  >
                    <span className="truncate">Hawker Association</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}