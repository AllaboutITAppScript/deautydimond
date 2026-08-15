/************************************************************
 * แผงตั้งค่าระบบทายหวย — เก็บการตั้งค่าไว้บน Google
 *
 * วิธีติดตั้ง (ทำครั้งเดียวเท่านั้น):
 * 1. เปิด https://script.google.com แล้วกด "โปรเจกต์ใหม่" (New project)
 * 2. ลบโค้ดเดิมทิ้ง แล้ววางโค้ดไฟล์นี้ทั้งหมดทับ
 * 3. กดปุ่ม "ปรับใช้" (Deploy) > New deployment > เลือก Web app
 *    - Execute as: Me (ฉัน)
 *    - Who has access: Anyone (ทุกคน)
 * 4. กด Deploy แล้วคัดลอก URL ที่ได้ (ลงท้ายด้วย /exec)
 * 5. เปิดไฟล์ config.json ใน GitHub แล้วใส่ URL ลงในช่อง "gasUrl" (แทน "")
 *    แล้วกด Commit — ทำแค่ครั้งนี้ครั้งเดียว
 * 6. เสร็จ! จากนี้เปิด settings.html ตั้งค่า แล้วกด "บันทึกการตั้งค่า" ได้เลย
 *    ไม่ต้องแก้ไฟล์หรือแตะ GitHub อีก
 ************************************************************/

var PROP_CONFIG = 'LOTTERY_CONFIG';
var PROP_PIN = 'LOTTERY_ADMIN_PIN';
var DEFAULT_PIN = '1234';

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'getConfig';
  if (action === 'getConfig') {
    return json_(getConfigPayload());
  }
  return json_({ success: false, message: 'ไม่รู้จัก action: ' + action });
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action || 'saveConfig';
    if (action === 'saveConfig') {
      var enteredPin = String(body.pin || '');
      if (enteredPin !== getPin()) {
        return json_({ success: false, message: 'รหัสผ่านไม่ถูกต้อง' });
      }
      var props = PropertiesService.getScriptProperties();
      var cfg = {
        manualOverride: body.manualOverride || null,
        defaultOpen: String(body.defaultOpen || '06:00'),
        defaultClose: String(body.defaultClose || '14:00'),
        overrides: Array.isArray(body.overrides) ? body.overrides : []
      };
      // เปลี่ยน PIN ถ้ากรอก PIN ใหม่ (อย่างน้อย 4 ตัว)
      var newPin = String(body.newPin || '').trim();
      if (newPin.length >= 4) {
        props.setProperty(PROP_PIN, newPin);
      }
      props.setProperty(PROP_CONFIG, JSON.stringify(cfg));
      var out = getConfigPayload();
      out.success = true;
      out.message = 'บันทึกสำเร็จ';
      return json_(out);
    }
    return json_({ success: false, message: 'ไม่รู้จัก action: ' + action });
  } catch (err) {
    return json_({ success: false, message: 'เกิดข้อผิดพลาด: ' + err });
  }
}

function getPin() {
  return PropertiesService.getScriptProperties().getProperty(PROP_PIN) || DEFAULT_PIN;
}

function getConfigPayload() {
  var raw = PropertiesService.getScriptProperties().getProperty(PROP_CONFIG);
  var cfg = null;
  if (raw) {
    try { cfg = JSON.parse(raw); } catch (e) {}
  }
  if (!cfg) {
    cfg = { manualOverride: null, defaultOpen: '06:00', defaultClose: '14:00', overrides: [] };
  }
  // ส่ง SHA-256 ของ PIN ให้หน้าเว็บใช้ตรวจก่อนเปิดหน้าตั้งค่า
  cfg.adminPinHash = sha256Hex(getPin());
  return cfg;
}

function sha256Hex(str) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < raw.length; i++) {
    var b = (raw[i] + 256) % 256;
    hex += ('0' + b.toString(16)).slice(-2);
  }
  return hex;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
