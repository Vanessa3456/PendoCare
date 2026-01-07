import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
    getOrCreateConversation,
    sendMessage,
    subscribeToConversation,
    parseConversationLog
} from "../services/chatService";
import {
    ArrowLeft, Paperclip, Mic, Send, MoreVertical, Phone, Video,
    Check, CheckCheck, User, Clock, ShieldAlert
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const ChatInterface = () => {
    const navigate = useNavigate();
    // Access Code used as ID
    const studentCode = localStorage.getItem('user_name'); // e.g. NRB-1234
    const schoolName = localStorage.getItem('school_name') || 'Unknown School';

    const [conversation, setConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState("");
    const [isSending, setIsSending] = useState(false);

    const messagesEndRef = useRef(null);

    // 1. Initialize Conversation
    useEffect(() => {
        let subscription = null;

        const initChat = async () => {
            if (!studentCode) {
                navigate('/login');
                return;
            }

            console.log("[Chat] Initializing for:", studentCode);
            try {
                const conv = await getOrCreateConversation(studentCode);

                if (conv) {
                    setConversation(conv);
                    setMessages(parseConversationLog(conv.content));

                    // Subscribe to Realtime Updates
                    subscription = subscribeToConversation(conv.id, (updatedConv) => {
                        console.log("[Realtime] Update:", updatedConv);
                        setConversation(updatedConv);
                        setMessages(parseConversationLog(updatedConv.content));
                    });
                }
            } catch (err) {
                console.error("Chat init failed", err);
            }
        };

        initChat();

        return () => {
            if (subscription) subscription.unsubscribe();
        };
    }, [studentCode, navigate]);

    // 2. Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = async () => {
        if (!inputText.trim() || !conversation) return;

        const text = inputText;
        setInputText(""); // Optimistic clear
        setIsSending(true);

        try {
            await sendMessage(conversation.id, 'student', text);
            // Result will come via Realtime subscription
        } catch (err) {
            console.error("Failed to send:", err);
            setInputText(text); // Revert on failure
        } finally {
            setIsSending(false);
        }
    };

    // Determine Counsellor Status
    const isCounsellorConnected = !!conversation?.counsellor_id;

    return (
        <div className="min-h-screen bg-[#E5DDD5] flex flex-col relative overflow-hidden">
            {/* WhatsApp-style Background Pattern Overlay */}
            <div className="absolute inset-0 opacity-[0.06] pointer-events-none bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat"></div>

            {/* Header */}
            <div className="bg-[#008069] text-white px-4 py-3 flex items-center shadow-md z-10 sticky top-0">
                <button onClick={() => navigate("/dashboard/high")} className="mr-2 rounded-full p-1 hover:bg-white/10 transition">
                    <ArrowLeft size={24} />
                </button>

                <div className="w-10 h-10 bg-slate-300 rounded-full flex items-center justify-center overflow-hidden mr-3 border border-white/20">
                    <User className="text-slate-500" />
                </div>

                <div className="flex-1">
                    <h1 className="font-bold text-lg leading-tight">
                        {isCounsellorConnected ? "Counsellor Connected" : "Waiting for Counsellor..."}
                    </h1>
                    <p className="text-xs text-green-100 opacity-90 truncate">
                        {isCounsellorConnected ? "Online" : "Connecting you to a professional..."}
                    </p>
                </div>

                <div className="flex items-center gap-4 text-white/80">
                    <Video size={24} className="cursor-pointer hover:text-white" />
                    <Phone size={22} className="cursor-pointer hover:text-white" />
                    <MoreVertical size={22} className="cursor-pointer hover:text-white" />
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 z-10">

                {/* Security / Encryption Notice */}
                <div className="flex justify-center mb-6">
                    <div className="bg-[#FFF5C4] text-[#5E5151] text-xs px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 max-w-[85%] text-center">
                        <ShieldAlert size={12} className="shrink-0" />
                        <span>Messages are end-to-end encrypted. {conversation?.risk_level === 'high' && <span className="font-bold text-red-600 block mt-1">Status: High Priority Support</span>}</span>
                    </div>
                </div>

                {/* Messages */}
                <AnimatePresence>
                    {messages.map((msg, idx) => {
                        const isMe = msg.role === 'student';

                        return (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className={`flex ${isMe ? "justify-end" : "justify-start"} mb-1`}
                            >
                                <div
                                    className={`relative max-w-[80%] px-3 py-1.5 rounded-lg shadow-sm text-[15px] leading-relaxed break-words ${isMe
                                        ? "bg-[#E7FFDB] text-slate-800 rounded-tr-none"
                                        : "bg-white text-slate-800 rounded-tl-none"
                                        }`}
                                >
                                    {/* Tail SVG Mockup (Simplified via CSS) */}
                                    {isMe ? (
                                        <div className="absolute top-0 -right-[8px] w-0 h-0 border-t-[10px] border-t-[#E7FFDB] border-r-[10px] border-r-transparent" />
                                    ) : (
                                        <div className="absolute top-0 -left-[8px] w-0 h-0 border-t-[10px] border-t-white border-l-[10px] border-l-transparent" />
                                    )}

                                    <p>{msg.text}</p>

                                    <div className="flex justify-end items-center gap-1 mt-0.5">
                                        <span className="text-[10px] text-slate-500 font-medium">
                                            {/* We can parse msg.timestamp if needed, or mostly rely on it being ISO */}
                                            {typeof msg.timestamp === 'string' && msg.timestamp.includes('T')
                                                ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                : "Just now"
                                            }
                                        </span>
                                        {isMe && <CheckCheck size={14} className="text-[#53BDEB]" />}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="bg-[#F0F2F5] p-2 flex items-end gap-2 z-20">
                <div className="bg-white flex-1 rounded-2xl flex items-center px-4 py-2 shadow-sm border border-slate-100">
                    <button className="text-slate-400 hover:text-slate-600 mr-3 transition-colors">
                        <Paperclip size={20} />
                    </button>
                    <textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                            }
                        }}
                        className="flex-1 bg-transparent border-none outline-none resize-none max-h-24 py-1 text-slate-800 placeholder:text-slate-400"
                        placeholder="Type a message"
                        rows={1}
                        style={{ minHeight: '24px' }}
                        disabled={isSending}
                    />
                </div>

                <button
                    onClick={inputText.trim() ? handleSendMessage : null}
                    className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md transition-all ${inputText.trim()
                        ? "bg-[#008069] text-white hover:bg-[#006e5a] active:scale-95"
                        : "bg-[#008069] text-white hover:bg-[#006e5a]"
                        }`}
                    disabled={isSending}
                >
                    {inputText.trim() ? <Send size={20} className="ml-0.5" /> : <Mic size={20} />}
                </button>
            </div>
        </div>
    );
};

export default ChatInterface;
