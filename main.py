from flask import Flask, render_template
from flask_socketio import SocketIO, emit, join_room, leave_room

# Initialize Flask App (auto-detects templates & static folders)
app = Flask(__name__)
app.config['SECRET_KEY'] = 'chat-app-super-secret-key'

# Initialize SocketIO
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# In-memory storage for messages
messages = {}


@app.route('/')
def index():
    return render_template('index.html')


@socketio.on('join')
def handle_join(data):
    username = data['username']
    room = data['room']
    join_room(room)
    if room not in messages:
        messages[room] = []
    emit('status', {'msg': f'{username} has joined the room.'}, room=room)
    emit('history', messages[room])


@socketio.on('leave')
def handle_leave(data):
    username = data['username']
    room = data['room']
    leave_room(room)
    emit('status', {'msg': f'{username} has left the room.'}, room=room)


@socketio.on('send_message')
def handle_send_message(data):
    room = data['room']
    if room not in messages:
        messages[room] = []
    messages[room].append(data)
    emit('message', data, room=room)


if __name__ == '__main__':
    port = 5000
    print("\n" + "=" * 50)
    print("✅ SERVER IS RUNNING! OPEN THIS IN YOUR BROWSER:")
    print(f"👉 http://127.0.0.1:{port}")
    print("=" * 50 + "\n")
    socketio.run(app, host='127.0.0.1', port=port, debug=True)