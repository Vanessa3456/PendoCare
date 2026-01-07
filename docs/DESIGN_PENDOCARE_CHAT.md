# PendoCare Chat System Design

## 1. Data Model
We use a **single evolving document** approach for conversational integrity and simplicity.

### Table: `conversations`
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary Key |
| `student_id` | UUID | Links to Supabase Auth (User) |
| `counsellor_id` | UUID | Nullable. Assigned Counsellor |
| `content` | TEXT | **The entire conversation log.** Appended to atomically. |
| `risk_level` | TEXT | 'none', 'low', 'medium', 'high' |
| `escalated` | BOOLEAN | **True** triggers immediate counsellor alert. |

## 2. Message Appending
We do **not** use `INSERT` for messages. We use a **Remote Procedure Call (RPC)** to ensure atomicity and enforce the log format.

**Function:** `append_chat_message(p_conversation_id, p_role, p_message)`
- Appends: `[TIMESTAMP] ROLE: Message\n`
- Updates `updated_at`
- Prevents race conditions via database-level locking implicit in UPDATE.

## 3. Risk Detection
**Mechanism:** PostgreSQL `BEFORE UPDATE` Trigger.
**Why:** Verification happens **inside the transaction**. If a student types "I want to die", the conversation is flagged `escalated = true` *before* the update is even committed. No external API latency.

## 4. Realtime Escalation & Client Logic

### Client Setup (Javascript / React)

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('URL', 'ANON_KEY');

// 1. Sending a Message
async function sendMessage(conversationId, role, text) {
  const { error } = await supabase.rpc('append_chat_message', {
    p_conversation_id: conversationId,
    p_role: role, // 'STUDENT' or 'COUNSELLOR'
    p_message: text
  });
  
  if (error) console.error('Error sending:', error);
}

// 2. Listening for Updates (Chat Window)
function subscribeToChat(conversationId, onUpdate) {
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
        // Payload.new contains the updated 'content'
        onUpdate(payload.new.content);
      }
    )
    .subscribe();
}

// 3. Counsellor Dashboard: Listen for Escalations
function listenForEscalations(onEscalation) {
  return supabase
    .channel('global_escalations')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations',
        filter: 'escalated=eq.true' 
      },
      (payload) => {
        // A conversation just turned HIGH RISK
        onEscalation(payload.new);
      }
    )
    .subscribe();
}
```

## 5. Security (RLS)
- **Students**: Can only `SELECT` their own rows. `INSERT` new rows. NO direct `UPDATE`.
- **Counsellors**: Can view rows where `counsellor_id` matches theirs OR `escalated` is true (for the triage queue).
- **Updates**: Controlled strictly via the `append_chat_message` function (using `SECURITY DEFINER`) or limited counsellor updates.
