// src/citizen-portal/CitizenProfile.tsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { UnifiedHeader } from "./UnifiedHeader";
import { UnifiedFooter } from "./UnifiedFooter";
import { API_BASE_URL } from "../config/api";

/* ─────────────── helpers ─────────────── */
function getSession() {
  const raw =
    localStorage.getItem("currentUser") ||
    localStorage.getItem("user") ||
    sessionStorage.getItem("currentUser") ||
    sessionStorage.getItem("user");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.user && typeof parsed.user === "object" ? parsed.user : parsed;
  } catch {
    return null;
  }
}

function getToken() {
  return localStorage.getItem("token") || "";
}

/* ─────────────── component ─────────────── */
export default function CitizenProfile() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* session */
  const session = getSession();
  const userId: string = session?.id ? String(session.id) : "";
  const sessionEmail: string = session?.email || "";
  const sessionName: string =
    session?.fullname || session?.name || session?.fullName || "";

  /* avatar */
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    session?.avatar || null
  );

  /* form state */
  const [form, setForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    suffix: "",
    email: sessionEmail,
    mobileNumber: "",
    birthDate: "",
    sex: "Male",
    occupation: "",
    houseNoStreet: "",
    barangay: "",
    city: "",
  });

  // Change Password accordion — closed by default so the profile stays compact.
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  /* ── fetch existing citizen profile on mount ── */
  useEffect(() => {
    if (!userId) {
      navigate("/");
      return;
    }
    const token = getToken();
    fetch(`${API_BASE_URL}/citizens/${userId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setForm({
            firstName: data.first_name || "",
            middleName: data.middle_name || "",
            lastName: data.last_name || "",
            suffix: data.suffix || "",
            email: sessionEmail,
            mobileNumber: data.mobile_number || "",
            birthDate: data.birth_date ? data.birth_date.slice(0, 10) : "",
            sex: data.sex || "Male",
            occupation: data.occupation || "",
            houseNoStreet: data.house_no_street || "",
            barangay: data.barangay || "",
            city: data.city || "",
          });
          if (data.avatar) setAvatarUrl(data.avatar);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId, sessionEmail, navigate]);

  /* ── avatar upload ── */
  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be less than 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setAvatarUrl(base64);

      // Persist in localStorage
      const storageKey = localStorage.getItem("currentUser") ? "currentUser" : "user";
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          const target = parsed.user && typeof parsed.user === "object" ? parsed.user : parsed;
          target.avatar = base64;
          localStorage.setItem(storageKey, JSON.stringify(parsed));
        } catch { /* ignore */ }
      }

      // Persist to DB
      const token = getToken();
      try {
        await fetch(`${API_BASE_URL}/admin/avatar`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ email: sessionEmail, avatar: base64 }),
        });
        setStatus("✅ Profile picture updated.");
      } catch {
        setStatus("✅ Profile picture saved locally.");
      }
    };
    reader.readAsDataURL(file);
  }

  /* ── form change ── */
  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  /* ── save profile ── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setStatus("");

    const token = getToken();
    try {
      const res = await fetch(`${API_BASE_URL}/citizens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId,
          firstName: form.firstName,
          middleName: form.middleName,
          lastName: form.lastName,
          suffix: form.suffix,
          birthDate: form.birthDate,
          houseNoStreet: form.houseNoStreet,
          barangay: form.barangay,
          city: form.city,
          occupation: form.occupation,
          sex: form.sex,
          mobileNumber: form.mobileNumber,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save profile.");

      // Update localStorage name so header reflects new name
      const storageKey = localStorage.getItem("currentUser") ? "currentUser" : "user";
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          const target = parsed.user && typeof parsed.user === "object" ? parsed.user : parsed;
          const fullName = [form.firstName, form.middleName, form.lastName, form.suffix]
            .filter(Boolean).join(" ");
          target.fullname = fullName;
          target.name = fullName;
          localStorage.setItem(storageKey, JSON.stringify(parsed));
          window.dispatchEvent(new Event("profileUpdated"));
        } catch { /* ignore */ }
      }

      setStatus("✅ Profile saved successfully.");
    } catch (err: any) {
      setError(err.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  /* ── change password accordion ── */
  function handlePasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  }

  const passwordRequirements = {
    minLength: passwordForm.newPassword.length >= 8,
    uppercase: /[A-Z]/.test(passwordForm.newPassword),
    lowercase: /[a-z]/.test(passwordForm.newPassword),
    number: /[0-9]/.test(passwordForm.newPassword),
    special: /[^A-Za-z0-9]/.test(passwordForm.newPassword),
  };

  /* initials */
  const fullName = [form.firstName, form.lastName].filter(Boolean).join(" ") || sessionName || "Citizen";
  const nameParts = fullName.trim().split(" ");
  const initials =
    nameParts.length > 1
      ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
      : nameParts[0].slice(0, 2).toUpperCase();

  /* ── UI ── */
  return (
    <div
      className="min-h-screen bg-[#F4F6F8] text-slate-800 font-['Segoe_UI',Tahoma,Geneva,Verdana,sans-serif] flex flex-col antialiased relative transition-all duration-300 box-border"
    >
      <UnifiedHeader />

      <div className="flex-1 flex flex-col justify-between w-full">
        <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 sm:py-7">
        {/* ── Page header ── */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold tracking-widest text-blue-700 uppercase mb-1">
              Citizen Portal
            </p>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              My Profile
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Keep your personal information up to date.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/citizen-portal")}
            className="text-xs font-bold text-slate-600 hover:text-blue-700 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-xs transition cursor-pointer"
          >
            Back to Portal
          </button>
        </div>

        {/* ── Status / error ── */}
        {status && (
          <div className="mb-5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold px-4 py-3 rounded-2xl">
            {status}
          </div>
        )}
        {error && (
          <div className="mb-5 bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold px-4 py-3 rounded-2xl">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24 text-slate-400 font-semibold text-sm">
            Loading profile…
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-5 items-start">

            {/* ── Left: avatar card ── */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col items-center gap-3 h-fit">
              {/* Avatar */}
              <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-slate-100 shadow-inner flex items-center justify-center bg-blue-600">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white text-3xl font-extrabold">{initials}</span>
                  )}
                </div>
                <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  <span className="text-white text-[10px] font-bold text-center px-1">Change Photo</span>
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleAvatarChange} />

              <div className="text-center">
                <p className="font-extrabold text-slate-900 text-sm">{fullName}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{sessionEmail}</p>
              </div>

              <span className="bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                Citizen
              </span>

              <div className="w-full border-t border-slate-100 pt-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Sex</span>
                  <span className="font-bold text-slate-800">{form.sex || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Birth Date</span>
                  <span className="font-bold text-slate-800">{form.birthDate || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">City</span>
                  <span className="font-bold text-slate-800">{form.city || "—"}</span>
                </div>
              </div>
            </div>

            {/* ── Right: form ── */}
            <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
              <h2 className="text-base font-extrabold text-slate-900 mb-1">Personal Information</h2>

              {/* Name row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">First Name *</label>
                  <input name="firstName" required value={form.firstName} onChange={handleChange}
                    placeholder="First Name"
                    className="w-full bg-[#EBF2FE] rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Middle Name</label>
                  <input name="middleName" value={form.middleName} onChange={handleChange}
                    placeholder="Middle Name"
                    className="w-full bg-[#EBF2FE] rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Last Name *</label>
                  <input name="lastName" required value={form.lastName} onChange={handleChange}
                    placeholder="Last Name"
                    className="w-full bg-[#EBF2FE] rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600" />
                </div>
              </div>

              {/* Suffix + Sex + Birth Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Suffix</label>
                  <input name="suffix" value={form.suffix} onChange={handleChange}
                    placeholder="Jr., Sr., III"
                    className="w-full bg-[#EBF2FE] rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Sex *</label>
                  <select name="sex" value={form.sex} onChange={handleChange}
                    className="w-full bg-[#EBF2FE] rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer">
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Birth Date *</label>
                  <input name="birthDate" type="date" required value={form.birthDate} onChange={handleChange}
                    className="w-full bg-[#EBF2FE] rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer" />
                </div>
              </div>

              {/* Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Email Address</label>
                  <input name="email" type="email" value={form.email} disabled
                    className="w-full bg-slate-100 rounded-xl px-4 py-2.5 text-sm text-slate-500 font-medium cursor-not-allowed" />
                  <p className="text-[10px] text-slate-400">Email cannot be changed here.</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Mobile Number *</label>
                  <input name="mobileNumber" required value={form.mobileNumber} onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 11);
                    setForm((prev) => ({ ...prev, mobileNumber: val }));
                  }}
                    placeholder="09123456789" maxLength={11}
                    className="w-full bg-[#EBF2FE] rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600 tracking-wider" />
                </div>
              </div>

              {/* Occupation */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Occupation</label>
                <input name="occupation" value={form.occupation} onChange={handleChange}
                  placeholder="e.g. Farmer, Teacher, Business Owner"
                  className="w-full bg-[#EBF2FE] rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600" />
              </div>

              {/* Address */}
              <div className="border-t border-slate-100 pt-4 space-y-3.5">
                <h3 className="text-sm font-extrabold text-slate-800">Address</h3>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">House No. / Street *</label>
                  <input name="houseNoStreet" required value={form.houseNoStreet} onChange={handleChange}
                    placeholder="e.g. 12 Mabini St."
                    className="w-full bg-[#EBF2FE] rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Barangay *</label>
                    <input name="barangay" required value={form.barangay} onChange={handleChange}
                      placeholder="Barangay"
                      className="w-full bg-[#EBF2FE] rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">City / Municipality *</label>
                    <input name="city" required value={form.city} onChange={handleChange}
                      placeholder="City"
                      className="w-full bg-[#EBF2FE] rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600" />
                  </div>
                </div>
              </div>

              {/* Save button */}
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold py-3 rounded-2xl text-sm shadow-md transition cursor-pointer"
                >
                  {saving ? "Saving…" : "Save Profile"}
                </button>
              </div>
            </form>

            {/* ── Change Password accordion ── */}
            <div className="mt-4 bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setIsPasswordOpen((prev) => !prev)}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left cursor-pointer hover:bg-slate-50 transition"
                aria-expanded={isPasswordOpen}
              >
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">
                    Change Security Password
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Update your password to keep your citizen account secure.
                  </p>
                </div>

                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 border border-blue-200 text-blue-700 transition-transform duration-200 ${
                    isPasswordOpen ? "rotate-180" : ""
                  }`}
                  aria-hidden="true"
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </span>
              </button>

              {isPasswordOpen && (
                <div className="border-t border-slate-100 px-5 pb-5 pt-4">
                  <div className="space-y-3">
                    <input
                      type="password"
                      name="currentPassword"
                      value={passwordForm.currentPassword}
                      onChange={handlePasswordChange}
                      placeholder="Current Password"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />

                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                      <p className="text-[11px] font-bold text-slate-800 mb-2">
                        Password must contain:
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-3 gap-y-1 text-[10px] leading-tight">
                        <span className={passwordRequirements.minLength ? "text-emerald-600" : "text-slate-400"}>
                          {passwordRequirements.minLength ? "✓" : "○"} At least 8 characters
                        </span>
                        <span className={passwordRequirements.uppercase ? "text-emerald-600" : "text-slate-400"}>
                          {passwordRequirements.uppercase ? "✓" : "○"} At least 1 uppercase letter
                        </span>
                        <span className={passwordRequirements.lowercase ? "text-emerald-600" : "text-slate-400"}>
                          {passwordRequirements.lowercase ? "✓" : "○"} At least 1 lowercase letter
                        </span>
                        <span className={passwordRequirements.number ? "text-emerald-600" : "text-slate-400"}>
                          {passwordRequirements.number ? "✓" : "○"} At least 1 number
                        </span>
                        <span className={passwordRequirements.special ? "text-emerald-600" : "text-slate-400"}>
                          {passwordRequirements.special ? "✓" : "○"} At least 1 special character
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="password"
                        name="newPassword"
                        value={passwordForm.newPassword}
                        onChange={handlePasswordChange}
                        placeholder="New Password"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />

                      <input
                        type="password"
                        name="confirmPassword"
                        value={passwordForm.confirmPassword}
                        onChange={handlePasswordChange}
                        placeholder="Confirm New Password"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setError("Password change is ready in the profile UI. The citizen password endpoint still needs to be connected.");
                        setStatus("");
                      }}
                      className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-sm transition cursor-pointer"
                    >
                      Update Password
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        </main>

        <UnifiedFooter />
      </div>
    </div>
  );
}
