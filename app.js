'use strict';

const STORE = 'flexiTracker-v1.0.1';
const $ = (id) => document.getElementById(id);

const now = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const pad = (n) => String(n).padStart(2, '0');

const defaults = () => ({
    version: 1,
    settings: {
        trackingStart: now(),
        initialBalance: 0,
        start: '07:00',
        end: '15:00',
        breakMinutes: 30,
        targetMinutes: 450,
        cutoff: '15:00'
    },
    entries: {}
});


let state;
try {
    state = JSON.parse(localStorage.getItem(STORE)) || defaults();
} catch {
    state = defaults();
}
if (!state.settings || !state.entries) state = defaults();
if (!state.drafts || typeof state.drafts !== 'object') state.drafts = {};

let cursor = new Date();
let calendarMode = 'month';

const persist = () => localStorage.setItem(STORE, JSON.stringify(state));
const dateUTC = (s) => new Date(`${s}T12:00:00Z`);
const key = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

const addDays = (s, n) => {
    const d = dateUTC(s);
    d.setUTCDate(d.getUTCDate() + n);
    return key(d);
};

const weekday = (s) => dateUTC(s).getUTCDay();

function easter(y) {
    const a = y % 19;
    const b = Math.floor(y / 100);
    const c = y % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k + 7) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const n = h + l - 7 * m + 114;
    return `${y}-${pad(Math.floor(n / 31))}-${pad(n % 31 + 1)}`;
}

function holiday(s) {
    const fixed = {
        '01-01': 'New Year’s Day',
        '05-01': 'Labour Day',
        '05-17': 'Constitution Day',
        '12-25': 'Christmas Day',
        '12-26': 'Boxing Day'
    };

    if (fixed[s.slice(5)]) return fixed[s.slice(5)];

    const e = easter(Number(s.slice(0, 4)));

    for (const [offset, label] of [
        [-3, 'Maundy Thursday'],
        [-2, 'Good Friday'],
        [0, 'Easter Sunday'],
        [1, 'Easter Monday'],
        [39, 'Ascension Day'],
        [49, 'Whit Sunday'],
        [50, 'Whit Monday']
    ]) {
        if (s === addDays(e, offset)) return label;
    }

    return '';
}

const nonwork = (s) => weekday(s) === 0 || weekday(s) === 6 || !!holiday(s);

function normalizeTime(value) {
    const text = String(value ?? '').trim();
    let hour, minute;
    if (/^\d{1,2}:\d{1,2}$/.test(text)) {
        [hour, minute] = text.split(':').map(Number);
    } else if (/^\d{1,4}$/.test(text)) {
        if (text.length <= 2) {
            hour = Number(text);
            minute = 0;
        } else {
            hour = Number(text.slice(0, -2));
            minute = Number(text.slice(-2));
        }
    } else {
        return null;
    }
    return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
        ? `${pad(hour)}:${pad(minute)}` : null;
}

const parseTime = (s) => {
    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s || '');
    return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};

const worked = (e) => parseTime(e.end) - parseTime(e.start) - Number(e.breakMinutes);
const expected = (s) => (nonwork(s) ? 0 : Number(state.settings.targetMinutes));

function delta(s, e) {
    if (!e) return -expected(s);
    if (e.type === 'work') return worked(e) - expected(s);
    if (e.type === 'flex') return -expected(s);
    return 0;
}

const eligible = (s) =>
    s >= state.settings.trackingStart &&
    (s < now() || (s === now() && new Date().getHours() * 60 + new Date().getMinutes() >= parseTime(state.settings.cutoff)));

function balance() {
    let sum = Number(state.settings.initialBalance);
    let s = state.settings.trackingStart;
    const t = now();

    if (s > t) return sum;

    for (let count = 0; s <= t && count < 36525; s = addDays(s, 1), count++) {
        if (!eligible(s) && !(s === now() && state.entries[s])) continue;
        sum += delta(s, state.entries[s]);
    }

    return sum;
}

const fmt = (n) => `${n < 0 ? '−' : '+'}${Math.floor(Math.abs(n) / 60)}h ${pad(Math.abs(n) % 60)}m`;

const notify = (s) => {
    $('toast').textContent = s;
    setTimeout(() => {
        if ($('toast').textContent === s) $('toast').textContent = '';
    }, 3500);
};

function showTab(name) {
    document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.page').forEach((p) => p.classList.toggle('hidden', p.id !== name));

    if (name === 'calendar') renderCalendar();
    if (name === 'settings') fillSettings();
    if (name === 'bulk') renderBulkPreview();
}

