# 🌐 Simple IoT World

A modern, responsive, full-stack IoT web application with **NodeMCU ESP8266 (CP2102)** hardware integration, real-time sensor telemetry, 16x2 I2C LCD control, and innovative LED actuation.

---

## 🚀 Key Features

- **Authentication System**:
  - Secure Login & Account Registration (Name, Email, Password) with bcrypt password hashing and JWT sessions.
  - Quick-fill demo credentials button for instant testing (`tushar@example.com` / `password123`).
- **Telemetry & Gauge Dashboard (Tab 1)**:
  - Large colorful circular radial gauges & seekbars for DHT11 **Temperature (°C)** and **Relative Humidity (%)**.
  - Dynamic status classifications (Cool, Optimal, Elevated, Critical).
  - Real-time Chart.js historical trend graphs.
  - Built-in **Simulate Sensor Reading** button to test telemetry and table updates without physical hardware.
- **Saved Records Table (Tab 1 - Section 2)**:
  - Formatted strictly as: `# | Temperature | Humidity | Time (IST) | Date | Action (Delete)`
  - Exact Timezone: **Asia/Kolkata (+5:30)** (`HH:MM AM/PM` and `DD-MM-YYYY`).
  - Full client & server-side pagination with configurable page size (5, 10, 25 records) and per-record deletion.
- **16x2 LCD Display Controller (Tab 2)**:
  - 2 text input fields strictly limited to 16 characters each with live character counters.
  - "Save & Transmit to LCD" button.
  - Realistic virtual 16x2 LCD matrix simulation with authentic alphanumeric font, bezel, and toggleable green/blue backlight.
- **Actuator Controller: LED (Tab 3)**:
  - Innovative 3D tactile cyberpunk/neumorphic power switch button.
  - Intense neon red glow and electrical pulsing animation when active.
  - Instant two-way synchronization with ESP8266 Pin D3.
- **Header & Footer**:
  - App Name: **Simple IoT World**.
  - Logged-in greeting: `Welcome <UserName>` (e.g. `Welcome Tushar`).
  - Real-time **ONLINE / OFFLINE** status indicator with animated pulsing badge and last-seen timer.
  - One-click **Light / Dark theme toggle** with persistent localStorage state.
  - Footer: `Developed with Love ❤️ by Tushar and Team. Department of ETC, SB Jain, Nagpur` (with animated heartbeat pulse).
- **Ready for Cloud Deployment**:
  - Pre-configured for deployment on **Render** (zero-config, free tier friendly).

---

## 🔌 Hardware Circuit & Pinout Table

### Components
1. **ESP8266 NodeMCU CP2102**
2. **DHT11 Temperature & Humidity Sensor**
3. **16x2 LCD with PCF8574 I2C Adapter (Address `0x27`)**
4. **5mm LED + 220Ω / 330Ω Resistor**

### Wiring Connections

| Component | Component Pin | ESP8266 NodeMCU Pin | GPIO Number | Note |
|---|---|---|---|---|
| **DHT11 Sensor** | VCC | 3V3 or Vin | - | 3.3V or 5V |
| | GND | GND | - | Common ground |
| | DATA | **D5** | GPIO 14 | 10k pullup if sensor is bare |
| **16x2 I2C LCD** | VCC | Vin (5V) | - | 5V recommended for bright backlight |
| | GND | GND | - | Common ground |
| | SDA | **D2** | GPIO 4 | I2C Data |
| | SCL | **D1** | GPIO 5 | I2C Clock |
| **LED** | Anode (+) | **D3** | GPIO 0 | Connect via 220Ω/330Ω resistor |
| | Cathode (-) | GND | - | Ground |

---

## 💻 Local Setup & Execution

### 1. Install Node.js Dependencies
```bash
npm install
```

### 2. Start the Express Server
```bash
npm start
```
The server will start at: `http://localhost:3000`

### 3. Open Web Dashboard
Navigate to `http://localhost:3000` in your web browser.
- Click **"Quick Fill Demo Credentials"** to log in as **Tushar**, or register a new user.

---

## ☁️ Deploying to Render

This application is ready to deploy directly on Render:

1. Push this repository to **GitHub**.
2. Go to [Render Dashboard](https://dashboard.render.com/) and click **New +** -> **Web Service**.
3. Select your GitHub repository.
4. Configure the service settings:
   - **Name**: `simple-iot-world`
   - **Language / Runtime**: `Node`
   - **Branch**: `main` (or `master`)
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: `Free`
5. Click **Create Web Service**.
6. Render will generate a public URL like:
   `https://simple-iot-world.onrender.com`

---

## 🤖 ESP8266 Arduino Programming

The complete Arduino sketch is located at:
📁 `esp8266/esp8266_simple_iot_world.ino`

### 1. Arduino IDE Setup
1. In Arduino IDE, open **Tools -> Board -> Board Manager** and ensure **esp8266 by ESP8266 Community** is installed.
2. Select Board: **NodeMCU 1.0 (ESP-12E Module)**.
3. Install the required libraries via **Sketch -> Include Library -> Manage Libraries**:
   - `LiquidCrystal_I2C` by Frank de Brabander
   - `DHT sensor library` by Adafruit
   - `Adafruit Unified Sensor`
   - `ArduinoJson` (v6 or v7) by Benoit Blanchon

### 2. Configure WiFi & Render URL
Open `esp8266/esp8266_simple_iot_world.ino` and check:
```cpp
const char* ssid = "ESP8266";
const char* password = "12345678";

// Add your Render URL after deployment:
const char* serverUrl = "https://your-service.onrender.com"; 
```
*(Leave `serverUrl = ""` while setting up hardware; add the URL once your Render deployment finishes)*.

### 3. Flash to NodeMCU
Connect your NodeMCU CP2102 via micro-USB, select the appropriate COM Port, and click **Upload**.

### 4. LCD Display Output Sequence

#### In Setup:
1. `R1: MyProject` / `R2: WELCOME` *(3 seconds)*
2. `R1: CONNECTING TO` / `R2: WiFi.........`
3. When connected: `R1: CONNECTED TO` / `R2: WiFi...SUCCESS` *(2 seconds)*

#### In Loop:
- Sends DHT11 Temperature & Humidity to Server every **10 Seconds**.
- Cycles the 4 display screens *(2 seconds each)*:
  1. `R1: TEMPERATURE` / `R2: <temp> 'C`
  2. `R1: HUMIDITY` / `R2: <hum> %`
  3. `R1: SMART DISPLAY` / `R2: <server LCD text>`
  4. `R1: LED STATUS` / `R2: <ON / OFF>`
- Controls LED on Pin D3 based on state fetched from server.

---

## 👥 Authors
Developed with Love ❤️ by **Tushar and Team**
*Department of ETC, SB Jain Institute of Technology, Management and Research, Nagpur*
