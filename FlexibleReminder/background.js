// 通知を作成する関数
function showNotification(message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon48.png',
    title: 'リマインダー',
    message: message || '時間です！',
    priority: 2
  });
}

// アラーム発火時のリスナー
chrome.alarms.onAlarm.addListener((alarm) => {
  // アラーム名が "reminder-" で始まるものだけを対象にする
  if (!alarm.name.startsWith('reminder-')) return;

  const id = alarm.name.replace('reminder-', '');

  // ストレージから設定リストを取得して、該当IDのメッセージを表示
  chrome.storage.sync.get(['reminders'], (data) => {
    const reminders = data.reminders || [];
    // IDは保存時に数値または文字列として扱われるため、比較時は念の為文字列化して合わせる
    const target = reminders.find(r => String(r.id) === id);

    if (target && target.enabled) {
      showNotification(target.message);
    }
  });
});