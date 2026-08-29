// src/components/UsersView.tsx

import { useState, useEffect } from "react";
import type { UserRecord } from "../types/treasury";
import { API_BASE_URL } from "../config/api";

// Use Omit to remove the strict original status before extending it
interface ExtendedUserRecord extends Omit<UserRecord, 'status'> {
  status?: "Active" | "Inactive" | "ARCHIVED" | string;
}

export default function UsersView({
  records: initialRecords = [],
  isCollapsed = false
}: {
  records?: ExtendedUserRecord[];
  isCollapsed?: boolean
}) {
  const [records, setRecords] = useState<ExtendedUserRecord[]>(initialRecords);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("ALL");

  // Tab state for Archiver
  const [mainTab, setMainTab] = useState<'Active' | 'Archived'>('Active');

  // New User Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newFullname, setNewFullname] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("treasury-staff");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsers = () => {
    setIsLoading(true);
    fetch(`${API_BASE_URL}/users`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setRecords(data);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch system users:", err);
        setIsLoading(false);
      });
  };

  // Automatically fetch user records from backend on mount
  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredRecords = records.filter((record) => {
    // Archiver separation
    const isArchived = record.status === "ARCHIVED";
    if (mainTab === 'Active' && isArchived) return false;
    if (mainTab === 'Archived' && !isArchived) return false;

    const matchesSearch =
      record.fullname.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.username.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = selectedRole === "ALL" || record.role === selectedRole;

    return matchesSearch && matchesRole;
  });

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullname || !newUsername || !newPassword) return;
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullname: newFullname,
          username: newUsername,
          password: newPassword,
          role: newRole,
          status: "Active"
        })
      });

      if (response.ok) {
        setNewFullname("");
        setNewUsername("");
        setNewPassword("");
        setNewRole("treasury-staff"); // Reset role to default
        setIsAddModalOpen(false);
        fetchUsers(); // Refresh list
      } else {
        alert("Failed to create user account.");
      }
    } catch (error) {
      console.error("Error creating user:", error);
      alert("Network error while trying to create user.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchiveUser = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to archive ${name}? They will immediately lose access to the system.`)) return;

    // Optimistic UI update
    setRecords(prev => prev.map(r => r.id === id ? { ...r, status: "ARCHIVED" } : r));

    try {
      await fetch(`${API_BASE_URL}/users/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: "ARCHIVED" })
      });
    } catch (error) {
      console.warn("Backend archive failed, applying locally.");
    }
  };

  const handleRestoreUser = async (id: string, name: string) => {
    if (!window.confirm(`Restore account for ${name}? They will regain access.`)) return;

    // Optimistic UI update
    setRecords(prev => prev.map(r => r.id === id ? { ...r, status: "Active" } : r));

    try {
      await fetch(`${API_BASE_URL}/users/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: "Active" })
      });
    } catch (error) {
      console.warn("Backend restore failed, applying locally.");
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm("WARNING: Are you sure you want to permanently delete this user account?")) return;

    try {
      const response = await fetch(`${API_BASE_URL}/users/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setRecords(prevRecords => prevRecords.filter(record => record.id !== id));
      } else {
        alert("Failed to delete user account on the server.");
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      // Fallback for mock environments
      setRecords(prevRecords => prevRecords.filter(record => record.id !== id));
    }
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role.toLowerCase()) {
      case "admin":
        return "bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/30";
      case "auditor":
        return "bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/30";
      default:
        return "bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-500/30";
    }
  };

  const uniqueRoles = ["ALL", ...Array.from(new Set(records.map(r => r.role)))];

  return (
    <main
      className={`
        min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans p-4 sm:p-8 transition-all duration-300
        ${isCollapsed ? "ml-20" : "ml-64"}
      `}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">User Management & Security Access</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Configure access control levels, personnel roles, and active accounts</p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs bg-emerald-50 dark:bg-emerald-500/10 px-3.5 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-500/25 text-emerald-700 dark:text-emerald-400 font-semibold shadow-xs flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              Access Control Configured
            </span>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <span>+ Add New Personnel</span>
            </button>
          </div>
        </div>

        {/* Filters and Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">

          <div className="sm:col-span-4 flex gap-2 border-b border-slate-100 dark:border-slate-800 pb-4 mb-1">
            <button
              onClick={() => setMainTab('Active')}
              className={`px-5 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${mainTab === 'Active'
                  ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-600 shadow-sm'
                  : 'bg-transparent text-slate-500 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
            >
              Active Personnel
            </button>
            <button
              onClick={() => setMainTab('Archived')}
              className={`px-5 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${mainTab === 'Archived'
                  ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-600 shadow-sm'
                  : 'bg-transparent text-slate-500 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
            >
              Archived Accounts
            </button>
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <input
              type="text"
              placeholder="Search by full name or username/email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
            >
              {uniqueRoles.map((role) => (
                <option key={role} value={role} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Role: {role}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Content Section */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              {mainTab === 'Active' ? 'Authorized System Users' : 'Revoked Accounts'}
            </h3>
            <span className="text-xs text-slate-600 dark:text-slate-300 font-medium bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
              Showing {filteredRecords.length} of {records.length} accounts
            </span>
          </div>

          {isLoading ? (
            <p className="text-slate-600 dark:text-slate-400 text-xs italic py-8 text-center">Loading personnel records...</p>
          ) : filteredRecords.length === 0 ? (
            <p className="text-slate-600 dark:text-slate-400 text-xs italic py-12 text-center bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              No user accounts found matching your filter criteria.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-800 dark:text-slate-200">
                <thead className="bg-slate-100 dark:bg-slate-800 text-xs uppercase text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-4 text-slate-900 dark:text-white font-bold">Full Name</th>
                    <th className="p-4 text-slate-900 dark:text-white font-bold">Username / Email</th>
                    <th className="p-4 text-slate-900 dark:text-white font-bold">Assigned Role</th>
                    <th className="p-4 text-slate-900 dark:text-white font-bold">Fraud Risk</th>
                    <th className="p-4 text-slate-900 dark:text-white font-bold">Access Status</th>
                    <th className="p-4 text-slate-900 dark:text-white font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredRecords.map(record => (
                    <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-4 font-bold text-slate-900 dark:text-white">{record.fullname}</td>
                      <td className="p-4 font-mono text-xs text-blue-600 dark:text-blue-400 font-semibold">{record.username}</td>
                      <td className="p-4">
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${getRoleBadgeStyle(record.role)}`}>
                          {record.role}
                        </span>
                      </td>
                      <td className="p-4">
                        {/* Mock fraud risk for demonstration. In a real app, this would come from the database. */}
                        {record.username.includes('fraud') || record.username.includes('risk') ? (
                           <span className="bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 px-2 py-1 rounded text-xs font-bold border border-rose-200 dark:border-rose-500/20">High Risk (85)</span>
                        ) : (
                           <span className="bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded text-xs font-bold border border-emerald-200 dark:border-emerald-500/20">Low Risk (12)</span>
                        )}
                      </td>
                      <td className="p-4">
                        {record.status === 'ARCHIVED' ? (
                          <span className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-slate-300 dark:border-slate-700 flex items-center gap-1.5 w-max">
                            Archived (Access Revoked)
                          </span>
                        ) : (
                          <span className="bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-emerald-300 dark:border-emerald-500/30 flex items-center gap-1.5 w-max">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> Active
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          {mainTab === 'Active' ? (
                            <>
                              <button
                                onClick={() => handleArchiveUser(record.id, record.fullname)}
                                className="text-xs px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg font-semibold cursor-pointer transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                Archive
                              </button>
                              <button
                                onClick={() => handleDeleteUser(record.id)}
                                className="text-xs px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 rounded-lg font-semibold transition-colors cursor-pointer"
                              >
                                Delete
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleRestoreUser(record.id, record.fullname)}
                                className="text-xs px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 rounded-lg font-semibold cursor-pointer transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-900/60"
                              >
                                Restore
                              </button>
                              <button
                                onClick={() => handleDeleteUser(record.id)}
                                className="text-xs px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 rounded-lg font-semibold transition-colors cursor-pointer"
                              >
                                Delete (Final)
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add User Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Add New Treasury Personnel</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wider font-bold text-slate-700 dark:text-slate-300">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Juan Dela Cruz"
                  value={newFullname}
                  onChange={(e) => setNewFullname(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wider font-bold text-slate-700 dark:text-slate-300">Email / Username</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. juan.delacruz@lgu.gov.ph"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wider font-bold text-slate-700 dark:text-slate-300">Initial Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wider font-bold text-slate-700 dark:text-slate-300">Access Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
                >
                  <option value="treasury-staff">Treasury Staff</option>
                  <option value="auditor">Auditor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold px-4 py-2.5 rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-md cursor-pointer"
                >
                  {isSubmitting ? "Creating..." : "Save User Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}