'use strict';

/* ============ DOM / template / lazy-load helpers ============ */
// Memoized element lookup — these elements are never replaced, so caching is safe
// and avoids repeated getElementById calls on the hot render paths.
const _elCache = {};
function el(id) {
	let node = _elCache[id];
	if (!node || !node.isConnected) node = _elCache[id] = document.getElementById(id);
	return node;
}

// Clone the first element of a <template> by id (template node itself is cached).
const _tplCache = {};
function cloneTemplate(id) {
	const tpl = _tplCache[id] || (_tplCache[id] = document.getElementById(id));
	return tpl.content.firstElementChild.cloneNode(true);
}

function makeEmpty(cls, text) {
	const d = document.createElement('div');
	d.className = cls;
	d.textContent = text;
	return d;
}

// Inject a <script> once; resolves when loaded. Used to defer heavy export libs.
function loadScriptOnce(src) {
	return new Promise((resolve, reject) => {
		if (document.querySelector(`script[src="${src}"]`)) return resolve();
		const s = document.createElement('script');
		s.src = src;
		s.onload = () => resolve();
		s.onerror = () => reject(new Error('Failed to load ' + src));
		document.head.appendChild(s);
	});
}

let _xlsxPromise, _pdfPromise;
function ensureXLSX() {
	return _xlsxPromise ||
		(_xlsxPromise = loadScriptOnce('https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js'));
}
function ensurePDF() {
	return _pdfPromise ||
		(_pdfPromise = loadScriptOnce('https://unpkg.com/jspdf@latest/dist/jspdf.umd.min.js')
			.then(() => loadScriptOnce('https://unpkg.com/jspdf-autotable@5.0.8/dist/jspdf.plugin.autotable.min.js')));
}

/* ============ Technicians ============ */
const TECHNICIANS_LIST = [
	"AHTASHAM ALI", "HARIS ZAMEER", "FARMAN HUSAIN", "ARSLAN HAFEEZ", "SALIM BUNDU",
	"Azam Raza", "MUHAMMAD ADIL MUHAMMAD MUBEEN", "MUHAMMAD AKBAR HUSSAIN KHAN",
	"Shabad Shajad", "Manuel Maruhom Racal", "Sulemaan Abdul Salam", "Mohammad Suhail",
	"Mohd Rizwan Noor Hasan", "Ayan Mohd Hasin", "Kamran Rasheed", "FRANCIS RAMON CATE MARTINEZ",
	"MOHAMMAD shahbaj", "Mohamed Ashraf", "Bilal Hassan", "Ayaz Khan", "Ahmed Abdelmoty",
	"Azam Noory", "Abdelhasib Mohamed", "Modather Awad", "Abdel sadek", "Amr Elsaeed",
	"Adnan Khadr", "Ahmed Moawad", "Sultan Said", "Safwan Sharaf", "Hussien Ramdan",
	"Ahmed Al-Ali", "Emad Ali", "PRADEEP KARANAKKOTTIL", "Mohamed Ghareb", "Mohamed Noury",
	"Mohamed Abo-Deshesh"
];

/* ============ Modal ============ */
// Generic renderer. `buttons` is an array of
// { label, value, variant ('primary'|'secondary'), icon } objects.
// `onClose(value)` fires with the chosen button's value (or null if dismissed).
function openModal({type = 'warning', title, message, buttons, onClose: onCloseCb, autoCloseMs}) {
	const dialog = el('modalPopup');
	const iconEl = el('modalIcon');
	const titleEl = el('modalTitle');
	const messageEl = el('modalMessage');
	const actionsEl = el('modalActions');

	// If a modal is already showing, close it (and let its handler resolve) first.
	if (dialog.open) dialog.close();

	dialog.classList.remove('error', 'success', 'warning');
	dialog.classList.add(type);

	const icons = {
		error: '<i class="fas fa-times-circle"></i>',
		success: '<i class="fas fa-check-circle"></i>',
		warning: '<i class="fas fa-exclamation-triangle"></i>'
	};
	const defaults = {error: 'Error', success: 'Success', warning: 'Warning'};
	iconEl.innerHTML = icons[type] || icons.warning;
	titleEl.textContent = title || defaults[type] || 'Notice';
	messageEl.textContent = message;

	// Chosen value defaults to null — covers Esc / backdrop dismissal.
	let chosenValue = null;
	let timer = null;

	const frag = document.createDocumentFragment();
	(buttons || [{label: 'Got it', value: null}]).forEach(b => {
		const btn = cloneTemplate('modalButtonTemplate');
		if (b.variant === 'secondary') btn.classList.add('secondary');
		// icon markup is app-controlled (trusted); label is escaped.
		btn.innerHTML = (b.icon ? b.icon + ' ' : '') + escapeHtml(b.label);
		btn.addEventListener('click', () => {
			chosenValue = b.value;
			dialog.close();
		});
		frag.appendChild(btn);
	});
	actionsEl.replaceChildren(frag);

	// Native <dialog> handles focus trapping and Esc; we just resolve on close.
	const onBackdropClick = (e) => {
		if (e.target === dialog) dialog.close(); // click on the backdrop area
	};
	const handleClose = () => {
		dialog.removeEventListener('close', handleClose);
		dialog.removeEventListener('click', onBackdropClick);
		if (timer) clearTimeout(timer);
		if (typeof onCloseCb === 'function') onCloseCb(chosenValue);
	};
	dialog.addEventListener('close', handleClose);
	dialog.addEventListener('click', onBackdropClick);

	dialog.showModal();

	if (autoCloseMs) timer = setTimeout(() => dialog.close(), autoCloseMs);
}

