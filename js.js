// =====================================================================
// ระบบเปิด-ปิดกิจกรรมทายหวย (ทายเลขท้าย 2 ตัว)
//
// อ่านการตั้งค่าจาก config.json + Google Apps Script (gasUrl) — เปิด/ปิดได้โดยไม่ต้องแก้ไฟล์นี้
//   - manualOverride : null = อัตโนมัติตามตารางงวด / "open" = บังคับเปิด / "close" = บังคับปิด
//   - defaultOpen / defaultClose : เวลาเปิด-ปิดของทุกงวด
//   - overrides : รายการงวดที่ปรับพิเศษ (ปิดงวดนั้น หรือปรับเวลา)
//
// งวดล็อตเตอรี่รัฐบาลออกวันที่ 1 และ 16 ของทุกเดือน ระบบจะเปิด-ปิดอัตโนมัติทุกงวด ทุกปี
// =====================================================================

var config = null;       // null = ยังโหลด config ไม่เสร็จ
var configLoaded = false;
var renderedBannersKey = null;   // จำแถวรูปที่ render ไปแล้ว เพื่อไม่ต้องสร้างซ้ำ

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
						if (gas && typeof gas === 'object' && gas.defaultOpen) {
							// GAS เป็นแหล่งข้อมูลหลัก — ค่าเวลาจาก GAS ทับ config.json
							config.manualOverride = (typeof gas.manualOverride === 'string') ? gas.manualOverride : null;
							if (gas.defaultOpen) config.defaultOpen = gas.defaultOpen;
							if (gas.defaultClose) config.defaultClose = gas.defaultClose;
							if (Array.isArray(gas.overrides)) config.overrides = gas.overrides;
							if (Array.isArray(gas.banners)) config.banners = gas.banners;
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
	renderBanners(config ? config.banners : null);
}

