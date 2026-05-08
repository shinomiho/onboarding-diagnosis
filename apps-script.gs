// ================================================================
// リミー診断システム - Google Apps Script バックエンド
// ================================================================
// 【セットアップ手順】
// 1. スクリプトプロパティに以下を設定:
//    SPREADSHEET_ID  : GoogleスプレッドシートのID
//    CLAUDE_API_KEY  : AnthropicのAPIキー
//    ADMIN_SECRET    : 管理画面用パスワード（任意の文字列）
// 2. 「デプロイ」→「新しいデプロイ」→「ウェブアプリ」
//    実行ユーザー: 自分, アクセス: 全員
// ================================================================

// ===== 専門家アドバイスデータ（薬剤師・理学療法士） =====
const HEALTH_ADVICE = {
  sleep: {
    label: '睡眠・回復',
    pharmacist: '寝つけない人の多くは"寝る前の糖不足"で、脳がエネルギー警報を鳴らして眠りを許していない状態です。白湯よりも"蜂蜜ひとさじ"のほうが即エネルギー源として脳を安心させ、眠りのスイッチを入れてくれます。',
    pt: '朝疲れが取れないのは熟睡できていないサインです。寝る前の軽めのストレッチ、朝起きたら朝日を浴びてウォーキングなどリズム運動をすると幸せホルモンが分泌され気分も晴れてきます。',
  },
  fatigue: {
    label: '疲労回復',
    pt: '1日の終わりに過度に疲れている時は、適度な休憩が取れているかを確認しましょう。深呼吸して息抜きする時間をつくったり、15分程度のお昼寝もおすすめです。',
  },
  anxiety: {
    label: '緊張・不安の身体反応',
    pharmacist: '不安・緊張の身体反応は"脳のエネルギー不足"による燃料切れの警報です。血糖を整えることが根本対策になります。',
    pt: '緊張や不安を感じると呼吸が浅くなったり、肩や体が緊張します。胸やお腹に手を当てて深呼吸をしたり、手足をぶらぶらふるのもおすすめです。',
  },
  concentration: {
    label: '集中力・覚醒',
    pharmacist: '昼食の炭水化物を減らし、その分の糖質をフルーツやスープなど消化にやさしいものにしましょう。午後はこまめな糖補給でエネルギーの落差をなくすことが大切です。',
  },
  nutrition: {
    label: '栄養・血糖管理',
    pharmacist: '集中が切れたときに糖を入れないでいると、エネルギー不足を自分で強化してしまいます。集中が途切れたら果物や飴などの糖をしっかり補給して脳を落ち着かせることが大切です。',
  },
  posture: {
    label: '姿勢・身体ケア',
    pt: '肩こり・腰痛・首の痛みは不良姿勢が原因のことが多いです。猫背やスマホ首などご自身の姿勢をチェックしましょう。こまめに肩回しや簡単なストレッチ、移動はできるだけ歩くなど日常の中に運動を取り入れることをおすすめします。',
  },
  sittingBreak: {
    label: '姿勢リセット',
    pt: '30分に1回は立ち上がったり軽いストレッチをするのがおすすめです。集中しすぎる方はタイマーを使って意識的に姿勢を変えるようにしましょう。',
  },
  selfCare: {
    label: 'セルフケア継続',
    pharmacist: '正しいことをしているつもりなのに不調が続くのは、信じている健康の常識が体質に合っていないだけかもしれません。"気持ち良く続けられること"を選ぶ方が、結果的に一番体が整います。',
  },
  selfMonitoring: {
    label: '自己モニタリング',
    pharmacist: '「今の体は気持ちいい？しんどい？」と一言だけメモするだけで十分。体の声を"文字にする"だけで脳が自分の状態をつかみやすくなり、無理が減ります。',
    pt: '1日のうちわずかな時間でも、ふっと一息つく時間を意識的につくってみてください。自分の体の状態に気づくきっかけになります。',
  },
};

function getRelevantAdvice(scores) {
  const selected = [];
  if (scores.C < 3.0)                   { selected.push(HEALTH_ADVICE.sleep); selected.push(HEALTH_ADVICE.fatigue); }
  if (scores.C < 2.5 || scores.D < 3.0) { selected.push(HEALTH_ADVICE.anxiety); }
  if (scores.A < 3.0)                   { selected.push(HEALTH_ADVICE.concentration); selected.push(HEALTH_ADVICE.nutrition); }
  if (scores.D < 3.0)                   { selected.push(HEALTH_ADVICE.posture); selected.push(HEALTH_ADVICE.sittingBreak); }
  if (scores.E < 3.0)                   { selected.push(HEALTH_ADVICE.selfCare); }
  selected.push(HEALTH_ADVICE.selfMonitoring);
  const unique = [...new Map(selected.map(a => [a.label, a])).values()];
  return unique.slice(0, 3);
}

function formatAdviceForPrompt(advice) {
  return advice.map(a => {
    const lines = [`【${a.label}】`];
    if (a.pharmacist) lines.push(`薬剤師：${a.pharmacist}`);
    if (a.pt)         lines.push(`理学療法士：${a.pt}`);
    return lines.join('\n');
  }).join('\n\n');
}

function getConfig() {
  const p = PropertiesService.getScriptProperties();
  return {
    spreadsheetId: p.getProperty('SPREADSHEET_ID'),
    claudeApiKey:  p.getProperty('CLAUDE_API_KEY'),
    adminSecret:   p.getProperty('ADMIN_SECRET'),
    regToken:      p.getProperty('REG_TOKEN') || '',
    limeeEmail:    'miho.shinohe@remenow.com',
    claudeModel:   'claude-sonnet-4-6',
    pharmacistName: '薬剤師 ○○ ○○',
    pharmacistUrl:  'https://example.com/pharmacist',
    ptName:         '理学療法士 ○○ ○○',
    ptUrl:          'https://example.com/pt',
    noteUrl:       'https://note.com/femtech_career',
    inquiryUrl:    'https://remenow.tokyo/inquiry/',
    siteUrl:       p.getProperty('SITE_URL') || '',
  };
}

// ===== ルーター =====
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const config = getConfig();
    if (data.action === 'submit_diagnosis')    return handleDiagnosis(data, config);
    if (data.action === 'add_company')         { if (!validateAdmin(data.adminSecret, config)) return err('認証エラー'); return addCompany(data, config); }
    if (data.action === 'delete_company')      { if (!validateAdmin(data.adminSecret, config)) return err('認証エラー'); return deleteCompany(data, config); }
    if (data.action === 'submit_action_check') return submitActionCheck(data, config);
    if (data.action === 'register_company')    return registerCompany(data, config);
    return err('不明なアクション');
  } catch(e) { return err(e.message); }
}

function doGet(e) {
  try {
    const config = getConfig();
    const action = e.parameter.action;
    if (action === 'get_companies')        { if (!validateAdmin(e.parameter.adminSecret, config)) return err('認証エラー'); return getCompanies(config); }
    if (action === 'get_company')          return getCompanyByCode(e.parameter.code, config);
    if (action === 'get_responses')        { if (!validateAdmin(e.parameter.adminSecret, config)) return err('認証エラー'); return getResponses(e.parameter.companyCode, config); }
    if (action === 'get_result')           return getResultById(e.parameter.id, config);
    if (action === 'get_kpi_data')         { if (!validateAdmin(e.parameter.adminSecret, config)) return err('認証エラー'); return getKpiData(e.parameter.companyCode || '', config); }
    if (action === 'get_action_check_info') return getActionCheckInfo(e.parameter.company, config);
    return err('不明なアクション');
  } catch(e) { return err(e.message); }
}

