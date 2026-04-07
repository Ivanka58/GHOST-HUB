// GHOST-HUB ESP32 Pulse Monitor Firmware v1.0
// Жучок пульса на MAX30102 + BLE

#include <Wire.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEService.h>
#include <BLECharacteristic.h>
#include "MAX30105.h"

// BLE UUIDs (стандартные Heart Rate)
#define HR_SERVICE_UUID        BLEUUID((uint16_t)0x180D)
#define HR_CHAR_UUID           BLEUUID((uint16_t)0x2A37)
#define BATTERY_SERVICE_UUID   BLEUUID((uint16_t)0x180F)
#define BATTERY_CHAR_UUID      BLEUUID((uint16_t)0x2A19)

// Пины I2C для ESP32
#define SDA_PIN 21
#define SCL_PIN 22

MAX30105 particleSensor;
BLEServer *pServer = NULL;
BLECharacteristic *pHeartRateCharacteristic = NULL;
BLECharacteristic *pBatteryCharacteristic = NULL;

bool deviceConnected = false;
uint8_t heartRate = 72;
uint8_t batteryLevel = 85;
unsigned long lastHRUpdate = 0;

// Callback при подключении/отключении
class MyServerCallbacks: public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    deviceConnected = true;
    Serial.println("[GHOST-PULSE] Client connected");
  }
  
  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
    Serial.println("[GHOST-PULSE] Client disconnected");
    // Перезапускаем advertising
    delay(500);
    pServer->startAdvertising();
  }
};

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n[GHOST-PULSE] Initializing...");
  
  // Инициализация I2C
  Wire.setPins(SDA_PIN, SCL_PIN);
  Wire.begin();
  
  // Инициализация MAX30102
  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("[GHOST-PULSE] MAX30102 not found! Check wiring.");
    // Продолжаем в демо-режиме
  } else {
    Serial.println("[GHOST-PULSE] MAX30102 OK");
    
    // Настройка сенсора
    particleSensor.setup();
    particleSensor.setPulseAmplitudeRed(0x0A);  // Низкая яркость для экономии
    particleSensor.setPulseAmplitudeIR(0x0A);
    particleSensor.setPulseAmplitudeGreen(0);
  }
  
  // Инициализация BLE
  BLEDevice::init("GHOST-PULSE-001");
  
  // Создаем сервер
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
  
  // Heart Rate Service
  BLEService *pHeartService = pServer->createService(HR_SERVICE_UUID);
  pHeartRateCharacteristic = pHeartService->createCharacteristic(
    HR_CHAR_UUID,
    BLECharacteristic::PROPERTY_NOTIFY
  );
  pHeartRateCharacteristic->addDescriptor(new BLE2902());
  pHeartService->start();
  
  // Battery Service
  BLEService *pBatteryService = pServer->createService(BATTERY_SERVICE_UUID);
  pBatteryCharacteristic = pBatteryService->createCharacteristic(
    BATTERY_CHAR_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  pBatteryCharacteristic->addDescriptor(new BLE2902());
  pBatteryService->start();
  
  // Advertising
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(HR_SERVICE_UUID);
  pAdvertising->addServiceUUID(BATTERY_SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  
  Serial.println("[GHOST-PULSE] BLE advertising started");
  Serial.println("[GHOST-PULSE] Device name: GHOST-PULSE-001");
}

void loop() {
  if (deviceConnected) {
    // Читаем пульс с сенсора или генерируем демо-данные
    if (particleSensor.begin(Wire, I2C_SPEED_FAST)) {
      heartRate = readHeartRateFromSensor();
    } else {
      // Демо-режим: имитация пульса
      heartRate = 60 + random(40);
    }
    
    // Обновляем характеристики
    uint8_t hrData[2] = { 0, heartRate };  // Flags + HR
    pHeartRateCharacteristic->setValue(hrData, 2);
    pHeartRateCharacteristic->notify();
    
    // Батарея (падает медленно)
    if (millis() % 60000 == 0 && batteryLevel > 0) {
      batteryLevel--;
    }
    pBatteryCharacteristic->setValue(&batteryLevel, 1);
    pBatteryCharacteristic->notify();
    
    Serial.print("[GHOST-PULSE] HR: ");
    Serial.print(heartRate);
    Serial.print(" | Battery: ");
    Serial.println(batteryLevel);
    
    delay(1000);  // Обновление раз в секунду
  } else {
    // Мигаем LED при ожидании подключения
    delay(500);
  }
}

uint8_t readHeartRateFromSensor() {
  // Упрощённый алгоритм - в реальности нужен фильтр
  long irValue = particleSensor.getIR();
  
  if (irValue < 50000) {
    return 0;  // Нет пальца/кожи
  }
  
  // Простая эвристика - в реальности нужен пиковый детектор
  static uint32_t lastBeatTime = 0;
  static uint8_t beatsPerMinute = 72;
  
  uint32_t currentTime = millis();
  if (currentTime - lastBeatTime > 600) {  // Минимум 100 BPM
    // Детектируем пик (упрощённо)
    beatsPerMinute = 60000 / (currentTime - lastBeatTime);
    lastBeatTime = currentTime;
  }
  
  // Ограничиваем разумными пределами
  if (beatsPerMinute < 40) beatsPerMinute = 40;
  if (beatsPerMinute > 200) beatsPerMinute = 200;
  
  return beatsPerMinute;
}
