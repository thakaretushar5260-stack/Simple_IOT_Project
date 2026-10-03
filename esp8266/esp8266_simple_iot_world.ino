/*
  ====================================================================================
  Project: Simple IoT World
  Microcontroller: ESP8266 (NodeMCU CP2102)
  Sensors: DHT11 on Pin D5 (GPIO 14)
  Actuators:
    - 16x2 LCD with I2C module (Address 0x27) on D1 (SCL / GPIO 5) & D2 (SDA / GPIO 4)
    - LED on Pin D3 (GPIO 0)
  
  WiFi Credentials:
    - SSID: ESP8266
    - Password: 12345678
  
  Backend: Express & Node.js on Render
  Author: Tushar and Team (Department of ETC, SB Jain, Nagpur)
  ====================================================================================

  REQUIRED ARDUINO LIBRARIES:
  1. LiquidCrystal_I2C by Frank de Brabander (or Marco Schwartz)
  2. DHT sensor library by Adafruit
  3. Adafruit Unified Sensor
  4. ArduinoJson (version 6.x or 7.x) by Benoit Blanchon
  5. ESP8266WiFi and ESP8266HTTPClient (built-in with ESP8266 Core)

  PIN WIRING GUIDE:
  - ESP8266 NodeMCU -> Components
    - D1 (GPIO 5)   -> LCD SCL
    - D2 (GPIO 4)   -> LCD SDA
    - D5 (GPIO 14)  -> DHT11 Data Pin (use 10k pull-up resistor to 3.3V/5V if not on module)
    - D3 (GPIO 0)   -> LED Anode (+) through 220-330 ohm resistor, Cathode (-) to GND
    - Vin / 3V3     -> VCC for LCD (usually 5V/Vin) & DHT11 (3.3V or 5V)
    - GND           -> Common GND for all components
  ====================================================================================
*/

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <WiFiClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <ArduinoJson.h>

// ==========================================
// PIN & HARDWARE DEFINITIONS
// ==========================================
#define DHTPIN D5          // DHT11 Data Pin (GPIO 14)
#define DHTTYPE DHT11      // Sensor Model DHT 11
#define LEDPIN D3          // Actuator LED Pin (GPIO 0)
#define LCD_ADDR 0x27      // I2C Address for 16x2 LCD
#define LCD_COLS 16
#define LCD_ROWS 2

// Initialize Hardware Objects
DHT dht(DHTPIN, DHTTYPE);
LiquidCrystal_I2C lcd(LCD_ADDR, LCD_COLS, LCD_ROWS);

// ==========================================
// WIFI & CLOUD SERVER CONFIGURATION
// ==========================================
const char* ssid = "ESP8266";
const char* password = "12345678";

// Render URL: Keep it blank will add after deployment
// Example once deployed: "https://simple-iot-world.onrender.com"
// Or for local network testing: "http://192.168.1.100:3000"
const char* serverUrl = ""; 

// Timing Variables
unsigned long lastServerSendTime = 0;
const unsigned long sendInterval = 10000; // Send to server every 10 seconds

// Device State variables cached from server
String serverLedStatus = "OFF";
String serverLcdText = "MyData";
String serverLcdLine2 = "";

// Forward Declarations
void connectToWiFi();
void sendSensorData(float temp, float hum);
void fetchDeviceState();
void displayOnLcd(String r1, String r2);

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n--- Starting Simple IoT World NodeMCU ---");

  // Configure LED Pin
  pinMode(LEDPIN, OUTPUT);
  digitalWrite(LEDPIN, LOW); // Start with LED OFF

  // Initialize I2C with D1 (SCL) and D2 (SDA)
  Wire.begin(D2, D1); // SDA = D2, SCL = D1

  // Initialize LCD
  lcd.init();
  lcd.backlight();
  lcd.clear();

  // Initialize DHT11
  dht.begin();

  // ----------------------------------------------------
  // SETUP DISPLAY SEQUENCE 1: MyProject / WELCOME
  // ----------------------------------------------------
  displayOnLcd("MyProject", "WELCOME");
  delay(3000); // 3 seconds delay

  // ----------------------------------------------------
  // SETUP DISPLAY SEQUENCE 2: CONNECTING TO WiFi.........
  // ----------------------------------------------------
  displayOnLcd("CONNECTING TO", "WiFi.........");
  connectToWiFi();

  // ----------------------------------------------------
  // SETUP DISPLAY SEQUENCE 3: CONNECTED TO WiFi...SUCCESS
  // ----------------------------------------------------
  displayOnLcd("CONNECTED TO", "WiFi...SUCCESS");
  delay(2000);
  lcd.clear();
}

