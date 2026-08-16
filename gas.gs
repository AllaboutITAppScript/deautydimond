/************************************************************
 * แผงตั้งค่าระบบทายหวย — เก็บการตั้งค่าไว้ใน Google Sheet
 *
 * การตั้งค่าทั้งหมด (เปิด/ปิด, เวลาเปิด-ปิด, งวดพิเศษ, รหัสผ่าน)
 * จะถูกบันทึกลง Google Sheet ชื่อ "LotteryConfig" แทน Script Properties
 *
 * วิธีติดตั้ง (ทำครั้งเดียวเท่านั้น):
 * 1. เปิด https://script.google.com แล้วกด "โปรเจกต์ใหม่" (New project)
 *    - ถ้าต้องการให้ใช้สเปรดชีตที่เลือกเอง: สร้างจาก Google Sheets
 *      > Extensions > Apps Script (สคริปต์จะผูกกับชีตนั้น)
 * 2. ลบโค้ดเดิมทิ้ง แล้ววางโค้ดไฟล์นี้ทั้งหมดทับ
 * 3. กดปุ่ม "ปรับใช้" (Deploy) > New deployment > เลือก Web app
 *    - Execute as: Me (ฉัน)
 *    - Who has access: Anyone (ทุกคน)
 * 4. กด Deploy แล้วคัดลอก URL ที่ได้ (ลงท้ายด้วย /exec)
 * 5. เปิดไฟล์ config.json ใน GitHub แล้วใส่ URL ลงในช่อง "gasUrl" (แทน "")
 *    แล้วกด Commit — ทำแค่ครั้งนี้ครั้งเดียว
 * 6. เสร็จ! จากนี้เปิด settings.html ตั้งค่า แล้วกด "บันทึกการตั้งค่า" ได้เลย
 *    ระบบจะสร้าง Google Sheet "LotteryConfig" ให้อัตโนมัติครั้งแรก (หรือใช้ชีต
 *    ที่สคริปต์ผูกอยู่) ไม่ต้องแตะ GitHub อีก
 *
 * ⚠️ ถ้าเป็นสคริปต์ที่ปรับใช้อยู่แล้ว: แก้โค้ดเสร็จให้กด
 *    Deploy > Manage deployments > แก้ไข (ดินสอ) > Version: New version > Deploy
 *    เพื่ออัปเดตโดยใช้ URL เดิม (ลงท้าย /exec) — และกดอนุญาต (Authorize)
 *    เมื่อระบบขอสิทธิ์เข้าถึง Google Sheets/Drive
 ************************************************************/

var CONFIG_SHEET = 'LotteryConfig';
var PROP_SHEET_ID = 'LOTTERY_SHEET_ID';
var DEFAULT_PIN = '1234';

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || 'getConfig';
    if (action === 'getConfig') {
      return json_(getConfigPayload());
    }
    return json_({ success: false, message: 'ไม่รู้จัก action: ' + action });
  } catch (err) {
    // ไม่ให้ค้าง/error เงียบ — คืน JSON พร้อมข้อความเสมอ
    return json_({ success: false, message: 'เกิดข้อผิดพลาด: ' + err });
  }
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
      var cfg = {
        manualOverride: body.manualOverride || null,
        defaultOpen: String(body.defaultOpen || '06:00'),
        defaultClose: String(body.defaultClose || '14:00'),
        updatedAt: new Date().toISOString()
      };
      // เก็บค่าเดิมไว้ ถ้า client ไม่ส่งฟิลด์นั้นมา (กันบันทึกทับลบข้อมูลทิ้ง)
      if (body.overrides !== undefined) cfg.overrides = Array.isArray(body.overrides) ? body.overrides : [];
      if (body.banners !== undefined) cfg.banners = Array.isArray(body.banners) ? body.banners : [];
      // เปลี่ยน PIN ถ้ากรอก PIN ใหม่ (อย่างน้อย 4 ตัว)
      var newPin = String(body.newPin || '').trim();
      if (newPin.length >= 4) {
        setPin_(newPin);
      }
      setConfig_(cfg);
      var out = getConfigPayload();
      out.success = true;
      out.message = 'บันทึกสำเร็จ (ลง Google Sheet)';
      return json_(out);
    }
    return json_({ success: false, message: 'ไม่รู้จัก action: ' + action });
  } catch (err) {
    return json_({ success: false, message: 'เกิดข้อผิดพลาด: ' + err });
  }
}

