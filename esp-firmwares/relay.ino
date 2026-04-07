// GHOST-HUB ESP Relay Firmware v1.0
// Управление лампами и реле через HTTP API

#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <ArduinoJson.h>

// Для ESP32 заменить на:
// #include <WiFi.h>
// #include <WebServer.h>

// Настройки WiFi
const char* ssid = "GHOST-LIGHT-001";
const char* password = "stalker2026";

// Пины
#ifdef ESP32
  #define RELAY_PIN  5   // GPIO5 для ESP32
  #define LED_PIN    2   // Встроенный LED
  WebServer server(80);
#else
  #define RELAY_PIN  5   // D1 на ESP8266 NodeMCU
  #define LED_PIN    2   // Встроенный LED
  ESP8266WebServer server(80);
#endif

// Состояние
bool relayState = false;
int batteryLevel = 100;
unsigned long lastPing = 0;

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n[GHOST-RELAY] Initializing...");
  
  // Настройка пинов
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);
  digitalWrite(LED_PIN, HIGH);  // LED выключен (инвертирован)
  
  // WiFi AP
  WiFi.softAP(ssid, password);
  IPAddress IP = WiFi.softAPIP();
  
  Serial.print("[GHOST-RELAY] WiFi AP: ");
  Serial.println(ssid);
  Serial.print("[GHOST-RELAY] IP: ");
  Serial.println(IP);
  
  // API endpoints
  server.on("/", handleRoot);
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/control", HTTP_POST, handleControl);
  
  server.begin();
  Serial.println("[GHOST-RELAY] Server started");
  
  lastPing = millis();
}

void loop() {
  server.handleClient();
  
  // Имитация разряда
  if (millis() - lastPing > 60000) {
    lastPing = millis();
    if (batteryLevel > 0) batteryLevel--;
  }
  
  delay(10);
}

void handleRoot() {
  String state = relayState ? "ВКЛЮЧЕНО" : "ВЫКЛЮЧЕНО";
  String color = relayState ? "#0f0" : "#f00";
  
  String html = R"(
    <!DOCTYPE html>
    <html>
    <head><title>GHOST-LIGHT-001</title></head>
    <body style="background:#0a0a0a;color:#00e5ff;font-family:monospace;padding:20px;">
      <h1>◈ GHOST-LIGHT-001</h1>
      <p>Состояние: <span style="color:)" + color + R"(;">)" + state + R"(</span></p>
      <p>Батарея: )" + String(batteryLevel) + R"(%</p>
      <hr>
      <form method="post" action="/control">
        <input type="hidden" name="action" value="toggle">
        <button type="submit" style="padding:20px;font-size:18px;background:#ff8c00;border:none;color:#000;cursor:pointer;">
          ПЕРЕКЛЮЧИТЬ
        </button>
      </form>
    </body>
    </html>
  )";
  server.send(200, "text/html", html);
}

void handleStatus() {
  StaticJsonDocument<256> doc;
  doc["type"] = "light";
  doc["name"] = "GHOST-LIGHT-001";
  doc["status"] = "online";
  doc["is_on"] = relayState;
  doc["battery"] = batteryLevel;
  doc["ip"] = WiFi.softAPIP().toString();
  
  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

void handleControl() {
  String body = "";
  
  if (server.hasArg("plain")) {
    body = server.arg("plain");
  } else if (server.hasArg("action")) {
    // Form data
    StaticJsonDocument<256> doc;
    doc["action"] = server.arg("action");
    serializeJson(doc, body);
  }
  
  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, body);
  
  if (error) {
    server.send(400, "application/json", "{\"error\":\"invalid data\"}");
    return;
  }
  
  const char* action = doc["action"];
  
  if (strcmp(action, "on") == 0) {
    relayState = true;
  } else if (strcmp(action, "off") == 0) {
    relayState = false;
  } else if (strcmp(action, "toggle") == 0) {
    relayState = !relayState;
  }
  
  // Применяем
  digitalWrite(RELAY_PIN, relayState ? HIGH : LOW);
  digitalWrite(LED_PIN, relayState ? LOW : HIGH);  // LED инвертирован
  
  StaticJsonDocument<128> response;
  response["success"] = true;
  response["state"] = relayState ? "on" : "off";
  
  String respStr;
  serializeJson(response, respStr);
  server.send(200, "application/json", respStr);
  
  Serial.print("[GHOST-RELAY] State: ");
  Serial.println(relayState ? "ON" : "OFF");
}
