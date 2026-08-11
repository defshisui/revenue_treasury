import type { Dispatch, SetStateAction } from "react";
import type { Subsystem } from "../types/treasury";
import { useTheme } from "./ThemeContext";

interface TreasurySidebarProps {
  activeTab: Subsystem;
  isCollapsed: boolean;
  setIsCollapsed: Dispatch<SetStateAction<boolean>>;
  setActiveTab: Dispatch<SetStateAction<Subsystem>>;
  canCreate: (module: string) => boolean;
  canApprove: () => boolean;
  canDelete: () => boolean;
}

const navigationItems: Array<{ id: Subsystem; label: string; icon: string }> = [
  { id: "dashboard", label: "Treasury Dashboard", icon: "▦" },
  { id: "rpt", label: "Real Property Tax Management", icon: "▥" },
  { id: "business", label: "Business Tax & Permit Management", icon: "▣" },
  { id: "market", label: "Market Stall Management", icon: "▤" },
  { id: "payments", label: "Payment Collection System", icon: "▰" },
  { id: "users", label: "User & Access Control", icon: "♙" },
  { id: "audit", label: "Audit Trail Management", icon: "▤" },
  { id: "reports", label: "Financial Reports", icon: "◔" },
];

export default function TreasurySidebar({
  activeTab,
  isCollapsed,
  setIsCollapsed,
  setActiveTab,
  /*canCreate,
  canApprove,
  canDelete,*/
}: TreasurySidebarProps) {
  return (
    
    
    <aside 
      className={`h-screen fixed top-0 left-0 shrink-0 bg-[#0b132b]! bg-opacity-100! border-r border-[#1c2541] flex flex-col p-4 z-50 transition-[width] duration-300 shadow-xl ${
        isCollapsed ? "w-20" : "w-64"
      }`} 
      style={{ backgroundColor: "#0b132b" }}
    >
      <div className="flex items-center gap-3 px-1 py-1">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm">
          <img src="src/assets/logo-system.png" alt="Hero Icon" className="w-10 h-10 object-contain" />
        </div>
        {!isCollapsed && (
          <div className="min-w-0">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-white-400 truncate">Treasury & Revenue</h2>
            <p className="text-sm font-bold text-white tracking-tight truncate">Management System</p>
          </div>
        )}
      </div>

      <div className="mt-6">
        <button
          onClick={() => setIsCollapsed(current => !current)}
          className="w-full flex items-center gap-3 p-2 rounded-lg bg-[#1c2541] border border-[#2d3748] text-slate-300 hover:bg-[#3a506b] transition-colors"
          title="Toggle Sidebar"
          aria-label="Toggle Sidebar"
        >
          <span className="w-5 shrink-0 text-center flex justify-center text-slate-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </span>
          {!isCollapsed && <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 truncate">Menu</span>}
        </button>
      </div>

      <nav className="flex-1 min-h-0 space-y-1 mt-6 overflow-y-auto">
        {!isCollapsed && <p className="text-xs font-semibold uppercase text-slate-400 tracking-wider px-3 mb-2">MODULES</p>}

        {navigationItems.map((item, index) => (
          <div key={item.id}>
            {index === 5 && !isCollapsed && (
              <p className="text-xs font-semibold uppercase text-slate-400 tracking-wider px-3 mt-6 mb-2">
                Governance
              </p>
            )}
            <button
              onClick={() => setActiveTab(item.id)}
              title={item.label}
              className={`w-full min-w-0 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === item.id
                  ? "bg-[#1d4ed8] text-white shadow-sm font-bold"
                  : "hover:bg-[#1c2541] text-gray-400 hover:text-white"
              }`}
            >
              <span className="w-5 shrink-0 text-center text-base" aria-hidden="true">{item.icon}</span>
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </button>
          </div>
        ))}
      </nav>
    </aside>
  );
}