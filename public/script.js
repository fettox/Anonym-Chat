// public/script.js (düzeltilmiş versiyon)
document.addEventListener('DOMContentLoaded', function() {
  // DOM Elementleri
  const loginScreen = document.getElementById('login-screen');
  const chatScreen = document.getElementById('chat-screen');
  const usernameInput = document.getElementById('username-input');
  const loginButton = document.getElementById('login-button');
  const loginError = document.getElementById('login-error');
  const messagesContainer = document.getElementById('messages-container');
  const messageInput = document.getElementById('message-input');
  const sendButton = document.getElementById('send-btn');
  const roomList = document.getElementById('room-list');
  const userList = document.getElementById('user-list');
  const currentRoomElement = document.getElementById('current-room');
  const currentUserElement = document.getElementById('current-user');
  const roomUsersCount = document.getElementById('room-users-count');
  const typingIndicator = document.getElementById('typing-indicator');
  const newRoomBtn = document.getElementById('new-room-btn');
  const newRoomModal = document.getElementById('new-room-modal');
  const closeModal = document.querySelector('.close-modal');
  const roomNameInput = document.getElementById('room-name-input');
  const createRoomBtn = document.getElementById('create-room-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const emojiBtn = document.getElementById('emoji-btn');
  
  // Uygulama durumu
  let state = {
    username: '',
    currentRoom: '',
    rooms: [],
    users: [],
    typing: false,
    typingTimeout: null
  };
  
  // Socket.io bağlantısı - transports parametresi eklendi
  const socket = io({
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    transports: ['websocket', 'polling']
  });
  
  // Bağlantı durumunu kontrol et
  socket.on('connect', () => {
    console.log('Socket.io bağlantısı kuruldu');
    
    // Eğer kullanıcı zaten giriş yapmışsa, tekrar giriş yaptır
    if (state.username) {
      socket.emit('register', state.username, (response) => {
        if (response.status === 'success') {
          joinRoom(state.currentRoom);
        }
      });
    }
  });
  
  socket.on('connect_error', (error) => {
    console.error('Bağlantı hatası:', error);
    addSystemMessage('Sunucuya bağlanılamadı. Lütfen sayfayı yenileyin.');
  });
  
  // Event Listeners
  loginButton.addEventListener('click', login);
  usernameInput.addEventListener('keyup', e => {
    if (e.key === 'Enter') login();
  });
  
  sendButton.addEventListener('click', sendMessage);
  messageInput.addEventListener('keyup', e => {
    if (e.key === 'Enter') sendMessage();
    handleTyping();
  });
  
  newRoomBtn.addEventListener('click', () => {
    newRoomModal.classList.add('active');
  });
  
  closeModal.addEventListener('click', () => {
    newRoomModal.classList.remove('active');
  });
  
  createRoomBtn.addEventListener('click', createRoom);
  
  logoutBtn.addEventListener('click', logout);
  
  emojiBtn.addEventListener('click', toggleEmojiPicker);
  
  // Window click event to close modal if clicked outside
  window.addEventListener('click', (e) => {
    if (e.target === newRoomModal) {
      newRoomModal.classList.remove('active');
    }
  });
  
  // Socket event handlers
  socket.on('userJoined', (data) => {
    console.log('Kullanıcı katıldı:', data);
    state.users = data.users;
    updateUserList();
    roomUsersCount.textContent = `${state.users.length} Kullanıcı`;
    
    if (data.user !== state.username) {
      addSystemMessage(`${data.user} odaya katıldı.`);
    }
  });
  
  socket.on('userLeft', (data) => {
    console.log('Kullanıcı ayrıldı:', data);
    state.users = data.users;
    updateUserList();
    roomUsersCount.textContent = `${state.users.length} Kullanıcı`;
    addSystemMessage(`${data.user} odadan ayrıldı.`);
  });
  
  socket.on('newMessage', (data) => {
    console.log('Yeni mesaj:', data);
    addMessage(data);
    
    // Mesaj başka birinden geldiyse bildirim göster
    if (data.user !== state.username) {
      notifyMessage(data);
    }
  });
  
  socket.on('userTyping', (data) => {
    if (data.isTyping) {
      typingIndicator.textContent = `${data.user} yazıyor...`;
    } else {
      typingIndicator.textContent = '';
    }
  });
  
  // Fonksiyonlar
  function login() {
    const username = usernameInput.value.trim();
    if (!username) {
      loginError.textContent = 'Lütfen bir kullanıcı adı girin.';
      return;
    }
    
    console.log('Giriş yapılıyor:', username);
    
    socket.emit('register', username, (response) => {
      console.log('Giriş cevabı:', response);
      
      if (response.status === 'error') {
        loginError.textContent = response.message;
        return;
      }
      
      state.username = username;
      state.currentRoom = response.currentRoom;
      state.rooms = response.rooms;
      
      // Ekran geçişi
      loginScreen.classList.remove('active');
      chatScreen.classList.add('active');
      
      // Kullanıcı bilgilerini göster
      currentUserElement.textContent = username;
      currentRoomElement.textContent = state.currentRoom;
      
      // Oda listesini güncelle
      updateRoomList();
      
      // Mesajları yükle
      loadMessages(response.messages);
      
      // Mesaj giriş alanına odaklan
      messageInput.focus();
    });
  }
  
  function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;
    
    console.log('Mesaj gönderiliyor:', message);
    
    socket.emit('sendMessage', {
      message,
      room: state.currentRoom
    });
    
    messageInput.value = '';
    messageInput.focus();
    
    // Yazıyor durumunu temizle
    clearTimeout(state.typingTimeout);
    state.typing = false;
    socket.emit('typing', {
      room: state.currentRoom,
      isTyping: false
    });
  }
  
  function handleTyping() {
    if (!state.typing) {
      state.typing = true;
      socket.emit('typing', {
        room: state.currentRoom,
        isTyping: true
      });
    }
    
    clearTimeout(state.typingTimeout);
    state.typingTimeout = setTimeout(() => {
      state.typing = false;
      socket.emit('typing', {
        room: state.currentRoom,
        isTyping: false
      });
    }, 3000);
  }
  
  function createRoom() {
    const roomName = roomNameInput.value.trim();
    if (!roomName) return;
    
    if (state.rooms.includes(roomName)) {
      alert('Bu isimde bir oda zaten var.');
      return;
    }
    
    joinRoom(roomName);
    newRoomModal.classList.remove('active');
    roomNameInput.value = '';
  }
  
  function joinRoom(room) {
    console.log('Odaya katılınıyor:', room);
    
    socket.emit('joinRoom', room, (response) => {
      console.log('Oda katılma cevabı:', response);
      
      if (response.status === 'success') {
        state.currentRoom = room;
        currentRoomElement.textContent = room;
        
        // Oda listesine ekle eğer yoksa
        if (!state.rooms.includes(room)) {
          state.rooms.push(room);
          updateRoomList();
        }
        
        // Mesajları temizle ve yeniden yükle
        messagesContainer.innerHTML = '';
        loadMessages(response.messages);
        
        // Aktif odayı güncelle
        updateActiveRoom();
      }
    });
  }
  
  function updateRoomList() {
    roomList.innerHTML = '';
    state.rooms.forEach(room => {
      const roomElement = document.createElement('div');
      roomElement.classList.add('room-item');
      if (room === state.currentRoom) {
        roomElement.classList.add('active');
      }
      roomElement.textContent = room;
      roomElement.addEventListener('click', () => joinRoom(room));
      roomList.appendChild(roomElement);
    });
  }
  
  function updateActiveRoom() {
    document.querySelectorAll('.room-item').forEach(item => {
      item.classList.remove('active');
      if (item.textContent === state.currentRoom) {
        item.classList.add('active');
      }
    });
  }
  
  function updateUserList() {
    userList.innerHTML = '';
    state.users.forEach(user => {
      const userElement = document.createElement('li');
      userElement.textContent = user;
      if (user === state.username) {
        userElement.style.fontWeight = 'bold';
      }
      userList.appendChild(userElement);
    });
  }
  
  function loadMessages(messages) {
    messagesContainer.innerHTML = '';
    if (messages && messages.length) {
      messages.forEach(message => {
        addMessage(message);
      });
    }
    scrollToBottom();
  }
  
  function addMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    
    // Kendime ait mesajları farklı göster
    if (message.user === state.username) {
      messageElement.classList.add('own');
    }
    
    const messageHeader = document.createElement('div');
    messageHeader.classList.add('message-header');
    
    const messageUser = document.createElement('span');
    messageUser.classList.add('message-user');
    messageUser.textContent = message.user;
    
    const messageTime = document.createElement('span');
    messageTime.classList.add('message-time');
    messageTime.textContent = formatTime(new Date(message.timestamp));
    
    messageHeader.appendChild(messageUser);
    messageHeader.appendChild(messageTime);
    
    const messageBubble = document.createElement('div');
    messageBubble.classList.add('message-bubble');
    messageBubble.textContent = message.text;
    
    messageElement.appendChild(messageHeader);
    messageElement.appendChild(messageBubble);
    
    messagesContainer.appendChild(messageElement);
    scrollToBottom();
  }
  
  function addSystemMessage(text) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', 'system');
    
    const messageBubble = document.createElement('div');
    messageBubble.classList.add('message-bubble', 'system');
    messageBubble.style.backgroundColor = '#f0f0f0';
    messageBubble.style.color = '#666';
    messageBubble.style.textAlign = 'center';
    messageBubble.style.fontStyle = 'italic';
    messageBubble.textContent = text;
    
    messageElement.appendChild(messageBubble);
    messagesContainer.appendChild(messageElement);
    scrollToBottom();
  }
  
  function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
  
  function logout() {
    window.location.reload();
  }
  
  function toggleEmojiPicker() {
    if (!emojiPicker) {
      // Emoji picker oluştur
      const pickerDiv = document.createElement('div');
      pickerDiv.id = 'emoji-picker';
      pickerDiv.style.position = 'absolute';
      pickerDiv.style.bottom = '80px';
      pickerDiv.style.right = '20px';
      pickerDiv.style.zIndex = '1000';
      pickerDiv.style.display = 'none';
      pickerDiv.style.backgroundColor = '#fff';
      pickerDiv.style.border = '1px solid #ddd';
      pickerDiv.style.borderRadius = '8px';
      pickerDiv.style.padding = '10px';
      pickerDiv.style.boxShadow = '0 0 10px rgba(0,0,0,0.1)';
      
      // Basit bir emoji listesi
      const emojis = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', 
                      '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
                      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '❣️', '💕', '💞'];
      
      const emojiGrid = document.createElement('div');
      emojiGrid.style.display = 'grid';
      emojiGrid.style.gridTemplateColumns = 'repeat(5, 1fr)';
      emojiGrid.style.gap = '10px';
      
      emojis.forEach(emoji => {
        const emojiBtn = document.createElement('button');
        emojiBtn.textContent = emoji;
        emojiBtn.style.backgroundColor = 'transparent';
        emojiBtn.style.border = 'none';
        emojiBtn.style.fontSize = '1.5rem';
        emojiBtn.style.cursor = 'pointer';
        emojiBtn.style.padding = '5px';
        emojiBtn.addEventListener('click', () => {
          messageInput.value += emoji;
          messageInput.focus();
          pickerDiv.style.display = 'none';
        });
        emojiGrid.appendChild(emojiBtn);
      });
      
      pickerDiv.appendChild(emojiGrid);
      document.body.appendChild(pickerDiv);
      
      emojiPicker = pickerDiv;
    }
    
    if (emojiPicker.style.display === 'none' || !emojiPicker.style.display) {
      emojiPicker.style.display = 'block';
    } else {
      emojiPicker.style.display = 'none';
    }
  }
  
  // Emoji picker dışında bir yere tıklandığında emoji picker'ı kapat
  document.addEventListener('click', (e) => {
    if (emojiPicker && e.target !== emojiBtn && !emojiBtn.contains(e.target)) {
      if (!emojiPicker.contains(e.target)) {
        emojiPicker.style.display = 'none';
      }
    }
  });
  
  // Bildirim fonksiyonu
  function notifyMessage(message) {
    if (Notification.permission === "granted" && document.hidden) {
      const notification = new Notification("Yeni Mesaj", {
        body: `${message.user}: ${message.text.substring(0, 50)}${message.text.length > 50 ? '...' : ''}`,
      });
      
      notification.onclick = function() {
        window.focus();
        this.close();
      };
    }
  }
  
  // Bildirim izinlerini sor
  if ("Notification" in window) {
    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }
  
  // Başlangıçta hoş geldin mesajı göster
  setTimeout(() => {
    addSystemMessage('Chat uygulamasına hoş geldiniz! Mesajlaşmaya başlayabilirsiniz.');
  }, 1000);
  
  // Değişkenleri tanımla
  let emojiPicker;
});