function applyTheme(theme) {
  const resolvedTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', resolvedTheme);
  document.getElementById('themeLabel').textContent = resolvedTheme === 'dark' ? 'Dark Theme' : 'Light Theme';
}

chrome.storage.sync.get(['theme'], (result) => {
  applyTheme(result.theme);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes.theme) {
    applyTheme(changes.theme.newValue);
  }
});
