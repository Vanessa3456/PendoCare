import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
    Users, School, UserPlus, Trash2, Edit3, CheckCircle,
    XCircle, Search, LayoutDashboard, Plus, Save, X, Clock, LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AdminDashboard = () => {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_name');
        localStorage.removeItem('school_name');
        navigate('/login');
    };
    const [activeTab, setActiveTab] = useState('pending');
    const [pendingRequests, setPendingRequests] = useState([]);
    const [approvedSchools, setApprovedSchools] = useState([]);
    const [counselors, setCounselors] = useState([]);
    const [loading, setLoading] = useState(true);

    // Counselor Form State
    const [isEditingCounselor, setIsEditingCounselor] = useState(false);
    const [currentCounselor, setCurrentCounselor] = useState({
        name: '', email: '', specialty: '', experience_years: '',
        work_days: '', work_hours: '', assigned_school: ''
    });
    const [showCounselorModal, setShowCounselorModal] = useState(false);

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            const [pendingRes, approvedRes, counselorsRes] = await Promise.all([
                api.get('/admin/requests'),
                api.get('/admin/schools/approved'),
                api.get('/admin/counselors')
            ]);

            console.log("Pending Data:", pendingRes.data);
            console.log("Approved Data:", approvedRes.data);
            console.log("Counselors Data:", counselorsRes.data);

            setPendingRequests(pendingRes.data || []);
            setApprovedSchools(approvedRes.data || []);
            setCounselors(counselorsRes.data || []);
        } catch (err) {
            console.error("Error fetching admin data:", err);
            if (err.response) {
                console.error("Status:", err.response.status);
                console.error("Data:", err.response.data);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id) => {
        try {
            const response = await api.post(`/admin/approve/${id}`);
            const { accessCode, emailSent } = response.data;
            alert(emailSent ? `Success! Code ${accessCode} sent.` : `Approved! Code: ${accessCode}`);
            fetchAllData();
        } catch (err) {
            alert("Failed to approve request.");
        }
    };

    const handleReject = async (id) => {
        if (confirm("Reject this request?")) {
            try {
                await api.delete(`/admin/request/${id}`);
                fetchAllData();
            } catch (err) {
                alert("Failed to reject.");
            }
        }
    };

    // Counselor CRUD
    const handleSaveCounselor = async (e) => {
        e.preventDefault();
        try {
            let response;
            if (isEditingCounselor) {
                response = await api.put(`/admin/counselors/${currentCounselor.id}`, currentCounselor);
                alert("Counselor updated successfully!");
            } else {
                response = await api.post('/admin/counselors', currentCounselor);
                const { access_code, emailSent } = response.data;
                const emailStatus = emailSent ? "Email sent successfully!" : "Email failed to send.";
                alert(`✅ Counselor registered successfully!\n\nAccess Code: ${access_code}\n\n${emailStatus}\n\nThe counselor can use this code to access their dashboard.`);
            }
            setShowCounselorModal(false);
            fetchAllData();
            setCurrentCounselor({
                name: '', email: '', specialty: '', experience_years: '',
                work_days: '', work_hours: '', assigned_school: ''
            });
        } catch (err) {
            console.error("Error saving counselor:", err);
            console.error("Error response:", err.response?.data);
            const errorMsg = err.response?.data?.details || err.response?.data?.error || "Failed to save counselor.";
            alert(`Error: ${errorMsg}`);
        }
    };

    const handleDeleteCounselor = async (id) => {
        if (confirm("Delete this counselor?")) {
            try {
                await api.delete(`/admin/counselors/${id}`);
                fetchAllData();
            } catch (err) {
                alert("Failed to delete counselor.");
            }
        }
    };

    const openCounselorModal = (counselor = null) => {
        if (counselor) {
            setIsEditingCounselor(true);
            setCurrentCounselor(counselor);
        } else {
            setIsEditingCounselor(false);
            setCurrentCounselor({
                name: '', email: '', specialty: '', experience_years: '',
                work_days: '', work_hours: '', assigned_school: ''
            });
        }
        setShowCounselorModal(true);
    };

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Sidebar */}
            <div className="w-56 bg-slate-900 text-white flex flex-col p-4 sticky top-0 h-screen">
                <div className="flex items-center gap-2 mb-6 px-2">
                    <div className="w-6 h-6 bg-brand-500 rounded flex items-center justify-center text-white font-bold text-xs">P</div>
                    <span className="text-lg font-black tracking-tight">Pendo Admin</span>
                </div>

                <nav className="space-y-2 flex-1">
                    {[
                        { id: 'pending', label: 'Pending Requests', icon: Clock },
                        { id: 'approved', label: 'Approved Schools', icon: CheckCircle },
                        { id: 'counselors', label: 'Counselors', icon: Users },
                    ].map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === item.id ? 'bg-brand-600 text-white shadow-md shadow-brand-900/40' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }`}
                        >
                            <item.icon size={18} />
                            {item.label}
                        </button>
                    ))}
                </nav>

                <div className="mt-auto pt-4 border-t border-slate-800">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg font-bold text-sm text-red-400 hover:text-red-300 hover:bg-slate-800 transition-all"
                    >
                        <LogOut size={18} />
                        Logout
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-6 overflow-y-auto">
                <header className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-xl font-black text-slate-900 tracking-tight capitalize">{activeTab.replace('-', ' ')}</h1>
                        <p className="text-xs text-slate-500 font-medium">Manage platform access and staff accounts.</p>
                    </div>
                    {activeTab === 'counselors' && (
                        <button
                            onClick={() => openCounselorModal()}
                            className="bg-brand-600 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 shadow-md shadow-brand-100 hover:bg-brand-700 transition-all active:scale-95"
                        >
                            <Plus size={16} /> Add Counselor
                        </button>
                    )}
                </header>

                <div className="bg-white rounded-2xl border border-slate-100 shadow-lg shadow-slate-200/50 overflow-hidden">
                    {loading ? (
                        <div className="p-10 text-center text-slate-400 font-bold text-sm">Loading data...</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50 border-b border-slate-100">
                                    {activeTab === 'counselors' ? (
                                        <tr>
                                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Name</th>
                                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Speciality</th>
                                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</th>
                                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Assigned School</th>
                                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Access Code</th>
                                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                        </tr>
                                    ) : (
                                        <tr>
                                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">School Name</th>
                                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact</th>
                                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</th>
                                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Access Code</th>
                                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                        </tr>
                                    )}
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    <AnimatePresence mode="wait">
                                        {activeTab === 'pending' && pendingRequests.map((r) => (
                                            <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-4 py-3 font-bold text-slate-900 text-sm">{r.school_name}</td>
                                                <td className="px-4 py-3 text-slate-500 font-medium text-xs">{r.contact_person}</td>
                                                <td className="px-4 py-3 text-slate-500 font-medium text-xs">{r.school_email}</td>
                                                <td className="px-4 py-3 text-right space-x-2">
                                                    <button onClick={() => handleReject(r.id)} className="text-red-500 font-bold text-xs hover:text-red-700">Reject</button>
                                                    <button onClick={() => handleApprove(r.id)} className="bg-brand-50 text-brand-600 px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-brand-100">Approve</button>
                                                </td>
                                            </motion.tr>
                                        ))}

                                        {activeTab === 'approved' && approvedSchools.map((r) => (
                                            <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-4 py-3 font-bold text-slate-900 text-sm">{r.school_name}</td>
                                                <td className="px-4 py-3 text-slate-500 font-medium text-xs">{r.contact_person}</td>
                                                <td className="px-4 py-3 text-slate-500 font-medium text-xs">{r.school_email}</td>
                                                <td className="px-4 py-3">
                                                    <span className="bg-brand-50 text-brand-600 px-2 py-1 rounded-lg font-bold text-xs font-mono">{r.access_code}</span>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className="bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-widest">Active</span>
                                                </td>
                                            </motion.tr>
                                        ))}

                                        {activeTab === 'counselors' && counselors.map((c) => (
                                            <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-4 py-3 font-bold text-slate-900 text-sm">{c.name}</td>
                                                <td className="px-4 py-3 text-slate-500 font-medium text-xs">{c.specialty}</td>
                                                <td className="px-4 py-3 text-slate-500 font-medium text-xs">{c.email}</td>
                                                <td className="px-4 py-3 text-slate-500 font-medium text-xs">{c.assigned_school}</td>
                                                <td className="px-4 py-3">
                                                    <span className="bg-brand-50 text-brand-600 px-2 py-1 rounded-lg font-bold text-xs">{c.access_code}</span>
                                                </td>
                                                <td className="px-4 py-3 text-right space-x-3">
                                                    <button onClick={() => openCounselorModal(c)} className="text-brand-600 hover:text-brand-700 transition-colors"><Edit3 size={16} /></button>
                                                    <button onClick={() => handleDeleteCounselor(c.id)} className="text-red-500 hover:text-red-700 transition-colors"><Trash2 size={16} /></button>
                                                </td>
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Counselor Modal */}
            {showCounselorModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden"
                    >
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-lg font-black text-slate-900">{isEditingCounselor ? 'Edit Counselor' : 'Add New Counselor'}</h2>
                            <button onClick={() => setShowCounselorModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSaveCounselor} className="p-6 space-y-3">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Full Name</label>
                                <input
                                    required
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-brand-500 transition-all font-bold text-slate-800 text-sm"
                                    value={currentCounselor.name}
                                    onChange={(e) => setCurrentCounselor({ ...currentCounselor, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Email Address</label>
                                <input
                                    required
                                    type="email"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-brand-500 transition-all font-bold text-slate-800 text-sm"
                                    value={currentCounselor.email}
                                    onChange={(e) => setCurrentCounselor({ ...currentCounselor, email: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Speciality</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-brand-500 transition-all font-bold text-slate-800 text-sm"
                                        value={currentCounselor.specialty || ''}
                                        onChange={(e) => setCurrentCounselor({ ...currentCounselor, specialty: e.target.value })}
                                        placeholder="e.g. Trauma"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Years of Experience</label>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-brand-500 transition-all font-bold text-slate-800 text-sm"
                                        value={currentCounselor.experience_years || ''}
                                        onChange={(e) => setCurrentCounselor({ ...currentCounselor, experience_years: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Free Days</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-brand-500 transition-all font-bold text-slate-800 text-sm"
                                        value={currentCounselor.work_days || ''}
                                        onChange={(e) => setCurrentCounselor({ ...currentCounselor, work_days: e.target.value })}
                                        placeholder="e.g. Mon, Fri"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Time of the Week</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-brand-500 transition-all font-bold text-slate-800 text-sm"
                                        value={currentCounselor.work_hours || ''}
                                        onChange={(e) => setCurrentCounselor({ ...currentCounselor, work_hours: e.target.value })}
                                        placeholder="9am-5pm"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Assigned School</label>
                                <select
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-brand-500 transition-all font-bold text-slate-800 text-sm"
                                    value={currentCounselor.assigned_school || ''}
                                    onChange={(e) => setCurrentCounselor({ ...currentCounselor, assigned_school: e.target.value })}
                                >
                                    <option value="">-- Select --</option>
                                    {approvedSchools.map(school => (
                                        <option key={school.id} value={school.school_name}>
                                            {school.school_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="pt-4">
                                <button type="submit" className="w-full bg-brand-600 text-white py-3 rounded-xl font-bold text-sm shadow-md shadow-brand-100 active:scale-95 transition-all">
                                    {isEditingCounselor ? 'Update' : 'Register'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
