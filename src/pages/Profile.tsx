import { useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import Header from "../components/Header";

interface ProfileLocationState {
  activeRole?: string;
}

interface ProfileFormData {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  employeeId: string;
  department: string;
  position: string;
}

interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function Profile() {
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeRole =
    (location.state as ProfileLocationState | null)?.activeRole ??
    "Administrator";

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

  const [profileData, setProfileData] = useState<ProfileFormData>({
    fullName: "",
    email: "",
    phone: "+63",
    address: "",
    employeeId: "",
    department: "",
    position: activeRole,
  });

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [passwordData, setPasswordData] = useState<PasswordFormData>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  function handleProfileChange(event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target;

    if (name === "phone") {
      let numbers = value.replace(/\D/g, "");

      if (numbers.startsWith("63")) {
        numbers = numbers.slice(2);
      }

      numbers = numbers.slice(0, 10);

      let formatted = "+63 ";

      if (numbers.length > 0) {
        formatted += numbers.slice(0, 3);
      }

      if (numbers.length >= 4) {
        formatted += " " + numbers.slice(3, 6);
      }

      if (numbers.length >= 7) {
        formatted += " " + numbers.slice(6, 10);
      }

      setProfileData((current) => ({
        ...current,
        phone: formatted,
      }));

      return;
    }

    setProfileData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setErrorMessage("Image size must be less than 2MB.");
        return;
      }
      const imageUrl = URL.createObjectURL(file);
      setAvatarUrl(imageUrl);
      setErrorMessage("");
      setStatusMessage("Profile picture updated successfully.");
    }
  }

  function handlePasswordChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setPasswordData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleProfileSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setStatusMessage("Official LGU profile information updated successfully.");
  }

  function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setErrorMessage("New password and confirmation do not match.");
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }

    setPasswordData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setStatusMessage("Account security password updated successfully.");
  }

  return (
    <>
      <Navbar />
      <Header title="LGU Staff Profile Settings" />

      <main className="lgu-dashboard bg-slate-50 py-10">
        <section className="lgu-profile-header mx-auto max-w-7xl rounded-3xl bg-white p-8 shadow-lg">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-6">
              <div className="relative group">
                <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-slate-200 bg-slate-100 flex items-center justify-center shadow-inner">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <svg className="h-12 w-12 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100"
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

              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Republic of the Philippines • LGU Portal</p>
                <h2 className="mt-1 text-3xl font-extrabold text-slate-900">{profileData.fullName}</h2>
                <p className="text-sm font-medium text-blue-800">{profileData.department}</p>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
              Employee ID: <strong>{profileData.employeeId}</strong>
            </div>
          </div>
        </section>

        {(statusMessage || errorMessage) && (
          <div className="mx-auto mt-6 max-w-7xl">
            {statusMessage && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 shadow-sm">
                {statusMessage}
              </div>
            )}
            {errorMessage && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
                {errorMessage}
              </div>
            )}
          </div>
        )}

        <section className="mx-auto mt-8 grid max-w-7xl gap-8 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="rounded-3xl bg-white p-8 shadow-lg">
            <h3 className="text-xl font-bold text-slate-900">Official Staff Information</h3>
            <p className="mt-2 text-sm text-slate-500">Update your official contact records and assignment details.</p>

            <form onSubmit={handleProfileSubmit} className="mt-6 grid gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Full Name</label>
                <input
                  type="text"
                  name="fullName"
                  value={profileData.fullName}
                  onChange={handleProfileChange}
                  placeholder="Full Name"
                  required
                  className="payment-form-item w-full rounded-xl border border-slate-300 p-3 text-slate-900 focus:border-blue-800 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Official Email Address</label>
                  <input
                    type="email"
                    name="email"
                    value={profileData.email}
                    onChange={handleProfileChange}
                    placeholder="Email Address"
                    required
                    className="payment-form-item w-full rounded-xl border border-slate-300 p-3 text-slate-900 focus:border-blue-800 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Contact Number</label>
                  <input
                    type="tel"
                    name="phone"
                    value={profileData.phone}
                    onChange={handleProfileChange}
                    placeholder="+63 912 345 6789"
                    className="payment-form-item w-full rounded-xl border border-slate-300 p-3 text-slate-900 focus:border-blue-800 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Department / Division</label>
                <select
                  name="department"
                  value={profileData.department}
                  onChange={handleProfileChange}
                  className="payment-form-item w-full rounded-xl border border-slate-300 p-3 text-slate-900 bg-white focus:border-blue-800 focus:outline-none"
                >
                  <option value="Office of the Municipal Treasurer">Office of the Municipal Treasurer</option>
                  <option value="Municipal Assessor's Office">Municipal Assessor's Office</option>
                  <option value="Business Permits and Licensing Office">Business Permits and Licensing Office</option>
                  <option value="Information and Communications Technology Office">Information and Communications Technology Office</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Official Address / Station</label>
                <input
                  type="text"
                  name="address"
                  value={profileData.address}
                  onChange={handleProfileChange}
                  placeholder="Address"
                  className="payment-form-item w-full rounded-xl border border-slate-300 p-3 text-slate-900 focus:border-blue-800 focus:outline-none"
                />
              </div>

              <button type="submit" className="mt-2 rounded-xl bg-blue-800 px-6 py-4 font-bold text-white transition hover:bg-blue-900">
                Save Profile Details
              </button>
            </form>

            <div className="mt-10 rounded-3xl bg-slate-50 p-6 border border-slate-100">
              <h4 className="text-lg font-semibold text-slate-900">Change Security Password</h4>
              <p className="mt-2 text-sm text-slate-500">Update your access password regularly to maintain administrative security compliance.</p>

              <form onSubmit={handlePasswordSubmit} className="mt-6 grid gap-4">
                <input
                  type="password"
                  name="currentPassword"
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                  placeholder="Current Password"
                  required
                  className="payment-form-item w-full rounded-xl border border-slate-300 p-3 text-slate-900 focus:border-slate-900 focus:outline-none bg-white"
                />
                <input
                  type="password"
                  name="newPassword"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  placeholder="New Password (min. 8 characters)"
                  required
                  className="payment-form-item w-full rounded-xl border border-slate-300 p-3 text-slate-900 focus:border-slate-900 focus:outline-none bg-white"
                />
                <input
                  type="password"
                  name="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  placeholder="Confirm New Password"
                  required
                  className="payment-form-item w-full rounded-xl border border-slate-300 p-3 text-slate-900 focus:border-slate-900 focus:outline-none bg-white"
                />

                <button type="submit" className="rounded-xl bg-slate-900 px-6 py-4 font-bold text-white transition hover:bg-slate-800">
                  Update Password
                </button>
              </form>
            </div>
          </div>

          <aside className="rounded-3xl bg-white p-8 shadow-lg h-fit">
            <h3 className="text-xl font-bold text-slate-900">Account Overview</h3>
            <p className="mt-2 text-sm text-slate-500">Assigned credentials and system permission matrices.</p>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h4 className="font-bold text-slate-900">Staff Credentials</h4>

              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Employee ID</span>
                  <span className="font-medium text-slate-900">{profileData.employeeId}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">Assigned Role</span>
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                    {activeRole}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">Status</span>
                  <span className="font-semibold text-emerald-600">Active Duty</span>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h4 className="font-bold text-slate-900">System Permissions</h4>
              <p className="mt-1 text-xs text-slate-500">Access privileges for {activeRole}</p>

              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span>Create RPT Records</span>
                  <span className={canCreateRPT ? "font-semibold text-emerald-600" : "font-semibold text-rose-600"}>
                    {canCreateRPT ? "Allowed" : "Restricted"}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span>Approve Transactions</span>
                  <span className={canApprove ? "font-semibold text-emerald-600" : "font-semibold text-rose-600"}>
                    {canApprove ? "Allowed" : "Restricted"}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span>Delete Database Entries</span>
                  <span className={canDelete ? "font-semibold text-emerald-600" : "font-semibold text-rose-600"}>
                    {canDelete ? "Allowed" : "Restricted"}
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </main>
    </>
  );
}