from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, join_room, leave_room

# Initialize Flask App
app = Flask(__name__)
app.config['SECRET_KEY'] = 'chat-app-super-secret-key'

# Initialize SocketIO
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# In-memory storage
messages = {}     # { room_name: [ {id, username, room, message, timestamp, status, avatar}, ... ] }
rooms = {}        # { room_name: { sid: {username, avatar} } }


@app.route('/')
def index():
    return render_template('index.html')


@socketio.on('join')
def handle_join(data):
    username = data['username']
    room = data['room']
    avatar = data.get('avatar', '#4a90e2')
    sid = request.sid

    join_room(room)

    if room not in messages:
        messages[room] = []
    if room not in rooms:
        rooms[room] = {}

    rooms[room][sid] = {'username': username, 'avatar': avatar}

    emit('history', messages[room])
    emit('status', {'msg': f'{username} has joined the room.'}, room=room)
    emit('user_list', {'users': list(rooms[room].values())}, room=room)


@socketio.on('leave')
def handle_leave(data):
    username = data['username']
    room = data['room']
    sid = request.sid

    leave_room(room)
    if room in rooms and sid in rooms[room]:
        del rooms[room][sid]

    emit('status', {'msg': f'{username} has left the room.'}, room=room)
    emit('user_list', {'users': list(rooms[room].values())}, room=room)


@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid
    for room_name, users in list(rooms.items()):
        if sid in users:
            user_info = users[sid]
            username = user_info['username']
            del users[sid]
            emit('status', {'msg': f'{username} has left the room.'}, room=room_name)
            emit('user_list', {'users': list(users.values())}, room=room_name)


@socketio.on('send_message')
def handle_send_message(data):
    room = data['room']
    data.setdefault('status', 'sent')

    if room not in messages:
        messages[room] = []
    messages[room].append(data)

    emit('message', data, room=room)


@socketio.on('message_delivered')
def handle_message_delivered(data):
    room = data['room']
    message_id = data['message_id']
    for msg in messages.get(room, []):
        if msg['id'] == message_id:
            if msg['status'] == 'sent':
                msg['status'] = 'delivered'
            break
    emit('status_update', {'message_id': message_id, 'status': 'delivered'}, room=room)


@socketio.on('message_read')
def handle_message_read(data):
    room = data['room']
    message_id = data['message_id']
    for msg in messages.get(room, []):
        if msg['id'] == message_id:
            msg['status'] = 'read'
            break
    emit('status_update', {'message_id': message_id, 'status': 'read'}, room=room)


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