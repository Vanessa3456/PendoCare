require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createClient } = require('@supabase/supabase-js');
const http = require('http');
const nodemailer = require('nodemailer');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const jwt = require('jsonwebtoken');

// --- Initialization ---
const app = express();
const server = http.createServer(app);
const allowedOrigins = [
    "http://localhost:5173",
    process.env.CLIENT_URL ? process.env.CLIENT_URL.replace(/\/$/, "") : ""
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        const normalizedOrigin = origin.replace(/\/$/, "");
        if (allowedOrigins.includes(origin) || allowedOrigins.includes(normalizedOrigin)) {
            callback(null, true);
        } else {
            console.log(`[CORS Blocked] Origin: ${origin}. Allowed: ${JSON.stringify(allowedOrigins)}`);
            callback(new Error("CORS not allowed - Check CLIENT_URL on Render"));
        }
    },
    credentials: true
}));


// --- Middleware ---
app.use(helmet()); // Basic security headers
app.use(morgan('dev')); // Logging
// app.use(cors());
app.use(express.json());

// --- Supabase Config ---
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// --- Gemini AI Config ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
    model: "gemini-pro",
    systemInstruction: `You are Pendo, a compassionate mental health companion for Kenyan high school students. 
    Use supportive, non-judgmental language. Be brief but warm. 
    If a user mentions self-harm or suicide, you MUST output the exact code [[ESCALATE_TO_HUMAN]] and encourage them to speak to a counsellor.`
});

// --- Email Transporter ---
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT == 465,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// --- Auth Middlewares ---

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
        req.user = user;
        next();
    });
};

const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied. Unauthorized role.' });
        }
        next();
    };
};

// --- Routes ---
app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "Backend is alive 🚀" });
});

/**
 * 1. School Access Request
 * Stores request in Supabase 'access_requests' table
 */
app.post('/api/request-access', async (req, res) => {
    const { name, email, contactPerson, phone } = req.body;

    if (!name || !email) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const { data, error } = await supabase
            .from('access_requests')
            .insert([{
                school_name: name,
                school_email: email,
                contact_person: contactPerson,
                phone_number: phone,
                status: 'pending'
            }])
            .select();

        if (error) throw error;

        console.log(`[DB] New Request stored for: ${name}`);
        return res.status(201).json({ message: 'Request submitted successfully', data });
    } catch (err) {
        console.error('[Error] DB Insert:', err.message);
        return res.status(500).json({ error: 'Failed to save request' });
    }
});

/**
 * 1.5 Admin: Fetch Pending Requests
 */
app.get('/api/admin/requests', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('access_requests')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return res.json(data);
    } catch (err) {
        console.error('[Error] Fetching Requests:', err);
        return res.status(500).json({ error: 'Failed to fetch requests' });
    }
});

/**
 * 2. Admin: Approve Request
 * Generates code, updates DB, sends email
 */
app.post('/api/admin/approve/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    const { id } = req.params;
    const accessCode = "NRB-" + Math.floor(1000 + Math.random() * 9000);

    try {
        // 1. Get request details
        const { data: request, error: fetchErr } = await supabase
            .from('access_requests')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchErr || !request) return res.status(404).json({ error: 'Request not found' });

        // 2. Update status to approved and save access code
        const { error: updateErr } = await supabase
            .from('access_requests')
            .update({
                status: 'approved',
                access_code: accessCode // Store the generated code
            })
            .eq('id', id);

        if (updateErr) throw updateErr;

        // 3. Send Email (Attempt, don't block if it fails)
        let emailSent = false;
        try {
            const mailOptions = {
                from: `"Pendo Admin" <${process.env.EMAIL_USER}>`,
                to: request.school_email,
                subject: "Pendo Platform Access Approved",
                text: `Hello ${request.contact_person},\n\nYour school's access to Pendo has been approved. \n\nYour Access Code: ${accessCode}\n\nShare this with your students to begin.`,
                html: `<h3>Welcome to Pendo</h3><p>Your Access Code is: <b>${accessCode}</b></p>`
            };

            await transporter.sendMail(mailOptions);
            console.log(`[Email] Sent access code to ${request.school_email}`);
            emailSent = true;
        } catch (mailErr) {
            console.error('[Email Error] Failed to send email:', mailErr.message);
            // We don't throw here so the user still gets the "Approved" feedback
        }

        return res.json({
            message: emailSent ? 'Approved and email sent' : 'Approved (Email failed to send)',
            accessCode,
            emailSent
        });
    } catch (err) {
        console.error('[Error] Approval Flow:', err);
        return res.status(500).json({ error: 'Failed to process approval', details: err.message });
    }
});

