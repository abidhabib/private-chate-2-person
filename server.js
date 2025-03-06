require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mysql = require('mysql2/promise');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fs = require('fs'); // Import fs module

const app = express();
const server = http.createServer(app);

// Configuration
const PORT = process.env.PORT || 3000;
const UPLOADS_DIR = 'uploads';

// Database Pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Middleware Setup
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(`/${UPLOADS_DIR}`, express.static(UPLOADS_DIR));

// File Upload Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// File type validation
const ALLOWED_MIME_TYPES = [
    'image/jpeg', 'image/png', 'image/gif',
    'video/mp4', 'video/webm', 'video/ogg',
    'audio/mpeg', 'audio/ogg', 'audio/wav',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const fileFilter = (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('File type not allowed'), false);
    }
};

const upload = multer({ 
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter
}).array('media', 5); // Allow up to 5 files with field name 'media'

// Handle file upload errors
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File size too large. Maximum size is 10MB.' });
        }
        return res.status(400).json({ error: error.message });
    } else if (error) {
        return res.status(400).json({ error: error.message });
    }
    next();
});

// Authentication Middleware
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.split(' ')[1];
        
        console.log('Authenticating request:', {
            hasAuthHeader: !!authHeader,
            hasToken: !!token
        });
        
        if (!token) {
            console.log('No token provided');
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Token decoded:', decoded);

        const [user] = await pool.query(
            'SELECT username FROM users WHERE username = ?',
            [decoded.username]
        );
        
        if (!user.length) {
            console.log('Invalid user:', decoded.username);
            return res.status(403).json({ error: 'Invalid user' });
        }

        req.user = user[0];
        next();
    } catch (err) {
        console.error('Authentication error:', err);
        res.status(403).json({ error: 'Invalid token' });
    }
};

// User Registration
app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const [existing] = await pool.query('SELECT username FROM users WHERE username = ?', [username]);

        if (existing.length) {
            return res.status(409).json({ error: 'Username already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);

        res.status(201).json({ message: 'User created successfully' });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/test-db', async (req, res) => {
    try {
        const [result] = await pool.query('SELECT 1');
        res.json({ status: 'Database connection successful', result });
    } catch (err) {
        console.error('Database connection error:', err);
        res.status(500).json({ error: 'Database connection failed', details: err.message });
    }
});

// User Login
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log('Login attempt:', {
            username,
            hasPassword: !!password,
            body: req.body
        });

        if (!username || !password) {
            console.log('Missing credentials');
            return res.status(400).json({ error: 'Username and password required' });
        }

        const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        console.log('User lookup result:', {
            found: users.length > 0,
            username: username
        });
        
        if (!users.length) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const match = await bcrypt.compare(password, users[0].password);
        console.log('Password match result:', match);

        if (!match) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const token = jwt.sign({ username: users[0].username }, process.env.JWT_SECRET);
        
        // Update user's online status
        await pool.query(
            'UPDATE users SET is_online = true, last_seen = NOW() WHERE username = ?',
            [users[0].username]
        );

        res.json({ 
            token,
            username: users[0].username
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get message history with detailed debugging
app.get('/messages', authenticateToken, async (req, res) => {
    try {
        const username = req.user.username;
        const partner = username.toLowerCase() === 'abid' ? 'sara' : 'abid';

        const [messages] = await pool.query(
            `SELECT * FROM messages 
             WHERE (LOWER(sender) = LOWER(?) AND LOWER(recipient) = LOWER(?))
             OR (LOWER(sender) = LOWER(?) AND LOWER(recipient) = LOWER(?))
             ORDER BY timestamp ASC`,
            [username, partner, partner, username]
        );

        res.json(messages);

    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// File upload endpoint
app.post('/upload', authenticateToken, (req, res) => {
    // Ensure uploads directory exists
    try {
        if (!fs.existsSync(UPLOADS_DIR)) {
            fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        }

        upload(req, res, function(err) {
            if (err instanceof multer.MulterError) {
                // A Multer error occurred when uploading
                console.error('Multer error:', err);
                return res.status(400).json({ error: err.message });
            } else if (err) {
                // An unknown error occurred when uploading
                console.error('Upload error:', err);
                return res.status(500).json({ error: err.message || 'File upload failed' });
            }

            // Everything went fine
            const files = req.files;
            if (!files || files.length === 0) {
                return res.status(400).json({ error: 'No files uploaded' });
            }

            try {
                const fileUrls = files.map(file => `/${UPLOADS_DIR}/${file.filename}`);
                const fileTypes = files.map(file => {
                    if (file.mimetype.startsWith('image/')) return 'image';
                    if (file.mimetype.startsWith('video/')) return 'video';
                    if (file.mimetype.startsWith('audio/')) return 'audio';
                    return 'document';
                });

                res.json({ 
                    urls: fileUrls,
                    types: fileTypes
                });
            } catch (error) {
                console.error('Error processing uploaded files:', error);
                res.status(500).json({ error: 'Error processing uploaded files' });
            }
        });
    } catch (error) {
        console.error('Server error during upload:', error);
        res.status(500).json({ error: 'Server error during upload' });
    }
});

// Session validation endpoint
app.get('/validate-session', authenticateToken, (req, res) => {
    res.json({ valid: true });
});

// Socket.IO Setup
const io = new Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST']
    }
});

// WebSocket Authentication
io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication token missing'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const [user] = await pool.query('SELECT username FROM users WHERE username = ?', [decoded.username]);

        if (!user.length) {
            throw new Error('Invalid user');
        }

        socket.user = user[0];  // Ensure `socket.user` is set

        console.log(` User ${socket.user.username} authenticated!`);
        next();  // Proceed to connection
    } catch (err) {
        console.error(' WebSocket Authentication Failed:', err);
        next(new Error('Authentication failed'));
    }
});

