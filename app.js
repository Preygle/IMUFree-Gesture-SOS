/**
 * ESP32 Micro-Gesture SOS Receiver
 * Web Bluetooth API Implementation
 */

// --- CONFIGURATION ---
// Replace these with your ESP32's actual UUIDs
const ESP32_SERVICE_UUID = '12345678-1234-5678-1234-56789abcdef0'; // Example: '4fafc201-1fb5-459e-8fcc-c5c9c331914b'
const SOS_CHARACTERISTIC_UUID = '12345678-1234-5678-1234-56789abcdef1'; // Example: 'beb5483e-36e1-4688-b7f5-ea07361b26a8'

// SOS Code Definitions (Map your 10 codes here)
const SOS_CODES = {
    '1': { desc: 'IR x2 + Light Press (Help Needed)', severity: 'info' },
    '2': { desc: 'IR x2 + Heavy Press (Urgent Assistance)', severity: 'warning' },
    '3': { desc: 'IR x3 + Light Press (Medical Issue)', severity: 'warning' },
    '4': { desc: 'IR x3 + Heavy Press (Critical Medical Event)', severity: 'critical' },
    '5': { desc: 'Long FSR + IR x1 (Security Threat)', severity: 'critical' },
    '6': { desc: 'Rapid IR + FSR Light (Lost / Need Directions)', severity: 'info' },
    '7': { desc: 'Rapid IR + FSR Heavy (Fall Detected)', severity: 'critical' },
    '8': { desc: 'Sustained Light Press (Checking In)', severity: 'info' },
    '9': { desc: 'Sustained Heavy Press (Duress / Forced)', severity: 'critical' },
    '10': { desc: 'Complex Gesture Sequence (Custom Alert)', severity: 'warning' }
};

// --- STATE ---
let bluetoothDevice = null;
let sosCharacteristic = null;
let eventHistory = [];

// --- DOM ELEMENTS ---
const connectBtn = document.getElementById('connect-btn');
const btnText = document.getElementById('btn-text');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');

const signalIdle = document.getElementById('signal-idle');
const signalActive = document.getElementById('signal-active');
const activeSosCode = document.getElementById('active-sos-code');
const activeSosDesc = document.getElementById('active-sos-desc');
const severityBadge = document.getElementById('severity-badge');

const historyList = document.getElementById('history-list');
const emptyHistory = document.getElementById('empty-history');
const clearBtn = document.getElementById('clear-btn');
const toastContainer = document.getElementById('toast-container');

// --- EVENT LISTENERS ---
connectBtn.addEventListener('click', toggleConnection);
clearBtn.addEventListener('click', clearHistory);

// --- BLUETOOTH LOGIC ---

async function toggleConnection() {
    if (bluetoothDevice && bluetoothDevice.gatt.connected) {
        disconnectDevice();
    } else {
        connectDevice();
    }
}

async function connectDevice() {
    try {
        updateUIState('connecting');
        
        // Request device granting access to the specific service UUID
        bluetoothDevice = await navigator.bluetooth.requestDevice({
            filters: [{ services: [ESP32_SERVICE_UUID] }],
            // acceptAllDevices: true, // Alternative if filtering doesn't work initially
            // optionalServices: [ESP32_SERVICE_UUID]
        });

        bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);

        showToast('Connecting to GATT Server...', 'info');
        const server = await bluetoothDevice.gatt.connect();

        showToast('Discovering Service...', 'info');
        const service = await server.getPrimaryService(ESP32_SERVICE_UUID);

        showToast('Getting Characteristic...', 'info');
        sosCharacteristic = await service.getCharacteristic(SOS_CHARACTERISTIC_UUID);

        showToast('Starting Notifications...', 'info');
        await sosCharacteristic.startNotifications();
        sosCharacteristic.addEventListener('characteristicvaluechanged', handleNotifications);

        updateUIState('connected');
        showToast('Successfully Connected to ESP32!', 'success');

    } catch (error) {
        console.error('Connection failed!', error);
        updateUIState('disconnected');
        if (error.name === 'NotFoundError') {
            showToast('Device request cancelled by user.', 'info');
        } else {
            showToast(`Connection error: ${error.message}`, 'error');
        }
    }
}

function disconnectDevice() {
    if (bluetoothDevice && bluetoothDevice.gatt.connected) {
        if (sosCharacteristic) {
            sosCharacteristic.stopNotifications()
                .then(() => {
                    sosCharacteristic.removeEventListener('characteristicvaluechanged', handleNotifications);
                    bluetoothDevice.gatt.disconnect();
                })
                .catch(error => {
                    console.error('Error stopping notifications:', error);
                    bluetoothDevice.gatt.disconnect();
                });
        } else {
            bluetoothDevice.gatt.disconnect();
        }
    }
}

