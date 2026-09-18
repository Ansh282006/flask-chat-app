const socket = io();

let username = '';
let room = '';
let userAvatar = '#4a90e2';
let messageIds = {};
let replyTo = null;
let soundEnabled = true;   // NEW: sound notification toggle

// Palette for avatar colors
const AVATAR_COLORS = [
    '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c',
    '#3498db', '#9b59b6', '#e84393', '#16a085', '#c0392b'
];

// Emoji list
const EMOJI_LIST = [
    '😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇',
    '🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚',
    '😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥳',
    '😏','😒','😞','😔','😟','😕','🙁','😣','😖','😫',
    '😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳',
    '🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭',
    '🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧',
    '😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢',
    '🤮','🤧','😷','🤒','🤕','🤑','🤠','😈','👿','👹',
    '👍','👎','👏','🙌','🙏','🤝','💪','✌️','🤞','🤟',
    '❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','💕',
    '🔥','✨','⭐','🌟','💫','💥','🎉','🎊','🎁','🎂'
];

// DOM Elements
const joinScreen = document.getElementById('joinScreen');
const chatScreen = document.getElementById('chatScreen');
const usernameInput = document.getElementById('usernameInput');
const roomInput = document.getElementById('roomInput');
const joinBtn = document.getElementById('joinBtn');
const leaveBtn = document.getElementById('leaveBtn');
const roomLabel = document.getElementById('roomLabel');
const messagesDiv = document.getElementById('messages');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const typingIndicator = document.getElementById('typingIndicator');
const typingText = document.getElementById('typingText');
const userList = document.getElementById('userList');
const userCount = document.getElementById('userCount');
const colorPicker = document.getElementById('colorPicker');
const avatarPreview = document.getElementById('avatarPreview');
const emojiBtn = document.getElementById('emojiBtn');
const emojiPicker = document.getElementById('emojiPicker');
const emojiGrid = document.getElementById('emojiGrid');
const replyPreview = document.getElementById('replyPreview');
const replyToUser = document.getElementById('replyToUser');
const replyToText = document.getElementById('replyToText');
const replyCancel = document.getElementById('replyCancel');
const soundToggle = document.getElementById('soundToggle');

// ============================================
// --- NEW: Sound Notification (Web Audio API) ---
// ============================================
let audioCtx = null;

function playNotificationSound() {
    if (!soundEnabled) return;

    try {
        // Lazy-init the Audio Context on first use (browsers block early autoplay)
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }

        // If the context is suspended, resume it (some browsers pause it after idle)
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        // Create two short "beeps" layered for a pleasant ding
        const now = audioCtx.currentTime;

        // First tone
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(880, now);                // A5
        gain1.gain.setValueAtTime(0.0001, now);
        gain1.gain.exponentialRampToValueAtTime(0.15, now + 0.01);
        gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        osc1.start(now);
        osc1.stop(now + 0.2);

        // Second, slightly higher tone
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1174.66, now + 0.08);     // D6
        gain2.gain.setValueAtTime(0.0001, now + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.12, now + 0.09);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.26);

    } catch (err) {
        console.warn('Audio error:', err);
    }
}

// --- Sound Toggle Button ---
soundToggle.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundToggle.textContent = soundEnabled ? '🔔' : '🔕';
    soundToggle.style.opacity = soundEnabled ? '1' : '0.5';

    // Play a quick preview sound when turning ON
    if (soundEnabled) playNotificationSound();
});

// --- Unlock Audio on First User Interaction (browser autoplay policy) ---
function unlockAudio() {
    if (!audioCtx) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {}
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    document.removeEventListener('click', unlockAudio);
    document.removeEventListener('keydown', unlockAudio);
}
document.addEventListener('click', unlockAudio);
document.addEventListener('keydown', unlockAudio);

// --- Build the Color Picker ---
AVATAR_COLORS.forEach((color, index) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'color-swatch';
    swatch.style.background = color;
    swatch.dataset.color = color;
    if (index === 0) swatch.classList.add('selected');
    swatch.addEventListener('click', () => {
        userAvatar = color;
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        swatch.classList.add('selected');
        updateAvatarPreview();
    });
    colorPicker.appendChild(swatch);
});

