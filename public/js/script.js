let socket;
let authToken = localStorage.getItem('authToken');
let currentUser = localStorage.getItem('currentUser');
let partnerName;
let isTyping = false;
let typingTimeout;
let unreadMessages = new Set();
let lastNotificationTime = 0;
let windowHasFocus = true;
let soundEnabled = false;

// Audio notification
const notificationSound = document.getElementById('notificationSound');
const MIN_NOTIFICATION_INTERVAL = 3000; // Minimum time between notification sounds (3 seconds)

// Ensure audio is loaded and ready
notificationSound.load();

// Enable sound on first interaction
function enableSound() {
    if (!soundEnabled) {
        console.log('Enabling sound...');
        notificationSound.volume = 0;
        notificationSound.play()
            .then(() => {
                soundEnabled = true;
                notificationSound.volume = 1;
                notificationSound.pause();
                notificationSound.currentTime = 0;
                console.log('Sound enabled successfully');
            })
            .catch(err => console.error('Could not enable sound:', err));
    }
}

// Add sound enabler to user interactions
['click', 'touchstart', 'keydown'].forEach(event => {
    document.addEventListener(event, enableSound, { once: true });
});

// Window focus handling
window.addEventListener('focus', () => {
    console.log('Window focused');
    windowHasFocus = true;
    unreadMessages.clear();
});

window.addEventListener('blur', () => {
    console.log('Window blurred');
    windowHasFocus = false;
});

// Function to play notification sound
function playNotificationSound() {
    if (!soundEnabled) {
        console.log('Sound not enabled yet, waiting for user interaction');
        return;
    }

    const now = Date.now();
    if (now - lastNotificationTime >= MIN_NOTIFICATION_INTERVAL) {
        console.log('Attempting to play sound...');
        notificationSound.currentTime = 0;
        notificationSound.volume = 1;
        notificationSound.play()
            .then(() => {
                console.log('Sound played successfully');
                lastNotificationTime = now;
            })
            .catch(err => {
                console.error('Error playing sound:', err);
                soundEnabled = false; // Reset if we lost permission
                enableSound(); // Try to re-enable
            });
    } else {
        console.log('Skipping sound, too soon since last play');
    }
}

// Auto-logout configuration
const INACTIVE_TIMEOUT = 5 * 60 * 1000; 
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
    loadMessageHistory(0, true); // Start with page 0 and scroll to bottom
    setupScrollPagination(); // Setup scroll event for pagination
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
            
            // Play notification sound only when window is not focused
            if (!windowHasFocus) {
                playNotificationSound();
            }
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

// Add message pagination state
let messageState = {
    currentPage: 0,
    hasMore: true,
    isLoading: false,
    initialLoad: true,
    lastScrollPosition: 0
};

// Updated function to load messages with pagination
async function loadMessageHistory(page = 0, scrollToBottom = true) {
    try {
        if (messageState.isLoading) return;
        
        messageState.isLoading = true;
        const limit = 50; // Messages per page
        
        // Show loading indicator for initial load
        if (messageState.initialLoad) {
            showLoading('Loading messages...');
        } else if (page === 0) {
            // For refresh, show loading
            showLoading('Refreshing messages...');
        } else {
            // Add loading indicator at the top for older messages
            const loadingIndicator = document.createElement('div');
            loadingIndicator.id = 'messageLoadingIndicator';
            loadingIndicator.className = 'message-loading';
            loadingIndicator.textContent = 'Loading older messages...';
            
            const messagesDiv = document.getElementById('messages');
            if (messagesDiv.firstChild) {
                messagesDiv.insertBefore(loadingIndicator, messagesDiv.firstChild);
            } else {
                messagesDiv.appendChild(loadingIndicator);
            }
        }
        
        const response = await fetch(`/messages?page=${page}&limit=${limit}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to load messages: ${response.status}`);
        }

        const data = await response.json();
        console.log(data);
        
        const { messages, pagination } = data;
        
        // Remove loading indicator if it exists
        const loadingIndicator = document.getElementById('messageLoadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
        
        // Update pagination state
        messageState.currentPage = pagination.page;
        messageState.hasMore = pagination.hasMore;
        
        const messagesDiv = document.getElementById('messages');
        const messagesContainer = document.getElementById('messagesContainer');
        
        // Save scroll position and height before adding new messages
        const prevScrollHeight = messagesContainer.scrollHeight;
        
        // For first page or refresh, clear existing messages
        if (page === 0) {
            messagesDiv.innerHTML = '';
        }
        
        // For initial load or refresh, process all messages
        if (messages && messages.length > 0) {
            // Remember the first message's ID for scroll position restoration
            const firstMessageId = messages[0].id;
            
            // Add messages in order
            messages.forEach(message => addMessageToUI(message, page !== 0));
            
            // Handle scrolling based on context
            if (scrollToBottom || messageState.initialLoad) {
                // Scroll to bottom for new messages or initial load
                setTimeout(() => {
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    messageState.initialLoad = false;
                }, 100);
            } else if (page > 0) {
                // Maintain scroll position when loading older messages
                setTimeout(() => {
                    // Find the element that was previously at the top
                    const firstMessage = document.getElementById(`message-${firstMessageId}`);
                    if (firstMessage) {
                        // Calculate new position
                        const newScrollHeight = messagesContainer.scrollHeight;
                        const heightDiff = newScrollHeight - prevScrollHeight;
                        messagesContainer.scrollTop = heightDiff;
                    }
                }, 100);
            }
        }
        
        // Hide loading indicator
        hideLoading();
        
    } catch (error) {
        console.error('Failed to load messages:', error);
        hideLoading();
        if (error.message.includes('token')) {
            handleAuthError();
        }
    } finally {
        messageState.isLoading = false;
    }
}