// ===== 診断処理（メイン） =====
function handleDiagnosis(data, config) {
  const company = getCompanyByCodeInternal(data.companyCode, config);
  if (!company) return err('無効な会社コードです');

  const employeeReport = callClaudeForEmployee(data.profile, data.scores, config);
  const managerReport  = callClaudeForManager(data.profile, data.scores, config);

  const resultId = saveResponse(data, company, employeeReport, managerReport, config);
  sendEmployeeEmail(data.profile, employeeReport, resultId, config);
  sendManagerEmail(company.managerEmail, data.profile, managerReport, config);
  sendAdminEmail(data.profile, company, employeeReport, managerReport, data.scores, config);

  return ok({ employeeReport, resultId });
}

// ===== Claude API =====
function callClaude(system, user, config) {
  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': config.claudeApiKey, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({ model: config.claudeModel, max_tokens: 4096, system, messages: [{ role: 'user', content: user }] }),
    muteHttpExceptions: true,
  });
  const json = JSON.parse(res.getContentText());
  if (json.error) throw new Error(json.error.message);
  return json.content[0].text;
}

function callClaudeForEmployee(profile, scores, config) {
  const relevantAdvice = getRelevantAdvice(scores);
  const adviceText = formatAdviceForPrompt(relevantAdvice);
  const system = `あなたは、入社間もない社会人の心と体に寄り添う、温かいメンターです。
薬剤師と理学療法士の専門知識を持ち、データから「今のあなた」をリアルに読み解きます。
本人が「深く理解してもらえた」と感じるパーソナライズされたメッセージを届けてください。

# 絶対ルール
・「あなた」に直接語りかける文体
・専門用語を使わない
・一文を短く、改行を極めて多く（スマホ最優先）
・セクション間は4行以上の空行
・「Score_」は使わない
・希望と前向きさを持たせながら現実も正直に`;

  const user = `# 対象者プロフィール
・氏名：${profile.name}／性別：${profile.gender}／年齢：${profile.age}
・職種：${profile.job}／入社形態：${profile.type}

# 診断データ
・仕事への馴染み度（業務適応）：${scores.A} / 5.0
・周りとのつながり（対人関係）：${scores.B} / 5.0
・心のガソリン残量（心理エナジー）：${scores.C} / 5.0
・要注意アラート（行動リスク）：${scores.D} / 5.0（低いほど注意）
・「ここで続けたい」（定着意思）：${scores.E} / 5.0

# 出力形式

━━━━━━━━━━━━━━━━━━━━
▼ 📊 今のあなたの「心の現在地」
━━━━━━━━━━━━━━━━━━━━
・仕事への馴染み度　：${scores.A} / 5.0
・周りとのつながり　：${scores.B} / 5.0
・心のガソリン残量　：${scores.C} / 5.0
・要注意アラート　　：${scores.D} / 5.0
・「ここで続けたい」：${scores.E} / 5.0
━━━━━━━━━━━━━━━━━━━━

▼ 🔍 メンターからの「ズバリ」一言

━━━━━━━━━━━━━━━━━━━━
【今のあなたのリアルな状態】
[スコアから読み取れる心理状態を温かく正直に]

【放置すると起きる「現場あるある」】
[このまま放置した場合に起きうる具体的なシーン3つ]

━━━━━━━━━━━━━━━━━━━━

▼ 📅 これから90日間のシミュレーション

━━━━━━━━━━━━━━━━━━━━
【30日目：[変化の名前]】
[30日後の変化を具体的に]

【60日目：[変化の名前]】
[60日後の状態を具体的に]

【90日目：[変化の名前]】
[90日後の状態を具体的に]

━━━━━━━━━━━━━━━━━━━━

▼ ✉️ 役立つヒントとサポート

━━━━━━━━━━━━━━━━━━━━
● 先輩たちの「乗り越え方」
【リミー公式note】
${config.noteUrl}

━━━━━━━━━━━━━━━━━━━━

▼ 🩺 専門家からの「今のあなたへの処方箋」

━━━━━━━━━━━━━━━━━━━━
【薬剤師・理学療法士による分析】
[下記の専門家アドバイスをベースに、このスコアのこの人に合った心身の状態を2〜3文で分析してください]

【明日からすぐできる！「楽になるためのTo Do」】
[下記の専門家アドバイスから3つ選び、この人のスコアに合わせて具体的に書いてください]
1. 薬剤師の知恵：[専門家アドバイスから引用・アレンジ]
2. 理学療法士の知恵：[専門家アドバイスから引用・アレンジ]
3. 共通の知恵：[専門家アドバイスから引用・アレンジ]

━━━━━━━━━━━━━━━━━━━━

▼ 👩‍⚕️ 今回の処方箋を監修した専門家に、無料で相談できます

━━━━━━━━━━━━━━━━━━━━

● 薬剤師からの無料相談
${config.pharmacistName}
${config.pharmacistUrl}


● 理学療法士からの無料相談
${config.ptName}
${config.ptUrl}


━━━━━━━━━━━━━━━━━━━━
【運営】リミー事務局

# 専門家アドバイス参照データ（処方箋セクションのみに使用）
${adviceText}`;

  return callClaude(system, user, config);
}

function callClaudeForManager(profile, scores, config) {
  const system = `あなたは、数々の現場を「構造化」で立て直してきた、
冷静かつ洞察力に優れた組織再建プロフェッショナルです。
管理職に対し、データが示す「部下の静かなシグナル」を伝え、
手遅れになる前に実行すべき「防衛・救済戦術」を提示してください。

# 分析ロジック（出力には含めないこと）
1. 心理エナジーが低い：30日目に「エネルギー枯渇による離脱」を予測。
2. 業務適応が低い：60日目に「役割へのミスマッチ」を予測。
3. 行動リスクまたは定着意思が低い：90日目に「心理的撤退の完了」を予測。

# 絶対ルール
・項目名（業務適応など）で記述。「Score_」禁止。
・一文を短く、改行を極めて多く。
・攻撃的な言葉を避ける。
・セクション間は4行以上の空行。`;

  const user = `# 対象者プロフィール
・氏名：${profile.name}／性別：${profile.gender}／年齢：${profile.age}
・職種：${profile.job}／入社形態：${profile.type}

# 参照データ
・業務適応：${scores.A}
・対人関係：${scores.B}
・心理エナジー：${scores.C}
・行動リスク：${scores.D}（※1に近いほど無意識のミスや反応の遅れが出やすい）
・定着意思：${scores.E}

# 出力形式

━━━━━━━━━━━━━━━━━━━━
【 📌 組織マネジメント・優先対応通知 】
　判定：[ 要注視（または状況に応じた名称） ]

━━━━━━━━━━━━━━━━━━━━
▼ 🧠 行動解析：データが示す「部下の内面」
━━━━━━━━━━━━━━━━━━━━

【数値が示す、心理的撤退のサイン】
[対人関係と定着意思の相関を分析]

【放置した場合に発生する「組織の歪み」】
[チームへの負担とマネジメント評価リスクを具体的に]

━━━━━━━━━━━━━━━━━━━━
▼ 🛡️ 90日間の「組織再設計」戦術
━━━━━━━━━━━━━━━━━━━━

【30日目：[予測される状態名]】
●現場で見られる兆候：
[箇条書き]
●今日、このセリフで歩み寄ってください：
「${profile.name}さん、今の役割、
君の本来の力と『ズレ』が生じていないか？
少し心配しているんだ。」

【60日目：[予測される状態名]】
●現場で見られる兆候：
[箇条書き]
●導入すべき「仕組み」：
[具体的な戦術]

【90日目：[予測される状態名]】
●現場で見られる兆候：
[箇条書き]
●最後の一手：
[相手のメリットに響くロジック]

━━━━━━━━━━━━━━━━━━━━
▼ 📊 詳細バイオマーカー（客観データ）
━━━━━━━━━━━━━━━━━━━━
・業務適応：${scores.A} / 5.0
・対人関係：${scores.B} / 5.0
・心理エナジー：${scores.C} / 5.0
・行動リスク：${scores.D} / 5.0（※低いほど心理的負荷が高い）
・定着意思：${scores.E} / 5.0

━━━━━━━━━━━━━━━━━━━━
▼ ✉️ マネジメントの「仕組み化」リソース
━━━━━━━━━━━━━━━━━━━━
● 現場を死守する「対応マニュアル」
【リミー公式note】
${config.noteUrl}

● 組織構造の再設計が必要な場合はこちら
${config.inquiryUrl}

━━━━━━━━━━━━━━━━━━━━
【運営】リミー事務局
miho.shinohe@remenow.com`;

  return callClaude(system, user, config);
}