function renderBalance() {
    const n = balance();
    $('balance').textContent = fmt(n);
    document.querySelector('.balance').classList.toggle('negative', n < 0);
    $('balance-label').textContent = `Since ${formatDate(state.settings.trackingStart)}`;
}

function openDay(s) {
    $('day-date').value = s;
    const e = state.entries[s];
    $('day-type').value = e?.type || 'work';
    const draft = state.drafts[s];
    $('day-start').value = e?.start || draft?.start || state.settings.start;
    $('day-end').value = e?.end || (draft ? '' : state.settings.end);
    $('day-break').value = e?.breakMinutes ?? state.settings.breakMinutes;
    renderDay();
    showTab('entry');
}

function renderDay() {
    const s = $('day-date').value;
    const e = state.entries[s];
    const type = $('day-type').value;

    $('work-fields').classList.toggle('hidden', type !== 'work');
    $('delete-day').classList.toggle('hidden', !e);
    const draft = state.drafts[s];
    $('save-arrival').classList.toggle('hidden', type !== 'work' || !!e);
    $('arrival-status').textContent = !e && draft
        ? `Arrival saved for ${formatDate(s)} at ${draft.start}. Finish this day when you leave.`
        : '';

    const minutes =
        parseTime(normalizeTime($('day-end').value)) -
        parseTime(normalizeTime($('day-start').value)) -
        Number($('day-break').value);

    $('work-summary').textContent =
        Number.isFinite(minutes) && minutes >= 0
            ? `Worked: ${Math.floor(minutes / 60)}h ${pad(minutes % 60)}m · Flex: ${fmt(minutes - expected(s))}`
            : 'Enter valid start, end and break';

    $('day-note').textContent =
        holiday(s) ||
        (weekday(s) === 0 || weekday(s) === 6
            ? 'Weekend: no required hours'
            : type === 'flex'
                ? 'Flex day off uses your normal required hours.'
                : '');
}

const localDateString = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function visibleDates() {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();

    if (calendarMode === 'month') {
        const first = `${y}-${pad(m + 1)}-01`;
        const last = `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}`;
        return {
            first,
            last,
            gridStart: addDays(first, -((weekday(first) + 6) % 7)),
            gridEnd: addDays(last, (7 - weekday(last)) % 7)
        };
    }

    const current = localDateString(cursor);
    const first = addDays(current, -((weekday(current) + 6) % 7));
    return {
        first,
        last: addDays(first, 6),
        gridStart: first,
        gridEnd: addDays(first, 6)
    };
}

function renderCalendar() {
    renderBalance();

    const v = visibleDates();
    $('period-label').textContent =
        calendarMode === 'month'
            ? cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
            : `${v.first} – ${v.last}`;

    document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === calendarMode));

    const grid = $('calendar-grid');
    grid.replaceChildren();

    for (const w of ['M', 'T', 'W', 'T', 'F', 'S', 'S']) {
        const el = document.createElement('span');
        el.className = 'weekday';
        el.textContent = w;
        grid.append(el);
    }

    for (let s = v.gridStart; s <= v.gridEnd; s = addDays(s, 1)) {
        const el = document.createElement('button');
        el.className = 'date';
        const outside = calendarMode === 'month' && s.slice(0, 7) !== v.first.slice(0, 7);

        if (outside) {
            el.classList.add('empty');
        } else {
            const e = state.entries[s];
            if (e) el.classList.add(e.type === 'work' ? 'logged' : 'leave');
            else if (state.drafts[s]) el.classList.add('draft');
            else if (holiday(s)) el.classList.add('holiday');
            else if (nonwork(s)) el.classList.add('weekend');
            else if (eligible(s)) el.classList.add('missing');

            if (s === now()) el.classList.add('today');

            el.innerHTML = `<span>${Number(s.slice(-2))}</span><i class="dot ${e ? (e.type === 'work' ? 'logged' : 'leave') : holiday(s) ? 'holiday' : eligible(s) && !nonwork(s) ? 'missing' : ''}"></i>`;
            el.title = e?.type || (state.drafts[s] ? 'Arrival saved (unfinished)' : '') || holiday(s) || (eligible(s) && !nonwork(s) ? 'Unlogged' : '');
            el.onclick = () => openDay(s);
        }

        grid.append(el);
    }

    const list = $('entry-list');
    list.replaceChildren();

    let found = 0;
    for (let s = v.last; s >= v.first; s = addDays(s, -1)) {
        const e = state.entries[s];
        const miss = !e && eligible(s) && !nonwork(s);

        if (!e && !miss && !state.drafts[s]) continue;

        found++;
        const row = document.createElement('div');
        row.className = 'list-row';

        const left = document.createElement('div');
        const right = document.createElement('strong');

        left.textContent = `${s} · ${e ? { work: 'Work', vacation: 'Vacation', sick: 'Sick leave', flex: 'Flex day off' }[e.type] : (state.drafts[s] ? 'Arrival saved (unfinished)' : 'Missing entry')}`;

        if (!e && state.drafts[s]) {
            const detail = document.createElement('small');
            detail.textContent = `Arrived ${state.drafts[s].start} · departure not logged`;
            left.append(detail);
        }
        if (e?.type === 'work') {
            const detail = document.createElement('small');
            detail.textContent = `${e.start}–${e.end}, ${e.breakMinutes} min break`;
            left.append(detail);
        }

        right.textContent = fmt(delta(s, e));
        right.className = delta(s, e) < 0 ? 'negative-text' : 'positive';
        row.append(left, right);
        row.onclick = () => openDay(s);
        list.append(row);
    }

    if (!found) {
        const p = document.createElement('p');
        p.className = 'muted';
        p.textContent = 'No entries in this period.';
        list.append(p);
    }
}

