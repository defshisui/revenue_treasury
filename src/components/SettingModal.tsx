import { useEffect, useRef, useState } from "react";

interface SettingModalProps {
  onSettings: () => void;
  onLogout: () => void;
}

export default function SettingModal({ onSettings, onLogout }: SettingModalProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
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
        onClick={() => setOpen(false)}
      >
        <div className="absolute right-0 mt-1 w-60 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <button
            onClick={() => {
              onSettings();
              setOpen(false);
            }}
            className="w-full px-2 py-3 text-center hover:bg-gray-100 text-blue-600"
          >
            Settings
          </button>

          <div className="border-t border-gray-200" />

          <button
            onClick={() => {
              onLogout();
              setOpen(false);
            }}
            className="w-full px-2 py-3 text-center text-red-600 hover:bg-red-50"
          >
            Logout
          </button>
        </div>
      </button>

    </div>
  );
}