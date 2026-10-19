(function () {
  'use strict';

  const searchInput = document.getElementById('regionSearch');
  const resultsElement = document.getElementById('regionResults');
  const selectedElement = document.getElementById('selectedRegion');
  const weatherEnabled = document.getElementById('weatherEnabled');
  const qweatherHost = document.getElementById('qweatherHost');
  const qweatherKey = document.getElementById('qweatherKey');
  const statusMessage = document.getElementById('statusMessage');
  const dateOverrideForm = document.getElementById('dateOverrideForm');
  const dateOverrideList = document.getElementById('dateOverrideList');
  const overrideDate = document.getElementById('overrideDate');
  const overrideType = document.getElementById('overrideType');
  const overrideWeekday = document.getElementById('overrideWeekday');
  const overrideWeekdayField = document.getElementById('overrideWeekdayField');
  const overrideNote = document.getElementById('overrideNote');
  const calendarStatus = document.getElementById('calendarStatus');
  let dateOverrides = [];
  let regions = [];
  let selectedRegion = null;
  let savedSettings = {};


  function showStatus(message, isSuccess) {
    statusMessage.textContent = message;
    statusMessage.className = isSuccess ? 'notice success' : 'notice';
  }

  function renderSelectedRegion() {
    selectedElement.textContent = selectedRegion ? selectedRegion.label : '尚未选择地区';
  }

  function renderResults(query) {
    resultsElement.replaceChildren();
    if (!query.trim()) {
      resultsElement.innerHTML = '<p class="empty-state">输入地区名称或代码后，这里会显示匹配结果。</p>';
      return;
    }
    const matches = window.ChinaRegionSearch.searchDistricts(regions, query, 20);
    if (!matches.length) {
      resultsElement.innerHTML = '<p class="empty-state">没有找到匹配地区，试试更短的关键词。</p>';
      return;
    }
    for (const region of matches) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'region-option';
      button.setAttribute('role', 'option');
      button.innerHTML = '<strong></strong><span></span>';
      button.querySelector('strong').textContent = region.label;
      button.querySelector('span').textContent = region.province + ' · ' + region.city + ' · ' + region.district;
      button.addEventListener('click', () => {
        selectedRegion = {
          adminCode: region.code,
          label: region.label,
          province: region.province,
          city: region.city,
          district: region.district,
          qweatherLocationId: savedSettings.region && savedSettings.region.adminCode === region.code
            ? savedSettings.region.qweatherLocationId || null
            : null,
          latitude: savedSettings.region && savedSettings.region.adminCode === region.code
            ? savedSettings.region.latitude ?? null
            : null,
          longitude: savedSettings.region && savedSettings.region.adminCode === region.code
            ? savedSettings.region.longitude ?? null
            : null
        };
        renderSelectedRegion();
        window.electronAPI.logEvent('user.weather_region_selected', {
          adminCode: selectedRegion.adminCode,
          label: selectedRegion.label,
          province: selectedRegion.province,
          city: selectedRegion.city,
          district: selectedRegion.district,
          cachedLocationId: Boolean(selectedRegion.qweatherLocationId)
        });
        showStatus('已选择地区，点击“保存设置”后生效。', true);
      });
      resultsElement.appendChild(button);
    }
  }

  async function init() {
    try {
      savedSettings = await window.electronAPI.getWeatherSettings();
      const data = await window.electronAPI.getChinaDistrictCodes();
      regions = window.ChinaRegionSearch.buildDistrictIndex(data);
      if (savedSettings.region && typeof savedSettings.region.adminCode === 'string') {
        selectedRegion = savedSettings.region;
      }
      weatherEnabled.checked = savedSettings.enabled === true;
      qweatherHost.value = typeof savedSettings.apiHost === 'string' ? savedSettings.apiHost : '';
      qweatherKey.value = typeof savedSettings.apiKey === 'string' ? savedSettings.apiKey : '';
      renderSelectedRegion();
      renderResults('');
    } catch (error) {
      console.error('Failed to load China district data:', error);
      resultsElement.innerHTML = '<p class="empty-state">地区数据载入失败，请重启应用后重试。</p>';
      showStatus('无法载入地区数据：' + (error.message || '未知错误'), false);
    }
  }

  document.querySelectorAll('.day-choice').forEach(button => {
    button.addEventListener('click', async () => {
      const day = Number(button.dataset.day);
      await applyScheduleDay(day);
    });
  });

  async function applyScheduleDay(day) {
    window.electronAPI.logEvent('user.manual_schedule_day_selected', { day });
    const scheduleStatus = document.getElementById('scheduleStatus');
    try {
      await window.electronAPI.setScheduleDay(day);
      scheduleStatus.textContent = day <= 6
        ? '已切换为星期' + ['日', '一', '二', '三', '四', '五', '六'][day] + '的课表。'
        : '已恢复按当前日期自动使用课表。';
      scheduleStatus.className = 'notice success';
    } catch (error) {
      scheduleStatus.textContent = '切换失败：' + (error.message || '无法连接课表窗口');
      scheduleStatus.className = 'notice';
    }
  }

  document.getElementById('resetDaySchedule').addEventListener('click', () => applyScheduleDay(7));

  function showCalendarStatus(message, success = false) {
    calendarStatus.textContent = message;
    calendarStatus.className = success ? 'notice success' : 'notice';
  }

  function updateOverrideTypeFields() {
    overrideWeekdayField.classList.toggle('hidden', overrideType.value !== 'classDay');
  }

  function renderDateOverrides() {
    dateOverrideList.replaceChildren();
    if (!dateOverrides.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = '尚未设置特殊日期。';
      dateOverrideList.appendChild(empty);
      return;
    }
    for (const item of dateOverrides) {
      const row = document.createElement('div');
      row.className = 'date-override-row';
      const info = document.createElement('div');
      info.className = 'date-override-info';
      const title = document.createElement('strong');
      title.textContent = item.date + ' · ' + (item.type === 'holiday' ? '放假 / 无课' : '补课 / 调课（星期' + ['日','一','二','三','四','五','六'][item.dayOfWeek] + '课表）');
      const note = document.createElement('span');
      note.textContent = item.note || '无备注';
      info.append(title, note);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'secondary-button';
      remove.textContent = '删除';
      remove.addEventListener('click', () => removeDateOverride(item.date));
      row.append(info, remove);
      dateOverrideList.appendChild(row);
    }
  }

  async function loadDateOverrides() {
    try {
      dateOverrides = await window.electronAPI.getDateOverrides();
      renderDateOverrides();
    } catch (error) {
      dateOverrideList.textContent = '读取日期安排失败：' + (error.message || '未知错误');
    }
  }

  async function persistDateOverrides(nextOverrides, successMessage) {
    try {
      dateOverrides = await window.electronAPI.saveDateOverrides(nextOverrides);
      renderDateOverrides();
      showCalendarStatus(successMessage, true);
    } catch (error) {
      showCalendarStatus('保存失败：' + (error.message || '日期安排无效'), false);
    }
  }

  async function removeDateOverride(date) {
    await persistDateOverrides(dateOverrides.filter(item => item.date !== date), '已删除 ' + date + ' 的特殊安排。');
  }

  overrideType.addEventListener('change', updateOverrideTypeFields);
  dateOverrideForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!overrideDate.value) {
      showCalendarStatus('请先选择日期。');
      return;
    }
    const entry = {
      date: overrideDate.value,
      type: overrideType.value,
      dayOfWeek: overrideType.value === 'classDay' ? Number(overrideWeekday.value) : null,
      note: overrideNote.value.trim()
    };
    const nextOverrides = dateOverrides.filter(item => item.date !== entry.date);
    nextOverrides.push(entry);
    await persistDateOverrides(nextOverrides, '已保存 ' + entry.date + ' 的特殊安排。');
    overrideNote.value = '';
  });
  updateOverrideTypeFields();
  loadDateOverrides();

  searchInput.addEventListener('input', () => renderResults(searchInput.value));
  document.getElementById('resetSearch').addEventListener('click', () => {
    window.electronAPI.logEvent('user.weather_region_search_cleared');
    searchInput.value = '';
    renderResults('');
    showStatus('', true);
  });

  document.getElementById('saveSettings').addEventListener('click', async () => {
    const host = qweatherHost.value.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
    if ((host && !/^[a-z0-9.-]+(?::\d+)?$/i.test(host))) {
      showStatus('API Host 格式不正确，请只填写域名。', false);
      return;
    }
    if (weatherEnabled.checked && !host) {
      showStatus('启用天气数据获取前，请填写 QWeather 控制台分配的专用 API Host。', false);
      return;
    }
    if (weatherEnabled.checked && !selectedRegion) {
      showStatus('启用天气面板前，请先选择一个区县级地区。', false);
      return;
    }
    if (weatherEnabled.checked && !qweatherKey.value.trim()) {
      showStatus('启用天气面板前，请填写 QWeather API Key。', false);
      return;
    }

    const nextSettings = {
      enabled: weatherEnabled.checked,
      apiHost: host,
      apiKey: qweatherKey.value.trim(),
      region: selectedRegion ? {
        adminCode: selectedRegion.adminCode,
        label: selectedRegion.label,
        province: selectedRegion.province,
        city: selectedRegion.city,
        district: selectedRegion.district,
        qweatherLocationId: selectedRegion.qweatherLocationId || null,
        latitude: selectedRegion.latitude ?? null,
        longitude: selectedRegion.longitude ?? null
      } : null
    };
    try {
      savedSettings = await window.electronAPI.saveWeatherSettings(nextSettings);
      showStatus('设置已保存到本机，悬浮课表会自动读取天气配置。', true);
    } catch (error) {
      showStatus('保存失败：' + (error.message || '本地存储不可用'), false);
    }
  });

  const examTitleInput = document.getElementById('examTitle');
  const examDurationInput = document.getElementById('examDurationMinutes');
  const examShowPagesInput = document.getElementById('examShowPageCount');
  const examTotalPagesInput = document.getElementById('examTotalPages');
  const examTotalPagesField = document.getElementById('examTotalPagesField');
  const examFormStatus = document.getElementById('examFormStatus');
  const examCurrentDescription = document.getElementById('examCurrentDescription');
  const examCurrentBadge = document.getElementById('examCurrentBadge');
  const examHistoryList = document.getElementById('examHistoryList');
  const saveExamSettingsButton = document.getElementById('saveExamSettings');
  const startExamButton = document.getElementById('startExam');
  const pauseExamButton = document.getElementById('pauseExam');
  const resumeExamButton = document.getElementById('resumeExam');
  const endExamEarlyButton = document.getElementById('endExamEarly');
  const exitExamButton = document.getElementById('exitExam');
  let examFormDirty = false;

  function collectExamSettings() {
    return {
      title: examTitleInput.value,
      durationMinutes: Number(examDurationInput.value),
      showPageCount: examShowPagesInput.checked,
      totalPages: examShowPagesInput.checked ? Number(examTotalPagesInput.value) : null
    };
  }

  function populateExamSettings(settings) {
    examTitleInput.value = settings.title || '';
    examDurationInput.value = String(settings.durationMinutes || 120);
    examShowPagesInput.checked = settings.showPageCount === true;
    examTotalPagesInput.value = String(settings.totalPages || 1);
    examTotalPagesField.classList.toggle('hidden', !examShowPagesInput.checked);
  }

  function showExamFormStatus(message, success = false) {
    examFormStatus.textContent = message;
    examFormStatus.className = success ? 'notice success' : 'notice';
  }

  function formatExamDuration(seconds) {
    const value = Math.max(0, Number(seconds) || 0);
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const remainder = value % 60;
    if (hours > 0) return hours + ' 小时 ' + minutes + ' 分钟';
    if (minutes > 0) return minutes + ' 分钟' + (remainder ? ' ' + remainder + ' 秒' : '');
    return remainder + ' 秒';
  }

  function formatExamDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '时间未知';
    return date.toLocaleString();
  }

  function getExamResultLabel(result) {
    return ({
      completed: '正常结束',
      ended_early: '提前结束',
      interrupted: '中断'
    })[result] || '未知结果';
  }

  function renderExamHistory(history) {
    examHistoryList.replaceChildren();
    if (!Array.isArray(history) || history.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = '还没有考试记录。完成或结束第一场考试后，记录会显示在这里。';
      examHistoryList.appendChild(empty);
      return;
    }
    for (const record of history.slice(0, 20)) {
      const row = document.createElement('article');
      row.className = 'exam-history-row';
      const info = document.createElement('div');
      info.className = 'exam-history-info';
      const title = document.createElement('strong');
      title.textContent = record.title;
      const details = document.createElement('span');
      details.textContent = '计划 ' + formatExamDuration(record.durationSeconds)
        + ' · 实际 ' + formatExamDuration(record.elapsedSeconds)
        + ' · ' + formatExamDate(record.startedAt);
      info.append(title, details);
      const result = document.createElement('span');
      result.className = 'exam-history-result';
      result.textContent = getExamResultLabel(record.result);
      row.append(info, result);
      examHistoryList.appendChild(row);
    }
  }

  function renderExamSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return;
    if (!examFormDirty) populateExamSettings(snapshot.settings || {});
    const session = snapshot.activeSession;
    const hasActive = Boolean(session);
    const running = hasActive && session.status === 'running';
    const paused = hasActive && session.status === 'paused';
    const finished = hasActive && session.status === 'finished';

    for (const input of [examTitleInput, examDurationInput, examShowPagesInput, examTotalPagesInput]) {
      input.disabled = hasActive;
    }
    saveExamSettingsButton.disabled = hasActive;
    startExamButton.disabled = hasActive;
    pauseExamButton.style.display = running ? 'inline-flex' : 'none';
    resumeExamButton.style.display = paused ? 'inline-flex' : 'none';
    endExamEarlyButton.style.display = (running || paused) ? 'inline-flex' : 'none';
    exitExamButton.style.display = finished ? 'inline-flex' : 'none';

    if (!session) {
      examCurrentDescription.textContent = '当前没有进行中的考试。';
      examCurrentBadge.textContent = '未开始';
      examCurrentBadge.dataset.status = 'idle';
    } else {
      examCurrentDescription.textContent = session.title + ' · 计划 ' + formatExamDuration(session.durationSeconds)
        + ' · 剩余 ' + formatExamDuration(session.remainingSeconds);
      examCurrentBadge.textContent = finished
        ? (session.result === 'ended_early' ? '提前结束' : '考试结束')
        : (paused ? '已暂停' : '计时中');
      examCurrentBadge.dataset.status = finished ? 'finished' : (paused ? 'paused' : 'running');
    }
    renderExamHistory(snapshot.history);
  }

  async function runExamSettingsAction(action, successMessage) {
    try {
      const snapshot = await action();
      examFormDirty = false;
      renderExamSnapshot(snapshot);
      if (successMessage) showExamFormStatus(successMessage, true);
    } catch (error) {
      showExamFormStatus(error.message || '操作失败，请稍后重试。');
    }
  }

  for (const input of [examTitleInput, examDurationInput, examShowPagesInput, examTotalPagesInput]) {
    input.addEventListener('input', () => { examFormDirty = true; });
  }
  examShowPagesInput.addEventListener('change', () => {
    examTotalPagesField.classList.toggle('hidden', !examShowPagesInput.checked);
  });

  saveExamSettingsButton.addEventListener('click', () => runExamSettingsAction(
    () => window.electronAPI.saveExamSettings(collectExamSettings()),
    '考试配置已保存。'
  ));
  startExamButton.addEventListener('click', () => {
    if (!examTitleInput.value.trim()) {
      examTitleInput.focus();
      showExamFormStatus('请先填写考试名称。');
      return;
    }
    runExamSettingsAction(() => window.electronAPI.startExam(collectExamSettings()), '考试已开始。');
  });
  pauseExamButton.addEventListener('click', () => runExamSettingsAction(
    () => window.electronAPI.pauseExam(), '考试计时已暂停。'
  ));
  resumeExamButton.addEventListener('click', () => runExamSettingsAction(
    () => window.electronAPI.resumeExam(), '考试已继续计时。'
  ));
  endExamEarlyButton.addEventListener('click', () => {
    if (!window.confirm('确定提前结束本场考试并保存记录吗？')) return;
    runExamSettingsAction(() => window.electronAPI.endExamEarly(), '考试已结束，记录已保存。');
  });
  exitExamButton.addEventListener('click', () => {
    if (!window.confirm('退出考试面板并恢复普通课表？本场考试记录已经保存。')) return;
    runExamSettingsAction(() => window.electronAPI.exitExam(), '已退出考试模式，普通课表已恢复。');
  });

  window.electronAPI.on('examStateChanged', (_event, snapshot) => renderExamSnapshot(snapshot));
  window.electronAPI.getExamState().then(renderExamSnapshot).catch(error => {
    showExamFormStatus('读取考试状态失败：' + (error.message || '未知错误'));
  });

  document.querySelectorAll('.nav-item').forEach(button => {
    button.addEventListener('click', () => {
      window.electronAPI.logEvent('user.settings_section_changed', { section: button.dataset.section });
      document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item === button));
      document.querySelectorAll('.settings-section').forEach(panel => panel.classList.toggle('hidden', panel.dataset.panel !== button.dataset.section));
    });
  });

  init();
})();