// ===== データ保存 =====
function saveResponse(data, company, employeeReport, managerReport, config) {
  const ss = SpreadsheetApp.openById(config.spreadsheetId);
  let sheet = ss.getSheetByName('responses');
  if (!sheet) {
    sheet = ss.insertSheet('responses');
    sheet.appendRow(['timestamp','company_code','company_name','name','email','gender','age','job','type','score_a','score_b','score_c','score_d','score_e','employee_report','manager_report','result_id']);
    sheet.setFrozenRows(1);
  } else {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (!headers.includes('result_id')) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue('result_id');
    }
  }
  const resultId = Utilities.getUuid();
  sheet.appendRow([
    new Date().toISOString(),
    data.companyCode, company.name,
    data.profile.name, data.profile.email,
    data.profile.gender, data.profile.age,
    data.profile.job, data.profile.type,
    data.scores.A, data.scores.B, data.scores.C, data.scores.D, data.scores.E,
    employeeReport, managerReport, resultId,
  ]);
  return resultId;
}

// ===== メール送信 =====
function sendEmployeeEmail(profile, report, resultId, config) {
  const resultLinkHtml = (config.siteUrl && resultId)
    ? `<div style="text-align:center;margin:0 0 24px;">
         <a href="${config.siteUrl}/result.html?id=${resultId}"
            style="display:inline-block;background:#4F46E5;color:#fff;font-size:14px;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;">
           📊 診断結果をブラウザで見る
         </a>
       </div>`
    : '';
  MailApp.sendEmail({
    to: profile.email,
    subject: `【リミー】${profile.name}さんの入社90日診断レポート`,
    htmlBody: buildEmailHTML('本人向けレポート', `${profile.name} さんへ`, report, config, resultLinkHtml),
  });
}

function sendManagerEmail(managerEmail, profile, report, config) {
  MailApp.sendEmail({
    to: managerEmail,
    subject: `【リミー】${profile.name}さんのマネジメントレポート`,
    htmlBody: buildEmailHTML('マネージャー向け処方箋', `${profile.name} さんの診断結果`, report, config),
  });
}

function sendAdminEmail(profile, company, employeeReport, managerReport, scores, config) {
  const atRisk = scores.C < 2.5 || scores.D < 2.5 || scores.E < 2.5;
  const riskFlags = [
    scores.C < 2.5 ? `心理エナジー ${scores.C}` : null,
    scores.D < 2.5 ? `行動リスク ${scores.D}` : null,
    scores.E < 2.5 ? `定着意思 ${scores.E}` : null,
  ].filter(Boolean);

  const alertBanner = atRisk ? `
    <div style="background:#FEF2F2;border:2px solid #EF4444;border-radius:12px;padding:20px;margin-bottom:16px;">
      <p style="margin:0 0 8px;font-size:16px;font-weight:800;color:#DC2626;">🚨 要介入アラート</p>
      <p style="margin:0 0 8px;font-size:14px;color:#374151;">
        <strong>${profile.name}</strong>（${company.name}）に緊急度の高いシグナルが検出されました。
      </p>
      <p style="margin:0 0 12px;font-size:13px;color:#EF4444;font-weight:700;">
        ⚠️ ${riskFlags.join('　／　')}
      </p>
      <p style="margin:0;font-size:13px;color:#6B7280;line-height:1.7;">
        今週中に${company.name}の担当者へコンタクトし、介入の提案を行うことを推奨します。
      </p>
    </div>` : `
    <div style="background:#F0FDF4;border:1.5px solid #86EFAC;border-radius:12px;padding:16px;margin-bottom:16px;">
      <p style="margin:0;font-size:14px;color:#166534;">✅ 問題なし — ${profile.name}（${company.name}）スコアは安定しています</p>
    </div>`;

  const scoreTable = alertBanner + `<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
    <tr style="background:#F3F4F6;"><th style="padding:8px 12px;text-align:left;">因子</th><th style="padding:8px 12px;text-align:center;">スコア</th></tr>
    ${[['業務適応',scores.A],['対人関係',scores.B],['心理エナジー',scores.C],['行動リスク',scores.D],['定着意思',scores.E]].map(([l,v])=>`
    <tr style="border-bottom:1px solid #E5E7EB;">
      <td style="padding:8px 12px;">${l}</td>
      <td style="padding:8px 12px;text-align:center;font-weight:700;color:${v>=3.5?'#10B981':v>=2.5?'#F59E0B':'#EF4444'};">${v}</td>
    </tr>`).join('')}
  </table>
  <p style="font-size:12px;color:#6B7280;">会社：${company.name} ／ 職種：${profile.job} ／ ${profile.type}</p>`;

  const combinedReport = `【本人向けレポート】\n\n${employeeReport}\n\n${'━'.repeat(20)}\n\n【マネージャー向けレポート】\n\n${managerReport}`;
  const subject = atRisk
    ? `🚨【要介入】${company.name} / ${profile.name} — 緊急シグナル検出`
    : `【リミー管理者】新規診断 - ${company.name} / ${profile.name}`;

  MailApp.sendEmail({
    to: config.limeeEmail,
    subject,
    htmlBody: buildEmailHTML('管理者通知', `${profile.name}（${company.name}）`, combinedReport, config, scoreTable),
  });
}