// --- Build the Emoji Grid ---
EMOJI_LIST.forEach(emoji => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'emoji-item';
    btn.textContent = emoji;
    btn.addEventListener('click', () => {
        const start = messageInput.selectionStart;
        const end = messageInput.selectionEnd;
        const text = messageInput.value;
        messageInput.value = text.substring(0, start) + emoji + text.substring(end);
        messageInput.selectionStart = messageInput.selectionEnd = start + emoji.length;
        messageInput.focus();
    });
    emojiGrid.appendChild(btn);
});

// --- Toggle Emoji Picker ---
emojiBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    emojiPicker.classList.toggle('d-none');
});

document.addEventListener('click', (e) => {
    if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) {
        emojiPicker.classList.add('d-none');
    }
});

// --- Live Avatar Preview ---
function updateAvatarPreview() {
    const initial = usernameInput.value.trim().charAt(0).toUpperCase() || '?';
    avatarPreview.textContent = initial;
    avatarPreview.style.background = userAvatar;
}
usernameInput.addEventListener('input', updateAvatarPreview);

// --- Join Room ---
joinBtn.addEventListener('click', () => {
    username = usernameInput.value.trim();
    room = roomInput.value.trim();
    if (!username || !room) {
        alert('Please enter both your name and a room name.');
        return;
    }
    socket.emit('join', { username, room, avatar: userAvatar });
    joinScreen.classList.add('d-none');
    chatScreen.classList.remove('d-none');
    roomLabel.textContent = `#${room}`;
    messageInput.focus();
    unlockAudio();
});

// --- Leave Room ---
leaveBtn.addEventListener('click', () => {
    socket.emit('leave', { username, room });
    window.location.reload();
});

// --- Send Message ---
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = messageInput.value.trim();
    if (!msg) return;

    const now = new Date();
    const timestamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const messageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const payload = {
        id: messageId,
        username,
        room,
        message: msg,
        timestamp,
        status: 'sent',
        avatar: userAvatar
    };

    if (replyTo) {
        payload.reply_to = replyTo;
    }

    socket.emit('send_message', payload);
    messageInput.value = '';
    emojiPicker.classList.add('d-none');
    hideReplyPreview();
    socket.emit('stop_typing', { username, room });
});

// --- Message Actions: Reply + Delete ---
messagesDiv.addEventListener('click', (e) => {
    const replyBtn = e.target.closest('.reply-btn');
    if (replyBtn) {
        const msgId = replyBtn.dataset.msgId;
        const bubble = messagesDiv.querySelector(`[data-message-id="${msgId}"]`);
        if (!bubble) return;

        const originalUser = bubble.dataset.username;
        const bodyEl = bubble.querySelector('.msg-body');
        const originalText = bodyEl ? bodyEl.textContent : '';

        replyTo = {
            id: msgId,
            username: originalUser === username ? 'You' : originalUser,
            message: originalText
        };

        replyToUser.textContent = replyTo.username;
        replyToText.textContent = replyTo.message;
        replyPreview.classList.remove('d-none');
        messageInput.focus();
        return;
    }

    const deleteBtn = e.target.closest('.delete-btn');
    if (deleteBtn) {
        const msgId = deleteBtn.dataset.msgId;
        if (!confirm('Delete this message for everyone?')) return;
        socket.emit('delete_message', { message_id: msgId, room, username });
        return;
    }
});

// --- Reply Cancel ---
replyCancel.addEventListener('click', hideReplyPreview);

function hideReplyPreview() {
    replyPreview.classList.add('d-none');
    replyTo = null;
}

// --- Receive: Chat History ---
socket.on('history', (history) => {
    history.forEach(msg => {
        const type = msg.username === username ? 'self' : 'other';
        addMessage(msg, type);
    });
});

// --- Receive: New Message ---
socket.on('message', (data) => {
    const type = data.username === username ? 'self' : 'other';
    addMessage(data, type);
    typingIndicator.classList.add('d-none');

    if (type === 'other') {
        // NEW: Play notification sound for messages from others
        playNotificationSound();

        socket.emit('message_delivered', { message_id: data.id, room: data.room });
        if (!document.hidden) {
            setTimeout(() => socket.emit('message_read', { message_id: data.id, room: data.room }), 300);
        }
    }
});

// --- Receive: Message Deleted ---
socket.on('message_deleted', (data) => {
    const bubble = messagesDiv.querySelector(`[data-message-id="${data.message_id}"]`);
    if (bubble) {
        const wrapper = bubble.closest('.message-wrapper');
        if (wrapper) {
            wrapper.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
            wrapper.style.opacity = '0';
            wrapper.style.transform = 'scale(0.9)';
            setTimeout(() => wrapper.remove(), 200);
        }
    }
    delete messageIds[data.message_id];
});

