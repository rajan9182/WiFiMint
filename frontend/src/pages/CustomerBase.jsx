import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, ShieldCheck, ShieldAlert, Edit2, Check, X, Search, Clock, Plus, CreditCard } from 'lucide-react';
import Sidebar from '../components/Sidebar';

const CustomerBase = () => {
    const [customers, setCustomers] = useState([]);
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState(null); // mac address of being edited
    const [editName, setEditName] = useState('');
    const [plans, setPlans] = useState([]);
    const [showAssignModal, setShowAssignModal] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('admin_token');
            const [custRes, plansRes] = await Promise.all([
                fetch('/api/admin/customers', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('/api/admin/plans', { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            setCustomers(await custRes.json() || []);
            setPlans(await plansRes.json() || []);
        } catch (err) {
            console.error('Failed to fetch data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleUpdateName = async (mac) => {
        try {
            const token = localStorage.getItem('admin_token');
            const res = await fetch(`/api/admin/customers/${mac}/name`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: editName })
            });
            if (res.ok) {
                setEditing(null);
                fetchData();
            }
        } catch (err) {
            console.error('Update failed:', err);
        }
    };

    const toggleBlock = async (mac, currentStatus) => {
        const action = currentStatus === 'blocked' ? 'unblock' : 'block';
        try {
            const res = await fetch(`/api/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mac: mac })
            });
            if (res.ok) fetchData();
        } catch (err) {
            console.error('Action failed:', err);
        }
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
                fetchData();
            }
        } catch (error) { console.error('Assignment Failed') }
    };

    const filtered = customers.filter(c =>
        c.mac.toLowerCase().includes(search.toLowerCase()) ||
        (c.name && c.name.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div className="flex h-screen bg-[#0a0b14] text-slate-200 overflow-hidden">
            <Sidebar activeTab="customers" setActiveTab={() => { }} />

            <main className="flex-1 overflow-y-auto p-8 relative">
                <div className="flex justify-between items-center mb-10">
                    <div>
                        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
                            Customer Base
                        </h1>
                        <p className="text-slate-400 mt-2">Manage persistent devices and their network permissions.</p>
                    </div>

                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search MAC or Name..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="bg-slate-800/50 border border-slate-700/50 rounded-xl py-3 pl-12 pr-4 w-80 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all backdrop-blur-xl"
                        />
                    </div>
                </div>

                <div className="bg-slate-900/40 border border-slate-800/50 rounded-2xl overflow-hidden backdrop-blur-xl shadow-2xl">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-800/50 border-b border-slate-800/50">
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Device Identity</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Last IP Address</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Last Seen</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {filtered.map((client) => (
                                <tr key={client.mac} className="hover:bg-indigo-500/5 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
                                                <Users className="w-5 h-5" />
                                            </div>
                                            <div>
                                                {editing === client.mac ? (
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            value={editName}
                                                            onChange={(e) => setEditName(e.target.value)}
                                                            className="bg-slate-800 border border-indigo-500/50 rounded px-2 py-1 text-sm focus:outline-none"
                                                            autoFocus
                                                        />
                                                        <button onClick={() => handleUpdateName(client.mac)} className="text-green-400 hover:text-green-300">
                                                            <Check className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => setEditing(null)} className="text-red-400 hover:text-red-300">
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-medium text-slate-200">
                                                            {client.name || (client.mac.startsWith('c6') ? 'Locally Administered' : 'Unknown Device')}
                                                        </p>
                                                        <button
                                                            onClick={() => { setEditing(client.mac); setEditName(client.name || ''); }}
                                                            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-indigo-400"
                                                        >
                                                            <Edit2 className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                )}
                                                <p className="text-xs text-slate-500 font-mono tracking-tight">{client.mac}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-sm text-slate-400">{client.ip || '0.0.0.0'}</td>
                                    <td className="px-6 py-4">
                                        {client.status === 'blocked' ? (
                                            <button
                                                onClick={() => setShowAssignModal(client.mac)}
                                                className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                                            >
                                                <Plus className="w-3 h-3" />
                                                Assign Plan
                                            </button>
                                        ) : (
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 w-fit bg-emerald-500/10 text-emerald-400 border border-emerald-500/20`}>
                                                <span className={`w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse`} />
                                                Active
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-xs text-slate-500">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-3 h-3" />
                                            {client.last_seen ? new Date(client.last_seen).toLocaleString() : 'Never'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => toggleBlock(client.mac, client.status)}
                                            className={`p-2 rounded-xl border transition-all ${client.status === 'blocked'
                                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                                                : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                                                }`}
                                        >
                                            {client.status === 'blocked' ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Assign Plan Modal */}
                <AnimatePresence>
                    {showAssignModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="bg-slate-900 border border-indigo-500/30 w-full max-w-md rounded-3xl p-8 shadow-2xl relative overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500" />

                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <h2 className="text-2xl font-bold text-white">Select a Plan</h2>
                                        <p className="text-slate-400 text-sm">Assign network access to {showAssignModal}</p>
                                    </div>
                                    <button onClick={() => setShowAssignModal(null)} className="p-2 hover:bg-slate-800 rounded-xl transition-colors">
                                        <X className="w-6 h-6 text-slate-400" />
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {plans.map(plan => (
                                        <button
                                            key={plan.id}
                                            onClick={() => handleAssignPlan(showAssignModal, plan.id)}
                                            className="w-full flex items-center justify-between p-4 bg-slate-800/40 hover:bg-indigo-500/10 border border-slate-700/50 hover:border-indigo-500/30 rounded-2xl transition-all group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
                                                    <CreditCard className="w-5 h-5" />
                                                </div>
                                                <div className="text-left">
                                                    <p className="font-bold text-slate-200">{plan.name}</p>
                                                    <p className="text-xs text-slate-500">{plan.duration_minutes} Minutes</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-bold text-white">₹{plan.price}</p>
                                                <p className="text-[10px] text-indigo-400 uppercase font-bold tracking-widest">Select</p>
                                            </div>
                                        </button>
                                    ))}

                                    {plans.length === 0 && (
                                        <div className="text-center py-10">
                                            <CreditCard className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                                            <p className="text-slate-500">No plans created yet.</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
};

export default CustomerBase;
