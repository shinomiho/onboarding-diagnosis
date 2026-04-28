// ===== 設問データ =====
const QUESTIONS = [
  { id: 'Q01', text: '今日の業務内容は理解できていると感じる' },
  { id: 'Q02', text: '1日の優先順位を自分で整理できている' },
  { id: 'Q03', text: '指示がなくても次の行動が分かる' },
  { id: 'Q04', text: 'ミスをしても、立て直せる感覚がある' },
  { id: 'Q05', text: '業務量は自分にとって適切だと感じる' },
  { id: 'Q06', text: '仕事で「詰まっている」と感じることがある', reverse: true },
  { id: 'Q07', text: '上司に気軽に質問できる' },
  { id: 'Q08', text: '困ったときに相談できる人がいる' },
  { id: 'Q09', text: '自分の存在が職場で受け入れられていると感じる' },
  { id: 'Q10', text: 'フィードバック（アドバイス）は建設的だと感じる' },
  { id: 'Q11', text: '職場で雑談や業務外の会話がある' },
  { id: 'Q12', text: '職場で孤立していると感じることがある', reverse: true },
  { id: 'Q13', text: '出勤前に強い憂うつ感がある', reverse: true },
  { id: 'Q14', text: '仕事後も気持ちの余裕（元気）が残っている' },
  { id: 'Q15', text: '最近、睡眠の質が良く、しっかり眠れている' },
  { id: 'Q16', text: '仕事に対して前向きな気持ちを持てている' },
  { id: 'Q17', text: '業務の中で小さな達成感を感じることがある' },
  { id: 'Q18', text: '理由のない不安や焦りを感じることがある', reverse: true },
  { id: 'Q19', text: '最近、寝坊や遅刻をしてしまうことがある', reverse: true },
  { id: 'Q20', text: '以前より報告・連絡の頻度が減ったと感じる', reverse: true },
  { id: 'Q21', text: 'ミスや確認漏れが増えたと感じる', reverse: true },
  { id: 'Q22', text: '自分から動けず「指示待ち」になることが増えた', reverse: true },
  { id: 'Q23', text: '職場で感情を抑えすぎて疲弊していると感じる', reverse: true },
  { id: 'Q24', text: '今の職場で、もう少し頑張ってみたいと思う' },
  { id: 'Q25', text: '本気で「辞めたい」と考えたことがある', reverse: true },
];

const LABELS = ['全く当てはまらない', 'あまり当てはまらない', 'どちらともいえない', 'やや当てはまる', '非常に当てはまる'];

// ===== 因子マッピング =====
const FACTORS = {
  A: { label: '業務適応',         questions: ['Q01','Q02','Q03','Q17'] },
  B: { label: '対人関係',         questions: ['Q07','Q08','Q09','Q10','Q11','Q12'] },
  C: { label: '心理エナジー',     questions: ['Q04','Q14','Q15','Q16','Q05','Q06','Q13','Q18'] },
  D: { label: '行動リスク',       questions: ['Q19','Q20','Q21','Q22','Q23'] },
  E: { label: '定着意思',         questions: ['Q24','Q25'] },
};

// ===== AIプロンプト（Apps Scriptに移動済み） =====
const _REMOVED = `あなたは、数々の現場を「構造化」で立て直してきた、
冷静かつ洞察力に優れた組織再建プロフェッショナルです。

管理職に対し、データが示す「部下の静かなシグナル」を伝え、
手遅れになる前に実行すべき「防衛・救済戦術」を提示してください。

# 分析ロジック（出力には含めないこと）
1. 心理エナジーが低い：30日目に「エネルギー枯渇による離脱」を予測。
2. 業務適応が低い：60日目に「役割へのミスマッチ」を予測。
3. 行動リスクまたは定着意思が低い：90日目に「心理的撤退の完了」を予測。

# 出力の絶対ルール
・「Score_」という言葉は一切使わず、項目名（業務適応など）で記述してください。
・「一文を短く」「改行を極めて多く」し、スマホでの視認性を極限まで高めてください。
・攻撃的な言葉を避け、「心理的撤退」「役割の限界」という言葉を使って、上司を救済アクションへ誘導してください。
・セクション間には【必ず4行以上の空行】を入れてください。`;

