const socket = io();

let username = '';
let room = '';

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
    roomLabel.textContent = `#${room}`;
    messageInput.focus();
});

leaveBtn.addEventListener('click', () => {
    socket.emit('leave', { username, room });
    window.location.reload();
});

messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = messageInput.value.trim();
    if (!msg) return;
    socket.emit('send_message', { username, room, message: msg });
    messageInput.value = '';
});

socket.on('history', (history) => {
    history.forEach(msg => addMessage(msg, 'other'));
});

socket.on('message', (data) => {
    const type = data.username === username ? 'self' : 'other';
    addMessage(data, type);
});

socket.on('status', (data) => {
    const div = document.createElement('div');
    div.className = 'text-center text-muted small my-2';
    div.textContent = data.msg;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
});

function addMessage(data, type) {
    const div = document.createElement('div');
    div.className = `message-bubble ${type}`;
    div.innerHTML = `
        <div class="msg-meta">${type === 'self' ? 'You' : data.username}</div>
        <div class="msg-body">${escapeHTML(data.message)}</div>
    `;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}