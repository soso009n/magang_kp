/*
 * ====================================================================
 * JUDUL: TandonTrack v2.0 (Full-Stack Terintegrasi)
 * ====================================================================
 * VERSI: Final (HiveMQ Cloud Secure + Kredensial)
 * * FITUR:
 * 1.  Otomasi Lokal: Kontrol relay Hysteresis (25% ON, 75% OFF).
 * 2.  Integrasi Telegram: Notifikasi (/cek, /on, /off).
 * 3.  MQTT Publisher: Mengirim data ke topik private Anda.
 * 4.  MQTT Subscriber: Menerima perintah dari topik private Anda.
 * 5.  [BARU] Terhubung ke port 8883 (MQTT-S / TLS)
 * ====================================================================
 */

// === Library ===
#include <WiFi.h>
#include <NewPing.h>
#include <WiFiClientSecure.h>       // [PENTING] Gunakan Secure Client untuk TLS/SSL
#include <UniversalTelegramBot.h>
#include <PubSubClient.h>

// =================================================
// ===           KONFIGURASI WAJIB ANDA          ===
// =================================================
// --- 1. WiFi Config ---
const char* ssid = "Mine";         // Ganti dengan Nama WiFi Anda
const char* password = "war54321";  // Ganti dengan Password WiFi Anda

// --- 2. Telegram Config ---
#define BOT_TOKEN "7856630661:AAHHn91BwTuKlY9spo33o_8QLV0WXph_pTw" // Token Bot Anda
#define CHAT_ID "5554591008"         // Chat ID Anda

// --- 3. MQTT Config (WAJIB GANTI DENGAN DATA ANDA) ---
const char* mqtt_server   = "98e932c5c464439fb91e60d6c180017a5.s1.eu.hivemq.cloud"; // Alamat URL HiveMQ Anda
const int   mqtt_port     = 8883; // Port aman TLS
const char* mqtt_user     = "backend_server"; // Username HiveMQ Anda
const char* mqtt_password = "GibsonMQTT123";  // Password HiveMQ Anda

// --- 4. Topik MQTT (SAMAKAN DENGAN server.js) ---
#define MQTT_TOPIC_LEVEL    "BBPMP/tandon/level"
#define MQTT_TOPIC_POMPA    "BBPMP/tandon/pompa"
#define MQTT_TOPIC_PERINTAH "BBPMP/tandon/perintah"
// =================================================
// ===        AKHIR DARI KONFIGURASI             ===
// =================================================

// === HC-SR04 Config ===
#define TRIGGER_PIN 5
#define ECHO_PIN 18
#define MAX_DISTANCE 20 

NewPing sonar(TRIGGER_PIN, ECHO_PIN, MAX_DISTANCE);

// === Relay Config ===
#define RELAY_PIN 26

// === Klien & Objek ===
WiFiClientSecure clientSecure;        // Klien untuk Telegram
UniversalTelegramBot bot(BOT_TOKEN, clientSecure);

WiFiClientSecure clientSecureMQTT;  // [BARU] Klien Secure khusus untuk MQTT
PubSubClient client(clientSecureMQTT); // [BARU] PubSubClient menggunakan Secure Client

// === Timer & Status ===
unsigned long lastSensorCheck = 0;
const unsigned long sensorInterval = 5000; 
unsigned long lastTelegramCheck = 0;
const unsigned long telegramInterval = 2000; 
int lastLevel = -1;

// --- FUNGSI PROTOTIPE ---
int hitungLevel(int distance);
void reconnectMQTT();
void mqttCallback(char* topic, byte* payload, unsigned int length);
void handleNewTelegramMessages();
void checkSensorAndAct();


// =======================
// ===  MQTT CALLBACK  ===
// =======================
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String pesan;
  for (int i = 0; i < length; i++) {
    pesan += (char)payload[i];
  }

  Serial.print("Perintah diterima di topik [");
  Serial.print(topic);
  Serial.print("]: ");
  Serial.println(pesan);

  if (String(topic) == MQTT_TOPIC_PERINTAH) {
    if (pesan == "ON") {
      digitalWrite(RELAY_PIN, HIGH);
      Serial.println("Pompa dinyalakan (via MQTT).");
      client.publish(MQTT_TOPIC_POMPA, "ON");
    } 
    else if (pesan == "OFF") {
      digitalWrite(RELAY_PIN, LOW);
      Serial.println("Pompa dimatikan (via MQTT).");
      client.publish(MQTT_TOPIC_POMPA, "OFF");
    }
  }
}

// =======================
// ===     SETUP     ===
// =======================
void setup() {
  Serial.begin(9600);
  delay(100);

  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW); 

  // WiFi Connect
  WiFi.begin(ssid, password);
  Serial.print("Menyambungkan WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n✅ Terhubung ke WiFi");

  // Bypass verifikasi sertifikat (untuk Telegram & MQTT)
  clientSecure.setInsecure();
  clientSecureMQTT.setInsecure(); // [BARU] Bypass sertifikat untuk MQTT juga

  // MQTT Server
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(mqttCallback);
}

// =======================
// ===      LOOP     ===
// =======================
void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Koneksi WiFi terputus, mencoba menyambungkan ulang...");
    WiFi.reconnect();
    delay(5000); 
    return;
  }

  if (!client.connected()) {
    reconnectMQTT();
  }
  client.loop(); // [SANGAT PENTING] Memproses pesan MQTT masuk/keluar

  // Timer 1: Cek Sensor
  if (millis() - lastSensorCheck >= sensorInterval) {
    lastSensorCheck = millis();
    checkSensorAndAct();
  }

  // Timer 2: Cek Telegram
  if (millis() - lastTelegramCheck >= telegramInterval) {
    lastTelegramCheck = millis();
    handleNewTelegramMessages();
  }
}

