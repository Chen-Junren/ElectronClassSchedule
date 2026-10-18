  const ipcRenderer = window.electronAPI;
  let scheduleData = getScheduleData();
  let globalContainer = document.getElementById('globalContainer')
  let classContainer = document.getElementById('classContainer')
  let countdownContainer = document.getElementById('countdownContainer')
  let countdowner = document.getElementById('countdowner')
  let currentFullName = document.getElementById('currentFullName')
  let countdownText = document.getElementById('countdownText')
  let weekEN = document.getElementById('weekEN')
  let weekCH = document.getElementById('weekCH')
  let countdownDays = document.getElementById('countdownDays')
  let miniCountdown = document.getElementById('miniCountdown')
  let rightSidebar = document.getElementById('rightSidebar')
  let leftSidebar = document.getElementById('leftSidebar')
  let weatherPanel = document.getElementById('weatherPanel')
  let weatherRegion = document.getElementById('weatherRegion')
  let weatherCurrent = document.getElementById('weatherCurrent')
  let weatherDescription = document.getElementById('weatherDescription')
  let weatherIcon = document.getElementById('weatherIcon')
  let weatherNextIcon = document.getElementById('weatherNextIcon')
  let weatherNextHour = document.getElementById('weatherNextHour')
  let root = document.querySelector(':root');
  const qweatherIconStylesheet = document.getElementById('qweatherIconStylesheet');
  let weatherIconsAvailable = Boolean(qweatherIconStylesheet && qweatherIconStylesheet.sheet);
  if (qweatherIconStylesheet) {
    qweatherIconStylesheet.addEventListener('error', () => {
      weatherIconsAvailable = false;
      if (weatherIcon) weatherIcon.style.display = 'none';
      if (weatherNextIcon) weatherNextIcon.style.display = 'none';
      if (weatherDescription) weatherDescription.style.display = 'block';
    });
  }

  function hexToRgb(value) {
    const match = /^#([0-9a-f]{6})$/i.exec(String(value || ''));
    if (!match) return null;
    const number = Number.parseInt(match[1], 16);
    return [(number >> 16) & 255, (number >> 8) & 255, number & 255].join(', ');
  }

  function applyAppearanceSettings(settings) {
    if (!settings || typeof settings !== 'object') return;
    const colorVariables = {
      classText: '--class-text-color',
      pastClassText: '--past-class-text-color',
      highlightText: '--highlight-text-color',
      countdownClassText: '--countdown-class-text-color',
      countdownText: '--countdown-text-color',
      leftSidebarText: '--left-sidebar-text-color',
      rightSidebarText: '--right-sidebar-text-color',
      weatherText: '--weather-text-color',
      weatherMutedText: '--weather-muted-text-color'
    };
    for (const [key, variable] of Object.entries(colorVariables)) {
      if (typeof settings[key] === 'string') root.style.setProperty(variable, settings[key]);
    }
    const backgroundRgb = hexToRgb(settings.barBackground);
    if (backgroundRgb) root.style.setProperty('--bar-bg-rgb', backgroundRgb);
  }

  ipcRenderer.getAppearanceSettings().then(applyAppearanceSettings).catch(error => {
    console.warn('[appearance] Could not load appearance settings:', error.message || error);
  });
  ipcRenderer.on('appearanceSettingsChanged', (_event, settings) => applyAppearanceSettings(settings));
  let isClassCountdown = true
  let isClassHidden = true
  let lastScheduleData = {
    currentHighlight: {
      index: null,
      type: null,
      fullName: null,
      countdown: null,
      countdownText: null
    },
    scheduleArray: [null, null, null],
    timetable: null,
    divider: [null, null],
    noClasses: false
  }

  function setScheduleClass() {
    let classHtml = '';
    for (let i = 0; i < scheduleData.scheduleArray.length; i++) {
      let inner = scheduleData.scheduleArray[i]
      if (scheduleData.scheduleArray[i].indexOf('@') != -1) {
        inner = `<div><div style="display:inline">${inner.split('@')[0]}</div><div class="subClass">${inner.split('@')[1]}</div></div>`
      }
      if (scheduleData.currentHighlight.index == i) {
        if (scheduleData.currentHighlight.type === 'current')
          classHtml += `<div class="class current" id="highlighted">${inner}</div>`
        else if (scheduleData.currentHighlight.type === 'upcoming')
          classHtml += `<div class="class upcoming" id="highlighted">${inner}</div>`
      }
      else {
        if (scheduleData.currentHighlight.index > i)
          classHtml += `<div class="class past">${inner}</div>`
        else
          classHtml += `<div class="class">${inner}</div>`
      }
      if (scheduleData.divider.indexOf(i) != -1)
        classHtml += '<div class="divider"></div>'
    }
    classContainer.innerHTML = classHtml
  }

  function setBackgroundDisplay() {
    let elements = document.getElementsByClassName('background')
    for (element of elements) {
      element.style.visibility = (scheduleData.currentHighlight.type === 'current' && isClassHidden) ? 'hidden' : 'visible'
    }
  }

  function setCountdownerContent() {
    currentFullName.innerText = scheduleData.currentHighlight.fullName;
    currentFullName.style.color = scheduleData.currentHighlight.type === 'current' ? 'var(--countdown-class-text-color, #00ff0a)' : 'var(--highlight-text-color, #00ff0a)'
    countdownText.innerText = scheduleData.currentHighlight.countdownText;
    if (scheduleData.currentHighlight.type === 'current') {
      if (isClassCountdown) {
        if (isClassHidden) { // 上课 并且开启了倒计时 并且 隐藏主体 -> 显示小窗口 
          countdownContainer.style.display = 'none'
          miniCountdown.style.display = 'block'
          miniCountdown.innerHTML = `<div class="currentClass">${currentFullName.innerText = scheduleData.currentHighlight.fullName}</div><div class="countdown" style="margin-left:5px">${scheduleData.currentHighlight.countdownText}</div>`
        } else { // 上课 并且开启了倒计时 并且 不隐藏主体 -> 正常计时
          countdownContainer.style.display = 'block'
          miniCountdown.style.display = 'none'
        }
      } else { // 上课 并且关闭了倒计时 -> 都不显示
        countdownContainer.style.display = 'none'
        miniCountdown.style.display = 'none'
      }
    }
    else { // 下课正常显示
      countdownContainer.style.display = 'block';
      miniCountdown.style.display = 'none'
    }
  }

  function setCountdownerPosition() {
    let highlightElement = document.getElementById('highlighted')
    let offset = {}
    if (scheduleData.currentHighlight.type === 'current') {
      offset = {
        x: highlightElement.offsetLeft - countdownContainer.offsetWidth / 2 + highlightElement.offsetWidth / 2,
        y: classContainer.offsetHeight
      }
    } else if (scheduleData.currentHighlight.type === 'upcoming') {
      if (scheduleData.currentHighlight.index != 0 && scheduleData.divider.indexOf((scheduleData.currentHighlight.index - 1)) != -1) {
        offset = {
          x: highlightElement.offsetLeft - countdownContainer.offsetWidth / 2 - Number(getComputedStyle(highlightElement).marginLeft.replace('px', '')) - getComputedStyle(root).getPropertyValue('--divider-width').replace('px', '') / 2 - getComputedStyle(root).getPropertyValue('--divider-margin').replace('px', ''),
          y: classContainer.offsetHeight
        }
      } else {
        offset = {
          x: highlightElement.offsetLeft - countdownContainer.offsetWidth / 2 - Number(getComputedStyle(highlightElement).marginLeft.replace('px', '')),
          y: classContainer.offsetHeight
        }
      }
    }
    if (scheduleData.currentHighlight.isEnd) {
      offset = {
        x: highlightElement.offsetLeft - countdownContainer.offsetWidth / 2 + highlightElement.offsetWidth + Number(getComputedStyle(highlightElement).marginLeft.replace('px', '')),
        y: classContainer.offsetHeight
      }
    }
    countdownContainer.style.left = offset.x + 'px'
    countdownContainer.style.top = offset.y + 'px'
  }

  function setSidebar() {
    let date = getCurrentEditedDate()
    const dateOverride = AppStateStore.findDateOverride(date, dateOverrides)
    if (dateOverride && dateOverride.type === 'holiday') {
      weekCH.innerText = '放假'
      weekEN.innerText = 'Holiday'
    } else {
      // Display the day whose timetable is active, including manual and date-specific overrides.
      let week = getCurrentEditedDay(date)
      let data = scheduleConfig.daily_class[week]
      weekCH.innerText = data.Chinese
      weekEN.innerText = data.English
    }
    if (scheduleConfig.countdown_target === 'hidden') {
      rightSidebar.style.display = 'none'
    } else {
      rightSidebar.style.display = 'block'
      countdownDays.innerText = Math.ceil(Math.abs(new Date(scheduleConfig.countdown_target) - date) / (1000 * 60 * 60 * 24))
    }
    leftSidebar.style.display = scheduleConfig.week_display ? 'block' : 'none'
  }


  function positionWeatherPanel() {
    if (!weatherPanel || weatherPanel.style.display === 'none' || getComputedStyle(weatherPanel).display === 'none') return;
    const anchor = rightSidebar.style.display !== 'none' ? rightSidebar : classContainer;
    const anchorRect = anchor.getBoundingClientRect();
    const panelWidth = weatherPanel.offsetWidth || 178;
    let left = anchorRect.right + 12;
    if (left + panelWidth > window.innerWidth - 12) {
      left = globalContainer.getBoundingClientRect().left - panelWidth - 12;
    }
    weatherPanel.style.left = Math.max(12, left) + 'px';
  }

  function setWeatherIcon(iconElement, code, description) {
    if (!iconElement) return;
    const normalizedCode = typeof code === 'string' && /^\d{3}$/.test(code) ? code : '';
    const descriptionElement = iconElement.id === 'weatherIcon' ? weatherDescription : null;
    if (!normalizedCode || !weatherIconsAvailable) {
      iconElement.className = iconElement.id === 'weatherIcon' ? 'weatherIcon' : 'weatherNextIcon';
      iconElement.style.display = 'none';
      if (descriptionElement) descriptionElement.style.display = 'block';
      return;
    }

    iconElement.className = (iconElement.id === 'weatherIcon' ? 'weatherIcon' : 'weatherNextIcon')
      + ' qi-' + normalizedCode + '-fill';
    iconElement.setAttribute('aria-label', description || '天气图标');
    iconElement.title = description || '';
    iconElement.style.display = 'inline-block';
    if (descriptionElement) descriptionElement.style.display = 'none';
  }

  async function refreshWeather() {
    if (!weatherPanel) return;
    try {
      const snapshot = await ipcRenderer.getWeatherSnapshot();
      if (!snapshot || snapshot.enabled !== true) {
        weatherPanel.style.display = 'none';
        return;
      }
      weatherPanel.style.display = 'block';
      weatherRegion.innerText = snapshot.regionLabel || '天气';
      const temperature = snapshot.now && snapshot.now.temp;
      const condition = snapshot.now && snapshot.now.text;
      weatherCurrent.innerText = temperature !== null && temperature !== undefined && temperature !== '' ? temperature + '°' : '--°';
      weatherDescription.innerText = condition || '当前天气暂无数据';
      setWeatherIcon(weatherIcon, snapshot.now && snapshot.now.icon, condition);
      if (snapshot.nextHour) {
        const nextTemp = snapshot.nextHour.temp ? snapshot.nextHour.temp + '°' : '--°';
        const nextText = snapshot.nextHour.text || '暂无天气描述';
        weatherNextHour.innerText = nextTemp + ' · ' + nextText;
        setWeatherIcon(weatherNextIcon, snapshot.nextHour.icon, nextText);
      } else {
        weatherNextHour.innerText = '暂无未来一小时预报';
        setWeatherIcon(weatherNextIcon, null, '');
      }
      positionWeatherPanel();
    } catch (error) {
      weatherPanel.style.display = 'block';
      weatherRegion.innerText = '天气服务暂不可用';
      weatherCurrent.innerText = '--°';
      weatherDescription.innerText = '请检查网络、API Host 和 API Key';
      weatherNextHour.innerText = '暂时无法获取未来一小时预报';
      setWeatherIcon(weatherIcon, null, '');
      setWeatherIcon(weatherNextIcon, null, '');
      positionWeatherPanel();
      console.warn('[weather] Failed to refresh weather data');
    }
  }

  function tick(reset = false) {
    scheduleData = getScheduleData();
    const scheduleChanged = JSON.stringify(scheduleData.scheduleArray) != JSON.stringify(lastScheduleData.scheduleArray) ||
      scheduleData.currentHighlight.index != lastScheduleData.currentHighlight.index ||
      scheduleData.currentHighlight.fullName != lastScheduleData.currentHighlight.fullName ||
      scheduleData.currentHighlight.type != lastScheduleData.currentHighlight.type ||
      scheduleData.noClasses !== lastScheduleData.noClasses || reset;

    if (scheduleData.noClasses) {
      classContainer.innerHTML = '<div class="class holiday">今日无课</div>';
      countdownContainer.style.display = 'none';
      miniCountdown.style.display = 'none';
      setSidebar();
      setBackgroundDisplay();
    } else {
      setCountdownerContent();
      if (scheduleChanged) {
        setScheduleClass();
        setCountdownerPosition();
        setSidebar();
        setBackgroundDisplay();
      }
    }
    positionWeatherPanel();
    lastScheduleData = $.extend(true, {}, scheduleData);
  }


  let lastTickTime = new Date().getTime()
  setInterval(() => {
    if (new Date().getTime() - lastTickTime >= 1000) {
      lastTickTime = new Date().getTime()
      tick()
    }
  }, 20);

  for (key in scheduleConfig.css_style) {
    root.style.setProperty(key, scheduleConfig.css_style[key])
  }

  let timer = undefined
  window.addEventListener("mousemove", event => {
    if (event.target.className && event.target.className.indexOf('notIgnoreClick') == -1) {
      root.style.opacity = '0.2'
      clearTimeout(timer)
      timer = setTimeout(() => {
        root.style.opacity = '1'
      }, 5000);
    } else {
      clearTimeout(timer)
      root.style.opacity = '1'
    }
    if (event.target.className.indexOf('notIgnoreClick') == -1) {
      ipcRenderer.send('setIgnore', true)
    } else {
      ipcRenderer.send('setIgnore', false)
    }

  });
  ipcRenderer.send('setIgnore', true)

  function setScheduleDialog() {
    ipcRenderer.send('dialog', {
      reply: 'getSelectedClassIndex',
      options: {
        title: '更改课表',
        message: `请选择你要更改的课程序号`,
        buttons: scheduleData.scheduleArray.map((value, index) => { return `第 ${index + 1} 节: ${scheduleConfig.subject_name[value]}` }),
        cancelId: -1,
        defaultId: scheduleData.currentHighlight.index
      }
    })
  }

  ipcRenderer.on('getSelectedClassIndex', (e, arg) => {
    if (arg.index == -1) return
    let classes = Object.keys(scheduleConfig.subject_name).sort();
    ipcRenderer.send('dialog', {
      reply: 'getSelectedChangingClass',
      index: arg.index,
      classes: classes,
      options: {
        title: '更改课表',
        message: `将 第 ${arg.index + 1} 节 ${scheduleConfig.subject_name[scheduleData.scheduleArray[arg.index]]} 更改为:`,
        buttons: classes.map((value) => { return scheduleConfig.subject_name[value] }),
        cancelId: -1,
      }
    })
  })

  ipcRenderer.on('getSelectedChangingClass', (e, arg) => {
    if (arg.index == -1) return
    let index = arg.arg.index;
    let selectedClass = arg.arg.classes[arg.index];
    const date = getCurrentEditedDate();
    const dayOfWeek = getCurrentEditedDay(date);
    scheduleConfig.daily_class[dayOfWeek].classList[index] = selectedClass;
    ScheduleConfigStore.saveClassOverride(localStorage, dayOfWeek, index, selectedClass, _scheduleConfig);
  })

  ipcRenderer.on('openSettingDialog', (e, arg) => {
    setScheduleDialog()
  })

  document.addEventListener("click", function (event) {
    if (event.target.className.indexOf('options') != -1) {
      ipcRenderer.send('pop')
    }
  });

  ipcRenderer.on('setWeekIndex', (e, arg) => {
    try {
      weekIndex = AppStateStore.setWeekIndex(localStorage, Number(arg))
    } catch (error) {
      console.error('Rejected week index:', error)
    }
  })

  ipcRenderer.on('getWeekIndex', (e, arg) => {
    const state = AppStateStore.loadState(localStorage)
    weekIndex = state.weekIndex
    ipcRenderer.send('getWeekIndex', weekIndex)
  })

  ipcRenderer.on('getTimeOffset', (e, arg) => {
    const state = AppStateStore.loadState(localStorage)
    timeOffset = state.timeOffset
    ipcRenderer.send('getTimeOffset', timeOffset)
  })

  ipcRenderer.on('setTimeOffset', (e, arg) => {
    const value = Number(arg)
    if (!Number.isSafeInteger(value)) {
      console.error('Rejected time offset:', arg)
      return
    }
    timeOffset = AppStateStore.setTimeOffset(localStorage, value)
  })

  ipcRenderer.on('ClassCountdown', (e, arg) => {
    isClassCountdown = arg
    tick(reset = true)
  })

  ipcRenderer.on('ClassHidden', (e, arg) => {
    isClassHidden = arg
    tick(reset = true)
  })

  ipcRenderer.on('setDayOffset', (e, arg) => {
    ipcRenderer.send('dialog', {
      reply: 'getDayOffset',
      options: {
        title: '切换日程',
        message: `将今日使用课表日程设置为本周的星期几：`,
        buttons: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '重置至当前日期'],
        cancelId: -1,
      }
    })
  })

  ipcRenderer.on('getDayOffset', (e, arg) => {
    if (arg.index == -1) return
    if (arg.index <= 6) {
      const state = AppStateStore.setDayOffset(localStorage, arg.index, new Date().getDay())
      dayOffset = state.dayOffset
      setDayOffsetLastDay = state.setDayOffsetLastDay
      return
    }
    const state = AppStateStore.resetDayOffset(localStorage)
    dayOffset = state.dayOffset
    setDayOffsetLastDay = state.setDayOffsetLastDay
  })

  ipcRenderer.on('applyScheduleDay', (_event, day) => {
    if (!Number.isInteger(day) || day < 0 || day > 7) return
    const state = day <= 6
      ? AppStateStore.setDayOffset(localStorage, day, new Date().getDay())
      : AppStateStore.resetDayOffset(localStorage)
    dayOffset = state.dayOffset
    setDayOffsetLastDay = state.setDayOffsetLastDay
  })


  ipcRenderer.on('dateOverridesChanged', (_event, overrides) => {
    dateOverrides = Array.isArray(overrides) ? overrides : [];
    tick(true);
  })
  ipcRenderer.getDateOverrides().then(overrides => {
    dateOverrides = Array.isArray(overrides) ? overrides : [];
    tick(true);
  }).catch(error => console.warn('[schedule] Failed to load date overrides:', error))
  ipcRenderer.on('weatherSettingsChanged', () => refreshWeather())
  window.addEventListener('resize', positionWeatherPanel)
  refreshWeather()
  setInterval(refreshWeather, 10 * 60 * 1000)