// ===== 月次レポート（毎月1日・15日に自動実行） =====
function sendMonthlyReports() {
  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.spreadsheetId);
  const responsesSheet = ss.getSheetByName('responses');
  if (!responsesSheet) return;

  const now = new Date();
  let startDate, endDate, periodLabel;

  if (now.getDate() < 15) {
    // 1日実行：前月16日〜前月末日
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    startDate   = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 16);
    endDate     = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0, 23, 59, 59);
    periodLabel = `${prevMonth.getFullYear()}年${prevMonth.getMonth()+1}月 後半`;
  } else {
    // 15日実行：当月1日〜当月14日
    startDate   = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate     = new Date(now.getFullYear(), now.getMonth(), 14, 23, 59, 59);
    periodLabel = `${now.getFullYear()}年${now.getMonth()+1}月 前半`;
  }

  const companies = getCompaniesInternal(config);

  companies.forEach(company => {
    const responses = getCompanyResponses(responsesSheet, company.code, startDate, endDate);
    if (responses.length === 0) return;

    const aiAnalysis = generateMonthlyAnalysis(company, responses, config);
    const prevActionData = getPrevActionRate(ss, company.code);
    const actionCheckUrl = config.siteUrl
      ? `${config.siteUrl}/action-check.html?company=${company.code}&period=${encodeURIComponent(periodLabel)}&manager=${encodeURIComponent(company.managerEmail)}`
      : null;
    const html = buildMonthlyReportHTML(company, responses, aiAnalysis, periodLabel, prevActionData, actionCheckUrl);
    const subject = `【リミー】${company.name}様 オンボーディングレポート（${periodLabel}）`;
    const recipients = [company.managerEmail, company.hrEmail].filter(Boolean).join(',');

    MailApp.sendEmail({ to: recipients, bcc: config.limeeEmail, subject, htmlBody: html });
    logMonthlyReport(ss, company.code, recipients);
  });
}

function getCompanyResponses(sheet, code, startDate, endDate) {
  return sheet.getDataRange().getValues().slice(1)
    .filter(r => r[1] === code && new Date(r[0]) >= startDate && new Date(r[0]) <= endDate)
    .map(r => ({ name: r[3], job: r[7], scores: { A: r[9], B: r[10], C: r[11], D: r[12], E: r[13] } }));
}

function generateMonthlyAnalysis(company, responses, config) {
  const avg = k => (responses.reduce((s,r) => s + r.scores[k], 0) / responses.length).toFixed(1);
  const atRisk = responses.filter(r => r.scores.C < 2.5 || r.scores.D < 2.5 || r.scores.E < 2.5);

  const system = `あなたは、組織の仕組み化を専門とするHRコンサルタントです。
新入社員オンボーディングデータを分析し、
経営者・人事担当者が今すぐ取るべきアクションを提示してください。

# あなたの役割の背景
スコアの低さは「個人の問題」ではなく「組織の仕組み化が追いついていないサイン」です。
データをもとに、組織として今何が欠けているかを明確にし、
具体的な仕組み化の介入ポイントを提案してください。
簡潔・明確・実践的に書いてください。`;

  const user = `# ${company.name} 月次オンボーディング分析
診断人数：${responses.length}名 ／ 要注意：${atRisk.length}名

## チーム平均
業務適応:${avg('A')} 対人関係:${avg('B')} 心理エナジー:${avg('C')} 行動リスク:${avg('D')} 定着意思:${avg('E')}

## 個別データ
${responses.map(r=>`・${r.name}（${r.job}）：業務${r.scores.A}/対人${r.scores.B}/エナジー${r.scores.C}/リスク${r.scores.D}/定着${r.scores.E}`).join('\n')}

以下の形式で回答してください：

【今月のチーム総評】
[3〜5文で現状を端的に。スコアの低さを組織課題として捉えた視点で]

【最優先の対応が必要なメンバー】
[要注意メンバーとその理由。放置した場合のリスクも明記]

【来月に向けた推奨アクション】
1. [具体的なアクション]
2. [具体的なアクション]
3. [具体的なアクション]

【チームの強みと伸びしろ】
[ポジティブな観察と成長ポイント]

【組織の仕組み化：今すぐ着手すべきポイント】
${atRisk.length > 0
  ? `[要注意メンバーのデータをもとに、この組織に今欠けている仕組みを2〜3点、具体的に指摘してください。例：1on1の頻度、役割定義、心理的安全性の設計など]`
  : `[現状を維持・強化するために、今から導入しておくべき予防的な仕組みを2〜3点提案してください]`
}`;

  return callClaude(system, user, config);
}

