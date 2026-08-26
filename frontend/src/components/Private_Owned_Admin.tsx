import React, { useMemo, useState } from 'react';

interface BusinessRegistration {
  id: string;
  businessPermitNo: string;
  marketName: string;
  marketType:
    | 'Private Owned Market'
    | 'Private Talipapa'
    | 'Public Market';
  firstName: string;
  lastName: string;
  entityType:
    | 'Stallholder'
    | 'ambulant_vendor'
    | 'Wholesaler'
    | 'Corporation';
  stallNumber: string;
  section: string;
  status:
    | 'Active'
    | 'Pending'
    | 'Suspended'
    | 'Approved'
    | 'Under Review'
    | 'Rejected';
  dateRegistered: string;
}

interface Props {
  isCollapsed?: boolean;
}

export default function LGUMarketSystem({ isCollapsed = false }: Props) {
  const [registrations, setRegistrations] =
    useState<BusinessRegistration[]>([
      {
        id: 'REG-2026-001',
        businessPermitNo: 'BP-2026-89231',
        marketName: 'Everest Private Market',
        marketType: 'Private Owned Market',
        firstName: 'Juan',
        lastName: 'Dela Cruz',
        entityType: 'Stallholder',
        stallNumber: 'Block 1, Stall 4',
        section: 'Fish & Seafood',
        status: 'Active',
        dateRegistered: '2026-01-15',
      },
      {
        id: 'REG-2026-002',
        businessPermitNo: 'BP-2026-44120',
        marketName: 'Central Public Talipapa',
        marketType: 'Private Talipapa',
        firstName: 'Maria',
        lastName: 'Santos',
        entityType: 'Stallholder',
        stallNumber: 'Row 3, Stall 12',
        section: 'Vegetables & Produce',
        status: 'Pending',
        dateRegistered: '2026-02-10',
      },
    ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterMarket, setFilterMarket] = useState('All');

  const [formData, setFormData] = useState<
    Omit<BusinessRegistration, 'id' | 'dateRegistered'>
  >({
    businessPermitNo: '',
    marketName: '',
    marketType: 'Private Owned Market',
    firstName: '',
    lastName: '',
    entityType: 'Stallholder',
    stallNumber: '',
    section: '',
    status: 'Active',
  });

  const resetForm = () => {
    setFormData({
      businessPermitNo: '',
      marketName: '',
      marketType: 'Private Owned Market',
      firstName: '',
      lastName: '',
      entityType: 'Stallholder',
      stallNumber: '',
      section: '',
      status: 'Active',
    });
  };

  const handleOpenAddModal = () => {
    setEditingId(null);
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: BusinessRegistration) => {
    setEditingId(item.id);

    setFormData({
      businessPermitNo: item.businessPermitNo,
      marketName: item.marketName,
      marketType: item.marketType,
      firstName: item.firstName,
      lastName: item.lastName,
      entityType: item.entityType,
      stallNumber: item.stallNumber,
      section: item.section,
      status: item.status,
    });

    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId) {
      setRegistrations((prev) =>
        prev.map((item) =>
          item.id === editingId
            ? {
                ...item,
                ...formData,
              }
            : item
        )
      );
    } else {
      const newRecord: BusinessRegistration = {
        id: `REG-2026-${String(
          registrations.length + 1
        ).padStart(3, '0')}`,
        ...formData,
        dateRegistered: new Date()
          .toISOString()
          .split('T')[0],
      };

      setRegistrations((prev) => [newRecord, ...prev]);
    }

    setIsModalOpen(false);
  };

  const filteredRegistrations = useMemo(() => {
    return registrations.filter((item) => {
      const search = searchTerm.toLowerCase().trim();

      const matchesSearch =
        !search ||
        item.firstName.toLowerCase().includes(search) ||
        item.lastName.toLowerCase().includes(search) ||
        item.businessPermitNo.toLowerCase().includes(search) ||
        item.marketName.toLowerCase().includes(search) ||
        item.stallNumber.toLowerCase().includes(search) ||
        item.section.toLowerCase().includes(search);

      const matchesStatus =
        filterStatus === 'All' ||
        item.status === filterStatus;

      const matchesMarket =
        filterMarket === 'All' ||
        item.marketType === filterMarket;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesMarket
      );
    });
  }, [
    registrations,
    searchTerm,
    filterStatus,
    filterMarket,
  ]);

  const totalRegistrations = registrations.length;

  const activeRegistrations = registrations.filter(
    (item) =>
      item.status === 'Active' ||
      item.status === 'Approved'
  ).length;

  const pendingRegistrations = registrations.filter(
    (item) =>
      item.status === 'Pending' ||
      item.status === 'Under Review'
  ).length;

  const suspendedRegistrations = registrations.filter(
    (item) => item.status === 'Suspended'
  ).length;

  const getStatusClass = (
    status: BusinessRegistration['status']
  ) => {
    if (
      status === 'Active' ||
      status === 'Approved'
    ) {
      return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900';
    }

    if (
      status === 'Pending' ||
      status === 'Under Review'
    ) {
      return 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900';
    }

    return 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900';
  };

  return (
    <div
      style={{
        marginLeft: isCollapsed ? '80px' : '256px',
        width: isCollapsed ? 'calc(100% - 80px)' : 'calc(100% - 256px)',
      }}
      className="min-h-screen bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex transition-all duration-300 box-border"
    >
      {/* =========================================================
          SIDEBAR
      ========================================================== */}
      <aside
        style={{ width: isCollapsed ? '80px' : '256px' }}
        className="hidden lg:flex fixed left-0 top-0 bottom-0 bg-white dark:bg-[#0a132b] border-r border-slate-200 dark:border-[#1c2a47] flex-col z-40 transition-all duration-300"
      >
        {/* Logo */}
        <div className="h-[72px] px-5 border-b border-slate-200 dark:border-[#1c2a47] flex items-center">
          <div className="w-10 h-10 rounded-full bg-blue-600 dark:bg-white flex items-center justify-center mr-3 shrink-0">
            <div className="w-7 h-7 rounded-full border-4 border-white dark:border-blue-600" />
          </div>

          {!isCollapsed && (
            <div>
              <div className="text-[11px] font-bold tracking-wide text-slate-500 dark:text-white">
                TREASURY &amp; REVENUE
              </div>
              <div className="text-sm font-black text-slate-900 dark:text-white">
                GovServe
              </div>
            </div>
          )}
        </div>

        {/* Menu */}
        {!isCollapsed && (
          <div className="p-3">
            <div className="h-9 rounded-lg bg-slate-100 dark:bg-[#182441] border border-slate-200 dark:border-[#293858] flex items-center px-3 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="mr-3 text-base">☰</span>
              MENU
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="px-3 flex-1 overflow-y-auto">
          {!isCollapsed && (
            <div className="px-3 pt-3 pb-2 text-[10px] font-bold tracking-widest text-slate-400 dark:text-slate-500">
              MODULES
            </div>
          )}

          <SidebarItem icon="▦" label="Treasury Dashboard" isCollapsed={isCollapsed} />

          <SidebarItem
            icon="▥"
            label="Real Property Tax Management"
            isCollapsed={isCollapsed}
          />

          <SidebarItem
            icon="▣"
            label="Business Tax & Permit Management"
            isCollapsed={isCollapsed}
          />

          <div className="mt-1">
            <div className="h-11 rounded-lg bg-blue-600 flex items-center px-3 text-white">
              <span className="w-6 text-center mr-2 shrink-0">
                ▤
              </span>

              {!isCollapsed && (
                <>
                  <span className="text-[13px] font-bold flex-1 truncate">
                    Market Management
                  </span>
                  <span className="text-xs">⌃</span>
                </>
              )}
            </div>

            {!isCollapsed && (
              <div className="ml-3 mt-2 border-l border-slate-200 dark:border-[#253452] pl-3">
                <div className="px-3 py-2 text-[11px] text-slate-500">
                  City Market Operations
                </div>

                <div className="rounded-lg bg-blue-600/90 px-3 py-2.5 text-[11px] font-bold text-white">
                  Market Registrations
                </div>

                <div className="px-3 py-2 text-[11px] text-slate-500">
                  Stall Management
                </div>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <div className="px-3 pt-6 pb-2 text-[10px] font-bold tracking-widest text-slate-400 dark:text-slate-500">
              GOVERNANCE
            </div>
          )}

          <SidebarItem
            icon="♟"
            label="User & Access Control"
            isCollapsed={isCollapsed}
          />

          <SidebarItem
            icon="▤"
            label="Audit Trail Management"
            isCollapsed={isCollapsed}
          />

          <SidebarItem
            icon="◔"
            label="Financial Reports"
            isCollapsed={isCollapsed}
          />
        </nav>
      </aside>

      {/* =========================================================
          MAIN APPLICATION
      ========================================================== */}
      <main className="w-full min-h-screen">
        {/* =====================================================
            CONTENT
        ====================================================== */}
        <div className="w-full max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-7 pt-24">
          {/* Page Header */}
          <section className="rounded-2xl border border-slate-200/80 dark:border-[#20304d] bg-white dark:bg-[#0c152c] p-5 lg:p-6 mb-6 shadow-xs">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-500" />

                  <span className="text-[11px] uppercase tracking-wider font-bold text-blue-600 dark:text-blue-400">
                    Municipal Market Operations
                  </span>
                </div>

                <h1 className="text-2xl lg:text-[26px] font-black tracking-tight text-slate-900 dark:text-white">
                  Market Registration Management
                </h1>

                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Vendor Registration, Market Assignment &amp;
                  Permit Monitoring
                </p>
              </div>

              <button
                onClick={handleOpenAddModal}
                className="h-11 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors shadow-lg shadow-blue-600/10 cursor-pointer"
              >
                + Add New Registration
              </button>
            </div>
          </section>

          {/* ===================================================
              STAT CARDS
          ==================================================== */}
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <StatCard
              title="Total Registrations"
              value={totalRegistrations}
              description="Registered market vendors"
              color="blue"
            />

            <StatCard
              title="Active / Approved"
              value={activeRegistrations}
              description="Currently valid registrations"
              color="emerald"
            />

            <StatCard
              title="Pending Review"
              value={pendingRegistrations}
              description="Requires registration review"
              color="amber"
            />

            <StatCard
              title="Suspended"
              value={suspendedRegistrations}
              description="Requires administrative action"
              color="rose"
            />
          </section>

          {/* ===================================================
              DIRECTORY
          ==================================================== */}
          <section className="rounded-2xl border border-slate-200/80 dark:border-[#20304d] bg-white dark:bg-[#0c152c] overflow-hidden shadow-xs">
            {/* Directory Header */}
            <div className="p-5 border-b border-slate-200 dark:border-[#1c2a47]">
              <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">
                    Market Registration Directory
                  </h2>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Master list of registered market
                    businesses and stallholders
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Search permit #, vendor name..."
                    value={searchTerm}
                    onChange={(e) =>
                      setSearchTerm(e.target.value)
                    }
                    className="w-full sm:w-[250px] h-10 rounded-xl bg-slate-50 dark:bg-[#080f22] border border-slate-200 dark:border-[#263654] text-slate-900 dark:text-white px-4 text-xs outline-none placeholder:text-slate-400 focus:border-blue-500 transition-colors"
                  />

                  <select
                    value={filterMarket}
                    onChange={(e) =>
                      setFilterMarket(e.target.value)
                    }
                    className="h-10 rounded-xl bg-slate-50 dark:bg-[#080f22] border border-slate-200 dark:border-[#263654] text-slate-900 dark:text-white px-3 text-xs outline-none cursor-pointer focus:border-blue-500 transition-colors"
                  >
                    <option value="All">
                      All Market Types
                    </option>
                    <option value="Private Owned Market">
                      Private Owned Market
                    </option>
                    <option value="Private Talipapa">
                      Private Talipapa
                    </option>
                    <option value="Public Market">
                      Public Market
                    </option>
                  </select>

                  <select
                    value={filterStatus}
                    onChange={(e) =>
                      setFilterStatus(e.target.value)
                    }
                    className="h-10 rounded-xl bg-slate-50 dark:bg-[#080f22] border border-slate-200 dark:border-[#263654] text-slate-900 dark:text-white px-3 text-xs outline-none cursor-pointer focus:border-blue-500 transition-colors"
                  >
                    <option value="All">
                      All Statuses
                    </option>
                    <option value="Active">Active</option>
                    <option value="Pending">Pending</option>
                    <option value="Approved">
                      Approved
                    </option>
                    <option value="Under Review">
                      Under Review
                    </option>
                    <option value="Suspended">
                      Suspended
                    </option>
                    <option value="Rejected">
                      Rejected
                    </option>
                  </select>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="p-5 pt-0">
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#20304d]">
                <table className="w-full min-w-[1000px] text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-[#050b1d] border-b border-slate-200 dark:border-[#1c2a47] text-slate-600 dark:text-slate-400">
                      <th className="px-4 py-4 text-[10px] font-black tracking-wider uppercase">
                        Permit &amp; ID
                      </th>

                      <th className="px-4 py-4 text-[10px] font-black tracking-wider uppercase">
                        Vendor Name
                      </th>

                      <th className="px-4 py-4 text-[10px] font-black tracking-wider uppercase">
                        Market Details
                      </th>

                      <th className="px-4 py-4 text-[10px] font-black tracking-wider uppercase">
                        Stall / Section
                      </th>

                      <th className="px-4 py-4 text-[10px] font-black tracking-wider uppercase">
                        Status
                      </th>

                      <th className="px-4 py-4 text-[10px] font-black tracking-wider uppercase text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 dark:divide-[#1c2a47] text-slate-700 dark:text-slate-300">
                    {filteredRegistrations.length > 0 ? (
                      filteredRegistrations.map((item) => (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-[#111c36] transition-colors"
                        >
                          {/* Permit */}
                          <td className="px-4 py-5">
                            <div className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              {item.businessPermitNo}
                            </div>

                            <div className="font-mono text-[10px] text-slate-400 dark:text-slate-600 mt-1">
                              {item.id}
                            </div>
                          </td>

                          {/* Vendor */}
                          <td className="px-4 py-5">
                            <div className="text-xs font-bold text-slate-900 dark:text-white">
                              {item.lastName},{' '}
                              {item.firstName}
                            </div>

                            <div className="text-[10px] text-slate-500 mt-1">
                              {item.entityType ===
                              'ambulant_vendor'
                                ? 'Ambulant Vendor'
                                : item.entityType}
                            </div>
                          </td>

                          {/* Market */}
                          <td className="px-4 py-5">
                            <div className="text-xs font-bold text-slate-900 dark:text-white">
                              {item.marketName}
                            </div>

                            <div className="text-[10px] text-slate-500 mt-1">
                              {item.marketType}
                            </div>
                          </td>

                          {/* Stall */}
                          <td className="px-4 py-5">
                            {item.entityType ===
                            'Stallholder' ? (
                              <>
                                <span className="inline-flex px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/10 text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                  {item.stallNumber ||
                                    'No Stall No.'}
                                </span>

                                <div className="text-[10px] text-slate-500 mt-1">
                                  {item.section ||
                                    'General'}
                                </div>
                              </>
                            ) : (
                              <span className="text-[10px] italic text-slate-400 dark:text-slate-600">
                                N/A
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-5">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-bold ${getStatusClass(
                                item.status
                              )}`}
                            >
                              {item.status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-5 text-right">
                            <button
                              onClick={() =>
                                handleOpenEditModal(item)
                              }
                              className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#182441] border border-slate-200 dark:border-[#263654] hover:bg-slate-200 dark:hover:bg-[#223252] text-[10px] font-bold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                            >
                              Review / Edit
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-20 text-center"
                        >
                          <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 dark:bg-[#182441] flex items-center justify-center text-slate-400 dark:text-slate-500 mb-3">
                            ◌
                          </div>

                          <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
                            No registration records found
                          </div>

                          <div className="text-[10px] text-slate-400 dark:text-slate-600 mt-1">
                            Try changing your search or
                            filters.
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* =========================================================
          MODAL
      ========================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl border border-slate-200 dark:border-[#263654] bg-white dark:bg-[#0c152c] shadow-2xl">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 bg-white dark:bg-[#0c152c] border-b border-slate-200 dark:border-[#1c2a47] px-6 py-5 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-blue-600 dark:text-blue-400 font-bold mb-1">
                  Market Registration
                </div>

                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  {editingId
                    ? 'Edit Registration'
                    : 'New Registration'}
                </h2>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#182441] hover:bg-slate-200 dark:hover:bg-[#223252] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              className="p-6 space-y-5 text-xs"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Entity Type">
                  <select
                    value={formData.entityType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        entityType:
                          e.target.value as BusinessRegistration['entityType'],
                      })
                    }
                    className={inputClass}
                  >
                    <option value="Stallholder">
                      Stallholder
                    </option>
                    <option value="ambulant_vendor">
                      Ambulant Vendor
                    </option>
                    <option value="Wholesaler">
                      Wholesaler
                    </option>
                    <option value="Corporation">
                      Corporation / Enterprise
                    </option>
                  </select>
                </FormField>

                <FormField label="Business Permit No.">
                  <input
                    required
                    value={formData.businessPermitNo}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        businessPermitNo:
                          e.target.value,
                      })
                    }
                    className={inputClass}
                    placeholder="BP-2026-00000"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Market Name">
                  <input
                    required
                    value={formData.marketName}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        marketName: e.target.value,
                      })
                    }
                    className={inputClass}
                    placeholder="Everest Private Market"
                  />
                </FormField>

                <FormField label="Market Type">
                  <select
                    value={formData.marketType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        marketType:
                          e.target.value as BusinessRegistration['marketType'],
                      })
                    }
                    className={inputClass}
                  >
                    <option value="Private Owned Market">
                      Private Owned Market
                    </option>
                    <option value="Private Talipapa">
                      Private Talipapa
                    </option>
                    <option value="Public Market">
                      Public Market
                    </option>
                  </select>
                </FormField>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="First Name">
                  <input
                    required
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        firstName: e.target.value,
                      })
                    }
                    className={inputClass}
                    placeholder="Juan"
                  />
                </FormField>

                <FormField label="Last Name">
                  <input
                    required
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        lastName: e.target.value,
                      })
                    }
                    className={inputClass}
                    placeholder="Dela Cruz"
                  />
                </FormField>
              </div>

              {formData.entityType === 'Stallholder' && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/5 p-4">
                  <div className="text-[10px] uppercase tracking-widest font-bold text-emerald-600 dark:text-emerald-400 mb-3">
                    Stall Assignment
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Stall Number">
                      <input
                        value={formData.stallNumber}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            stallNumber:
                              e.target.value,
                          })
                        }
                        className={inputClass}
                        placeholder="Block 1, Stall 4"
                      />
                    </FormField>

                    <FormField label="Section">
                      <input
                        value={formData.section}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            section: e.target.value,
                          })
                        }
                        className={inputClass}
                        placeholder="Fish & Seafood"
                      />
                    </FormField>
                  </div>
                </div>
              )}

              <FormField label="Status">
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status:
                        e.target.value as BusinessRegistration['status'],
                    })
                  }
                  className={inputClass}
                >
                  <option value="Active">Active</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">
                    Approved
                  </option>
                  <option value="Under Review">
                    Under Review
                  </option>
                  <option value="Suspended">
                    Suspended
                  </option>
                  <option value="Rejected">
                    Rejected
                  </option>
                </select>
              </FormField>

              {/* Footer */}
              <div className="flex justify-end gap-3 pt-5 border-t border-slate-100 dark:border-[#1c2a47]">
                <button
                  type="button"
                  onClick={() =>
                    setIsModalOpen(false)
                  }
                  className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-[#182441] border border-slate-200 dark:border-[#263654] hover:bg-slate-200 dark:hover:bg-[#223252] text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-lg shadow-blue-600/10 cursor-pointer"
                >
                  {editingId
                    ? 'Save Changes'
                    : 'Confirm Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* =============================================================
   SIDEBAR ITEM
============================================================= */

function SidebarItem({
  icon,
  label,
  isCollapsed,
}: {
  icon: string;
  label: string;
  isCollapsed: boolean;
}) {
  return (
    <div
      className="h-11 rounded-lg px-3 flex items-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#111c36] transition-colors cursor-pointer"
      title={isCollapsed ? label : undefined}
    >
      <span className="w-6 text-center mr-2 text-sm shrink-0">
        {icon}
      </span>

      {!isCollapsed && (
        <span className="text-[12px] font-semibold truncate">
          {label}
        </span>
      )}
    </div>
  );
}

/* =============================================================
   STAT CARD
============================================================= */

function StatCard({
  title,
  value,
  description,
  color,
}: {
  title: string;
  value: number;
  description: string;
  color: 'blue' | 'emerald' | 'amber' | 'rose';
}) {
  const colors = {
    blue: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
    emerald:
      'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
    rose: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400',
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-[#20304d] bg-white dark:bg-[#0c152c] p-5 shadow-xs">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
          {title}
        </span>

        <span
          className={`w-4 h-4 rounded-full ${colors[color]}`}
        />
      </div>

      <div className="text-2xl font-black mt-3 text-slate-900 dark:text-white">
        {value}
      </div>

      <div className="text-[10px] text-slate-400 dark:text-slate-600 mt-2">
        {description}
      </div>
    </div>
  );
}

/* =============================================================
   FORM FIELD
============================================================= */

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 mb-2">
        {label}
      </label>

      {children}
    </div>
  );
}

const inputClass =
  'w-full h-11 rounded-xl bg-slate-50 dark:bg-[#080f22] border border-slate-200 dark:border-[#263654] px-3 text-sm text-slate-900 dark:text-white outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-colors';