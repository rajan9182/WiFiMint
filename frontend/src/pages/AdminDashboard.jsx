import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import {
    Users, Wifi, CreditCard, Activity,
    ShieldCheck, ShieldAlert, Plus, Trash2,
    CheckCircle2, XCircle, Clock, Info, Smartphone, History,
    FileText, LayoutDashboard, ChevronRight, Settings, TrendingUp, Globe
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const AdminDashboard = () => {
    const location = useLocation();
    const [activeTab, setActiveTab] = useState('overview');
    const [stats, setStats] = useState([
        { title: 'Total Revenue', value: '₹0', icon: Activity, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        { title: 'Subscribed Users', value: '0', icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        { title: 'Pending Approval', value: '0', icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
        { title: 'Total Devices', value: '0', icon: Smartphone, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
        { title: 'Blocked Users', value: '0', icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-500/10' },
        { title: 'Active Plans', value: '0', icon: CreditCard, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    ]);
    const [liveUsers, setLiveUsers] = useState([]);
    const [plans, setPlans] = useState([]);
    const [activeSubs, setActiveSubs] = useState([]);
    const [allSubs, setAllSubs] = useState([]);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [revenueData, setRevenueData] = useState([]);
    const [systemStatus, setSystemStatus] = useState(null);
    const [showPlanModal, setShowPlanModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(null);
    const [newPlan, setNewPlan] = useState({ name: '', duration_minutes: 60, price: 0, data_limit_mb: 0 });
    const [notifications, setNotifications] = useState([]);
    const [passwords, setPasswords] = useState({ old: '', new: '', confirm: '' });
    const [isUpdatingPass, setIsUpdatingPass] = useState(false);
    const [duplicateAlert, setDuplicateAlert] = useState(null);

    const addNotification = (message, type = 'info') => {
        const id = Date.now();
        setNotifications(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 4000);
    };

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        if (tab) setActiveTab(tab);
    }, [location]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('admin_token');
            const headers = { 'Authorization': `Bearer ${token}` };

            const [statsRes, liveRes, plansRes, subsRes, allSubsRes, reqRes, revRes, sysRes] = await Promise.all([
                fetch('/api/admin/stats', { headers }),
                fetch('/api/devices'),
                fetch('/api/admin/plans', { headers }),
                fetch('/api/admin/subscriptions', { headers }),
                fetch('/api/admin/all-subscriptions', { headers }),
                fetch('/api/admin/pending-requests', { headers }),
                fetch('/api/admin/revenue-stats', { headers }),
                fetch('/api/admin/system-status', { headers })
            ]);

            if (statsRes.ok) {
                const statsData = await statsRes.json();
                setStats([
                    { title: 'Total Revenue', value: `₹${statsData.total_revenue || 0}`, icon: Activity, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    { title: 'Subscribed Users', value: statsData.active_users || 0, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                    { title: 'Pending Approval', value: statsData.pending_requests || 0, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                    { title: 'Total Devices', value: statsData.total_devices || 0, icon: Smartphone, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                    { title: 'Blocked Users', value: statsData.blocked_devices || 0, icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-500/10' },
                    { title: 'Active Plans', value: statsData.total_plans || 0, icon: CreditCard, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                ]);
            }

            if (liveRes.ok) {
                const data = await liveRes.json();
                setLiveUsers(Array.isArray(data) ? data : []);
            }
            if (plansRes.ok) {
                const data = await plansRes.json();
                setPlans(Array.isArray(data) ? data : []);
            }
            if (subsRes.ok) {
                const data = await subsRes.json();
                setActiveSubs(Array.isArray(data) ? data : []);
            }
            if (allSubsRes.ok) {
                const data = await allSubsRes.json();
                setAllSubs(Array.isArray(data) ? data : []);
            }
            if (reqRes.ok) {
                const data = await reqRes.json();
                setPendingRequests(Array.isArray(data) ? data : []);
            }
            if (sysRes.ok) {
                const data = await sysRes.json();
                setSystemStatus(data);
            }
            if (revRes.ok) {
                const data = await revRes.json();
                if (Array.isArray(data)) {
                    setRevenueData(data.filter(d => d && d.date).map(d => ({
                        date: d.date.split('-').slice(1).join('/'),
                        amount: d.total || 0
                    })));
                } else {
                    setRevenueData([]);
                }
            }

        } catch (error) {
            console.error('Data poll failed', error);
        }
    };

    const handleCreatePlan = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('admin_token');
            const res = await fetch('/api/admin/plans', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: newPlan.name,
                    duration_minutes: parseInt(newPlan.duration_minutes),
                    price: parseFloat(newPlan.price),
                    data_limit_mb: 0
                })
            });
            if (res.ok) {
                setShowPlanModal(false);
                addNotification("Plan created successfully", "success");
                fetchData();
            }
        } catch (error) { addNotification("Failed to create plan", "error") }
    };

    const handleDeletePlan = async (id) => {
        if (!window.confirm("Delete this plan? Users currently using it won't be affected, but no new clients can buy it.")) return;
        try {
            const token = localStorage.getItem('admin_token');
            const res = await fetch(`/api/admin/plans/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                addNotification("Plan deleted", "info");
                fetchData();
            }
        } catch (error) { addNotification("Failed to delete plan", "error") }
    };

    const handleAssignPlan = async (mac, planId) => {
        try {
            const token = localStorage.getItem('admin_token');
            const res = await fetch('/api/admin/assign-plan', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ mac_address: mac, plan_id: planId })
            });
            if (res.ok) {
                setShowAssignModal(null);
                addNotification("Plan assigned successfully", "success");
                fetchData();
            }
        } catch (error) { addNotification("Assignment failed", "error") }
    };

    const handleApprove = async (subId, force = false) => {
        if (!force) {
            const currentReq = pendingRequests.find(r => r.id === subId);
            const currentTxnId = (currentReq?.transaction_id || '').trim().toUpperCase();

            if (currentTxnId && currentTxnId !== '----') {
                const duplicate = allSubs.find(s => {
                    const historicalTxnId = (s.transaction_id || '').trim().toUpperCase();
                    return historicalTxnId === currentTxnId && (s.status === 'active' || s.status === 'expired');
                });

                if (duplicate) {
                    setDuplicateAlert({
                        id: subId,
                        txnId: currentReq.transaction_id,
                        oldMobile: duplicate.mobile || 'Unknown',
                        oldMac: duplicate.mac_address,
                        oldPlan: duplicate.plan_name,
                        oldDate: duplicate.start_time
                    });
                    return;
                }
            }
        }

        setDuplicateAlert(null); // Clear modal if it was open
        try {
            const token = localStorage.getItem('admin_token');
            const res = await fetch('/api/admin/approve-subscription', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ subscription_id: subId })
            });
            if (res.ok) {
                addNotification("Request Approved!", "success");
                fetchData();
            }
        } catch (error) { addNotification("Approval failed", "error") }
    };

    const handleReject = async (subId) => {
        try {
            const token = localStorage.getItem('admin_token');
            const res = await fetch('/api/admin/reject-subscription', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ subscription_id: subId })
            });
            if (res.ok) {
                addNotification("Request Rejected", "info");
                fetchData();
            }
        } catch (error) { addNotification("Rejection failed", "error") }
    };

    function renderPricingPlans() {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="lg:col-span-1 space-y-6">
                    <div className="glass p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <CreditCard className="text-purple-400" size={20} /> Pricing Models
                            </h2>
                            <button
                                onClick={() => setShowPlanModal(true)}
                                className="p-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors"
                            >
                                <Plus size={18} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            {(plans || []).map((plan) => (
                                <div key={plan.id} className="p-4 bg-slate-900/50 rounded-xl border border-white/5 group hover:border-purple-500/30 transition-all relative">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="font-bold text-white">{plan.name}</span>
                                        <div className="flex flex-col items-end">
                                            <span className="text-green-400 font-bold">₹{plan.price}</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-slate-500">
                                        <span className="flex items-center gap-1"><Clock size={12} /> {plan.duration_minutes}m Access</span>
                                        <button
                                            onClick={() => handleDeletePlan(plan.id)}
                                            className="opacity-0 group-hover:opacity-100 p-1 bg-red-500/10 text-red-400 rounded hover:bg-red-500/20 transition-all"
                                            title="Delete Plan"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2">
                    <div className="glass p-6 h-full min-h-[400px]">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <ShieldCheck className="text-indigo-400" size={20} /> Deployment Overview
                        </h2>
                        {Array.isArray(allSubs) && allSubs.length > 0 ? (
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={(plans || []).map(p => ({
                                        name: p.name,
                                        count: allSubs.filter(s => s && s.plan_id === p.id).length
                                    }))}>
                                        <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                                        <YAxis stroke="#64748b" fontSize={10} />
                                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                                        <Area type="monotone" dataKey="count" stroke="#818cf8" fill="#818cf822" />
                                    </AreaChart>
                                </ResponsiveContainer>
                                <p className="text-center text-xs text-slate-500 mt-4 font-bold uppercase tracking-widest">Plan Selection Frequency</p>
                            </div>
                        ) : (
                            <div className="h-64 flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-white/5 rounded-2xl">
                                <LayoutDashboard size={48} className="mb-4 opacity-20" />
                                <p>Marketplace metrics appearing shortly</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    const handleRevoke = async (subId) => {
        if (!window.confirm("Are you sure you want to revoke this subscription? The device will be blocked immediately.")) return;
        try {
            const token = localStorage.getItem('admin_token');
            const res = await fetch('/api/admin/revoke-subscription', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ subscription_id: subId })
            });
            if (res.ok) {
                addNotification("Subscription Revoked", "success");
                fetchData();
            } else {
                addNotification("Revocation failed", "error");
            }
        } catch (error) { addNotification("Revocation error", "error") }
    };

    const handleAction = async (mac, action, ip = null) => {
        try {
            const res = await fetch(`/api/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mac, ip })
            });
            if (res.ok) {
                addNotification(`Success: Device ${action}ed`, 'success');
                fetchData();
            }
        } catch (error) { addNotification("Action failed", "error") }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (passwords.new !== passwords.confirm) {
            addNotification("Passwords do not match", "error");
            return;
        }
        setIsUpdatingPass(true);
        try {
            const token = localStorage.getItem('admin_token');
            const res = await fetch('/api/admin/change-password', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    old_password: passwords.old,
                    new_password: passwords.new
                })
            });
            if (res.ok) {
                addNotification("Password changed successfully", "success");
                setPasswords({ old: '', new: '', confirm: '' });
            } else {
                const data = await res.json();
                addNotification(data.error || "Failed to change password", "error");
            }
        } catch (error) { addNotification("System error", "error") }
        finally { setIsUpdatingPass(false) }
    };

    const handleFlushData = async () => {
        if (!window.confirm("CRITICAL: This will permanently delete all device logs and subscription history! System settings will remain. Proceed?")) return;
        try {
            const token = localStorage.getItem('admin_token');
            const res = await fetch('/api/admin/flush-data', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                addNotification("All data flushed successfully", "success");
                fetchData();
            }
        } catch (error) { addNotification("Flush failed", "error") }
    };

    const renderOverview = () => (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
                {stats.map((stat, i) => (
                    <motion.div
                        key={i}
                        whileHover={{ y: -4 }}
                        className="glass p-5 group transition-all"
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div className={`p-2 rounded-lg ${stat.bg} group-hover:scale-110 transition-transform`}>
                                <stat.icon className={stat.color} size={20} />
                            </div>
                        </div>
                        <h3 className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{stat.title}</h3>
                        <p className="text-2xl font-bold mt-1 text-white">{stat.value}</p>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="glass p-8 h-[380px]">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <TrendingUp size={20} className="text-indigo-400" /> Traffic Analytics
                            </h3>
                        </div>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={[
                                    { name: '00:00', users: 2 }, { name: '04:00', users: 1 },
                                    { name: '08:00', users: 5 }, { name: '12:00', users: 12 },
                                    { name: '16:00', users: 8 }, { name: '20:00', users: 15 },
                                    { name: '23:59', users: 9 }
                                ]}>
                                    <defs>
                                        <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                    />
                                    <Area type="monotone" dataKey="users" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="glass p-8 h-[380px]">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <Activity size={20} className="text-emerald-400" /> Revenue Tracking
                            </h3>
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded font-bold uppercase tracking-widest">7 Day Trend</span>
                        </div>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={revenueData.length > 0 ? revenueData : [{ date: 'Wait', amount: 0 }]}>
                                    <defs>
                                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                    />
                                    <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-1">
                    <div className="glass p-8 h-full">
                        <h3 className="text-lg font-bold mb-8 flex items-center gap-2">
                            <ShieldAlert size={20} className="text-indigo-400" /> Network Health
                        </h3>
                        <div className="space-y-6">
                            <div className="flex justify-between items-center p-4 bg-white/5 rounded-2xl">
                                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Interface</span>
                                <span className="text-sm font-mono text-white font-bold">{systemStatus?.interface || '---'}</span>
                            </div>
                            <div className="flex justify-between items-center p-4 bg-white/5 rounded-2xl">
                                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Gateway IP</span>
                                <span className="text-sm font-mono text-white font-bold">{systemStatus?.host_ip || '---'}</span>
                            </div>

                            {systemStatus?.host_ip?.startsWith('192.168.') ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="p-5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex gap-4"
                                >
                                    <Globe size={24} className="text-indigo-400 shrink-0" />
                                    <div>
                                        <p className="text-indigo-400 font-black text-xs uppercase mb-1 tracking-widest">LAN Mode Active</p>
                                        <p className="text-[11px] leading-relaxed text-indigo-100/70 font-medium">
                                            Currently tracking devices on your home network. Ensure clients use the laptop as their gateway.
                                        </p>
                                    </div>
                                </motion.div>
                            ) : (
                                <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex gap-4">
                                    <Wifi size={24} className="text-emerald-400 shrink-0" />
                                    <div>
                                        <p className="text-emerald-400 font-black text-xs uppercase mb-1 tracking-widest">Hotspot Mode</p>
                                        <p className="text-[11px] leading-relaxed text-emerald-100/70 font-medium">
                                            Serving clients directly via built-in Wi-Fi hotspot. Redirection is optimal.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="p-5 bg-slate-500/5 border border-white/5 rounded-2xl flex gap-4">
                                <Info size={24} className="text-slate-400 shrink-0" />
                                <div>
                                    <p className="text-slate-400 font-black text-xs uppercase mb-1 tracking-widest">System Info</p>
                                    <p className="text-[11px] leading-relaxed text-slate-400 font-medium">
                                        Interface: {systemStatus?.interface} | MAC: {systemStatus?.host_mac}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderUsers = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="glass overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Wifi className="text-blue-400" size={20} /> Live Network Devices
                    </h2>
                    <span className="text-xs bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full border border-blue-500/20">
                        {liveUsers.length} Active
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-slate-400 text-sm uppercase tracking-wider border-b border-white/5">
                                <th className="p-6 font-semibold">Client Identity</th>
                                <th className="p-6 font-semibold">Connectivity</th>
                                <th className="p-6 font-semibold">Subscription</th>
                                <th className="p-6 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {(!Array.isArray(liveUsers) || liveUsers.length === 0) ? (
                                <tr>
                                    <td colSpan="4" className="p-12 text-center text-slate-500 italic">No devices currently probing the gateway</td>
                                </tr>
                            ) : (
                                liveUsers.map((user, i) => {
                                    const sub = Array.isArray(activeSubs) ? activeSubs.find(s => s.mac_address === user.mac) : null;
                                    return (
                                        <tr key={i} className="group hover:bg-white/[0.02] transition-colors">
                                            <td className="p-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-indigo-400 group-hover:scale-110 transition-transform">
                                                        {user.ip.split('.').pop()}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-white leading-none mb-1">{user.name || 'Generic Client'}</p>
                                                        <p className="text-xs font-mono text-slate-500">{user.mac}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-6">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-sm font-mono text-slate-300">{user.ip}</span>
                                                    <div className="flex items-center gap-1.5">
                                                        <div className={`w-1.5 h-1.5 rounded-full ${user.is_blocked ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`}></div>
                                                        <span className={`text-[10px] font-bold uppercase tracking-wider ${user.is_blocked ? 'text-red-500' : 'text-green-500'}`}>{user.is_blocked ? 'Blocked' : 'Online'}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-6">
                                                {sub ? (
                                                    <div className="flex items-center gap-2">
                                                        <CheckCircle2 size={16} className="text-green-500" />
                                                        <div>
                                                            <p className="text-sm font-bold text-white">{sub.plan_name}</p>
                                                            <p className="text-[10px] text-slate-500 uppercase">Ends {new Date(sub.end_time).toLocaleTimeString()}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => handleRevoke(sub.id)}
                                                            className="ml-2 p-1 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                                                            title="Revoke Access"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setShowAssignModal(user.mac)}
                                                        className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-bold disabled:opacity-50"
                                                        disabled={user.is_blocked}
                                                    >
                                                        <Plus size={14} /> Assign Plan
                                                    </button>
                                                )}
                                            </td>
                                            <td className="p-6 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleAction(user.mac, user.is_blocked ? 'unblock' : 'block', user.ip)}
                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all border font-bold text-xs ${user.is_blocked ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}
                                                    >
                                                        {user.is_blocked ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
                                                        <span>{user.is_blocked ? 'UNBLOCK' : 'BLOCK'}</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderRequests = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-bold">Pending Approval Requests</h2>
            <div className="grid grid-cols-1 gap-4">
                {Array.isArray(pendingRequests) && pendingRequests.map((req) => (
                    <div key={req.id} className="glass p-6 flex flex-col md:flex-row justify-between items-center gap-4 group hover:border-indigo-500/30 transition-all">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                <Smartphone size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-lg text-white">{req.device_name || 'New User'}</h4>
                                <p className="text-xs text-slate-500 font-mono tracking-tight">{req.mac_address}</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-6">
                            <div className="text-center">
                                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Plan</p>
                                <p className="font-bold text-slate-200 text-sm">{req.plan_name}</p>
                            </div>

                            <div className="text-center border-l border-white/5 pl-6">
                                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Method</p>
                                <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-[10px] font-black rounded uppercase">
                                    {req.payment_method || 'Unknown'}
                                </span>
                            </div>

                            <div className="text-center border-l border-white/5 pl-6">
                                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Paid / Price</p>
                                <p className="font-bold text-emerald-400 text-sm">₹{req.amount_paid} <span className="text-slate-500 text-[10px]">/ ₹{req.price}</span></p>
                            </div>

                            <div className="text-center border-l border-white/5 pl-6">
                                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Txn ID</p>
                                <p className="font-mono font-bold text-indigo-400 text-sm">#{req.transaction_id || '----'}</p>
                            </div>
                        </div>

                        <div className="flex gap-3 w-full md:w-auto">
                            <button
                                onClick={() => handleReject(req.id)}
                                className="flex-1 md:flex-none px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl font-bold transition-all border border-red-500/20"
                            >
                                Reject
                            </button>
                            <button
                                onClick={() => handleApprove(req.id)}
                                className="flex-1 md:flex-none px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                            >
                                Approve Access
                            </button>
                        </div>
                    </div>
                ))}
                {pendingRequests.length === 0 && (
                    <div className="text-center py-20 bg-slate-900/20 border border-white/5 rounded-3xl">
                        <ShieldCheck size={48} className="text-slate-800 mx-auto mb-4" />
                        <p className="text-slate-500 font-medium">No pending requests at the moment.</p>
                    </div>
                )}
            </div>
        </div>
    );


    const renderReports = () => {
        const approvedSubs = Array.isArray(allSubs) ? allSubs.filter(s => s.status === 'active' || s.status === 'expired') : [];
        const totalEarnings = approvedSubs.reduce((acc, sub) => acc + (sub.price || 0), 0);
        const approvedCount = approvedSubs.length;

        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="glass p-6 border-l-4 border-emerald-500">
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Total Lifetime Earnings</p>
                        <p className="text-3xl font-bold text-emerald-400">₹{totalEarnings.toFixed(2)}</p>
                        <p className="text-[10px] text-slate-500 mt-2">From {approvedCount} successfully approved subscriptions</p>
                    </div>
                </div>

                <div className="glass overflow-hidden shadow-2xl">
                    <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <History className="text-indigo-400" size={20} /> Subscription History
                        </h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-white/5 border-b border-white/5">
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Customer MAC</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Plan</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Timestamp</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Revenue</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {Array.isArray(allSubs) && allSubs.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="p-12 text-center text-slate-500 italic">Financial data waiting to be generated...</td>
                                    </tr>
                                ) : (
                                    allSubs.map((sub) => (
                                        <tr key={sub.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 font-mono text-xs text-slate-300">{sub.mac_address}</td>
                                            <td className="px-6 py-4 font-bold text-sm text-white">{sub.plan_name}</td>
                                            <td className="px-6 py-4 text-[10px] text-slate-500 uppercase">
                                                {sub.start_time && sub.start_time !== '0001-01-01T00:00:00Z'
                                                    ? new Date(sub.start_time).toLocaleString()
                                                    : 'Not Started'}
                                            </td>
                                            <td className="px-6 py-4 font-bold text-emerald-400">₹{sub.price || '---'}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end items-center gap-3">
                                                    <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-md ${sub.status === 'active' ? 'bg-indigo-500/10 text-indigo-400' :
                                                        sub.status === 'expired' ? 'bg-slate-500/10 text-slate-500' :
                                                            sub.status === 'pending' ? 'bg-amber-500/10 text-amber-500' :
                                                                'bg-red-500/10 text-red-500'
                                                        }`}>{sub.status}</span>
                                                    {sub.status === 'active' && (
                                                        <button
                                                            onClick={() => handleRevoke(sub.id)}
                                                            className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/20 transition-all"
                                                            title="Revoke Access"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const renderSettings = () => (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="glass p-8 space-y-8">
                <div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Admin Profile</h3>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Update your security credentials</p>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Current Password</label>
                        <input
                            type="password"
                            className="input-field m-0"
                            value={passwords.old}
                            onChange={e => setPasswords({ ...passwords, old: e.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">New Secure Password</label>
                        <input
                            type="password"
                            className="input-field m-0"
                            value={passwords.new}
                            onChange={e => setPasswords({ ...passwords, new: e.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Confirm New Password</label>
                        <input
                            type="password"
                            className="input-field m-0"
                            value={passwords.confirm}
                            onChange={e => setPasswords({ ...passwords, confirm: e.target.value })}
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isUpdatingPass}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-600/20 uppercase tracking-widest text-xs transition-all disabled:opacity-50"
                    >
                        {isUpdatingPass ? 'Updating...' : 'Update Security Key'}
                    </button>
                </form>
            </div>

            <div className="glass p-8 border-red-500/10">
                <div className="flex justify-between items-start mb-10">
                    <div>
                        <h3 className="text-2xl font-black text-red-400 uppercase tracking-tight mb-2">Danger Zone</h3>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Irreversible system actions</p>
                    </div>
                    <ShieldAlert size={32} className="text-red-500/20" />
                </div>

                <div className="p-6 bg-red-500/5 border border-red-500/10 rounded-3xl space-y-4">
                    <h4 className="font-bold text-red-400 flex items-center gap-2">
                        <Trash2 size={18} /> Flush System Activity
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                        This action will clear all connected device history, subscription logs, and revenue metrics.
                        Your plans and admin account will remain intact. This is recommended before starting a fresh session.
                    </p>
                    <button
                        onClick={handleFlushData}
                        className="w-full mt-4 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white font-black py-4 rounded-2xl border border-red-500/20 transition-all uppercase tracking-widest text-xs"
                    >
                        Execute Data Flush
                    </button>
                </div>

                <div className="mt-8 p-6 bg-white/5 border border-white/5 rounded-3xl">
                    <h4 className="font-bold text-white flex items-center gap-2 mb-4">
                        <Settings size={18} className="text-indigo-400" /> Environment Status
                    </h4>
                    <div className="space-y-3">
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                            <span className="text-slate-500">Node Engine</span>
                            <span className="text-indigo-400">v20.11.0</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                            <span className="text-slate-500">Go Backend</span>
                            <span className="text-indigo-400">v1.22.x</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                            <span className="text-slate-500">Storage Engine</span>
                            <span className="text-indigo-400">SQLite (WAL)</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const handleLogout = () => {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_role');
        window.location.href = '/admin';
    };

    return (
        <div className="flex h-screen bg-slate-950 font-sans selection:bg-indigo-500 selection:text-white overflow-hidden uppercase-none">
            <Sidebar activeTab={activeTab} onLogout={handleLogout} />

            <main className="flex-1 overflow-y-auto p-4 lg:p-10 relative">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none"></div>

                <div className="relative z-10 max-w-6xl mx-auto space-y-10">
                    <header className="flex justify-between items-end border-b border-white/5 pb-10">
                        <div>
                            {/* <p className="text-indigo-400 font-bold text-[10px] uppercase tracking-[0.3em] mb-2">Network Control Center</p> */}
                            <h1 className="text-5xl font-black text-white capitalize tracking-tighter">{activeTab}</h1>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Gateway Pulse Active</span>
                        </div>
                    </header>

                    {activeTab === 'overview' && renderOverview()}
                    {activeTab === 'users' && renderUsers()}
                    {activeTab === 'plans' && renderPricingPlans()}
                    {activeTab === 'requests' && renderRequests()}
                    {activeTab === 'reports' && renderReports()}
                    {activeTab === 'settings' && renderSettings()}

                    <footer className="mt-12 pb-8 text-center w-full">
                        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-700 bg-gradient-to-r from-transparent via-slate-800/10 to-transparent py-4">
                            Designed & Developed by <span className="text-indigo-500/50">Rajan Goswami</span>
                        </p>
                    </footer>
                </div>
            </main>

            {/* Modals */}
            <AnimatePresence>
                {showPlanModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowPlanModal(false)} className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="glass p-8 w-full max-w-md relative z-10"
                        >
                            <h3 className="text-2xl font-bold mb-6 text-white text-center">Architect New Plan</h3>
                            <form onSubmit={handleCreatePlan} className="space-y-5">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Plan Display Name</label>
                                    <input className="input-field m-0" placeholder="e.g. Ultra 10GB" value={newPlan.name} onChange={e => setNewPlan({ ...newPlan, name: e.target.value })} required />
                                </div>
                                <div className="grid grid-cols-2 gap-5">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Time (Mins)</label>
                                        <input type="number" className="input-field m-0" value={newPlan.duration_minutes} onChange={e => setNewPlan({ ...newPlan, duration_minutes: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Price (₹)</label>
                                        <input type="number" className="input-field m-0" value={newPlan.price} onChange={e => setNewPlan({ ...newPlan, price: e.target.value })} />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-4 pt-4">
                                    <button type="submit" className="w-full bg-indigo-600 py-4 rounded-xl font-bold uppercase tracking-widest text-sm">Deploy Plan</button>
                                    <button type="button" onClick={() => setShowPlanModal(false)} className="text-slate-500 text-xs font-bold hover:text-white transition-colors uppercase tracking-widest text-center">Cancel</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}

                {showAssignModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAssignModal(null)} className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" />
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 20, opacity: 0 }}
                            className="glass p-8 w-full max-w-lg relative z-10 overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl"></div>
                            <h3 className="text-2xl font-bold mb-2 text-white">Select Access Voucher</h3>
                            <p className="text-slate-400 text-sm mb-8 italic">Assigning network access to client MAC: <span className="text-indigo-400 font-mono">{showAssignModal}</span></p>

                            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {plans.map(plan => (
                                    <button
                                        key={plan.id}
                                        onClick={() => handleAssignPlan(showAssignModal, plan.id)}
                                        className="w-full text-left p-5 group rounded-2xl bg-white/5 border border-white/5 hover:border-indigo-500/50 hover:bg-white/10 transition-all flex justify-between items-center"
                                    >
                                        <div className="flex gap-4 items-center">
                                            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center group-hover:bg-indigo-500 transition-colors">
                                                <CreditCard size={20} className="text-slate-400 group-hover:text-white" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-white text-lg">{plan.name}</p>
                                                <p className="text-xs text-slate-500 uppercase tracking-widest">{plan.duration_minutes} Minutes Duration</p>
                                            </div>
                                        </div>
                                        <span className="text-2xl font-bold text-green-400">₹{plan.price}</span>
                                    </button>
                                ))}
                            </div>
                            <button onClick={() => setShowAssignModal(null)} className="w-full mt-8 text-slate-500 text-sm font-bold hover:text-white transition-colors uppercase tracking-widest">Withdraw Selection</button>
                        </motion.div>
                    </div>
                )}

                {duplicateAlert && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDuplicateAlert(null)} className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl" />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="glass border-red-500/30 p-8 w-full max-w-md relative z-10"
                        >
                            <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_rgba(239,68,68,0.2)]">
                                <ShieldAlert size={40} className="text-red-500 animate-pulse" />
                            </div>

                            <h3 className="text-2xl font-black mb-2 text-white text-center uppercase tracking-tighter">Security Alert!</h3>
                            <p className="text-red-400 text-center font-black text-[10px] uppercase tracking-[0.2em] mb-6">Duplicate Transaction Detected</p>

                            <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-6 mb-8 space-y-4 text-center">
                                <p className="text-sm text-slate-200 font-bold leading-relaxed italic mb-3">
                                    "Is transaction ko reject kro, user ne already ye transaction ID use ki hai aur isse payment approved ho chuki hai."
                                </p>
                                <p className="text-xs text-red-400 font-medium leading-relaxed opacity-80 border-t border-red-500/10 pt-3">
                                    Please reject this transaction, as the user has already used this transaction ID and the payment has been approved.
                                </p>

                                <div className="pt-4 border-t border-red-500/10 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">Previous User</span>
                                        <span className="text-sm font-bold text-indigo-400">{duplicateAlert.oldMobile}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">Plan Used</span>
                                        <span className="text-xs font-bold text-white">{duplicateAlert.oldPlan}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">Used On</span>
                                        <span className="text-[10px] font-mono text-slate-400">
                                            {new Date(duplicateAlert.oldDate).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">TRX ID</span>
                                        <span className="text-sm font-black text-red-500">#{duplicateAlert.txnId}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => {
                                        handleReject(duplicateAlert.id);
                                        setDuplicateAlert(null);
                                    }}
                                    className="bg-red-600 hover:bg-red-500 text-white py-4 rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-red-600/20 transition-all active:scale-95"
                                >
                                    Reject Request
                                </button>
                                <button
                                    onClick={() => handleApprove(duplicateAlert.id, true)}
                                    className="bg-slate-800 hover:bg-slate-700 text-white py-4 rounded-xl font-bold uppercase tracking-widest text-xs transition-all active:scale-95"
                                >
                                    Approve Anyway
                                </button>
                            </div>

                            <button
                                onClick={() => setDuplicateAlert(null)}
                                className="w-full mt-6 text-slate-500 text-[10px] font-bold hover:text-white transition-colors uppercase tracking-[0.2em]"
                            >
                                Close & Review History
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Notifications */}
            <div className="fixed bottom-8 right-8 z-[100] flex flex-col gap-3">
                <AnimatePresence>
                    {notifications.map(n => (
                        <motion.div
                            key={n.id}
                            initial={{ x: 100, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 100, opacity: 0 }}
                            className={`p-4 rounded-xl glass border ${n.type === 'success' ? 'border-green-500/50 text-green-400' :
                                n.type === 'error' ? 'border-red-500/50 text-red-400' :
                                    'border-indigo-500/50 text-indigo-400'
                                } flex items-center gap-3 shadow-2xl min-w-[300px]`}
                        >
                            <div className={`p-2 rounded-lg ${n.type === 'success' ? 'bg-green-500/10' :
                                n.type === 'error' ? 'bg-red-500/10' :
                                    'bg-indigo-500/10'
                                }`}>
                                {n.type === 'success' ? <CheckCircle2 size={18} /> :
                                    n.type === 'error' ? <ShieldAlert size={18} /> :
                                        <Info size={18} />}
                            </div>
                            <span className="font-bold text-sm">{n.message}</span>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default AdminDashboard;
