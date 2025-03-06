/* Global Styles */
* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    font-family: 'Poppins', sans-serif;
}
body {
    /* Remove position: fixed */
    position: static;
    height: 100%;
    width: 100%;
}

html {
    height: 100%;
}
/* Chat Container */
.chat-container {
    height: var(--visual-viewport-height); /* Dynamic height */
    display: flex;
    flex-direction: column;
    width: 100vw;
    position: relative;
    background-color: #1E1E1E;
}
/* Chat Header */
.chat-header {
    background-color: #1a1a1a;
    padding: 6px 12px;
    border-bottom: 1px solid #2d2d2d;
    height: 32px;
    flex: 0 0 auto;
    display: flex;
    align-items: center;
}

.header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
}

.chat-info {
    display: flex;
    align-items: center;
    gap: 8px;
}

.chat-title {
    font-size: 14px;
    color: #ffffff;
    margin: 0;
}

.partner-status {
    font-size: 11px;
    color: #888;
    display: flex;
    align-items: center;
}

.partner-status.online::before {
    content: '';
    display: inline-block;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    margin-right: 4px;
    background: #2ecc71;
}

.logout-btn {
    background-color: transparent;
    color: #888;
    border: none;
    padding: 4px;
    cursor: pointer;
    font-size: 12px;
    display: flex;
    align-items: center;
}

/* Messages Container */
.messages-container {
    flex: 1 1 auto;
    overflow-y: auto;
    padding: 8px;
    background-color: #181818;
    position: relative;
    margin-bottom: 60px;

}

.messages {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 60px;
    margin-top: 30px;

}

/* Message Styling */
.message {
    max-width: 75%;
    padding: 6px 10px;
    border-radius: 12px;
    font-size: 14px;
    line-height: 1.4;
}

.message.sent {
    background-color: #0B93F6;
    color: #ffffff;
    align-self: flex-end;
    border-bottom-right-radius: 4px;
}

.message.received {
    background-color: #2A2A2A;
    color: #ffffff;
    align-self: flex-start;
    border-bottom-left-radius: 4px;
}

/* Media Preview Styling */
.media-preview-container {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 4px 0;
    max-height: 80px;
    overflow-y: auto;
}

.media-preview-item {
    position: relative;
    width: 60px;
    height: 60px;
    border-radius: 8px;
    overflow: hidden;
    background-color: #2d2d2d;
}

.media-preview-item img,
.media-preview-item video {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.media-preview-remove {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    border: none;
    color: #fff;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
    line-height: 1;
}

.media-preview-remove:hover {
    background: rgba(0, 0, 0, 0.8);
}

/* Media Styling */
.media-container {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
}

.message-media {
    max-width: 200px;
    max-height: 200px;
    border-radius: 8px;
    object-fit: cover;
    cursor: pointer;
}

.message.sent .message-media {
    border-bottom-right-radius: 4px;
}

.message.received .message-media {
    border-bottom-left-radius: 4px;
}

@media screen and (max-width: 768px) {
    .message-media {
        max-width: 160px;
        max-height: 160px;
    }
}

/* Input Area */
.input-area {
    flex: 0 0 auto; /* Stay at the bottom naturally */
    background-color: #1a1a1a;
    border-top: 1px solid #2d2d2d;
    padding: 8px;
    min-height: 52px;
    width: 100%;
    z-index: 1000;
    padding-bottom: calc(8px + env(safe-area-inset-bottom)); /* Handle safe areas */
}
@media screen and (max-width: 768px) {
    .chat-container {
        height: var(--visual-viewport-height); /* Ensure mobile uses dynamic height */
    }

    .input-area {
        /* Remove fixed positioning */
        background-color: #252525;
        border-top: 1px solid #333;
        padding-bottom: max(8px, env(safe-area-inset-bottom));
    }

    .messages-container {
        /* Remove padding-bottom if present, as flex layout handles spacing */
    }
}

.input-group {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    height: 100%;
}

#messageInput {
    flex: 1 1 auto;
    background-color: #2d2d2d;
    border: none;
    border-radius: 16px;
    padding: 8px 12px;
    color: #ffffff;
    font-size: 14px;
    min-height: 36px;
    max-height: 100px;
    resize: none;
    line-height: 1.4;
    margin: 0;
}

