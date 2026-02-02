import React, { useState, useEffect } from 'react';
import { Wifi, Smartphone, ArrowRight, Clock, CheckCircle2, Activity, Info, XCircle, CreditCard, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Login() {
    const [mobile, setMobile] = useState('');
    const [plans, setPlans] = useState([]);
    const [step, setStep] = useState(1); // 1: Mobile, 2: Plans, 3: Payment, 4: Success/Pending
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [mac, setMac] = useState(''); // Auto-detected
    const [ip, setIp] = useState('');
    const [loading, setLoading] = useState(false);
    const [isResubmission, setIsResubmission] = useState(false);
    const [requestStatus, setRequestStatus] = useState('pending');
    const [connectivityStatus, setConnectivityStatus] = useState('idle');

    // Payment Form state
    const [paymentMethod, setPaymentMethod] = useState('Paytm');
    const [amountPaid, setAmountPaid] = useState('');
    const [transactionId, setTransactionId] = useState('');

    useEffect(() => {
        fetchPlans();
        detectMAC();
    }, []);

    const detectMAC = async () => {
        try {
            const res = await fetch('/api/auth/whoami');
            const data = await res.json();
            if (data.mac && data.mac !== 'unknown') {
                setMac(data.mac);
                setIp(data.ip);
                checkInitialStatus(data.mac);
            }
        } catch (err) {
            console.error('MAC detection failed:', err);
        }
    };

    const checkInitialStatus = async (detectedMac) => {
        try {
            const res = await fetch(`/api/auth/status?mac=${detectedMac}`);
            const data = await res.json();
            if (data.status === 'active') {
                setRequestStatus('active');
                setStep(4);
                checkInternet();
            } else if (data.status === 'pending' || data.status === 'rejected') {
                setRequestStatus(data.status);
                setStep(4);
            }
        } catch (err) {
            console.error('Initial status check failed:', err);
        }
    };

    const fetchPlans = async () => {
        try {
            const res = await fetch('/api/public/plans');
            const data = await res.json();
            setPlans(data || []);
        } catch (err) {
            console.error('Failed to fetch plans:', err);
        }
    };

    const handleLogin = (e) => {
        e.preventDefault();
        setStep(2);
    };

    const handleSelectPlan = (plan) => {
        setSelectedPlan(plan);
        setAmountPaid(plan.price);
        setStep(3);
    };

    const handleSubmitPayment = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('/api/auth/request-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mac_address: mac,
                    plan_id: selectedPlan.id,
                    mobile: mobile,
                    payment_method: paymentMethod,
                    amount_paid: parseFloat(amountPaid),
                    transaction_id: transactionId
                })
            });
            if (res.ok) {
                if (requestStatus === 'rejected') {
                    setIsResubmission(true);
                    setRequestStatus('pending');
                }
                setStep(4);
            } else {
                alert("Request failed. Please try again.");
            }
        } catch (err) {
            console.error('Request failed:', err);
        } finally {
            setLoading(false);
        }
    };

    const checkInternet = async (retries = 3) => {
        setConnectivityStatus('checking');
        for (let i = 0; i < retries; i++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);
                await fetch('https://www.google.com/favicon.ico?t=' + Date.now(), {
                    mode: 'no-cors',
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                setConnectivityStatus('success');
                return true;
            } catch (err) {
                await new Promise(r => setTimeout(r, 2000));
            }
        }
        setConnectivityStatus('failed');
        return false;
    };

    useEffect(() => {
        let interval;
        if (step === 4 && requestStatus === 'pending') {
            interval = setInterval(async () => {
                try {
                    const res = await fetch(`/api/auth/status?mac=${mac}`);
                    const data = await res.json();
                    if (data.status === 'active') {
                        setRequestStatus('active');
                        clearInterval(interval);
                        checkInternet();
                    } else if (data.status === 'rejected') {
                        setRequestStatus('rejected');
                        clearInterval(interval);
                    }
                } catch (err) {
                    console.error('Status poll failed:', err);
                }
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [step, requestStatus, mac]);

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#020308] text-white font-sans selection:bg-indigo-500/30">
            {/* Animated Cyber Background */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/10 rounded-full blur-[150px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[150px] animate-pulse delay-1000"></div>

                {/* Data Particles */}
                {[...Array(20)].map((_, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: Math.random() * 100 + "%", x: Math.random() * 100 + "%" }}
                        animate={{
                            opacity: [0, 0.5, 0],
                            y: [Math.random() * 100 + "%", Math.random() * 100 + "%"],
                            transition: { duration: Math.random() * 10 + 10, repeat: Infinity, ease: "linear" }
                        }}
                        className="absolute w-1 h-1 bg-indigo-500/40 rounded-full"
                    />
                ))}

                {/* Grid Overlay */}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none"></div>
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]"></div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-xl mx-4 relative z-10"
            >
                <div className="glass-card relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-slate-900/40 backdrop-blur-3xl p-8 md:p-12 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)]">
                    {/* Top Glow line */}
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50"></div>

                    {/* Header */}
                    <header className="text-center mb-12">
                        <motion.div
                            whileHover={{ scale: 1.05, rotate: 5 }}
                            className="inline-flex p-5 rounded-3xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 mb-6 items-center justify-center border border-white/10 shadow-2xl"
                        >
                            <Wifi size={44} className="text-indigo-400 drop-shadow-[0_0_10px_rgba(129,140,248,0.5)]" />
                        </motion.div>
                        <h1 className="text-5xl font-black tracking-tighter mb-2">
                            <span className="bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">WiFi</span>
                            <span className="bg-gradient-to-b from-indigo-400 to-indigo-600 bg-clip-text text-transparent italic">Mint</span>
                        </h1>
                        <div className="flex items-center justify-center gap-2">
                            <span className="h-[1px] w-6 bg-indigo-500/30"></span>
                            <p className="text-indigo-400/80 text-[10px] uppercase font-black tracking-[0.3em]">Premium Network Access</p>
                            <span className="h-[1px] w-6 bg-indigo-500/30"></span>
                        </div>
                    </header>

                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.form
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                onSubmit={handleLogin}
                                className="space-y-8"
                            >
                                <div className="space-y-4">
                                    <h2 className="text-2xl font-bold flex items-center gap-2">
                                        <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                                        Get Started
                                    </h2>
                                    <div className="relative group">
                                        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500"></div>
                                        <Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors z-10" size={24} />
                                        <input
                                            type="tel"
                                            value={mobile}
                                            onChange={(e) => setMobile(e.target.value)}
                                            placeholder="Enter Mobile Number"
                                            className="relative w-full bg-slate-950/60 border border-white/5 rounded-2xl py-6 pl-14 pr-6 focus:outline-none focus:border-indigo-500/50 transition-all text-xl font-bold tracking-tight placeholder:text-slate-700 placeholder:font-medium"
                                            required
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-center">Your MAC: {mac || 'Detecting...'}</p>
                                </div>

                                <button type="submit" className="group w-full relative overflow-hidden bg-white text-black py-6 rounded-2xl font-black text-xl shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-all active:scale-[0.98]">
                                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <span className="relative flex items-center justify-center gap-3">
                                        Check Availablity <ArrowRight size={24} strokeWidth={3} />
                                    </span>
                                </button>
                            </motion.form>
                        )}

                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="flex justify-between items-end">
                                    <h2 className="text-3xl font-black tracking-tight">Select Plan</h2>
                                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1.5">Exclusive Offers</p>
                                </div>

                                <div className="space-y-4 max-h-[420px] pr-2 custom-scrollbar overflow-y-auto">
                                    {plans.map((p, i) => (
                                        <motion.button
                                            key={p.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0, transition: { delay: i * 0.1 } }}
                                            onClick={() => handleSelectPlan(p)}
                                            className="w-full p-6 bg-white/5 border border-white/5 rounded-3xl hover:bg-white/[0.08] hover:border-indigo-500/30 transition-all flex justify-between items-center group relative overflow-hidden"
                                        >
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[40px] rounded-full group-hover:bg-indigo-500/10 transition-colors"></div>
                                            <div className="relative z-10 flex items-center gap-5">
                                                <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center border border-white/5 group-hover:border-indigo-500/20 group-hover:text-indigo-400 transition-all">
                                                    <Clock size={28} />
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-2xl mb-1">{p.name}</h4>
                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{p.duration_minutes} Mins Speed Access</p>
                                                </div>
                                            </div>
                                            <div className="text-right relative z-10">
                                                <div className="text-3xl font-black group-hover:text-indigo-400 transition-colors">₹{p.price}</div>
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Single User</span>
                                            </div>
                                        </motion.button>
                                    ))}
                                </div>
                                <button onClick={() => setStep(1)} className="w-full py-4 text-slate-500 font-bold text-xs uppercase tracking-[0.2em] hover:text-white transition-colors">Go Back</button>
                            </motion.div>
                        )}

                        {step === 3 && selectedPlan && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="text-center">
                                    <h2 className="text-3xl font-black mb-1">Activate Secret</h2>
                                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">Scan & Enter Last 4 Digits</p>
                                </div>

                                <div className="relative group mx-auto w-fit">
                                    <div className="absolute -inset-4 bg-indigo-500/20 blur-2xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity"></div>
                                    <div className="bg-white p-4 rounded-3xl relative z-10 shadow-2xl overflow-hidden">
                                        <img
                                            src="/payment.jpeg"
                                            alt="Payment QR"
                                            className="w-48 h-48 object-contain rounded-xl"
                                            onError={(e) => e.target.src = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=rajangoswami@paytm"}
                                        />
                                        {/* Scan Animation Line */}
                                        <motion.div
                                            animate={{ top: ["0%", "90%", "0%"] }}
                                            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                            className="absolute left-0 right-0 h-1 bg-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.8)] z-20 pointer-events-none"
                                        />
                                    </div>
                                </div>

                                <form onSubmit={handleSubmitPayment} className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-between">
                                            <div>
                                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Order Summary</p>
                                                <p className="font-bold">{selectedPlan.name}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-2xl font-black">₹{amountPaid}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Method</label>
                                            <select
                                                value={paymentMethod}
                                                onChange={(e) => setPaymentMethod(e.target.value)}
                                                className="w-full bg-slate-950/60 border border-white/10 rounded-xl py-4 px-4 text-white focus:outline-none focus:border-indigo-500/50 font-bold"
                                            >
                                                <option value="Paytm">Paytm</option>
                                                <option value="UPI">UPI App</option>
                                                <option value="GPay">GPay</option>
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Last 4 Digits</label>
                                            <input
                                                type="text"
                                                maxLength="4"
                                                placeholder="XXXX"
                                                value={transactionId}
                                                onChange={(e) => setTransactionId(e.target.value)}
                                                className="w-full bg-slate-950/60 border border-white/10 rounded-xl py-4 px-4 text-white focus:outline-none focus:border-indigo-500/50 font-bold placeholder:text-slate-800 text-center tracking-[0.5em]"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white py-5 rounded-2xl font-black text-xl shadow-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50"
                                    >
                                        {loading ? 'Processing...' : 'Verify Now'} <ShieldCheck size={28} />
                                    </button>
                                    <button type="button" onClick={() => setStep(2)} className="w-full py-2 text-slate-500 font-bold text-xs uppercase tracking-[0.2em] hover:text-white transition-colors">Change Plan</button>
                                </form>
                            </motion.div>
                        )}

                        {step === 4 && (
                            <motion.div
                                key="step4"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center py-6"
                            >
                                {requestStatus === 'pending' ? (
                                    <>
                                        <div className="relative w-32 h-32 mx-auto mb-8">
                                            <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full scale-150 animate-pulse"></div>
                                            <div className="relative w-full h-full bg-slate-900 border-2 border-indigo-500/30 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.2)]">
                                                <Clock size={64} className="text-indigo-400 animate-[spin_5s_linear_infinite]" />
                                            </div>
                                        </div>
                                        <h3 className="text-3xl font-black mb-3 italic tracking-tight uppercase">System Verification</h3>
                                        <p className="text-slate-400 font-medium px-4 mb-10 leading-relaxed">
                                            Your payment for <span className="text-white font-bold">{selectedPlan?.name || 'WiFiMint'}</span> is being matched by our admin. Auto-Refresh active.
                                        </p>

                                        <div className="space-y-4">
                                            <div className="p-5 bg-white/5 border border-white/5 rounded-3xl flex items-center gap-4 text-left">
                                                <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400"><Info size={20} /></div>
                                                <p className="text-[11px] font-bold text-slate-500 leading-tight">Takes 30s - 2m. Don't close this window.</p>
                                            </div>
                                            <div className="flex justify-between items-center px-2">
                                                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Status: Pending</span>
                                                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest animate-pulse">Waiting for Admin</span>
                                            </div>
                                        </div>
                                    </>
                                ) : requestStatus === 'rejected' ? (
                                    <>
                                        <div className="w-28 h-28 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_40px_rgba(239,68,68,0.2)]">
                                            <XCircle size={64} className="text-red-400" />
                                        </div>
                                        <h3 className="text-4xl font-black mb-4 text-red-500 tracking-tighter uppercase italic">Verification Failed</h3>
                                        <p className="text-slate-400 font-medium px-4 mb-8">
                                            Transaction ID mismatched. Please ensure you enter the <span className="text-white">Last 4 Digits</span> of the transaction correctly.
                                        </p>
                                        <div className="space-y-4">
                                            <button
                                                onClick={() => setStep(3)}
                                                className="w-full bg-white text-black py-5 rounded-2xl font-black text-lg shadow-xl hover:bg-slate-100 transition-all active:scale-[0.98]"
                                            >
                                                Update & Retry
                                            </button>
                                            <p className="text-red-400 font-black text-[10px] uppercase tracking-[0.3em]">Help: 9599449182 (WhatsApp)</p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {connectivityStatus === 'checking' ? (
                                            <>
                                                <div className="w-32 h-32 bg-indigo-500/10 border border-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse shadow-[0_0_40px_rgba(99,102,241,0.2)]">
                                                    <Activity size={64} className="text-indigo-400" />
                                                </div>
                                                <h3 className="text-3xl font-black mb-4 italic tracking-tight uppercase">Optimizing Pipe...</h3>
                                                <p className="text-slate-400 font-medium px-4 mb-8">
                                                    Approval received! Syncing your MAC address with our high-speed gateway.
                                                </p>
                                            </>
                                        ) : connectivityStatus === 'success' ? (
                                            <>
                                                <div className="relative w-32 h-32 mx-auto mb-10">
                                                    <motion.div
                                                        animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
                                                        transition={{ duration: 2, repeat: Infinity }}
                                                        className="absolute inset-0 bg-emerald-500/20 rounded-full blur-2xl"
                                                    />
                                                    <div className="relative w-full h-full bg-emerald-500/10 border-2 border-emerald-500/30 rounded-full flex items-center justify-center">
                                                        <CheckCircle2 size={64} className="text-emerald-400" />
                                                    </div>
                                                </div>
                                                <h3 className="text-5xl font-black mb-4 text-emerald-400 italic tracking-tighter uppercase">Ignited!</h3>
                                                <p className="text-slate-400 font-medium px-4 mb-10 leading-relaxed text-lg">
                                                    Your connection is now <span className="text-white font-bold underline decoration-emerald-500">fully active</span>. Welcome to the elite tier.
                                                </p>
                                                <button
                                                    onClick={() => window.location.href = 'https://google.com'}
                                                    className="group w-full relative overflow-hidden bg-emerald-500 text-black py-6 rounded-3xl font-black text-2xl shadow-[0_0_40px_rgba(16,185,129,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all"
                                                >
                                                    <span className="relative flex items-center justify-center gap-3">
                                                        Start Experience <ArrowRight strokeWidth={4} />
                                                    </span>
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <div className="w-32 h-32 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_40px_rgba(245,158,11,0.2)]">
                                                    <Info size={64} className="text-amber-400" />
                                                </div>
                                                <h3 className="text-3xl font-black mb-4 text-amber-400 uppercase italic tracking-tight">Handshake Lag</h3>
                                                <p className="text-slate-400 font-medium px-4 mb-10">
                                                    Device approved but gateway is slow to respond. Please <span className="text-white">toggle your Wi-Fi OFF and ON</span> once to force connection.
                                                </p>
                                                <div className="space-y-4">
                                                    <button
                                                        onClick={() => checkInternet()}
                                                        className="w-full bg-amber-500 text-black py-5 rounded-2xl font-black text-lg active:scale-[0.98] transition-all"
                                                    >
                                                        Retry Connection
                                                    </button>
                                                    <button
                                                        onClick={() => window.location.href = 'https://google.com'}
                                                        className="w-full bg-white/5 text-slate-400 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:text-white transition-colors"
                                                    >
                                                        Try Browsing Anyway
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer Info */}
                <footer className="mt-12 text-center pointer-events-none">
                    <div className="flex items-center justify-center gap-4 mb-6 opacity-30">
                        <div className="flex flex-col items-center">
                            <ShieldCheck size={16} />
                            <span className="text-[8px] font-black uppercase tracking-tighter mt-1">Encrypted</span>
                        </div>
                        <div className="h-6 w-[1px] bg-white/10"></div>
                        <div className="flex flex-col items-center">
                            <Activity size={16} />
                            <span className="text-[8px] font-black uppercase tracking-tighter mt-1">High Speed</span>
                        </div>
                        <div className="h-6 w-[1px] bg-white/10"></div>
                        <div className="flex flex-col items-center">
                            <CreditCard size={16} />
                            <span className="text-[8px] font-black uppercase tracking-tighter mt-1">Verified</span>
                        </div>
                    </div>
                    <p className="text-slate-700 font-black uppercase text-[10px] tracking-[0.5em] mb-4">
                        Secure Gateway Alpha • Powered by WiFiMint
                    </p>
                    <div className="pt-6 border-t border-white/[0.03]">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-800">
                            Core Architecture by <span className="text-indigo-500/20">Rajan Goswami</span>
                        </p>
                    </div>
                </footer>
            </motion.div>

            {/* Custom Styles for Scrollbar */}
            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.02);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(99, 102, 241, 0.2);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(99, 102, 241, 0.4);
                }
                .glass-card {
                    box-shadow: 
                        0 20px 50px -12px rgba(0, 0, 0, 0.5),
                        inset 0 1px 1px 0 rgba(255, 255, 255, 0.05);
                }
            `}</style>
        </div>
    );
}