// Function to load older messages when scrolling up
function setupScrollPagination() {
    const messagesContainer = document.getElementById('messagesContainer');
    
    messagesContainer.addEventListener('scroll', function() {
        // If we're near the top of the container and there are more messages
        if (messagesContainer.scrollTop < 200 && messageState.hasMore && !messageState.isLoading) {
            // Load the next page
            loadMessageHistory(messageState.currentPage + 1, false);
        }
        
        // Store last scroll position
        messageState.lastScrollPosition = messagesContainer.scrollTop;
    });
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
function addMessageToUI(message, prepend = false) {
    const messagesDiv = document.getElementById('messages');
    
    // Create message container
    const messageContainer = document.createElement('div');
    messageContainer.className = `message-container ${message.sender === currentUser ? 'sent' : 'received'}`;
    messageContainer.id = `message-${message.id}`; // Add ID for scroll position reference
    
    // Message content div
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
    // Text content
    if (message.content) {
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.innerHTML = message.content.replace(/\n/g, '<br>');
        messageDiv.appendChild(textDiv);
    }
    
    // Media content if any
    if (message.media_urls && Array.isArray(message.media_urls) && message.media_urls.length > 0) {
        const mediaTypes = Array.isArray(message.media_types) ? message.media_types : [];
        
        message.media_urls.forEach((url, index) => {
            const type = mediaTypes[index] || 'image';
            const mediaElement = createMediaElement(url, type);
            messageDiv.appendChild(mediaElement);
        });
    }
    
    // Timestamp
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    const messageDate = new Date(message.timestamp);
    
    // Format message timestamp to local time
    const timeOptions = {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    };
    
    // Add date only for messages from a different day
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (messageDate.toDateString() === today.toDateString()) {
        timeDiv.textContent = `Today, ${messageDate.toLocaleTimeString([], timeOptions)}`;
    } else if (messageDate.toDateString() === yesterday.toDateString()) {
        timeDiv.textContent = `Yesterday, ${messageDate.toLocaleTimeString([], timeOptions)}`;
    } else {
        timeDiv.textContent = `${messageDate.toLocaleDateString([], { 
            month: 'short', 
            day: 'numeric' 
        })}, ${messageDate.toLocaleTimeString([], timeOptions)}`;
    }
    
    messageDiv.appendChild(timeDiv);
    messageContainer.appendChild(messageDiv);
    
    // Add to DOM based on whether to prepend or append
    if (prepend && messagesDiv.firstChild) {
        messagesDiv.insertBefore(messageContainer, messagesDiv.firstChild);
    } else {
        messagesDiv.appendChild(messageContainer);
    }
    
    // Handle lazy loading of media
    lazyLoadMessageMedia(messageContainer);
}

// Function to lazy load media in messages
function lazyLoadMessageMedia(messageContainer) {
    const mediaElements = messageContainer.querySelectorAll('img, video');
    
    mediaElements.forEach(media => {
        // Use IntersectionObserver for lazy loading
        if ('IntersectionObserver' in window) {
            const lazyMediaObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const mediaElement = entry.target;
                        
                        // If data-src is defined, use it to set the src
                        if (mediaElement.dataset.src) {
                            mediaElement.src = mediaElement.dataset.src;
                            mediaElement.removeAttribute('data-src');
                        }
                        
                        observer.unobserve(mediaElement);
                    }
                });
            });
            
            lazyMediaObserver.observe(media);
        } else {
            // Fallback for browsers without IntersectionObserver
            media.src = media.dataset.src;
            media.removeAttribute('data-src');
        }
    });
}

