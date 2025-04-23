// server.js - Ana sunucu dosyası (düzeltilmiş versiyon)
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Statik dosyalar için klasör tanımlama
app.use(express.static(path.join(__dirname, 'public')));

// Ana sayfayı gönder
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Kullanıcı listesi
const users = {};
// Oda listesi
const rooms = {'Genel': {users: {}, messages: []}};

// Socket.io bağlantı yönetimi
io.on('connection', (socket) => {
  console.log('Yeni kullanıcı bağlandı:', socket.id);
  
  // Kullanıcı kayıt
  socket.on('register', (username, callback) => {
    // Kullanıcı adını kontrol et
    if (Object.values(users).includes(username)) {
      return callback({status: 'error', message: 'Bu kullanıcı adı zaten kullanılıyor.'});
    }
    
    // Kullanıcıyı kaydet
    users[socket.id] = username;
    
    // Varsayılan odaya katıl
    joinRoom(socket, 'Genel');
    
    // Başarılı cevap gönder
    callback({
      status: 'success', 
      rooms: Object.keys(rooms),
      currentRoom: 'Genel',
      messages: rooms['Genel'].messages
    });
  });
  
  // Odaya katılma fonksiyonu
  function joinRoom(socket, roomName) {
    // Kullanıcı adını al
    const username = users[socket.id];
    if (!username) return;
    
    // Kullanıcının bulunduğu tüm odalardan çıkar
    Array.from(socket.rooms)
      .filter(room => room !== socket.id)
      .forEach(room => {
        socket.leave(room);
        if (rooms[room] && rooms[room].users) {
          delete rooms[room].users[socket.id];
        }
      });
    
    // Oda yoksa oluştur
    if (!rooms[roomName]) {
      rooms[roomName] = {
        users: {},
        messages: []
      };
    }
    
    // Odaya katıl
    socket.join(roomName);
    rooms[roomName].users[socket.id] = username;
    
    // Odadaki kullanıcılara bildir
    io.to(roomName).emit('userJoined', {
      user: username,
      users: Object.values(rooms[roomName].users)
    });
    
    return rooms[roomName].messages;
  }
  
  // Mesaj gönderme
  socket.on('sendMessage', (data) => {
    const user = users[socket.id];
    if (!user || !data.room) return;
    
    const messageData = {
      user,
      text: data.message,
      room: data.room,
      timestamp: new Date().toISOString(),
      id: Date.now()
    };
    
    // Mesajı odaya kaydet
    if (rooms[data.room]) {
      rooms[data.room].messages.push(messageData);
      // Sadece son 100 mesajı tut
      if (rooms[data.room].messages.length > 100) {
        rooms[data.room].messages.shift();
      }
      
      // Odadaki herkese mesajı gönder
      io.to(data.room).emit('newMessage', messageData);
    }
  });
  
  // Odaya katılma
  socket.on('joinRoom', (roomName, callback) => {
    const messages = joinRoom(socket, roomName);
    
    if (callback) {
      callback({
        status: 'success',
        messages: messages || []
      });
    }
  });
  
  // Yazıyor durumu
  socket.on('typing', (data) => {
    const user = users[socket.id];
    if (!user || !data.room) return;
    
    socket.to(data.room).emit('userTyping', {
      user,
      isTyping: data.isTyping
    });
  });
  
  // Kullanıcı çıkışı
  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user) {
      console.log('Kullanıcı çıkış yaptı:', user);
      
      // Kullanıcının tüm odalardan çıkarılması
      Object.keys(rooms).forEach(room => {
        if (rooms[room].users && rooms[room].users[socket.id]) {
          delete rooms[room].users[socket.id];
          io.to(room).emit('userLeft', {
            user,
            users: Object.values(rooms[room].users)
          });
        }
      });
      
      // Kullanıcıyı sil
      delete users[socket.id];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server ${PORT} portunda çalışıyor...`);
});