function buildMonthlyReportHTML(company, responses, aiAnalysis, periodLabel, prevActionData, actionCheckUrl) {
  const sc = v => v >= 3.5 ? '#10B981' : v >= 2.5 ? '#F59E0B' : '#EF4444';
  const bar = v => `<div style="background:#F3F4F6;border-radius:99px;height:8px;"><div style="background:${sc(v)};height:8px;border-radius:99px;width:${Math.round(v/5*100)}%;"></div></div>`;
  const avg = k => (responses.reduce((s,r)=>s+r.scores[k],0)/responses.length).toFixed(1);
  const atRiskCount = responses.filter(r=>r.scores.C<2.5||r.scores.D<2.5||r.scores.E<2.5).length;

  const scoreLabels = [['A','業務適応'],['B','対人関係'],['C','心理エナジー'],['D','行動リスク'],['E','定着意思']];
  const avgBars = scoreLabels.map(([k,l]) => `
    <div style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="font-size:13px;font-weight:600;color:#374151;">${l}</span>
        <span style="font-size:13px;font-weight:700;color:${sc(avg(k))};">${avg(k)}</span>
      </div>${bar(avg(k))}
    </div>`).join('');

  const memberRows = responses.map(r => {
    const risk = r.scores.C<2.5||r.scores.D<2.5||r.scores.E<2.5;
    return `<tr style="border-bottom:1px solid #E5E7EB;">
      <td style="padding:10px 12px;font-size:13px;">${risk?'⚠️ ':'✅ '}${r.name}</td>
      <td style="padding:10px 12px;font-size:12px;color:#6B7280;">${r.job}</td>
      ${['A','B','C','D','E'].map(k=>`<td style="padding:10px 8px;text-align:center;font-size:13px;font-weight:700;color:${sc(r.scores[k])};">${r.scores[k]}</td>`).join('')}
    </tr>`;
  }).join('');

  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:'Hiragino Sans',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
<tr><td><table width="600" align="center" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

  <tr><td style="background:linear-gradient(135deg,#4F46E5,#7C3AED);padding:36px;text-align:center;">
    <p style="margin:0 0 6px;font-size:11px;color:rgba(255,255,255,0.6);letter-spacing:3px;">MONTHLY REPORT</p>
    <h1 style="margin:0 0 8px;font-size:22px;color:#fff;font-weight:800;">${company.name} 様</h1>
    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.8);">${periodLabel} オンボーディングレポート</p>
  </td></tr>

  <tr><td style="padding:32px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="background:#EEF2FF;border-radius:12px;padding:20px;text-align:center;width:48%;">
        <p style="margin:0 0 4px;font-size:12px;color:#6B7280;">診断実施</p>
        <p style="margin:0;font-size:32px;font-weight:800;color:#4F46E5;">${responses.length}<span style="font-size:16px;"> 名</span></p>
      </td>
      <td style="width:4%;"></td>
      <td style="background:#FEF2F2;border-radius:12px;padding:20px;text-align:center;width:48%;">
        <p style="margin:0 0 4px;font-size:12px;color:#6B7280;">要注意</p>
        <p style="margin:0;font-size:32px;font-weight:800;color:#EF4444;">${atRiskCount}<span style="font-size:16px;"> 名</span></p>
      </td>
    </tr></table>
  </td></tr>

  <tr><td style="padding:0 32px 32px;">
    <h2 style="margin:0 0 16px;font-size:15px;color:#1F2937;border-left:4px solid #4F46E5;padding-left:12px;">チーム平均スコア</h2>
    ${avgBars}
  </td></tr>

  <tr><td style="padding:0 32px 32px;">
    <h2 style="margin:0 0 16px;font-size:15px;color:#1F2937;border-left:4px solid #4F46E5;padding-left:12px;">メンバー別スコア</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr style="background:#F9FAFB;">
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6B7280;">氏名</th>
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6B7280;">職種</th>
        <th style="padding:8px;text-align:center;font-size:11px;color:#6B7280;">業務</th>
        <th style="padding:8px;text-align:center;font-size:11px;color:#6B7280;">対人</th>
        <th style="padding:8px;text-align:center;font-size:11px;color:#6B7280;">エナジー</th>
        <th style="padding:8px;text-align:center;font-size:11px;color:#6B7280;">リスク</th>
        <th style="padding:8px;text-align:center;font-size:11px;color:#6B7280;">定着</th>
      </tr>
      ${memberRows}
    </table>
  </td></tr>

  <tr><td style="padding:0 32px 32px;">
    <h2 style="margin:0 0 16px;font-size:15px;color:#1F2937;border-left:4px solid #7C3AED;padding-left:12px;">🤖 AI分析レポート</h2>
    <div style="background:#FAFAFA;border-radius:12px;padding:24px;font-size:14px;line-height:1.9;color:#374151;white-space:pre-wrap;">${aiAnalysis}</div>
  </td></tr>

  ${prevActionData ? `
  <tr><td style="padding:0 32px 24px;">
    <div style="background:#F0FDF4;border:1.5px solid #86EFAC;border-radius:16px;padding:24px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:1px;">先月のプロセス指標</p>
      <p style="margin:0 0 12px;font-size:13px;color:#166534;">マネジメントアクション実施率（${prevActionData.period}）</p>
      <p style="margin:0;font-size:42px;font-weight:800;color:${prevActionData.rate >= 80 ? '#10B981' : prevActionData.rate >= 50 ? '#F59E0B' : '#EF4444'};">${prevActionData.rate}<span style="font-size:20px;">%</span></p>
    </div>
  </td></tr>
  ` : ''}

  ${actionCheckUrl ? `
  <tr><td style="padding:0 32px 32px;">
    <div style="background:#EEF2FF;border:1.5px solid #C7D2FE;border-radius:16px;padding:24px;text-align:center;">
      <p style="margin:0 0 6px;font-size:22px;">📋</p>
      <h3 style="margin:0 0 8px;font-size:16px;font-weight:800;color:#4F46E5;">今期の推奨アクションを振り返る</h3>
      <p style="margin:0 0 16px;font-size:13px;color:#374151;line-height:1.7;">
        このレポートで推奨されたアクション、どのくらい実施できましたか？<br>
        約2分で入力できます。実施率は次回のレポートに「プロセス指標」として反映されます。
      </p>
      <a href="${actionCheckUrl}" style="display:inline-block;background:#4F46E5;color:#fff;font-size:14px;font-weight:700;padding:12px 28px;border-radius:10px;text-decoration:none;">
        ✅ アクションを振り返る →
      </a>
    </div>
  </td></tr>
  ` : ''}

  ${atRiskCount >= 1 ? `
  <tr><td style="padding:0 32px 32px;">
    <div style="background:linear-gradient(135deg,#FEF2F2,#FFF1F1);border:2px solid #EF4444;border-radius:16px;padding:28px;text-align:center;">
      <p style="margin:0 0 6px;font-size:22px;">🚨</p>
      <h2 style="margin:0 0 10px;font-size:17px;font-weight:800;color:#DC2626;">要介入アラート：今すぐ対応が必要です</h2>
      <p style="margin:0 0 6px;font-size:14px;color:#374151;line-height:1.8;">
        今期、<strong style="color:#DC2626;">${atRiskCount}名</strong>のメンバーに心理的・行動的なリスクサインが検出されました。<br>
        放置すると離職・チームへの負荷拡大につながる可能性があります。
      </p>
      <p style="margin:12px 0 20px;font-size:13px;color:#6B7280;line-height:1.8;">
        リミーでは、こうした状態を「組織の仕組み化が追いついていないサイン」と捉えています。<br>
        データをもとに、今の御社に最適な介入プランをご提案できます。
      </p>
      <a href="https://remenow.tokyo/inquiry/" style="display:inline-block;background:#EF4444;color:#fff;font-size:14px;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;">
        📞 無料相談を予約する →
      </a>
    </div>
  </td></tr>
  ` : `
  <tr><td style="padding:0 32px 32px;">
    <div style="background:linear-gradient(135deg,#EEF2FF,#F5F3FF);border:1.5px solid #C7D2FE;border-radius:16px;padding:28px;text-align:center;">
      <p style="margin:0 0 6px;font-size:22px;">💡</p>
      <h2 style="margin:0 0 10px;font-size:17px;font-weight:800;color:#4F46E5;">今が「仕組み化」の好機です</h2>
      <p style="margin:0 0 6px;font-size:14px;color:#374151;line-height:1.8;">
        今期はリスクの高いメンバーはいませんでした。素晴らしい状態です。<br>
        ただし、この状態を維持・強化するには<strong>組織としての仕組み</strong>が必要です。
      </p>
      <p style="margin:12px 0 20px;font-size:13px;color:#6B7280;line-height:1.8;">
        リミーでは、好調な今だからこそできる「予防的オンボーディング設計」をご提案しています。<br>
        次のフェーズに向けて、一緒に土台を作りませんか？
      </p>
      <a href="https://remenow.tokyo/inquiry/" style="display:inline-block;background:#4F46E5;color:#fff;font-size:14px;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;">
        🗓️ 無料セッションを予約する →
      </a>
    </div>
  </td></tr>
  `}

  <tr><td style="background:#F9FAFB;padding:28px 32px;text-align:center;border-top:1px solid #E5E7EB;">
    <img src="https://drive.google.com/uc?export=view&id=1EXtEctBTrl__APTO1h4DUD_dmBy8jkEg" alt="リミー" style="width:160px;height:auto;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto;">
    <p style="margin:0 0 4px;font-size:12px;color:#9CA3AF;">入社後90日に特化した採用後支援HRテック</p>
    <p style="margin:0;font-size:12px;color:#9CA3AF;">miho.shinohe@remenow.com</p>
  </td></tr>

