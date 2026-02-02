import React from 'react';
import {
    LayoutDashboard, Users, CreditCard, Activity,
    ShieldAlert, LogOut, ChevronRight, Settings,
    FileText, ShieldCheck as ShieldClock
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const Sidebar = ({ activeTab, onLogout }) => {
    const navigate = useNavigate();
    const menuItems = [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard, path: '/admin/dashboard?tab=overview' },
        { id: 'customers', label: 'Customer Base', icon: Activity, path: '/admin/customers' },
        { id: 'requests', label: 'Approvals', icon: ShieldClock, path: '/admin/dashboard?tab=requests' },
        { id: 'reports', label: 'Reports', icon: FileText, path: '/admin/dashboard?tab=reports' },
        { id: 'users', label: 'Live Users', icon: Users, path: '/admin/dashboard?tab=users' },
        { id: 'plans', label: 'Subscriptions', icon: CreditCard, path: '/admin/dashboard?tab=plans' },
        { id: 'settings', label: 'System', icon: Settings, path: '/admin/dashboard?tab=settings' },
    ];

    return (
        <motion.aside
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="w-72 glass m-4 mr-0 flex flex-col p-6 z-20"
        >
            <div className="flex items-center gap-3 mb-10 px-2">
                <div className="w-10 h-10 premium-gradient rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <Activity className="text-white w-6 h-6" />
                </div>
                <div>
                    <h1 className="font-bold text-xl tracking-tight text-white">WiFiMint</h1>
                    <p className="text-[10px] text-indigo-400 font-bold tracking-[0.2em] uppercase">Pro Console</p>
                </div>
            </div>

            <nav className="flex-1 space-y-2">
                {menuItems.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => navigate(item.path)}
                            className={`w-full flex items-center justify-between group px-4 py-3 rounded-xl transition-all ${isActive
                                ? 'sidebar-item-active text-white'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <item.icon size={20} className={isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'} />
                                <span className="font-medium">{item.label}</span>
                            </div>
                            {isActive && <ChevronRight size={14} className="text-indigo-400" />}
                        </button>
                    );
                })}
            </nav>

            <div className="mt-auto pt-6 border-t border-white/5 space-y-4">
                <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                >
                    <LogOut size={20} />
                    <span className="font-medium">Sign Out</span>
                </button>
                <div className="px-4 py-2">
                    <p className="text-[9px] text-slate-500 font-medium uppercase tracking-[0.1em] text-center">
                        Designed & Developed by
                    </p>
                    <p className="text-[11px] text-indigo-400 font-bold text-center mt-0.5">
                        Rajan Goswami
                    </p>
                </div>
            </div>
        </motion.aside>
    );
};

export default Sidebar;
