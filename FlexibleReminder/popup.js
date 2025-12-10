const listContainer = document.getElementById('reminderList');
const addBtn = document.getElementById('addBtn');

// アプリケーションの状態（リマインダーのリスト）
let reminders = [];

// 初期化処理
async function init() {
  const data = await chrome.storage.sync.get(['reminders', 'intervalMin', 'customMsg', 'enabled']);
  
  if (data.reminders) {
    reminders = data.reminders;
  } else if (data.intervalMin) {
    // 旧バージョンのデータがある場合は移行する
    reminders = [{
      id: Date.now(),
      interval: Number(data.intervalMin),
      message: data.customMsg || 'リマインダー',
      enabled: !!data.enabled
    }];
    // 移行後は旧データを消してもいいが、念のため上書き保存で対応
    saveReminders();
  }

  renderList();
}

// リストの描画
function renderList() {
  listContainer.innerHTML = '';

  if (reminders.length === 0) {
    listContainer.innerHTML = '<div class="empty-msg">通知設定がありません。<br>「+ 追加」ボタンから作成してください。</div>';
    return;
  }

  reminders.forEach(reminder => {
    const card = document.createElement('div');
    card.className = `reminder-card ${reminder.enabled ? 'active' : 'inactive'}`;
    
    // 次回予定時刻の取得（非同期）と表示
    const nextTimeId = `next-time-${reminder.id}`;
    updateNextTimeDisplay(reminder.id, nextTimeId);

    card.innerHTML = `
      <div class="card-header">
        <span class="status-label ${reminder.enabled ? 'status-on' : 'status-off'}">
          ${reminder.enabled ? '稼働中' : '停止中'}
        </span>
        <span class="next-time" id="${nextTimeId}">--:--</span>
      </div>
      
      <div class="input-group">
        <label>間隔 (分)</label>
        <input type="number" min="1" value="${reminder.interval}" class="inp-interval">
      </div>
      
      <div class="input-group">
        <label>メッセージ</label>
        <textarea class="inp-message">${reminder.message}</textarea>
      </div>

      <div class="card-actions">
        <button class="card-btn btn-delete">削除</button>
        <button class="card-btn btn-update">更新保存</button>
        <button class="card-btn btn-toggle ${reminder.enabled ? 'is-active' : ''}">
          ${reminder.enabled ? '停止' : '開始'}
        </button>
      </div>
    `;

    // イベントリスナー設定
    const intervalInp = card.querySelector('.inp-interval');
    const msgInp = card.querySelector('.inp-message');
    const deleteBtn = card.querySelector('.btn-delete');
    const updateBtn = card.querySelector('.btn-update');
    const toggleBtn = card.querySelector('.btn-toggle');

    // 削除
    deleteBtn.onclick = () => deleteReminder(reminder.id);

    // 更新（内容変更のみ、稼働状態は維持）
    updateBtn.onclick = () => {
      updateReminder(reminder.id, intervalInp.value, msgInp.value, reminder.enabled);
      // 更新ボタンを押したときのアニメーションフィードバック（任意）
      updateBtn.textContent = '保存しました';
      setTimeout(() => updateBtn.textContent = '更新保存', 1000);
    };

    // 開始/停止
    toggleBtn.onclick = () => {
      // 内容も一緒に保存する
      const newEnabled = !reminder.enabled;
      updateReminder(reminder.id, intervalInp.value, msgInp.value, newEnabled);
    };

    listContainer.appendChild(card);
  });
}

// 次回予定時刻を取得して表示更新
function updateNextTimeDisplay(id, elementId) {
  chrome.alarms.get(`reminder-${id}`, (alarm) => {
    const el = document.getElementById(elementId);
    if (!el) return;

    if (alarm && alarm.scheduledTime) {
      const date = new Date(alarm.scheduledTime);
      const formatted = date.toLocaleString('ja-JP', {
        month: 'numeric', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      el.textContent = `次回: ${formatted}`;
    } else {
      el.textContent = '';
    }
  });
}

// 新規追加
addBtn.onclick = () => {
  const newReminder = {
    id: Date.now(),
    interval: 60,
    message: '新しいリマインダー',
    enabled: false
  };
  reminders.push(newReminder);
  saveReminders();
  renderList();
};

// 削除処理
function deleteReminder(id) {
  if (!confirm('このリマインダーを削除しますか？')) return;
  
  // アラーム削除
  chrome.alarms.clear(`reminder-${id}`);
  
  // リストから削除
  reminders = reminders.filter(r => r.id !== id);
  saveReminders();
  renderList();
}

// 更新処理（内容変更 または ON/OFF切り替え）
function updateReminder(id, intervalVal, msgVal, newEnabled) {
  const interval = Number(intervalVal);
  const message = msgVal.trim();

  if (interval < 1) {
    alert('間隔は1分以上にしてください');
    return;
  }

  // データを更新
  const index = reminders.findIndex(r => r.id === id);
  if (index === -1) return;

  reminders[index].interval = interval;
  reminders[index].message = message;
  reminders[index].enabled = newEnabled;

  // ストレージ保存
  saveReminders();

  // アラーム設定の更新
  const alarmName = `reminder-${id}`;
  if (newEnabled) {
    // 既存をクリアして再設定（間隔が変更されている可能性があるため）
    chrome.alarms.clear(alarmName, () => {
      chrome.alarms.create(alarmName, {
        delayInMinutes: interval,
        periodInMinutes: interval
      });
      renderList(); // UI上の状態（ボタンの文字など）を更新
    });
  } else {
    // 停止
    chrome.alarms.clear(alarmName, () => {
      renderList();
    });
  }
}

// ストレージへの保存
function saveReminders() {
  chrome.storage.sync.set({ reminders: reminders });
}

// 開始
init();