.file-upload-label {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    cursor: pointer;
    color: #888;
}

.send-button {
    flex: 0 0 auto;
    background-color: transparent;
    border: none;
    color: #0B93F6;
    width: 32px;
    height: 32px;
    padding: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}

/* Timestamp and Status */
.message-footer {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 2px;
}

.timestamp {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.6);
}

.message-status {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.6);
}

/* Mobile Adjustments */
@media screen and (max-width: 768px) {
    .input-area {
        padding-bottom: max(8px, env(safe-area-inset-bottom));
    }
    
    .message-media {
        max-width: 140px;
        max-height: 140px;
    }
    
    .media-container {
        max-width: 200px;
    }
}

/* Typing Indicator */
.typing-indicator {
    display: none;
    color: #2d862d;
    font-style: italic;
}

.typing-indicator.active {
    display: inline-block;
}

/* Unread Message Marker */
.unread-marker {
    text-align: center;
    margin: 10px 0;
    position: relative;
}

.unread-marker::before {
    content: "Unread Messages";
    background-color: #e74c3c;
    color: white;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 12px;
    display: inline-block;
}

/* Message Read Status */
.message-status {
    font-size: 12px;
    margin-left: 5px;
    color: #888;
}

.message-status.read {
    color: #2ecc71;
}

/* Connection Status */
.connection-status {
    padding: 5px 10px;
    border-radius: 15px;
    font-size: 14px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    display: none;
    margin: 10px;
}

.connection-status.connected {
    background-color: #e7f5e7;
    color: #2d862d;
}

.connection-status.disconnected {
    background-color: #ffe6e6;
    color: #cc0000;
}

/* New Messages Indicator */
.new-messages-indicator {
    display: none;
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: #007bff;
    color: white;
    padding: 8px 16px;
    border-radius: 20px;
    cursor: pointer;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    z-index: 1000;
    animation: bounce 1s infinite;
}

@keyframes bounce {
    0%, 100% { transform: translateX(-50%) translateY(0); }
    50% { transform: translateX(-50%) translateY(-5px); }
}

/* Loading Indicator */
.loading-indicator {
    display: none;
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 15px 30px;
    border-radius: 25px;
    z-index: 1000;
}

/* Login Overlay */
.login-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: #121212;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}

.login-container {
    background-color: #1E1E1E;
    padding: 30px;
    border-radius: 10px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    width: 100%;
    max-width: 320px;
}

.login-container h2 {
    text-align: center;
    margin-bottom: 20px;
    color: #ffffff;
}

.login-form .form-group {
    margin-bottom: 15px;
}

.login-form input {
    width: 100%;
    padding: 12px;
    border: 1px solid #333;
    border-radius: 5px;
    background-color: #252525;
    color: #ffffff;
    font-size: 14px;
    box-sizing: border-box;
}

.login-form input:focus {
    outline: none;
    border-color: #0B93F6;
}

.login-button {
    width: 100%;
    padding: 12px;
    background-color: #0B93F6;
    color: #ffffff;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 16px;
    transition: background-color 0.3s;
}

.login-button:hover {
    background-color: #0A84E0;
}

.login-error {
    color: #ff4444;
    font-size: 14px;
    text-align: center;
    margin-top: 10px;
    min-height: 20px;
}

/* Animations */
@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes slideIn {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}

@keyframes bounce {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
}

@keyframes slideUp {
    from { transform: translate(-50%, 20px); opacity: 0; }
    to { transform: translate(-50%, 0); opacity: 1; }
}

/* Image Modal Styles */
.image-modal {
    display: none;
    position: fixed;
    z-index: 1000;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.9);
    backdrop-filter: blur(5px);
}

