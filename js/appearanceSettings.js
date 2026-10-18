(function () {
  'use strict';

  const defaults = {
    settingsBackground: '#f4f6fa',
    barBackground: '#000000',
    classText: '#ffffff',
    highlightText: '#00ff0a',
    countdownClassText: '#00ff0a',
    countdownText: '#ffffff',
    leftSidebarText: '#00eeff',
    rightSidebarText: '#ff3a3a',
    weatherText: '#ffffff',
    weatherMutedText: '#dce6f5'
  };

  const controlIds = {
    settingsBackground: 'appearanceSettingsBackground',
    barBackground: 'appearanceBarBackground',
    classText: 'appearanceClassText',
    highlightText: 'appearanceHighlightText',
    countdownClassText: 'appearanceCountdownClassText',
    countdownText: 'appearanceCountdownText',
    leftSidebarText: 'appearanceLeftSidebarText',
    rightSidebarText: 'appearanceRightSidebarText',
    weatherText: 'appearanceWeatherText',
    weatherMutedText: 'appearanceWeatherMutedText'
  };

  const controls = Object.fromEntries(
    Object.entries(controlIds).map(([key, id]) => [key, document.getElementById(id)])
  );
  const status = document.getElementById('appearanceStatus');
  const preview = document.getElementById('appearancePreview');

  function readControls() {
    return Object.fromEntries(
      Object.entries(controls).map(([key, input]) => [key, input.value])
    );
  }

  function writeControls(settings) {
    for (const [key, input] of Object.entries(controls)) {
      input.value = settings[key] || defaults[key];
    }
  }

  function applyPreview(settings) {
    document.documentElement.style.setProperty('--settings-background', settings.settingsBackground);
    preview.style.backgroundColor = settings.barBackground;
    preview.style.setProperty('--preview-class-text', settings.classText);
    preview.style.setProperty('--preview-left-text', settings.leftSidebarText);
    preview.style.setProperty('--preview-highlight-text', settings.highlightText);
  }

  function showStatus(message, success) {
    status.textContent = message;
    status.className = success ? 'notice success' : 'notice';
  }

  async function save(settings) {
    try {
      const saved = await window.electronAPI.saveAppearanceSettings(settings);
      writeControls(saved);
      applyPreview(saved);
      showStatus('配色已保存并应用到悬浮栏。', true);
    } catch (error) {
      showStatus('保存失败：' + (error.message || '无法保存外观设置'), false);
    }
  }

  for (const input of Object.values(controls)) {
    input.addEventListener('input', () => applyPreview(readControls()));
  }

  document.getElementById('saveAppearance').addEventListener('click', () => save(readControls()));
  document.getElementById('resetAppearance').addEventListener('click', () => {
    writeControls(defaults);
    applyPreview(defaults);
    save({ ...defaults });
  });

  window.electronAPI.on('appearanceSettingsChanged', (_event, settings) => {
    if (!settings || typeof settings !== 'object') return;
    writeControls(settings);
    applyPreview(settings);
  });

  window.electronAPI.getAppearanceSettings().then(settings => {
    writeControls(settings);
    applyPreview(settings);
  }).catch(error => {
    writeControls(defaults);
    applyPreview(defaults);
    showStatus('无法读取已保存的外观设置，当前显示默认配色。', false);
    console.warn('[appearance] Failed to load appearance settings:', error);
  });
})();