const USER_PROMPT_TEMPLATE = `# 参照データ
・業務適応：[Score_A]
・対人関係：[Score_B]
・心理エナジー：[Score_C]
・行動リスク：[Score_D]（※1に近いほど、無意識のミスや反応の遅れが出やすい状態）
・定着意思：[Score_E]

---

# 出力形式

━━━━━━━━━━━━━━━━━━━━
【 📌 組織マネジメント・優先対応通知 】
　判定：[ 要注視（または状況に応じた名称） ]


━━━━━━━━━━━━━━━━━━━━
▼ 🧠 行動解析：データが示す「部下の内面」
━━━━━━━━━━━━━━━━━━━━

【数値が示す、心理的撤退のサイン】

対人関係と定着意思の相関を分析してください。


【放置した場合に発生する「組織の歪み」】

この部下の静かな離脱が、
チームにどのような負担を強いるか。

あなたのマネジメントに
「設計ミス」の評価が下されるリスクを
具体的かつ簡潔に伝えてください。


━━━━━━━━━━━━━━━━━━━━
▼ 🛡️ 90日間の「組織再設計」戦術
━━━━━━━━━━━━━━━━━━━━

【30日目：[予測される状態名]】

●現場で見られる兆候：
[具体的で短い箇条書き]

●今日、このセリフで歩み寄ってください：
「〇〇さん、今の役割、
君の本来の力と『ズレ』が生じていないか？
私の配置が君をすり減らしていないか、
少し心配しているんだ。」


【60日目：[予測される状態名]】

●現場で見られる兆候：
[具体的で短い箇条書き]

●導入すべき「仕組み」：
[具体的で短い戦術]


【90日目：[予測される状態名]】

●現場で見られる兆候：
[具体的で短い箇条書き]

●最後の一手：
[感情論ではない、相手のメリットに響くロジック]


━━━━━━━━━━━━━━━━━━━━
▼ 📊 詳細バイオマーカー（客観データ）
━━━━━━━━━━━━━━━━━━━━

・業務適応：[Score_A] / 5.0
・対人関係：[Score_B] / 5.0
・心理エナジー：[Score_C] / 5.0
・行動リスク：[Score_D] / 5.0（※低いほど心理的負荷が高い）
・定着意思：[Score_E] / 5.0


━━━━━━━━━━━━━━━━━━━━
▼ ✉️ マネジメントの「仕組み化」リソース
━━━━━━━━━━━━━━━━━━━━

● 現場を死守する「対応マニュアル」
【リミー公式note】
https://note.com/femtech_career


● 組織構造の再設計が必要な場合はこちら
https://remenow.tokyo/inquiry/


━━━━━━━━━━━━━━━━━
【運営】リミー事務局
miho.shinohe@remenow.com`;

// ===== 設定（デプロイ後に書き換えてください） =====
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyGceshWFX-_kepVh5KHTvNwsrNAh7hW22U48KSp4DVvohXurOsAa6BDW7MFrsbKJ0n/exec';

// ===== 初期化 =====
let companyCode = '';
let companyName = '';

window.onload = async () => {
  renderQuestions();
  setupProgress();
  document.getElementById('api-modal').classList.add('hidden');

  // URLから会社コードを取得
  const params = new URLSearchParams(window.location.search);
  companyCode = params.get('code') || '';

  if (!companyCode) {
    showCodeError('URLに会社コードが含まれていません。\n担当者から受け取ったURLを使用してください。');
    return;
  }

  // 会社コードを検証
  try {
    const res = await fetch(`${APPS_SCRIPT_URL}?action=get_company&code=${companyCode}`);
    const data = await res.json();
    if (!data.success) throw new Error();
    companyName = data.company.name;
    const badge = document.getElementById('company-badge');
    badge.textContent = `${companyName} 専用`;
    badge.classList.remove('hidden');
  } catch {
    showCodeError('無効なURLです。\n担当者から受け取ったURLを確認してください。');
    return;
  }

  document.getElementById('diagnosis-form').addEventListener('submit', handleSubmit);
};

function showCodeError(msg) {
  document.getElementById('form-screen').innerHTML = `
    <div class="container" style="padding-top:80px;text-align:center;">
      <img src="logo.jpg" alt="リミー" class="logo-img" style="margin:0 auto 24px;">
      <p style="color:#EF4444;font-size:15px;line-height:1.8;">${msg.replace('\n','<br>')}</p>
    </div>`;
}

// ===== 設問レンダリング =====
function renderQuestions() {
  const container = document.getElementById('questions-container');
  QUESTIONS.forEach((q, i) => {
    const card = document.createElement('div');
    card.className = 'question-card';
    card.id = `card-${q.id}`;

    const options = [1,2,3,4,5].map(v => `
      <label class="option-label">
        <input type="radio" name="${q.id}" value="${v}" onchange="onAnswer('${q.id}')">
        <div class="option-btn">${v}</div>
      </label>
    `).join('');

    card.innerHTML = `
      <div class="question-num">Q${String(i+1).padStart(2,'0')}</div>
      <div class="question-text">${q.text}</div>
      <div class="options">${options}</div>
      <div class="option-hint">
        <span>全く当てはまらない</span>
        <span>非常に当てはまる</span>
      </div>
    `;
    container.appendChild(card);
  });
}

