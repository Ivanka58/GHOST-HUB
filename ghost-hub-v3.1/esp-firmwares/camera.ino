// GHOST-HUB ESP32-CAM Firmware v1.0
// Камера наблюдения с HTTP API и WiFi управлением

#include "esp_camera.h"
#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>

// Настройки WiFi (AP mode по умолчанию)
const char* ssid = "GHOST-CAM-001";
const char* password = "stalker2026";

// Пины ESP32-CAM (AI-Thinker модуль)
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22
#define LED_GPIO_NUM       4  // Встроенная LED вспышка

WebServer server(80);

// Состояние
bool cameraOn = true;
int batteryLevel = 100;  // Заглушка, можно подключить делитель на A0
unsigned long lastActivity = 0;

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n[GHOST-CAM] Initializing...");
  
  // Настройка LED
  pinMode(LED_GPIO_NUM, OUTPUT);
  digitalWrite(LED_GPIO_NUM, LOW);
  
  // Инициализация камеры
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  
  // Разрешение (меньше = быстрее)
  config.frame_size = FRAMESIZE_VGA;  // 640x480
  config.jpeg_quality = 12;           // 0-63, меньше = лучше
  config.fb_count = 1;
  
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[GHOST-CAM] Camera init failed: 0x%x\n", err);
    return;
  }
  
  Serial.println("[GHOST-CAM] Camera OK");
  
  // Запуск WiFi AP
  WiFi.softAP(ssid, password);
  IPAddress IP = WiFi.softAPIP();
  
  Serial.print("[GHOST-CAM] WiFi AP: ");
  Serial.println(ssid);
  Serial.print("[GHOST-CAM] IP: ");
  Serial.println(IP);
  
  // HTTP API endpoints
  server.on("/", HTTP_GET, handleRoot);
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/stream", HTTP_GET, handleStream);
  server.on("/control", HTTP_POST, handleControl);
  server.on("/snapshot", HTTP_GET, handleSnapshot);
  
  server.begin();
  Serial.println("[GHOST-CAM] HTTP server started on port 80");
  
  lastActivity = millis();
}

void loop() {
  server.handleClient();
  
  // Имитация разряда батареи
  if (millis() - lastActivity > 60000) {  // Каждую минуту
    lastActivity = millis();
    if (batteryLevel > 0) batteryLevel -= 1;
  }
  
  delay(10);
}

// Корневая страница с инструкцией
void handleRoot() {
  String html = R"(
    <!DOCTYPE html>
    <html>
    <head><title>GHOST-CAM-001</title></head>
    <body style="background:#0a0a0a;color:#00e5ff;font-family:monospace;padding:20px;">
      <h1>◈ GHOST-CAM-001</h1>
      <p>Статус: <span style="color:#0f0;">ONLINE</span></p>
      <p>Батарея: )" + String(batteryLevel) + R"(%</p>
      <hr>
      <p><a href="/stream" style="color:#ff8c00;">📹 Видео-поток</a></p>
      <p><a href="/snapshot" style="color:#ff8c00;">📷 Снимок</a></p>
      <p><a href="/status" style="color:#ff8c00;">ℹ️ JSON статус</a></p>
    </body>
    </html>
  )";
  server.send(200, "text/html", html);
}

// JSON статус для GHOST-HUB
void handleStatus() {
  StaticJsonDocument<256> doc;
  doc["type"] = "camera";
  doc["name"] = "GHOST-CAM-001";
  doc["status"] = cameraOn ? "online" : "offline";
  doc["battery"] = batteryLevel;
  doc["ip"] = WiFi.softAPIP().toString();
  doc["stream_url"] = "/stream";
  
  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

// MJPEG видео-поток
void handleStream() {
  WiFiClient client = server.client();
  
  String response = "HTTP/1.1 200 OK\r\n";
  response += "Content-Type: multipart/x-mixed-replace; boundary=frame\r\n\r\n";
  server.sendContent(response);
  
  while (client.connected()) {
    camera_fb_t * fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("[GHOST-CAM] Frame capture failed");
      continue;
    }
    
    response = "--frame\r\n";
    response += "Content-Type: image/jpeg\r\n\r\n";
    server.sendContent(response);
    
    client.write(fb->buf, fb->len);
    server.sendContent("\r\n");
    
    esp_camera_fb_return(fb);
    
    // Контроль частоты кадров
    delay(50);  // ~20 FPS
  }
}

// Управление камерой
void handleControl() {
  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"error\":\"no body\"}");
    return;
  }
  
  String body = server.arg("plain");
  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, body);
  
  if (error) {
    server.send(400, "application/json", "{\"error\":\"invalid json\"}");
    return;
  }
  
  const char* action = doc["action"];
  
  if (strcmp(action, "on") == 0) {
    cameraOn = true;
    digitalWrite(LED_GPIO_NUM, HIGH);
  } else if (strcmp(action, "off") == 0) {
    cameraOn = false;
    digitalWrite(LED_GPIO_NUM, LOW);
  } else if (strcmp(action, "led_on") == 0) {
    digitalWrite(LED_GPIO_NUM, HIGH);
  } else if (strcmp(action, "led_off") == 0) {
    digitalWrite(LED_GPIO_NUM, LOW);
  }
  
  StaticJsonDocument<128> response;
  response["success"] = true;
  response["state"] = cameraOn ? "on" : "off";
  
  String respStr;
  serializeJson(response, respStr);
  server.send(200, "application/json", respStr);
}

// Одиночный снимок
void handleSnapshot() {
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    server.send(500, "text/plain", "Capture failed");
    return;
  }
  
  server.sendHeader("Content-Disposition", "inline; filename=capture.jpg");
  server.send_P(200, "image/jpeg", (const char *)fb->buf, fb->len);
  
  esp_camera_fb_return(fb);
}
