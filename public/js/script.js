let socket;
let authToken = localStorage.getItem('authToken');
let currentUser = localStorage.getItem('currentUser');
let partnerName;
let isTyping = false;
let typingTimeout;
let unreadMessages = new Set();
let lastNotificationTime = 0;

// Auto-logout configuration
const INACTIVE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
let inactivityTimer;

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        console.log('User inactive, logging out...');
        handleLogout();
    }, INACTIVE_TIMEOUT);
}

// Add activity listeners
function setupActivityListeners() {
    const events = ['mousedown', 'keydown', 'mousemove', 'touchstart'];
    events.forEach(event => {
        document.addEventListener(event, resetInactivityTimer);
    });
    resetInactivityTimer();
}

// Add session validation function
async function validateSession() {
    const token = localStorage.getItem('authToken');
    if (!token) return false;

    try {
        const response = await fetch('/validate-session', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Session invalid');
        }

        return true;
    } catch (error) {
        console.error('Session validation error:', error);
        return false;
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    if (authToken && currentUser) {
        // Validate the session before initializing
        const isValid = await validateSession();
        if (isValid) {
            setupActivityListeners();
            initializeChat();
        } else {
            // Clear invalid session data
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            showLoginForm();
        }
    } else {
        showLoginForm();
    }
});

// Login form handler
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorElement = document.getElementById('loginError');
    
    console.log('Attempting login for user:', username);
    
    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }

        // Store credentials
        authToken = data.token;
        currentUser = data.username;
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('currentUser', currentUser);

        console.log('Login successful, initializing chat...');
        // Initialize chat
        initializeChat();

    } catch (error) {
        console.error('Login error:', error);
        errorElement.textContent = error.message;
    }
});

// Initialize chat interface
function initializeChat() {
    partnerName = currentUser.toLowerCase() === 'abid' ? 'sara' : 'abid';
    
    document.getElementById('chatTitle').textContent = 
        // ` ${partnerName.charAt(0).toUpperCase() + partnerName.slice(1)} ❤️`;
        `❤️`
    
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('chatContainer').style.display = 'flex';
    
    initializeSocket();
    setupTypingHandler();
    loadMessageHistory();
}

// Show login form
function showLoginForm() {
    document.getElementById('loginOverlay').style.display = 'flex';
    document.getElementById('chatContainer').style.display = 'none';
    document.getElementById('loginError').textContent = '';
}

// Initialize socket connection
function initializeSocket() {
    if (socket) {
        socket.disconnect();
    }

    socket = io({
        auth: {
            token: authToken
        }
    });

    socket.on('connect', () => {
        console.log('Socket connected');
        updateConnectionStatus(true);
    });

    socket.on('disconnect', async () => {
        console.log('Socket disconnected');
        updateConnectionStatus(false);
    });

    socket.on('userTyping', (data) => {
        if (data.isTyping) {
            updatePartnerStatus('typing');
        } else {
            // When user stops typing, revert to online status
            updatePartnerStatus('online');
        }
    });

    socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        if (error.message.includes('Authentication')) {
            handleAuthError();
        }
    });

    socket.on('newMessage', (message) => {
        console.log('New message received:', message);
        
        // Parse media URLs and types if they exist
        if (message.media_urls && typeof message.media_urls === 'string') {
            message.media_urls = JSON.parse(message.media_urls);
        }
        if (message.media_types && typeof message.media_types === 'string') {
            message.media_types = JSON.parse(message.media_types);
        }
        
        // Only add message to UI if it's from the other user
        // (our own messages are added immediately when sent)
        if (message.sender.toLowerCase() !== currentUser.toLowerCase()) {
            // Add message to UI
            addMessageToUI(message);
            
            // Play notification sound for received messages
            playNotificationSound();
        }
        
        // Scroll to bottom
        const container = document.getElementById('messagesContainer');
        container.scrollTop = container.scrollHeight;
    });

    socket.on('initialStatus', (users) => {
        users.forEach(user => {
            updatePartnerStatus(user.is_online ? 'online' : { lastSeen: user.last_seen });
        });
    });

    socket.on('userStatus', (data) => {
        if (data.username.toLowerCase() === partnerName.toLowerCase()) {
            if (data.status === 'online') {
                updatePartnerStatus('online');
            } else {
                updatePartnerStatus({ lastSeen: data.lastSeen });
            }
        }
    });

    // Request status update periodically
    setInterval(() => {
        if (socket && socket.connected) {
            socket.emit('requestUserStatus', (response) => {
                if (response.error) {
                    console.error('Error fetching user status:', response.error);
                } else {
                    console.log('User status:', response);
                }
            });
        }
    }, 10000); // Every 10 seconds
}

