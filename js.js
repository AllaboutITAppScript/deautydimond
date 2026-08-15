// =====================================================================
// ระบบเปิด-ปิดกิจกรรมทายหวย (ทายเลขท้าย 2 ตัว)
//
// อ่านการตั้งค่าจาก config.json — เปิด/ปิดได้โดยไม่ต้องแก้ไฟล์นี้
//   - manualOverride : null = อัตโนมัติตามตารางงวด / "open" = บังคับเปิด / "close" = บังคับปิด
//   - defaultOpen / defaultClose : เวลาเปิด-ปิดของทุกงวด
//   - overrides : รายการงวดที่ปรับพิเศษ (ปิดงวดนั้น หรือปรับเวลา)
//
// งวดล็อตเตอรี่รัฐบาลออกวันที่ 1 และ 16 ของทุกเดือน ระบบจะเปิด-ปิดอัตโนมัติทุกงวด ทุกปี
// =====================================================================

// --- ค่าเริ่มต้นสำรอง ถ้าโหลด config.json ไม่ได้ (ค่าเดิมที่เคย hardcode ไว้) ---
var FALLBACK_OPEN = new Date(2026, 7, 1, 6, 0, 0);   // 1 ส.ค. 2026 06:00
var FALLBACK_CLOSE = new Date(2026, 7, 1, 14, 0, 0); // 1 ส.ค. 2026 14:00

var config = null;       // null = ยังโหลด config ไม่เสร็จ
var configLoaded = false;

async function loadConfig() {
	try {
		var res = await fetch('config.json', { cache: 'no-store' });
		if (res.ok) {
			var data = await res.json();
			if (data && typeof data === 'object') {
				config = data;
				if (!config.defaultOpen) config.defaultOpen = '06:00';
				if (!config.defaultClose) config.defaultClose = '14:00';
				if (!Array.isArray(config.overrides)) config.overrides = [];
			}
			// ถ้ามีการตั้งค่า Google Apps Script (gasUrl) ให้ใช้ค่าจาก GAS เป็นหลัก
			if (config && config.gasUrl) {
				try {
					var gasRes = await fetch(config.gasUrl + '?action=getConfig', { cache: 'no-store' });
					if (gasRes.ok) {
						var gas = await gasRes.json();
						if (gas && typeof gas === 'object' && (gas.manualOverride || gas.defaultOpen || gas.defaultClose || (gas.overrides && gas.overrides.length))) {
							config.manualOverride = gas.manualOverride || null;
							if (gas.defaultOpen) config.defaultOpen = gas.defaultOpen;
							if (gas.defaultClose) config.defaultClose = gas.defaultClose;
							config.overrides = Array.isArray(gas.overrides) ? gas.overrides : [];
						}
					}
				} catch (e2) {
					console.warn('โหลด config จาก Google Apps Script ไม่สำเร็จ ใช้ค่าใน config.json', e2);
				}
			}
		}
	} catch (e) {
		console.warn('โหลด config.json ไม่สำเร็จ ใช้ค่าเริ่มต้นเดิม', e);
	}
	configLoaded = true;
}

function pad2(n) { return (n < 10 ? '0' : '') + n; }
function dateStr(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

function parseHM(s) {
	var p = String(s || '').split(':');
	return { h: parseInt(p[0], 10) || 0, m: parseInt(p[1], 10) || 0 };
}

function combineHM(ds, hm) {
	var t = parseHM(hm);
	var p = ds.split('-');
	return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10), t.h, t.m, 0);
}

// งวดล็อตเตอรี่รัฐบาลออกวันที่ 1 และ 16 ของทุกเดือน
function isDrawDay(d) { return d.getDate() === 1 || d.getDate() === 16; }