// Import the necessary compression libraries
async function loadCompressionLibraries() {
    try {
        // Load image compression library
        await loadScript('https://cdn.jsdelivr.net/npm/browser-image-compression@2.0.2/dist/browser-image-compression.min.js');
        
        // Load FFmpeg
        const { createFFmpeg, fetchFile } = FFmpeg;
        window.FFmpeg = { createFFmpeg, fetchFile };
        
        console.log('Compression libraries loaded successfully');
        window.compressionLibrariesLoaded = true;
    } catch (error) {
        console.error('Error loading compression libraries:', error);
        window.compressionLibrariesLoaded = false;
        alert('Media compression libraries failed to load. Files will be uploaded without compression.');
    }
}

// Helper function to load scripts
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Compress image with better handling
async function compressImage(file) {
    try {
        if (!window.compressionLibrariesLoaded || typeof imageCompression !== 'function') {
            console.warn('Image compression library not loaded');
            return file;
        }
        
        console.log('Starting image compression:', file.name);
        showLoading('Compressing image...');
        
        const options = {
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
            initialQuality: 0.7,
            onProgress: (percent) => {
                console.log(`Compression progress: ${percent}%`);
                showLoading(`Compressing... ${Math.round(percent)}%`);
            }
        };
        
        const compressedFile = await imageCompression(file, options);
        console.log(`Original size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`Compressed size: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);
        
        return compressedFile;
    } catch (error) {
        console.error('Image compression error:', error);
        return file;
    }
}

function createMediaElement(url, type) {
    const container = document.createElement('div');
    container.className = 'media-container';

    // Add loading state
    const loader = document.createElement('div');
    loader.className = 'media-loader';
    loader.innerHTML = `
        <div class="spinner"></div>
        <span>Loading media...</span>
    `;
    container.appendChild(loader);

    // Create media element
    const media = type.startsWith('video/') 
        ? document.createElement('video')
        : document.createElement('image');

    media.className = 'media-content';
    media.setAttribute('loading', 'lazy');
    
    if (media.tagName === 'VIDEO') {
        media.controls = true;
        media.playsInline = true;
    }

    // Handle successful load
    media.onload = media.onloadeddata = () => {
        container.removeChild(loader);
        container.appendChild(media);
    };

    // Handle errors
    media.onerror = () => {
        loader.innerHTML = 'Failed to load media';
        loader.className = 'media-error';
    };

    media.src = url;
    return container;
}

// Update video preview handling
function createMediaPreview(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        const preview = document.createElement('div');
        preview.className = 'media-preview';
        
        reader.onload = (e) => {
            if (file.type.startsWith('video/')) {
                const video = document.createElement('video');
                video.className = 'preview-content';
                video.controls = true;
                video.preload = 'metadata';
                video.playsInline = true;
                
                // Handle video preview errors
                video.onerror = function() {
                    console.error('Video preview error:', video.error);
                    const errorMsg = document.createElement('div');
                    errorMsg.className = 'preview-error';
                    errorMsg.textContent = 'Video preview failed';
                    preview.appendChild(errorMsg);
                };
                
                preview.appendChild(video);
            } else if (file.type.startsWith('image/')) {
                const img = document.createElement('img');
                img.className = 'preview-content';
                img.src = e.target.result;
                preview.appendChild(img);
            }
            resolve(preview);
        };
        
        reader.onerror = () => {
            console.error('File preview error:', reader.error);
            const errorMsg = document.createElement('div');
            errorMsg.className = 'preview-error';
            errorMsg.textContent = 'Preview failed';
            preview.appendChild(errorMsg);
            resolve(preview);
        };
        
        reader.readAsDataURL(file);
    });
}
function isFileTypeAllowed(file) {
    const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif',
        'video/mp4', 'video/webm', 'video/ogg'
    ];
    return allowedTypes.includes(file.type);
}

