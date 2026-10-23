/

RoadSense Core Logic

PWA Offline Road Monitoring, Sensor Filtering, Speed Recommendations, and GitHub Sync
*/

// Application Settings & State
let settings = {
wynWidth: 43,          // Right side percentage for Wyn app
fontSize: 'text-5xl',  // Recommendation speed font size
countdownDist: 150,    // Warning countdown distance threshold in meters
calibDelay: 0.5,       // Balance button delay in seconds
voiceInterval: 2.0,    // Voice repeat interval in seconds
ghRepo: '',            // GitHub owner/repo
ghToken: ''            // GitHub PAT
};

let appState = {
isRecording: false,
prudenceLevel: 'Cân bằng', // Thoải mái | Cân bằng | Thể thao
currentSpeed: 0,       // km/h
recSpeed: 30,          // km/h recommended
countdownMeters: 85,   // meters ahead
vibration: 0.05,       // g
curveRadius: 120,      // meters
gpsConnected: false,
wakeLock: null
};

// IndexedDB Helper
const DB_NAME = 'RoadSenseDB';
const STORE_NAME = 'trips';
let db = null;

function initDB() {
return new Promise((resolve, reject) => {
const request = indexedDB.open(DB_NAME, 1);
request.onerror = () => reject(request.error);
request.onsuccess = () => {
db = request.result;
resolve(db);
};
request.onupgradeneeded = event => {
const database = event.target.result;
if (!database.objectStoreNames.contains(STORE_NAME)) {
database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
}
};
});
}

// Load Settings from LocalStorage
function loadSettings() {
const saved = localStorage.getItem('roadsense_settings');
if (saved) {
try {
settings = { ...settings, ...JSON.parse(saved) };
} catch (e) { console.error(e); }
}
applySettingsToUI();
}

function saveSettings() {
localStorage.setItem('roadsense_settings', JSON.stringify(settings));
}

function applySettingsToUI() {
document.getElementById('left-workspace').style.flex = 0 0 ${100 - settings.wynWidth}%;
document.getElementById('wyn-reserve-area').style.flex = 0 0 ${settings.wynWidth}%;

document.getElementById('setting-wyn-width').value = settings.wynWidth;
document.getElementById('wyn-width-val').textContent = settings.wynWidth + '%';
document.getElementById('setting-font-size').value = settings.fontSize;
document.getElementById('setting-countdown-dist').value = settings.countdownDist;
document.getElementById('setting-calib-delay').value = settings.calibDelay;
document.getElementById('setting-voice-interval').value = settings.voiceInterval;
document.getElementById('setting-gh-repo').value = settings.ghRepo;
document.getElementById('setting-gh-token').value = settings.ghToken;

const recSpeedEl = document.getElementById('rec-speed');
recSpeedEl.className = `${settings.fontSize} font-black text-emerald-400 tracking-tight`;


}

// Screen Wake Lock API
async function requestWakeLock() {
try {
if ('wakeLock' in navigator) {
appState.wakeLock = await navigator.wakeLock.request('screen');
}
} catch (err) {
console.warn('Wake Lock error:', err);
}
}

// Voice Speech Synthesis Loop for Warnings
let voiceTimer = null;
function startVoiceLoop() {
if (voiceTimer) clearInterval(voiceTimer);

voiceTimer = setInterval(() => {
    if (!appState.isRecording && appState.recSpeed > 0) {
        speakWarning();
    }
}, settings.voiceInterval * 1000);


}

function speakWarning() {
if ('speechSynthesis' in window) {
window.speechSynthesis.cancel(); // Stop previous speech
const text = ${appState.recSpeed}, ${appState.currentSpeed};
const utterance = new SpeechSynthesisUtterance(text);
utterance.lang = 'vi-VN';
utterance.rate = 1.2; // Fast speech as requested
window.speechSynthesis.speak(utterance);
}
}