// --- Receive: Status Update ---
socket.on('status_update', (data) => {
    const bubble = messageIds[data.message_id];
    if (!bubble) return;
    const tickEl = bubble.querySelector('.msg-tick');
    if (tickEl) tickEl.innerHTML = renderTick(data.status);
});

// --- Receive: System Status ---
socket.on('status', (data) => {
    const div = document.createElement('div');
    div.className = 'text-center text-muted small my-2';
    div.textContent = data.msg;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
});

// --- Receive: Online Users ---
socket.on('user_list', (data) => {
    renderUserList(data.users);
});

// --- Mark as read when tab becomes visible ---
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && room) {
        document.querySelectorAll('.message-bubble.other').forEach(bubble => {
            const id = bubble.dataset.messageId;
            if (id) socket.emit('message_read', { message_id: id, room });
        });
    }
});

// --- Typing Indicator ---
let typingTimeout = null;
messageInput.addEventListener('input', () => {
    if (!username || !room) return;
    socket.emit('typing', { username, room });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => socket.emit('stop_typing', { username, room }), 1500);
});
socket.on('typing', (data) => {
    typingText.textContent = `${data.username} is typing`;
    typingIndicator.classList.remove('d-none');
});
socket.on('stop_typing', () => typingIndicator.classList.add('d-none'));

// --- Helper: Render Tick Marks ---
function renderTick(status) {
    if (status === 'sent') return '<span class="tick-single">✓</span>';
    if (status === 'delivered') return '<span class="tick-double">✓✓</span>';
    if (status === 'read') return '<span class="tick-double tick-read">✓✓</span>';
    return '';
}

// --- Helper: Render a Message Bubble ---
function addMessage(data, type) {
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${type}`;

    const ts = data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const color = data.avatar || stringToColor(data.username);
    const initial = (data.username || '?').charAt(0).toUpperCase();

    const tickHTML = (type === 'self')
        ? `<span class="msg-tick">${renderTick(data.status || 'sent')}</span>`
        : '';

    const avatarHTML = `<div class="message-avatar" style="background:${color};">${initial}</div>`;

    let replyHTML = '';
    if (data.reply_to) {
        replyHTML = `
            <div class="msg-reply">
                <div class="msg-reply-user">${escapeHTML(data.reply_to.username)}</div>
                <div class="msg-reply-text">${escapeHTML(data.reply_to.message)}</div>
            </div>
        `;
    }

    const deleteHTML = (type === 'self')
        ? `<button class="delete-btn" data-msg-id="${data.id}" title="Delete">🗑</button>`
        : '';

    const bubbleHTML = `
        <div class="message-bubble ${type}" data-message-id="${data.id}" data-username="${escapeHTML(data.username)}">
            <div class="msg-actions">
                <button class="reply-btn" data-msg-id="${data.id}" title="Reply">↩</button>
                ${deleteHTML}
            </div>
            ${replyHTML}
            <div class="msg-meta">${type === 'self' ? 'You' : escapeHTML(data.username)}</div>
            <div class="msg-body">${escapeHTML(data.message)}</div>
            <div class="msg-time">${ts} ${tickHTML}</div>
        </div>
    `;

    if (type === 'self') {
        wrapper.innerHTML = bubbleHTML + avatarHTML;
    } else {
        wrapper.innerHTML = avatarHTML + bubbleHTML;
    }

    messagesDiv.appendChild(wrapper);

    if (type === 'self' && data.id) {
        messageIds[data.id] = wrapper.querySelector('.message-bubble');
    }

    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// --- Helper: Online Users Sidebar ---
function renderUserList(users) {
    userList.innerHTML = '';
    userCount.textContent = users.length;

    users.forEach(u => {
        const li = document.createElement('li');
        li.className = 'user-item';
        const color = u.avatar || stringToColor(u.username);
        const initial = u.username.charAt(0).toUpperCase();
        li.innerHTML = `
            <span class="user-avatar" style="background:${color};">${initial}</span>
            <span class="user-name">${escapeHTML(u.username)}${u.username === username ? ' <em>(you)</em>' : ''}</span>
            <span class="online-dot"></span>
        `;
        userList.appendChild(li);
    });
}

// --- Deterministic color from username ---
function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// --- Security: Escape HTML ---
function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}