/**
 * 3. Admin: Reject Request
 * Deletes request from DB
 */
app.delete('/api/admin/request/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase
            .from('access_requests')
            .delete()
            .eq('id', id);

        if (error) throw error;

        console.log(`[DB] Request deleted: ${id}`);
        return res.json({ message: 'Request rejected and deleted successfully' });
    } catch (err) {
        console.error('[Error] Rejection Flow:', err);
        return res.status(500).json({ error: 'Failed to reject request' });
    }
});

/**
 * 3.1 Admin: Fetch Approved Schools
 */
app.get('/api/admin/schools/approved', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('access_requests')
            .select('*')
            .eq('status', 'approved')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return res.json(data);
    } catch (err) {
        console.error('[Error] Fetching Approved Schools:', err);
        return res.status(500).json({ error: 'Failed to fetch approved schools' });
    }
});

/**
 * 3.2 General: Fetch Counselors (Accessible by Students/Staff)
 */
app.get('/api/counselors', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('counselors')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;
        return res.json(data);
    } catch (err) {
        console.error('[Error] Fetching Counselors:', err);
        return res.status(500).json({ error: 'Failed to fetch counselors' });
    }
});

/**
 * 3.2 Admin: Counselor CRUD
 */
app.get('/api/admin/counselors', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('counselors')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;
        return res.json(data);
    } catch (err) {
        console.error('[Error] Fetching Counselors:', err);
        return res.status(500).json({ error: 'Failed to fetch counselors' });
    }
});

/**
 * 3.1.5 Unified Access Verification
 * This is the ONE point of entry for all roles
 */
app.post('/api/verify-access', async (req, res) => {
    const { code: rawCode } = req.body;

    if (!rawCode) return res.status(400).json({ error: 'Access code is required' });

    const code = rawCode.trim().toUpperCase();
    console.log(`[Auth] Verifying code: "${code}"`);

    try {
        // 1. Super Admin Check
        // First: Check Database for 'admins' table
        let adminUser = null;
        try {
            const { data, error } = await supabase
                .from('admins')
                .select('*')
                .eq('access_code', code)
                .single();

            if (data && !error) {
                adminUser = data;
            }
        } catch (dbErr) {
            // Table might not exist yet, ignore
            console.log("Admin table check failed (table might be missing), falling back to env/hardcode");
        }

        // Second: Fallback to Environment/Hardcoded if not found in DB
        const isHardcodedAdmin = (code === 'ADMIN-1234' || code === process.env.ADMIN_CODE);

        if (adminUser || isHardcodedAdmin) {
            console.log(`[Auth] Match found: Super Admin ${adminUser ? '(DB)' : '(Legacy)'}`);
            const user = adminUser
                ? { id: adminUser.id, name: adminUser.username, role: 'admin' }
                : { name: 'Super Admin', role: 'admin' };

            const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '8h' });
            return res.json({
                role: 'admin',
                redirect: '/admin',
                user,
                token
            });
        }

        // 2. Counselor Check (CNSL-XXXX)
        if (code.startsWith('CNSL-')) {
            const { data, error } = await supabase
                .from('counselors')
                .select('*')
                .eq('access_code', code)
                .single();

            if (error) console.log(`[Auth] Counselor Lookup Error:`, error.message);

            if (data) {
                console.log(`[Auth] Match found: Counselor "${data.name}"`);
                const user = { id: data.id, name: data.name, role: 'counsellor' };
                const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '8h' });
                return res.json({
                    role: 'counsellor',
                    redirect: '/counsellor',
                    user: data,
                    token
                });
            }
        }

        // 3. School Admin / Student Check (NRB-XXXX)
        if (code.startsWith('NRB-')) {
            const { data, error } = await supabase
                .from('access_requests')
                .select('*')
                .eq('access_code', code)
                .eq('status', 'approved')
                .single();

            if (error) console.log(`[Auth] School Lookup Error:`, error.message);

            if (data) {
                console.log(`[Auth] Match found: School "${data.school_name}"`);
                const user = { school: data.school_name, role: 'student' };
                const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '8h' });
                return res.json({
                    role: 'student',
                    redirect: '/triage',
                    school: data.school_name,
                    token
                });
            }
        }

        // 4. Default Fail
        console.log(`[Auth] No match found for code "${code}"`);
        return res.status(401).json({ error: 'Invalid or inactive access code.' });

    } catch (err) {
        console.error('[Auth Error] Code Verification Failed:', err.message);
        return res.status(500).json({ error: 'Verification system error' });
    }
});

