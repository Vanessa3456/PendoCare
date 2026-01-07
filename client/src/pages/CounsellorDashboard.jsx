import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    fetchQueue,
    subscribeToQueue,
    joinConversation,
    sendMessage,
    subscribeToConversation,
    parseConversationLog,
    subscribeToNotifications
} from '../services/chatService';
import {
    Video, MessageSquare, Clock, User, Phone, CheckCircle2,
    LayoutDashboard, History, Settings, LogOut, Bell,
    Search, Filter, Activity, TrendingUp, AlertCircle,
    Paperclip, Mic, Send, MoreVertical, ShieldAlert, CheckCheck, ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";

const CounsellorDashboard = () => {
    const navigate = useNavigate();
    const counselorName = localStorage.getItem('user_name') || 'Counsellor';
    const counselorId = localStorage.getItem('user_id') || 'counselor_01'; // Ideally actual ID

    const handleLogout = () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_name');
        localStorage.removeItem('school_name');
        navigate('/login');
    };
    const [isAvailable, setIsAvailable] = useState(true);
    const [incomingRequests, setIncomingRequests] = useState([]);
    const [activeSessions, setActiveSessions] = useState([]);
    const [activeNav, setActiveNav] = useState('dashboard');
    const [videoNotifications, setVideoNotifications] = useState([]);

    // 1. Listen for Queue Updates & Notifications (Supabase Realtime)
    useEffect(() => {
        let queueSub = null;
        let notifSub = null;

        const initDashboard = async () => {
            // Initial Queue Load
            const queue = await fetchQueue();
            setIncomingRequests(queue.map(q => ({
                id: q.id,
                studentId: q.student_external_id || "Anonymous",
                timestamp: q.created_at,
                riskLevel: q.risk_level,
                escalated: q.escalated
            })));

            // Subscribe to Queue
            queueSub = subscribeToQueue((newReq) => {
                setIncomingRequests(prev => {
                    // check if we already have it
                    const exists = prev.find(r => r.id === newReq.id);
                    if (exists) {
                        // Update existing
                        return prev.map(r => r.id === newReq.id ? {
                            ...r,
                            riskLevel: newReq.risk_level,
                            escalated: newReq.escalated
                        } : r);
                    }
                    // Add new if unassigned
                    if (!newReq.counsellor_id) {
                        return [...prev, {
                            id: newReq.id,
                            studentId: newReq.student_external_id || "Anonymous",
                            timestamp: newReq.created_at,
                            riskLevel: newReq.risk_level,
                            escalated: newReq.escalated
                        }];
                    }
                    // If it was assigned to someone else (or us via another mechanism), remove from queue
                    if (newReq.counsellor_id) {
                        return prev.filter(r => r.id !== newReq.id);
                    }
                    return prev;
                });
            });

            // Subscribe to Notifications (Video)
            notifSub = subscribeToNotifications((item) => {
                if (item.type === 'video_meeting') {
                    setVideoNotifications(prev => [item.payload, ...prev].slice(0, 5));
                }
            });
        };

        initDashboard();

        return () => {
            if (queueSub) queueSub.unsubscribe();
            if (notifSub) notifSub.unsubscribe();
        };
    }, []);

    const [activeChat, setActiveChat] = useState(null);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [activeChatSubscription, setActiveChatSubscription] = useState(null);

    const handleAcceptRequest = async (request) => {
        // Assign to self via Supabase
        await joinConversation(request.id, counselorId);

        // Optimistically remove from queue
        setIncomingRequests(prev => prev.filter(r => r.id !== request.id));

        // Add to active sessions
        const session = { ...request, roomId: request.id };
        setActiveSessions(prev => [...prev, session]);

        // Open Chat
        openChat(session);
    };

    const openChat = (session) => {
        if (activeChatSubscription) activeChatSubscription.unsubscribe();

        setActiveChat(session);
        setChatMessages([]);

        // Subscribe to this specific conversation's messages
        const sub = subscribeToConversation(session.id, (updatedConv) => {
            // Parse the latest content log
            setChatMessages(parseConversationLog(updatedConv.content));
        });
        setActiveChatSubscription(sub);

        // Initial load of messages (in case Realtime doesn't fire immediately on connect)
        // Ideally we fetch the conversation once to get current state
        import('../services/chatService').then(({ getConversation }) => {
            getConversation(session.id).then(conv => {
                if (conv) setChatMessages(parseConversationLog(conv.content));
            });
        });
    };

    const handleSendMessage = async () => {
        if (!chatInput.trim() || !activeChat) return;
        const text = chatInput;
        setChatInput('');

        try {
            await sendMessage(activeChat.id, 'counsellor', text);
        } catch (err) {
            console.error(err);
            setChatInput(text);
        }
    };

    const handleEndSession = (sessionId) => {
        if (!window.confirm("Are you sure you want to end this session?")) return;

        // Remove from UI
        setActiveSessions(prev => prev.filter(s => s.roomId !== sessionId));

        if (activeChat?.roomId === sessionId) {
            setActiveChat(null);
            if (activeChatSubscription) activeChatSubscription.unsubscribe();
        }

        // Optional: Mark as completed in DB?
        // await supabase.from('conversations').update({ risk_level: 'completed' }).eq('id', sessionId);
    };

    const sideBarItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'history', label: 'Session History', icon: History },
        { id: 'alerts', label: 'Urgent Alerts', icon: AlertCircle },
        { id: 'settings', label: 'Profile Settings', icon: Settings },
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
            {/* Sidebar */}
            <aside className="w-20 lg:w-64 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-screen transition-all duration-300 z-50">
                <div className="p-6 flex items-center gap-3">
                    <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-100">
                        <Activity size={24} />
                    </div>
                    <span className="text-xl font-black tracking-tight hidden lg:block">Pendo Staff</span>
                </div>

                <nav className="flex-1 px-4 mt-4 space-y-2">
                    {sideBarItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveNav(item.id)}
                            className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl font-bold text-sm transition-all group ${activeNav === item.id
                                ? 'bg-brand-50 text-brand-600'
                                : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                                }`}
                        >
                            <item.icon size={20} />
                            <span className="hidden lg:block">{item.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="p-4 mt-auto border-t border-slate-100">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl font-bold text-sm text-red-400 hover:bg-red-50 hover:text-red-600 transition-all"
                    >
                        <LogOut size={20} />
                        <span className="hidden lg:block">Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto">
                {/* Header */}
                <header className="bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-slate-100 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-black tracking-tight text-slate-800">Counsellor Overview</h2>
                        <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                            <span>Welcome,</span>
                            <span className="text-brand-600 font-bold">{counselorName}</span>
                            <span className="w-1 h-1 bg-slate-300 rounded-full mx-1"></span>
                            <span>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all ${isAvailable ? 'bg-green-50 border-green-100' : 'bg-slate-100 border-slate-200 font-medium'
                            }`}>
                            <span className={`w-2.5 h-2.5 rounded-full ${isAvailable ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`} />
                            <select
                                value={isAvailable ? 'online' : 'offline'}
                                onChange={(e) => setIsAvailable(e.target.value === 'online')}
                                className="bg-transparent border-none text-xs font-black text-slate-700 focus:ring-0 cursor-pointer outline-none uppercase tracking-widest"
                            >
                                <option value="online">Online & Available</option>
                                <option value="offline">Offline / Busy</option>
                            </select>
                        </div>

                        <button className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-brand-600 hover:border-brand-100 transition-all relative">
                            <Bell size={20} />
                            {incomingRequests.length > 0 && (
                                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                            )}
                        </button>
                    </div>
                </header>

                <div className="p-6 lg:p-10 space-y-8">
                    {/* Metrics Row */}
                    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { label: 'Total Sessions', value: '0', icon: MessageSquare, color: 'text-brand-600', bg: 'bg-brand-50' },
                            { label: 'Avg Wait Time', value: '4m', icon: Clock, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                            { label: 'Risk Alerts', value: '03', icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
                            { label: 'Engagement', value: '+12%', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                        ].map((metric, i) => (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                key={i}
                                className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5 group hover:shadow-lg transition-all"
                            >
                                <div className={`w-14 h-14 ${metric.bg} rounded-2xl flex items-center justify-center ${metric.color} group-hover:scale-110 transition-transform`}>
                                    <metric.icon size={28} />
                                </div>
                                <div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">{metric.label}</span>
                                    <span className={`text-2xl font-black text-slate-900 tracking-tight`}>{metric.value}</span>
                                </div>
                            </motion.div>
                        ))}
                    </section>

                    <div className="grid lg:grid-cols-3 gap-8">
                        {/* Main Interaction Area */}
                        <div className="lg:col-span-2 space-y-8">
                            {/* Live Waiting Room */}
                            <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden relative">
                                <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500">
                                            <Activity size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-slate-800 tracking-tight">Student Waiting Room</h3>
                                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Live Updates • Active Support</p>
                                        </div>
                                    </div>
                                    <span className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest ${incomingRequests.length > 0
                                        ? 'bg-rose-100 text-rose-600 animate-pulse'
                                        : 'bg-slate-100 text-slate-400'
                                        }`}>
                                        {incomingRequests.length} Waiting
                                    </span>
                                </div>

                                <div className="p-8 space-y-4">
                                    <AnimatePresence mode="popLayout">
                                        {incomingRequests.length === 0 ? (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="text-center py-16 bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-100"
                                            >
                                                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200 shadow-inner">
                                                    <User size={40} />
                                                </div>
                                                <h4 className="text-lg font-bold text-slate-400">All quiet in the waiting room</h4>
                                                <p className="text-sm text-slate-300 font-medium">Enjoy the moment of peace!</p>
                                            </motion.div>
                                        ) : (
                                            incomingRequests.map((req) => (
                                                <motion.div
                                                    key={req.id}
                                                    layout
                                                    initial={{ transform: 'scale(0.9)', opacity: 0 }}
                                                    animate={{ transform: 'scale(1)', opacity: 1 }}
                                                    exit={{ transform: 'scale(0.9)', opacity: 0 }}
                                                    className="group flex flex-col md:flex-row md:items-center justify-between p-7 bg-white rounded-[2.5rem] border border-slate-100 hover:border-brand-200 hover:shadow-xl transition-all relative overflow-hidden"
                                                >
                                                    <div className="flex items-center gap-6 relative z-10">
                                                        <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center text-brand-600 group-hover:scale-110 transition-transform shadow-inner">
                                                            <MessageSquare size={30} />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-3 mb-1">
                                                                <h4 className="font-black text-slate-900 text-xl tracking-tight">{req.studentId}</h4>
                                                                {(req.escalated || req.riskLevel === 'high') && (
                                                                    <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-lg uppercase tracking-tight">Risk Alert</span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-4 text-sm font-bold text-slate-400">
                                                                <span className="flex items-center gap-1.5"><Clock size={16} /> Queued {Math.floor((Date.now() - new Date(req.timestamp).getTime()) / 60000)}m ago</span>
                                                                <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                                                <span className="flex items-center gap-1.5"><Activity size={16} className="text-emerald-500" /> Chat Session</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleAcceptRequest(req)}
                                                        className="mt-4 md:mt-0 bg-brand-600 text-white px-10 py-4 rounded-2xl font-black text-sm hover:bg-brand-700 shadow-xl shadow-brand-100 active:scale-95 transition-all relative z-10"
                                                    >
                                                        Accept Chat
                                                    </button>
                                                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                </motion.div>
                                            ))
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>

                        {/* Sidebar Column */}
                        <div className="space-y-8">
                            {/* Video Meeting Notifications */}
                            {videoNotifications.length > 0 && (
                                <div className="bg-gradient-to-br from-brand-600 to-brand-700 text-white rounded-[3rem] p-8 shadow-2xl relative overflow-hidden">
                                    <div className="flex items-center justify-between mb-6 relative z-10">
                                        <h3 className="font-black text-xl tracking-tight flex items-center gap-3">
                                            <Video size={24} className="animate-pulse" />
                                            Video Sessions
                                        </h3>
                                        <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-black">
                                            {videoNotifications.length} New
                                        </span>
                                    </div>

                                    <div className="space-y-3 relative z-10 max-h-96 overflow-y-auto">
                                        <AnimatePresence>
                                            {videoNotifications.map((notif, i) => (
                                                <motion.div
                                                    key={i} // Use Index as notification might be ephemeral
                                                    initial={{ x: 20, opacity: 0 }}
                                                    animate={{ x: 0, opacity: 1 }}
                                                    exit={{ x: -20, opacity: 0 }}
                                                    className="bg-white/10 backdrop-blur-xl rounded-2xl p-5 border border-white/20 hover:bg-white/20 transition-all"
                                                >
                                                    <div className="flex items-start justify-between mb-3">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <User size={16} />
                                                                <span className="font-bold text-sm">{notif.studentEmail}</span>
                                                            </div>
                                                            <div className="flex items-center gap-3 text-xs text-white/70 font-medium">
                                                                <span className="flex items-center gap-1">
                                                                    <Clock size={14} />
                                                                    {notif.time}
                                                                </span>
                                                                <span>•</span>
                                                                <span>{new Date(notif.date).toLocaleDateString()}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <a
                                                            href={notif.meetLink}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex-1 bg-white text-brand-600 px-4 py-2.5 rounded-xl font-black text-sm text-center hover:bg-brand-50 transition-all"
                                                        >
                                                            Join Meeting →
                                                        </a>
                                                        <button
                                                            onClick={() => {
                                                                setVideoNotifications(prev => prev.filter((_, idx) => idx !== i));
                                                            }}
                                                            className="bg-red-500/20 text-white px-3 py-2.5 rounded-xl hover:bg-red-500/40 transition-all"
                                                            title="End/Dismiss"
                                                        >
                                                            <LogOut size={16} />
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                    <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
                                </div>
                            )}

                            {/* System Status / Quick Log */}
                            <div className="bg-white rounded-[3rem] p-8 border border-slate-100 shadow-soft">
                                <h3 className="font-black text-lg text-slate-800 mb-6 flex items-center justify-center lg:justify-between tracking-tight">
                                    System Status
                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                                </h3>
                                <div className="space-y-4">
                                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex gap-4">
                                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shrink-0 shadow-sm">
                                            <TrendingUp size={18} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-900 leading-relaxed">Platform traffic is currently low. Great time for case notes!</p>
                                            <span className="text-[10px] text-slate-300 font-bold uppercase mt-1 block">Just now</span>
                                        </div>
                                    </div>
                                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex gap-4 opacity-60">
                                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shrink-0 shadow-sm">
                                            <Bell size={18} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-900 leading-relaxed">System maintenance scheduled for Sunday at 02:00 AM.</p>
                                            <span className="text-[10px] text-slate-300 font-bold uppercase mt-1 block">2 hours ago</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Active Sessions Mini-Panel */}
                            <div className="bg-slate-900 text-white rounded-[3rem] p-8 shadow-2xl relative overflow-hidden group">
                                <div className="flex items-center justify-between mb-8 relative z-10">
                                    <h3 className="font-black text-xl tracking-tight flex items-center gap-3">
                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
                                        Active Chats
                                    </h3>
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">In Progress</span>
                                </div>

                                <div className="space-y-4 relative z-10">
                                    <AnimatePresence>
                                        {activeSessions.length === 0 ? (
                                            <div className="py-8 text-center bg-white/5 rounded-3xl border border-white/5">
                                                <p className="text-white/30 font-bold text-xs uppercase tracking-widest">No active sessions</p>
                                            </div>
                                        ) : (
                                            activeSessions.map((session, i) => (
                                                <motion.div
                                                    initial={{ x: 20, opacity: 0 }}
                                                    animate={{ x: 0, opacity: 1 }}
                                                    key={i}
                                                    onClick={() => openChat(session)}
                                                    className="bg-white/10 backdrop-blur-xl rounded-[2rem] p-5 border border-white/10 flex items-center justify-between group/item hover:bg-white/20 transition-all cursor-pointer"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center text-xs font-black shadow-lg shadow-brand-900/40">
                                                            {session.studentId?.[0] || 'S'}
                                                        </div>
                                                        <div>
                                                            <span className="text-sm font-black block">{session.studentId || "Anonymous"}</span>
                                                            <span className="text-[10px] text-white/50 font-bold">In Session</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleEndSession(session.roomId || session.id);
                                                            }}
                                                            className="p-2 hover:bg-white/20 rounded-xl text-white/50 hover:text-red-300 transition-colors"
                                                            title="End Session"
                                                        >
                                                            <LogOut size={16} />
                                                        </button>
                                                        <CheckCircle2 size={18} className="text-brand-400 opacity-0 group-item-hover:opacity-100 transition-opacity" />
                                                    </div>
                                                </motion.div>
                                            ))
                                        )}
                                    </AnimatePresence>
                                </div>
                                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-brand-600/20 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-700"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </main >

            {/* Chat Modal */}
            < AnimatePresence >
                {activeChat && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 md:p-4"
                        onClick={() => {
                            setActiveChat(null);
                            if (activeChatSubscription) activeChatSubscription.unsubscribe();
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-[#E5DDD5] w-full max-w-5xl h-full md:h-[90vh] md:rounded-3xl shadow-2xl flex flex-col overflow-hidden relative"
                        >
                            {/* WhatsApp Pattern Overlay */}
                            <div className="absolute inset-0 opacity-[0.06] pointer-events-none bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat"></div>

                            {/* Chat Header (WhatsApp Style) */}
                            <div className="bg-[#008069] text-white px-4 py-3 flex items-center shadow-md z-10 sticky top-0 shrink-0">
                                <button onClick={() => setActiveChat(null)} className="mr-2 rounded-full p-1 hover:bg-white/10 transition md:hidden">
                                    <ArrowLeft size={24} />
                                </button>

                                <div className="w-10 h-10 bg-slate-300 rounded-full flex items-center justify-center overflow-hidden mr-3 border border-white/20">
                                    <img src={`https://ui-avatars.com/api/?name=${activeChat.studentId || "Student"}&background=random`} alt="Student" />
                                </div>

                                <div className="flex-1">
                                    <h1 className="font-bold text-lg leading-tight">
                                        {activeChat.studentId || "Student"}
                                    </h1>
                                    <p className="text-xs text-green-100 opacity-90 truncate flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                                        Active Support Session
                                    </p>
                                </div>

                                <div className="flex items-center gap-4 text-white/80">
                                    <button
                                        onClick={() => handleEndSession(activeChat.id)}
                                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-tight transition-all"
                                    >
                                        End Session
                                    </button>
                                    <Video size={24} className="cursor-pointer hover:text-white hidden sm:block" />
                                    <Phone size={22} className="cursor-pointer hover:text-white hidden sm:block" />
                                    <MoreVertical size={22} className="cursor-pointer hover:text-white" />
                                </div>
                            </div>

                            {/* Messages Area */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-2 z-10">
                                {/* Security / Encryption Notice */}
                                <div className="flex justify-center mb-6">
                                    <div className="bg-[#FFF5C4] text-[#5E5151] text-[11px] px-4 py-2 rounded-lg shadow-sm flex items-center gap-2 max-w-[85%] text-center border border-[#e6dbad]">
                                        <ShieldAlert size={14} className="shrink-0 text-[#857a4a]" />
                                        <span>This session is private and end-to-end encrypted for student safety.</span>
                                    </div>
                                </div>

                                <AnimatePresence>
                                    {chatMessages.map((msg, idx) => {
                                        const isCounselor = msg.role === 'counsellor';
                                        return (
                                            <motion.div
                                                key={idx}
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className={`flex ${isCounselor ? 'justify-end' : 'justify-start'} mb-1`}
                                            >
                                                <div
                                                    className={`relative max-w-[80%] px-3 py-1.5 rounded-lg shadow-sm text-[15px] leading-relaxed break-words ${isCounselor
                                                        ? 'bg-[#E7FFDB] text-slate-800 rounded-tr-none'
                                                        : 'bg-white text-slate-800 rounded-tl-none'
                                                        }`}
                                                >
                                                    {/* Tail SVG Mockup */}
                                                    {isCounselor ? (
                                                        <div className="absolute top-0 -right-[8px] w-0 h-0 border-t-[10px] border-t-[#E7FFDB] border-r-[10px] border-r-transparent" />
                                                    ) : (
                                                        <div className="absolute top-0 -left-[8px] w-0 h-0 border-t-[10px] border-t-white border-l-[10px] border-l-transparent" />
                                                    )}

                                                    <p>{msg.text}</p>
                                                    <div className="flex justify-end items-center gap-1 mt-0.5">
                                                        <span className="text-[10px] text-slate-500 font-medium">
                                                            {typeof msg.timestamp === 'string' && msg.timestamp.includes('T')
                                                                ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                                : "Just now"
                                                            }
                                                        </span>
                                                        {isCounselor && <CheckCheck size={14} className="text-[#53BDEB]" />}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </AnimatePresence>
                            </div>

                            {/* Input Area (WhatsApp Style) */}
                            <div className="bg-[#F0F2F5] p-2 flex items-end gap-2 z-20 shrink-0">
                                <div className="bg-white flex-1 rounded-2xl flex items-center px-4 py-2 shadow-sm border border-slate-100">
                                    <button className="text-slate-400 hover:text-slate-600 mr-3 transition-colors">
                                        <Paperclip size={20} />
                                    </button>
                                    <textarea
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                        className="flex-1 bg-transparent border-none outline-none resize-none max-h-32 py-1 text-slate-800 placeholder:text-slate-400"
                                        placeholder="Type a message"
                                        rows={1}
                                        style={{ minHeight: '24px' }}
                                    />
                                </div>

                                <button
                                    onClick={chatInput.trim() ? handleSendMessage : null}
                                    className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md transition-all ${chatInput.trim()
                                        ? "bg-[#008069] text-white hover:bg-[#006e5a] active:scale-95"
                                        : "bg-[#008069] text-white hover:bg-[#006e5a]"
                                        }`}
                                >
                                    {chatInput.trim() ? <Send size={20} className="ml-0.5" /> : <Mic size={20} />}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence >
        </div >
    );
};

export default CounsellorDashboard;