// Update connection status in UI
function updateConnectionStatus(isConnected) {
    const statusElement = document.getElementById('connectionStatus');
    if (!statusElement) return;

    if (isConnected) {
        statusElement.textContent = '🟢 Connected';
        statusElement.className = 'connection-status connected';
    } else {
        statusElement.textContent = '🔴 Disconnected';
        statusElement.className = 'connection-status disconnected';
    }
}

// Update partner status
function updatePartnerStatus(status) {
    const statusElement = document.getElementById('partnerStatus');
    if (!statusElement) return;

    // Reset classes
    statusElement.className = 'partner-status';

    if (status === 'typing') {
        statusElement.textContent = 'typing...';
        statusElement.classList.add('typing');
    } else if (status === 'online') {
        statusElement.textContent = 'online';
        statusElement.classList.add('online');
    } else if (status.lastSeen) {
        const timeAgo = getTimeAgo(new Date(status.lastSeen));
        statusElement.textContent = `last seen ${timeAgo}`;
        statusElement.classList.add('offline');
    } else {
        statusElement.textContent = 'offline';
        statusElement.classList.add('offline');
    }
}

// Helper function to format time ago
function getTimeAgo(date) {
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 30) return 'just now';
    if (seconds < 60) return 'a minute ago';
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return minutes === 1 ? 'a minute ago' : `${minutes} minutes ago`;
    }
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return hours === 1 ? 'an hour ago' : `${hours} hours ago`;
    }
    
    const days = Math.floor(hours / 24);
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    
    // For dates older than a week, show the actual date
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

