import { useState, type Dispatch, type SetStateAction } from "react";
import { useNavigate } from "react-router-dom";

import type { Role } from "../types/treasury";

import SettingModal from "./SettingModal";
import { useTheme } from "./ThemeContext";


interface TreasuryHeaderProps {
  activeRole: Role;
  setActiveRole: Dispatch<SetStateAction<Role>>;
  notify: (message: string) => void;
  onToggleSidebar?: () => void;
  isCollapsed: boolean;
}


export default function TreasuryHeader({
  activeRole,
  //setActiveRole,
  notify,
  //onToggleSidebar,
  isCollapsed,
}: TreasuryHeaderProps) {

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const navigate = useNavigate();

  const { theme, toggleTheme } = useTheme();


  return (
    <header
      className={`
        fixed top-0 right-0 z-40
        h-14
        px-4
        flex items-center justify-between
        bg-white dark:bg-slate-900
        border-b border-slate-200 dark:border-slate-700
        transition-all duration-300
        ${isCollapsed ? "left-20" : "left-64"}
      `}
    >

      {/* Search */}
      <div className="relative w-64">

        <span className="
          absolute inset-y-0 left-0
          flex items-center pl-3
          text-slate-400
        ">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </span>


        <input
          type="text"
          placeholder="Search applications..."
          className="
            w-full
            pl-9 pr-3
            py-1.5
            text-sm
            rounded-full
            bg-slate-100 dark:bg-slate-800
            text-slate-800 dark:text-white
            placeholder-slate-400
            border border-transparent
            focus:outline-none
            focus:border-slate-300
            dark:focus:border-slate-600
          "
        />

      </div>



      {/* Actions */}
      <div className="flex items-center gap-1.5">


        {/* Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="
            p-2
            rounded-full
            text-slate-500
            dark:text-slate-300
            hover:bg-slate-100
            dark:hover:bg-slate-800
          "
          aria-label="Toggle theme"
        >

          {theme === "dark" ? (

            // Sun
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364-6.364-1.414 1.414M7.05 16.95l-1.414 1.414m12.728 0-1.414-1.414M7.05 7.05 5.636 5.636M12 8a4 4 0 100 8 4 4 0 000-8z"
              />
            </svg>

          ) : (

            // Moon
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M20.354 15.354A9 9 0 018.646 3.646 9 9 0 1019.354 14.354c.348.348.348.91 0 1z"
              />
            </svg>

          )}

        </button>



        {/* Notification */}
        <button
          type="button"
          className="
            p-2
            rounded-full
            text-slate-500
            dark:text-slate-300
            hover:bg-slate-100
            dark:hover:bg-slate-800
          "
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
        </button>



        {/* Profile */}
        <div className="relative">

          <button
            type="button"
            onClick={() => setIsProfileMenuOpen(v => !v)}
            className="
              flex items-center gap-2
              rounded-full
              border
              border-slate-200 dark:border-slate-700
              bg-white dark:bg-slate-800
              px-2.5 py-1
              hover:bg-slate-50
              dark:hover:bg-slate-700
            "
          >

            <div
              className="
                flex
                h-6 w-6
                items-center justify-center
                rounded-full
                bg-blue-600
                text-[10px]
                font-bold
                text-white
              "
            >
              {activeRole.charAt(0)}
            </div>


            <div className="hidden md:block">

              <p className="
                text-xs
                font-semibold
                text-slate-800
                dark:text-white
              ">
                {activeRole}
              </p>

              <p className="text-[10px] text-slate-400">
                Staff
              </p>

            </div>

          </button>



          {isProfileMenuOpen && (
            <SettingModal

              onSettings={() => {
                setIsProfileMenuOpen(false);

                navigate("/profile", {
                  state: { activeRole }
                });
              }}

              onLogout={() => {
                setIsProfileMenuOpen(false);

                notify("You have been logged out.");

                navigate("/");
              }}

            />
          )}

        </div>

      </div>

    </header>
  );
}