</table></td></tr></table>
</body></html>`;
}

function logMonthlyReport(ss, code, recipients) {
  let sheet = ss.getSheetByName('monthly_reports');
  if (!sheet) { sheet = ss.insertSheet('monthly_reports'); sheet.appendRow(['sent_at','company_code','recipients']); }
  sheet.appendRow([new Date().toISOString(), code, recipients]);
}

// ===== 会社管理 =====
function addCompany(data, config) {
  const ss = SpreadsheetApp.openById(config.spreadsheetId);
  let sheet = ss.getSheetByName('companies');
  if (!sheet) { sheet = ss.insertSheet('companies'); sheet.appendRow(['code','name','manager_email','hr_email','created_at']); sheet.setFrozenRows(1); }
  const code = 'LIMEE_' + Array.from({length:6}, ()=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');
  sheet.appendRow([code, data.name, data.managerEmail, data.hrEmail || '', new Date().toISOString()]);
  return ok({ code });
}

function deleteCompany(data, config) {
  const ss = SpreadsheetApp.openById(config.spreadsheetId);
  const sheet = ss.getSheetByName('companies');
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.code) { sheet.deleteRow(i + 1); return ok({}); }
  }
  return err('会社が見つかりません');
}

function getCompanies(config) { return ok({ companies: getCompaniesInternal(config) }); }

function getCompaniesInternal(config) {
  const ss = SpreadsheetApp.openById(config.spreadsheetId);
  const sheet = ss.getSheetByName('companies');
  if (!sheet) return [];
  return sheet.getDataRange().getValues().slice(1).filter(r=>r[0]).map(r=>({ code:r[0], name:r[1], managerEmail:r[2], hrEmail:r[3], createdAt:r[4] }));
}

function getCompanyByCode(code, config) {
  const c = getCompanyByCodeInternal(code, config);
  return c ? ok({ company: { name: c.name } }) : err('会社が見つかりません');
}

function getCompanyByCodeInternal(code, config) {
  return getCompaniesInternal(config).find(c => c.code === code) || null;
}

function getResponses(companyCode, config) {
  const ss = SpreadsheetApp.openById(config.spreadsheetId);
  const sheet = ss.getSheetByName('responses');
  if (!sheet) return ok({ responses: [] });
  const rows = sheet.getDataRange().getValues().slice(1);
  const filtered = companyCode ? rows.filter(r=>r[1]===companyCode) : rows;
  return ok({ responses: filtered.map(r=>({ timestamp:r[0], companyName:r[2], name:r[3], email:r[4], gender:r[5], age:r[6], job:r[7], type:r[8], scores:{A:r[9],B:r[10],C:r[11],D:r[12],E:r[13]} })) });
}

// ===== メールHTMLビルダー =====
function buildEmailHTML(label, title, content, config, extraHtml) {
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:'Hiragino Sans',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
<tr><td><table width="600" align="center" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
  <tr><td style="background:linear-gradient(135deg,#4F46E5,#7C3AED);padding:32px;text-align:center;">
    <p style="margin:0 0 6px;font-size:11px;color:rgba(255,255,255,0.6);letter-spacing:2px;">${label.toUpperCase()}</p>
    <h1 style="margin:0;font-size:20px;color:#fff;font-weight:700;">${title}</h1>
  </td></tr>
  ${extraHtml ? `<tr><td style="padding:24px 32px 0;">${extraHtml}</td></tr>` : ''}
  <tr><td style="padding:32px;">
    <div style="font-size:14px;line-height:1.9;color:#374151;white-space:pre-wrap;">${content}</div>
  </td></tr>
  <tr><td style="background:#F9FAFB;padding:28px 32px;text-align:center;border-top:1px solid #E5E7EB;">
    <img src="https://drive.google.com/uc?export=view&id=1EXtEctBTrl__APTO1h4DUD_dmBy8jkEg" alt="リミー" style="width:160px;height:auto;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto;">
    <a href="${config.noteUrl}" style="font-size:12px;color:#4F46E5;text-decoration:none;">リミー公式note</a>
    <span style="color:#D1D5DB;margin:0 8px;">|</span>
    <a href="${config.inquiryUrl}" style="font-size:12px;color:#4F46E5;text-decoration:none;">お問い合わせ</a>
  </td></tr>
</table></td></tr></table>
</body></html>`;
}

// ===== 結果取得 =====
function getResultById(id, config) {
  if (!id) return err('IDが指定されていません');
  const ss = SpreadsheetApp.openById(config.spreadsheetId);
  const sheet = ss.getSheetByName('responses');
  if (!sheet) return err('データが見つかりません');
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const resultIdIdx = headers.indexOf('result_id');
  if (resultIdIdx === -1) return err('result_idカラムが見つかりません');
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][resultIdIdx] === id) {
      const r = rows[i];
      return ok({
        result: {
          timestamp:      r[0],
          name:           r[3],
          scores:         { A: r[9], B: r[10], C: r[11], D: r[12], E: r[13] },
          employeeReport: r[14],
        }
      });
    }
  }
  return err('結果が見つかりません');
}

// ===== アクションチェック リマインドメール（毎月5日・20日） =====

function sendActionCheckReminders() {
  const now = new Date();
  const day = now.getDate();
  if (day !== 5 && day !== 20) return; // 5日・20日以外は何もしない

  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.spreadsheetId);

  // 対象期間ラベルを算出（月次レポートと同じロジック）
  let periodLabel;
  if (day === 5) {
    // 1日レポート分（前月後半）のリマインド
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    periodLabel = `${prevMonth.getFullYear()}年${prevMonth.getMonth() + 1}月 後半`;
  } else {
    // 15日レポート分（当月前半）のリマインド
    periodLabel = `${now.getFullYear()}年${now.getMonth() + 1}月 前半`;
  }

  const companies = getCompaniesInternal(config);
  const actionsSheet = ss.getSheetByName('manager_actions');

  companies.forEach(company => {
    // すでに回答済みならスキップ
    if (actionsSheet) {
      const already = actionsSheet.getDataRange().getValues().slice(1)
        .find(r => r[1] === company.code && r[3] === periodLabel);
      if (already) return;
    }

    if (!config.siteUrl) return;
    const actionCheckUrl = `${config.siteUrl}/action-check.html?company=${company.code}&period=${encodeURIComponent(periodLabel)}&manager=${encodeURIComponent(company.managerEmail)}`;

    MailApp.sendEmail({
      to: company.managerEmail,
      subject: `【リミー】アクションチェックのご回答をお願いします（${periodLabel}）`,
      htmlBody: buildReminderEmailHTML(company, periodLabel, actionCheckUrl, config),
    });
  });
}

