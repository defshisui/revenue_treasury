// src/components/SettingModal.tsx
import { useEffect, useRef, useState } from "react";

interface SettingModalProps {
  onSettings: () => void;
  onLogout: () => void;
}

export default function SettingModal({ onSettings, onLogout }: SettingModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
      >
        Options
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg z-50">
          <button
            onClick={() => {
              onSettings();
              setIsOpen(false);
            }}
            className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-slate-800 text-blue-600 dark:text-blue-400 text-xs font-semibold cursor-pointer border-none bg-transparent"
          >
            Settings
          </button>

          <div className="border-t border-gray-200 dark:border-slate-800" />

          <button
            onClick={() => {
              onLogout();
              setIsOpen(false);
            }}
            className="w-full px-4 py-3 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-semibold cursor-pointer border-none bg-transparent"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}