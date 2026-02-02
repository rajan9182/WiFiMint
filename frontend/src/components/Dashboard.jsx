import React, { useState, useEffect } from 'react';
import {
    LayoutDashboard, Users, CreditCard, Settings, LogOut,
    Wifi, TrendingUp, ShieldAlert, Activity, Lock
} from 'lucide-react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
    const [isAdminAuth, setIsAdminAuth] = useState(false);
    const [adminPass, setAdminPass] = useState('');
    const [activeTab, setActiveTab] = useState('overview');
    const [stats, setStats] = useState({ revenue: 2500, activeUsers: 14, blocked: 3 });
    const [devices, setDevices] = useState([]);

    // Mock Data for Graph
    const data = [
        { name: '10 AM', users: 4 },
        { name: '11 AM', users: 8 },
        { name: '12 PM', users: 15 },
        { name: '1 PM', users: 12 },
        { name: '2 PM', users: 20 },
        { name: '3 PM', users: 18 },
    ];

    useEffect(() => {
        if (!isAdminAuth) return;
        const fetchDevices = async () => {
            try {
                const res = await fetch('/api/devices');
                const data = await res.json();
                if (Array.isArray(data)) setDevices(data);
            } catch (e) { console.error(e) }
        };
        fetchDevices();
        const interval = setInterval(fetchDevices, 5000);
        return () => clearInterval(interval);
    }, [isAdminAuth]);

    const handleAdminLogin = (e) => {
        e.preventDefault();
        if (adminPass === 'password') { // Simple Logic for Proto
            setIsAdminAuth(true);
        } else {
            alert("Invalid Password");
        }
    };

    const toggleBlock = async (mac, isBlocked) => {
        const action = isBlocked ? 'allow' : 'block';
        await fetch(`/api/${action}`, {
            method: 'POST',
            body: JSON.stringify({ mac }),
            headers: { 'Content-Type': 'application/json' }
        });
    };

    if (!isAdminAuth) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-900 text-white">
                <form onSubmit={handleAdminLogin} className="glass p-8 rounded-xl w-96 text-center space-y-4">
                    <div className="w-16 h-16 bg-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/30">
                        <Lock size={32} />
                    </div>
                    <h2 className="text-2xl font-bold">Admin Login</h2>
                    <p className="text-slate-400 text-sm">Enter password to access control panel</p>
                    <input
                        type="password"
                        value={adminPass}
                        onChange={(e) => setAdminPass(e.target.value)}
                        placeholder="Password"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500 text-center"
                    />
                    <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 py-2 rounded-lg font-bold transition-colors">
                        Unlock Console
                    </button>
                    <p className="text-xs text-slate-500">Default: password</p>
                </form>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-slate-900 text-white font-sans overflow-hidden">
            {/* Sidebar */}
            <motion.div
                initial={{ x: -100 }} animate={{ x: 0 }}
                className="w-64 glass m-4 mr-0 rounded-2xl flex flex-col p-6 z-20"
            >
                <div className="flex items-center gap-3 mb-10 px-2">
                    <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                        <Wifi className="text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-xl tracking-tight">NetCommand</h1>
                        <p className="text-xs text-slate-400">Admin Console</p>
                    </div>
                </div>

                <nav className="space-y-2 flex-1">
                    {[
                        { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
                        { id: 'users', icon: Users, label: 'Active Users' },
                        { id: 'plans', icon: CreditCard, label: 'Revenue & Plans' },
                        { id: 'settings', icon: Settings, label: 'System Settings' }
                    ].map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === item.id
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            <item.icon size={20} />
                            <span className="font-medium">{item.label}</span>
                        </button>
                    ))}
                </nav>

                <button onClick={() => setIsAdminAuth(false)} className="flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors mt-auto">
                    <LogOut size={20} />
                    <span>Logout</span>
                </button>
            </motion.div>

            {/* Main Content */}
            <div className="flex-1 p-8 overflow-y-auto">
                <header className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-2xl font-bold">Dashboard Overview</h2>
                        <p className="text-slate-400">Welcome back, Admin</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="px-4 py-2 bg-green-500/10 text-green-400 rounded-full border border-green-500/20 flex items-center gap-2">
                            <Activity size={16} /> System Online
                        </div>
                    </div>
                </header>

                {/* Stats Grid */}
                {activeTab === 'overview' && (
                    <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                                { title: 'Total Revenue', value: '₹2,500', icon: TrendingUp, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                                { title: 'Active Users', value: stats.activeUsers, icon: Users, color: 'text-green-400', bg: 'bg-green-500/10' },
                                { title: 'Security Threats', value: stats.blocked, icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-500/10' },
                            ].map((stat, i) => (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    key={i}
                                    className="glass p-6 rounded-2xl"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`p-3 rounded-xl ${stat.bg}`}>
                                            <stat.icon className={stat.color} size={24} />
                                        </div>
                                        <span className="text-xs text-slate-400 bg-white/5 px-2 py-1 rounded-full">+12% this week</span>
                                    </div>
                                    <h3 className="text-slate-400 text-sm font-medium">{stat.title}</h3>
                                    <p className="text-3xl font-bold mt-1">{stat.value}</p>
                                </motion.div>
                            ))}
                        </div>

                        {/* Chart */}
                        <div className="glass p-8 rounded-2xl h-80">
                            <h3 className="text-lg font-bold mb-6">Traffic Analytics</h3>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data}>
                                    <defs>
                                        <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                    <XAxis dataKey="name" stroke="#94a3b8" />
                                    <YAxis stroke="#94a3b8" />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                    <Area type="monotone" dataKey="users" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Device List (Quick View) */}
                        <div className="glass p-6 rounded-2xl">
                            <h3 className="text-lg font-bold mb-4">Connected Devices</h3>
                            <div className="space-y-3">
                                {devices.map((device, i) => (
                                    <div key={i} className="flex justify-between items-center p-3 hover:bg-white/5 rounded-xl transition-colors border-b border-white/5 last:border-0">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs">
                                                {device.ip.split('.').pop()}
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">{device.name || 'Unknown Device'}</p>
                                                <p className="text-xs text-slate-500">{device.mac}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => toggleBlock(device.mac, false)} // Logic incomplete for status check
                                            className="px-3 py-1 text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded border border-red-500/20 transition-colors"
                                        >
                                            Kick
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
