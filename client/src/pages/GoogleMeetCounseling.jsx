import React, { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import {
    AlertTriangle, Video, Calendar, Clock, User,
    ArrowLeft, CheckCircle, Sparkles, Shield, Mail
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Custom UI Components (Replacements for Shadcn)
const CustomButton = ({ children, onClick, variant = 'primary', className = '', size = 'md', disabled }) => {
    const baseStyles = "inline-flex items-center justify-center rounded-2xl font-bold transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none";
    const variants = {
        primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-100",
        secondary: "bg-white text-slate-900 border-2 border-slate-100 hover:border-brand-200 hover:text-brand-600 shadow-sm",
        ghost: "text-slate-500 hover:text-brand-600 hover:bg-brand-50",
        success: "bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-100",
        outline: "bg-transparent text-slate-600 border-2 border-slate-200 hover:border-brand-200 hover:text-brand-600"
    };
    const sizes = {
        sm: "px-4 py-2 text-sm",
        md: "px-6 py-3 text-base",
        lg: "px-8 py-4 text-lg"
    };

    return (
        <button onClick={onClick} disabled={disabled} className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}>
            {children}
        </button>
    );
};

const CustomCard = ({ children, className = '', onClick }) => (
    <div
        onClick={onClick}
        className={`bg-white rounded-[2.5rem] border border-slate-100 shadow-soft overflow-hidden ${className}`}
    >
        {children}
    </div>
);

const GoogleMeetCounseling = () => {
    const navigate = useNavigate();
    const [counselors, setCounselors] = useState([]);
    const schoolName = localStorage.getItem('school_name');
    const studentNickname = localStorage.getItem('user_name') || 'Student';

    const [formData, setFormData] = useState({
        counselorId: null,
        date: '',
        time: '',
        email: studentNickname,
        meetLink: ''
    });
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(true);

    // Fetch Counselors from DB (Filtered by School)
    useEffect(() => {
        const fetchCounselors = async () => {
            try {
                const response = await api.get('/api/counselors');
                const data = response.data;

                // Filter by school name from localStorage
                const filteredData = schoolName
                    ? data.filter(c => c.assigned_school === schoolName)
                    : data;

                console.log(filteredData);
                // Map DB data to UI format
                const mappedCounselors = filteredData.map(c => ({
                    ...c,
                    // Use emoji based on name/index for now, or a generic one
                    image: c.name.includes('Sarah') || c.name.includes('Grace') ? '👩‍⚕️' : '👨‍⚕️',
                    experience: `${c.experience_years}+ Years Experience`
                }));

                setCounselors(mappedCounselors);
            } catch (error) {
                console.error('Error fetching counselors:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchCounselors();
    }, [schoolName]);



    const updateFormData = (field, value) => {
        if (field === 'counselorId') {
            const now = new Date();
            const currentDate = now.toISOString().split('T')[0];
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:00`;

            setFormData(prev => ({
                ...prev,
                [field]: value,
                date: currentDate,
                time: currentTime
            }));
        } else {
            setFormData(prev => ({ ...prev, [field]: value }));
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        const meetingId = `Pendo-Session-${Date.now()}`;
        const meetLink = `https://meet.jit.si/${meetingId}`;
        const counselor = counselors.find(c => c.id === formData.counselorId);
        const schoolEmail = `${studentNickname.toLowerCase().replace(/\s+/g, '.')}@pendo.care`;

        const endTime = Date.now() + (50 * 60 * 1000);

        try {
            // API calls to backend
            await api.post('/start-session', {
                counselorId: formData.counselorId,
                studentEmail: schoolEmail,
                endTime
            });

            await api.post('/send-meeting-link', {
                studentEmail: schoolEmail,
                counselorEmail: counselor.email,
                counselorName: counselor.name,
                date: formData.date,
                time: formData.time,
                meetLink: meetLink
            });
        } catch (error) {
            console.error('API Error:', error);
        }

        setFormData(prev => ({ ...prev, meetLink: meetLink, email: schoolEmail }));
        setSubmitted(true);
        setLoading(false);
    };

    if (submitted) {
        const counselor = counselors.find(c => c.id === formData.counselorId);
        return (
            <div className="min-h-screen bg-slate-50 py-12 px-4 flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-2xl w-full"
                >
                    <CustomCard className="shadow-2xl border-none">
                        <div className="bg-green-500 p-12 text-center text-white relative overflow-hidden">
                            <div className="relative z-10">
                                <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
                                    <Video size={40} />
                                </div>
                                <h2 className="text-4xl font-black mb-2 tracking-tight">Meeting Room Ready!</h2>
                                <p className="text-green-100 font-medium tracking-wide">Your secure session is waiting for you.</p>
                            </div>
                            <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
                        </div>

                        <div className="p-8 md:p-12">
                            <div className="bg-slate-50 border-2 border-slate-100 p-8 rounded-[2rem] mb-8">
                                <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                                    <Shield className="text-brand-600" size={24} /> Session Details
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Counselor</span>
                                        <span className="text-lg font-bold text-slate-800">{counselor.name}</span>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Duration</span>
                                        <span className="text-lg font-bold text-slate-800">50 Minutes</span>
                                    </div>
                                    <div className="md:col-span-2 space-y-1">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Date</span>
                                        <span className="text-lg font-bold text-slate-800">
                                            {new Date(formData.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-amber-50 border-2 border-amber-100 p-6 rounded-2xl mb-8 flex gap-4">
                                <AlertTriangle className="text-amber-600 shrink-0" size={24} />
                                <p className="text-amber-900 font-medium">
                                    <strong>Before joining:</strong> Ensure you are in a quiet, private space. Your conversation is secure and strictly confidential.
                                </p>
                            </div>

                            <CustomButton
                                variant="success"
                                size="lg"
                                className="w-full !rounded-3xl shadow-green-200"
                                onClick={() => window.open(formData.meetLink, '_blank')}
                            >
                                <Video className="w-6 h-6 mr-3" />
                                Join Private Session Now
                            </CustomButton>

                            <div className="mt-8 text-center pt-8 border-t border-slate-100 space-y-6">
                                <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.2em] mb-4">Direct Access Link</p>
                                <div className="flex items-center gap-2 bg-slate-100 p-4 rounded-2xl border border-slate-200">
                                    <code className="flex-1 text-sm font-bold text-slate-600 truncate">{formData.meetLink}</code>
                                </div>

                                <div className="flex items-center justify-center gap-3 text-brand-600 bg-brand-50 p-4 rounded-2xl">
                                    <Clock size={20} />
                                    <span className="text-sm font-bold">Room active for 50 minutes</span>
                                </div>

                                <CustomButton variant="outline" className="w-full !rounded-2xl" onClick={() => window.location.reload()}>
                                    Cancel and Go Back
                                </CustomButton>
                            </div>
                        </div>
                    </CustomCard>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 selection:bg-brand-100">
            <div className="max-w-4xl mx-auto">
                <CustomButton variant="ghost" onClick={() => navigate(-1)} className="mb-8">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </CustomButton>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-50 border-2 border-red-100 rounded-[2rem] p-6 mb-12 flex gap-4 items-center"
                >
                    <AlertTriangle className="text-red-500 shrink-0" size={24} />
                    <p className="text-red-900 font-medium">
                        <strong>Immediate Crisis Support:</strong> Please call <strong>0800 720 648</strong> or <strong>999 / 112</strong> if you are in immediate danger.
                    </p>
                </motion.div>

                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">Book a Private Session</h1>
                    <p className="text-xl text-slate-500 font-medium">Choose a professional and start your video call immediately.</p>
                </div>

                <CustomCard className="shadow-2xl border-none">
                    <div className="p-8 md:p-12">
                        <div className="flex items-center gap-4 mb-10">
                            <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center text-brand-600 shadow-sm">
                                <User size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Select Your Counselor</h2>
                                <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Licensed Professionals Only</p>
                            </div>
                        </div>

                        <div className="grid gap-4">
                            {counselors.map(counselor => {
                                const isAvailable = true; // Always available per user request
                                const isSelected = formData.counselorId === counselor.id;

                                return (
                                    <div
                                        key={counselor.id}
                                        onClick={() => isAvailable && updateFormData('counselorId', counselor.id)}
                                        className={`group p-6 rounded-[2rem] border-2 transition-all relative overflow-hidden cursor-pointer ${!isAvailable
                                            ? 'border-slate-100 bg-slate-50 cursor-not-allowed grayscale'
                                            : isSelected
                                                ? 'border-brand-500 bg-brand-50/50 shadow-lg'
                                                : 'border-slate-100 hover:border-brand-200 hover:bg-slate-50'
                                            }`}
                                    >
                                        {!isAvailable && (
                                            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] z-10 flex items-center justify-center">
                                                <div className="bg-white px-4 py-2 rounded-xl text-slate-900 font-black text-sm flex items-center gap-2 shadow-xl">
                                                    <Clock size={16} /> Currently in Session
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-6 relative z-0">
                                            <div className="w-20 h-20 bg-white rounded-3xl text-4xl flex items-center justify-center shadow-soft group-hover:scale-110 transition-transform">
                                                {counselor.image}
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-xl font-extrabold text-slate-900 mb-1">{counselor.name}</h3>
                                                <p className="text-slate-500 font-bold text-sm mb-1">{counselor.specialty}</p>
                                                <p className="text-xs text-slate-400 font-medium italic">{counselor.experience}</p>

                                                <div className={`inline-flex items-center gap-2 mt-4 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${isAvailable
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-slate-200 text-slate-500'
                                                    }`}>
                                                    <span className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`}></span>
                                                    {isAvailable ? 'Available Now' : 'In Session'}
                                                </div>
                                            </div>
                                            {isSelected && isAvailable && (
                                                <div className="w-10 h-10 bg-brand-600 rounded-full flex items-center justify-center text-white shadow-lg animate-fade-in shadow-brand-100">
                                                    <CheckCircle size={24} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-12 flex flex-col md:flex-row items-center justify-between gap-6 p-10 bg-slate-50 rounded-[2.5rem] border border-slate-100 overflow-hidden relative">
                            <div className="relative z-10">
                                <h4 className="text-xl font-black text-slate-900 mb-1 tracking-tight">Ready to begin?</h4>
                                <p className="text-slate-500 font-medium">Your meeting link will be generated instantly.</p>
                            </div>
                            <CustomButton
                                onClick={handleSubmit}
                                disabled={!formData.counselorId || loading}
                                size="lg"
                                className="w-full md:w-auto !rounded-2xl relative z-10"
                            >
                                {loading ? (
                                    <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <Video className="w-5 h-5 mr-3" />
                                        {formData.counselorId ? 'Create Meeting Room' : 'Select a Counselor'}
                                    </>
                                )}
                            </CustomButton>
                            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-brand-100 rounded-full blur-3xl opacity-30"></div>
                        </div>
                    </div>
                </CustomCard>
            </div>
        </div>
    );
};

export default GoogleMeetCounseling;
