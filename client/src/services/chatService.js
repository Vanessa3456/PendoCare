
import { supabase } from '../supabase';

export function parseConversationLog(logText) {
    if (!logText) return [];

    const lines = logText.split('\n').filter(line => line.trim() !== '');

    return lines.map((line, index) => {
        const match = line.match(/^\[(.*?)\] (.*?): (.*)$/);

        if (match) {
            return {
                id: index,
                timestamp: match[1],
                role: match[2].toLowerCase(),
                text: match[3],
                senderId: match[2]
            };
        }
        return {
            id: index,
            timestamp: new Date().toISOString(),
            role: 'unknown',
            text: line,
            senderId: 'Unknown'
        };
    });
}

/**
 * Creates or retrieves a conversation for a student (by Access Code).
 */
export async function getOrCreateConversation(studentExternalId) {
    // 1. Try to find an open existing conversation
    const { data: existing, error: findError } = await supabase
        .from('conversations')
        .select('*')
        .eq('student_external_id', studentExternalId)
        .neq('risk_level', 'completed') // Assuming we might mark completed later
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (existing && !findError) {
        return existing;
    }

    // 2. Create new if none exists
    const { data, error } = await supabase
        .from('conversations')
        .insert([{
            student_external_id: studentExternalId,
            content: '',
            risk_level: 'none',
            escalated: false
        }])
        .select()
        .single();

    if (error) {
        console.error('Error creating conversation:', error);
        return null;
    }
    return data;
}

export async function sendMessage(conversationId, role, message) {
    if (!message || !message.trim()) return null;

    const { error } = await supabase.rpc('append_chat_message', {
        p_conversation_id: conversationId,
        p_role: role.toUpperCase(),
        p_message: message.trim()
    });

    if (error) {
        console.error('Error sending message:', error);
        return null;
    }
    return true;
}

export async function getConversation(conversationId) {
    const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

    if (error) {
        console.error('Error fetching conversation:', error);
        return null;
    }
    return data;
}

/**
 * Subscribes to changes in a specific conversation.
 */
export function subscribeToConversation(conversationId, onUpdate) {
    return supabase
        .channel(`chat:${conversationId}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'conversations',
                filter: `id=eq.${conversationId}`
            },
            (payload) => {
                onUpdate(payload.new);
            }
        )
        .subscribe();
}

/**
 * (Counsellor) Fetches the queue (Escalated or Unassigned).
 */
export async function fetchQueue() {
    // Fetch critical/high risk first, then general unassigned
    const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .is('counsellor_id', null)
        .order('escalated', { ascending: false })
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching queue:', error);
        return [];
    }
    return data;
}

/**
 * (Counsellor) Listens for ANY high risk escalation or new unassigned chat.
 */
export function subscribeToQueue(onUpdate) {
    return supabase
        .channel('global_queue')
        .on(
            'postgres_changes',
            {
                event: '*', // Listen to INSERT (new chats) and UPDATE (escalations)
                schema: 'public',
                table: 'conversations'
            },
            (payload) => {
                // Filter client side for now to be safe
                const rec = payload.new;
                if (!rec) return;

                // We care if it's escalated OR if it's unassigned
                if (rec.escalated || !rec.counsellor_id) {
                    onUpdate(rec);
                }
            }
        )
        .subscribe();
}

export async function joinConversation(conversationId, counsellorId) {
    const { data, error } = await supabase
        .from('conversations')
        .update({ counsellor_id: counsellorId })
        .eq('id', conversationId)
        .select()
        .single();

    if (error) {
        console.error('Error joining conversation:', error);
        return null;
    }
    return data;
}

export function subscribeToNotifications(onNotification) {
    return supabase
        .channel('global_notifications')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications'
            },
            (payload) => {
                onNotification(payload.new);
            }
        )
        .subscribe();
}
