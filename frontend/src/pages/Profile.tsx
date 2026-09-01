// src/components/Profile.tsx
import { useState, useRef, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";

import { useProfileForm } from "../hooks/useProfileForm";
import { usePasswordForm } from "../hooks/usePasswordForm";
import SessionInactivityModal from "../components/SessionInactivityModal";
import { API_BASE_URL } from "../config/api";

interface ProfileLocationState {
  activeRole?: string;
}

export default function Profile() {
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  /*
   * DARK MODE
   * --------------------------------------------------
   */
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem("theme") === "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const appRoot = document.getElementById("root");

    if (isDarkMode) {
      root.classList.add("dark");
      root.style.backgroundColor = "#020617";
      body.style.backgroundColor = "#020617";
      body.style.color = "#f8fafc";
      if (appRoot) appRoot.style.backgroundColor = "#020617";
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      root.style.backgroundColor = "#f8fafc";
      body.style.backgroundColor = "#f8fafc";
      body.style.color = "#1e293b";
      if (appRoot) appRoot.style.backgroundColor = "#f8fafc";
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  /*
   * ROLE
   */
  const rawSession =
  localStorage.getItem("currentUser") ||
  localStorage.getItem("user") ||
  sessionStorage.getItem("currentUser") ||
  sessionStorage.getItem("user");

let sessionRole = "";

if (rawSession) {
  try {
    const parsed = JSON.parse(rawSession);

    const target =
      parsed.user &&
      typeof parsed.user === "object"
        ? parsed.user
        : parsed;

    sessionRole =
      target.role ||
      target.userRole ||
      target.accountType ||
      "";
  } catch (error) {
    console.error(
      "Failed to read user role:",
      error
    );
  }
}

const activeRole =
  (location.state as ProfileLocationState | null)
    ?.activeRole ||
  sessionRole ||
  "Administrator";

const isCitizen =
  String(activeRole).toLowerCase() === "citizen" ||
  String(activeRole).toLowerCase() === "taxpayer";

  const canCreateRPT = [
    "Administrator",
    "Municipal Treasurer",
    "Property Assessment Officer",
    "Data Encoder",
  ].includes(activeRole);

  const canApprove = [
    "Administrator",
    "Municipal Treasurer",
    "Assistant Treasurer",
  ].includes(activeRole);

  const canDelete = [
    "Administrator",
    "Municipal Treasurer",
  ].includes(activeRole);

  /*
   * FETCH LOGGED-IN ADMIN SESSION
   * --------------------------------------------------
   */
  const getInitialUserData = () => {
    const rawData = localStorage.getItem('currentUser') ||
      localStorage.getItem('user') ||
      sessionStorage.getItem('currentUser') ||
      sessionStorage.getItem('user');

    if (!rawData) return null;

    try {
      const parsed = JSON.parse(rawData);
      const target = parsed.user && typeof parsed.user === 'object' ? parsed.user : parsed;

      const fullName = target.fullname || target.name || target.fullName || target.firstName || "";
      const email = target.email || "";
      const avatar = target.avatar || target.profile_picture || null;
      const phone = target.phone || "";
      const address = target.address || "";
      const department = target.department || "";

      let initials = activeRole.charAt(0);
      if (fullName) {
        const nameParts = String(fullName).trim().split(" ");
        initials = nameParts.length > 1
          ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
          : nameParts[0].slice(0, 2).toUpperCase();
      }

      return { fullName, email, initials, avatar, phone, address, department };
    } catch (e) {
      console.error("Failed to parse admin session", e);
      return null;
    }
  };

  const initialUser = getInitialUserData();

  /*
   * PROFILE DATA
   */
  const { profileData, setProfileData, handleProfileChange } = useProfileForm({
    fullName: initialUser?.fullName || "",
    email: initialUser?.email || "",
    phone: initialUser?.phone || "+63",
    address: initialUser?.address || "",
    employeeId: "",
    department: initialUser?.department || "",
    position: activeRole,
  });

  // Fetch full profile from DB on mount so fields like phone/address/department
  // are populated correctly after a page refresh.
  useEffect(() => {
    const email = initialUser?.email;
    if (!email) return;
    const token = localStorage.getItem('token');
    fetch(`${API_BASE_URL}/admin/profile?email=${encodeURIComponent(email)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        setProfileData((prev) => ({
          ...prev,
          fullName: data.name || prev.fullName,
          email: data.email || prev.email,
          phone: data.phone || prev.phone,
          address: data.address || prev.address,
          department: data.department || prev.department,
          employeeId: data.employee_id || data.employeeId || prev.employeeId,
        }));
        // Hydrate avatar from DB if present
        if (data.avatar) {
          setAvatarUrl(resolveAvatarUrl(data.avatar));
          // Sync to localStorage so other components see it
          const storageKey = localStorage.getItem('currentUser') ? 'currentUser' : 'user';
          const raw = localStorage.getItem(storageKey);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (parsed.user && typeof parsed.user === 'object') {
                parsed.user.avatar = data.avatar;
              } else {
                parsed.avatar = data.avatar;
              }
              localStorage.setItem(storageKey, JSON.stringify(parsed));
            } catch { /* ignore */ }
          }
        }
      })
      .catch(() => { /* silently ignore — localStorage fallback is already shown */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * AVATAR
   */
  const resolveAvatarUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    // base64 data URLs and full http URLs work as-is
    if (url.startsWith('data:') || url.startsWith('http')) return url;
    // Server-relative path like /uploads/... → prefix with backend URL
    return `${API_BASE_URL}${url}`;
  };
  const [avatarUrl, setAvatarUrl] = useState<string | null>(resolveAvatarUrl(initialUser?.avatar));

  /*
   * PASSWORD
   */
  const { passwordData, handlePasswordChange, resetPasswordForm } = usePasswordForm();

  /*
   * MESSAGES
   */
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  /*
   * IMAGE UPLOAD 
   */
  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage("Image size must be less than 2MB.");
      setStatusMessage("");
      return;
    }

    const storageKey = localStorage.getItem('currentUser') ? 'currentUser' : 'user';
    const rawData = localStorage.getItem(storageKey);
    const parsedData = rawData ? JSON.parse(rawData) : null;
    const userObj = parsedData?.user && typeof parsedData.user === 'object' ? parsedData.user : parsedData;
    const userEmail = userObj?.email || profileData.email;

    // Always convert to base64 first — guaranteed to work regardless of server state
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;

      // Update state immediately so the photo shows right away
      setAvatarUrl(base64String);
      setErrorMessage('');

      // Persist base64 in localStorage
      if (parsedData) {
        if (parsedData.user && typeof parsedData.user === 'object') {
          parsedData.user.avatar = base64String;
        } else {
          parsedData.avatar = base64String;
        }
        localStorage.setItem(storageKey, JSON.stringify(parsedData));
      }

      window.dispatchEvent(new Event('profileUpdated'));

      // Also persist the avatar to the server DB (as base64) so it survives across sessions
      try {
        const avatarToken = localStorage.getItem('token');
        const resp = await fetch(`${API_BASE_URL}/admin/avatar`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(avatarToken ? { Authorization: `Bearer ${avatarToken}` } : {}),
          },
          body: JSON.stringify({ email: userEmail, avatar: base64String }),
        });
        if (resp.ok) {
          setStatusMessage('✅ Profile picture updated.');
        } else {
          setStatusMessage('✅ Profile picture updated locally.');
        }
      } catch {
        setStatusMessage('✅ Profile picture updated locally.');
      }
    };

    reader.readAsDataURL(file);
  }


  /*
   * PROFILE SUBMIT
   */
  async function handleProfileSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setStatusMessage("");

    try {
      const storageKey = localStorage.getItem('currentUser') ? 'currentUser' : 'user';
      const rawData = localStorage.getItem(storageKey);

      if (!rawData) {
        throw new Error("No active session found. Please log in again.");
      }

      const parsedData = JSON.parse(rawData);
      const userObj = parsedData.user && typeof parsedData.user === 'object' ? parsedData.user : parsedData;
      // The email currently stored in the session — used to locate the DB row
      const currentEmail = userObj.email || profileData.email;

      // Attempt DB Update
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          currentEmail,
          fullname: profileData.fullName,
          email: profileData.email,
          phone: profileData.phone,
          department: profileData.department,
          address: profileData.address
        })
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.message || 'Failed to update profile on server.');
      }

      // Update local storage so the header/nav reflects the new name/email immediately
      if (parsedData.user && typeof parsedData.user === 'object') {
        parsedData.user.fullname = profileData.fullName;
        parsedData.user.email    = profileData.email;
        parsedData.user.phone    = profileData.phone;
        parsedData.user.department = profileData.department;
        parsedData.user.address  = profileData.address;
      } else {
        parsedData.fullname    = profileData.fullName;
        parsedData.email       = profileData.email;
        parsedData.phone       = profileData.phone;
        parsedData.department  = profileData.department;
        parsedData.address     = profileData.address;
      }

      localStorage.setItem(storageKey, JSON.stringify(parsedData));
      window.dispatchEvent(new Event('profileUpdated'));
      setStatusMessage("✅ Profile updated successfully.");

    } catch (e: any) {
      console.error("Failed to update profile", e);
      setErrorMessage(e.message || "Failed to save changes.");
    }
  }

  /*
   * PASSWORD SUBMIT
   */
  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setStatusMessage("");

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setErrorMessage("New password and confirmation do not match.");
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }

    try {
      const storageKey = localStorage.getItem('currentUser') ? 'currentUser' : 'user';
      const rawData = localStorage.getItem(storageKey);

      if (!rawData) {
        throw new Error("No active session found. Please log in again.");
      }

      const parsedData = JSON.parse(rawData);
      const userObj = parsedData.user && typeof parsedData.user === 'object' ? parsedData.user : parsedData;
      const userEmail = userObj.email || profileData.email;

      const pwToken = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/admin/change-password`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(pwToken ? { Authorization: `Bearer ${pwToken}` } : {}),
        },
        body: JSON.stringify({
          email: userEmail,
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Incorrect current password or server error.");
      }

      resetPasswordForm();
      setStatusMessage("✅ Password changed successfully.");

    } catch (e: any) {
      console.error("Failed to update password", e);
      setErrorMessage(e.message || "Failed to secure new password on the server.");
    }
  }

  /*
   * COLORS
   */
  const pageBackground = isDarkMode ? "#020617" : "#f8fafc";

  // Re-calculate initials on render based on the current state (profileData)
  const currentFullName = profileData.fullName || "Administrator";
  const nameParts = String(currentFullName).trim().split(" ");
  const currentInitials = nameParts.length > 1
    ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
    : nameParts[0].slice(0, 2).toUpperCase();

  return (
    <div
      className={`min-h-screen w-full overflow-x-auto transition-colors duration-300 ${isDarkMode ? "text-slate-100" : "text-slate-800"
        }`}
      style={{ backgroundColor: pageBackground }}
    >
      <div
        className="min-h-screen min-w-[300px] w-full transition-colors duration-300"
        style={{ backgroundColor: pageBackground }}
      >
        {/* =====================================================
            TOP CONTROLS BAR
        ====================================================== */}
        <div
          className={`flex items-center justify-end gap-4 border-b px-12 py-4 transition-colors duration-300 ${isDarkMode ? "border-slate-800" : "border-slate-200"
            }`}
          style={{ backgroundColor: pageBackground }}
        >
          {/* DARK MODE BUTTON */}
          <button
            type="button"
            onClick={() => setIsDarkMode((current) => !current)}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold shadow-sm transition cursor-pointer ${isDarkMode
              ? "border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
              }`}
          >
            {isDarkMode ? (
              <>
                <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Light Mode
              </>
            ) : (
              <>
                <svg className="h-4 w-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                Dark Mode
              </>
            )}
          </button>

          {/* BACK TO DASHBOARD */}
          <Link
  to={
    isCitizen
      ? "/citizen-portal"
      : "/legacy-treasury"
  }
  className={`text-sm font-medium transition-colors ${
    isDarkMode
      ? "text-slate-300 hover:text-blue-400"
      : "text-slate-600 hover:text-blue-800"
  }`}
>
  Back to Dashboard &rarr;
</Link>
        </div>

        {/* =====================================================
            MAIN PAGE
        ====================================================== */}
        <main
          className="min-h-[calc(100vh-73px)] px-12 py-10 transition-colors duration-300"
          style={{ backgroundColor: pageBackground }}
        >
          {/* ===================================================
              PROFILE HEADER
          ==================================================== */}
          <section
            className={`mx-auto max-w-7xl rounded-3xl border p-8 shadow-lg transition-colors duration-300 ${isDarkMode ? "border-slate-800 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900"
              }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                {/* PROFILE PHOTO */}
                <div className="group relative">
                  <div
                    className={`flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 shadow-inner ${isDarkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-100"
                      }`}
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-600 text-3xl font-bold text-white shadow-inner">
                        {currentInitials}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100 cursor-pointer"
                  >
                    Change Photo
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png, image/jpeg"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </div>

                {/* PROFILE TITLE */}
                <div>
                  <p className={`text-sm uppercase tracking-[0.3em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                    Republic of the Philippines • LGU Portal
                  </p>
                  <h2 className={`mt-1 text-3xl font-extrabold ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                    {profileData.fullName || "Administrator Profile"}
                  </h2>
                  <p className={`text-sm font-medium ${isDarkMode ? "text-blue-400" : "text-blue-800"}`}>
                    {profileData.department || "Office of the Municipal Treasurer"}
                  </p>
                </div>
              </div>

              {/* EMPLOYEE ID */}
              <div className={`rounded-2xl px-4 py-3 text-sm ${isDarkMode ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-700"}`}>
                Employee ID: <strong className={isDarkMode ? "text-white" : "text-slate-900"}>{profileData.employeeId || "Not Assigned"}</strong>
              </div>
            </div>
          </section>

          {/* ===================================================
              STATUS / ERROR MESSAGES
          ==================================================== */}
          {(statusMessage || errorMessage) && (
            <div className="mx-auto mt-6 max-w-7xl">
              {statusMessage && (
                <div className={`rounded-2xl border p-4 text-sm shadow-sm ${isDarkMode ? "border-emerald-800 bg-emerald-950/30 text-emerald-400" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                  {statusMessage}
                </div>
              )}
              {errorMessage && (
                <div className={`mt-3 rounded-2xl border p-4 text-sm shadow-sm ${isDarkMode ? "border-rose-800 bg-rose-950/30 text-rose-400" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
                  {errorMessage}
                </div>
              )}
            </div>
          )}

          {/* ===================================================
              MAIN CONTENT GRID
          ==================================================== */}
          <section className="mx-auto mt-8 grid max-w-7xl grid-cols-[1.4fr_0.9fr] gap-8">
            {/* =================================================
                LEFT COLUMN
            ================================================== */}
            <div className={`rounded-3xl border p-8 shadow-lg transition-colors duration-300 ${isDarkMode ? "border-slate-800 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900"}`}>
              <h3 className="text-xl font-bold">Official Staff Information</h3>
              <p className={`mt-2 text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Update your official contact records and assignment details.
              </p>

              {/* PROFILE FORM */}
              <form onSubmit={handleProfileSubmit} className="mt-6 grid gap-4">
                {/* FULL NAME */}
                <div>
                  <label className={`mb-1 block text-xs font-semibold uppercase ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Full Name</label>
                  <input
                    type="text"
                    name="fullName"
                    value={profileData.fullName}
                    onChange={handleProfileChange}
                    placeholder="Full Name"
                    required
                    className={`w-full rounded-xl border p-3 text-base outline-none transition-colors ${isDarkMode ? "border-slate-700 bg-slate-950 text-white placeholder:text-slate-500 focus:border-blue-500" : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-800"}`}
                  />
                </div>

                {/* EMAIL + PHONE */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`mb-1 block text-xs font-semibold uppercase ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Official Email Address</label>
                    <input
                      type="email"
                      name="email"
                      value={profileData.email}
                      onChange={handleProfileChange}
                      placeholder="Email Address"
                      required
                      className={`w-full rounded-xl border p-3 text-base outline-none transition-colors ${isDarkMode ? "border-slate-700 bg-slate-950 text-white placeholder:text-slate-500 focus:border-blue-500" : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-800"}`}
                    />
                  </div>
                  <div>
                    <label className={`mb-1 block text-xs font-semibold uppercase ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Contact Number</label>
                    <input
                      type="tel"
                      name="phone"
                      value={profileData.phone}
                      onChange={handleProfileChange}
                      placeholder="+63 912 345 6789"
                      className={`w-full rounded-xl border p-3 text-base outline-none transition-colors ${isDarkMode ? "border-slate-700 bg-slate-950 text-white placeholder:text-slate-500 focus:border-blue-500" : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-800"}`}
                    />
                  </div>
                </div>

                {/* DEPARTMENT */}
                <div>
                  <label className={`mb-1 block text-xs font-semibold uppercase ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Department / Division</label>
                  <select
                    name="department"
                    value={profileData.department}
                    onChange={handleProfileChange}
                    className={`w-full rounded-xl border p-3 text-base outline-none transition-colors ${isDarkMode ? "border-slate-700 bg-slate-950 text-white focus:border-blue-500" : "border-slate-300 bg-white text-slate-900 focus:border-blue-800"}`}
                  >
                    <option value="">Select Department</option>
                    <option value="Office of the Municipal Treasurer">Office of the Municipal Treasurer</option>
                    <option value="Municipal Assessor's Office">Municipal Assessor's Office</option>
                    <option value="Business Permits and Licensing Office">Business Permits and Licensing Office</option>
                    <option value="Information and Communications Technology Office">Information and Communications Technology Office</option>
                  </select>
                </div>

                {/* ADDRESS */}
                <div>
                  <label className={`mb-1 block text-xs font-semibold uppercase ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Official Address / Station</label>
                  <input
                    type="text"
                    name="address"
                    value={profileData.address}
                    onChange={handleProfileChange}
                    placeholder="Address"
                    className={`w-full rounded-xl border p-3 text-base outline-none transition-colors ${isDarkMode ? "border-slate-700 bg-slate-950 text-white placeholder:text-slate-500 focus:border-blue-500" : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-blue-800"}`}
                  />
                </div>

                {/* SAVE */}
                <button
                  type="submit"
                  className="mt-2 rounded-xl bg-blue-600 px-6 py-4 font-bold text-white transition hover:bg-blue-700 cursor-pointer shadow-sm"
                >
                  Save Profile Details
                </button>
              </form>

              {/* =================================================
                  PASSWORD SECTION
              ================================================== */}
              <div className={`mt-10 rounded-3xl border p-6 transition-colors duration-300 ${isDarkMode ? "border-slate-800 bg-slate-950 text-white" : "border-slate-100 bg-slate-50 text-slate-900"}`}>
                <h4 className="text-lg font-semibold">Change Security Password</h4>
                <p className={`mt-2 text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                  Update your access password regularly to maintain administrative security compliance.
                </p>

                <form onSubmit={handlePasswordSubmit} className="mt-6 grid gap-4">
                  <input
                    type="password"
                    name="currentPassword"
                    value={passwordData.currentPassword}
                    onChange={handlePasswordChange}
                    placeholder="Current Password"
                    required
                    className={`w-full rounded-xl border p-3 text-base outline-none transition-colors ${isDarkMode ? "border-slate-700 bg-slate-900 text-white placeholder:text-slate-500 focus:border-slate-400" : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-slate-900"}`}
                  />
                  <input
                    type="password"
                    name="newPassword"
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                    placeholder="New Password (min. 8 characters)"
                    required
                    className={`w-full rounded-xl border p-3 text-base outline-none transition-colors ${isDarkMode ? "border-slate-700 bg-slate-900 text-white placeholder:text-slate-500 focus:border-slate-400" : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-slate-900"}`}
                  />
                  <input
                    type="password"
                    name="confirmPassword"
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordChange}
                    placeholder="Confirm New Password"
                    required
                    className={`w-full rounded-xl border p-3 text-base outline-none transition-colors ${isDarkMode ? "border-slate-700 bg-slate-900 text-white placeholder:text-slate-500 focus:border-slate-400" : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-slate-900"}`}
                  />
                  <button
                    type="submit"
                    className={`rounded-xl px-6 py-4 font-bold text-white transition cursor-pointer shadow-sm ${isDarkMode ? "bg-slate-700 hover:bg-slate-600" : "bg-slate-800 hover:bg-slate-700"}`}
                  >
                    Update Password
                  </button>
                </form>
              </div>
            </div>

            {/* =================================================
                RIGHT COLUMN
            ================================================== */}
            <aside className={`h-fit rounded-3xl border p-8 shadow-lg transition-colors duration-300 ${isDarkMode ? "border-slate-800 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900"}`}>
              <h3 className="text-xl font-bold">Account Overview</h3>
              <p className={`mt-2 text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Assigned credentials and system permission matrices.
              </p>

              {/* =================================================
                  STAFF CREDENTIALS
              ================================================== */}
              <div className={`mt-6 rounded-2xl border p-5 ${isDarkMode ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-slate-50"}`}>
                <h4 className="font-bold">Staff Credentials</h4>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className={isDarkMode ? "text-slate-400" : "text-slate-500"}>Employee ID</span>
                    <span className={isDarkMode ? "font-medium text-white" : "font-medium text-slate-900"}>{profileData.employeeId || "Not Assigned"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className={isDarkMode ? "text-slate-400" : "text-slate-500"}>Assigned Role</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isDarkMode ? "bg-blue-950 text-blue-300" : "bg-blue-100 text-blue-800"}`}>
                      {activeRole}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={isDarkMode ? "text-slate-400" : "text-slate-500"}>Status</span>
                    <span className={`font-semibold ${isDarkMode ? "text-emerald-400" : "text-emerald-600"}`}>Active Duty</span>
                  </div>
                </div>
              </div>

              {/* =================================================
                  SYSTEM PERMISSIONS
              ================================================== */}
              <div className={`mt-6 rounded-2xl border p-5 ${isDarkMode ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-slate-50"}`}>
                <h4 className="font-bold">System Permissions</h4>
                <p className={`mt-1 text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                  Access privileges for {activeRole}
                </p>

                <div className={`mt-4 space-y-3 text-sm ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                  <div className="flex items-center justify-between">
                    <span>Create RPT Records</span>
                    <span className={canCreateRPT ? (isDarkMode ? "font-semibold text-emerald-400" : "font-semibold text-emerald-600") : (isDarkMode ? "font-semibold text-rose-400" : "font-semibold text-rose-600")}>
                      {canCreateRPT ? "Allowed" : "Restricted"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Approve Transactions</span>
                    <span className={canApprove ? (isDarkMode ? "font-semibold text-emerald-400" : "font-semibold text-emerald-600") : (isDarkMode ? "font-semibold text-rose-400" : "font-semibold text-rose-600")}>
                      {canApprove ? "Allowed" : "Restricted"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Delete Database Entries</span>
                    <span className={canDelete ? (isDarkMode ? "font-semibold text-emerald-400" : "font-semibold text-emerald-600") : (isDarkMode ? "font-semibold text-rose-400" : "font-semibold text-rose-600")}>
                      {canDelete ? "Allowed" : "Restricted"}
                    </span>
                  </div>
                </div>
              </div>
            </aside>
          </section>
        </main>
      </div>
      <SessionInactivityModal idleTimeoutMinutes={10} countdownSeconds={60} />
    </div>
  );
}