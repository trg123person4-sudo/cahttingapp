
const firebaseConfig = {
  apiKey: "AIzaSyBQ66LFzW7F-wpnKPWysagjv8A91VYSihk",
  authDomain: "trg-e4274.firebaseapp.com",
  databaseURL: "https://trg-e4274-default-rtdb.firebaseio.com",
  projectId: "trg-e4274"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();
const storage = firebase.storage();

let currentUser = null;
let currentChat = null;

auth.onAuthStateChanged(user => {
  currentUser = user;
  if (user) {
    loadUserData();
  } else {
    document.getElementById('login-screen') && (document.getElementById('login-screen').style.display = 'flex');
    document.getElementById('app') && (document.getElementById('app').style.display = 'none');
  }
});

function loadUserData() {
  database.ref('users/' + currentUser.uid).once('value').then(snapshot => {
    const userData = snapshot.val() || {};
    const userDisplay = document.getElementById('user-display');
    if (userDisplay) userDisplay.textContent = userData.displayName || 'User';
    const userAvatar = document.getElementById('user-avatar');
    if (userAvatar) {
      if (userData.photoURL) {
        userAvatar.src = userData.photoURL;
      } else {
        userAvatar.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM3NzlBOTEiLz4KPC9zdmc+';
      }
    }
    document.getElementById('login-screen') && (document.getElementById('login-screen').style.display = 'none');
    document.getElementById('app') && (document.getElementById('app').style.display = 'flex');
    loadChats();
    loadNotifications();
  });
}

function quickStart() {
  auth.signInAnonymously().then(result => {
    database.ref('users/' + result.user.uid).set({
      uid: result.user.uid,
      displayName: 'User' + Math.floor(Math.random() * 1000),
      online: true
    });
  }).catch(console.error);
}

function toggleOptionsMenu() {
  const menu = document.getElementById('options-menu');
  if (menu) menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

function showProfileMenu() {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.onchange = uploadProfilePhoto;
  fileInput.click();
}

function uploadProfilePhoto(e) {
  const file = e.target.files[0];
  if (file && currentUser) {
    const reader = new FileReader();
    reader.onload = event => {
      const ref = storage.ref('profilePhotos/' + currentUser.uid);
      ref.putString(event.target.result, 'data_url').then(snapshot => {
        snapshot.ref.getDownloadURL().then(url => {
          database.ref('users/' + currentUser.uid + '/photoURL').set(url);
          const avatar = document.getElementById('user-avatar');
          if (avatar) avatar.src = url;
          alert('Photo uploaded!');
        }).catch(console.error);
      }).catch(console.error);
    };
    reader.readAsDataURL(file);
  }
}

function toggleNotifications() {
  const dropdown = document.getElementById('notifications-dropdown');
  if (dropdown) dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
}

function loadNotifications() {
  if (!currentUser) return;
  database.ref('friendRequests/' + currentUser.uid).on('value', snapshot => {
    const list = document.getElementById('notifications-list');
    if (!list) return;
    list.innerHTML = '';
    let count = 0;
    snapshot.forEach(child => {
      count++;
      const request = child.val();
      const item = document.createElement('div');
      item.className = 'notification-item';
      item.innerHTML = `<strong>${request.fromName}</strong> wants to friend<br><button onclick="acceptFriend('${child.key}')" style="background:#4CAF50;color:white;padding:4px 8px;border:none;border-radius:4px;margin:2px;">Accept</button><button onclick="rejectFriend('${child.key}')" style="background:#f44336;color:white;padding:4px 8px;border:none;border-radius:4px;margin:2px;">Reject</button>`;
      list.appendChild(item);
    });
    const badge = document.getElementById('notification-count');
    if (badge) badge.textContent = count || '';
  });
}

function acceptFriend(requestKey) {
  const requestRef = database.ref('friendRequests/' + currentUser.uid + '/' + requestKey);
  requestRef.once('value').then(snapshot => {
    const request = snapshot.val();
    const friendUid = request.fromUid;
    
    // Permanent mutual friendship
    database.ref('friends/' + currentUser.uid + '/' + friendUid).set(true);
    database.ref('friends/' + friendUid + '/' + currentUser.uid).set(true);
    
    // Create chat
    const chatId = [currentUser.uid, friendUid].sort().join('_');
    database.ref('chats/' + chatId).set({
      name: request.fromName,
      members: {[currentUser.uid]: true, [friendUid]: true},
      lastMessage: 'Say hi!',
      lastMessageTime: firebase.database.ServerValue.TIMESTAMP
    });
    
    requestRef.remove();
    loadChats();
  });
}

function rejectFriend(requestKey) {
  database.ref('friendRequests/' + currentUser.uid + '/' + requestKey).remove();
}

function addFriend() {
  const friendName = prompt('Friend username:');
  if (friendName && currentUser) {
    database.ref('users').orderByChild('displayName').equalTo(friendName.trim()).once('value').then(snapshot => {
      if (snapshot.exists()) {
        snapshot.forEach(child => {
          const targetUid = child.key;
          database.ref('friendRequests/' + targetUid).push({
            fromUid: currentUser.uid,
            fromName: document.getElementById('user-display').textContent,
            timestamp: firebase.database.ServerValue.TIMESTAMP
          });
          alert('Request sent!');
        });
      } else {
        alert('User not found');
      }
    });
  }
}

function changeUsername() {
  const newName = prompt('New username:');
  if (newName && currentUser) {
    database.ref('users/' + currentUser.uid + '/displayName').set(newName.trim());
  }
}

function loadChats() {
  if (!currentUser) return;
  
  database.ref('friends/' + currentUser.uid).once('value').then(snapshot => {
    const list = document.getElementById('chats-list') || document.createElement('div');
    list.innerHTML = '';
    
    let empty = true;
    snapshot.forEach(child => {
      empty = false;
      const friendUid = child.key;
      database.ref('users/' + friendUid + '/displayName').once('value').then(snap => {
        const name = snap.val() || 'Friend';
        const chatId = [currentUser.uid, friendUid].sort().join('_');
        const item = document.createElement('div');
        item.className = 'chat-item';
        item.onclick = () => selectChat(chatId);
        item.innerHTML = `<img src="avatar.svg" class="avatar"><div><div class="chat-name">${name}</div><div class="chat-preview">Tap to chat</div></div>`;
        list.appendChild(item);
      });
    });
    
    if (empty) list.innerHTML = '<div style="padding:2rem;text-align:center;color:#666;">No friends yet. Add some! 👥</div>';
  });
}

function selectChat(chatId) {
  currentChat = chatId;
  loadMessages(chatId);
}

function loadMessages(chatId) {
  database.ref('chats/' + chatId + '/messages').limitToLast(50).on('child_added', snap => {
    const msg = snap.val();
    const div = document.createElement('div');
    div.className = msg.senderUid === currentUser.uid ? 'message sent' : 'message received';
    div.innerHTML = `<div class="msg-bubble">${msg.text}</div>`;
    document.getElementById('messages').appendChild(div);
  });
}

function sendMessage() {
  const input = document.getElementById('message-input');
  if (input && currentChat) {
    database.ref('chats/' + currentChat + '/messages').push({
      text: input.value,
      senderUid: currentUser.uid,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    input.value = '';
  }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('click', e => {
    const profile = document.querySelector('.user-profile');
    const menu = document.getElementById('options-menu');
    if (e.target.closest('.user-profile') && currentUser) {
      showProfileMenu();
    } else if (!e.target.closest('#options-menu')) {
      menu.style.display = 'none';
    }
  });
  
  const input = document.getElementById('message-input');
  if (input) input.onkeypress = e => e.key === 'Enter' && sendMessage();
});