function fillSettings() {
    const s = state.settings;
    $('setting-date').value = s.trackingStart;
    $('setting-balance').value = s.initialBalance;
    $('setting-start').value = s.start;
    $('setting-end').value = s.end;
    $('setting-break').value = s.breakMinutes;
    $('setting-target').value = s.targetMinutes;
    $('setting-cutoff').value = s.cutoff;
}

function renderBulkPreview() {
    const a = $('bulk-from').value;
    const b = $('bulk-to').value;

    if (!a || !b || a > b) {
        $('bulk-preview').textContent = 'Choose a valid date range. Weekends and Norwegian holidays are skipped.';
        return;
    }

    let n = 0;
    for (let s = a; s <= b && n < 3660; s = addDays(s, 1)) {
        if (!nonwork(s)) n++;
    }

    $('bulk-preview').textContent = `${n} workdays to log. Weekends and Norwegian holidays excluded. Existing entries in the range will be replaced after confirmation.`;
}

$('day-form').onsubmit = (e) => {
    e.preventDefault();
    const s = $('day-date').value;
    const type = $('day-type').value;

    if (!s) return;

    const entry = { type };

    if (type === 'work') {
        const start = normalizeTime($('day-start').value);
        const end = normalizeTime($('day-end').value);
        if (!start || !end) {
            notify('Enter a valid time (for example 730 or 15:00)');
            return;
        }
        const breakMinutes = Number($('day-break').value);
        const duration = parseTime(end) - parseTime(start);

        if (!Number.isFinite(duration) || duration < 0 || !Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > duration) {
            notify('Check the work hours and break');
            return;
        }

        entry.start = start;
        entry.end = end;
        entry.breakMinutes = breakMinutes;
    }

    if (type !== 'work') {
        entry.type = type;
    }

    state.entries[s] = entry;
    delete state.drafts[s];
    persist();
    renderBalance();
    showTab('calendar');
    notify('Day saved');
};

$('delete-day').onclick = () => {
    const s = $('day-date').value;
    if (!state.entries[s] || !confirm(`Delete entry on ${s}?`)) return;

    delete state.entries[s];
    delete state.drafts[s];
    persist();
    showTab('calendar');
    notify('Entry deleted');
};

$('settings-form').onsubmit = (e) => {
    e.preventDefault();
    const s = {
        trackingStart: $('setting-date').value,
        initialBalance: Number($('setting-balance').value),
        start: $('setting-start').value,
        end: $('setting-end').value,
        breakMinutes: Number($('setting-break').value),
        targetMinutes: Number($('setting-target').value),
        cutoff: $('setting-cutoff').value
    };

    if (
        !s.trackingStart ||
        !Number.isFinite(s.initialBalance) ||
        !Number.isInteger(s.targetMinutes) ||
        s.targetMinutes < 0 ||
        s.targetMinutes > 1440 ||
        !Number.isInteger(s.breakMinutes) ||
        s.breakMinutes < 0 ||
        parseTime(s.end) - parseTime(s.start) < s.breakMinutes ||
        !Number.isFinite(parseTime(s.cutoff))
    ) {
        notify('Please check your settings.');
        return;
    }

    state.settings = s;
    persist();
    renderBalance();
    notify('Settings saved');
};

