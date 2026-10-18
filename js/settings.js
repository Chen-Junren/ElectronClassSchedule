(function () {
  'use strict';

  const searchInput = document.getElementById('regionSearch');
  const resultsElement = document.getElementById('regionResults');
  const selectedElement = document.getElementById('selectedRegion');
  const weatherEnabled = document.getElementById('weatherEnabled');
  const qweatherHost = document.getElementById('qweatherHost');
  const qweatherKey = document.getElementById('qweatherKey');
  const statusMessage = document.getElementById('statusMessage');
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
            : null
        };
        renderSelectedRegion();
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
      qweatherHost.value = typeof savedSettings.apiHost === 'string' ? savedSettings.apiHost : 'api.qweather.com';
      qweatherKey.value = typeof savedSettings.apiKey === 'string' ? savedSettings.apiKey : '';
      renderSelectedRegion();
      renderResults('');
    } catch (error) {
      console.error('Failed to load China district data:', error);
      resultsElement.innerHTML = '<p class="empty-state">地区数据载入失败，请重启应用后重试。</p>';
      showStatus('无法载入地区数据：' + (error.message || '未知错误'), false);
    }
  }

  searchInput.addEventListener('input', () => renderResults(searchInput.value));
  document.getElementById('resetSearch').addEventListener('click', () => {
    searchInput.value = '';
    renderResults('');
    showStatus('', true);
  });

  document.getElementById('saveSettings').addEventListener('click', async () => {
    const host = qweatherHost.value.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
    if (host && !/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) {
      showStatus('API Host 格式不正确，请只填写域名。', false);
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
      apiHost: host || 'api.qweather.com',
      apiKey: qweatherKey.value.trim(),
      region: selectedRegion ? {
        adminCode: selectedRegion.adminCode,
        label: selectedRegion.label,
        province: selectedRegion.province,
        city: selectedRegion.city,
        district: selectedRegion.district,
        qweatherLocationId: selectedRegion.qweatherLocationId || null
      } : null
    };
    try {
      savedSettings = await window.electronAPI.saveWeatherSettings(nextSettings);
      showStatus('设置已安全保存到本机。天气面板会在天气模块接入后读取这些配置。', true);
    } catch (error) {
      showStatus('保存失败：' + (error.message || '本地存储不可用'), false);
    }
  });

  document.querySelectorAll('.nav-item').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item === button));
      document.querySelectorAll('.settings-section').forEach(panel => panel.classList.toggle('hidden', panel.dataset.panel !== button.dataset.section));
    });
  });

  init();
})();