// File input handler with preview
let isUploading = false;

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

        // Create preview for images or videos
        if (file.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.className = 'preview-image';
            previewWrapper.appendChild(img);
        } else if (file.type.startsWith('video/')) {
            const video = document.createElement('video');
            video.src = URL.createObjectURL(file);
            video.controls = true;
            video.className = 'preview-video';
            previewWrapper.appendChild(video);
        }

        // Add progress bar
        const progressBarContainer = document.createElement('div');
        progressBarContainer.className = 'upload-progress';
        progressBarContainer.innerHTML = `
            <div class="progress-bar"></div>
            <span class="progress-text">Preparing...</span>
        `;
        previewWrapper.appendChild(progressBarContainer);

        // Remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-preview';
        removeBtn.innerHTML = '×';
        removeBtn.onclick = function () {
            previewWrapper.remove();
            document.getElementById('fileInput').value = ''; // Clear input if no files remain
        };
        previewWrapper.appendChild(removeBtn);

        previewContainer.appendChild(previewWrapper);
    });
});

document.getElementById('messageForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const messageInput = document.getElementById('messageInput');
    const fileInput = document.getElementById('fileInput');
    const sendButton = document.querySelector('#messageForm button[type="submit"]');
    const content = messageInput.value.trim();

    if (!content && fileInput.files.length === 0) {
        return;
    }

    try {
        let mediaUrls = [];
        let mediaTypes = [];

        if (fileInput.files.length > 0) {
            try {
                sendButton.disabled = true;

                // Show progress bars
                document.querySelectorAll('.upload-progress').forEach(p => p.style.display = 'block');

                const formData = new FormData();
                Array.from(fileInput.files).forEach(file => formData.append('media', file));

                const xhr = new XMLHttpRequest();
                xhr.open('POST', '/upload', true);
                xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);

                // Track upload progress
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const progress = Math.round((e.loaded / e.total) * 100);
                        document.querySelectorAll('.progress-bar').forEach(bar => bar.style.width = progress + '%');
                        document.querySelectorAll('.progress-text').forEach(text => text.textContent = `Uploading: ${progress}%`);
                    }
                };

                xhr.upload.onloadstart = () => {
                    document.querySelectorAll('.progress-text').forEach(text => text.textContent = 'Starting upload...');
                };

                xhr.upload.onload = () => {
                    document.querySelectorAll('.progress-text').forEach(text => text.textContent = 'Processing...');
                };

                xhr.onload = async function () {
                    if (xhr.status === 200) {
                        const response = JSON.parse(xhr.responseText);
                        mediaUrls = response.urls;
                        mediaTypes = response.types;

                        // Send the message with media
                        socket.emit('sendMessage', {
                            content,
                            recipient: partnerName,
                            mediaUrls: mediaUrls,
                            mediaTypes: mediaTypes
                        }, (response) => {
                            if (!response.error) {
                                // Add message to UI
                                addMessageToUI({
                                    sender: currentUser,
                                    recipient: partnerName,
                                    content: content,
                                    media_urls: mediaUrls,
                                    media_types: mediaTypes,
                                    timestamp: new Date().toISOString(),
                                    status: 'sent'
                                });

                                // Clear input
                                messageInput.value = '';
                                fileInput.value = '';
                                document.getElementById('mediaPreview').innerHTML = '';
                            }
                        });
                    } else {
                        throw new Error('Upload failed');
                    }
                };

                xhr.onerror = () => {
                    throw new Error('Upload failed');
                };

                xhr.send(formData);
            } catch (error) {
                console.error('Upload error:', error);
                alert('Failed to upload media: ' + error.message);
            } finally {
                sendButton.disabled = false;
                document.querySelectorAll('.upload-progress').forEach(p => p.style.display = 'none');
            }
        } else {
            // Send text-only message
            socket.emit('sendMessage', {
                content,
                recipient: partnerName,
                mediaUrls: [],
                mediaTypes: []
            }, (response) => {
                if (!response.error) {
                    // Add message to UI
                    addMessageToUI({
                        sender: currentUser,
                        recipient: partnerName,
                        content: content,
                        media_urls: [],
                        media_types: [],
                        timestamp: new Date().toISOString(),
                        status: 'sent'
                    });

                    // Clear input
                    messageInput.value = '';
                }
            });
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to send message: ' + error.message);
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

// Lossless compression configuration
const COMPRESSION_OPTIONS = {
    image: {
        maxSizeMB: 0.8,           // Target size of 800KB
        maxWidthOrHeight: 1600,   // Reasonable max dimension
        useWebWorker: true,
        preserveExif: false,      // Don't preserve metadata to reduce size
        initialQuality: 0.8,      // Good balance of quality and size
        fileType: 'auto'
    }
};

// Load compression libraries
async function loadCompressionLibraries() {
    try {
        // Load image compression library first
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/browser-image-compression@2.0.2/dist/browser-image-compression.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
        
        console.log('Compression libraries loaded successfully');
        window.compressionLibrariesLoaded = true;
    } catch (error) {
        console.error('Error loading compression libraries:', error);
        window.compressionLibrariesLoaded = false;
    }
}

// Compress image with better error handling
async function compressImage(file) {
    try {
        if (!window.compressionLibrariesLoaded) {
            console.warn('Compression library not loaded, using original file');
            return file;
        }

        console.log('Starting compression for:', file.name);
        console.log('Original size:', (file.size / 1024 / 1024).toFixed(2) + 'MB');
        
        const options = {
            ...COMPRESSION_OPTIONS.image,
            onProgress: (percent) => {
                showLoading(`Compressing ${file.name}... ${Math.round(percent)}%`);
            }
        };

        const compressedFile = await imageCompression(file, options);
        console.log('Compressed size:', (compressedFile.size / 1024 / 1024).toFixed(2) + 'MB');
        
        // If compression didn't help, return original
        if (compressedFile.size >= file.size) {
            console.log('Compression ineffective, using original');
            return file;
        }
        
        return compressedFile;
    } catch (error) {
        console.error('Compression failed:', error);
        return file; // Return original file on error
    }
}

// Improved media preview handling
function createMediaPreview(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        const preview = document.createElement('div');
        preview.className = 'media-preview';

        reader.onload = (e) => {
            if (file.type.startsWith('video/')) {
                const video = document.createElement('video');
                video.className = 'preview-content';
                video.controls = true;
                video.preload = 'metadata';
                video.playsInline = true;
                
                // Add loading indicator
                const loadingDiv = document.createElement('div');
                loadingDiv.className = 'video-loading';
                loadingDiv.textContent = 'Loading video...';
                preview.appendChild(loadingDiv);
                
                // Handle video events
                video.onloadedmetadata = () => {
                    loadingDiv.remove();
                    preview.appendChild(video);
                };
                
                video.onerror = () => {
                    console.error('Video preview error:', video.error);
                    loadingDiv.textContent = 'Video preview failed';
                    loadingDiv.className = 'video-error';
                };
                
                video.src = e.target.result;
            } else if (file.type.startsWith('image/')) {
                const img = document.createElement('img');
                img.className = 'preview-content';
                img.src = e.target.result;
                preview.appendChild(img);
            }
            resolve(preview);
        };

        reader.onerror = () => {
            console.error('Preview failed:', reader.error);
            const errorDiv = document.createElement('div');
            errorDiv.className = 'preview-error';
            errorDiv.textContent = 'Preview failed';
            preview.appendChild(errorDiv);
            resolve(preview);
        };

        reader.readAsDataURL(file);
    });
}

