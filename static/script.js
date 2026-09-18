const socket = io();

let username = '';
let room = '';

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

// --- Join Room ---
joinBtn.addEventListener('click', () => {
    username = usernameInput.value.trim();
    room = roomInput.value.trim();
    if (!username || !room) {
        alert('Please enter both your name and a room name.');
        return;
    }
    socket.emit('join', { username, room });
    joinScreen.classList.add('d-none');
    chatScreen.classList.remove('d-none');
    chatScreen.style.display = 'flex';
    roomLabel.textContent = `#${room}`;
    messageInput.focus();
});

// --- Leave Room ---
leaveBtn.addEventListener('click', () => {
    socket.emit('leave', { username, room });
    window.location.reload();
});

// --- Send Message (with timestamp) ---
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = messageInput.value.trim();
    if (!msg) return;

    // Capture the current time in a friendly format (e.g., "10:45 PM")
    const now = new Date();
    const timestamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    socket.emit('send_message', {
        username,
        room,
        message: msg,
        timestamp: timestamp
    });

    messageInput.value = '';

    // Stop typing indicator immediately after sending
    socket.emit('stop_typing', { username, room });
});

// --- Receive: Chat History ---
socket.on('history', (history) => {
    history.forEach(msg => addMessage(msg, 'other'));
});

// --- Receive: New Message ---
socket.on('message', (data) => {
    const type = data.username === username ? 'self' : 'other';
    addMessage(data, type);
    typingIndicator.classList.add('d-none');
});

// --- Receive: System Status ---
socket.on('status', (data) => {
    const div = document.createElement('div');
    div.className = 'text-center text-muted small my-2';
    div.textContent = data.msg;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
});

// --- Typing Indicator Logic ---
let typingTimeout = null;

messageInput.addEventListener('input', () => {
    if (!username || !room) return;

    socket.emit('typing', { username, room });

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit('stop_typing', { username, room });
    }, 1500);
});

socket.on('typing', (data) => {
    typingText.textContent = `${data.username} is typing`;
    typingIndicator.classList.remove('d-none');
});

socket.on('stop_typing', () => {
    typingIndicator.classList.add('d-none');
});

// --- Helper: Render a Message Bubble (with timestamp) ---
function addMessage(data, type) {
    const div = document.createElement('div');
    div.className = `message-bubble ${type}`;

    // Fallback: if an older message has no timestamp, generate one from now
    const ts = data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    div.innerHTML = `
        <div class="msg-meta">${type === 'self' ? 'You' : data.username}</div>
        <div class="msg-body">${escapeHTML(data.message)}</div>
        <div class="msg-time">${ts}</div>
    `;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// --- Security: Escape HTML to prevent XSS ---
function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}