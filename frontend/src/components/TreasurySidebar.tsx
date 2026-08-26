// src/components/TreasurySidebar.tsx
import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Subsystem } from "../types/treasury";

// Import the logo directly from the assets folder
import logo from "../assets/logo-system.png";

interface TreasurySidebarProps {
  activeTab: Subsystem;
  isCollapsed: boolean;
  setIsCollapsed: Dispatch<SetStateAction<boolean>>;
  setActiveTab: Dispatch<SetStateAction<Subsystem>>;
  canCreate: (module: string) => boolean;
  canApprove: () => boolean;
  canDelete: () => boolean;
}

interface NavItem {
  id: Subsystem;
  label: string;
  icon: string;
  hasDropdown?: boolean;
}

const navigationItems: NavItem[] = [
  { id: "dashboard", label: "Treasury Dashboard", icon: "▦" },
  { id: "rpt", label: "Real Property Tax Management", icon: "▥" },
  { id: "business", label: "Business Tax & Permit Management", icon: "▣" },
  {
    id: "market",
    label: "Market Stall Management",
    icon: "▤",
    hasDropdown: true,
  },
  { id: "users", label: "User & Access Control", icon: "♙" },
  { id: "audit", label: "Audit Trail Management", icon: "▤" },
  { id: "reports", label: "Financial Reports", icon: "◔" },
];

export default function TreasurySidebar({
  activeTab,
  isCollapsed,
  setIsCollapsed,
  setActiveTab,
}: TreasurySidebarProps) {
  const [isMarketOpen, setIsMarketOpen] = useState(true);

  const handleTabClick = (item: NavItem) => {
    setActiveTab(item.id);
    if (item.hasDropdown) {
      if (isCollapsed) setIsCollapsed(false);
      setIsMarketOpen((prev) => !prev);
    }
  };

  return (
    <aside
      className={`h-screen fixed top-0 left-0 shrink-0 bg-[#0b132b] border-r border-[#1c2541] flex flex-col p-4 z-50 transition-[width] duration-300 shadow-xl ${isCollapsed ? "w-20" : "w-64"
        }`}
      style={{ backgroundColor: "#0b132b" }}
    >
      {/* Header Logo */}
      <div className="flex items-center gap-3 px-1 py-1">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm">
          {/* Use the imported logo variable here */}
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

      {/* Collapse Menu Toggle Button */}
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

      {/* Navigation List */}
      <nav className="flex-1 min-h-0 space-y-1 mt-6 overflow-y-auto [scrollbar-thin] [scrollbar-color:--theme(--colors-gray-700/40%)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-700/40 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-700/70 transition-colors">
        {!isCollapsed && (
          <p className="text-xs font-semibold uppercase text-slate-400 tracking-wider px-3 mb-2">MODULES</p>
        )}

        {navigationItems.map((item, index) => {
          const isMarketGroup = item.id === "market";

          return (
            <div key={item.id}>
              {index === 4 && !isCollapsed && (
                <p className="text-xs font-semibold uppercase text-slate-400 tracking-wider px-3 mt-6 mb-2">
                  Governance
                </p>
              )}

              {/* Main Nav Button */}
              <button
                onClick={() => handleTabClick(item)}
                title={item.label}
                className={`w-full min-w-0 flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer ${activeTab === item.id || (isMarketGroup && ["market-city", "hawker"].includes(activeTab))
                    ? "bg-[#1d4ed8] text-white shadow-sm font-bold"
                    : "hover:bg-[#1c2541] text-gray-300 hover:text-white"
                  }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-5 shrink-0 text-center text-base" aria-hidden="true">
                    {item.icon}
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

              {/* Dropdown Options for Market Stall Management */}
              {isMarketGroup && isMarketOpen && !isCollapsed && (
                <div className="mt-1 ml-4 pl-3 border-l-2 border-[#1c2541] space-y-1">
                  <button
                    onClick={() => setActiveTab("market-city")}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between cursor-pointer ${activeTab === "market-city"
                        ? "bg-[#1d4ed8] text-white font-bold"
                        : "text-slate-400 hover:text-white hover:bg-[#1c2541]"
                      }`}
                  >
                    <span className="truncate">City-Owned Market</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("hawker")}
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