app.post('/api/admin/counselors', async (req, res) => {
    const { name, email, specialty, experience_years, work_days, work_hours, assigned_school } = req.body;

    // Generate unique access code for counselor
    const accessCode = "CNSL-" + Math.floor(1000 + Math.random() * 9000);

    console.log('[Debug] Creating counselor with data:', {
        name, email, specialty, experience_years, work_days, work_hours, assigned_school, accessCode
    });

    try {
        const { data, error } = await supabase
            .from('counselors')
            .insert([{
                name,
                email,
                specialty,
                experience_years: parseInt(experience_years) || 0,
                work_days,
                work_hours,
                assigned_school,
                access_code: accessCode
            }])
            .select();

        if (error) {
            console.error('[Supabase Error] Details:', {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint
            });
            throw error;
        }

        console.log('[Success] Counselor created:', data[0]);

        // Send email with access code
        let emailSent = false;
        try {
            const mailOptions = {
                from: `"Pendo Admin" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: "Welcome to Pendo - Your Counselor Access Code",
                text: `Hello ${name},\n\nWelcome to the Pendo platform! You have been registered as a counselor.\n\nYour Access Code: ${accessCode}\n\nAssigned School: ${assigned_school || 'Not assigned yet'}\nSpecialty: ${specialty || 'General'}\nWork Days: ${work_days || 'Not specified'}\nWork Hours: ${work_hours || 'Not specified'}\n\nPlease use this access code to log in to your counselor dashboard.\n\nBest regards,\nPendo Team`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #008069;">Welcome to Pendo!</h2>
                        <p>Hello <strong>${name}</strong>,</p>
                        <p>You have been registered as a counselor on the Pendo mental health platform.</p>
                        
                        <div style="background: #f0f9ff; border-left: 4px solid #008069; padding: 16px; margin: 20px 0;">
                            <h3 style="margin-top: 0; color: #008069;">Your Access Code</h3>
                            <p style="font-size: 24px; font-weight: bold; color: #008069; margin: 10px 0;">${accessCode}</p>
                        </div>
                        
                        <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0;">
                            <h4 style="margin-top: 0;">Your Profile Details:</h4>
                            <p><strong>Assigned School:</strong> ${assigned_school || 'Not assigned yet'}</p>
                            <p><strong>Specialty:</strong> ${specialty || 'General'}</p>
                            <p><strong>Work Days:</strong> ${work_days || 'Not specified'}</p>
                            <p><strong>Work Hours:</strong> ${work_hours || 'Not specified'}</p>
                        </div>
                        
                        <p>Please use this access code to log in to your counselor dashboard and start supporting students.</p>
                        
                        <p style="margin-top: 30px; color: #64748b; font-size: 14px;">
                            Best regards,<br>
                            <strong>Pendo Team</strong>
                        </p>
                    </div>
                `
            };

            await transporter.sendMail(mailOptions);
            console.log(`[Email] Sent access code to ${email}`);
            emailSent = true;
        } catch (mailErr) {
            console.error('[Email Error] Failed to send counselor access code:', mailErr.message);
            // Don't fail the request if email fails
        }

        return res.status(201).json({
            ...data[0],
            emailSent
        });
    } catch (err) {
        console.error('[Error] Creating Counselor:', err);
        return res.status(500).json({
            error: 'Failed to create counselor',
            details: err.message,
            hint: err.hint
        });
    }
});

app.put('/api/admin/counselors/:id', async (req, res) => {
    const { id } = req.params;
    const { name, email, specialty, experience_years, work_days, work_hours, assigned_school } = req.body;
    try {
        const { data, error } = await supabase
            .from('counselors')
            .update({
                name,
                email,
                specialty,
                experience_years: parseInt(experience_years) || 0,
                work_days,
                work_hours,
                assigned_school,
                updated_at: new Date()
            })
            .eq('id', id)
            .select();

        if (error) throw error;
        return res.json(data[0]);
    } catch (err) {
        console.error('[Error] Updating Counselor:', err);
        return res.status(500).json({ error: 'Failed to update counselor' });
    }
});

app.delete('/api/admin/counselors/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase
            .from('counselors')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return res.json({ message: 'Counselor deleted successfully' });
    } catch (err) {
        console.error('[Error] Deleting Counselor:', err);
        return res.status(500).json({ error: 'Failed to delete counselor' });
    }
});

