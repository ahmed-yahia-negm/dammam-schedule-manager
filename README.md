<div align="center">

# 📅 DAMMAM TECH — KSA Schedule Manager

### Complete schedule management system for field technicians across Saudi Arabia

A fast, offline-first, single-page dashboard for planning technician visits, catching
same-day travel conflicts, and exporting clean schedules to Excel or PDF.

![Status](https://img.shields.io/badge/status-active-2e86c1)
![Vanilla JS](https://img.shields.io/badge/built%20with-vanilla%20JS-f7df1e)
![No Build Step](https://img.shields.io/badge/build-none-5dade2)
![Storage](https://img.shields.io/badge/data-localStorage-27ae60)

</div>

---

## ✨ Features

- **Per-date scheduling** — pick any date and manage that day's technician visits independently.
- **Travel-conflict detection** — flags when the same technician is booked in two KSA cities
  more than **20 km apart** on the same day, using real city coordinates and a haversine
  distance check. Conflicts are surfaced live in the UI, in exports, and at save time.
- **Technician workload** — live bar-chart breakdown of task distribution (selected date or
  all-time), with an overload highlight.
- **Smart inputs**
  - **Location & Area** are type-to-filter comboboxes backed by a known list of KSA cities
    (plus any districts you've already used).
  - **Contact** is a strict **KSA mobile** field (`+966` locked, digits-only, must be a
    9-digit number starting with `5`).
  - **Technical reason** with a 230-word live counter.
- **Excel & PDF export** — one sheet per date in Excel; a paginated, conflict-annotated PDF.
- **Backup & restore** — export your whole dataset to Excel and re-import it later, with a
  **Replace All / Merge** choice on restore (duplicates are skipped on merge).
- **Offline-first** — everything is stored in the browser via `localStorage`; no server,
  no account, no network required after first load.
- **Accessible & polished** — semantic landmarks, associated labels, keyboard-operable
  controls, and a native `<dialog>` modal with focus trapping and `Esc` support.

---

## 🚀 Getting started

No build tools, no dependencies to install — it's a static site.

```bash
# 1. Clone
git clone <repo-url>
cd dammam-schedule-manager

# 2. Serve it (any static server works). For example:
python3 -m http.server 8000
```

Then open **http://localhost:8000/index.html**.

> Opening `index.html` directly via `file://` works too, but a local server is recommended
> so the Excel/PDF libraries (loaded on demand from a CDN) and fonts resolve cleanly.

---

## 🧭 How to use

1. **Pick a date** at the top of the dashboard.
2. **Add an entry** in the form — client, location, area, technician, request #, KSA contact,
   technical reason, and time. Required fields are marked with `*`.
3. Watch the **Travel Conflicts** panel and the **Technician Workload** chart update live.
4. **Edit** or **delete** any row from the table (keyboard-friendly).
5. **Export** the schedule to Excel/PDF, or **Backup/Restore** your full dataset.

---

## 🗺️ Travel-conflict engine

Each entry's **Location** and **Area** text is matched (case-insensitive, English + Arabic
aliases) against a built-in table of ~30 Saudi cities with latitude/longitude. For every
technician on a given date, all detected cities are compared pairwise with the
**haversine formula**; any pair farther apart than the threshold is reported as a conflict.

```
CONFLICT_DISTANCE_KM = 20   // tweak in assets/js/main.js
```

Covered regions include the Eastern Province (Dammam, Dhahran, Al Khobar, Qatif, Jubail,
Hofuf…), Riyadh, Makkah/Madinah/Jeddah, Asir, the Northern Borders, and more.

---

## 🏗️ Tech & architecture

| Area              | Choice                                                            |
| ----------------- | ---------------------------------------------------------------- |
| Language          | Vanilla **HTML / CSS / JavaScript** — zero framework, zero build |
| Rendering         | HTML `<template>` cloning + `DocumentFragment` (no innerHTML churn) |
| State / storage   | In-memory `masterSchedule` mirrored to `localStorage`            |
| Excel             | [SheetJS](https://sheetjs.com) (`xlsx`) — lazy-loaded on demand  |
| PDF               | [jsPDF](https://github.com/parallax/jsPDF) + AutoTable — lazy-loaded |
| Icons / fonts     | Font Awesome (self-hosted) + Inter / Poppins (Google Fonts, async) |

**Performance notes:** the heavy export libraries are only fetched the first time you
export or restore; Font Awesome and Google Fonts load without blocking first paint; and the
table renders through cached DOM references with delegated event handling.

```
dammam-schedule-manager/
├── index.html            # markup + <template> definitions
├── assets/
│   ├── css/
│   │   ├── main.css      # all custom styling
│   │   └── all.min.css   # Font Awesome (vendor)
│   ├── js/
│   │   └── main.js       # all application logic
│   └── webfonts/         # Font Awesome fonts (vendor)
└── README.md
```

> Only `main.css` and `main.js` contain project code — the other `assets/` files are
> vendored Font Awesome and should not be edited.

---

## 💾 Data & privacy

All schedule data lives **only in your browser** under the `localStorage` key
`DammamTech_Final_v9`. Nothing is uploaded anywhere. Clearing your browser data — or using
the **Clear All History** button — permanently removes it, so export a backup first if you
want to keep it.