void loop() {
  // Check WiFi Connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Reconnecting...");
    connectToWiFi();
  }

  // 1. Read Sensor values from DHT11 (D5)
  float temp = dht.readTemperature();
  float hum = dht.readHumidity();

  // Fallback check if sensor read fails
  if (isnan(temp) || isnan(hum)) {
    Serial.println("[DHT11] Warning: Failed to read from DHT sensor! Using previous or mock values.");
    temp = 34.0;
    hum = 50.0;
  }

  Serial.printf("[Sensors] Temperature: %.1f C | Humidity: %.1f %%\n", temp, hum);

  // 2. Fetch Details from Server (LCD Data & LED Data)
  fetchDeviceState();

  // 3. Update Actuator LED on D3 based on Server status
  if (serverLedStatus == "ON") {
    digitalWrite(LEDPIN, HIGH);
  } else {
    digitalWrite(LEDPIN, LOW);
  }

  // 4. Send Details to Server every 10 Seconds
  unsigned long now = millis();
  if (now - lastServerSendTime >= sendInterval || lastServerSendTime == 0) {
    sendSensorData(temp, hum);
    lastServerSendTime = now;
  }

  // ----------------------------------------------------
  // CYCLIC LCD DISPLAY SEQUENCES (2s DELAY EACH)
  // ----------------------------------------------------

  // Sequence 1: TEMPERATURE
  String tempLine = String((int)round(temp)) + " 'C";
  displayOnLcd("TEMPERATURE", tempLine);
  delay(2000);

  // Sequence 2: HUMIDITY
  String humLine = String((int)round(hum)) + " %";
  displayOnLcd("HUMIDITY", humLine);
  delay(2000);

  // Sequence 3: SMART DISPLAY (Details from Server)
  // Shows Field 1 or custom server data on Row 2
  displayOnLcd("SMART DISPLAY", serverLcdText);
  delay(2000);

  // Sequence 4: LED STATUS (Details from Server)
  displayOnLcd("LED STATUS", serverLedStatus);
  delay(2000);
}

// ========================================================
// HELPER FUNCTIONS
// ========================================================

// Connect to WiFi with timeout
void connectToWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Connected successfully!");
    Serial.print("ESP8266 IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WiFi] Connection failed or timed out. Will retry in loop.");
  }
}

// Display 2 lines on 16x2 LCD cleanly (padded to 16 characters)
void displayOnLcd(String r1, String r2) {
  // Pad strings to 16 characters to overwrite previous text cleanly without flicker
  while (r1.length() < 16) r1 += " ";
  while (r2.length() < 16) r2 += " ";
  r1 = r1.substring(0, 16);
  r2 = r2.substring(0, 16);

  lcd.setCursor(0, 0);
  lcd.print(r1);
  lcd.setCursor(0, 1);
  lcd.print(r2);
}

// Send Sensor Data to Server (POST /api/sensor-data)
void sendSensorData(float temp, float hum) {
  if (strlen(serverUrl) == 0) {
    Serial.println("[Cloud] Server URL is not configured yet. Skipping send.");
    return;
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[Cloud] Cannot send data: WiFi not connected");
    return;
  }

  String endpoint = String(serverUrl) + "/api/sensor-data";
  Serial.print("[Cloud] Sending sensor data to: ");
  Serial.println(endpoint);

  // JSON payload
  StaticJsonDocument<200> doc;
  doc["temperature"] = round(temp * 10.0) / 10.0;
  doc["humidity"] = round(hum * 10.0) / 10.0;
  doc["source"] = "esp8266";

  String requestBody;
  serializeJson(doc, requestBody);

  // Check if HTTPS or HTTP
  if (endpoint.startsWith("https://")) {
    WiFiClientSecure secureClient;
    secureClient.setInsecure(); // Bypass SSL fingerprint check on ESP8266 for Render HTTPS
    HTTPClient https;
    if (https.begin(secureClient, endpoint)) {
      https.addHeader("Content-Type", "application/json");
      https.addHeader("User-Agent", "ESP8266-NodeMCU");
      int httpCode = https.POST(requestBody);
      Serial.printf("[Cloud] POST response code: %d\n", httpCode);
      https.end();
    }
  } else {
    WiFiClient client;
    HTTPClient http;
    if (http.begin(client, endpoint)) {
      http.addHeader("Content-Type", "application/json");
      http.addHeader("User-Agent", "ESP8266-NodeMCU");
      int httpCode = http.POST(requestBody);
      Serial.printf("[Cloud] POST response code: %d\n", httpCode);
      http.end();
    }
  }
}

// Fetch Device State from Server (GET /api/device-state?source=esp8266)
void fetchDeviceState() {
  if (strlen(serverUrl) == 0) {
    // If serverUrl is blank, keep default mock values
    return;
  }

  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  String endpoint = String(serverUrl) + "/api/device-state?source=esp8266";
  String payload = "";

  if (endpoint.startsWith("https://")) {
    WiFiClientSecure secureClient;
    secureClient.setInsecure();
    HTTPClient https;
    if (https.begin(secureClient, endpoint)) {
      https.addHeader("User-Agent", "ESP8266-NodeMCU");
      int httpCode = https.GET();
      if (httpCode == HTTP_CODE_OK) {
        payload = https.getString();
      }
      https.end();
    }
  } else {
    WiFiClient client;
    HTTPClient http;
    if (http.begin(client, endpoint)) {
      http.addHeader("User-Agent", "ESP8266-NodeMCU");
      int httpCode = http.GET();
      if (httpCode == HTTP_CODE_OK) {
        payload = http.getString();
      }
      http.end();
    }
  }

  if (payload.length() > 0) {
    StaticJsonDocument<384> doc;
    DeserializationError error = deserializeJson(doc, payload);
    if (!error) {
      if (doc.containsKey("ledStatus")) {
        serverLedStatus = doc["ledStatus"].as<String>();
      }
      if (doc.containsKey("lcdLine1")) {
        String l1 = doc["lcdLine1"].as<String>();
        l1.trim();
        if (l1.length() > 0) {
          serverLcdText = l1;
        }
      }
      if (doc.containsKey("lcdLine2")) {
        serverLcdLine2 = doc["lcdLine2"].as<String>();
      }
      Serial.printf("[Cloud] Updated State -> LED: %s | LCD: %s\n", 
                    serverLedStatus.c_str(), serverLcdText.c_str());
    } else {
      Serial.println("[Cloud] JSON parse failed on /api/device-state");
    }
  }
}