// สร้างแถบรูปโปรโมชั่น (carousel) จากค่า banners ใน config — รูปแรกคือสไลด์แรก
// ถ้าไม่มีรูปแบนเนอร์ (ยังไม่ได้ตั้งค่า หรือลบรูปทิ้งทั้งหมด) จะซ่อนแถบรูปไว้
function renderBanners(banners) {
	var el = document.getElementById('carouselExampleCaptions');
	if (!el) return;
	var coverCard = el.closest ? el.closest('.cover-card') : null;
	var inner = el.querySelector('.carousel-inner');
	var ind = el.querySelector('.carousel-indicators');
	if (!inner || !ind) return;

	// ไม่มีรูป → ซ่อนแถบรูป (การ์ดกติกายังแสดงตามปกติ)
	if (!banners || !Array.isArray(banners) || !banners.length) {
		if (coverCard) coverCard.style.display = 'none';
		return;
	}
	if (coverCard) coverCard.style.display = '';

	var key = banners.join('|');
	if (key === renderedBannersKey) return;   // รูปชุดเดิม → ไม่ต้องสร้างใหม่
	renderedBannersKey = key;

	ind.innerHTML = '';
	inner.innerHTML = '';
	banners.forEach(function (url, i) {
		var btn = document.createElement('button');
		btn.type = 'button';
		btn.setAttribute('data-bs-target', '#carouselExampleCaptions');
		btn.setAttribute('data-bs-slide-to', String(i));
		btn.setAttribute('aria-label', 'Slide ' + (i + 1));
		if (i === 0) {
			btn.className = 'active';
			btn.setAttribute('aria-current', 'true');
		}
		ind.appendChild(btn);

		var item = document.createElement('div');
		item.className = 'carousel-item' + (i === 0 ? ' active' : '');
		var img = document.createElement('img');
		img.src = url;
		img.className = 'd-block w-100';
		img.alt = '...';
		item.appendChild(img);
		inner.appendChild(item);
	});

	// เริ่ม Bootstrap Carousel ใหม่กับสไลด์ชุดใหม่ (ลบ instance เก่าทิ้งก่อน)
	if (window.bootstrap && bootstrap.Carousel) {
		var inst = bootstrap.Carousel.getInstance(el);
		if (inst) inst.dispose();
		bootstrap.Carousel.getOrCreateInstance(el, { interval: 5000, ride: 'carousel' });
	}
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

// หาวันงวดถัดไป (วันที่ 1 หรือ 16 ถัดจากวันที่กำหนด)
function nextDrawDay(from) {
	var d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
	if (d.getDate() < 16) return new Date(d.getFullYear(), d.getMonth(), 16);
	return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

// จำนวนวันก่อนวันออกหวย (0 = วันงวด, 1 = พรุ่งนี้, 2 = มะรืนนี้)
function daysBeforeDraw(now) {
	var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	var nd = nextDrawDay(now);
	return Math.round((nd - today) / 86400000);
}

// คำนวณสถานะ: 0 = ยังไม่เปิด / 1 = เปิดให้ทาย / 2 = ปิด
function computeStatus(now) {
	var defOpen = (config && config.defaultOpen) || '06:00';
	var defClose = (config && config.defaultClose) || '14:00';

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

	// ยังโหลด config ไม่เสร็จ/ไม่ได้ → ใช้เวลาค่าเริ่มต้นกับงวดถัดไป (ไม่ hardcode วันที่ตายตัว)
	if (!configLoaded || !config) {
		var dsF = dateStr(nextDrawDay(now));
		var fOpen = combineHM(dsF, defOpen);
		var fClose = combineHM(dsF, defClose);
		if (now < fOpen) return { status: 0, timeEnd: fOpen, openTime: defOpen, closeTime: defClose };
		if (now < fClose) return { status: 1, timeEnd: fClose, openTime: defOpen, closeTime: defClose };
		return { status: 2, openTime: defOpen, closeTime: defClose };
	}

	// อัตโนมัติตามตารางงวด
	if (!isDrawDay(now)) {
		// ภายใน 2 วันก่อนวันออกหวย → ไม่แสดงข้อความปิด แต่นับถอยหลังถึงเวลาเปิดของงวดถัดไป
		if (daysBeforeDraw(now) <= 2) {
			var nds = dateStr(nextDrawDay(now));
			var nOpenStr = config.defaultOpen;
			var nCloseStr = config.defaultClose;
			for (var k = 0; k < config.overrides.length; k++) {
				if (config.overrides[k].date === nds) {
					var nov = config.overrides[k];
					if (nov.enabled === false) {
						// งวดถัดไปปิดพิเศษ → ยังคงแสดงข้อความปิด
						return { status: 2, openTime: defOpen, closeTime: defClose };
					}
					if (nov.open) nOpenStr = nov.open;
					if (nov.close) nCloseStr = nov.close;
				}
			}
			var nOpen = combineHM(nds, nOpenStr);
			if (now < nOpen) return { status: 0, timeEnd: nOpen, openTime: nOpenStr, closeTime: nCloseStr };
			return { status: 2, openTime: nOpenStr, closeTime: nCloseStr };
		}
		// ห่างจากงวดถัดไปเกิน 2 วัน → แสดงข้อความปิด
		return { status: 2, openTime: defOpen, closeTime: defClose };
	}
	var ds = dateStr(now);
	var ov = null;
	for (var i = 0; i < config.overrides.length; i++) {
		if (config.overrides[i].date === ds) { ov = config.overrides[i]; break; }
	}
	if (ov && ov.enabled === false) return { status: 2, openTime: defOpen, closeTime: defClose }; // งวดนี้ปิดพิเศษ

	var openStr = (ov && ov.open) || config.defaultOpen;
	var closeStr = (ov && ov.close) || config.defaultClose;
	var open = combineHM(ds, openStr);
	var close = combineHM(ds, closeStr);

	if (now < open) return { status: 0, timeEnd: open, openTime: openStr, closeTime: closeStr };
	if (now < close) return { status: 1, timeEnd: close, openTime: openStr, closeTime: closeStr };
	return { status: 2, openTime: openStr, closeTime: closeStr };
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

	/** -- ควบคุมการเปิดหน้าต่างๆ ตามเวลาที่กำหนด (จากค่าที่ตั้งไว้) -- **/
	if (status === 0) {
		var openLabel = st.openTime ? ' เวลา ' + st.openTime + ' น.' : '';
		document.getElementById("msgStatus").innerHTML =
			`<h2>จะเปิดให้เล่นกิจกรรมทายหวย${openLabel}  </h2> <img src="https://media0.giphy.com/media/AgBce8OuQ5mbencR1H/200w.webp?cid=ecf05e47kxj12cpe8nbd0m4lddbapg86iir9027qrx22bqb3&ep=v1_gifs_related&rid=200w.webp&ct=s" alt="Girl in a jacket" style="width:100%;max-width:370px;height:auto;">`;
		setDisplay("timer", "");
		setDisplay("btnResult", "none");
		setDisplay("cover", "none");
	} else if (status === 1) {
		var closeLabel = (!st.forced && st.closeTime) ? ' เวลา ' + st.closeTime + ' น.' : '';
		document.getElementById("msgStatus").innerHTML =
			st.forced ? "<h2>เปิดระบบการทายหวยแล้ว</h2>" : "<h2>จะปิดให้ทายหวย" + closeLabel + "</h2>";
		setDisplay("timer", "");
		setDisplay("cover", "block");
	} else {
		document.getElementById("msgStatus").innerHTML =
			'<div class="card"><div class="card-body">' +
			'<h2><center><img src="https://i.pinimg.com/originals/10/6b/68/106b68071a23586acfc1e3220740482f.gif" alt="Girl in a jacket" style="width:100%;max-width:370px;height:auto;">' +
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