// ===================================
// === FUNGSI-FUNGSI IMPLEMENTASI ===
// ===================================

void reconnectMQTT() {
  while (!client.connected()) {
    Serial.print("Mencoba terhubung ke MQTT Broker (HiveMQ Cloud)...");
    
    // [MODIFIKASI] Buat ID Klien unik dan sertakan Username/Password
    if (client.connect("ESP32_Tandon_BBPMP_Gibson", mqtt_user, mqtt_password)) {
      Serial.println("terhubung!");
      
      // Kirim status pompa saat ini (saat baru terhubung)
      client.publish(MQTT_TOPIC_POMPA, digitalRead(RELAY_PIN) ? "ON" : "OFF");
      
      // Subscribe ke topik perintah
      client.subscribe(MQTT_TOPIC_PERINTAH);
      Serial.println("Berhasil subscribe ke topik perintah.");

    } else {
      Serial.print("gagal, rc=");
      Serial.print(client.state());
      Serial.println(" coba lagi dalam 5 detik");
      delay(5000);
    }
  }
}

void checkSensorAndAct() {
  int distance = sonar.ping_cm();
  if (distance == 0) {
    Serial.println("❌ Sensor gagal membaca jarak.");
    return;
  }

  Serial.print("Jarak air: "); Serial.print(distance); Serial.println(" cm");
  int level = hitungLevel(distance);

  // --- 1. PUBLISH DATA SENSOR (LEVEL) KE MQTT ---
  char levelStr[5];
  dtostrf(level, 1, 0, levelStr); 
  client.publish(MQTT_TOPIC_LEVEL, levelStr);
  Serial.println("📨 Data Level dikirim ke MQTT.");

  // --- 2. CEK NOTIFIKASI TELEGRAM ---
  if (level != lastLevel && (level == 0 || level == 25 || level == 50 || level == 75 || level == 100)) {
    lastLevel = level;
    String pesan = "📡 Level air saat ini: " + String(level) + "%";
    if (level == 100) pesan += " ⛲ PENUH!";
    else if (level == 0) pesan += " ⚠️ KOSONG!";
    else if (level <= 25) pesan += " ⚠️ Rendah!";
    
    bot.sendMessage(CHAT_ID, pesan, "");
    Serial.println("📨 Notifikasi Telegram dikirim.");
  }

  // --- 3. KONTROL RELAY OTOMATIS ---
  bool pompaStatusChanged = false;
  if (level <= 25) {
    if (digitalRead(RELAY_PIN) == LOW) { 
      digitalWrite(RELAY_PIN, HIGH);     
      Serial.println("💧 Pompa dinyalakan (otomatis)");
      pompaStatusChanged = true;
    }
  } else if (level >= 75) {
    if (digitalRead(RELAY_PIN) == HIGH) { 
      digitalWrite(RELAY_PIN, LOW);       
      Serial.println("💧 Pompa dimatikan (otomatis)");
      pompaStatusChanged = true;
    }
  }

  // --- 4. PUBLISH STATUS POMPA KE MQTT (SINKRONISASI) ---
  if (pompaStatusChanged) {
    client.publish(MQTT_TOPIC_POMPA, digitalRead(RELAY_PIN) ? "ON" : "OFF");
    Serial.println("📨 Status Pompa (otomatis) dikirim ke MQTT.");
  }
}

void handleNewTelegramMessages() {
  int numNewMessages = bot.getUpdates(bot.last_message_received + 1);

  while (numNewMessages) {
    for (int i = 0; i < numNewMessages; i++) {
      String msg = bot.messages[i].text;
      String chat_id = bot.messages[i].chat_id;
      
      if (msg == "/cek") {
        int distance = sonar.ping_cm();
        int level = hitungLevel(distance);
        String reply = "📏 Jarak: " + String(distance) + " cm\n📊 Level air: " + String(level) + "%";
        bot.sendMessage(chat_id, reply, "");
      } 
      else if (msg == "/on") {
        digitalWrite(RELAY_PIN, HIGH);
        bot.sendMessage(chat_id, "🔌 Pompa dinyalakan manual.", "");
        // [SINKRONISASI] Kirim update status ke MQTT agar frontend sinkron
        client.publish(MQTT_TOPIC_POMPA, "ON");
        Serial.println("📨 Status Pompa (manual ON) dikirim ke MQTT.");
      } 
      else if (msg == "/off") {
        digitalWrite(RELAY_PIN, LOW);
        bot.sendMessage(chat_id, "🔌 Pompa dimatikan manual.", "");
        // [SINKRONISASI] Kirim update status ke MQTT agar frontend sinkron
        client.publish(MQTT_TOPIC_POMPA, "OFF");
        Serial.println("📨 Status Pompa (manual OFF) dikirim ke MQTT.");
      } 
      else {
        bot.sendMessage(chat_id, "🤖 Perintah tidak dikenali. Gunakan: /cek /on /off", "");
      }
    }
    numNewMessages = bot.getUpdates(bot.last_message_received + 1);
  }
}

int hitungLevel(int distance) {
  if (distance == 0) return lastLevel; // Jaga level terakhir jika bacaan gagal
  
  int ketinggianAir = MAX_DISTANCE - distance;
  float persentase = (ketinggianAir / (float)MAX_DISTANCE) * 100.0;

  if (persentase < 0) persentase = 0;
  if (persentase > 100) persentase = 100;

  if (persentase >= 90) return 100;
  else if (persentase >= 65) return 75;
  else if (persentase >= 40) return 50;
  else if (persentase >= 15) return 25;
  else return 0;
}