async function loadMessageHistory() {
    try {
        const response = await fetch('/messages', {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to load messages: ${response.status}`);
        }

        const messages = await response.json();
        const messagesDiv = document.getElementById('messages');
        messagesDiv.innerHTML = ''; // Clear existing messages
        
        if (messages && messages.length > 0) {
            messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            messages.forEach(message => addMessageToUI(message));
        }

        // Scroll to bottom after loading messages
        setTimeout(() => {
            const container = document.getElementById('messagesContainer');
            container.scrollTop = container.scrollHeight;
        }, 100);

    } catch (error) {
        console.error('Failed to load messages:', error);
        if (error.message.includes('token')) {
            handleAuthError();
        }
    }
}

// Handle authentication errors
function handleAuthError() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    authToken = null;
    currentUser = null;
    showLoginForm();
}

// Add message to UI
function addMessageToUI(message) {
    const messagesDiv = document.getElementById('messages');
    const isSent = message.sender.toLowerCase() === currentUser.toLowerCase();
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;

    const timestamp = new Date(message.timestamp).toLocaleString();
    messageDiv.innerHTML = `
        <div class="message-content">
            <p>${message.content || ''}</p>
            <div class="message-footer">
                <span class="timestamp">${timestamp}</span>
                ${isSent ? `<span class="message-status">${message.status === 'read' ? '✓✓' : '✓'}</span>` : ''}
            </div>
        </div>
    `;

    // Handle media attachments
    const mediaUrls = Array.isArray(message.media_urls) ? message.media_urls : 
                     (message.media_urls ? JSON.parse(message.media_urls) : null);
    const mediaTypes = Array.isArray(message.media_types) ? message.media_types :
                      (message.media_types ? JSON.parse(message.media_types) : null);

    if (mediaUrls && mediaUrls.length > 0) {
        const mediaContainer = document.createElement('div');
        mediaContainer.className = 'media-container';
        
        mediaUrls.forEach((url, index) => {
            const mediaType = mediaTypes?.[index] || 'document';
            const mediaElement = createMediaElement(url, mediaType);
            if (mediaElement) {
                mediaContainer.appendChild(mediaElement);
            }
        });
        
        messageDiv.appendChild(mediaContainer);
    }

    messagesDiv.appendChild(messageDiv);
    const container = document.getElementById('messagesContainer');
    container.scrollTop = container.scrollHeight;
}

// Create media element based on type
function createMediaElement(url, type) {
    if (type === 'image') {
        const img = document.createElement('img');
        img.src = url;
        img.alt = 'Shared Image';
        img.classList.add('message-media');
        // Add click handler for fullscreen
        img.addEventListener('click', () => showImageFullscreen(url));
        return img;
    } else if (type === 'video') {
        const video = document.createElement('video');
        video.src = url;
        video.controls = true;
        video.classList.add('message-media');
        return video;
    }
    return null;
}

// Fullscreen image handling
function showImageFullscreen(imageUrl) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    const closeBtn = document.querySelector('.close-modal');
    
    modalImg.src = imageUrl;
    modal.style.display = 'block';
    
    // Close on clicking X button
    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };
    
    // Close on clicking outside the image
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
    
    // Close on escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.style.display === 'block') {
            modal.style.display = 'none';
        }
    });
}

// File input handler with preview
document.getElementById('fileInput').addEventListener('change', function(e) {
    const files = Array.from(e.target.files);
    const previewContainer = document.getElementById('mediaPreview');
    
    // Clear previous previews
    previewContainer.innerHTML = '';
    
    files.forEach(file => {
        if (!isFileTypeAllowed(file)) {
            alert(`File type not allowed: ${file.type}`);
            return;
        }
        
        const previewWrapper = document.createElement('div');
        previewWrapper.className = 'media-preview-item';
        
        // Create preview based on file type
        if (file.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            previewWrapper.appendChild(img);
        } else if (file.type.startsWith('video/')) {
            const video = document.createElement('video');
            video.src = URL.createObjectURL(file);
            video.controls = true;
            previewWrapper.appendChild(video);
        }
        
        // Add remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'media-preview-remove';
        removeBtn.innerHTML = '×';
        removeBtn.onclick = function(e) {
            e.preventDefault();
            previewWrapper.remove();
            
            // If no previews left, clear the file input
            if (previewContainer.children.length === 0) {
                document.getElementById('fileInput').value = '';
            }
        };
        
        previewWrapper.appendChild(removeBtn);
        previewContainer.appendChild(previewWrapper);
    });
});

// Update message form submit to handle media
document.getElementById('messageForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const messageInput = document.getElementById('messageInput');
    const fileInput = document.getElementById('fileInput');
    const content = messageInput.value.trim();
    
    // Check if there's either text content or files
    if (!content && fileInput.files.length === 0) {
        return;
    }
    
    try {
        let mediaUrls = [];
        let mediaTypes = [];
        
        // Handle file uploads first if any
        if (fileInput.files.length > 0) {
            try {
                // Check if we have an auth token
                if (!authToken) {
                    throw new Error('Not authenticated. Please log in again.');
                }

                const formData = new FormData();
                Array.from(fileInput.files).forEach(file => {
                    formData.append('media', file);  
                });
                
                const uploadResponse = await fetch('/upload', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: formData
                });
                
                let errorMessage;
                if (!uploadResponse.ok) {
                    const responseText = await uploadResponse.text();
                    try {
                        const errorData = JSON.parse(responseText);
                        errorMessage = errorData.error;
                    } catch (e) {
                        errorMessage = responseText;
                    }
                    throw new Error(errorMessage || 'Failed to upload files');
                }
                
                const uploadResult = await uploadResponse.json();
                if (!uploadResult.urls || !Array.isArray(uploadResult.urls)) {
                    throw new Error('Invalid response from server');
                }
                
                mediaUrls = uploadResult.urls;
                mediaTypes = uploadResult.types || Array.from(fileInput.files).map(file => 
                    file.type.startsWith('image/') ? 'image' :
                    file.type.startsWith('video/') ? 'video' :
                    file.type.startsWith('audio/') ? 'audio' : 'document'
                );
            } catch (uploadError) {
                console.error('Media upload error:', uploadError);
                alert('Failed to upload media: ' + uploadError.message);
                return;
            }
        }
        
        // Send message with media
        socket.emit('sendMessage', {
            recipient: partnerName,
            content: content,
            mediaUrls: mediaUrls,
            mediaTypes: mediaTypes
        }, (response) => {
            if (response.error) {
                console.error('Error sending message:', response.error);
                return;
            }
            
            // Add message to UI immediately
            addMessageToUI({
                sender: currentUser,
                recipient: partnerName,
                content: content,
                media_urls: mediaUrls,
                media_types: mediaTypes,
                timestamp: new Date().toISOString()
            });
            
            // Clear input and preview
            messageInput.value = '';
            fileInput.value = '';
            document.getElementById('mediaPreview').innerHTML = '';

            // Scroll to bottom
            const container = document.getElementById('messagesContainer');
            container.scrollTop = container.scrollHeight;
        });
        
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
        // Disable the logout button to prevent multiple clicks
        const logoutButton = document.getElementById('logoutBtn');
        logoutButton.disabled = true;

        // Show loading state
        showLoading('Logging out...');

        // Notify the server about logout (disconnect socket)
        handleLogout();
    } catch (error) {
        console.error('Logout error:', error);
    }
});

// Handle logout
function handleLogout() {
    if (socket) {
        socket.disconnect();
    }
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    authToken = null;
    currentUser = null;
    showLoginForm();
    hideLoading();  
}

// Show loading spinner
function showLoading(message = 'Loading...') {
    const loadingIndicator = document.getElementById('loadingIndicator') || createLoadingIndicator();
    loadingIndicator.textContent = message;
    loadingIndicator.style.display = 'block';
}

function hideLoading() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
}

function createLoadingIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'loadingIndicator';
    indicator.className = 'loading-indicator';
    document.body.appendChild(indicator);
    return indicator;
}

// File upload configuration
const ALLOWED_FILE_TYPES = {
    'image': ['image/jpeg', 'image/png', 'image/gif'],
    'video': ['video/mp4', 'video/webm', 'video/ogg'],
    'audio': ['audio/mpeg', 'audio/ogg', 'audio/wav'],
    'document': ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
};

function isFileTypeAllowed(file) {
    return Object.values(ALLOWED_FILE_TYPES).flat().includes(file.type);
}

function createMediaPreview(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        const preview = document.createElement('div');
        preview.className = 'media-preview';

        reader.onload = (e) => {
            if (file.type.startsWith('image/')) {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.className = 'preview-content';
                preview.appendChild(img);
            } else if (file.type.startsWith('video/')) {
                const video = document.createElement('video');
                video.src = e.target.result;
                video.controls = true;
                video.className = 'preview-content';
                preview.appendChild(video);
            } else if (file.type.startsWith('audio/')) {
                const audio = document.createElement('audio');
                audio.src = e.target.result;
                audio.controls = true;
                audio.className = 'preview-content';
                preview.appendChild(audio);
            } else {
                const icon = document.createElement('div');
                icon.className = 'document-icon';
                icon.textContent = file.name;
                preview.appendChild(icon);
            }
            resolve(preview);
        };
        reader.readAsDataURL(file);
    });
}

// Handle typing status
function setupTypingHandler() {
    const messageInput = document.getElementById('messageInput');

    messageInput.addEventListener('input', () => {
        if (!socket || !socket.connected) return;

        if (!isTyping) {
            isTyping = true;
            socket.emit('typing', { isTyping: true });
        }

        if (typingTimeout) {
            clearTimeout(typingTimeout);
        }

        typingTimeout = setTimeout(() => {
            isTyping = false;
            socket.emit('typing', { isTyping: false });
        }, 1000);
    });

    messageInput.addEventListener('blur', () => {
        if (!socket || !socket.connected) return;

        if (isTyping) {
            isTyping = false;
            socket.emit('typing', { isTyping: false });
        }

        if (typingTimeout) {
            clearTimeout(typingTimeout);
        }
    });
}