function onDisconnected() {
    updateUIState('disconnected');
    showToast('Device disconnected', 'warning');
    resetActivePanel();
}

function handleNotifications(event) {
    const value = event.target.value;
    // Decode value based on how ESP32 sends it. 
    // Assuming UTF-8 String representation of the code ('1', '2', etc.)
    const decoder = new TextDecoder('utf-8');
    const sosCodeRaw = decoder.decode(value).trim();
    
    // Fallback: If ESP32 sends raw bytes (e.g., uint8t value = 5)
    // const sosCodeRaw = value.getUint8(0).toString();
    
    console.log(`Received SOS Code: ${sosCodeRaw}`);
    processSOSCode(sosCodeRaw);
}

// --- APP LOGIC ---

function processSOSCode(code) {
    const sosData = SOS_CODES[code] || { desc: `Unknown Code Received (${code})`, severity: 'info' };
    
    // Create event object
    const eventObj = {
        code: code,
        desc: sosData.desc,
        severity: sosData.severity,
        timestamp: new Date()
    };
    
    eventHistory.unshift(eventObj); // Add to beginning of array
    
    // Update UI
    updateActivePanel(eventObj);
    renderHistory();
    
    // Reset the active panel after 10 seconds of inactivity
    clearTimeout(window.resetTimer);
    window.resetTimer = setTimeout(() => {
        resetActivePanel();
    }, 10000);
}

// --- UI UPDATES ---

function updateUIState(state) {
    statusDot.className = 'dot';
    statusDot.classList.add(state);
    
    switch(state) {
        case 'connected':
            statusText.textContent = 'Connected';
            btnText.textContent = 'Disconnect';
            connectBtn.classList.replace('primary', 'danger');
            connectBtn.querySelector('.material-icons').textContent = 'bluetooth_connected';
            break;
        case 'disconnected':
            statusText.textContent = 'Disconnected';
            btnText.textContent = 'Connect ESP32';
            connectBtn.classList.replace('danger', 'primary');
            connectBtn.querySelector('.material-icons').textContent = 'bluetooth';
            break;
        case 'connecting':
            statusText.textContent = 'Connecting...';
            btnText.textContent = 'Connecting';
            break;
    }
}

function updateActivePanel(event) {
    signalIdle.classList.add('hidden');
    signalActive.classList.remove('hidden');
    
    // Remove previous severity classes
    signalActive.classList.remove('severity-info', 'severity-warning', 'severity-critical');
    
    // Apply new data
    activeSosCode.textContent = `SOS ${event.code}`;
    activeSosDesc.textContent = event.desc;
    
    severityBadge.textContent = event.severity.toUpperCase();
    severityBadge.className = `severity-badge ${event.severity}`;
    
    // Apply classes for styling/animations
    signalActive.classList.add(`severity-${event.severity}`);
}

function resetActivePanel() {
    signalActive.classList.add('hidden');
    signalIdle.classList.remove('hidden');
    signalActive.classList.remove('severity-info', 'severity-warning', 'severity-critical');
    severityBadge.textContent = 'None';
    severityBadge.className = 'severity-badge';
}

function renderHistory() {
    if (eventHistory.length === 0) {
        emptyHistory.style.display = 'flex';
        historyList.innerHTML = '';
        return;
    }
    
    emptyHistory.style.display = 'none';
    historyList.innerHTML = '';
    
    eventHistory.forEach((event, index) => {
        const li = document.createElement('li');
        li.className = 'history-item';
        li.style.animationDelay = `${index * 0.05}s`;
        
        const timeStr = event.timestamp.toLocaleTimeString([], { hour12: false });
        
        li.innerHTML = `
            <span class="history-time">${timeStr}</span>
            <span class="history-code text-${event.severity}">SOS ${event.code}</span>
            <span class="history-desc">${event.desc}</span>
        `;
        
        historyList.appendChild(li);
    });
}

function clearHistory() {
    eventHistory = [];
    renderHistory();
    showToast('History cleared', 'info');
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'info';
    if (type === 'error') icon = 'error_outline';
    if (type === 'success') icon = 'check_circle';
    if (type === 'warning') icon = 'warning_amber';
    
    toast.innerHTML = `
        <span class="material-icons">${icon}</span>
        <span>${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'toastSlideOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Initial initialization check
if (!navigator.bluetooth) {
    setTimeout(() => {
        showToast('Web Bluetooth API is not available in this browser. Please use Chrome/Edge.', 'error');
        connectBtn.disabled = true;
    }, 1000);
}