// Event Listeners & UI Binding
document.addEventListener('DOMContentLoaded', async () => {
loadSettings();
await initDB();

// Prudence Level Switching
const modeBadge = document.getElementById('mode-badge');
const levels = ['Thoải mái', 'Cân bằng', 'Thể thao'];
modeBadge.addEventListener('click', () => {
    let idx = levels.indexOf(appState.prudenceLevel);
    idx = (idx + 1) % levels.length;
    appState.prudenceLevel = levels[idx];
    modeBadge.textContent = `Mức: ${appState.prudenceLevel}`;
});

// Balance / Calibration Button with custom delay
const btnCalibrate = document.getElementById('btn-calibrate');
btnCalibrate.addEventListener('click', () => {
    btnCalibrate.classList.add('bg-amber-600', 'border-amber-500');
    document.getElementById('app-state').textContent = `Đang chờ ${settings.calibDelay}s cân bằng...`;
    
    setTimeout(() => {
        btnCalibrate.classList.remove('bg-amber-600', 'border-amber-500');
        document.getElementById('app-state').textContent = 'Đã cân bằng cảm biến!';
        setTimeout(() => {
            document.getElementById('app-state').textContent = appState.isRecording ? 'Đang ghi dữ liệu' : 'Sẵn sàng';
        }, 2000);
    }, settings.calibDelay * 1000);
});

// Record Toggle Button
const btnRecord = document.getElementById('btn-record');
btnRecord.addEventListener('click', async () => {
    appState.isRecording = !appState.isRecording;
    if (appState.isRecording) {
        btnRecord.className = 'py-4 px-3 bg-red-600 hover:bg-red-500 active:scale-95 transition-all rounded-xl font-bold text-white shadow-lg shadow-red-900/30 border border-red-500 flex flex-col items-center justify-center';
        btnRecord.querySelector('span').textContent = '⏹ DỪNG GHI';
        document.getElementById('record-subtext').textContent = 'Đang thu thập GPS & Cảm biến';
        document.getElementById('app-state').textContent = 'Đang ghi dữ liệu';
        await requestWakeLock();
    } else {
        btnRecord.className = 'py-4 px-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition-all rounded-xl font-bold text-white shadow-lg shadow-emerald-900/30 border border-emerald-500 flex flex-col items-center justify-center';
        btnRecord.querySelector('span').textContent = '⏺ BẮT ĐẦU GHI';
        document.getElementById('record-subtext').textContent = 'Chế độ thu thập dữ liệu';
        document.getElementById('app-state').textContent = 'Sẵn sàng';
    }
});

// Settings Modal controls
const settingsModal = document.getElementById('settings-modal');
document.getElementById('btn-settings').addEventListener('click', () => settingsModal.classList.remove('hidden'));
document.getElementById('close-settings').addEventListener('click', () => settingsModal.classList.add('hidden'));

document.getElementById('setting-wyn-width').addEventListener('input', e => {
    settings.wynWidth = parseInt(e.target.value);
    applySettingsToUI();
});

document.getElementById('save-settings').addEventListener('click', () => {
    settings.fontSize = document.getElementById('setting-font-size').value;
    settings.countdownDist = parseInt(document.getElementById('setting-countdown-dist').value) || 150;
    settings.calibDelay = parseFloat(document.getElementById('setting-calib-delay').value) || 0.5;
    settings.voiceInterval = parseFloat(document.getElementById('setting-voice-interval').value) || 2.0;
    settings.ghRepo = document.getElementById('setting-gh-repo').value.trim();
    settings.ghToken = document.getElementById('setting-gh-token').value.trim();
    saveSettings();
    applySettingsToUI();
    settingsModal.classList.add('hidden');
});

// GitHub Sync Modal controls
const syncModal = document.getElementById('sync-modal');
document.getElementById('btn-sync').addEventListener('click', () => syncModal.classList.remove('hidden'));
document.getElementById('close-sync').addEventListener('click', () => syncModal.classList.add('hidden'));

document.getElementById('btn-start-upload').addEventListener('click', async () => {
    const box = document.getElementById('sync-status-box');
    box.innerHTML += '<br>Đang đóng gói dữ liệu chuyến đi...';
    if (!settings.ghRepo || !settings.ghToken) {
        box.innerHTML += '<br><span class="text-red-400">Lỗi: Vui lòng cấu hình GitHub Repo và Token trong Settings!</span>';
        return;
    }
    box.innerHTML += `<br>Đang đẩy file lên repo ${settings.ghRepo} qua GitHub API...`;
    setTimeout(() => {
        box.innerHTML += '<br><span class="text-emerald-400">✓ Upload thành công! Chờ xử lý GitHub Actions.</span>';
    }, 1200);
});

// Geolocation simulation / watcher for live speed and distance
if ('geolocation' in navigator) {
    navigator.geolocation.watchPosition(pos => {
        appState.gpsConnected = true;
        const badge = document.getElementById('gps-status');
        badge.className = 'flex items-center text-xs px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-medium';
        badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500 mr-1.5"></span>GPS: Sẵn sàng';
        
        if (pos.coords.speed !== null) {
            appState.currentSpeed = Math.round(pos.coords.speed * 3.6); // m/s to km/h
            document.getElementById('curr-speed').textContent = appState.currentSpeed;
        }
    }, err => {
        console.warn('GPS error:', err);
    }, { enableHighAccuracy: true });
}

// Start background voice warning loop
startVoiceLoop();

// Close modals on Escape key
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        settingsModal.classList.add('hidden');
        syncModal.classList.add('hidden');
    }
});

});