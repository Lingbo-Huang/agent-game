/*
 * REDVERSE ESP32 最小实体输入适配器
 * 板卡：ESP32-C3 / S3；按钮一端接 GPIO9，另一端接 GND。
 * 串口 115200 输出一行一个 JSON。网页/电脑桥接后统一为 StructuredAction。
 */
#include <Arduino.h>

constexpr int ACTION_BUTTON_PIN = 9;
constexpr int FEEDBACK_LED_PIN = LED_BUILTIN;
bool previousPressed = false;
unsigned long lastChangeMs = 0;

void setup() {
  Serial.begin(115200);
  pinMode(ACTION_BUTTON_PIN, INPUT_PULLUP);
  pinMode(FEEDBACK_LED_PIN, OUTPUT);
  digitalWrite(FEEDBACK_LED_PIN, LOW);
  Serial.println("{\"type\":\"device_ready\",\"device\":\"redverse-token-base\",\"version\":1}");
}

void loop() {
  const bool pressed = digitalRead(ACTION_BUTTON_PIN) == LOW;
  const unsigned long now = millis();
  if (pressed != previousPressed && now - lastChangeMs > 40) {
    lastChangeMs = now;
    previousPressed = pressed;
    digitalWrite(FEEDBACK_LED_PIN, pressed ? HIGH : LOW);
    if (pressed) {
      Serial.printf("{\"type\":\"physical_action\",\"action\":\"token_place\",\"token\":\"player\",\"at\":%lu}\n", now);
    }
  }
}