// Socket connection handler with message support
io.on('connection', async (socket) => {
    const username = socket.user.username;
    console.log(` User ${username} authenticated!`);
    console.log(` User connected: ${username} (Socket ID: ${socket.id})`);

    // Store socket mapping
    global.userSockets = global.userSockets || new Map();
    global.userSockets.set(username.toLowerCase(), socket.id);

    // Update user's online status
    await pool.query(
        'UPDATE users SET is_online = true, last_seen = NOW() WHERE username = ?',
        [username]
    );

    // Get partner's current status
    const partnerName = username.toLowerCase() === 'abid' ? 'sara' : 'abid';
    const [partnerStatus] = await pool.query(
        'SELECT username, is_online, last_seen FROM users WHERE username = ?',
        [partnerName]
    );

    // Send initial status to the connected user
    if (partnerStatus.length > 0) {
        socket.emit('initialStatus', [partnerStatus[0]]);
    }

    // Notify partner about this user's connection
    const partnerSocketId = global.userSockets.get(partnerName.toLowerCase());
    if (partnerSocketId) {
        io.to(partnerSocketId).emit('userStatus', {
            username,
            status: 'online'
        });
    }

    // Handle disconnect
    socket.on('disconnect', async () => {
        console.log(` User disconnected: ${username}`);
        global.userSockets.delete(username.toLowerCase());
        
        // Update last seen and online status
        await pool.query(
            'UPDATE users SET is_online = false, last_seen = NOW() WHERE username = ?',
            [username]
        );

        // Notify other user
        const otherUser = username.toLowerCase() === 'abid' ? 'sara' : 'abid';
        const otherSocketId = global.userSockets.get(otherUser);
        if (otherSocketId) {
            io.to(otherSocketId).emit('userStatus', {
                username,
                status: 'offline',
                lastSeen: new Date()
            });
        }
    });

    // Handle typing status
    socket.on('typing', (data) => {
        try {
            if (!socket.user) {
                console.error('No user data in socket');
                return;
            }

            const username = socket.user.username;
            const otherUser = username.toLowerCase() === 'abid' ? 'sara' : 'abid';
            const otherSocketId = global.userSockets.get(otherUser.toLowerCase());
            
            console.log('Typing status:', {
                from: username,
                to: otherUser,
                isTyping: data.isTyping,
                hasOtherSocket: !!otherSocketId
            });
            
            if (otherSocketId) {
                io.to(otherSocketId).emit('userTyping', {
                    username: username,
                    isTyping: data.isTyping
                });
            }
        } catch (error) {
            console.error('Error handling typing status:', error);
        }
    });

    socket.on('sendMessage', async (data, callback) => {
        try {
            console.log('Attempting to send message:', {
                sender: username,
                recipient: data.recipient,
                content: data.content,
                hasMedia: true,
                mediaUrls: data.mediaUrls,
                mediaTypes: data.mediaTypes
            });
    
            // Validate recipient exists (case-insensitive)
            const [recipientExists] = await pool.query(
                'SELECT username FROM users WHERE LOWER(username) = LOWER(?)',
                [data.recipient]
            );
    
            if (!recipientExists.length) {
                throw new Error('Recipient does not exist');
            }
    
            // Handle media URLs and types
            let mediaUrlsJson = null;
            let mediaTypesJson = null;
    
            // Only process media if both URLs and types are present and valid
            if (data.mediaUrls && Array.isArray(data.mediaUrls) && data.mediaUrls.length > 0) {
                // Directly use the arrays from the client (no need for JSON.stringify)
                mediaUrlsJson = JSON.stringify(data.mediaUrls); // Convert to JSON string
                mediaTypesJson = JSON.stringify(data.mediaTypes || Array(data.mediaUrls.length).fill('document'));
            }
    
            // Insert message into database
            const [result] = await pool.query(
                'INSERT INTO messages (sender, recipient, content, media_urls, media_types, timestamp) VALUES (?, ?, ?, ?, ?, NOW())',
                [username, data.recipient, data.content || '', mediaUrlsJson, mediaTypesJson]
            );
    
            // Fetch the complete message
            const [messages] = await pool.query(
                'SELECT id, sender, recipient, content, media_urls, media_types, status, timestamp FROM messages WHERE id = ?',
                [result.insertId]
            );
    
            if (!messages.length) {
                throw new Error('Failed to fetch sent message');
            }
    
            // Parse the message data
            const messageData = {
                ...messages[0],
                // Only parse if the values are JSON strings, otherwise use as is
                media_urls: typeof messages[0].media_urls === 'string' ? 
                    JSON.parse(messages[0].media_urls) : messages[0].media_urls,
                media_types: typeof messages[0].media_types === 'string' ? 
                    JSON.parse(messages[0].media_types) : messages[0].media_types
            };
    
            console.log('Processed message data:', messageData);
    
            // Send to recipient if online
            const recipientSocket = global.userSockets.get(data.recipient.toLowerCase());
            if (recipientSocket) {
                io.to(recipientSocket).emit('newMessage', messageData);
            }
    
            // Send back to sender
            socket.emit('newMessage', messageData);
    
            if (typeof callback === 'function') {
                callback({ status: 'sent', message: messageData });
            }
    
        } catch (error) {
            console.error('Error sending message:', error);
            if (typeof callback === 'function') {
                callback({ status: 'error', error: error.message });
            }
        }
    });
    

    // Handle message read status
    socket.on('markAsRead', async ({ messageId }) => {
        try {
            await pool.query(
                'UPDATE messages SET status = "read" WHERE id = ?',
                [messageId]
            );

            // Get message details to notify sender
            const [message] = await pool.query(
                'SELECT sender FROM messages WHERE id = ?',
                [messageId]
            );

            if (message.length > 0) {
                const senderSocketId = global.userSockets.get(message[0].sender);
                if (senderSocketId) {
                    io.to(senderSocketId).emit('messageRead', { messageId });
                }
            }
        } catch (err) {
            console.error('Error marking message as read:', err);
        }
    });

    // Handle message read receipts
    socket.on('messageRead', async ({ messageId }) => {
        try {
            const [message] = await pool.query(
                'SELECT sender FROM messages WHERE id = ?',
                [messageId]
            );

            if (message.length > 0) {
                // Update message status
                await pool.query(
                    'UPDATE messages SET status = "read" WHERE id = ?',
                    [messageId]
                );

                // Notify sender
                const senderSocketId = global.userSockets.get(message[0].sender);
                if (senderSocketId) {
                    io.to(senderSocketId).emit('messageStatus', {
                        messageId,
                        status: 'read'
                    });
                }
            }
        } catch (err) {
            console.error('Read receipt error:', err);
        }
    });

    // Handle user status request
    socket.on('requestUserStatus', async () => {
        try {
            const partner = socket.user.username.toLowerCase() === 'abid' ? 'sara' : 'abid';
            const [rows] = await pool.query(
                'SELECT is_online, last_seen FROM users WHERE username = ?',
                [partner]
            );
            
            if (rows.length > 0) {
                const status = rows[0].is_online ? 'online' : 'offline';
                socket.emit('userStatusUpdate', {
                    status,
                    lastSeen: rows[0].last_seen
                });
            }
        } catch (err) {
            console.error('Status request error:', err);
            socket.emit('userStatusUpdate', { error: 'Failed to get status' });
        }
    });

    socket.on('logout', async () => {
        try {
            const username = socket.user?.username;  // Ensure `socket.user` is defined before accessing `username`
            if (username) {
                console.log(` User logging out: ${username}`);
    
                // Update user status in the database to offline and set the last_seen timestamp
                await pool.query(
                    'UPDATE users SET is_online = false, last_seen = NOW() WHERE username = ?',
                    [username]
                );
    
                // Notify the other user about the status change
                const otherUser = username.toLowerCase() === 'abid' ? 'sara' : 'abid';
                const otherSocketId = global.userSockets.get(otherUser);
                if (otherSocketId) {
                    io.to(otherSocketId).emit('userStatus', {
                        username,
                        status: 'offline',
                        lastSeen: new Date() // Set to current time for the "lastSeen"
                    });
                }
    
                // Remove the user from the socket mapping
                global.userSockets.delete(username.toLowerCase());
    
                // Disconnect the socket
                socket.disconnect(true);  // Disconnect the socket after logout
            }
        } catch (error) {
            console.error('Logout error:', error);
        }
    });
    
}); // Add missing closing bracket for io.on('connection') block

// Start Server
server.listen(PORT, () => {
    console.log(` Server running on port ${PORT}`);
});