function buildReminderEmailHTML(company, periodLabel, actionCheckUrl, config) {
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:'Hiragino Sans',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
<tr><td><table width="600" align="center" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

  <tr><td style="background:linear-gradient(135deg,#4F46E5,#7C3AED);padding:32px;text-align:center;">
    <p style="margin:0 0 6px;font-size:11px;color:rgba(255,255,255,0.6);letter-spacing:2px;">ACTION CHECK REMINDER</p>
    <h1 style="margin:0;font-size:20px;color:#fff;font-weight:700;">${company.name} 様</h1>
  </td></tr>

  <tr><td style="padding:32px;">
    <p style="font-size:15px;font-weight:700;color:#1F2937;margin:0 0 12px;">📋 アクションチェックのご回答をお願いします</p>
    <p style="font-size:14px;color:#374151;line-height:1.9;margin:0 0 20px;">
      <strong>${periodLabel}</strong>の月次レポートで推奨したアクション、どのくらい実施できましたか？<br>
      5つの質問に答えるだけで、約2分で完了します。
    </p>

    <div style="background:#EEF2FF;border-radius:12px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#4F46E5;line-height:1.8;">
        💡 回答いただいた実施率は次回の月次レポートに<br>
        <strong>「マネジメントアクション実施率（プロセス指標）」</strong>として反映されます。<br>
        蓄積データは人的資本開示KPIとしてご活用いただけます。
      </p>
    </div>

    <div style="text-align:center;margin-bottom:20px;">
      <a href="${actionCheckUrl}" style="display:inline-block;background:#4F46E5;color:#fff;font-size:15px;font-weight:700;padding:16px 40px;border-radius:12px;text-decoration:none;">
        ✅ アクションを振り返る →
      </a>
    </div>

    <p style="font-size:12px;color:#9CA3AF;text-align:center;margin:0;">
      ※ すでにご回答済みの場合はこのメールを無視してください
    </p>
  </td></tr>

  <tr><td style="background:#F9FAFB;padding:28px 32px;text-align:center;border-top:1px solid #E5E7EB;">
    <img src="https://drive.google.com/uc?export=view&id=1EXtEctBTrl__APTO1h4DUD_dmBy8jkEg" alt="リミー" style="width:160px;height:auto;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto;">
    <p style="margin:0 0 4px;font-size:12px;color:#9CA3AF;">入社後90日に特化した採用後支援HRテック</p>
    <a href="${config.inquiryUrl}" style="font-size:12px;color:#4F46E5;text-decoration:none;">お問い合わせ</a>
  </td></tr>

</table></td></tr></table>
</body></html>`;
}

// ===== フェーズ2: アクションチェック =====

function getOrCreateActionSheet(ss) {
  let sheet = ss.getSheetByName('manager_actions');
  if (!sheet) {
    sheet = ss.insertSheet('manager_actions');
    sheet.appendRow(['timestamp','company_code','company_name','period','q1','q2','q3','q4','q5','free_text','implementation_rate','manager_email']);
    sheet.setFrozenRows(1);
  } else {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (!headers.includes('manager_email')) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue('manager_email');
    }
  }
  return sheet;
}

function submitActionCheck(data, config) {
  const ss = SpreadsheetApp.openById(config.spreadsheetId);
  const company = getCompanyByCodeInternal(data.companyCode, config);
  if (!company) return err('無効な会社コードです');

  const sheet = getOrCreateActionSheet(ss);
  const existing = sheet.getDataRange().getValues().slice(1)
    .find(r => r[1] === data.companyCode && r[3] === data.period);
  if (existing) return err('すでにこの期間の回答が登録されています');

  const scores = [data.q1, data.q2, data.q3, data.q4, data.q5].map(Number);
  const rate = Math.round(scores.reduce((s, v) => s + (v === 3 ? 1 : v === 2 ? 0.5 : 0), 0) / 5 * 100);

  sheet.appendRow([
    new Date().toISOString(),
    data.companyCode, company.name, data.period,
    data.q1, data.q2, data.q3, data.q4, data.q5,
    data.freeText || '', rate, data.managerEmail || '',
  ]);
  return ok({ rate });
}

function getActionCheckInfo(companyCode, config) {
  const company = getCompanyByCodeInternal(companyCode, config);
  if (!company) return err('無効な会社コードです');
  return ok({ companyName: company.name });
}

function getPrevActionRate(ss, companyCode) {
  const sheet = ss.getSheetByName('manager_actions');
  if (!sheet) return null;
  const rows = sheet.getDataRange().getValues().slice(1)
    .filter(r => r[0] && r[1] === companyCode);
  if (rows.length === 0) return null;
  const latest = rows[rows.length - 1];
  return { period: latest[3], rate: Number(latest[10]) };
}

// ===== KPI データ =====

function getKpiData(companyCode, config) {
  const ss = SpreadsheetApp.openById(config.spreadsheetId);
  const responsesSheet = ss.getSheetByName('responses');
  if (!responsesSheet) return ok({ kpi: null });

  let allRows = responsesSheet.getDataRange().getValues().slice(1).filter(r => r[0] && r[1]);
  if (companyCode) allRows = allRows.filter(r => r[1] === companyCode);
  if (allRows.length === 0) return ok({ kpi: null });

  const totalRespondents = allRows.length;
  const atRiskRows = allRows.filter(r => Number(r[11]) < 2.5 || Number(r[12]) < 2.5 || Number(r[13]) < 2.5);

  const avgOf = idx => (allRows.reduce((s, r) => s + Number(r[idx]), 0) / allRows.length).toFixed(1);
  const avgScores = { A: avgOf(9), B: avgOf(10), C: avgOf(11), D: avgOf(12), E: avgOf(13) };
  avgScores.overall = ((+avgScores.A + +avgScores.B + +avgScores.C + +avgScores.D + +avgScores.E) / 5).toFixed(1);

  const groups = {};
  allRows.forEach(r => {
    const m = String(r[0]).substring(0, 7);
    if (!groups[m]) groups[m] = [];
    groups[m].push(r);
  });
  const trend = Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, rows]) => {
      const a = k => (rows.reduce((s, r) => s + Number(r[k]), 0) / rows.length).toFixed(1);
      return {
        month, count: rows.length,
        A: a(9), B: a(10), C: a(11), D: a(12), E: a(13),
        riskCount: rows.filter(r => Number(r[11]) < 2.5 || Number(r[12]) < 2.5 || Number(r[13]) < 2.5).length,
      };
    });

  const actionsSheet = ss.getSheetByName('manager_actions');
  let actionRates = [];
  if (actionsSheet) {
    let aRows = actionsSheet.getDataRange().getValues().slice(1).filter(r => r[0]);
    if (companyCode) aRows = aRows.filter(r => r[1] === companyCode);
    actionRates = aRows
      .map(r => ({ period: r[3], rate: Number(r[10]) }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  // 会社別内訳（全社表示時のみ）
  let companiesBreakdown = [];
  if (!companyCode) {
    const allCompanies = getCompaniesInternal(config);
    companiesBreakdown = allCompanies.map(company => {
      const cRows = allRows.filter(r => r[1] === company.code);
      if (cRows.length === 0) return null;
      const avgC = idx => (cRows.reduce((s, r) => s + Number(r[idx]), 0) / cRows.length).toFixed(1);
      const cs = { A: avgC(9), B: avgC(10), C: avgC(11), D: avgC(12), E: avgC(13) };
      cs.overall = ((+cs.A + +cs.B + +cs.C + +cs.D + +cs.E) / 5).toFixed(1);
      const cRisk = cRows.filter(r => Number(r[11]) < 2.5 || Number(r[12]) < 2.5 || Number(r[13]) < 2.5).length;
      let latestActionRate = null;
      if (actionsSheet) {
        const ca = actionsSheet.getDataRange().getValues().slice(1).filter(r => r[0] && r[1] === company.code);
        if (ca.length > 0) latestActionRate = Number(ca[ca.length - 1][10]);
      }
      return { code: company.code, name: company.name, totalRespondents: cRows.length, avgScores: cs, atRiskCount: cRisk, riskRate: Math.round(cRisk / cRows.length * 100), latestActionRate };
    }).filter(Boolean);
  }

  // 管理者別アクション実績
  let managerRates = [];
  if (actionsSheet) {
    let aRows = actionsSheet.getDataRange().getValues().slice(1).filter(r => r[0]);
    const aHeaders = actionsSheet.getRange(1, 1, 1, actionsSheet.getLastColumn()).getValues()[0];
    const emailIdx = aHeaders.indexOf('manager_email');
    if (companyCode) aRows = aRows.filter(r => r[1] === companyCode);
    const groups = {};
    aRows.forEach(r => {
      const email = (emailIdx >= 0 && r[emailIdx]) ? r[emailIdx] : '';
      const key = email || r[1];
      if (!groups[key]) groups[key] = { email, companyName: r[2], companyCode: r[1], rates: [] };
      groups[key].rates.push({ period: r[3], rate: Number(r[10]) });
    });
    managerRates = Object.values(groups).map(g => ({
      ...g,
      avgRate: Math.round(g.rates.reduce((s, r) => s + r.rate, 0) / g.rates.length),
    }));
  }

  return ok({
    kpi: {
      totalRespondents,
      atRiskCount: atRiskRows.length,
      riskRate: Math.round(atRiskRows.length / totalRespondents * 100),
      avgScores, trend, actionRates, companiesBreakdown, managerRates,
      avgActionRate: actionRates.length > 0
        ? Math.round(actionRates.reduce((s, r) => s + r.rate, 0) / actionRates.length)
        : null,
    }
  });
}

// ===== 企業自己登録（register.html から） =====

function registerCompany(data, config) {
  if (config.regToken && data.regToken !== config.regToken) return err('無効なトークンです');
  if (!data.companyName || !data.managerEmail) return err('会社名と管理者メールは必須です');

  const ss = SpreadsheetApp.openById(config.spreadsheetId);
  let sheet = ss.getSheetByName('companies');
  if (!sheet) {
    sheet = ss.insertSheet('companies');
    sheet.appendRow(['code','name','manager_email','hr_email','created_at','team_name','manager_name','hr_name']);
    sheet.setFrozenRows(1);
  } else {
    // team_name・manager_name・hr_name 列が未追加なら追加
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (!headers.includes('team_name'))    sheet.getRange(1, sheet.getLastColumn() + 1).setValue('team_name');
    if (!headers.includes('manager_name')) sheet.getRange(1, sheet.getLastColumn() + 1).setValue('manager_name');
    if (!headers.includes('hr_name'))      sheet.getRange(1, sheet.getLastColumn() + 1).setValue('hr_name');
  }

  const code = 'LIMEE_' + Array.from({length:6}, ()=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');
  const displayName = data.companyName + (data.teamName ? ` ／ ${data.teamName}` : '');
  const diagUrl = `${config.siteUrl}/index.html?code=${code}&c=${encodeURIComponent(displayName)}`;

  sheet.appendRow([
    code, data.companyName, data.managerEmail, data.hrEmail || '',
    new Date().toISOString(), data.teamName || '', data.managerName || '', data.hrName || '',
  ]);

  sendWelcomeEmail(data, diagUrl, config);
  sendRegistrationNotify(data, diagUrl, code, config);

  return ok({ code, url: diagUrl });
}

function sendWelcomeEmail(data, diagUrl, config) {
  const displayName = data.companyName + (data.teamName ? ` ／ ${data.teamName}` : '');
  const managerLabel = data.managerName ? `${data.managerName} 様` : '管理者 様';

  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:'Hiragino Sans',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
<tr><td><table width="600" align="center" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

  <tr><td style="background:linear-gradient(135deg,#4F46E5,#7C3AED);padding:36px;text-align:center;">
    <p style="margin:0 0 6px;font-size:11px;color:rgba(255,255,255,0.6);letter-spacing:3px;">WELCOME TO LIMEE</p>
    <h1 style="margin:0 0 8px;font-size:22px;color:#fff;font-weight:800;">${displayName}</h1>
    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.8);">診断URL発行のお知らせ</p>
  </td></tr>

  <tr><td style="padding:32px;">
    <p style="font-size:15px;color:#1F2937;margin:0 0 20px;">${managerLabel}</p>
    <p style="font-size:14px;color:#374151;line-height:1.9;margin:0 0 24px;">
      この度はリミーをご導入いただきありがとうございます。<br>
      貴社専用の診断URLが発行されました。
    </p>

    <div style="background:#EEF2FF;border-radius:12px;padding:24px;margin-bottom:28px;text-align:center;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#4F46E5;">貴社専用 診断URL</p>
      <p style="margin:0 0 16px;font-size:12px;font-family:monospace;color:#374151;word-break:break-all;">${diagUrl}</p>
      <a href="${diagUrl}" style="display:inline-block;background:#4F46E5;color:#fff;font-size:14px;font-weight:700;padding:12px 28px;border-radius:10px;text-decoration:none;">
        診断URLを開く →
      </a>
    </div>

    <p style="font-size:14px;font-weight:700;color:#1F2937;margin:0 0 12px;">📋 ご利用の流れ</p>
    <ol style="font-size:14px;color:#374151;line-height:2;margin:0 0 24px;padding-left:20px;">
      <li>上記URLを新入社員へ共有する（メール・LINE等）</li>
      <li>新入社員が25問の診断に回答（約10〜15分）</li>
      <li>回答後すぐに、管理者様へ診断レポートが自動送信される</li>
      <li>毎月の月次レポートで、チーム全体の状態を把握できる</li>
    </ol>

    <div style="background:#F0FDF4;border-radius:10px;padding:16px;">
      <p style="margin:0;font-size:13px;color:#166534;line-height:1.8;">
        ✅ 診断レポート・月次レポートは管理者様のメールアドレスへ自動送信されます<br>
        ✅ データはすべて安全に管理・蓄積されます<br>
        ✅ ご不明な点はリミー事務局までお気軽にご連絡ください
      </p>
    </div>
  </td></tr>

  <tr><td style="background:#F9FAFB;padding:28px 32px;text-align:center;border-top:1px solid #E5E7EB;">
    <img src="https://drive.google.com/uc?export=view&id=1EXtEctBTrl__APTO1h4DUD_dmBy8jkEg" alt="リミー" style="width:160px;height:auto;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto;">
    <p style="margin:0 0 4px;font-size:12px;color:#9CA3AF;">入社後90日に特化した採用後支援HRテック</p>
    <p style="margin:0;font-size:12px;color:#9CA3AF;">${config.limeeEmail}</p>
  </td></tr>

</table></td></tr></table>
</body></html>`;

  const recipients = [data.managerEmail, data.hrEmail].filter(Boolean).join(',');
  MailApp.sendEmail({
    to: recipients,
    subject: `【リミー】${displayName}様の診断URLが発行されました`,
    htmlBody: html,
  });
}

function sendRegistrationNotify(data, diagUrl, code, config) {
  const displayName = data.companyName + (data.teamName ? ` ／ ${data.teamName}` : '');
  MailApp.sendEmail({
    to: config.limeeEmail,
    subject: `【リミー】新規登録：${displayName}`,
    htmlBody: `<p>新規企業登録が完了しました。</p>
    <ul>
      <li>会社名：${data.companyName}</li>
      <li>チーム：${data.teamName || '—'}</li>
      <li>管理者名：${data.managerName || '—'}</li>
      <li>管理者メール：${data.managerEmail}</li>
      <li>人事メール：${data.hrEmail || '—'}</li>
      <li>コード：${code}</li>
      <li>URL：<a href="${diagUrl}">${diagUrl}</a></li>
    </ul>`,
  });
}

// ===== ヘルパー =====
function validateAdmin(secret, config) { return secret === config.adminSecret; }
function ok(data)  { return ContentService.createTextOutput(JSON.stringify({ success: true, ...data })).setMimeType(ContentService.MimeType.JSON); }
function err(msg)  { return ContentService.createTextOutput(JSON.stringify({ success: false, error: msg })).setMimeType(ContentService.MimeType.JSON); }