$('bulk-form').onsubmit = (e) => {
    e.preventDefault();
    const a = $('bulk-from').value;
    const b = $('bulk-to').value;
    const type = $('bulk-type').value;

    if (!a || !b || a > b) {
        notify('Invalid date range');
        return;
    }

    const targets = [];
    for (let s = a; s <= b; s = addDays(s, 1)) {
        if (targets.length > 3650) {
            notify('Please choose a shorter date range');
            return;
        }
        if (!nonwork(s)) targets.push(s);
    }

    if (!targets.length) {
        notify('No working days in range');
        return;
    }

    const existing = targets.filter((s) => state.entries[s]).length;
    if (!confirm(`Save ${type} for ${targets.length} working days?${existing ? ` This will replace ${existing} existing entries.` : ''}`)) return;

    for (const s of targets) {
        state.entries[s] = { type };
        delete state.drafts[s];
    }
    persist();
    showTab('calendar');
    notify(`${targets.length} days saved`);
};

$('export').onclick = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flexiTracker-backup-${now()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

$('import').onchange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;

    try {
        const s = JSON.parse(await f.text());

        if (
            s.version !== 1 ||
            !s.settings ||
            !s.entries ||
            typeof s.entries !== 'object' ||
            Array.isArray(s.entries) ||
            !/^\d{4}-\d{2}-\d{2}$/.test(s.settings.trackingStart) ||
            !Number.isFinite(Number(s.settings.initialBalance)) ||
            !Number.isFinite(Number(s.settings.targetMinutes)) ||
            !Number.isFinite(Number(s.settings.breakMinutes)) ||
            !Number.isFinite(parseTime(s.settings.start)) ||
            !Number.isFinite(parseTime(s.settings.end)) ||
            !Number.isFinite(parseTime(s.settings.cutoff))
        ) {
            throw Error('Invalid backup format');
        }

        for (const [day, entry] of Object.entries(s.entries)) {
            if (
                !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
                !['work', 'vacation', 'sick', 'flex'].includes(entry?.type) ||
                (entry.type === 'work' &&
                    (!Number.isFinite(parseTime(entry.start)) ||
                        !Number.isFinite(parseTime(entry.end)) ||
                        !Number.isFinite(Number(entry.breakMinutes)) ||
                        worked(entry) < 0))
            ) {
                throw Error('Invalid entry in backup');
            }
        }

        if (!confirm('Replace all local entries and settings with this backup?')) return;

        state = s;
        if (!state.drafts || typeof state.drafts !== 'object') state.drafts = {};
        persist();
        renderBalance();
        showTab('calendar');
        notify('Backup imported');
    } catch (err) {
        notify(`Import failed: ${err.message}`);
    } finally {
        e.target.value = '';
    }
};

document.querySelectorAll('nav button').forEach((b) => {
    b.onclick = () => showTab(b.dataset.tab);
});

document.querySelectorAll('[data-view]').forEach((b) => {
    b.onclick = () => {
        calendarMode = b.dataset.view;
        renderCalendar();
    };
});

$('prev').onclick = () => {
    if (calendarMode === 'month') cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
    else cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 7);
    renderCalendar();
};

$('next').onclick = () => {
    if (calendarMode === 'month') cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    else cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7);
    renderCalendar();
};

$('this-period').onclick = () => {
    cursor = new Date();
    renderCalendar();
};

$('add-today').onclick = () => openDay(now());
$('day-date').onchange = () => openDay($('day-date').value);

for (const id of ['day-type', 'day-start', 'day-end', 'day-break']) $(id).oninput = renderDay;

for (const id of ['day-start', 'day-end']) {
    $(id).addEventListener('blur', () => {
        const normalized = normalizeTime($(id).value);
        if (normalized) $(id).value = normalized;
        renderDay();
    });
}

for (const field of ['start', 'end']) {
    const picker = $(`day-${field}-picker`);
    const input = $(`day-${field}`);
    $(`day-${field}-clock`).onclick = () => {
        picker.value = normalizeTime(input.value) || (field === 'start' ? state.settings.start : state.settings.end);
        try {
            if (typeof picker.showPicker === 'function') picker.showPicker();
            else picker.click();
        } catch {
            picker.focus();
            picker.click();
        }
    };
    picker.oninput = () => {
        if (picker.value) {
            input.value = picker.value;
            renderDay();
        }
    };
}

$('save-arrival').onclick = () => {
    const date = $('day-date').value;
    const start = normalizeTime($('day-start').value);
    if (!date || !start || $('day-type').value !== 'work' || state.entries[date]) {
        notify('Choose an unsaved workday and a valid arrival time');
        return;
    }
    state.drafts[date] = { start };
    $('day-start').value = start;
    persist();
    renderDay();
    notify('Arrival saved — finish logging when you leave');
};
for (const id of ['bulk-from', 'bulk-to']) $(id).onchange = renderBulkPreview;

$('day-date').value = now();
$('bulk-from').value = now();
$('bulk-to').value = now();
openDay(now());
showTab('calendar');

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => { });
}

function formatDate(date) {
    return new Date(date + "T12:00:00").toLocaleDateString("nb-NO");
}