function createMediaElement(url, mediaType) {
    const container = document.createElement('div');
    container.className = 'media-container';

    // Create loader element
    const loader = document.createElement('div');
    loader.className = 'media-loader';
    loader.innerHTML = '<div class="spinner"></div> Loading media...';
    container.appendChild(loader);

    // Create media element
    let media;
    if (mediaType === 'video') {
        media = document.createElement('video');
        media.controls = true;
        media.playsInline = true;
        media.style.maxWidth = '100%';
    } else {
        media = document.createElement('img');
        media.style.maxWidth = '100%';
        media.loading = 'lazy';
    }

    media.onloadeddata = media.onload = () => {
        container.removeChild(loader);
        media.style.visibility = 'visible';
    };

    media.onerror = () => {
        loader.innerHTML = 'Failed to load media';
        loader.className = 'media-error';
    };

    media.src = url;
    container.appendChild(media);
    return container;
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

// Load compression libraries when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Set global flag for tracking library status
    window.compressionLibrariesLoaded = false;
    
    loadCompressionLibraries().then(() => {
        console.log('All compression libraries loaded successfully');
        // Set a global variable to indicate libraries are ready
        window.compressionLibrariesLoaded = true;
    }).catch(err => {
        console.error('Failed to load compression libraries:', err);
        alert('Media compression libraries failed to load. Files will be uploaded without compression.');
    });
});
