# IMU-Free Micro-Gesture SOS Web Dashboard

A professional, modern, Web Bluetooth-enabled dashboard for the ESP32-based IMU-free micro-gesture SOS system.

## 🚀 How to Run

Because this app uses the **Web Bluetooth API**, it **MUST** be run on a local server or securely over HTTPS. It will not work if you just double-click the `index.html` file in your folder.

1. Open a terminal or command prompt in this project folder.
2. Start a simple local server using Python:
   ```bash
   python -m http.server 8000
   ```
3. Open your web browser (Google Chrome or Microsoft Edge required for Web Bluetooth).
4. Go to: [http://localhost:8000](http://localhost:8000)

---

## ⚙️ Changes You Must Make (Configuration)

Before the web app can connect to your specific ESP32, you need to update the connection settings in the code.

### 1. Update BLE UUIDs in `app.js`
Open the **`app.js`** file. At the very top, you will see two variables for the UUIDs. You must change these to match the exact Service UUID and Characteristic UUID you used in your ESP32 Arduino/C++ code.

```javascript
// --- CONFIGURATION ---
// Replace these with your ESP32's actual UUIDs!
const ESP32_SERVICE_UUID = '12345678-1234-5678-1234-56789abcdef0'; 
const SOS_CHARACTERISTIC_UUID = '12345678-1234-5678-1234-56789abcdef1'; 
```

### 2. Verify SOS Code Mappings (Optional)
In **`app.js`**, right below the UUIDs, there is an `SOS_CODES` map. It maps numbers (1 through 10) to specific descriptions and UI colors ('info', 'warning', 'critical').
If your ESP32 generates different gestures for different codes, update the descriptions here to match your hardware logic:

```javascript
const SOS_CODES = {
    '1': { desc: 'IR x2 + Light Press (Help Needed)', severity: 'info' },
    '2': { desc: 'IR x2 + Heavy Press (Urgent Assistance)', severity: 'warning' },
    // ... update descriptions as needed to match your ESP32 mapping
};
```

### 3. ESP32 Data Format Note
By default, the `app.js` code expects your ESP32 to send the SOS code as a **String / UTF-8 Characters** (e.g., sending the character `'1'`, `'2'`, `'3'`).
If your ESP32 sends raw integers/bytes instead (e.g., `uint8_t value = 5;`), you'll need to swap the commented lines inside the `handleNotifications` function in `app.js`:

```javascript
// Currently looks like this (expects Strings):
const decoder = new TextDecoder('utf-8');
const sosCodeRaw = decoder.decode(value).trim();

// Change to this IF your ESP32 sends raw uint8_t bytes instead:
// const sosCodeRaw = value.getUint8(0).toString();
```

---

## 🎨 Features
- **No Backend Required**: 100% client-side HTML/CSS/JS communicating directly with the ESP32 via Bluetooth.
- **Web Bluetooth API**: Direct connection from the browser.
- **Dynamic UI**: Auto-updating active SOS panel with pulsing animations for critical alerts.
- **Event Log**: Timestamped history of all received gestures.
- **Dark Dashboard**: Professional, glassmorphic design system.
