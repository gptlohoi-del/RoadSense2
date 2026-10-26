/* RoadSense One View — thử nghiệm, không thay thế thiết bị đo chuyên dụng hoặc quy định ATGT. */
(() => {
  'use strict';

  const SETTINGS_KEY = 'roadsense_settings_v3';
  const EVENTS_KEY = 'roadsense_road_events_v3';
  const DB_NAME = 'RoadSenseDB';
  const STORE_NAME = 'trips';
  const G = 9.80665;
  const DEFAULTS = Object.freeze({
    theme: 'auto', fontSize: 'normal', uiScale: 100, mode: 'balanced',
    baseSpeed: 50, minSpeed: 15, maxSpeed: 90, lateralAccel: 1.6,
    vibrationThreshold: 0.35, vibrationPenalty: 15, warningRadius: 150,
    rememberBumps: true, highAccuracy: true, gpsTimeout: 15,
    gpsMaxAge: 2, gpsMaxAccuracy: 70, speedSmoothing: 0.45,
    vibrationSmoothing: 0.3, calibDelay: 1.5, voiceEnabled: false,
    voiceInterval: 12, voiceRate: 1.0, voiceMargin: 10
  });
  const FIELDS = {
    theme: 'setting-theme', fontSize: 'setting-font-size', uiScale: 'setting-ui-scale',
    mode: 'setting-mode', baseSpeed: 'setting-base-speed', minSpeed: 'setting-min-speed',
    maxSpeed: 'setting-max-speed', lateralAccel: 'setting-lateral-accel',
    vibrationThreshold: 'setting-vibration-threshold', vibrationPenalty: 'setting-vibration-penalty',
    warningRadius: 'setting-warning-radius', rememberBumps: 'setting-remember-bumps',
    highAccuracy: 'setting-high-accuracy', gpsTimeout: 'setting-gps-timeout',
    gpsMaxAge: 'setting-gps-max-age', gpsMaxAccuracy: 'setting-gps-max-accuracy',
    speedSmoothing: 'setting-speed-smoothing', vibrationSmoothing: 'setting-vibration-smoothing',
    calibDelay: 'setting-calib-delay', voiceEnabled: 'setting-voice-enabled',
    voiceInterval: 'setting-voice-interval', voiceRate: 'setting-voice-rate',
    voiceMargin: 'setting-voice-margin'
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
    if (!['normal','large','extra'].includes(safe.fontSize)) safe.fontSize = 'normal';
    if (!Object.hasOwn(MODES, safe.mode)) safe.mode = 'balanced';
    const constraints = {
      uiScale:[80,115], baseSpeed:[10,120], minSpeed:[5,70], maxSpeed:[20,130],
      lateralAccel:[0.6,3.5], vibrationThreshold:[0.1,2], vibrationPenalty:[0,40],
      warningRadius:[30,1000], gpsTimeout:[5,60], gpsMaxAge:[0,30],
      gpsMaxAccuracy:[10,300], speedSmoothing:[0.1,1], vibrationSmoothing:[0.05,1],
      calibDelay:[1.2,5], voiceInterval:[5,90], voiceRate:[0.7,1.5], voiceMargin:[0,30]
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
    recReason: 'Theo mức cấu hình', lastVoiceAt: 0, lastBumpAt: 0,
    uploadBusy: false, lastNotice: '', renderPending: false
  };

  function fillForm(source) {
    for (const [key, id] of Object.entries(FIELDS)) {
      const el = $(id);
      if (el.type === 'checkbox') el.checked = source[key];
      else el.value = source[key];
    }
    $('setting-ui-scale-val').textContent = `${source.uiScale}%`;
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
  function applyAppearance() {
    const theme = resolvedTheme();
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.setProperty('--ui-scale', String(settings.uiScale / 100));
    const size = { normal:'clamp(2.4rem, 10.8vw, 5.3rem)', large:'clamp(2.7rem, 11.6vw, 5.8rem)', extra:'clamp(3rem, 12.5vw, 6.2rem)' };
    document.documentElement.style.setProperty('--number-size', size[settings.fontSize]);
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
    if (!finite(c.accuracy) || c.accuracy > settings.gpsMaxAccuracy) {
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
      if (!trip.samples.length || fix.at - trip.samples[trip.samples.length-1].at >= 1000) {
        if (trip.samples.length < 15000) trip.samples.push({ ...fix, speedKmh: state.speed === null ? null : Math.round(state.speed*10)/10, vibrationG:state.vibration });
      }
    }
    state.nearestEvent = findUpcomingEvent();
    maybeSpeak();
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
  function maybeSpeak() {
    calculateRecommendation();
    const hazard = state.nearestEvent || state.recReason !== 'Mức tham chiếu cài đặt';
    if (!settings.voiceEnabled || !hazard || !state.isRecording || state.gpsState !== 'ok' ||
        state.speed === null || state.speed < state.recommended + settings.voiceMargin ||
        Date.now()-state.lastVoiceAt < settings.voiceInterval*1000 || !('speechSynthesis' in window)) return;
    state.lastVoiceAt = Date.now();
    const utterance = new SpeechSynthesisUtterance(`Chú ý. Tốc độ tham khảo ${state.recommended} ki lô mét một giờ.`);
    utterance.lang = 'vi-VN';
    utterance.rate = settings.voiceRate;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
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
    $('rec-speed').textContent = state.recommended;
    $('rec-reason').textContent = state.recReason;
    $('curr-speed').textContent = state.gpsState === 'ok' && state.speed !== null ? Math.round(state.speed) : '--';
    $('gps-accuracy-hint').textContent = state.gpsState === 'ok' ? `Sai số ±${Math.round(state.gpsAccuracy)} m` : 'Đợi dữ liệu vị trí';
    $('vibration-score').textContent = state.vibration === null ? '--' : state.vibration.toFixed(2);
    $('sensor-state').textContent = state.calibrationStatus === 'ready' && state.vibration !== null ?
      'Đã tự cân bằng' : state.calibrationStatus === 'measuring' ? 'Đang tự cân bằng' : 'Chưa có dữ liệu cảm biến';
    $('curve-radius').textContent = state.curveRadius === null ? '--' : Math.round(state.curveRadius);
    $('countdown-value').textContent = state.nearestEvent ? Math.round(state.nearestEvent.distance) : '--';
    $('trip-distance').textContent = (state.activeTrip?.distanceKm || 0).toFixed(2);
    $('trip-count').textContent = state.isRecording ? `${state.activeTrip?.samples.length || 0} mẫu GPS` : 'Ghi khi nhấn BẮT ĐẦU';
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
      detail = 'Dữ liệu GPS được lưu cục bộ; có thể xuất JSON khi dừng.';
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
        const req = indexedDB.open(DB_NAME,1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(STORE_NAME))
            req.result.createObjectStore(STORE_NAME,{keyPath:'id',autoIncrement:true});
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
    state.isRecording = !state.isRecording;
    if (state.isRecording) {
      state.activeTrip = { id:Date.now(),startedAt:new Date().toISOString(),endedAt:null,distanceKm:0,samples:[] };
      $('record-label').textContent = '■ DỪNG GHI';
      $('record-subtext').textContent = 'Đang lưu dữ liệu trên máy';
      $('btn-record').classList.add('active');
      // Với iPhone, quyền cảm biến chỉ có thể xin từ lần nhấn BẮT ĐẦU.
      // Để máy đứng yên đến khi tự cân bằng xong, rồi mới di chuyển.
      if (state.calibrationStatus !== 'ready') {
        requestMotionAccess().then(msg => {
          if (msg.includes('chưa') || msg.includes('không') || msg.includes('Lỗi'))
            setCalibrationStatus('unavailable','Cần cấp quyền cảm biến');
        }).catch(()=>setCalibrationStatus('unavailable','Không truy cập được cảm biến'));
      }
      if (state.gpsState !== 'ok') startGPS();
      await wakeUp();
    } else {
      $('record-label').textContent = '● BẮT ĐẦU GHI';
      $('record-subtext').textContent = 'Lưu hành trình trên máy';
      $('btn-record').classList.remove('active');
      if (state.activeTrip) state.activeTrip.endedAt=new Date().toISOString();
      await saveTrip();
      try { await state.wakeLock?.release(); } catch { /* ignore */ }
      state.wakeLock=null;
    }
    scheduleRender();
  }
  function dataset(trips) {
    const merged = [...trips];
    if (state.activeTrip && !merged.some(t => t.id===state.activeTrip.id)) merged.push(state.activeTrip);
    return { app:'RoadSense One View', formatVersion:3, exportedAt:new Date().toISOString(), trips:merged, roadEvents:events };
  }
  async function exportJSON() {
    const data = dataset(await readTrips());
    const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download=`roadsense-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),60000);
    $('sync-status-box').textContent=`Đã chuẩn bị tệp JSON (${data.trips.length} hành trình, ${events.length} điểm xóc). Nếu không thấy tệp, kiểm tra mục Tải xuống của trình duyệt.`;
  }
  function utf8Base64(text) {
    const bytes = new TextEncoder().encode(text);
    let out='';
    for (let i=0;i<bytes.length;i+=8192) out+=String.fromCharCode(...bytes.subarray(i,i+8192));
    return btoa(out);
  }
  async function uploadGitHub() {
    if (state.uploadBusy) return;
    const repo = $('setting-gh-repo').value.trim();
    const token = $('session-gh-token').value.trim();
    const box = $('sync-status-box');
    if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo) || !token) {
      box.textContent='Nhập repository dạng owner/repo và token hợp lệ.';
      return;
    }
    writeJSON('roadsense_gh_repo_v3',repo); // không bao giờ ghi token
    state.uploadBusy=true;
    $('btn-start-upload').disabled=true;
    box.textContent='Đang đóng gói JSON và kết nối GitHub API...';
    try {
      const json=JSON.stringify(dataset(await readTrips()));
      if (new TextEncoder().encode(json).length > 950000) throw new Error('Dữ liệu vượt 950 KB. Hãy xuất JSON, chia nhỏ hoặc dùng phương thức khác.');
      const file=`trips/roadsense-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
      const url=`https://api.github.com/repos/${repo}/contents/${file}`;
      const response=await fetch(url,{
        method:'PUT',
        headers:{'Accept':'application/vnd.github+json','Authorization':`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},
        body:JSON.stringify({message:'Add RoadSense trip data',content:utf8Base64(json)})
      });
      const body=await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(`GitHub HTTP ${response.status}: ${body.message || 'không rõ lỗi'}`);
      box.textContent=`Đã tải lên GitHub thành công: ${repo}/${file}. Hãy kiểm tra quyền riêng tư của repository.`;
    } catch(e) { box.textContent=`Không thể tải lên: ${e.message}. Bạn có thể dùng nút Xuất JSON để sao lưu cục bộ.`; }
    finally { state.uploadBusy=false; $('btn-start-upload').disabled=false; }
  }

  function bind() {
    $('btn-settings').addEventListener('click',()=>{ fillForm(settings); modal('settings-modal',true); });
    $('close-settings').addEventListener('click',()=>modal('settings-modal',false));
    $('btn-sync').addEventListener('click',()=>{ $('setting-gh-repo').value=readJSON('roadsense_gh_repo_v3',''); modal('sync-modal',true); });
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
      scheduleRender();
    }));
    $('setting-ui-scale').addEventListener('input',e=>{ $('setting-ui-scale-val').textContent=`${e.target.value}%`; });
    $('btn-reset-settings').addEventListener('click',()=>fillForm(DEFAULTS));
    $('settings-form').addEventListener('submit',e=>{
      e.preventDefault();
      const priorGPS=JSON.stringify([settings.highAccuracy,settings.gpsTimeout,settings.gpsMaxAge,settings.gpsMaxAccuracy]);
      settings=readForm();
      writeJSON(SETTINGS_KEY,settings);
      applyAppearance();
      if (priorGPS!==JSON.stringify([settings.highAccuracy,settings.gpsTimeout,settings.gpsMaxAge,settings.gpsMaxAccuracy])) startGPS();
      state.nearestEvent=findUpcomingEvent();
      modal('settings-modal',false); scheduleRender();
    });
    $('btn-export').addEventListener('click',()=>exportJSON().catch(e=>$('sync-status-box').textContent=e.message));
    $('btn-start-upload').addEventListener('click',uploadGitHub);
    // Không đóng hộp thoại bằng cách chạm nền: tránh bấm nhầm trên màn hình nhỏ.
    document.addEventListener('keydown',e=>{ if(e.key==='Escape') { modal('settings-modal',false); modal('sync-modal',false); } });
    document.addEventListener('visibilitychange',()=>{
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
    initDB().catch(()=>{});
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
        setGps('error','Không nhận tọa độ GPS mới; kiểm tra định vị và chế độ tiết kiệm pin.');
      }
      if (state.isRecording) saveTrip().catch(()=>{});
      scheduleRender();
    },15000);
    if ('serviceWorker' in navigator && window.isSecureContext) {
      window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('Service Worker:',e.message)));
    }
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