function onAnswer(qId) {
  document.getElementById(`card-${qId}`).classList.add('answered');
  updateProgress();
}

// ===== プログレス =====
function setupProgress() {
  const bar = document.createElement('div');
  bar.className = 'progress-bar';
  bar.id = 'progress-bar';
  bar.style.width = '0%';
  document.body.appendChild(bar);
}

function updateProgress() {
  const answered = QUESTIONS.filter(q =>
    document.querySelector(`input[name="${q.id}"]:checked`)
  ).length;
  const pct = (answered / QUESTIONS.length) * 100;
  document.getElementById('progress-bar').style.width = pct + '%';
}

// ===== スコア計算 =====
function calcScores(answers) {
  const scores = {};
  for (const [key, factor] of Object.entries(FACTORS)) {
    const vals = factor.questions.map(qId => {
      const q = QUESTIONS.find(q => q.id === qId);
      const raw = answers[qId];
      return q.reverse ? (6 - raw) : raw;
    });
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    scores[key] = Math.round(avg * 10) / 10;
  }
  return scores;
}

// ===== フォーム送信 =====
async function handleSubmit(e) {
  e.preventDefault();

  const name   = document.getElementById('employee-name').value.trim();
  const email  = document.getElementById('employee-email').value.trim();
  const gender = document.getElementById('employee-gender').value;
  const age    = document.getElementById('employee-age').value;
  const job    = document.getElementById('employee-job').value;
  const type   = document.getElementById('employee-type').value;

  if (!name || !email || !gender || !age || !job || !type) {
    alert('すべての項目を入力・選択してください');
    return;
  }

  const consent = document.getElementById('consent-check').checked;
  if (!consent) {
    alert('プライバシーポリシーへの同意が必要です');
    document.getElementById('consent-check').focus();
    return;
  }

  const answers = {};
  let missing = [];
  QUESTIONS.forEach(q => {
    const checked = document.querySelector(`input[name="${q.id}"]:checked`);
    if (checked) {
      answers[q.id] = parseInt(checked.value);
    } else {
      missing.push(q.id);
    }
  });

  if (missing.length > 0) {
    alert(`まだ回答していない設問があります（${missing.length}問）`);
    const firstMissing = document.getElementById(`card-${missing[0]}`);
    firstMissing.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const scores = calcScores(answers);
  const profile = { name, email, gender, age, job, type };

  showLoading();

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'submit_diagnosis', companyCode, profile, scores }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'エラーが発生しました');
    showResult(profile, scores, data.employeeReport, data.resultId);
  } catch (err) {
    hideLoading();
    alert('送信に失敗しました。\n\n' + err.message);
  }
}


// ===== 結果表示 =====
let currentResultId = '';