// Informational modal (single dismiss button). Success auto-closes after 4s.
function showModal(type, title, message) {
	openModal({type, title, message, autoCloseMs: type === 'success' ? 4000 : 0});
}

// Confirmation modal with custom buttons. `buttons` carry the values passed to onChoice.
function showConfirm(type, title, message, buttons, onChoice) {
	openModal({type, title, message, buttons, onClose: onChoice});
}

function populateTechnicianDropdown() {
	const selectEl = document.getElementById('newTech');
	if (!selectEl) return;
	selectEl.innerHTML = '<option value="">-- Select Technician --</option>';
	TECHNICIANS_LIST.forEach(tech => {
		const option = document.createElement('option');
		option.value = tech;
		option.textContent = tech;
		selectEl.appendChild(option);
	});
}

// Fills a <datalist> with the given option values.
function fillDatalist(id, values) {
	const dl = document.getElementById(id);
	if (!dl) return;
	dl.innerHTML = values.map(v => `<option value="${escapeHtml(v)}"></option>`).join('');
}

// LOCATION suggestions are the known KSA cities; AREA suggestions combine
// those cities with any area/district values already saved in the schedule.
function populateLocationOptions() {
	const cityNames = KSA_CITIES.map(c => c.name);
	fillDatalist('locationOptions', cityNames);

	const savedAreas = new Set();
	allEntries().forEach(e => {
		const a = (e.area || '').trim();
		if (a && a !== '-') savedAreas.add(a);
	});
	const areaOptions = [...new Set([...savedAreas, ...cityNames])].sort((a, b) => a.localeCompare(b));
	fillDatalist('areaOptions', areaOptions);
}

/* ============ KSA cities & travel-conflict engine ============ */
// Coordinates for city centers. aliases are matched (case-insensitive)
// against the LOCATION and AREA text of each entry.
const KSA_CITIES = [
	{name: "Dammam", lat: 26.4207, lng: 50.0888, aliases: ["dammam", "الدمام"]},
	{name: "Dhahran", lat: 26.2886, lng: 50.1140, aliases: ["dhahran", "الظهران"]},
	{name: "Al Khobar", lat: 26.2172, lng: 50.1971, aliases: ["khobar", "al khobar", "al-khobar", "الخبر"]},
	{name: "Qatif", lat: 26.5650, lng: 50.0089, aliases: ["qatif", "qateef", "القطيف"]},
	{name: "Saihat", lat: 26.4836, lng: 50.0413, aliases: ["saihat", "sayhat", "سيهات"]},
	{name: "Safwa", lat: 26.6500, lng: 49.9542, aliases: ["safwa", "صفوى"]},
	{name: "Tarout", lat: 26.5703, lng: 50.0612, aliases: ["tarout", "tarut", "تاروت"]},
	{name: "Ras Tanura", lat: 26.6444, lng: 50.1599, aliases: ["ras tanura", "ras tanoura", "رأس تنورة"]},
	{name: "Jubail", lat: 27.0046, lng: 49.6460, aliases: ["jubail", "al jubail", "al-jubail", "الجبيل"]},
	{name: "Abqaiq", lat: 25.9371, lng: 49.6850, aliases: ["abqaiq", "buqayq", "بقيق"]},
	{
		name: "Hofuf (Al Ahsa)",
		lat: 25.3647,
		lng: 49.5747,
		aliases: ["hofuf", "al hofuf", "hassa", "al ahsa", "al-ahsa", "ahsa", "الهفوف", "الأحساء", "الاحساء"]
	},
	{name: "Khafji", lat: 28.4395, lng: 48.4914, aliases: ["khafji", "الخفجي"]},
	{name: "Nairyah", lat: 27.4689, lng: 48.4836, aliases: ["nairyah", "nariya", "النعيرية"]},
	{name: "Udhailiyah", lat: 25.1356, lng: 49.3253, aliases: ["udhailiyah", "العضيلية"]},
	{name: "Riyadh", lat: 24.7136, lng: 46.6753, aliases: ["riyadh", "الرياض"]},
	{name: "Al Kharj", lat: 24.1483, lng: 47.3050, aliases: ["kharj", "al kharj", "الخرج"]},
	{name: "Jeddah", lat: 21.4858, lng: 39.1925, aliases: ["jeddah", "jiddah", "جدة", "جده"]},
	{name: "Makkah", lat: 21.3891, lng: 39.8579, aliases: ["makkah", "mecca", "مكة", "مكه"]},
	{name: "Madinah", lat: 24.5247, lng: 39.5692, aliases: ["madinah", "medina", "المدينة", "المدينه"]},
	{name: "Taif", lat: 21.2703, lng: 40.4158, aliases: ["taif", "الطائف"]},
	{name: "Yanbu", lat: 24.0895, lng: 38.0618, aliases: ["yanbu", "ينبع"]},
	{name: "Buraidah", lat: 26.3260, lng: 43.9750, aliases: ["buraidah", "buraydah", "بريدة"]},
	{
		name: "Hafr Al-Batin",
		lat: 28.4337,
		lng: 45.9601,
		aliases: ["hafr al-batin", "hafar al-batin", "hafr al batin", "حفر الباطن"]
	},
	{name: "Hail", lat: 27.5114, lng: 41.7208, aliases: ["hail", "ha'il", "حائل"]},
	{name: "Tabuk", lat: 28.3838, lng: 36.5550, aliases: ["tabuk", "تبوك"]},
	{name: "Abha", lat: 18.2164, lng: 42.5053, aliases: ["abha", "أبها", "ابها"]},
	{name: "Khamis Mushait", lat: 18.3060, lng: 42.7297, aliases: ["khamis mushait", "khamis mushayt", "خميس مشيط"]},
	{name: "Jizan", lat: 16.8892, lng: 42.5511, aliases: ["jizan", "jazan", "جازان", "جيزان"]},
	{name: "Najran", lat: 17.4924, lng: 44.1277, aliases: ["najran", "نجران"]},
	{name: "Arar", lat: 30.9753, lng: 41.0381, aliases: ["arar", "عرعر"]},
	{name: "Sakaka", lat: 29.9697, lng: 40.2064, aliases: ["sakaka", "سكاكا"]}
];

