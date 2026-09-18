from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, join_room, leave_room

# Initialize Flask App (auto-detects templates & static folders)
app = Flask(__name__)
app.config['SECRET_KEY'] = 'chat-app-super-secret-key'

# Initialize SocketIO
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# In-memory storage
messages = {}                                # { room_name: [ {username, room, message, timestamp}, ... ] }
rooms = {}                                   # { room_name: { sid: username } }  <-- NEW for online users


@app.route('/')
def index():
    return render_template('index.html')


@socketio.on('join')
def handle_join(data):
    username = data['username']
    room = data['room']
    sid = request.sid                        # Unique connection ID for this user

    join_room(room)

    # Initialize room structures
    if room not in messages:
        messages[room] = []
    if room not in rooms:
        rooms[room] = {}

    # Track this user in the room
    rooms[room][sid] = username

    # Send existing chat history to the new user only
    emit('history', messages[room])

    # Notify everyone that someone joined
    emit('status', {'msg': f'{username} has joined the room.'}, room=room)

    # Send the updated online users list to EVERYONE (including the new user)
    emit('user_list', {'users': list(rooms[room].values())}, room=room)


@socketio.on('leave')
def handle_leave(data):
    username = data['username']
    room = data['room']
    sid = request.sid

    leave_room(room)

    # Remove this user from the room
    if room in rooms and sid in rooms[room]:
        del rooms[room][sid]

    # Notify remaining users
    emit('status', {'msg': f'{username} has left the room.'}, room=room)
    emit('user_list', {'users': list(rooms[room].values())}, room=room)


@socketio.on('disconnect')
def handle_disconnect():
    """Auto-handle when a user closes the tab without clicking 'Leave'."""
    sid = request.sid
    for room_name, users in list(rooms.items()):
        if sid in users:
            username = users[sid]
            del users[sid]
            emit('status', {'msg': f'{username} has left the room.'}, room=room_name)
            emit('user_list', {'users': list(users.values())}, room=room_name)


@socketio.on('send_message')
def handle_send_message(data):
    room = data['room']
    if room not in messages:
        messages[room] = []
    messages[room].append(data)
    emit('message', data, room=room)


@socketio.on('typing')
def handle_typing(data):
    emit('typing', {'username': data['username']}, room=data['room'], include_self=False)


@socketio.on('stop_typing')
def handle_stop_typing(data):
    emit('stop_typing', {'username': data['username']}, room=data['room'], include_self=False)


if __name__ == '__main__':
    port = 5000
    print("\n" + "=" * 50)
    print("✅ SERVER IS RUNNING! OPEN THIS IN YOUR BROWSER:")
    print(f"👉 http://127.0.0.1:{port}")
    print("=" * 50 + "\n")
    socketio.run(app, host='127.0.0.1', port=port, debug=True)