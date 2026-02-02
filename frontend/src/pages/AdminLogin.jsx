import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, User, ShieldCheck, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

const AdminLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      navigate('/admin/dashboard');
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Invalid credentials or server error');
      }

      const data = await response.json();
      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin_role', data.role);

      // Artificial delay for smooth transition
      setTimeout(() => {
        navigate('/admin/dashboard');
      }, 800);
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 relative overflow-hidden font-sans selection:bg-indigo-500 selection:text-white">
      {/* Dynamic Background Elements */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-lg relative z-10"
      >
        <div className="glass p-10 lg:p-14 overflow-hidden relative">
          {/* Decorative Corner */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-bl-full border-b border-l border-white/5"></div>

          <div className="flex flex-col items-center mb-12">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-600/20 mb-6 group transition-all hover:scale-110">
              <ShieldCheck className="text-white w-8 h-8 group-hover:rotate-12 transition-transform" />
            </div>
            <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Security Console</h2>
            <p className="text-slate-500 text-xs font-bold mt-2 uppercase tracking-[0.3em]">Access Restricted Area</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2 group">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 group-focus-within:text-indigo-400 transition-colors">Identification</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-medium"
                  required
                />
              </div>
            </div>

            <div className="space-y-2 group">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 group-focus-within:text-indigo-400 transition-colors">Access Key</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-medium"
                  required
                />
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 text-red-400 text-xs font-bold bg-red-500/10 p-4 rounded-xl border border-red-500/20"
                >
                  <AlertCircle size={14} />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span className="uppercase tracking-widest text-sm">Initialize Access</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </motion.button>
          </form>

          <p className="mt-8 text-center text-[10px] text-slate-600 font-bold uppercase tracking-widest">
            Protected by Antigravity Core 3.0
          </p>
        </div>

        {/* Visual Accent */}
        <div className="mt-6 flex justify-center gap-4 text-slate-500">
          <div className="flex items-center gap-1.5 transition-colors hover:text-indigo-400 cursor-default">
            <div className="w-1 h-1 rounded-full bg-indigo-500"></div>
            <span className="text-[10px] font-black uppercase tracking-tighter">Encrypted</span>
          </div>
          <div className="flex items-center gap-1.5 transition-colors hover:text-indigo-400 cursor-default">
            <div className="w-1 h-1 rounded-full bg-indigo-500"></div>
            <span className="text-[10px] font-black uppercase tracking-tighter">Isolated</span>
          </div>
          <div className="flex items-center gap-1.5 transition-colors hover:text-indigo-400 cursor-default">
            <div className="w-1 h-1 rounded-full bg-indigo-500"></div>
            <span className="text-[10px] font-black uppercase tracking-tighter">Audit Logged</span>
          </div>
        </div>

        <p className="mt-12 text-center text-[10px] font-black uppercase tracking-[0.5em] text-slate-800">
          Designed & Developed by <span className="text-indigo-500/40">Rajan Goswami</span>
        </p>
      </motion.div>
    </div>
  );
};

export default AdminLogin;