// Admin Route to view all sessions (Active and Completed)
app.get('/api/admin/conversations', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('conversations')
            .select(`
                *,
                counselors (
                    name
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return res.json(data);
    } catch (err) {
        console.error('[Error] Admin Fetch Conversations:', err);
        return res.status(500).json({ error: 'Failed to fetch conversations' });
    }
});

/**
 * 3. Gemini Chat Integration
 */
app.post('/api/chat/gemini', authenticateToken, authorizeRoles('student'), async (req, res) => {
    const { message, history } = req.body;

    try {
        const chat = model.startChat({
            history: history || [],
            generationConfig: { maxOutputTokens: 250 },
        });

        const result = await chat.sendMessage(message);
        const responseText = result.response.text();

        const escalate = responseText.includes('[[ESCALATE_TO_HUMAN]]');

        return res.json({
            response: responseText.replace('[[ESCALATE_TO_HUMAN]]', '').trim(),
            escalate: escalate
        });
    } catch (err) {
        console.error('[Error] Gemini API:', err);
        return res.status(500).json({ error: 'AI processing failed' });
    }
});

// --- Session State Removed (Using Database and Realtime instead) ---

/**
 * 4. Save Triage Result
 */
app.post('/api/triage', authenticateToken, authorizeRoles('student'), async (req, res) => {
    const { studentId, score, riskLevel, hasCritical } = req.body;

    try {
        const { data, error } = await supabase
            .from('triage_records')
            .insert([{
                student_id: studentId,
                score_depression: score,
                risk_level: riskLevel,
                flagged_for_self_harm: hasCritical
            }])
            .select();

        if (error) throw error;
        return res.status(201).json(data);
    } catch (err) {
        console.error('[Error] Triage Save:', err);
        return res.status(500).json({ error: 'Failed to save triage' });
    }
});



app.post('/api/start-session', authenticateToken, authorizeRoles('counsellor', 'admin'), (req, res) => {
    // Session tracking moved to Database/Realtime notification flow
    res.json({ success: true });
});

app.post('/api/send-meeting-link', authenticateToken, authorizeRoles('counsellor', 'admin'), async (req, res) => {
    const { studentEmail, counselorEmail, counselorName, date, time, meetLink } = req.body;

    try {
        const mailOptions = {
            from: `"Pendo Counseling" <${process.env.EMAIL_USER}>`,
            to: `${studentEmail}, ${counselorEmail}`, // Alert both
            subject: "Pendo Counseling: Your Video Session is Ready",
            text: `Hello,\n\nA counseling session has been scheduled between Student (${studentEmail}) and ${counselorName}.\n\nDate: ${date}\nTime: ${time}\n\nJoin the session here: ${meetLink}`,
            html: `
                <h3>Pendo Counseling Session</h3>
                <p><b>Counselor:</b> ${counselorName}</p>
                <p><b>Date:</b> ${date}</p>
                <p><b>Time:</b> ${time}</p>
                <p>Your private meeting room is ready. Click below to join:</p>
                <a href="${meetLink}" style="display:inline-block; padding:12px 24px; background:#008069; color:white; text-decoration:none; border-radius:8px; font-weight:bold;">Join Meeting Now</a>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`[Email] Meeting links sent to ${studentEmail} and ${counselorEmail}`);

        // Insert Notification into Supabase for Real-time Dashboard Alert
        const { error: notifError } = await supabase
            .from('notifications')
            .insert([{
                type: 'video_meeting',
                payload: {
                    counselorName,
                    studentEmail,
                    date,
                    time,
                    meetLink,
                    timestamp: Date.now()
                }
            }]);

        if (notifError) {
            console.error('[DB Error] Notification Insert:', notifError);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[Email Error] Failed to send meeting link:', err);
        res.status(500).json({ error: 'Failed to send notification' });
    }
});

/**
 * 6. Save Chat Message to DB
 */
app.post('/api/chat/save', authenticateToken, async (req, res) => {
    const { room, text, senderId, role } = req.body;

    try {
        // Attempt to find or create session in chat_sessions first (logic simplified for demo)
        // For now, we'll just log it or attempt to push to chat_messages if you have the table
        const { error } = await supabase
            .from('chat_messages')
            .insert([{
                content: text,
                sender_role: role,
                // session_id: ... you would need to map the room name to a session UUID
            }]);

        // If the above fails because session_id is missing, we still return 200 for the socket path
        console.log(`[Chat] Message from ${role} (${senderId}) in ${room}: ${text}`);
        res.json({ success: true });
    } catch (err) {
        console.error('[DB Error] Chat Save:', err);
        res.status(500).json({ error: 'Failed to record chat' });
    }
});

// --- Socket.IO Removed: Using Supabase Realtime ---

// --- Health Check ---
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Pendo Backend started on port ${PORT}`);
});
