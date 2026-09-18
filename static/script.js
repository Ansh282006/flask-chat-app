const socket = io();

let username = '';
let room = '';
let userAvatar = '#4a90e2';   // default color
let messageIds = {};

// Palette for avatar colors
const AVATAR_COLORS = [
    '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c',
    '#3498db', '#9b59b6', '#e84393', '#16a085', '#c0392b'
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

// --- Build the Color Picker on Page Load ---
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

// --- Live Avatar Preview ---
function updateAvatarPreview() {
    const initial = usernameInput.value.trim().charAt(0).toUpperCase() || '?';
    avatarPreview.textContent = initial;
    avatarPreview.style.background = userAvatar;
}

// Live update when typing name
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

    socket.emit('send_message', payload);
    messageInput.value = '';
    socket.emit('stop_typing', { username, room });
});

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
        socket.emit('message_delivered', { message_id: data.id, room: data.room });
        if (!document.hidden) {
            setTimeout(() => socket.emit('message_read', { message_id: data.id, room: data.room }), 300);
        }
    }
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

// --- Helper: Render a Message Bubble (with Avatar) ---
function addMessage(data, type) {
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${type}`;

    const ts = data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Determine avatar color
    const color = data.avatar || stringToColor(data.username);
    const initial = (data.username || '?').charAt(0).toUpperCase();

    // Ticks only on self messages
    const tickHTML = (type === 'self')
        ? `<span class="msg-tick">${renderTick(data.status || 'sent')}</span>`
        : '';

    // Avatar on the LEFT for others, on the RIGHT for self
    const avatarHTML = `<div class="message-avatar" style="background:${color};">${initial}</div>`;

    const bubbleHTML = `
        <div class="message-bubble ${type}" data-message-id="${data.id}">
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

// --- Helper: Online Users Sidebar (uses server-provided avatar) ---
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

// --- Deterministic color from username (fallback) ---
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