// คำนวณสถานะ: 0 = ยังไม่เปิด / 1 = เปิดให้ทาย / 2 = ปิด
function computeStatus(now) {
	// โหมดบังคับเปิด/ปิดทั้งระบบ (ตั้งจากหน้าตั้งค่าระบบ)
	if (configLoaded && config) {
		if (config.manualOverride === 'open') {
			// บังคับเปิด → นับถอยหลังถึงเที่ยงคืนวันนี้
			var eod = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
			return { status: 1, timeEnd: eod, forced: true };
		}
		if (config.manualOverride === 'close') {
			return { status: 2, forced: true };
		}
	}
	// ยังโหลด config ไม่เสร็จ → ใช้ค่าเดิมที่เคยกำหนดไว้ในโค้ด
	if (!configLoaded || !config || !config.defaultOpen) {
		if (now < FALLBACK_OPEN) return { status: 0, timeEnd: FALLBACK_OPEN };
		if (now < FALLBACK_CLOSE) return { status: 1, timeEnd: FALLBACK_CLOSE };
		return { status: 2 };
	}
	// อัตโนมัติตามตารางงวด
	if (!isDrawDay(now)) return { status: 2 };
	var ds = dateStr(now);
	var ov = null;
	for (var i = 0; i < config.overrides.length; i++) {
		if (config.overrides[i].date === ds) { ov = config.overrides[i]; break; }
	}
	if (ov && ov.enabled === false) return { status: 2 }; // งวดนี้ปิดพิเศษ
	var open = combineHM(ds, (ov && ov.open) || config.defaultOpen);
	var close = combineHM(ds, (ov && ov.close) || config.defaultClose);
	if (now < open) return { status: 0, timeEnd: open };
	if (now < close) return { status: 1, timeEnd: close };
	return { status: 2 };
}

function setDisplay(id, value) {
	var el = document.getElementById(id);
	if (el) el.style.display = value;
}

function updateTimer() {

	var now = new Date();
	var st = computeStatus(now);
	var status = st.status;
	var diff = st.timeEnd ? st.timeEnd - now : 0;

	days = Math.floor(diff / (1000 * 60 * 60 * 24));
	hours = Math.floor(diff / (1000 * 60 * 60));
	mins = Math.floor(diff / (1000 * 60));
	secs = Math.floor(diff / 1000);

	d = days;
	h = hours - days * 24;
	m = mins - hours * 60;
	s = secs - mins * 60;
	h = h < 10 ? "0" + h : h;
	m = m < 10 ? "0" + m : m;
	s = s < 10 ? "0" + s : s;

	document.getElementById("timer").innerHTML =
		'<h2 class="mt-4 text-warning">เหลือเวลาอีก</h2>' +
		'<div>' + d + '<span>วัน</span></div>' +
		'<div>' + h + '<span>ชั่วโมง</span></div>' +
		'<div>' + m + '<span>นาที</span></div>' +
		'<div>' + s + '<span>วินาที</span></div>';

	/** -- ควบคุมการเปิดหน้าต่างๆ ตามเวลาที่กำหนด -- **/
	if (status === 0) {
		document.getElementById("msgStatus").innerHTML =
			`<h2>จะเปิดให้เล่นกิจกรรมทายหวย  </h2> <img src="https://media0.giphy.com/media/AgBce8OuQ5mbencR1H/200w.webp?cid=ecf05e47kxj12cpe8nbd0m4lddbapg86iir9027qrx22bqb3&ep=v1_gifs_related&rid=200w.webp&ct=s" alt="Girl in a jacket" style="width:370px;height:300px;">`;
		setDisplay("timer", "");
		setDisplay("btnResult", "none");
		setDisplay("cover", "none");
	} else if (status === 1) {
		document.getElementById("msgStatus").innerHTML =
			st.forced ? "<h2>เปิดระบบการทายหวยแล้ว</h2>" : "<h2>จะปิดให้ทายหวย</h2>";
		setDisplay("timer", "");
		setDisplay("cover", "block");
	} else {
		document.getElementById("msgStatus").innerHTML =
			'<div class="card"><div class="card-body">' +
			'<h2><center><img src="https://i.pinimg.com/originals/10/6b/68/106b68071a23586acfc1e3220740482f.gif" alt="Girl in a jacket" style="width:370px;height:300px;">' +
			'<h2 class="text-danger">ขณะนี้ปิดระบบการทายหวยแล้วค่ะ</h2>' +
			'<input type="button" class="btn btn-danger" style="font-weight: bold; display: inline;" value="ปิดหน้านี้" onclick="closeMe()"> </center>' +
			'</div></div>';
		setDisplay("timer", "none");
		setDisplay("cover", "none");
	}
}

setInterval(updateTimer, 1000);
// โหลด config ทันที และโหลดซ้ำทุก 3 นาที (รับการตั้งค่าใหม่จากหน้า settings โดยไม่ต้องโหลดหน้าใหม่)
loadConfig();
setInterval(loadConfig, 180000);
// โหลดซ้ำทุกครั้งที่กลับมาที่แท็บ (กรณีเพิ่งบันทึกการตั้งค่าแล้วกลับมาดู)
document.addEventListener('visibilitychange', function () {
	if (!document.hidden) loadConfig();
});