function showResult(profile, scores, report, resultId) {
  currentResultId = resultId || '';
  hideLoading();
  document.getElementById('form-screen').classList.add('hidden');
  document.getElementById('result-screen').classList.remove('hidden');

  document.getElementById('result-name-title').textContent = `${profile.name} さんの診断レポート`;

  renderScoreBars(scores);
  renderRadarChart(scores);
  document.getElementById('ai-report-content').innerHTML = renderReport(report);

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderScoreBars(scores) {
  const container = document.getElementById('score-bars');
  container.innerHTML = '';
  for (const [key, factor] of Object.entries(FACTORS)) {
    const val = scores[key];
    const pct = (val / 5) * 100;
    const cls = val >= 3.5 ? 'score-high' : val >= 2.5 ? 'score-mid' : 'score-low';
    container.innerHTML += `
      <div class="score-bar-item">
        <div class="score-bar-header">
          <span class="score-bar-label">${factor.label}</span>
          <span class="score-bar-value">${val.toFixed(1)}</span>
        </div>
        <div class="score-bar-track">
          <div class="score-bar-fill ${cls}" style="width:${pct}%"></div>
        </div>
      </div>
    `;
  }
}

function renderRadarChart(scores) {
  const canvas = document.getElementById('radar-chart');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const R = Math.min(W, H) / 2 - 50;

  const labels = Object.values(FACTORS).map(f => f.label);
  const vals = ['A','B','C','D','E'].map(k => scores[k] / 5);
  const N = labels.length;

  ctx.clearRect(0, 0, W, H);

  // グリッド
  for (let r = 1; r <= 5; r++) {
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const angle = (Math.PI * 2 * i / N) - Math.PI / 2;
      const x = cx + (R * r / 5) * Math.cos(angle);
      const y = cy + (R * r / 5) * Math.sin(angle);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // 軸
  for (let i = 0; i < N; i++) {
    const angle = (Math.PI * 2 * i / N) - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + R * Math.cos(angle), cy + R * Math.sin(angle));
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // データ
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    const angle = (Math.PI * 2 * i / N) - Math.PI / 2;
    const x = cx + R * vals[i] * Math.cos(angle);
    const y = cy + R * vals[i] * Math.sin(angle);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(79,70,229,0.15)';
  ctx.fill();
  ctx.strokeStyle = '#4F46E5';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 点
  for (let i = 0; i < N; i++) {
    const angle = (Math.PI * 2 * i / N) - Math.PI / 2;
    const x = cx + R * vals[i] * Math.cos(angle);
    const y = cy + R * vals[i] * Math.sin(angle);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#4F46E5';
    ctx.fill();
  }

  // ラベル
  ctx.fillStyle = '#374151';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < N; i++) {
    const angle = (Math.PI * 2 * i / N) - Math.PI / 2;
    const x = cx + (R + 30) * Math.cos(angle);
    const y = cy + (R + 30) * Math.sin(angle);
    ctx.fillText(labels[i], x, y);
  }
}

// ===== レポートレンダラー =====
function renderReport(text) {
  const lines = text.split('\n');
  let html = '';
  let inScoreBlock = false;

  lines.forEach(line => {
    // 区切り線
    if (/^━+$/.test(line.trim())) {
      html += '<hr class="report-divider">';
      return;
    }
    // セクションヘッダー（▼）
    if (/^▼/.test(line.trim())) {
      html += `<div class="report-section-header">${escHtml(line.trim())}</div>`;
      return;
    }
    // 【タイトル】
    if (/^【.+】$/.test(line.trim())) {
      html += `<div class="report-block-title">${escHtml(line.trim())}</div>`;
      return;
    }
    // スコア行（・xxx：x.x / 5.0）
    if (/^・.+：[\d.]+\s*\/\s*5\.0/.test(line.trim())) {
      const match = line.match(/^・(.+)：([\d.]+)\s*\/\s*5\.0/);
      if (match) {
        const val = parseFloat(match[2]);
        const pct = Math.round(val / 5 * 100);
        const cls = val >= 3.5 ? '#10B981' : val >= 2.5 ? '#F59E0B' : '#EF4444';
        html += `<div class="report-score-row">
          <div class="report-score-label">${escHtml(match[1])}</div>
          <div class="report-score-bar-wrap">
            <div class="report-score-bar" style="width:${pct}%;background:${cls};"></div>
          </div>
          <div class="report-score-num" style="color:${cls};">${val}</div>
        </div>`;
        return;
      }
    }
    // 番号付きリスト（1. 2. 3.）
    if (/^\d+\.\s/.test(line.trim())) {
      html += `<div class="report-list-item">${renderInline(line.trim())}</div>`;
      return;
    }
    // ●リスト
    if (/^●/.test(line.trim())) {
      html += `<div class="report-bullet">${renderInline(line.trim())}</div>`;
      return;
    }
    // 空行
    if (line.trim() === '') {
      html += '<div class="report-spacer"></div>';
      return;
    }
    // 通常テキスト
    html += `<div class="report-line">${renderInline(line)}</div>`;
  });

  return html;
}

function renderInline(text) {
  return escHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function showLoading() {
  document.getElementById('form-screen').classList.add('hidden');
  document.getElementById('loading-screen').classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loading-screen').classList.add('hidden');
}

function downloadPdf() {
  window.print();
}

function copyResultUrl() {
  if (!currentResultId) { alert('結果URLを取得できませんでした'); return; }
  const url = `${window.location.origin}${window.location.pathname.replace('index.html','result.html')}?id=${currentResultId}`;
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.getElementById('copy-url-btn');
    btn.textContent = '✅ コピーしました';
    setTimeout(() => { btn.textContent = '🔗 結果URLをコピー'; }, 2000);
  });
}

function restart() {
  document.getElementById('result-screen').classList.add('hidden');
  document.getElementById('form-screen').classList.remove('hidden');
  document.getElementById('diagnosis-form').reset();
  document.querySelectorAll('.question-card').forEach(c => c.classList.remove('answered'));
  document.getElementById('progress-bar').style.width = '0%';
  window.scrollTo({ top: 0 });
}