.modal-content {
    margin: auto;
    display: block;
    max-width: 90%;
    max-height: 90vh;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    object-fit: contain;
    border-radius: 4px;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
}

.close-modal {
    position: absolute;
    top: 20px;
    right: 30px;
    color: #f1f1f1;
    font-size: 40px;
    font-weight: bold;
    cursor: pointer;
    z-index: 1001;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 50%;
    transition: all 0.3s ease;
}

.close-modal:hover {
    color: #fff;
    background: rgba(255, 0, 0, 0.5);
    transform: scale(1.1);
}

/* Add zoom animation for modal */
@keyframes zoomIn {
    from {
        transform: translate(-50%, -50%) scale(0.1);
        opacity: 0;
    }
    to {
        transform: translate(-50%, -50%) scale(1);
        opacity: 1;
    }
}

.modal-content {
    animation: zoomIn 0.3s ease-out;
}

/* Mobile-First Approach */
@media (max-width: 767px) {
    .chat-container {
      width: 100%;
      height: 100vh;
      border-radius: 0;
    }
  
    .chat-header {
      padding: 10px 14px;
    }
  
    .chat-title {
      font-size: 16px;
    }
  
 
  
    .message {
      max-width: 90%;
      padding: 8px;
      font-size: 15px;
    }
  
    .media-preview-item {
      width: 60px;
      height: 60px;
    }
  
   
  
    input#messageInput {
      font-size: 14px;
    }
  }
  
  /* Desktop Styles */
  @media (min-width: 768px) {
    .chat-container {
      width: 95%;
      max-width: 600px;
      height: 95vh;
      border-radius: 12px;
    }
  }
  
  /* General Improvements */
  .chat-container {
    position: relative;
    width: 100%;
    background-color: #1E1E1E;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }
  
  .messages-container {
    flex-grow: 1;
    padding: 15px 10px;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  
  .input-area {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background-color: #252525;
    border-top: 1px solid #333;
  }
  
  .input-group {
    gap: 5px;
  }
  
  .message {
    position: relative;
    margin: 8px 0;
    line-height: 1.4;
    animation: fadeIn 0.3s ease;
  }
  
  .message.sent {
    background: linear-gradient(135deg, #0B93F6, #0875C5);
  }
  
  .message.received {
    background: linear-gradient(135deg, #2A2A2A, #1F1F1F);
  }
  
  .timestamp {
    font-size: 12px;
    opacity: 0.8;
  }
  
  .send-button {
    padding: 7px 14px;
    border-radius: 8px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 3px;
  }
  
  /* Better Touch Targets */
  button, input, .file-upload-label {
    touch-action: manipulation;
  }
  
  /* Improved Media Queries */
  .media-container img.media-content {
    max-width: 100%;
    max-height: 200px;
  }
  
  /* Status Bar Padding */
  .chat-header {
    padding: 10px 15px;
  }
  

  
  /* Keyboard-Aware Input */
  @media (max-height: 500px) {
    .messages-container {
      padding-bottom: 80px;
    }
  }
  
  /* Message Input Improvements */
  #messageInput {
    min-height: 15px;
    border-radius: 8px;
    padding: 5px 8px;
    transition: all 0.2s ease;
  }
  
  #messageInput:focus {
    box-shadow: 0 0 0 2px rgba(11, 147, 246, 0.3);
  }
  
  /* Better Scroll Experience */
  .messages-container {
    scroll-behavior: smooth;
    overscroll-behavior: contain;
  }
  
  /* Performance Optimizations */
  .message-media {
    will-change: transform;
  }
  /* Messages Container */
.messages-container {
    flex-grow: 1;
    padding: 10px;
    background-color: #181818;
    overflow-y: scroll; /* Enable scrolling */
}

/* Hide scrollbar */
.messages-container::-webkit-scrollbar {
    display: none; /* Hide the scrollbar */
}

.messages-container {
    -ms-overflow-style: none;  /* For Internet Explorer */
    scrollbar-width: none; /* For Firefox */
}
