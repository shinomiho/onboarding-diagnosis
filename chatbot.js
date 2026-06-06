// ================================================================
// リミーちゃん AIチャットボット - 埋め込みスクリプト
// ================================================================
// 使い方: 各HTMLの </body> の直前に以下を追加
//   <script src="chatbot.js"></script>
// ================================================================

(function () {
  var GAS_URL = 'https://script.google.com/macros/s/AKfycbyGceshWFX-_kepVh5KHTvNwsrNAh7hW22U48KSp4DVvohXurOsAa6BDW7MFrsbKJ0n/exec';
  var LOGO_PATH = 'logo.jpg';
  var STORAGE_KEY = 'limeeguide_chatbot_history';

  var STYLE = ''
    + '.limee-chat-launcher{position:fixed;bottom:20px;right:20px;width:72px;height:72px;border-radius:50%;background:#fff;box-shadow:0 8px 24px rgba(107,58,127,.35);cursor:pointer;z-index:9999;display:flex;align-items:center;justify-content:center;transition:transform .2s;border:3px solid #6b3a7f;}'
    + '.limee-chat-launcher:hover{transform:scale(1.08);}'
    + '.limee-mascot{position:relative;width:54px;height:54px;display:flex;align-items:center;justify-content:center;}'
    + '.limee-mascot img{width:100%;height:100%;object-fit:contain;}'
    + '.limee-face{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;}'
    + '.limee-mascot-face{position:absolute;top:38%;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;pointer-events:none;}'
    + '.limee-mascot-eyes{display:flex;gap:5px;}'
    + '.limee-eye{width:9px;height:9px;background:#fff;border-radius:50%;border:1.5px solid #2d1b3a;position:relative;}'
    + '.limee-eye::after{content:"";position:absolute;width:3.5px;height:3.5px;background:#2d1b3a;border-radius:50%;top:50%;left:50%;transform:translate(-50%,-50%);}'
    + '.limee-mouth{width:8px;height:4px;border:1.5px solid #2d1b3a;border-top:0;border-radius:0 0 12px 12px;margin-top:3px;background:transparent;}'
    + '.limee-chat-launcher::after{content:"💬";position:absolute;top:-4px;right:-4px;background:#ff7575;color:#fff;width:24px;height:24px;border-radius:50%;font-size:14px;display:flex;align-items:center;justify-content:center;}'
    + '.limee-chat-panel{position:fixed;bottom:104px;right:20px;width:380px;max-width:calc(100vw - 40px);height:560px;max-height:calc(100vh - 140px);background:#fff;border-radius:20px;box-shadow:0 12px 48px rgba(0,0,0,.18);z-index:9999;display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Yu Gothic","Meiryo",sans-serif;}'
    + '.limee-chat-panel.is-open{display:flex;}'
    + '.limee-chat-header{background:linear-gradient(135deg,#6b3a7f,#3d3567);color:#fff;padding:16px 20px;display:flex;align-items:center;gap:12px;}'
    + '.limee-chat-header .limee-mascot{width:44px;height:44px;background:#fff;border-radius:50%;padding:2px;border:2px solid #fff;}'
    + '.limee-chat-header .limee-eye{width:7px;height:7px;border-width:1.2px;}'
    + '.limee-chat-header .limee-eye::after{width:3px;height:3px;}'
    + '.limee-chat-header .limee-mouth{width:6px;height:3px;border-width:1.2px;}'
    + '.limee-chat-header .limee-mascot-face{top:36%;}'
    + '.limee-chat-header-text{flex:1;}'
    + '.limee-chat-header-name{font-size:16px;font-weight:bold;line-height:1.2;}'
    + '.limee-chat-header-status{font-size:12px;opacity:.85;margin-top:2px;display:flex;align-items:center;gap:5px;}'
    + '.limee-chat-header-status::before{content:"";width:8px;height:8px;background:#7eea7e;border-radius:50%;display:inline-block;}'
    + '.limee-chat-close{background:transparent;border:0;color:#fff;font-size:22px;cursor:pointer;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;}'
    + '.limee-chat-close:hover{background:rgba(255,255,255,.15);}'
    + '.limee-chat-body{flex:1;overflow-y:auto;padding:16px;background:#faf6fb;}'
    + '.limee-chat-msg{display:flex;gap:8px;margin-bottom:14px;}'
    + '.limee-chat-msg-user{justify-content:flex-end;}'
    + '.limee-chat-bubble{max-width:75%;padding:10px 14px;border-radius:14px;line-height:1.5;font-size:14px;white-space:pre-wrap;word-wrap:break-word;}'
    + '.limee-chat-msg-bot .limee-chat-bubble{background:#fff;color:#333;border:1px solid #ebd9f0;border-top-left-radius:4px;}'
    + '.limee-chat-msg-user .limee-chat-bubble{background:linear-gradient(135deg,#6b3a7f,#3d3567);color:#fff;border-top-right-radius:4px;}'
    + '.limee-chat-avatar{width:32px;height:32px;border-radius:50%;background:#fff;padding:2px;flex-shrink:0;border:1px solid #ebd9f0;position:relative;display:flex;align-items:center;justify-content:center;}'
    + '.limee-chat-avatar .limee-mascot{width:100%;height:100%;}'
    + '.limee-chat-avatar .limee-eye{width:5px;height:5px;border-width:1px;}'
    + '.limee-chat-avatar .limee-eye::after{width:2px;height:2px;}'
    + '.limee-chat-avatar .limee-mouth{width:4px;height:2px;border-width:1px;margin-top:2px;}'
    + '.limee-chat-avatar .limee-mascot-eyes{gap:3px;}'
    + '.limee-chat-typing{display:flex;gap:4px;padding:14px 16px;align-items:center;}'
    + '.limee-chat-typing span{width:8px;height:8px;background:#b89cc1;border-radius:50%;animation:limee-bounce 1.4s infinite ease-in-out both;}'
    + '.limee-chat-typing span:nth-child(2){animation-delay:.2s;}'
    + '.limee-chat-typing span:nth-child(3){animation-delay:.4s;}'
    + '@keyframes limee-bounce{0%,80%,100%{transform:scale(0.6);}40%{transform:scale(1);}}'
    + '.limee-chat-footer{padding:12px 16px;background:#fff;border-top:1px solid #ebd9f0;display:flex;gap:8px;align-items:flex-end;}'
    + '.limee-chat-input{flex:1;border:1px solid #d8c5dd;border-radius:18px;padding:10px 14px;font-size:14px;font-family:inherit;resize:none;outline:none;max-height:100px;min-height:38px;line-height:1.4;}'
    + '.limee-chat-input:focus{border-color:#6b3a7f;}'
    + '.limee-chat-send{background:linear-gradient(135deg,#6b3a7f,#3d3567);color:#fff;border:0;border-radius:18px;padding:10px 18px;font-size:14px;font-weight:bold;cursor:pointer;height:38px;}'
    + '.limee-chat-send:disabled{opacity:.4;cursor:not-allowed;}'
    + '.limee-chat-suggestions{display:flex;flex-wrap:wrap;gap:6px;padding:0 16px 12px;background:#faf6fb;}'
    + '.limee-chat-suggestion{background:#fff;border:1px solid #d8c5dd;border-radius:14px;padding:6px 12px;font-size:12px;cursor:pointer;color:#6b3a7f;}'
    + '.limee-chat-suggestion:hover{background:#f3e7f5;}'
    + '.limee-intro-bubble{position:fixed;bottom:30px;right:108px;background:#fff;padding:14px 18px;border-radius:16px;box-shadow:0 8px 24px rgba(107,58,127,.18);z-index:9998;max-width:240px;font-size:13px;line-height:1.55;font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Yu Gothic","Meiryo",sans-serif;color:#3d2b27;animation:limee-intro-pop .5s cubic-bezier(.34,1.56,.64,1);}'
    + '.limee-intro-bubble::after{content:"";position:absolute;right:-9px;bottom:24px;border:10px solid transparent;border-left-color:#fff;border-right:0;}'
    + '.limee-intro-bubble strong{color:#6b3a7f;display:block;margin-bottom:4px;font-weight:600;font-size:13px;}'
    + '.limee-intro-bubble small{color:#7a6059;font-size:11px;display:block;margin-top:6px;}'
    + '.limee-intro-close{position:absolute;top:6px;right:8px;background:transparent;border:0;color:#b89cc1;font-size:14px;cursor:pointer;padding:2px 6px;line-height:1;}'
    + '.limee-intro-close:hover{color:#6b3a7f;}'
    + '.limee-intro-bubble.is-hiding{opacity:0;transform:scale(0.9);transition:opacity .4s, transform .4s;}'
    + '@keyframes limee-intro-pop{0%{opacity:0;transform:scale(0.7) translateY(10px);}100%{opacity:1;transform:scale(1) translateY(0);}}'
    + '@media(max-width:480px){.limee-chat-panel{width:calc(100vw - 24px);right:12px;bottom:92px;height:calc(100vh - 116px);}.limee-chat-launcher{right:12px;bottom:12px;}.limee-intro-bubble{display:none;}}';

  var style = document.createElement('style');
  style.textContent = STYLE;
  document.head.appendChild(style);

  function buildMascot() {
    return ''
      + '<div class="limee-mascot">'
      + '  <img src="' + LOGO_PATH + '" alt="リミーちゃん">'
      + '  <svg class="limee-face" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">'
      + '    <circle cx="22" cy="60" r="5" fill="#ff9bb8" opacity="0.55"/>'
      + '    <circle cx="78" cy="60" r="5" fill="#ff9bb8" opacity="0.55"/>'
      + '    <ellipse cx="38" cy="50" rx="10" ry="12" fill="#fff" stroke="#2d1b3a" stroke-width="2"/>'
      + '    <ellipse cx="38" cy="52" rx="6" ry="8" fill="#2d1b3a"/>'
      + '    <circle cx="40.5" cy="48" r="2.8" fill="#fff"/>'
      + '    <circle cx="35.5" cy="53" r="1.3" fill="#fff"/>'
      + '    <ellipse cx="62" cy="50" rx="10" ry="12" fill="#fff" stroke="#2d1b3a" stroke-width="2"/>'
      + '    <ellipse cx="62" cy="52" rx="6" ry="8" fill="#2d1b3a"/>'
      + '    <circle cx="64.5" cy="48" r="2.8" fill="#fff"/>'
      + '    <circle cx="59.5" cy="53" r="1.3" fill="#fff"/>'
      + '    <path d="M 42 72 Q 50 79 58 72" stroke="#2d1b3a" stroke-width="2.2" fill="none" stroke-linecap="round"/>'
      + '  </svg>'
      + '</div>';
  }

  var launcher = document.createElement('div');
  launcher.className = 'limee-chat-launcher';
  launcher.innerHTML = buildMascot();
  launcher.setAttribute('title', 'リミーちゃんに相談');
  document.body.appendChild(launcher);

  var panel = document.createElement('div');
  panel.className = 'limee-chat-panel';
  panel.innerHTML = ''
    + '<div class="limee-chat-header">'
    + '  ' + buildMascot()
    + '  <div class="limee-chat-header-text">'
    + '    <div class="limee-chat-header-name">リミーちゃん <span style="font-size:11px;font-weight:400;opacity:.85;">(AIサポーター)</span></div>'
    + '    <div class="limee-chat-header-status">なんでも聞いてね！一緒に解決するよ</div>'
    + '  </div>'
    + '  <button class="limee-chat-close" aria-label="閉じる">×</button>'
    + '</div>'
    + '<div class="limee-chat-body" id="limee-chat-body"></div>'
    + '<div class="limee-chat-suggestions" id="limee-chat-suggestions"></div>'
    + '<div class="limee-chat-footer">'
    + '  <textarea class="limee-chat-input" id="limee-chat-input" placeholder="リミーちゃんに聞いてみてね…" rows="1"></textarea>'
    + '  <button class="limee-chat-send" id="limee-chat-send">送信</button>'
    + '</div>';
  document.body.appendChild(panel);

  var body = panel.querySelector('#limee-chat-body');
  var input = panel.querySelector('#limee-chat-input');
  var sendBtn = panel.querySelector('#limee-chat-send');
  var closeBtn = panel.querySelector('.limee-chat-close');
  var suggestionsBox = panel.querySelector('#limee-chat-suggestions');

  var history = loadHistory();

  function loadHistory() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-20)));
    } catch (e) {}
  }

  function renderMessage(role, text) {
    var msg = document.createElement('div');
    msg.className = 'limee-chat-msg ' + (role === 'user' ? 'limee-chat-msg-user' : 'limee-chat-msg-bot');
    var html = '';
    if (role === 'assistant') {
      html += '<div class="limee-chat-avatar">' + buildMascot() + '</div>';
    }
    html += '<div class="limee-chat-bubble"></div>';
    msg.innerHTML = html;
    msg.querySelector('.limee-chat-bubble').textContent = text;
    body.appendChild(msg);
    body.scrollTop = body.scrollHeight;
  }

  function renderTyping() {
    var msg = document.createElement('div');
    msg.className = 'limee-chat-msg limee-chat-msg-bot';
    msg.id = 'limee-chat-typing';
    msg.innerHTML = ''
      + '<div class="limee-chat-avatar">' + buildMascot() + '</div>'
      + '<div class="limee-chat-bubble"><div class="limee-chat-typing"><span></span><span></span><span></span></div></div>';
    body.appendChild(msg);
    body.scrollTop = body.scrollHeight;
  }

  function removeTyping() {
    var typing = document.getElementById('limee-chat-typing');
    if (typing) typing.remove();
  }

  function renderSuggestions(items) {
    suggestionsBox.innerHTML = '';
    if (!items || items.length === 0) {
      suggestionsBox.style.display = 'none';
      return;
    }
    suggestionsBox.style.display = 'flex';
    items.forEach(function (text) {
      var chip = document.createElement('button');
      chip.className = 'limee-chat-suggestion';
      chip.textContent = text;
      chip.addEventListener('click', function () { sendMessage(text); });
      suggestionsBox.appendChild(chip);
    });
  }

  function sendMessage(text) {
    text = (text || input.value || '').trim();
    if (!text) return;
    input.value = '';
    input.style.height = 'auto';
    sendBtn.disabled = true;
    renderMessage('user', text);
    history.push({ role: 'user', content: text });
    saveHistory();
    renderSuggestions([]);
    renderTyping();
    fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'chat', group: 'guide', message: text, history: history.slice(0, -1) })
    })
      .then(function (r) { return r.json(); })
      .then(function (json) {
        removeTyping();
        if (json.error) {
          renderMessage('assistant', 'ごめんね、エラーが出ちゃった。\n' + json.error);
        } else {
          var reply = json.reply || '';
          renderMessage('assistant', reply);
          history.push({ role: 'assistant', content: reply });
          saveHistory();
        }
        sendBtn.disabled = false;
        input.focus();
      })
      .catch(function (err) {
        removeTyping();
        renderMessage('assistant', 'ごめんね、ネットワークエラー。少し待ってからまた話しかけてくれる？');
        sendBtn.disabled = false;
      });
  }

  function showInitialGreeting() {
    if (history.length === 0) {
      var greeting = 'はじめまして！\nリミーAI診断のサポート、リミーちゃんです✨\n\n導入検討中の方も、運用開始済みの方も、なんでもご質問くださいね。一緒に解決しましょう！';
      renderMessage('assistant', greeting);
      history.push({ role: 'assistant', content: greeting });
      saveHistory();
    } else {
      history.forEach(function (m) {
        renderMessage(m.role, m.content);
      });
    }
    renderSuggestions([
      'リミー診断ってなに？',
      '導入の流れは？',
      '料金を知りたい',
      '人事評価に使われない？'
    ]);
  }

  var introBubble = document.createElement('div');
  introBubble.className = 'limee-intro-bubble';
  introBubble.innerHTML = ''
    + '<button class="limee-intro-close" aria-label="閉じる">×</button>'
    + '<strong>AIサポーター リミーちゃん</strong>'
    + 'わからないこと、一緒に解決するよ！<br>気軽に聞いてみてね✨'
    + '<small>クリックでチャット開始</small>';
  document.body.appendChild(introBubble);

  introBubble.querySelector('.limee-intro-close').addEventListener('click', function (e) {
    e.stopPropagation();
    hideIntro();
  });
  introBubble.addEventListener('click', function () {
    launcher.click();
  });

  function hideIntro() {
    if (!introBubble.parentNode) return;
    introBubble.classList.add('is-hiding');
    setTimeout(function () {
      if (introBubble.parentNode) introBubble.remove();
    }, 400);
  }

  setTimeout(hideIntro, 15000);

  launcher.addEventListener('click', function () {
    hideIntro();
    panel.classList.add('is-open');
    launcher.style.display = 'none';
    if (body.children.length === 0) showInitialGreeting();
    setTimeout(function () { input.focus(); }, 200);
  });

  closeBtn.addEventListener('click', function () {
    panel.classList.remove('is-open');
    launcher.style.display = 'flex';
  });

  sendBtn.addEventListener('click', function () { sendMessage(); });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  input.addEventListener('input', function () {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 100) + 'px';
  });
})();
