/* RoadSense One View — thử nghiệm, không thay thế thiết bị đo chuyên dụng hoặc quy định ATGT. */
(() => {
  'use strict';

  const SETTINGS_KEY = 'roadsense_settings_v3';
  const EVENTS_KEY = 'roadsense_road_events_v3';
  const DB_NAME = 'RoadSenseDB';
  const GH_TOKEN_KEY = 'roadsense_gh_token_device_v5';
  const SYNC_PREF_KEY = 'roadsense_sync_prefs_v5';
  const ARCHIVE = window.RoadSenseArchive;
  const GH_REPO = ARCHIVE.REPO;
  let tokenInSession = '';
  let syncPrefs = {auto:true,interval:3,uploadOnStop:true,rememberToken:false, ...readSafeSyncPrefs()};
  if(![2,3,5,10,15].includes(Number(syncPrefs.interval))) syncPrefs.interval=3;
  for(const flag of ['auto','uploadOnStop','rememberToken']) syncPrefs[flag]=syncPrefs[flag]===true;
  function readSafeSyncPrefs() { try { const raw=JSON.parse(localStorage.getItem(SYNC_PREF_KEY)); return raw && typeof raw==='object' ? raw : {}; } catch {return {}; } }

  const STORE_NAME = 'trips';
  const G = 9.80665;
  const DEFAULTS = Object.freeze({
    theme: 'auto', heroColor: '#fffbf0', fontSize: 'normal', recSpeedSize: 100, gpsSpeedSize: 100, uiScale: 100, mode: 'balanced',
    baseSpeed: 50, minSpeed: 15, maxSpeed: 90, lateralAccel: 1.6,
    vibrationThreshold: 0.35, vibrationPenalty: 15, warningRadius: 150,
    rememberBumps: true, highAccuracy: true, gpsTimeout: 15,
    gpsMaxAge: 2, gpsMaxAccuracy: 70, speedSmoothing: 0.45,
    vibrationSmoothing: 0.3, calibDelay: 1.5, voiceEnabled: false,
    voiceInterval: 12, voiceMargin: 0, beepPitch: 850, beepVolume: 55
  });
  const FIELDS = {
    theme: 'setting-theme', heroColor: 'setting-hero-color', recSpeedSize: 'setting-rec-speed-size', gpsSpeedSize: 'setting-gps-speed-size', uiScale: 'setting-ui-scale',
    mode: 'setting-mode', baseSpeed: 'setting-base-speed', minSpeed: 'setting-min-speed',
    maxSpeed: 'setting-max-speed', lateralAccel: 'setting-lateral-accel',
    vibrationThreshold: 'setting-vibration-threshold', vibrationPenalty: 'setting-vibration-penalty',
    warningRadius: 'setting-warning-radius', rememberBumps: 'setting-remember-bumps',
    highAccuracy: 'setting-high-accuracy', gpsTimeout: 'setting-gps-timeout',
    gpsMaxAge: 'setting-gps-max-age', gpsMaxAccuracy: 'setting-gps-max-accuracy',
    speedSmoothing: 'setting-speed-smoothing', vibrationSmoothing: 'setting-vibration-smoothing',
    calibDelay: 'setting-calib-delay', voiceEnabled: 'setting-voice-enabled',
    voiceInterval: 'setting-voice-interval', voiceMargin: 'setting-voice-margin',
    beepPitch: 'setting-beep-pitch', beepVolume: 'setting-beep-volume'
  };
  const MODES = { comfort: 'Thoải mái', balanced: 'Cân bằng', sport: 'Thể thao' };
  const $ = id => document.getElementById(id);
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const finite = x => typeof x === 'number' && Number.isFinite(x);
  const readJSON = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  };
  const writeJSON = (key, obj) => {
    try { localStorage.setItem(key, JSON.stringify(obj)); return true; }
    catch { return false; }
  };

  function validateSettings(obj) {
    const safe = { ...DEFAULTS };
    if (!obj || typeof obj !== 'object') return safe;
    for (const [key, def] of Object.entries(DEFAULTS)) {
      if (typeof def === 'boolean') safe[key] = typeof obj[key] === 'boolean' ? obj[key] : def;
      else if (typeof def === 'number') {
        const input = Number(obj[key]);
        safe[key] = Number.isFinite(input) ? input : def;
      } else if (typeof obj[key] === 'string') safe[key] = obj[key];
    }
    if (!['auto','dark','light'].includes(safe.theme)) safe.theme = 'auto';
    // Màu HEX nhập bằng tay; dữ liệu v6 không có trường này được tự động đặt về màu theme.
    if (!/^#[0-9a-f]{6}$/i.test(safe.heroColor)) safe.heroColor = '';
    else safe.heroColor = safe.heroColor.toUpperCase();
    // Chuyển mặc định 10 km/h của cảnh báo giọng nói cũ sang 0: vượt ngưỡng là bíp.
    // Giữ nguyên các mức tùy chỉnh khác nếu người dùng từng nhập.
    if (obj.beepPitch === undefined && safe.voiceMargin === 10) safe.voiceMargin = 0;
    if (!['normal','large','extra'].includes(safe.fontSize)) safe.fontSize = 'normal';
    // Chuyển cỡ số từ bản v5 (select chung) sang 2 giá trị riêng mà không mất cấu hình cũ.
    if (obj.recSpeedSize === undefined) safe.recSpeedSize = ({normal:68,large:78,extra:90})[safe.fontSize];
    if (obj.gpsSpeedSize === undefined) safe.gpsSpeedSize = ({normal:64,large:72,extra:84})[safe.fontSize];
    if (!Object.hasOwn(MODES, safe.mode)) safe.mode = 'balanced';
    const constraints = {
      recSpeedSize:[34,110], gpsSpeedSize:[34,110], uiScale:[60,200], baseSpeed:[10,120], minSpeed:[5,70], maxSpeed:[20,130],
      lateralAccel:[0.6,3.5], vibrationThreshold:[0.1,2], vibrationPenalty:[0,40],
      warningRadius:[30,1000], gpsTimeout:[5,60], gpsMaxAge:[0,30],
      gpsMaxAccuracy:[10,300], speedSmoothing:[0.1,1], vibrationSmoothing:[0.05,1],
      calibDelay:[1.2,5], voiceInterval:[2,90], voiceMargin:[0,30], beepPitch:[400,1400], beepVolume:[10,100]
    };
    for (const [key, [min,max]] of Object.entries(constraints)) safe[key] = clamp(safe[key], min, max);
    if (safe.minSpeed > safe.maxSpeed) safe.minSpeed = safe.maxSpeed;
    return safe;
  }
  let settings = validateSettings(readJSON(SETTINGS_KEY, {}));
  let events = readJSON(EVENTS_KEY, []);
  if (!Array.isArray(events)) events = [];
  events = events.filter(e => finite(e.lat) && finite(e.lng) && finite(e.at)).slice(-300);

  const state = {
    gpsWatch: null, gpsState: 'waiting', gpsMessage: 'Chạm GPS để cấp quyền vị trí.',
    gpsAccuracy: null, lastFix: null, lastGoodAt: 0, speed: null, heading: null,
    previousHeading: null, curveRadius: null, curveAt: 0, vibration: null,
    gravityBase: null, sensorAt: 0, motionReceived: false, calibrating: false,
    calibrationSamples: [], calibrationStartedAt: 0, calibrationStatus: 'waiting',
    calibrationText: '', lastCalibrationAt: 0, gpsIntervals: [], lastGpsTimestamp: null,
    lastDashboardRenderAt: 0, isRecording: false, activeTrip: null, db: null,
    wakeLock: null, nearestEvent: null, recommended: settings.baseSpeed,
    recReason: 'Theo mức cấu hình', lastBumpAt: 0,
    uploadBusy: false, recordBusy:false, lastNotice: '', renderPending: false,
    lastMotionRecordAt:0, lastAutoSyncAt:Date.now(), archiveReady:false,
    beepAudio:null, beepOscillators:new Set(), nextBeepAllowedAt:0
  };

  function fillForm(source) {
    for (const [key, id] of Object.entries(FIELDS)) {
      const el = $(id);
      if (el.type === 'checkbox') el.checked = source[key];
      else el.value = source[key];
    }
    $('setting-ui-scale-val').textContent = `${source.uiScale}%`;
    $('setting-rec-speed-size-val').textContent = `${source.recSpeedSize} px`;
    $('setting-gps-speed-size-val').textContent = `${source.gpsSpeedSize} px`;
    $('setting-beep-volume-val').textContent = `${source.beepVolume}%`;
    previewHeroSwatch();
  }
  function readForm() {
    const value = {};
    for (const [key, id] of Object.entries(FIELDS)) {
      const el = $(id);
      value[key] = el.type === 'checkbox' ? el.checked :
        typeof DEFAULTS[key] === 'number' ? Number(el.value) : el.value;
    }
    return validateSettings(value);
  }
  function resolvedTheme() {
    return settings.theme === 'auto' ?
      (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : settings.theme;
  }
  function heroHexValid(raw) {
    return raw === '' || /^#[0-9a-f]{6}$/i.test(raw);
  }
  function previewHeroSwatch() {
    const color = $('setting-hero-color').value.trim();
    const el = $('hero-color-swatch');
    el.style.background = /^#[0-9a-f]{6}$/i.test(color) ? color : 'linear-gradient(135deg, #111d31 50%, #ffffff 50%)';
    $('hero-color-error').hidden = heroHexValid(color);
    $('setting-hero-color').setAttribute('aria-invalid', String(!heroHexValid(color)));
  }
  function isLightColor(hex) {
    const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i+2), 16) / 255);
    const linear = rgb.map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
    return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2] > .24;
  }
  function applyHeroColor() {
    const hero = $('analysis-panel');
    const custom = settings.heroColor;
    hero.classList.toggle('has-custom-color', Boolean(custom));
    hero.style.backgroundColor = custom || '';
    const light = custom && isLightColor(custom);
    hero.style.setProperty('--hero-text', light ? '#102238' : '#f4f8ff');
    hero.style.setProperty('--hero-muted', light ? '#263e4f' : '#e0e8f4');
    hero.style.setProperty('--hero-highlight', light ? '#004d36' : '#74ffbf');
    hero.style.setProperty('--hero-mode-active-text', light ? '#ffffff' : '#072515');
    hero.style.setProperty('--hero-line', light ? 'rgba(0,0,0,.23)' : 'rgba(255,255,255,.30)');
    hero.style.setProperty('--hero-mode-bg', light ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.12)');
  }
  function applyAppearance() {
    const theme = resolvedTheme();
    document.documentElement.dataset.theme = theme;
    applyHeroColor();
    const factor = settings.uiScale / 100;
    document.documentElement.style.setProperty('--ui-scale', String(factor));
    document.documentElement.style.setProperty('--rec-speed-font', `${Math.round(settings.recSpeedSize * factor)}px`);
    document.documentElement.style.setProperty('--gps-speed-font', `${Math.round(settings.gpsSpeedSize * factor)}px`);
    document.documentElement.style.setProperty('--metric-font', `${Math.round(31 * factor)}px`);
    document.documentElement.style.setProperty('--scale-percent', `${settings.uiScale}%`);
    // Lớn hơn One View: cho phép cuộn trong bảng điều khiển, không cắt nội dung.
    $('dashboard').classList.toggle('expanded-zoom', settings.uiScale > 115);
    document.documentElement.dataset.zoom = String(settings.uiScale);
    $('btn-theme').textContent = theme === 'dark' ? '☀' : '☾';
    $('btn-theme').title = theme === 'dark' ? 'Chuyển giao diện sáng' : 'Chuyển giao diện tối';
    $('browser-theme-color').content = theme === 'dark' ? '#0c1425' : '#e9eff7';
  }

  function modal(id, show) {
    const el = $(id);
    if (show) document.querySelectorAll('.overlay').forEach(other => { if (other !== el) other.hidden = true; });
    el.hidden = !show;
    document.body.classList.toggle('dialog-open', !!document.querySelector('.overlay:not([hidden])'));
    // Không focus ô nhập liệu khi mở modal: trên điện thoại bàn phím bật lên
    // sẽ co giãn viewport liên tục, tạo cảm giác cửa sổ bị chớp.
    if (show) requestAnimationFrame(() => el.querySelector('.close-btn')?.focus({preventScroll:true}));
    else scheduleRender();
  }
  function updateGpsInfo() {
    const status = state.gpsState;
    const hz = state.gpsIntervals.length ?
      (1000 / (state.gpsIntervals.reduce((a,b)=>a+b,0)/state.gpsIntervals.length)).toFixed(1) : '--';
    $('gps-meta').textContent = status === 'ok' ? `${hz} Hz · ±${Math.round(state.gpsAccuracy)} m` :
      status === 'weak' && finite(state.gpsAccuracy) ? `±${Math.round(state.gpsAccuracy)} m` :
      status === 'waiting' ? 'Đang định vị' : 'Chạm thử lại';
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const downlink = finite(connection?.downlink) ? `\nInternet ước tính: ~${connection.downlink} Mbps (khác GPS)` : '';
    $('gps-diagnostics').textContent = `Trạng thái: ${state.gpsMessage}${finite(state.gpsAccuracy) ? `\nSai số ước tính: ±${Math.round(state.gpsAccuracy)} m` : ''}` +
      `\nNhịp cập nhật vị trí: ${hz} Hz (lần/giây; không phải Mbps)${downlink}` +
      `\nTrang bảo mật: ${window.isSecureContext ? 'Có (HTTPS/localhost)' : 'Không — GPS thường bị trình duyệt khóa'}`;
  }
  function setGps(status, msg, accuracy = null) {
    // Khi mất GPS hoặc sai số quá lớn, dừng ngay âm báo để tránh cảnh báo lỗi thời.
    if (status !== 'ok' && state.beepOscillators.size) stopBeepSequence();
    state.gpsState = status;
    state.gpsMessage = msg;
    state.gpsAccuracy = accuracy;
    const dot = $('gps-dot');
    dot.className = 'status-dot ' + (status === 'ok' ? 'ok' : status === 'waiting' ? 'waiting' : 'bad');
    $('gps-status').textContent = ({ok:'GPS tốt',weak:'GPS yếu',waiting:'Chờ GPS',error:'GPS lỗi',blocked:'GPS bị chặn'})[status] || 'GPS';
    updateGpsInfo();
    scheduleRender();
  }
  const rad = a => a * Math.PI / 180;
  const deg = a => a * 180 / Math.PI;
  function distanceMeters(a,b) {
    const lat1=rad(a.lat), lat2=rad(b.lat), dl=rad(b.lat-a.lat), dn=rad(b.lng-a.lng);
    const h=Math.sin(dl/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dn/2)**2;
    return 12742000 * Math.asin(Math.min(1,Math.sqrt(h)));
  }
  function bearing(a,b) {
    const p1=rad(a.lat), p2=rad(b.lat), d=rad(b.lng-a.lng);
    return (deg(Math.atan2(Math.sin(d)*Math.cos(p2),Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(d)))+360)%360;
  }
  const angleDiff = (a,b) => ((a-b+540)%360)-180;

  function startGPS() {
    if (state.gpsWatch !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(state.gpsWatch);
      state.gpsWatch = null;
    }
    if (!navigator.geolocation) { setGps('blocked','Trình duyệt không hỗ trợ Geolocation.'); return; }
    if (!window.isSecureContext) { setGps('blocked','Hãy truy cập bằng HTTPS hoặc localhost.'); return; }
    state.gpsIntervals = [];
    state.lastGpsTimestamp = null;
    state.lastFix = null; // Không nối hai hành trình bằng tọa độ cũ sau khi tái kết nối.
    setGps('waiting','Đang yêu cầu vị trí. Hãy cho phép truy cập vị trí và bật định vị trên điện thoại.');
    try {
      state.gpsWatch = navigator.geolocation.watchPosition(onPosition, onGpsError, {
        enableHighAccuracy: settings.highAccuracy,
        timeout: settings.gpsTimeout * 1000,
        maximumAge: settings.gpsMaxAge * 1000
      });
    } catch (e) { setGps('error',`Không mở được GPS: ${e.message}`); }
  }
  function onGpsError(e) {
    state.speed = null;
    if(state.isRecording) ARCHIVE.record({kind:'gps_error',at:Date.now(),code:e.code||null,message:e.message||''});
    const messages = {
      1:'Quyền vị trí bị từ chối. Kiểm tra quyền vị trí trong trình duyệt/cài đặt máy.',
      2:'Điện thoại chưa xác định được vị trí. Thử ra ngoài trời và bật độ chính xác cao.',
      3:'GPS quá thời gian chờ. Thử ở nơi thoáng hoặc tăng thời gian chờ.'
    };
    setGps(e.code === 1 ? 'blocked' : 'error',messages[e.code] || e.message || 'Không thể nhận vị trí.');
  }
  function onPosition(pos) {
    const c = pos.coords;
    if (!finite(c.latitude) || !finite(c.longitude)) return;
    const badAccuracy = !finite(c.accuracy) || c.accuracy > settings.gpsMaxAccuracy;
    if (state.isRecording) ARCHIVE.record({kind:'gps',at:pos.timestamp||Date.now(),receivedAt:Date.now(),
      quality:badAccuracy?'rejected_accuracy':'ok',
      coords:{latitude:c.latitude,longitude:c.longitude,accuracy:finite(c.accuracy)?c.accuracy:null,
        altitude:finite(c.altitude)?c.altitude:null,altitudeAccuracy:finite(c.altitudeAccuracy)?c.altitudeAccuracy:null,
        speed:finite(c.speed)?c.speed:null,heading:finite(c.heading)?c.heading:null},
      speedKmh:finite(c.speed)?c.speed*3.6:null,speedSource:'gps.coords.speed',
      calibration:state.calibrationStatus,
      mode:settings.mode,settingsMaxAccuracyM:settings.gpsMaxAccuracy});
    if (badAccuracy) {
      state.speed = null;
      setGps('weak', `Sai số GPS ±${Math.round(c.accuracy || 9999)} m vượt ngưỡng ${settings.gpsMaxAccuracy} m.`,c.accuracy);
      return;
    }
    const fix = { lat:c.latitude, lng:c.longitude, accuracy:c.accuracy, at:pos.timestamp || Date.now() };
    // Geolocation chỉ đưa ra từng bản cập nhật tọa độ, không có băng thông dữ liệu GPS.
    // Chỉ tính tần suất (Hz) từ các mốc thời gian mới; bỏ mẫu cache/trùng thời gian.
    if (state.lastGpsTimestamp !== null) {
      const interval = fix.at - state.lastGpsTimestamp;
      if (interval >= 200 && interval <= 30000) {
        state.gpsIntervals.push(interval);
        if (state.gpsIntervals.length > 6) state.gpsIntervals.shift();
      }
    }
    if (state.lastGpsTimestamp === null || fix.at > state.lastGpsTimestamp) state.lastGpsTimestamp = fix.at;
    const prev = state.lastFix;
    let dt = null, moved = null, derivedHeading = null;
    if (prev) {
      dt = (fix.at - prev.at)/1000;
      if (dt > 0 && dt <= 30) {
        moved = distanceMeters(prev,fix);
        if (moved > Math.max(5,(fix.accuracy+prev.accuracy)*.5)) derivedHeading = bearing(prev,fix);
      }
    }
    let rawSpeed = finite(c.speed) && c.speed >= 0 ? c.speed*3.6 : null;
    if (rawSpeed === null && moved !== null && dt >= 2 && dt <= 30) {
      const uncertainty = Math.max(6,(prev.accuracy+fix.accuracy)*.6);
      if (moved > uncertainty) rawSpeed = moved/dt*3.6;
    }
    if (rawSpeed !== null && rawSpeed <= 220) {
      state.speed = state.speed === null ? rawSpeed :
        settings.speedSmoothing*rawSpeed+(1-settings.speedSmoothing)*state.speed;
    } else state.speed = null;
    const heading = finite(c.heading) && c.heading >= 0 ? c.heading : derivedHeading;
    if (finite(heading) && dt && dt >= 1 && dt <= 20 && state.speed !== null && state.speed > 12) {
      if (state.previousHeading !== null) {
        const delta = Math.abs(angleDiff(heading,state.previousHeading));
        if (delta >= 5 && delta <= 75) {
          const omega = rad(delta)/dt;
          const radius = (state.speed/3.6)/omega;
          if (radius >= 8 && radius <= 3000) { state.curveRadius = radius; state.curveAt = Date.now(); }
        }
      }
      state.previousHeading = heading;
    }
    state.heading = finite(heading) ? heading : null;
    state.lastFix = fix;
    state.lastGoodAt = Date.now();
    setGps('ok',`GPS đang nhận vị trí (±${Math.round(c.accuracy)} m).`,c.accuracy);
    if (state.isRecording && state.activeTrip) {
      const trip = state.activeTrip;
      if (prev && moved !== null && dt && moved >= Math.max(5,(fix.accuracy+prev.accuracy)*.5) && moved <= Math.min(500,dt*75)) {
        trip.distanceKm += moved/1000;
      }
      trip.gpsCount++; // Bản gốc GPS được lưu đầy đủ trong kho v5; không giới hạn 15.000 mẫu.
    }
    state.nearestEvent = findUpcomingEvent();
    maybeBeep();
    scheduleRender();
  }
  function findUpcomingEvent() {
    if (!state.lastFix || state.gpsState !== 'ok') return null;
    let nearest = null;
    for (const event of events) {
      if (Date.now() - event.at < 60000) continue; // tránh báo lại điểm vừa phát hiện
      const distance = distanceMeters(state.lastFix,event);
      if (distance > settings.warningRadius || distance < 12) continue;
      if (state.heading !== null && state.speed !== null && state.speed > 5) {
        const deviation = Math.abs(angleDiff(bearing(state.lastFix,event),state.heading));
        if (deviation > 60) continue;
      }
      if (!nearest || distance < nearest.distance) nearest = { distance, event };
    }
    return nearest;
  }

  function setCalibrationStatus(kind, label) {
    if (state.calibrationStatus === kind && state.calibrationText === label) return;
    state.calibrationStatus = kind;
    state.calibrationText = label;
    $('calibrate-subtext').textContent = label;
    const el = $('auto-calibration-status');
    el.classList.toggle('ready',kind === 'ready');
    el.classList.toggle('unavailable',kind === 'unavailable');
    scheduleRender();
  }
  function beginAutoCalibration() {
    state.calibrating = true;
    state.calibrationSamples = [];
    state.calibrationStartedAt = 0;
    state.vibration = null;
    setCalibrationStatus('measuring','Đang tự cân bằng…');
  }
  function onMotion(e) {
    const gravity = e.accelerationIncludingGravity;
    const hasGravity = !!gravity && finite(gravity.x) && finite(gravity.y) && finite(gravity.z);
    const a = e.acceleration;
    const v = hasGravity ? gravity : a;
    if (!v || !finite(v.x) || !finite(v.y) || !finite(v.z)) return;
    const magnitude = Math.hypot(v.x,v.y,v.z);
    const now = Date.now();
    state.motionReceived = true;
    state.sensorAt = now;
    // Lưu gia tốc 3 trục gốc tối đa 20Hz; giữ cả dữ liệu trước khi tự cân bằng.
    if (state.isRecording && now-state.lastMotionRecordAt >= 50) {
      state.lastMotionRecordAt=now;
      ARCHIVE.record({kind:'motion',at:now,eventTimeStampMs:Number.isFinite(e.timeStamp)?e.timeStamp:null,
        intervalMs:finite(e.interval)?e.interval:null,
        acceleration:{x:finite(a?.x)?a.x:null,y:finite(a?.y)?a.y:null,z:finite(a?.z)?a.z:null},
        accelerationIncludingGravity:{x:finite(gravity?.x)?gravity.x:null,y:finite(gravity?.y)?gravity.y:null,z:finite(gravity?.z)?gravity.z:null},
        rotationRate:{alpha:finite(e.rotationRate?.alpha)?e.rotationRate.alpha:null,
          beta:finite(e.rotationRate?.beta)?e.rotationRate.beta:null,gamma:finite(e.rotationRate?.gamma)?e.rotationRate.gamma:null},
        vibrationG:state.vibration,calibration:state.calibrationStatus,mode:settings.mode});
    }

    if (state.calibrating) {
      if (!state.calibrationStartedAt) state.calibrationStartedAt = now;
      state.calibrationSamples.push({at:now, value:magnitude, hasGravity});
      const duration = Math.max(1200,settings.calibDelay*1000);
      state.calibrationSamples = state.calibrationSamples.filter(s => s.at >= now-duration && s.hasGravity === hasGravity).slice(-250);
      const samples = state.calibrationSamples;
      if (samples.length >= 8 && samples.at(-1).at - samples[0].at >= duration*.9) {
        const values=samples.map(s=>s.value);
        const mean=values.reduce((a,b)=>a+b,0)/values.length;
        const variance=values.reduce((a,b)=>a+(b-mean)**2,0)/values.length;
        const stable=Math.sqrt(variance) < G*.08 && Math.max(...values)-Math.min(...values) < G*.27;
        if (stable) {
          state.gravityBase = hasGravity ? mean : 0;
          state.vibration = 0;
          state.calibrating = false;
          state.lastCalibrationAt = now;
          state.calibrationSamples=[];
          ARCHIVE.record({kind:'calibration',at:now,status:'ready',gravityBaseMps2:state.gravityBase,hasGravity,sampleCount:values.length});
          setCalibrationStatus('ready','Đã cân bằng tự động');
        }
      }
      if (state.calibrating && now-state.calibrationStartedAt >= Math.max(4500,duration*2)) {
        setCalibrationStatus('measuring','Đặt máy đứng yên để cân bằng');
      }
      return;
    }

    if (state.gravityBase === null) state.gravityBase = hasGravity ? magnitude : 0;
    const raw = hasGravity ? Math.abs(magnitude - state.gravityBase)/G : magnitude/G;
    if (hasGravity) state.gravityBase = .995*state.gravityBase+.005*magnitude;
    state.vibration = state.vibration === null ? raw :
      state.vibration*(1-settings.vibrationSmoothing)+raw*settings.vibrationSmoothing;
    if (raw >= settings.vibrationThreshold && state.isRecording && settings.rememberBumps &&
        state.gpsState === 'ok' && state.lastFix && now-state.lastBumpAt > 15000 &&
        state.speed !== null && state.speed >= 8) {
      state.lastBumpAt = now;
      ARCHIVE.record({kind:'road_event',at:now,source:'sensor_estimate',shockG:raw,
        latitude:state.lastFix.lat,longitude:state.lastFix.lng,accuracyM:state.lastFix.accuracy});
      events.push({ lat:state.lastFix.lat, lng:state.lastFix.lng, at:now, shockG:Math.round(raw*100)/100 });
      events=events.slice(-300);
      writeJSON(EVENTS_KEY,events);
    }
    // Giới hạn cập nhật DOM ở ~4 lần/giây để không làm nháy popup trên máy yếu.
    if (now-state.lastDashboardRenderAt >= 250) scheduleRender();
  }
  async function requestMotionAccess() {
    if (!window.isSecureContext) return 'Cảm biến cần HTTPS hoặc localhost.';
    if (!('DeviceMotionEvent' in window)) return 'Thiết bị/trình duyệt không hỗ trợ cảm biến chuyển động.';
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        // iOS bắt buộc hỏi quyền từ cú chạm của người dùng; không thể bỏ qua.
        const result = await DeviceMotionEvent.requestPermission();
        if (result !== 'granted') return 'Bạn chưa cấp quyền cảm biến chuyển động.';
      } catch(e) { return `Lỗi cấp quyền cảm biến: ${e.message}`; }
    }
    if (state.calibrationStatus !== 'ready') beginAutoCalibration();
    return 'Đã yêu cầu cảm biến; hãy giữ điện thoại đứng yên để tự cân bằng.';
  }

  function calculateRecommendation() {
    const offset = settings.mode === 'comfort' ? -10 : settings.mode === 'sport' ? 10 : 0;
    let speed = clamp(settings.baseSpeed+offset,settings.minSpeed,settings.maxSpeed);
    let reason = 'Mức tham chiếu cài đặt';
    if (state.curveRadius !== null && Date.now()-state.curveAt < 7500) {
      const curveCap = Math.sqrt(settings.lateralAccel*state.curveRadius)*3.6;
      if (curveCap < speed) { speed = curveCap; reason = 'Ước tính từ độ cong cua'; }
    }
    if (state.vibration !== null && Date.now()-state.sensorAt < 6000 && state.vibration > settings.vibrationThreshold*.7) {
      speed -= settings.vibrationPenalty;
      reason = 'Cảm biến nhận thấy dao động';
    }
    if (state.nearestEvent) {
      const upcoming = settings.baseSpeed-settings.vibrationPenalty;
      if (upcoming < speed) { speed = upcoming; reason = 'Sắp tới điểm xóc đã lưu'; }
    }
    state.recommended = Math.round(clamp(speed,settings.minSpeed,settings.maxSpeed));
    state.recReason = reason;
  }
  // Web Audio API: 4 bíp, mỗi bíp 105 ms và cách nhau 105 ms.
  // Không dùng speechSynthesis vì đọc cả câu gây trễ trên điện thoại.
  const BEEP_COUNT = 4, BEEP_ON_S = .105, BEEP_GAP_S = .105;
  const BEEP_DURATION_MS = ((BEEP_COUNT-1)*(BEEP_ON_S+BEEP_GAP_S)+BEEP_ON_S)*1000;
  function audioContext() {
    if (!state.beepAudio) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return null;
      try { state.beepAudio = new Audio(); } catch { return null; }
    }
    return state.beepAudio;
  }
  function unlockAudioFromGesture() {
    // Gọi trực tiếp ở sự kiện click, trước mọi await; iOS chặn autoplay từ timer.
    const ctx = audioContext();
    if (!ctx) return Promise.reject(new Error('Trình duyệt không hỗ trợ Web Audio.'));
    if (ctx.state === 'running') return Promise.resolve(ctx);
    return ctx.resume().then(() => {
      if (ctx.state !== 'running') throw new Error('Âm thanh chưa được phép phát.');
      return ctx;
    });
  }
  function stopBeepSequence() {
    for (const osc of state.beepOscillators) {
      try { osc.stop(); } catch { /* oscillator đã dừng */ }
    }
    state.beepOscillators.clear();
  }
  function playBeepSequence(ctx, pitch, volumePercent) {
    if (ctx.state !== 'running') return false;
    stopBeepSequence();
    const start = ctx.currentTime + .015;
    const gainLevel = .20 * clamp(volumePercent,10,100)/100;
    for (let i=0; i<BEEP_COUNT; i++) {
      const t = start+i*(BEEP_ON_S+BEEP_GAP_S);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(clamp(pitch,400,1400),t);
      gain.gain.setValueAtTime(0,t);
      gain.gain.linearRampToValueAtTime(gainLevel,t+.008);
      gain.gain.setValueAtTime(gainLevel,t+BEEP_ON_S-.018);
      gain.gain.linearRampToValueAtTime(0,t+BEEP_ON_S);
      osc.connect(gain);
      gain.connect(ctx.destination);
      state.beepOscillators.add(osc);
      osc.onended = () => {
        state.beepOscillators.delete(osc);
        osc.disconnect();
        gain.disconnect();
      };
      osc.start(t);
      osc.stop(t+BEEP_ON_S+.004);
    }
    return true;
  }
  async function previewBeep() {
    const status = $('voice-preview-status');
    const pitch = clamp(Number($('setting-beep-pitch').value) || 850,400,1400);
    const volume = clamp(Number($('setting-beep-volume').value) || 55,10,100);
    try {
      const ctx = await unlockAudioFromGesture();
      if (!playBeepSequence(ctx,pitch,volume)) throw new Error('Trình duyệt chưa bật âm thanh.');
      // Tránh phát đồng thời cảnh báo thật ngay sau khi nghe thử.
      state.nextBeepAllowedAt = Date.now() + BEEP_DURATION_MS + settings.voiceInterval*1000;
      status.textContent = `Đã phát thử 4 tiếng bíp, ${pitch} Hz · âm lượng ${volume}%.`;
    } catch (err) {
      status.textContent = `Chưa phát được tiếng bíp: ${err.message} Hãy thử chạm lại và kiểm tra âm lượng máy.`;
    }
  }
  function maybeBeep() {
    calculateRecommendation();
    const now = Date.now();
    // Không phát nếu chưa ghi, GPS không mới, thiếu vận tốc, hoặc không vượt ngưỡng.
    const valid = settings.voiceEnabled && state.isRecording && state.gpsState === 'ok' &&
      finite(state.speed) && now-state.lastGoodAt <= 10000 &&
      state.speed > state.recommended + settings.voiceMargin;
    if (!valid) {
      if (state.beepOscillators.size) stopBeepSequence();
      state.nextBeepAllowedAt = 0; // Nếu bắt đầu vượt ngưỡng lần nữa, cảnh báo ngay.
      return;
    }
    if (now < state.nextBeepAllowedAt) return;
    const ctx = state.beepAudio;
    // Không cố tự mở quyền phát từ timer: điện thoại chỉ cho phép sau thao tác của người dùng.
    if (!ctx || ctx.state !== 'running') return;
    if (playBeepSequence(ctx,settings.beepPitch,settings.beepVolume))
      state.nextBeepAllowedAt = now+BEEP_DURATION_MS+settings.voiceInterval*1000;
  }

  function render() {
    state.renderPending = false;
    if (state.curveRadius !== null && Date.now()-state.curveAt >= 7500) state.curveRadius=null;
    if (state.sensorAt && Date.now()-state.sensorAt > 10000) state.vibration = null;
    calculateRecommendation();
    state.lastDashboardRenderAt = Date.now();
    document.querySelectorAll('.mode-option').forEach(btn => {
      const selected = btn.dataset.mode === settings.mode;
      if (btn.getAttribute('aria-pressed') !== String(selected)) btn.setAttribute('aria-pressed',String(selected));
    });
    const recommendedText = String(state.recommended);
    const actualText = state.gpsState === 'ok' && state.speed !== null ? String(Math.round(state.speed)) : '--';
    $('rec-speed').textContent = recommendedText;
    $('rec-speed').parentElement.classList.toggle('triple-digit', recommendedText.length >= 3);
    $('rec-reason').textContent = state.recReason;
    $('curr-speed').textContent = actualText;
    $('curr-speed').parentElement.classList.toggle('triple-digit', actualText.length >= 3);
    $('gps-accuracy-hint').textContent = state.gpsState === 'ok' ? `Sai số ±${Math.round(state.gpsAccuracy)} m` : 'Đợi dữ liệu vị trí';
    $('vibration-score').textContent = state.vibration === null ? '--' : state.vibration.toFixed(2);
    $('sensor-state').textContent = state.calibrationStatus === 'ready' && state.vibration !== null ?
      'Đã tự cân bằng' : state.calibrationStatus === 'measuring' ? 'Đang tự cân bằng' : 'Chưa có dữ liệu cảm biến';
    $('curve-radius').textContent = state.curveRadius === null ? '--' : Math.round(state.curveRadius);
    $('countdown-value').textContent = state.nearestEvent ? Math.round(state.nearestEvent.distance) : '--';
    $('trip-distance').textContent = (state.activeTrip?.distanceKm || 0).toFixed(2);
    $('trip-count').textContent = state.isRecording ? `${ARCHIVE.counts().gps} mẫu GPS · đang lưu` : 'Ghi khi nhấn BẮT ĐẦU';
    const alert = $('alert-panel');
    let heading = 'Sẵn sàng', detail = 'Nhấn BẮT ĐẦU GHI để lưu hành trình.', warn = false;
    if (state.gpsState !== 'ok') {
      heading = state.gpsState === 'waiting' ? 'Đang kết nối GPS' : 'Cần kiểm tra GPS';
      detail = state.gpsMessage;
      warn = state.gpsState !== 'waiting';
    } else if (state.nearestEvent) {
      heading = 'Điểm xóc đã ghi nhận ở phía trước';
      detail = `Còn khoảng ${Math.round(state.nearestEvent.distance)} m theo GPS; chỉ là ước tính từ dữ liệu đã lưu.`;
      warn = true;
    } else if (state.recReason !== 'Mức tham chiếu cài đặt') {
      heading = 'Có yếu tố cần chú ý';
      detail = state.recReason + '. Số tốc độ chỉ để tham khảo.';
      warn = true;
    } else if (state.isRecording) {
      heading = 'Đang ghi hành trình';
      detail = 'Đang lưu cục bộ; có thể Upload ngay mà không cần dừng ghi.';
    } else {
      heading = 'GPS sẵn sàng';
      detail = 'Có thể bắt đầu ghi. Mức gợi ý hiện tại là giá trị cấu hình.';
    }
    alert.classList.toggle('warning',warn);
    $('alert-title').textContent = heading;
    $('alert-detail').textContent = detail;
  }
  function scheduleRender() {
    // Khi modal đang mở, không vẽ lại bảng điều khiển ở phía sau.
    if (document.body.classList.contains('dialog-open') || state.renderPending) return;
    state.renderPending = true;
    requestAnimationFrame(render);
  }

  function initDB() {
    return new Promise(resolve => {
      if (!('indexedDB' in window)) { resolve(null); return; }
      try {
        const req = indexedDB.open(DB_NAME,2);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(STORE_NAME))
            req.result.createObjectStore(STORE_NAME,{keyPath:'id',autoIncrement:true});
          if (!req.result.objectStoreNames.contains('archiveSessions'))
            req.result.createObjectStore('archiveSessions',{keyPath:'id'});
          if (!req.result.objectStoreNames.contains('archiveChunks'))
            req.result.createObjectStore('archiveChunks',{keyPath:'key'});
        };
        req.onsuccess = () => { state.db=req.result; resolve(state.db); };
        req.onerror = () => resolve(null);
      } catch { resolve(null); }
    });
  }
  function saveTrip() {
    if (!state.db || !state.activeTrip) return Promise.resolve(false);
    const snapshot = { ...state.activeTrip, samples:[...state.activeTrip.samples] };
    return new Promise(resolve => {
      try {
        const tx = state.db.transaction(STORE_NAME,'readwrite');
        tx.objectStore(STORE_NAME).put(snapshot);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      } catch { resolve(false); }
    });
  }
  function readTrips() {
    return new Promise(resolve => {
      if (!state.db) { resolve([]); return; }
      try {
        const req = state.db.transaction(STORE_NAME,'readonly').objectStore(STORE_NAME).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch { resolve([]); }
    });
  }
  async function wakeUp() {
    try { if ('wakeLock' in navigator && document.visibilityState === 'visible') state.wakeLock = await navigator.wakeLock.request('screen'); }
    catch { /* một số trình duyệt không hỗ trợ Wake Lock */ }
  }
  async function toggleRecording() {
    if (state.recordBusy || !state.archiveReady) {
      if (!state.archiveReady) $('alert-detail').textContent='Bộ nhớ hành trình chưa sẵn sàng. Kiểm tra dung lượng hoặc quyền lưu dữ liệu.';
      return;
    }
    state.recordBusy=true; $('btn-record').disabled=true;
    try {
      if (!state.isRecording) {
        // iOS permission prompt MUST be initiated synchronously from user's click.
        // Calling requestMotionAccess after awaiting IndexedDB loses user activation.
        if(state.calibrationStatus!=='ready') requestMotionAccess().catch(()=>{});
        if(settings.voiceEnabled) void unlockAudioFromGesture().catch(()=>{});
        // Start only after a durable session record is committed to IndexedDB.
        await ARCHIVE.start(settings,{
          userAgent:navigator.userAgent,language:navigator.language,
          timezoneOffsetMinutes:new Date().getTimezoneOffset(),
          viewport:{width:innerWidth,height:innerHeight,devicePixelRatio:devicePixelRatio},
          secureContext:window.isSecureContext,
          geolocationSupported:!!navigator.geolocation,
          motionSupported:!!window.DeviceMotionEvent,
          calibrationAtStart:{status:state.calibrationStatus,at:state.lastCalibrationAt||null,
            gravityBaseMps2:state.gravityBase, vibrationG:state.vibration}
        });
        state.activeTrip={ startedAt:new Date().toISOString(),distanceKm:0,gpsCount:0 };
        state.lastMotionRecordAt=0;
        state.isRecording=true;
        $('record-label').textContent='■ DỪNG GHI';
        $('record-subtext').textContent='Đang lưu dữ liệu trên máy';
        $('btn-record').classList.add('active');
        if(state.gpsState!=='ok') startGPS();
        await wakeUp();
      } else {
        // Disable new samples, then seal the last local chunk without losing existing data.
        state.isRecording=false;
        stopBeepSequence(); state.nextBeepAllowedAt=0;
        await ARCHIVE.stop();
        $('record-label').textContent='● BẮT ĐẦU GHI';
        $('record-subtext').textContent='Lưu hành trình trên máy';
        $('btn-record').classList.remove('active');
        try { await state.wakeLock?.release(); } catch {}
        state.wakeLock=null;
        if(syncPrefs.uploadOnStop && tokenInSession) void uploadGitHub(true);
      }
    } catch(err) {
      if(ARCHIVE.isRecording()) state.isRecording=true; // Cho phép thử DỪNG GHI lại sau lỗi đĩa.
      $('sync-status-box').textContent=`Lỗi lưu hành trình: ${err.message}`;
      $('alert-detail').textContent=`Lỗi lưu hành trình: ${err.message}`;
      // If writing the final chunk fails, do not claim it was saved.
    } finally { state.recordBusy=false;$('btn-record').disabled=false; scheduleRender();updateArchiveStats(); }
  }
  function download(content,name,mime) {
    const blob=new Blob([content],{type:mime}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url;a.download=name;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  async function exportJSON() {
    const all=await ARCHIVE.exportData(await readTrips(),events);
    download(JSON.stringify(all,null,2),`roadsense-full-backup-${Date.now()}.json`,'application/json;charset=utf-8');
    $('sync-status-box').textContent=`Đã tạo bản sao lưu gồm ${all.sessions.length} hành trình v5, ${all.chunks.length} phần dữ liệu và ${all.legacyV4.trips.length} hành trình v4.`;
  }
  async function exportCSV() {
    download(await ARCHIVE.exportCsv(),`roadsense-gps-${Date.now()}.csv`,'text/csv;charset=utf-8');
    $('sync-status-box').textContent='Đã chuẩn bị CSV các mẫu GPS v5 để đối chiếu trong Excel.';
  }
  function updateTokenFromInput() {
    tokenInSession=$('session-gh-token').value.trim();
    if(syncPrefs.rememberToken) {
      if(tokenInSession) localStorage.setItem(GH_TOKEN_KEY,tokenInSession);
      else localStorage.removeItem(GH_TOKEN_KEY);
    }
  }
  function applySyncPrefs() {
    $('setting-auto-sync').checked=!!syncPrefs.auto;
    $('setting-sync-interval').value=String([2,3,5,10,15].includes(Number(syncPrefs.interval))?syncPrefs.interval:3);
    $('setting-upload-on-stop').checked=!!syncPrefs.uploadOnStop;
    $('remember-gh-token').checked=!!syncPrefs.rememberToken;
    $('setting-gh-repo').value=GH_REPO;
    if(syncPrefs.rememberToken) tokenInSession=localStorage.getItem(GH_TOKEN_KEY)||'';
    $('session-gh-token').value=tokenInSession;
  }
  function saveSyncPrefs() {
    syncPrefs.auto=$('setting-auto-sync').checked;
    syncPrefs.interval=Number($('setting-sync-interval').value)||3;
    syncPrefs.uploadOnStop=$('setting-upload-on-stop').checked;
    syncPrefs.rememberToken=$('remember-gh-token').checked;
    localStorage.setItem(SYNC_PREF_KEY,JSON.stringify(syncPrefs));
    updateTokenFromInput();
    if(!syncPrefs.rememberToken) localStorage.removeItem(GH_TOKEN_KEY);
    updateArchiveStats();
  }
  async function updateArchiveStats() {
    if(!state.archiveReady) return;
    try {
      const x=await ARCHIVE.stats();
      $('archive-stats').textContent=`Đã lưu: ${x.sessions} hành trình, ${x.chunks} phần dữ liệu · Chưa Upload: ${x.pending} phần`+
        ` · Mẫu đang đợi lưu: ${x.unsaved}.`+
        `\nTự đồng bộ: ${syncPrefs.auto?'Bật, mỗi '+syncPrefs.interval+' phút':'Tắt'} · Token: ${tokenInSession?'Đã nhập':'Chưa nhập'}.`;
    } catch(e) { $('archive-stats').textContent=`Không đọc được trạng thái lưu trữ: ${e.message}`; }
  }
  async function uploadGitHub(background=false) {
    if(state.uploadBusy) return;
    updateTokenFromInput();
    const box=$('sync-status-box');
    if(!tokenInSession) {
      if(!background) box.textContent='Bạn cần nhập GitHub Token để Upload. Dữ liệu vẫn được giữ trên điện thoại.';
      return;
    }
    if(!navigator.onLine) {box.textContent='Mất Internet. Dữ liệu đang chờ đồng bộ, không bị xóa.';return;}
    state.uploadBusy=true;$('btn-start-upload').disabled=true;
    try {
      const result=await ARCHIVE.sync(tokenInSession,msg=>box.textContent=msg);
      if(result.skipped) return;
      box.textContent=`Đồng bộ thành công: ${result.uploaded} phần dữ liệu mới lên ${GH_REPO}. `+
        'Nếu đang ghi, những mẫu tiếp theo vẫn được thu thập và sẽ Upload ở lượt sau.';
      if(result.link) { const a=$('last-upload-link');a.href=result.link;a.hidden=false; }
      state.lastAutoSyncAt=Date.now();
    } catch(err) {box.textContent=`Upload chưa hoàn tất: ${err.message}. Những phần đã gửi được giữ nguyên, phần chưa gửi sẽ thử lại.`;}
    finally { state.uploadBusy=false;$('btn-start-upload').disabled=false;updateArchiveStats(); }
  }

  function bind() {
    $('btn-settings').addEventListener('click',()=>{ fillForm(settings); modal('settings-modal',true); });
    $('close-settings').addEventListener('click',()=>modal('settings-modal',false));
    $('btn-sync').addEventListener('click',()=>{ applySyncPrefs(); updateArchiveStats(); modal('sync-modal',true); });
    $('close-sync').addEventListener('click',()=>modal('sync-modal',false));
    $('btn-theme').addEventListener('click',()=>{ settings.theme=resolvedTheme()==='dark'?'light':'dark'; writeJSON(SETTINGS_KEY,settings); applyAppearance(); });
    $('btn-gps').addEventListener('click',startGPS);
    $('btn-record').addEventListener('click',toggleRecording);
    // Nút CÂN BẰNG đã được thay bằng trạng thái tự cân bằng, không cần bấm.
    $('btn-request-motion').addEventListener('click',async()=>{
      beginAutoCalibration();
      const msg=await requestMotionAccess();
      if (msg.includes('chưa') || msg.includes('không') || msg.includes('Lỗi')) setCalibrationStatus('unavailable','Cần cấp quyền cảm biến');
      $('gps-diagnostics').textContent += `\nCảm biến: ${msg}`;
    });
    document.querySelectorAll('.mode-option').forEach(btn=>btn.addEventListener('click',()=>{
      if (!Object.hasOwn(MODES,btn.dataset.mode)) return;
      settings.mode=btn.dataset.mode;
      writeJSON(SETTINGS_KEY,settings);
      ARCHIVE.record({kind:'mode_change',at:Date.now(),mode:settings.mode});
      scheduleRender();
    }));
    $('setting-ui-scale').addEventListener('input',e=>{ $('setting-ui-scale-val').textContent=`${e.target.value}%`; });
    $('setting-rec-speed-size').addEventListener('input',e=>{ $('setting-rec-speed-size-val').textContent=`${e.target.value} px`; });
    $('setting-gps-speed-size').addEventListener('input',e=>{ $('setting-gps-speed-size-val').textContent=`${e.target.value} px`; });
    $('setting-hero-color').addEventListener('input',previewHeroSwatch);
    $('setting-beep-volume').addEventListener('input',e=>{ $('setting-beep-volume-val').textContent=`${e.target.value}%`; });
    $('btn-voice-preview').addEventListener('click',previewBeep);
    $('btn-reset-settings').addEventListener('click',()=>fillForm(DEFAULTS));
    $('settings-form').addEventListener('submit',e=>{
      e.preventDefault();
      const input = $('setting-hero-color');
      input.value = input.value.trim();
      if (!heroHexValid(input.value)) {
        previewHeroSwatch();
        input.focus();
        input.reportValidity();
        return;
      }
      const priorGPS=JSON.stringify([settings.highAccuracy,settings.gpsTimeout,settings.gpsMaxAge,settings.gpsMaxAccuracy]);
      settings=readForm();
      if (!settings.voiceEnabled) { stopBeepSequence(); state.nextBeepAllowedAt=0; }
      else void unlockAudioFromGesture().catch(()=>{});
      writeJSON(SETTINGS_KEY,settings);
      ARCHIVE.record({kind:'settings_change',at:Date.now(),settings:{...settings}});
      applyAppearance();
      if (priorGPS!==JSON.stringify([settings.highAccuracy,settings.gpsTimeout,settings.gpsMaxAge,settings.gpsMaxAccuracy])) startGPS();
      state.nearestEvent=findUpcomingEvent();
      modal('settings-modal',false); scheduleRender();
    });
    $('btn-export').addEventListener('click',()=>exportJSON().catch(e=>$('sync-status-box').textContent=e.message));
    $('btn-export-csv').addEventListener('click',()=>exportCSV().catch(e=>$('sync-status-box').textContent=e.message));
    $('btn-start-upload').addEventListener('click',()=>uploadGitHub(false));
    $('session-gh-token').addEventListener('input',()=>{updateTokenFromInput();updateArchiveStats();});
    ['setting-auto-sync','setting-sync-interval','setting-upload-on-stop','remember-gh-token']
      .forEach(id=>$(id).addEventListener('change',saveSyncPrefs));
    $('btn-clear-token').addEventListener('click',()=>{
      tokenInSession='';$('session-gh-token').value='';localStorage.removeItem(GH_TOKEN_KEY);
      syncPrefs.rememberToken=false;$('remember-gh-token').checked=false;
      localStorage.setItem(SYNC_PREF_KEY,JSON.stringify(syncPrefs));
      $('sync-status-box').textContent='Đã xóa token của RoadSense khỏi trang và bộ nhớ trình duyệt.';
      updateArchiveStats();
    });
    // Không đóng hộp thoại bằng cách chạm nền: tránh bấm nhầm trên màn hình nhỏ.
    document.addEventListener('keydown',e=>{ if(e.key==='Escape') { modal('settings-modal',false); modal('sync-modal',false); } });
    document.addEventListener('visibilitychange',()=>{
      if (document.visibilityState !== 'visible') stopBeepSequence();
      if (document.visibilityState === 'visible') {
        if (state.isRecording) wakeUp();
        else if (state.motionReceived && Date.now()-state.sensorAt > 10000) beginAutoCalibration();
      }
    });
    window.addEventListener('orientationchange',()=>{ if (!state.isRecording) beginAutoCalibration(); });
    const mq=window.matchMedia?.('(prefers-color-scheme: light)');
    mq?.addEventListener?.('change',()=>{ if(settings.theme==='auto') applyAppearance(); });
  }
  function start() {
    bind();
    fillForm(settings);
    applyAppearance();
    render();
    $('setting-gh-repo').value=GH_REPO;
    applySyncPrefs();
    initDB().then(async db=>{
      await ARCHIVE.init(db,()=>updateArchiveStats());
      state.archiveReady=true;
      updateArchiveStats();
      // If an upload failed before reloading, retry remaining sealed parts when token is available.
      if(syncPrefs.auto && tokenInSession) setTimeout(()=>uploadGitHub(true),3000);
    }).catch(err=>{state.archiveReady=false;$('sync-status-box').textContent=`Không mở được kho dữ liệu: ${err.message}`;});
    window.addEventListener('devicemotion',onMotion,{passive:true});
    beginAutoCalibration(); // Tự lấy mẫu ngay khi mở web, nếu cảm biến đã được cho phép.
    window.setTimeout(()=>{
      if (!state.motionReceived && state.calibrating) setCalibrationStatus('unavailable',
        typeof window.DeviceMotionEvent?.requestPermission === 'function' ?
        'iPhone: cấp quyền khi BẮT ĐẦU' : 'Chưa nhận tín hiệu cảm biến');
    },4000);
    startGPS();
    window.setInterval(()=>{
      if (state.gpsState==='ok' && Date.now()-state.lastGoodAt > Math.max(15000,settings.gpsTimeout*2000)) {
        state.speed=null; state.nearestEvent=null;
        if(state.isRecording) ARCHIVE.record({kind:'gps_gap',at:Date.now(),lastGoodAt:state.lastGoodAt});
        setGps('error','Không nhận tọa độ GPS mới; kiểm tra định vị và chế độ tiết kiệm pin.');
      }
      if(state.isRecording) ARCHIVE.flush(false).catch(e=>{
        $('sync-status-box').textContent=`Không lưu được dữ liệu tạm: ${e.message}`;
      });
      if(state.archiveReady && syncPrefs.auto && tokenInSession && navigator.onLine && !state.uploadBusy &&
        Date.now()-state.lastAutoSyncAt>=Number(syncPrefs.interval)*60000) {
        state.lastAutoSyncAt=Date.now();
        void uploadGitHub(true);
      }
      scheduleRender();
    },15000);
    // Nhịp kiểm tra 1 giây giữ cảnh báo có thể lặp dù GPS chỉ phát tọa độ vài giây/lần.
    window.setInterval(maybeBeep,1000);
    if ('serviceWorker' in navigator && window.isSecureContext) {
      window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('Service Worker:',e.message)));
    }
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