const CONFLICT_DISTANCE_KM = 20;

// Longest aliases first so "al khobar" wins over partial matches.
const CITY_ALIAS_INDEX = KSA_CITIES
	.flatMap(c => c.aliases.map(a => ({alias: a, city: c})))
	.sort((a, b) => b.alias.length - a.alias.length);

function normalizeText(s) {
	return (s || '').toLowerCase().replace(/[-_,/]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Returns the city object for an entry, or null if no known city found.
function detectCity(entry) {
	const haystack = ' ' + normalizeText((entry.area || '') + ' ' + (entry.location || '')) + ' ';
	for (const {alias, city} of CITY_ALIAS_INDEX) {
		const needle = normalizeText(alias);
		if (!needle) continue;
		// Word-boundary-ish match for latin aliases; plain substring for Arabic.
		if (/^[a-z' ]+$/.test(needle)) {
			if (haystack.includes(' ' + needle + ' ') || haystack.includes(' ' + needle)) {
				const re = new RegExp('(^|\\s)' + needle.replace(/'/g, "'?") + '(\\s|$)');
				if (re.test(haystack)) return city;
			}
		} else if (haystack.includes(needle)) {
			return city;
		}
	}
	return null;
}

function haversineKm(lat1, lng1, lat2, lng2) {
	const R = 6371;
	const toRad = d => d * Math.PI / 180;
	const dLat = toRad(lat2 - lat1);
	const dLng = toRad(lng2 - lng1);
	const a = Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Returns [{ technician, pairs: [{cityA, cityB, distanceKm}] }] for a date's entries.
function findTravelConflicts(entries) {
	const byTech = {};
	entries.forEach(e => {
		const t = (e.technicianName || '').trim();
		if (!t) return;
		const city = detectCity(e);
		if (!city) return;
		if (!byTech[t]) byTech[t] = new Map();
		byTech[t].set(city.name, city);
	});
	const conflicts = [];
	for (const tech in byTech) {
		const cities = [...byTech[tech].values()];
		const pairs = [];
		for (let i = 0; i < cities.length; i++) {
			for (let j = i + 1; j < cities.length; j++) {
				const d = haversineKm(cities[i].lat, cities[i].lng, cities[j].lat, cities[j].lng);
				if (d > CONFLICT_DISTANCE_KM) {
					pairs.push({cityA: cities[i].name, cityB: cities[j].name, distanceKm: Math.round(d)});
				}
			}
		}
		if (pairs.length) conflicts.push({technician: tech, pairs});
	}
	return conflicts;
}

/* ============ Helpers / storage ============ */
const STORAGE_KEY = "DammamTech_Final_v9";
const MAX_WORDS = 230;
let masterSchedule = {};
let editingState = null; // { date, idx } when editing, else null
let workloadMode = 'day'; // 'day' | 'all'

function countWords(text) {
	return text && text.trim() ? text.trim().split(/\s+/).length : 0;
}

function updateWordCounter() {
	const ta = document.getElementById('newReason');
	const span = document.getElementById('wordCount');
	const warn = document.getElementById('wordWarning');
	const w = countWords(ta.value);
	span.innerText = w;
	if (w > MAX_WORDS) {
		span.style.color = '#c44536';
		warn.innerText = '⚠️ EXCEEDS 230 WORDS!';
		ta.classList.add('error');
	} else if (w === MAX_WORDS) {
		span.style.color = '#e67e22';
		warn.innerText = '⚠️ Maximum reached';
		ta.classList.remove('error');
	} else {
		span.style.color = '#5dade2';
		warn.innerText = '';
		ta.classList.remove('error');
	}
}

// A valid KSA mobile is +966 followed by 9 digits starting with 5 (5XXXXXXXX).
function validateContactNumber(contact) {
	let c = contact.replace(/\s/g, '');
	if (!c.startsWith('+966')) return {valid: false, message: 'Contact must start with +966'};
	let after = c.substring(4);
	if (!/^\d+$/.test(after)) return {valid: false, message: 'Only digits are allowed after +966'};
	if (!after.startsWith('5')) return {valid: false, message: 'KSA mobile must start with 5 after +966'};
	if (after.length !== 9) return {valid: false, message: 'KSA mobile must be 9 digits after +966 (e.g. +966512345678)'};
	return {valid: true, cleaned: c};
}

function formatKSANumber(raw) {
	let c = raw.replace(/\s/g, '');
	if (c.startsWith('+966')) return c;
	if (c.startsWith('966')) return '+' + c;
	if (c.startsWith('0')) return '+966' + c.substring(1);
	if (c.startsWith('5')) return '+966' + c;
	return '+966' + c;
}

function getTodayDate() {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function escapeHtml(s) {
	return s ? String(s).replace(/[&<>"']/g, m => ({
		'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
	}[m])) : '';
}

function allEntries() {
	const out = [];
	for (const d in masterSchedule) out.push(...masterSchedule[d]);
	return out;
}

// Identity of an entry, used to skip exact duplicates when merging imports.
function entrySignature(e) {
	return [e.date, e.clientName, e.location, e.area, e.technicianName,
		e.requestNumber, e.contactNumber, e.technicalReason, e.time].join('|');
}

function loadFromStorage() {
	const saved = localStorage.getItem(STORAGE_KEY);
	if (saved) {
		try {
			masterSchedule = JSON.parse(saved);
		} catch (e) {
			masterSchedule = {};
		}
	}
	updateTotalStats();
}

function saveToStorage() {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(masterSchedule));
	updateTotalStats();
	populateLocationOptions();
}

function updateTotalStats() {
	let total = 0;
	for (const d in masterSchedule) total += masterSchedule[d].length;
	document.getElementById('totalAllTime').innerText = total;
}

/* ============ Date state ============ */
let currentDate = getTodayDate();
const datePicker = document.getElementById('datePicker');
if (datePicker) datePicker.value = currentDate;

function updateDateDisplay() {
	const span = document.getElementById('selectedDateDisplay');
	if (span) {
		const fmt = new Date(currentDate + 'T00:00:00').toLocaleDateString('en-GB', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
		span.innerHTML = `<i class="far fa-calendar-check"></i> ${fmt}`;
	}
}

/* ============ Workload panel ============ */
function renderWorkload() {
	const body = el('workloadBody');
	if (!body) return;
	const entries = workloadMode === 'day' ? (masterSchedule[currentDate] || []) : allEntries();
	if (!entries.length) {
		body.replaceChildren(makeEmpty('workload-empty',
			`No tasks ${workloadMode === 'day' ? 'for the selected date' : 'recorded yet'}.`));
		return;
	}
	const counts = {};
	entries.forEach(e => {
		const t = (e.technicianName || '').trim() || 'Unassigned';
		counts[t] = (counts[t] || 0) + 1;
	});
	const total = entries.length;
	const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
	const maxPct = (sorted[0][1] / total) * 100;

	const frag = document.createDocumentFragment();
	sorted.forEach(([tech, count]) => {
		const pct = (count / total) * 100;
		const barW = maxPct > 0 ? (pct / maxPct) * 100 : 0;
		const overloaded = pct >= 40 && sorted.length > 2;
		const node = cloneTemplate('workloadItemTemplate');
		const nameEl = node.querySelector('[data-field="name"]');
		nameEl.title = tech;
		node.querySelector('[data-field="nameText"]').textContent = tech;
		const bar = node.querySelector('[data-field="bar"]');
		bar.style.width = barW.toFixed(1) + '%';
		if (overloaded) bar.classList.add('overloaded');
		node.querySelector('[data-field="pct"]').textContent = pct.toFixed(1) + '%';
		node.querySelector('[data-field="count"]').textContent = `${count} task${count !== 1 ? 's' : ''}`;
		frag.appendChild(node);
	});
	body.replaceChildren(frag);
}

/* ============ Conflict panel ============ */
function renderConflicts() {
	const panel = el('conflictPanel');
	const body = el('conflictBody');
	if (!panel || !body) return;
	const conflicts = findTravelConflicts(masterSchedule[currentDate] || []);
	if (!conflicts.length) {
		panel.classList.remove('visible');
		body.replaceChildren();
		return {conflicts, techsInConflict: new Set()};
	}
	const frag = document.createDocumentFragment();
	conflicts.forEach(c => c.pairs.forEach(p => {
		const node = cloneTemplate('conflictItemTemplate');
		node.querySelector('[data-field="tech"]').textContent = c.technician;
		node.querySelector('[data-field="cityA"]').textContent = p.cityA;
		node.querySelector('[data-field="cityB"]').textContent = p.cityB;
		node.querySelector('[data-field="distance"]').textContent = p.distanceKm;
		frag.appendChild(node);
	}));
	body.replaceChildren(frag);
	panel.classList.add('visible');
	return {conflicts, techsInConflict: new Set(conflicts.map(c => c.technician))};
}

/* ============ Table rendering ============ */
function renderCurrentDate() {
	const entries = masterSchedule[currentDate] || [];
	const tbody = el('scheduleTableBody');
	if (!tbody) return;

	const {techsInConflict} = renderConflicts();
	renderWorkload();
	updateStatsDay(entries);

	if (entries.length === 0) {
		const tr = document.createElement('tr');
		tr.className = 'empty-row';
		const td = document.createElement('td');
		td.colSpan = 10;
		td.textContent = 'No tasks scheduled for this date. Use the form above to add entries.';
		tr.appendChild(td);
		tbody.replaceChildren(tr);
		return;
	}

	const frag = document.createDocumentFragment();
	entries.forEach((e, idx) => {
		const inConflict = techsInConflict.has((e.technicianName || '').trim());
		const row = cloneTemplate('rowTemplate');
		if (inConflict) row.classList.add('conflict-row');

		row.querySelector('[data-field="date"]').textContent = e.date;
		row.querySelector('[data-field="client"]').textContent = e.clientName;
		const locLink = row.querySelector('[data-field="locationLink"]');
		locLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.location)}`;
		row.querySelector('[data-field="location"]').textContent = e.location;
		row.querySelector('[data-field="area"]').textContent = e.area || '-';
		row.querySelector('[data-field="tech"]').textContent = e.technicianName;
		row.querySelector('[data-field="conflictFlag"]').hidden = !inConflict;
		row.querySelector('[data-field="req"]').textContent = e.requestNumber;
		const contact = row.querySelector('[data-field="contactLink"]');
		contact.href = 'tel:' + (e.contactNumber || '').replace(/\s/g, '');
		contact.textContent = e.contactNumber;
		const reason = row.querySelector('[data-field="reason"]');
		reason.textContent = e.technicalReason || '-';
		reason.title = e.technicalReason || '-';
		row.querySelector('[data-field="time"]').textContent = e.time || '-';

		const editBtn = row.querySelector('[data-field="edit"]');
		const delBtn = row.querySelector('[data-field="delete"]');
		editBtn.dataset.idx = idx;
		delBtn.dataset.idx = idx;
		editBtn.setAttribute('aria-label', `Edit task for ${e.clientName}`);
		delBtn.setAttribute('aria-label', `Delete task for ${e.clientName}`);

		frag.appendChild(row);
	});
	tbody.replaceChildren(frag);
	// Row actions are handled via event delegation set up once (setupTableDelegation).
}

function handleDeleteEntry(idx) {
	showConfirm('warning', 'Delete Entry?',
		'This task will be permanently removed from the selected date. This cannot be undone.',
		[
			{label: 'Cancel', value: false, variant: 'secondary'},
			{label: 'Delete', value: true, icon: '<i class="fas fa-trash-alt"></i>'}
		],
		(confirmed) => {
			if (!confirmed) return;
			const arr = masterSchedule[currentDate] || [];
			arr.splice(idx, 1);
			if (arr.length === 0) delete masterSchedule[currentDate]; else masterSchedule[currentDate] = arr;
			if (editingState && editingState.date === currentDate) cancelEdit(); // avoid stale index
			saveToStorage();
			renderCurrentDate();
			showModal('success', 'Deleted', 'Entry has been removed successfully.');
		});
}

// One-time delegated handler for edit/delete icons in the table body.
function setupTableDelegation() {
	const tbody = el('scheduleTableBody');
	if (!tbody) return;
	const activate = (target) => {
		const editEl = target.closest('.edit-task');
		if (editEl) {
			startEditEntry(currentDate, parseInt(editEl.dataset.idx));
			return;
		}
		const delEl = target.closest('.delete-task');
		if (delEl) handleDeleteEntry(parseInt(delEl.dataset.idx));
	};
	tbody.addEventListener('click', (ev) => activate(ev.target));
	tbody.addEventListener('keydown', (ev) => {
		if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.closest('[role="button"]')) {
			ev.preventDefault();
			activate(ev.target);
		}
	});
}

function updateStatsDay(entries) {
	document.getElementById('totalJobsDay').innerText = entries.length;
	const techSet = new Set(entries.map(e => e.technicianName?.trim()).filter(Boolean));
	const clientSet = new Set(entries.map(e => e.clientName?.trim()).filter(Boolean));
	document.getElementById('uniqueTechsDay').innerText = techSet.size;
	document.getElementById('uniqueClientsDay').innerText = clientSet.size;
}

/* ============ Form: add / edit ============ */
function readForm() {
	return {
		client: document.getElementById('newClient').value.trim(),
		location: document.getElementById('newLoc').value.trim(),
		area: document.getElementById('newArea').value.trim(),
		tech: document.getElementById('newTech').value,
		req: document.getElementById('newReq').value.trim(),
		contactRaw: document.getElementById('newContact').value.trim(),
		reason: document.getElementById('newReason').value.trim(),
		time: document.getElementById('newTime').value
	};
}

function resetForm() {
	document.getElementById('newClient').value = '';
	document.getElementById('newLoc').value = '';
	document.getElementById('newArea').value = '';
	document.getElementById('newTech').value = '';
	document.getElementById('newReq').value = '';
	document.getElementById('newContact').value = '+966';
	document.getElementById('newReason').value = '';
	document.getElementById('newTime').value = '09:00';
	updateWordCounter();
}

function validateForm(f) {
	const errors = [];
	if (!f.client) errors.push("Client required");
	if (!f.location) errors.push("Location required");
	if (!f.tech) errors.push("Technician required");
	if (!f.req) errors.push("Request # required");
	if (!f.time) errors.push("Time required");
	const cv = validateContactNumber(f.contactRaw);
	if (!cv.valid) errors.push(cv.message);
	if (countWords(f.reason) > MAX_WORDS) errors.push(`Reason > ${MAX_WORDS} words`);
	if (f.tech && !TECHNICIANS_LIST.includes(f.tech)) errors.push("Invalid technician");
	return {errors, cv};
}

// Pre-save check: would this entry create a >20km same-day travel conflict?
function predictConflictMessage(date, candidate, ignoreIdx) {
	const entries = (masterSchedule[date] || []).filter((_, i) => i !== ignoreIdx);
	const before = findTravelConflicts(entries);
	const after = findTravelConflicts([...entries, candidate]);
	const beforeKeys = new Set(before.flatMap(c => c.pairs.map(p => `${c.technician}|${p.cityA}|${p.cityB}`)));
	const fresh = [];
	after.forEach(c => c.pairs.forEach(p => {
		if (!beforeKeys.has(`${c.technician}|${p.cityA}|${p.cityB}`)) {
			fresh.push(`${c.technician}: ${p.cityA} ↔ ${p.cityB} (~${p.distanceKm} km apart)`);
		}
	}));
	return fresh.length
		? `This assignment puts the technician in two cities over ${CONFLICT_DISTANCE_KM} km apart on the same day:\n\n• ${fresh.join('\n• ')}\n\nThe entry was saved, but it is flagged in the schedule. Consider reassigning it to a different technician or date.`
		: null;
}

function startEditEntry(date, idx) {
	const e = (masterSchedule[date] || [])[idx];
	if (!e) return;
	editingState = {date, idx};
	document.getElementById('newClient').value = e.clientName || '';
	document.getElementById('newLoc').value = e.location || '';
	// '-' check tolerates entries saved by older versions that stored the placeholder.
	document.getElementById('newArea').value = e.area === '-' ? '' : (e.area || '');
	document.getElementById('newTech').value = TECHNICIANS_LIST.includes(e.technicianName) ? e.technicianName : '';
	document.getElementById('newReq').value = e.requestNumber || '';
	document.getElementById('newContact').value = e.contactNumber || '+966';
	document.getElementById('newReason').value = e.technicalReason === '-' ? '' : (e.technicalReason || '');
	document.getElementById('newTime').value = e.time && /^\d{2}:\d{2}$/.test(e.time) ? e.time : '09:00';
	updateWordCounter();
	document.getElementById('formHeaderText').innerText = 'EDIT SCHEDULE ENTRY';
	document.getElementById('formHeaderIcon').className = 'fas fa-pen';
	document.getElementById('addBtnText').innerText = 'UPDATE ENTRY';
	document.getElementById('editingBadge').classList.add('visible');
	document.getElementById('cancelEditBtn').classList.add('visible');
	document.querySelector('.form-card').scrollIntoView({behavior: 'smooth', block: 'start'});
}

function cancelEdit() {
	editingState = null;
	resetForm();
	document.getElementById('formHeaderText').innerText = 'ADD NEW SCHEDULE ENTRY';
	document.getElementById('formHeaderIcon').className = 'fas fa-plus-circle';
	document.getElementById('addBtnText').innerText = 'ADD TO SELECTED DATE';
	document.getElementById('editingBadge').classList.remove('visible');
	document.getElementById('cancelEditBtn').classList.remove('visible');
}

function submitForm() {
	const f = readForm();
	const {errors, cv} = validateForm(f);
	if (errors.length) {
		showModal('error', 'Validation Error', '• ' + errors.join('\n• '));
		return;
	}

	const formattedContact = cv.cleaned || formatKSANumber(f.contactRaw);
	const isEdit = !!editingState;
	const targetDate = isEdit ? editingState.date : currentDate;
	const entry = {
		date: targetDate, clientName: f.client, location: f.location, area: f.area,
		technicianName: f.tech, requestNumber: f.req, contactNumber: formattedContact,
		technicalReason: f.reason, time: f.time
	};

	const conflictMsg = predictConflictMessage(targetDate, entry, isEdit ? editingState.idx : -1);

	if (isEdit) {
		masterSchedule[targetDate][editingState.idx] = entry;
		cancelEdit();
		saveToStorage();
		renderCurrentDate();
		if (conflictMsg) showModal('warning', 'Updated — Travel Conflict', conflictMsg);
		else showModal('success', 'Updated', 'Entry has been updated successfully!');
	} else {
		const entries = masterSchedule[targetDate] || [];
		entries.push(entry);
		masterSchedule[targetDate] = entries;
		resetForm();
		saveToStorage();
		renderCurrentDate();
		if (conflictMsg) showModal('warning', 'Added — Travel Conflict', conflictMsg);
		else showModal('success', 'Added!', `Task successfully added to ${targetDate}`);
	}
}

/* ============ Clear / export / restore ============ */
function clearAllHistory() {
	const totalEntries = Object.keys(masterSchedule).reduce((sum, date) => sum + masterSchedule[date].length, 0);
	const totalDates = Object.keys(masterSchedule).length;
	if (totalEntries === 0) {
		showModal('warning', 'Nothing to Clear', 'Schedule is already empty.');
		return;
	}
	showConfirm('error', 'Clear All History?',
		`This will permanently delete ${totalEntries} task(s) across ${totalDates} date(s). This action cannot be undone.`,
		[
			{label: 'Cancel', value: false, variant: 'secondary'},
			{label: 'Delete Everything', value: true, icon: '<i class="fas fa-trash-alt"></i>'}
		],
		(confirmed) => {
			if (!confirmed) return;
			masterSchedule = {};
			cancelEdit();
			saveToStorage();
			renderCurrentDate();
			showModal('success', 'History Cleared', `Successfully removed ${totalEntries} task(s) from ${totalDates} date(s).`);
		});
}

async function exportToExcel() {
	const dates = Object.keys(masterSchedule).sort();
	if (!dates.length) {
		showModal('warning', 'No Data', 'Nothing to export. Add some tasks first.');
		return;
	}
	try {
		await ensureXLSX();
	} catch (err) {
		showModal('error', 'Library Error', 'Could not load the Excel engine. Check your connection and try again.');
		return;
	}
	const wb = XLSX.utils.book_new();
	for (const date of dates) {
		const data = [["Date", "Client", "Location", "Area", "Technician", "Request #", "Contact", "Tech Reason", "Time"]];
		masterSchedule[date].forEach(e => data.push([e.date, e.clientName, e.location, e.area, e.technicianName, e.requestNumber, e.contactNumber, e.technicalReason, e.time]));
		const ws = XLSX.utils.aoa_to_sheet(data);
		ws['!cols'] = [{wch: 14}, {wch: 25}, {wch: 35}, {wch: 18}, {wch: 22}, {wch: 16}, {wch: 22}, {wch: 35}, {wch: 12}];
		XLSX.utils.book_append_sheet(wb, ws, date.substring(0, 10));
	}
	XLSX.writeFile(wb, `Dammam_Schedule_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`);
	showModal('success', 'Export Complete', 'Excel file has been downloaded successfully.');
}

async function exportToPDF() {
	const dates = Object.keys(masterSchedule).sort();
	if (!dates.length) {
		showModal('warning', 'No Data', 'Nothing to export. Add some tasks first.');
		return;
	}
	try {
		await ensurePDF();
	} catch (err) {
		showModal('error', 'Library Error', 'Could not load the PDF engine. Check your connection and try again.');
		return;
	}
	const {jsPDF} = window.jspdf;
	const doc = new jsPDF({orientation: 'landscape', unit: 'mm', format: 'a4'});
	doc.setFontSize(16);
	doc.setTextColor(26, 82, 118);
	doc.text("DAMMAM TECH SCHEDULE - KSA", 14, 20);
	doc.setFontSize(9);
	doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
	let y = 38;
	for (const date of dates) {
		const entries = masterSchedule[date];
		if (!entries.length) continue;
		if (y > 170) {
			doc.addPage();
			y = 20;
		}
		doc.setFontSize(10);
		doc.setTextColor(44, 125, 160);
		doc.text(`${date}`, 14, y);
		y += 5;

		// Flag travel conflicts in the PDF too
		const conflicts = findTravelConflicts(entries);
		if (conflicts.length) {
			doc.setFontSize(8);
			doc.setTextColor(196, 69, 54);
			conflicts.forEach(c => c.pairs.forEach(p => {
				doc.text(`! Travel conflict: ${c.technician} — ${p.cityA} <-> ${p.cityB} (~${p.distanceKm} km)`, 14, y);
				y += 4;
			}));
			doc.setTextColor(44, 125, 160);
			y += 1;
		}

		const headers = [["Client", "Location", "Area", "Technician", "Request", "Contact", "Tech Reason", "Time"]];
		const rows = entries.map(e => [e.clientName, e.location, e.area, e.technicianName, e.requestNumber, e.contactNumber, e.technicalReason, e.time]);
		const res = doc.autoTable({
			head: headers, body: rows, startY: y, theme: 'striped',
			headStyles: {fillColor: [46, 134, 193], textColor: 255, fontSize: 8},
			styles: {fontSize: 7, cellPadding: 2},
			margin: {left: 10, right: 10},
			columnStyles: {
				0: {cellWidth: 28},
				1: {cellWidth: 35},
				2: {cellWidth: 22},
				3: {cellWidth: 25},
				4: {cellWidth: 22},
				5: {cellWidth: 28},
				6: {cellWidth: 38},
				7: {cellWidth: 18}
			}
		});
		y = res.lastAutoTable.finalY + 6;
	}
	doc.save(`Dammam_Schedule_${new Date().toISOString().slice(0, 10)}.pdf`);
	showModal('success', 'Export Complete', 'PDF file has been downloaded successfully.');
}

function restoreFromExcel() {
	const inp = document.createElement('input');
	inp.type = 'file';
	inp.accept = '.xlsx, .xls';
	inp.onchange = e => {
		const file = e.target.files[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = async ev => {
			try {
				await ensureXLSX();
				const data = new Uint8Array(ev.target.result);
				const wb = XLSX.read(data, {type: 'array'});
				const newSch = {};
				let skipped = 0;
				for (const sheet of wb.SheetNames) {
					const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], {header: 1, defval: ""});
					if (rows.length < 2) continue;
					for (let i = 1; i < rows.length; i++) {
						const r = rows[i];
						if (!r[0] && !r[1]) continue;
						const dt = String(r[0] || "").trim();
						if (!dt.match(/^\d{4}-\d{2}-\d{2}/)) {
							skipped++;
							continue;
						}
						const cl = String(r[1] || "").trim(), loc = String(r[2] || "").trim(),
							area = String(r[3] || "").trim(),
							tech = String(r[4] || "").trim(), reqNum = String(r[5] || "").trim(),
							cont = String(r[6] || "").trim(),
							reas = String(r[7] || "").trim(), tm = String(r[8] || "").trim();
						if (cl && loc && tech && reqNum && cont && TECHNICIANS_LIST.includes(tech)) {
							if (!newSch[dt]) newSch[dt] = [];
							newSch[dt].push({
								date: dt,
								clientName: cl,
								location: loc,
								area: area,
								technicianName: tech,
								requestNumber: reqNum,
								contactNumber: formatKSANumber(cont),
								technicalReason: reas,
								time: tm
							});
						} else {
							skipped++;
						}
					}
				}
				if (Object.keys(newSch).length === 0) {
					showModal('error', 'Restore Failed', 'No valid data found in the file.');
					return;
				}

				const importedDates = Object.keys(newSch).length;
				const importedTasks = Object.values(newSch).reduce((s, arr) => s + arr.length, 0);
				const skipNote = skipped ? `\n${skipped} row(s) were skipped (invalid date, missing fields, or unknown technician).` : '';
				const existingTasks = allEntries().length;

				const applyReplace = () => {
					masterSchedule = newSch;
					finishRestore(`Replaced all data with ${importedTasks} task(s) across ${importedDates} date(s).` + skipNote);
				};
				const applyMerge = () => {
					let added = 0;
					for (const dt in newSch) {
						const existing = masterSchedule[dt] || [];
						const seen = new Set(existing.map(entrySignature));
						newSch[dt].forEach(entry => {
							if (seen.has(entrySignature(entry))) return; // skip exact duplicates
							seen.add(entrySignature(entry));
							existing.push(entry);
							added++;
						});
						masterSchedule[dt] = existing;
					}
					finishRestore(`Merged ${added} new task(s) into your schedule (duplicates skipped).` + skipNote);
				};
				const finishRestore = (msg) => {
					cancelEdit();
					saveToStorage();
					renderCurrentDate();
					showModal('success', 'Restore Complete', msg);
				};

				if (existingTasks === 0) {
					applyReplace(); // nothing to merge with
					return;
				}

				showConfirm('warning', 'Restore from Excel',
					`The file contains ${importedTasks} task(s) across ${importedDates} date(s). ` +
					`You currently have ${existingTasks} task(s) saved.\n\n` +
					`• Replace All — erase current data and keep only the imported file.\n` +
					`• Merge — add the imported tasks to your existing data (duplicates skipped).`,
					[
						{label: 'Cancel', value: 'cancel', variant: 'secondary'},
						{label: 'Merge', value: 'merge', icon: '<i class="fas fa-code-branch"></i>'},
						{label: 'Replace All', value: 'replace', icon: '<i class="fas fa-exclamation-triangle"></i>'}
					],
					(choice) => {
						if (choice === 'replace') applyReplace();
						else if (choice === 'merge') applyMerge();
						// 'cancel' / dismiss → leave data untouched
					});
			} catch (err) {
				showModal('error', 'Restore Failed', 'The file could not be read. Make sure it is a valid Excel backup.');
			}
		};
		reader.readAsArrayBuffer(file);
	};
	inp.click();
}

/* ============ Time picker ============ */
function setupTimePicker() {
	const timeInput = document.getElementById('newTime'),
		up = document.getElementById('timeUpBtn'),
		down = document.getElementById('timeDownBtn');
	if (!timeInput) return;
	const shift = (mins) => {
		let [h, m] = (timeInput.value || '09:00').split(':').map(Number);
		let total = ((h * 60 + m + mins) % 1440 + 1440) % 1440;
		timeInput.value = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
	};
	up?.addEventListener('click', () => shift(15));
	down?.addEventListener('click', () => shift(-15));
}

/* ============ Wire up ============ */
setTimeout(() => {
	const splash = document.getElementById('splashScreen');
	const main = document.getElementById('mainContent');
	if (splash && main) {
		splash.style.opacity = '0';
		setTimeout(() => {
			splash.style.display = 'none';
			main.classList.add('visible');
		}, 800);
	}
}, 2000);

datePicker?.addEventListener('change', (e) => {
	currentDate = e.target.value;
	if (editingState) cancelEdit();
	updateDateDisplay();
	renderCurrentDate();
});
document.getElementById('clearAllBtn')?.addEventListener('click', clearAllHistory);
document.getElementById('scheduleForm')?.addEventListener('submit', (e) => {
	e.preventDefault();
	submitForm();
});
document.getElementById('cancelEditBtn')?.addEventListener('click', cancelEdit);
document.getElementById('exportExcelBtn')?.addEventListener('click', exportToExcel);
document.getElementById('exportPdfBtn')?.addEventListener('click', exportToPDF);
document.getElementById('excelBackupBtn')?.addEventListener('click', exportToExcel);
document.getElementById('excelRestoreBtn')?.addEventListener('click', restoreFromExcel);
document.getElementById('newReason')?.addEventListener('input', updateWordCounter);

// Keep the +966 prefix locked and allow only the 9 digits after it.
function enforceKSAContactInput(input) {
	let digits = input.value.replace(/\D/g, '');
	if (digits.startsWith('966')) digits = digits.slice(3);
	digits = digits.slice(0, 9);
	input.value = '+966' + digits;
}

const contactEl = document.getElementById('newContact');
contactEl?.addEventListener('input', function () {
	enforceKSAContactInput(this);
	const v = validateContactNumber(this.value);
	this.classList.toggle('error', !v.valid && this.value.length > 4);
});
contactEl?.addEventListener('keydown', function (e) {
	// Block deleting into the +966 prefix.
	const start = this.selectionStart;
	if ((e.key === 'Backspace' && start <= 4) || (e.key === 'Delete' && start < 4)) {
		e.preventDefault();
	}
});
contactEl?.addEventListener('focus', function () {
	if (!this.value) this.value = '+966';
});
contactEl?.addEventListener('blur', function () {
	const v = validateContactNumber(this.value);
	this.classList.toggle('error', !v.valid);
});
document.getElementById('workloadDayBtn')?.addEventListener('click', function () {
	workloadMode = 'day';
	this.classList.add('active');
	document.getElementById('workloadAllBtn').classList.remove('active');
	renderWorkload();
});
document.getElementById('workloadAllBtn')?.addEventListener('click', function () {
	workloadMode = 'all';
	this.classList.add('active');
	document.getElementById('workloadDayBtn').classList.remove('active');
	renderWorkload();
});

setupTimePicker();
setupTableDelegation();
populateTechnicianDropdown();
loadFromStorage();
populateLocationOptions();
updateDateDisplay();
renderCurrentDate();
updateWordCounter();