// =====================================================================
// การอ่าน/เขียน Google Sheet (ชีต "LotteryConfig" รูปแบบ key | value)
// =====================================================================

// หาสเปรดชีตที่ใช้เก็บการตั้งค่า:
//   1. ชีตที่สคริปต์ผูกอยู่ (สร้างจาก Google Sheets > Extensions > Apps Script)
//   2. ID ที่เคยบันทึกไว้ใน Script Properties
//   3. ยังไม่มี → สร้างสเปรดชีต "LotteryConfig" ใหม่ให้อัตโนมัติ (ครั้งแรก)
function getStore_() {
  var ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) {}
  if (!ss) {
    var id = PropertiesService.getScriptProperties().getProperty(PROP_SHEET_ID);
    if (id) {
      try { ss = SpreadsheetApp.openById(id); } catch (e) {}
    }
  }
  if (!ss) {
    ss = SpreadsheetApp.create('LotteryConfig');
    PropertiesService.getScriptProperties().setProperty(PROP_SHEET_ID, ss.getId());
  }
  var sheet = ss.getSheetByName(CONFIG_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG_SHEET);
    sheet.getRange('A1:B1').setValues([['key', 'value']]);
  }
  migrateFromProperties_(sheet);
  return sheet;
}

// ย้ายข้อมูลเก่าที่เคยเก็บใน Script Properties (เวอร์ชันก่อนหน้า) เข้าชีต — ทำครั้งเดียว
function migrateFromProperties_(sheet) {
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty('LOTTERY_CONFIG');
  var pin = props.getProperty('LOTTERY_ADMIN_PIN');
  if (!raw && !pin) return;
  var map = readAll_(sheet);
  if (!map.config && raw) {
    setCell_(sheet, 'config', raw);
    props.deleteProperty('LOTTERY_CONFIG');
  }
  if (!map.pin && pin) {
    setCell_(sheet, 'pin', pin);
    props.deleteProperty('LOTTERY_ADMIN_PIN');
  }
}

// ค้นหาแถวของ key ในชีต (คืน { row, value } หรือ null)
function getCell_(sheet, key) {
  var last = sheet.getLastRow();
  if (last < 2) return null;
  var vals = sheet.getRange(1, 1, last, 2).getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === key) return { row: i + 1, value: vals[i][1] };
  }
  return null;
}

function setCell_(sheet, key, value) {
  var found = getCell_(sheet, key);
  if (found) {
    sheet.getRange(found.row, 2).setValue(value);
  } else {
    sheet.appendRow([key, value]);
  }
}

// อ่านทุกแถวในชีตเป็น { key: value }
function readAll_(sheet) {
  var map = {};
  var last = sheet.getLastRow();
  if (last >= 2) {
    var vals = sheet.getRange(1, 1, last, 2).getValues();
    for (var i = 1; i < vals.length; i++) {
      var k = String(vals[i][0] || '');
      if (k) map[k] = vals[i][1];
    }
  }
  return map;
}

// =====================================================================
// ข้อมูลการตั้งค่า
// =====================================================================

function getPin() {
  var map = readAll_(getStore_());
  return map.pin ? String(map.pin) : DEFAULT_PIN;
}

function setPin_(pin) {
  setCell_(getStore_(), 'pin', pin);
}

function setConfig_(cfg) {
  setCell_(getStore_(), 'config', JSON.stringify(cfg));
}

function getConfigPayload() {
  var map = readAll_(getStore_());
  var cfg = null;
  if (map.config) {
    try { cfg = JSON.parse(String(map.config)); } catch (e) {}
  }
  if (!cfg) {
    cfg = { manualOverride: null, defaultOpen: '06:00', defaultClose: '14:00', overrides: [], banners: [], updatedAt: null };
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
