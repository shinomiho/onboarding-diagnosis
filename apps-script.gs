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
    if (data.action === 'chat')                return handleChat(data, config);
    if (data.action === 'submit_diagnosis')    return handleDiagnosis(data, config);
    if (data.action === 'add_company')         { if (!validateAdmin(data.adminSecret, config)) return err('認証エラー'); return addCompany(data, config); }
    if (data.action === 'delete_company')      { if (!validateAdmin(data.adminSecret, config)) return err('認証エラー'); return deleteCompany(data, config); }
    if (data.action === 'submit_action_check') return submitActionCheck(data, config);
    if (data.action === 'register_company')    return registerCompany(data, config);
    if (data.action === 'add_employee')        return addEmployee(data, config);
    if (data.action === 'remove_employee')     return removeEmployee(data, config);
    if (data.action === 'resend_invitation')   return resendInvitation(data, config);
    if (data.action === 'subscribe_email')     return subscribeEmail(data, config);
    if (data.action === 'record_feedback')     return recordFeedback(data, config);
    return err('不明なアクション');
  } catch(e) { return err(e.message); }
}

function handleChat(data, config) {
  try {
    const apiKey = config.claudeApiKey;
    if (!apiKey) return err('CLAUDE_API_KEY が未設定');

    const group = String(data.group || 'general');
    const userMessage = String(data.message || '');
    if (!userMessage) return err('メッセージが空です');

    const groupContexts = {
      general: 'ユーザーは今、リミーの「入社オンボーディング診断」フォームのプロフィール入力（氏名・メール・性別・年齢・職種・入社形態・診断タイミング）を行っています。この診断は28問・約5分で完了します。目的は従業員の職場適応状況をAIが分析し、マネージャーが早期にサポートできるようにすることです。',
      work: 'ユーザーは今、診断のQ01〜Q06「立ち上がり・戦力化／業務量」に関する設問（業務内容の理解、優先順位の整理、主体的な行動、ミスからの立て直し、業務量、詰まり感）に回答中です。入社直後の適応状況を測る設問です。',
      relation: 'ユーザーは今、診断のQ07〜Q12「組織エンゲージメント」に関する設問（上司への質問のしやすさ、相談できる人の有無、職場での受容感、フィードバックの質、雑談の有無、孤立感）に回答中です。職場の人間関係・心理的安全性を測る設問です。',
      energy: 'ユーザーは今、診断のQ13〜Q18「ウェルビーイング」に関する設問（憂うつ感、仕事後の余裕、睡眠の質、前向きな気持ち、達成感、不安・焦り）に回答中です。メンタルヘルス・エネルギー状態を測る設問です。',
      risk: 'ユーザーは今、診断のQ19〜Q28「離職予兆・継続定着意思」に関する設問（遅刻・寝坊、報連相の減少、ミスの増加、指示待ち、感情の抑制疲弊、職場での継続意欲、離職意思、半年後の自己イメージ、知人への紹介意思、会社での成長イメージ）に回答中です。離職リスクや行動変容を測る最終設問です。'
    };

    const systemPrompt = `あなたはリミー（RE:Me）の入社オンボーディング診断の日本語サポートAIです。
診断フォームに回答中の従業員が安心して正直に回答できるよう、親切・簡潔にサポートしてください。

【現在の回答箇所】
${groupContexts[group] || groupContexts['general']}

【診断について】
- 25問・5段階評価（1=全く当てはまらない〜5=非常に当てはまる）
- 結果はAIが分析し、本人と担当マネージャーにメールで送付される
- 診断データは従業員サポートのみに使用され、人事評価や解雇には使用されない
- 正直に答えることで、より適切なサポートを受けられる

回答ルール：
- 必ず日本語で回答する
- 200字以内で簡潔に答える
- 従業員が不安や迷いを感じている場合は、まず共感してから説明する
- 「正直に答えても大丈夫」という安心感を必ず伝える
- 人事評価・解雇には使われないことを明確に伝える
- 解決できない深刻な問題（ハラスメント等）は「担当のMiho（miho.shinohe@remenow.com）にご連絡ください」と案内する`;

    const payload = {
      model: config.claudeModel,
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    };

    const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const json = JSON.parse(res.getContentText());
    if (json.error) return err('Claude API error: ' + json.error.message);
    return ok({ success: true, reply: json.content[0].text });
  } catch(ex) {
    return err('handleChat error: ' + ex.message);
  }
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
    if (action === 'get_kpi_company')      return getKpiCompany(e.parameter, config);
    if (action === 'get_raw_data')         return getRawDataCompany(e.parameter, config);
    if (action === 'get_raw_data_admin')   { if (!validateAdmin(e.parameter.adminSecret, config)) return err('認証エラー'); return getRawDataAdmin(e.parameter, config); }
    if (action === 'get_action_check_info') return getActionCheckInfo(e.parameter.company, config);
    if (action === 'get_company_dashboard') return getCompanyDashboard(e.parameter, config);
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
  sendManagerEmail(company.managerEmail, data.profile, managerReport, data.scores, config, company.code);
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
・仕事への馴染み度（立ち上がり・戦力化）：${scores.A} / 5.0
・周りとのつながり（組織エンゲージメント）：${scores.B} / 5.0
・心のガソリン残量（ウェルビーイング）：${scores.C} / 5.0
・要注意アラート（離職予兆）：${scores.D} / 5.0（低いほど注意）
・「ここで続けたい」（継続定着意思）：${scores.E} / 5.0

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
  const milestone = profile.milestone || '90日';

  const milestoneGuide = {
    '15日': {
      focus: '環境適応・孤立防止・心理的安全の確保',
      actions: [
        '今週中に15分の雑談1on1を設定する（業務の話は不要）',
        'チームメンバーへの紹介・接触機会を意図的に作る',
        '「困ったことがあればすぐ聞いていい」と明示的に伝える',
        '業務ツール・社内ルールの習得状況を確認する',
        '孤立サインがあれば昼食やチームイベントに誘う',
      ]
    },
    '30日': {
      focus: '業務理解の確認・ペース調整・最初の本格1on1',
      actions: [
        '「今の業務量・難易度はどうか？」を率直に聞く1on1を実施',
        '期待値と本人の認識のズレがないか確認する',
        '得意分野が発揮できているか、業務アサインを見直す',
        '小さな成功体験を作る（達成感を意識した業務設計）',
        '職場の人間関係で気になることがないか確認する',
      ]
    },
    '60日': {
      focus: '成長実感・関係深化・自走できているかの確認',
      actions: [
        '「入社前の想像と今の実態のギャップ」を対話で確認する',
        '強みを活かした役割・裁量を与えて自走を促す',
        '同僚との協働プロジェクトに巻き込んで関係を深める',
        'この1ヶ月の成長を具体的に言語化してフィードバックする',
        '「今後やってみたいこと」を引き出してキャリア対話を始める',
      ]
    },
    '90日': {
      focus: '総括・貢献実感・次フェーズへの移行設計',
      actions: [
        '入社90日の振り返り面談を設定し、成長を共に整理する',
        '「チームへの貢献」を本人が実感できるよう言語化して伝える',
        '次の3ヶ月の目標・役割を一緒に設計する',
        'スキルアップ・育成計画について話し合う',
        '定着に向けて中長期のキャリアビジョンを確認する',
      ]
    },
    '90〜180日': {
      focus: '自走・戦力化・エンゲージメント維持',
      actions: [
        '任されている業務に手応えと意味を感じているか確認する',
        '「もっとやりたい」領域を引き出し、裁量を広げる機会を検討する',
        'チーム内での役割・立ち位置が明確になっているか確認する',
        'マンネリや停滞感がないかエンゲージメントを確認する',
        '半年の節目として正式なフィードバック面談を実施する',
      ]
    },
    '180〜360日': {
      focus: '貢献の最大化・キャリア設計・中堅戦力としての自覚醸成',
      actions: [
        '組織の課題解決に主体的に関われる役割・プロジェクトを与える',
        'キャリアの方向性（専門性 vs マネジメント等）について対話する',
        '後輩・新入社員のサポート役として活躍できる機会を作る',
        '評価・報酬・成長機会への納得感を確認する',
        '離職リスクの兆候（閉塞感・不満）がないかスコアをもとに確認する',
      ]
    },
    '1年以上': {
      focus: '長期定着・モチベーション再点火・組織への貢献拡大',
      actions: [
        '現在の業務・環境に閉塞感や停滞感を感じていないか率直に聞く',
        '「この会社で実現したいこと」を改めて対話し、目標を再設定する',
        '新しいチャレンジ（異動・昇格・プロジェクトリード）の可能性を示す',
        '貢献への感謝と評価を具体的に言語化して伝える',
        '長期的なキャリア形成と会社のビジョンをリンクさせる対話をする',
      ]
    },
  };

  const guide = milestoneGuide[milestone] || milestoneGuide['90日'];
  const actionList = guide.actions.map((a, i) => `${i + 1}. ${a}`).join('\n');

  const system = `あなたは経験豊富な人材育成コンサルタントです。
管理職向けに、診断データに基づいた簡潔・実践的なマネジメントレポートを作成してください。

# 出力ルール
・全体を通じて端的に。各セクションは3〜5文以内。
・5軸コメントは各軸1〜2文。スコアの数値に基づいた具体的な観察コメント。
・「Score_」という表記は使用禁止。軸名で記述すること。
・攻撃的・否定的な表現は避け、建設的なトーンで。
・出力はプレーンテキスト（マークダウン記法なし）。`;

  const user = `# 対象者
・氏名：${profile.name}／性別：${profile.gender}／年齢：${profile.age}
・職種：${profile.job}／入社形態：${profile.type}／診断タイミング：入社${milestone}

# 5軸スコア
・立ち上がり・戦力化：${scores.A} / 5.0
・組織エンゲージメント：${scores.B} / 5.0
・ウェルビーイング：${scores.C} / 5.0
・離職予兆：${scores.D} / 5.0（低いほど心理的負荷が高い）
・継続定着意思：${scores.E} / 5.0

# 出力形式（この形式で必ず出力すること）

【状況サマリー】
（1〜2文で現在の状態を端的に要約。総合的な印象と最も注目すべき点を述べる）

【5軸コメント】
① 立ち上がり・戦力化（${scores.A}）：（スコアに基づいた観察コメント）
② 組織エンゲージメント（${scores.B}）：（スコアに基づいた観察コメント）
③ ウェルビーイング（${scores.C}）：（スコアに基づいた観察コメント）
④ 離職予兆（${scores.D}）：（スコアに基づいた観察コメント）
⑤ 継続定着意思（${scores.E}）：（スコアに基づいた観察コメント）

【入社${milestone}マイルストーン アクションプラン】
フォーカス：${guide.focus}

${actionList}

（上記5項目を参考にしつつ、このスコア状況に合わせて優先順位・表現を調整して出力すること）`;

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

function buildRadarChartUrl(scores) {
  const cfg = {
    type: 'radar',
    data: {
      labels: ['立ち上がり・戦力化','組織エンゲージメント','ウェルビーイング','離職予兆','継続定着意思'],
      datasets: [{
        label: 'スコア',
        data: [scores.A, scores.B, scores.C, scores.D, scores.E],
        backgroundColor: 'rgba(79,70,229,0.15)',
        borderColor: '#4F46E5',
        borderWidth: 2,
        pointBackgroundColor: '#4F46E5',
        pointRadius: 4,
      }]
    },
    options: {
      scale: { ticks: { min: 0, max: 5, stepSize: 1, fontSize: 10 }, pointLabels: { fontSize: 12 } },
      legend: { display: false }
    }
  };
  return 'https://quickchart.io/chart?w=380&h=280&bkg=white&c=' + encodeURIComponent(JSON.stringify(cfg));
}

function buildManagerScoreHtml(scores) {
  const axes = [['立ち上がり・戦力化',scores.A],['組織エンゲージメント',scores.B],['ウェルビーイング',scores.C],['離職予兆',scores.D],['継続定着意思',scores.E]];
  const overall = (Object.values(scores).reduce((s,v)=>s+v,0)/5).toFixed(1);
  const atRisk = scores.C < 2.5 || scores.D < 2.5 || scores.E < 2.5;
  const bars = axes.map(([label, val]) => {
    const pct = Math.round(val / 5 * 100);
    const color = val >= 3.5 ? '#10B981' : val >= 2.5 ? '#F59E0B' : '#EF4444';
    return `<tr>
      <td style="padding:5px 0;font-size:12px;color:#374151;width:90px;white-space:nowrap;">${label}</td>
      <td style="padding:5px 8px;">
        <div style="background:#E5E7EB;border-radius:4px;height:12px;">
          <div style="background:${color};border-radius:4px;height:12px;width:${pct}%;"></div>
        </div>
      </td>
      <td style="padding:5px 0;font-size:13px;font-weight:800;color:${color};text-align:right;width:36px;">${val}</td>
    </tr>`;
  }).join('');
  const alertBox = atRisk
    ? `<div style="margin-top:12px;background:#FEF2F2;border-radius:8px;padding:12px;font-size:12px;color:#DC2626;font-weight:700;">⚠️ 低スコア軸があります。早めのフォローを推奨します。</div>`
    : `<div style="margin-top:12px;background:#F0FDF4;border-radius:8px;padding:12px;font-size:12px;color:#166534;">✅ 全軸安定しています。</div>`;
  return `
    <div style="background:#F5F3FF;border-radius:12px;padding:20px;margin-bottom:16px;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:800;color:#3730A3;">📊 5軸スコアサマリー</p>
      <p style="margin:0 0 16px;font-size:12px;color:#6B7280;">総合エンゲージメント：<strong style="font-size:20px;color:#4F46E5;">${overall}</strong> / 5.0</p>
      <img src="${buildRadarChartUrl(scores)}" alt="レーダーチャート" width="340" style="display:block;margin:0 auto 16px;border-radius:8px;">
      <table style="width:100%;border-collapse:collapse;">${bars}</table>
      ${alertBox}
    </div>
    <div style="background:#FFF7ED;border:1.5px solid #FED7AA;border-radius:12px;padding:16px 20px;margin-bottom:16px;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:800;color:#92400E;">📅 ネクストアクション</p>
      <p style="margin:0 0 10px;font-size:13px;color:#78350F;line-height:1.9;">
        この後に届く<strong>マネージャー向け処方箋</strong>に基づき、日々のマネジメントアクションを実践してください。<br>
        毎月<strong>5日・20日</strong>に「アクションチェック」メールが届きます。処方箋に沿って実践できたか、5問で記録する仕組みです。
      </p>
      <p style="margin:0;font-size:12px;color:#B45309;font-weight:700;">✅ まずは今回の処方箋を読んで、取り組むアクションを1つ決めておきましょう。</p>
    </div>`;
}

function sendManagerEmail(managerEmail, profile, report, scores, config, companyCode) {
  const code = companyCode || '';
  const kpiUrl = config.siteUrl && code ? `${config.siteUrl}/kpi.html?code=${code}` : null;
  const scoreHtml = buildManagerScoreHtml(scores) + (kpiUrl ? `
    <div style="background:linear-gradient(135deg,#DBEAFE,#EEF2FF);border:1.5px solid #93C5FD;border-radius:12px;padding:14px 16px;margin-top:16px;text-align:center;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:800;color:#1E40AF;letter-spacing:1px;">📊 人的資本KPIダッシュボード</p>
      <p style="margin:0 0 10px;font-size:12px;color:#1E40AF;line-height:1.6;">全従業員のスコア推移・ISO 30414マッピング・属性別ブレイクダウンを確認できます（有価証券報告書対応）</p>
      <a href="${kpiUrl}" style="display:inline-block;background:#2563EB;color:#fff;font-size:12px;font-weight:700;padding:8px 18px;border-radius:8px;text-decoration:none;">KPIダッシュボードを開く →</a>
    </div>` : '');
  MailApp.sendEmail({
    to: managerEmail,
    subject: `【リミー】${profile.name}さんのマネジメントレポート`,
    htmlBody: buildEmailHTML('マネージャー向け処方箋', `${profile.name} さんの診断結果`, report, config, scoreHtml),
  });
}

function sendAdminEmail(profile, company, employeeReport, managerReport, scores, config) {
  const atRisk = scores.C < 2.5 || scores.D < 2.5 || scores.E < 2.5;
  const riskFlags = [
    scores.C < 2.5 ? `ウェルビーイング ${scores.C}` : null,
    scores.D < 2.5 ? `離職予兆 ${scores.D}` : null,
    scores.E < 2.5 ? `継続定着意思 ${scores.E}` : null,
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
    ${[['立ち上がり・戦力化',scores.A],['組織エンゲージメント',scores.B],['ウェルビーイング',scores.C],['離職予兆',scores.D],['継続定着意思',scores.E]].map(([l,v])=>`
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
    const kpiUrl = config.siteUrl ? `${config.siteUrl}/kpi.html?code=${company.code}` : null;
    const html = buildMonthlyReportHTML(company, responses, aiAnalysis, periodLabel, prevActionData, actionCheckUrl, kpiUrl);
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
立ち上がり・戦力化:${avg('A')} 組織エンゲージメント:${avg('B')} ウェルビーイング:${avg('C')} 離職予兆:${avg('D')} 継続定着意思:${avg('E')}

## 個別データ
${responses.map(r=>`・${r.name}（${r.job}）：立上${r.scores.A}/エンゲ${r.scores.B}/ウェル${r.scores.C}/予兆${r.scores.D}/継続${r.scores.E}`).join('\n')}

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

function buildMonthlyReportHTML(company, responses, aiAnalysis, periodLabel, prevActionData, actionCheckUrl, kpiUrl) {
  const sc = v => v >= 3.5 ? '#10B981' : v >= 2.5 ? '#F59E0B' : '#EF4444';
  const bar = v => `<div style="background:#F3F4F6;border-radius:99px;height:8px;"><div style="background:${sc(v)};height:8px;border-radius:99px;width:${Math.round(v/5*100)}%;"></div></div>`;
  const avg = k => (responses.reduce((s,r)=>s+r.scores[k],0)/responses.length).toFixed(1);
  const atRiskCount = responses.filter(r=>r.scores.C<2.5||r.scores.D<2.5||r.scores.E<2.5).length;

  const scoreLabels = [['A','立ち上がり・戦力化'],['B','組織エンゲージメント'],['C','ウェルビーイング'],['D','離職予兆'],['E','継続定着意思']];
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
        <th style="padding:8px;text-align:center;font-size:11px;color:#6B7280;">立上</th>
        <th style="padding:8px;text-align:center;font-size:11px;color:#6B7280;">エンゲ</th>
        <th style="padding:8px;text-align:center;font-size:11px;color:#6B7280;">ウェル</th>
        <th style="padding:8px;text-align:center;font-size:11px;color:#6B7280;">予兆</th>
        <th style="padding:8px;text-align:center;font-size:11px;color:#6B7280;">継続</th>
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

  ${kpiUrl ? `
  <tr><td style="padding:0 32px 32px;">
    <div style="background:linear-gradient(135deg,#DBEAFE,#EEF2FF);border:1.5px solid #93C5FD;border-radius:16px;padding:24px;text-align:center;">
      <p style="margin:0 0 6px;font-size:22px;">📊</p>
      <h3 style="margin:0 0 8px;font-size:16px;font-weight:800;color:#1E40AF;">人的資本KPIダッシュボード（有価証券報告書対応）</h3>
      <p style="margin:0 0 14px;font-size:13px;color:#1E40AF;line-height:1.7;">
        5つのKPI指標（エンゲージメント／定着率／アクション実施率／離職リスク／職場環境）と<br>
        ISO 30414マッピング・属性別ブレイクダウン・実離職率突合をブラウザで確認できます。
      </p>
      <div style="margin-bottom:16px;font-size:11px;color:#1E40AF;">
        <span style="background:#fff;padding:3px 8px;border-radius:99px;margin:2px;display:inline-block;">ISO 30414準拠</span>
        <span style="background:#fff;padding:3px 8px;border-radius:99px;margin:2px;display:inline-block;">属性別集計</span>
        <span style="background:#fff;padding:3px 8px;border-radius:99px;margin:2px;display:inline-block;">PDF出力対応</span>
      </div>
      <a href="${kpiUrl}" style="display:inline-block;background:#2563EB;color:#fff;font-size:14px;font-weight:700;padding:12px 28px;border-radius:10px;text-decoration:none;">
        📈 KPIダッシュボードを開く →
      </a>
      <p style="margin:14px 0 0;font-size:10px;color:#6B7280;font-family:monospace;word-break:break-all;">${kpiUrl}</p>
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
function renderReportMd(text) {
  if (!text) return '';
  var s = String(text);
  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
  return s;
}

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
    <div style="font-size:14px;line-height:1.9;color:#374151;white-space:pre-wrap;">${renderReportMd(content)}</div>
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

function getKpiData(companyCode, config, startDate, endDate) {
  const ss = SpreadsheetApp.openById(config.spreadsheetId);
  const responsesSheet = ss.getSheetByName('responses');
  if (!responsesSheet) return ok({ kpi: null });

  let allRows = responsesSheet.getDataRange().getValues().slice(1).filter(r => r[0] && r[1]);
  if (companyCode) allRows = allRows.filter(r => r[1] === companyCode);
  if (startDate) { const sd = new Date(startDate); allRows = allRows.filter(r => new Date(r[0]) >= sd); }
  if (endDate) { const ed = new Date(endDate); ed.setHours(23,59,59); allRows = allRows.filter(r => new Date(r[0]) <= ed); }
  if (allRows.length === 0) return ok({ kpi: null });

  // companyCode指定時は会社名を解決
  let resolvedCompanyName = '';
  if (companyCode) {
    const c = getCompanyByCodeInternal(companyCode, config);
    if (c) resolvedCompanyName = c.name;
  }

  const totalRespondents = allRows.length;
  const atRiskRows = allRows.filter(r => Number(r[11]) < 2.5 || Number(r[12]) < 2.5 || Number(r[13]) < 2.5);

  const avgOf = idx => (allRows.reduce((s, r) => s + Number(r[idx]), 0) / allRows.length).toFixed(1);
  const avgScores = { A: avgOf(9), B: avgOf(10), C: avgOf(11), D: avgOf(12), E: avgOf(13) };
  avgScores.overall = ((+avgScores.A + +avgScores.B + +avgScores.C + +avgScores.D + +avgScores.E) / 5).toFixed(1);

  // 有報KPI 5指標
  const retentionRate = Math.round(allRows.filter(r => Number(r[13]) >= 3.5).length / totalRespondents * 100);
  const workEnvScore = ((allRows.reduce((s,r) => s+Number(r[10]),0) + allRows.reduce((s,r) => s+Number(r[11]),0)) / (allRows.length * 2)).toFixed(1);

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
      const riskCount = rows.filter(r => Number(r[11]) < 2.5 || Number(r[12]) < 2.5 || Number(r[13]) < 2.5).length;
      return {
        month, count: rows.length,
        A: a(9), B: a(10), C: a(11), D: a(12), E: a(13),
        riskCount,
        riskRate: Math.round(riskCount / rows.length * 100),
        retentionRate: Math.round(rows.filter(r => Number(r[13]) >= 3.5).length / rows.length * 100),
        workEnvScore: ((rows.reduce((s,r) => s+Number(r[10]),0) + rows.reduce((s,r) => s+Number(r[11]),0)) / (rows.length*2)).toFixed(1),
        overall: (rows.reduce((s,r) => s+Number(r[9])+Number(r[10])+Number(r[11])+Number(r[12])+Number(r[13]),0) / (rows.length*5)).toFixed(1),
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
      companyName: resolvedCompanyName,
      totalRespondents,
      atRiskCount: atRiskRows.length,
      riskRate: Math.round(atRiskRows.length / totalRespondents * 100),
      retentionRate,
      workEnvScore,
      avgScores, trend, actionRates, companiesBreakdown, managerRates,
      avgActionRate: actionRates.length > 0
        ? Math.round(actionRates.reduce((s, r) => s + r.rate, 0) / actionRates.length)
        : null,
    }
  });
}

function getKpiCompany(params, config) {
  const company = getCompanyByCodeInternal(params.code, config);
  if (!company) return err('無効な会社コードです');
  const result = getKpiData(params.code, config, params.startDate, params.endDate);
  const parsed = JSON.parse(result.getContent());
  if (parsed.kpi) parsed.kpi.companyName = company.name;
  return ContentService.createTextOutput(JSON.stringify(parsed)).setMimeType(ContentService.MimeType.JSON);
}

function getRawDataCompany(params, config) {
  const company = getCompanyByCodeInternal(params.code, config);
  if (!company) return err('無効な会社コードです');
  const ss = SpreadsheetApp.openById(config.spreadsheetId);
  const sheet = ss.getSheetByName('responses');
  if (!sheet) return ok({ company: company.name, rows: [] });

  let rows = sheet.getDataRange().getValues().slice(1).filter(r => r[0] && r[1] === params.code);
  if (params.startDate) { const sd = new Date(params.startDate); rows = rows.filter(r => new Date(r[0]) >= sd); }
  if (params.endDate) { const ed = new Date(params.endDate); ed.setHours(23,59,59); rows = rows.filter(r => new Date(r[0]) <= ed); }

  const data = rows.map(r => ({
    date: Utilities.formatDate(new Date(r[0]), 'Asia/Tokyo', 'yyyy/MM/dd'),
    name: r[3],
    email: r[4],
    gender: r[5] || '',
    age: r[6] || '',
    job: r[7] || '',
    type: r[8] || '',
    A: Number(r[9]).toFixed(1),
    B: Number(r[10]).toFixed(1),
    C: Number(r[11]).toFixed(1),
    D: Number(r[12]).toFixed(1),
    E: Number(r[13]).toFixed(1),
    overall: ((Number(r[9])+Number(r[10])+Number(r[11])+Number(r[12])+Number(r[13]))/5).toFixed(1),
    workEnv: ((Number(r[10])+Number(r[11]))/2).toFixed(1),
    atRisk: (Number(r[11]) < 2.5 || Number(r[12]) < 2.5 || Number(r[13]) < 2.5) ? 'あり' : 'なし',
  }));

  return ok({ company: company.name, rows: data });
}

// ===== 管理者向け生データ（全社合算 or 特定会社） =====
function getRawDataAdmin(params, config) {
  const ss = SpreadsheetApp.openById(config.spreadsheetId);
  const sheet = ss.getSheetByName('responses');
  if (!sheet) return ok({ company: '全社合算', rows: [] });

  let rows = sheet.getDataRange().getValues().slice(1).filter(r => r[0]);
  if (params.companyCode) rows = rows.filter(r => r[1] === params.companyCode);
  if (params.startDate) { const sd = new Date(params.startDate); rows = rows.filter(r => new Date(r[0]) >= sd); }
  if (params.endDate)   { const ed = new Date(params.endDate); ed.setHours(23,59,59); rows = rows.filter(r => new Date(r[0]) <= ed); }

  const data = rows.map(r => ({
    date: Utilities.formatDate(new Date(r[0]), 'Asia/Tokyo', 'yyyy/MM/dd'),
    companyName: r[2] || '',
    name: r[3],
    email: r[4],
    gender: r[5] || '',
    age: r[6] || '',
    job: r[7] || '',
    type: r[8] || '',
    A: Number(r[9]).toFixed(1),
    B: Number(r[10]).toFixed(1),
    C: Number(r[11]).toFixed(1),
    D: Number(r[12]).toFixed(1),
    E: Number(r[13]).toFixed(1),
    overall: ((Number(r[9])+Number(r[10])+Number(r[11])+Number(r[12])+Number(r[13]))/5).toFixed(1),
    workEnv: ((Number(r[10])+Number(r[11]))/2).toFixed(1),
    atRisk: (Number(r[11]) < 2.5 || Number(r[12]) < 2.5 || Number(r[13]) < 2.5) ? 'あり' : 'なし',
  }));

  let companyLabel = '全社合算';
  if (params.companyCode) {
    const c = getCompanyByCodeInternal(params.companyCode, config);
    if (c) companyLabel = c.name;
  }
  return ok({ company: companyLabel, rows: data });
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
  const code = diagUrl.match(/code=([^&]+)/)?.[1] || '';
  const adminUrl = `${config.siteUrl}/company-admin.html?code=${code}`;
  const guideUrl = `${config.siteUrl}/guide.html`;

  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:'Hiragino Sans',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
<tr><td><table width="600" align="center" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

  <tr><td style="background:linear-gradient(135deg,#4F46E5,#7C3AED);padding:36px;text-align:center;">
    <p style="margin:0 0 6px;font-size:11px;color:rgba(255,255,255,0.6);letter-spacing:3px;">WELCOME TO LIMEE</p>
    <h1 style="margin:0 0 8px;font-size:22px;color:#fff;font-weight:800;">${displayName}</h1>
    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.8);">ご登録ありがとうございます</p>
  </td></tr>

  <tr><td style="padding:32px;">
    <p style="font-size:15px;color:#1F2937;margin:0 0 20px;">${managerLabel}</p>
    <p style="font-size:14px;color:#374151;line-height:1.9;margin:0 0 8px;">
      この度はリミーをご導入いただきありがとうございます。
    </p>
    <div style="background:#FEF2F2;border-left:4px solid #DC2626;border-radius:8px;padding:14px 18px;margin-bottom:28px;">
      <p style="margin:0;font-size:13px;font-weight:700;color:#DC2626;">⚠️ このメールに記載のURLは貴社専用です。必ず保存・ブックマークしてください。</p>
    </div>

    <!-- STEP 1 -->
    <div style="border:2px solid #E0E7FF;border-radius:12px;padding:20px 24px;margin-bottom:16px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#6366F1;letter-spacing:2px;">STEP 1</p>
      <p style="margin:0 0 4px;font-size:15px;font-weight:800;color:#1F2937;">【管理者】管理者画面を保存する</p>
      <p style="margin:0 0 14px;font-size:13px;color:#6B7280;line-height:1.8;">下のボタンから管理者画面を開き、ブックマークしてください。今後の従業員管理はすべてこの画面から行います。</p>
      <p style="margin:0 0 10px;font-size:11px;font-family:monospace;color:#374151;word-break:break-all;">${adminUrl}</p>
      <a href="${adminUrl}" style="display:inline-block;background:#4F46E5;color:#fff;font-size:13px;font-weight:700;padding:10px 24px;border-radius:8px;text-decoration:none;">管理者画面を開く →</a>
    </div>

    <!-- STEP 2 -->
    <div style="border:2px solid #D1FAE5;border-radius:12px;padding:20px 24px;margin-bottom:16px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#059669;letter-spacing:2px;">STEP 2</p>
      <p style="margin:0 0 4px;font-size:15px;font-weight:800;color:#1F2937;">【管理者】従業員を招待する</p>
      <p style="margin:0 0 14px;font-size:13px;color:#6B7280;line-height:1.8;">管理者画面から従業員を追加すると、招待メールが自動で送信されます。<br>従業員は受け取った招待メールのリンクから診断を受けることができます。</p>
      <div style="background:#F0FDF4;border-radius:8px;padding:12px 16px;margin-bottom:14px;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#059669;">📧 従業員への直接共有用URL（任意）</p>
        <p style="margin:0 0 6px;font-size:12px;color:#6B7280;">管理画面からの招待以外に、このURLを直接従業員に共有することもできます。</p>
        <p style="margin:0;font-size:11px;font-family:monospace;color:#374151;word-break:break-all;">${diagUrl}</p>
      </div>
      <a href="${adminUrl}" style="display:inline-block;background:#059669;color:#fff;font-size:13px;font-weight:700;padding:10px 24px;border-radius:8px;text-decoration:none;">従業員を招待する →</a>
    </div>

    <!-- STEP 3 -->
    <div style="border:2px solid #DBEAFE;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#2563EB;letter-spacing:2px;">STEP 3</p>
      <p style="margin:0 0 4px;font-size:15px;font-weight:800;color:#1F2937;">【自動】診断レポートが届く / KPIダッシュボードで継続管理</p>
      <p style="margin:0 0 14px;font-size:13px;color:#6B7280;line-height:1.8;">従業員が診断を完了すると、管理者様あてに診断レポートが自動送信されます。<br><strong>人的資本KPIダッシュボード</strong>では全従業員の状況を5つの指標でまとめて確認でき、<br><strong>有価証券報告書「人的資本」セクション</strong>の記載資料としても活用いただけます。</p>
      <div style="background:#F0F9FF;border-radius:8px;padding:10px 14px;margin-bottom:14px;">
        <p style="margin:0;font-size:11px;color:#1E40AF;line-height:1.7;">
          ✅ ISO 30414準拠の5指標 ／ ✅ 属性別ブレイクダウン（多様性・包摂性対応） ／<br>
          ✅ 実離職率との突合 ／ ✅ PDF出力で投資家資料化が可能
        </p>
      </div>
      <p style="margin:14px 0 0;font-size:11px;font-family:monospace;color:#374151;word-break:break-all;">${config.siteUrl}/kpi.html?code=${code}</p>
      <a href="${config.siteUrl}/kpi.html?code=${code}" style="display:inline-block;background:#2563EB;color:#fff;font-size:13px;font-weight:700;padding:10px 24px;border-radius:8px;text-decoration:none;margin-top:10px;">KPIダッシュボードを確認する →</a>
    </div>

    <!-- 詰まったらガイドへ -->
    <div style="background:#F0FDF4;border:2px solid #6EE7B7;border-radius:12px;padding:20px 24px;margin-bottom:28px;text-align:center;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:800;color:#065F46;">📖 操作で詰まったら、リミー導入ガイドへ</p>
      <p style="margin:0 0 14px;font-size:13px;color:#6B7280;line-height:1.8;">各STEPの詳しい手順・よくある質問をまとめています。<br>まず導入ガイドを確認してみてください。</p>
      <a href="${guideUrl}" style="display:inline-block;background:#059669;color:#fff;font-size:13px;font-weight:700;padding:10px 24px;border-radius:8px;text-decoration:none;">リミー導入ガイドを見る →</a>
    </div>

    <div style="background:#F9FAFB;border-radius:10px;padding:16px;border:1px solid #E5E7EB;">
      <p style="margin:0;font-size:13px;color:#6B7280;line-height:1.8;">
        ✅ 月次レポートは毎月1日・15日に自動送信されます<br>
        ✅ ご不明な点は <a href="mailto:${config.limeeEmail}" style="color:#4F46E5;">${config.limeeEmail}</a> までご連絡ください
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
    subject: `【リミー】${displayName}様のご登録が完了しました`,
    htmlBody: html,
  });
}

// ===== 進捗トラッキング（毎日トリガー） =====
function checkOnboardingProgress() {
  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.spreadsheetId);
  const companiesSheet = ss.getSheetByName('companies');
  if (!companiesSheet || companiesSheet.getLastRow() < 2) return;

  const employeesSheet = ss.getSheetByName('employees');
  const responsesSheet = ss.getSheetByName('responses');
  const feedbackSheet  = ss.getSheetByName('feedback');

  const companies = companiesSheet.getDataRange().getValues();
  const headers   = companies[0];
  const codeIdx   = headers.indexOf('code');
  const nameIdx   = headers.indexOf('name');
  const mEmailIdx = headers.indexOf('manager_email');
  const hrEmailIdx= headers.indexOf('hr_email');
  const createdIdx= headers.indexOf('created_at');

  const empCodes = _getCodes(employeesSheet, 'company_code');
  const resCodes = _getCodes(responsesSheet, 'company');
  const fbCodes  = _getCodes(feedbackSheet,  'company_code');

  const now = new Date();

  companies.slice(1).forEach(row => {
    const code        = row[codeIdx];
    const name        = row[nameIdx];
    const mEmail      = row[mEmailIdx];
    const hrEmail     = row[hrEmailIdx];
    const createdAt   = new Date(row[createdIdx]);
    const daysSince   = Math.floor((now - createdAt) / 86400000);
    const hasEmp      = empCodes.includes(code);
    const hasRes      = resCodes.includes(code);
    const hasFb       = fbCodes.includes(code);
    const recipients  = [mEmail, hrEmail].filter(Boolean).join(',');
    const adminUrl    = `${config.siteUrl}/company-admin.html?code=${code}`;
    const guideUrl    = `${config.siteUrl}/guide.html`;

    // 3日後: 従業員未登録
    if (daysSince === 3 && !hasEmp) {
      MailApp.sendEmail({
        to: recipients,
        subject: `【リミー】従業員の招待がまだ完了していません`,
        htmlBody: _buildReminderHtml(name, '従業員の招待がまだです', `従業員管理画面から従業員を追加するだけで、招待メールが自動送信されます。特別な操作は必要ありません。`, adminUrl, '従業員を招待する →', config),
      });
    }

    // 7日後: 従業員登録済みだが未回答
    if (daysSince === 7 && hasEmp && !hasRes) {
      MailApp.sendEmail({
        to: recipients,
        subject: `【リミー】従業員の診断回答がまだです`,
        htmlBody: _buildReminderHtml(name, '診断の回答をご確認ください', `招待済みの従業員がまだ診断に回答していません。管理画面から招待メールを再送することができます。`, adminUrl, '管理画面で確認する →', config),
      });
    }

    // 14日後: 回答済みだがフィードバックなし
    if (daysSince === 14 && hasRes && !hasFb) {
      MailApp.sendEmail({
        to: recipients,
        subject: `【リミー】ご感想をお聞かせください`,
        htmlBody: _buildReminderHtml(name, '使ってみた感想を教えてください', `リミーをご利用いただきありがとうございます。2〜3分でお答えいただけるフィードバックをお願いします。`, guideUrl, 'フィードバックを送る →', config),
      });
    }

    // Mihoへの進捗サマリー（3・7・14日目）
    if ([3, 7, 14].includes(daysSince)) {
      const status = [
        `登録: ✅`,
        `従業員招待: ${hasEmp ? '✅' : '❌ 未完了'}`,
        `診断回答: ${hasRes ? '✅' : '❌ 未完了'}`,
        `フィードバック: ${hasFb ? '✅' : '❌ 未完了'}`,
      ].join('\n');
      MailApp.sendEmail({
        to: config.limeeEmail,
        subject: `【リミー進捗】${name}（登録${daysSince}日目）`,
        body: `${name}\n\n${status}\n\n管理画面: ${adminUrl}`,
      });
    }
  });
}

function _getCodes(sheet, colName) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const idx     = headers.indexOf(colName);
  if (idx < 0) return [];
  return data.slice(1).map(r => r[idx]).filter(Boolean);
}

function _buildReminderHtml(name, title, body, btnUrl, btnLabel, config) {
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:'Hiragino Sans',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
<tr><td><table width="600" align="center" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
  <tr><td style="background:linear-gradient(135deg,#4F46E5,#7C3AED);padding:28px 36px;text-align:center;">
    <h2 style="margin:0;font-size:18px;color:#fff;font-weight:800;">リミー</h2>
  </td></tr>
  <tr><td style="padding:32px;">
    <p style="font-size:15px;font-weight:700;color:#1F2937;margin:0 0 16px;">${name} 様</p>
    <p style="font-size:16px;font-weight:800;color:#4F46E5;margin:0 0 12px;">${title}</p>
    <p style="font-size:14px;color:#374151;line-height:1.9;margin:0 0 24px;">${body}</p>
    <div style="text-align:center;">
      <a href="${btnUrl}" style="display:inline-block;background:#4F46E5;color:#fff;font-size:14px;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;">${btnLabel}</a>
    </div>
    <p style="font-size:12px;color:#9CA3AF;margin-top:24px;text-align:center;">ご不明な点は <a href="mailto:${config.limeeEmail}" style="color:#4F46E5;">${config.limeeEmail}</a> までご連絡ください</p>
  </td></tr>
</table></td></tr></table>
</body></html>`;
}

// ===== フィードバック記録 =====
function recordFeedback(data, config) {
  if (!data.companyCode && !data.email) return err('情報が不足しています');
  const ss = SpreadsheetApp.openById(config.spreadsheetId);
  let sheet = ss.getSheetByName('feedback');
  if (!sheet) {
    sheet = ss.insertSheet('feedback');
    sheet.appendRow(['company_code', 'company_name', 'email', 'rating', 'comments', 'submitted_at']);
    sheet.setFrozenRows(1);
  }
  sheet.appendRow([
    data.companyCode || '',
    data.companyName || '',
    data.email || '',
    data.rating || '',
    data.comments || '',
    new Date().toISOString(),
  ]);
  // Mihoに通知
  MailApp.sendEmail({
    to: config.limeeEmail,
    subject: `【リミー FB受信】${data.companyName || data.email}`,
    body: `評価: ${data.rating}/5\n\nコメント:\n${data.comments}\n\n企業コード: ${data.companyCode}`,
  });
  return ok({ message: 'フィードバックを受け付けました' });
}

function sendRegistrationNotify(data, diagUrl, code, config) {
  var displayName = data.companyName + (data.teamName ? ' ／ ' + data.teamName : '');
  var adminUrl = config.siteUrl + '/admin.html';
  MailApp.sendEmail({
    to: config.limeeEmail,
    subject: '【リミー】新規登録：' + displayName,
    htmlBody: '<p>新規企業登録が完了しました。</p>' +
    '<ul>' +
      '<li>会社名：' + data.companyName + '</li>' +
      '<li>チーム：' + (data.teamName || '—') + '</li>' +
      '<li>管理者名：' + (data.managerName || '—') + '</li>' +
      '<li>管理者メール：' + data.managerEmail + '</li>' +
      '<li>人事メール：' + (data.hrEmail || '—') + '</li>' +
      '<li>コード：' + code + '</li>' +
      '<li>顧客管理一覧：<a href="' + adminUrl + '">' + adminUrl + '</a></li>' +
    '</ul>',
  });
}

// ===== 従業員管理 =====

function getOrCreateEmployeeSheet(ss) {
  let sheet = ss.getSheetByName('employees');
  if (!sheet) {
    sheet = ss.insertSheet('employees');
    sheet.appendRow(['id', 'company_code', 'name', 'email', 'department', 'invited_at']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getCompanyDashboard(params, config) {
  const company = getCompanyByCodeInternal(params.code, config);
  if (!company) return err('無効な会社コードです');

  const ss = SpreadsheetApp.openById(config.spreadsheetId);
  const empSheet = getOrCreateEmployeeSheet(ss);
  const employees = empSheet.getDataRange().getValues().slice(1)
    .filter(r => r[0] && r[1] === params.code)
    .map(r => ({ id: r[0], name: r[2], email: r[3], department: r[4] || '', invitedAt: r[5] }));

  const resSheet = ss.getSheetByName('responses');
  const completedEmails = new Set();
  if (resSheet && resSheet.getLastRow() > 1) {
    resSheet.getDataRange().getValues().slice(1)
      .filter(r => r[1] === params.code && r[4])
      .forEach(r => completedEmails.add(r[4]));
  }

  const employeesWithStatus = employees.map(e => ({ ...e, completed: completedEmails.has(e.email) }));
  const diagUrl = config.siteUrl
    ? `${config.siteUrl}/index.html?code=${params.code}&c=${encodeURIComponent(company.name)}`
    : '';

  return ok({
    company: { code: company.code, name: company.name },
    employees: employeesWithStatus,
    stats: { total: employees.length, completed: employeesWithStatus.filter(e => e.completed).length },
    diagUrl,
  });
}

function addEmployee(data, config) {
  const company = getCompanyByCodeInternal(data.companyCode, config);
  if (!company) return err('無効な会社コードです');
  if (!data.name || !data.email) return err('氏名とメールアドレスは必須です');

  const ss = SpreadsheetApp.openById(config.spreadsheetId);
  const sheet = getOrCreateEmployeeSheet(ss);

  const existing = sheet.getDataRange().getValues().slice(1)
    .find(r => r[1] === data.companyCode && r[3] === data.email);
  if (existing) return err('このメールアドレスはすでに登録されています');

  const id = Utilities.getUuid();
  sheet.appendRow([id, data.companyCode, data.name, data.email, data.department || '', new Date().toISOString()]);

  if (config.siteUrl) {
    const diagUrl = `${config.siteUrl}/index.html?code=${data.companyCode}&c=${encodeURIComponent(company.name)}`;
    sendInvitationEmail({ name: data.name, email: data.email }, company, diagUrl, config);
  }

  return ok({ id });
}

function removeEmployee(data, config) {
  const company = getCompanyByCodeInternal(data.companyCode, config);
  if (!company) return err('無効な会社コードです');

  const ss = SpreadsheetApp.openById(config.spreadsheetId);
  const sheet = getOrCreateEmployeeSheet(ss);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] === data.companyCode && rows[i][3] === data.email) {
      sheet.deleteRow(i + 1);
      return ok({});
    }
  }
  return err('従業員が見つかりません');
}

function resendInvitation(data, config) {
  const company = getCompanyByCodeInternal(data.companyCode, config);
  if (!company) return err('無効な会社コードです');

  const ss = SpreadsheetApp.openById(config.spreadsheetId);
  const sheet = getOrCreateEmployeeSheet(ss);
  const row = sheet.getDataRange().getValues().slice(1)
    .find(r => r[1] === data.companyCode && r[3] === data.email);
  if (!row) return err('従業員が見つかりません');

  if (config.siteUrl) {
    const diagUrl = `${config.siteUrl}/index.html?code=${data.companyCode}&c=${encodeURIComponent(company.name)}`;
    sendInvitationEmail({ name: row[2], email: row[3] }, company, diagUrl, config);
  }
  return ok({});
}

function sendInvitationEmail(employee, company, diagUrl, config) {
  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:'Hiragino Sans',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
<tr><td><table width="600" align="center" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
  <tr><td style="background:linear-gradient(135deg,#4F46E5,#7C3AED);padding:36px;text-align:center;">
    <p style="margin:0 0 6px;font-size:11px;color:rgba(255,255,255,0.6);letter-spacing:3px;">ONBOARDING DIAGNOSIS</p>
    <h1 style="margin:0 0 8px;font-size:22px;color:#fff;font-weight:800;">${employee.name} さんへ</h1>
    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.8);">${company.name} からのご案内</p>
  </td></tr>
  <tr><td style="padding:32px;">
    <p style="font-size:14px;color:#374151;line-height:1.9;margin:0 0 24px;">
      ${company.name}よりリミーのオンボーディング診断のご案内です。<br>
      所要時間は約10〜15分です。ぜひご回答ください。
    </p>
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${diagUrl}" style="display:inline-block;background:#4F46E5;color:#fff;font-size:15px;font-weight:700;padding:16px 40px;border-radius:12px;text-decoration:none;">
        診断を受ける →
      </a>
    </div>
    <div style="background:#F0FDF4;border-radius:10px;padding:16px;margin-bottom:12px;">
      <p style="margin:0;font-size:13px;color:#166534;line-height:1.8;">
        ✅ 回答後、あなた専用のレポートがメールで届きます<br>
        ✅ 各設問への個別回答は上司・会社には届きません
      </p>
    </div>
    <div style="background:#EEF2FF;border-radius:10px;padding:16px;">
      <p style="margin:0 0 6px;font-size:12px;font-weight:800;color:#3730A3;">🔒 プライバシーについて</p>
      <p style="margin:0;font-size:12px;color:#3730A3;line-height:1.9;">
        上司に共有されるのは「立ち上がり・戦力化／組織エンゲージメント／ウェルビーイング／離職予兆／継続定着意思」の<strong>5つの軸スコア（1〜5）のみ</strong>です。<br>
        「Q1にどう答えたか」などの設問ごとの回答内容は、上司・会社に一切共有されません。<br>
        安心して率直にお答えください。
      </p>
    </div>
  </td></tr>
  <tr><td style="background:#F9FAFB;padding:28px 32px;text-align:center;border-top:1px solid #E5E7EB;">
    <img src="https://drive.google.com/uc?export=view&id=1EXtEctBTrl__APTO1h4DUD_dmBy8jkEg" alt="リミー" style="width:160px;height:auto;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto;">
    <p style="margin:0;font-size:12px;color:#9CA3AF;">入社後90日に特化した採用後支援HRテック</p>
  </td></tr>
</table></td></tr></table>
</body></html>`;

  MailApp.sendEmail({
    to: employee.email,
    subject: `【リミー】${company.name}からオンボーディング診断のご案内`,
    htmlBody: html,
  });
}

// ===== メール登録（remenow.tokyoポップアップ） =====
function subscribeEmail(data, config) {
  const email = (data.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err('メールアドレスが無効です');

  const ss = SpreadsheetApp.openById(config.spreadsheetId);
  let sheet = ss.getSheetByName('subscribers');
  if (!sheet) {
    sheet = ss.insertSheet('subscribers');
    sheet.appendRow(['email', 'source', 'registered_at']);
    sheet.getRange(1, 1, 1, 3).setFontWeight('bold');
  }

  // 重複チェック
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const existing = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().map(e => String(e).toLowerCase());
    if (existing.includes(email)) return ok({ message: 'already_registered' });
  }

  sheet.appendRow([email, data.source || 'remenow.tokyo', new Date().toLocaleString('ja-JP')]);
  return ok({ message: 'registered' });
}

// ===== 自動バックアップ =====
function backupAllSheets() {
  const config = getConfig();
  const ss = SpreadsheetApp.openById(config.spreadsheetId);
  const p = PropertiesService.getScriptProperties();

  // バックアップ先スプレッドシートを取得 or 新規作成
  let backupSs;
  const backupId = p.getProperty('BACKUP_SPREADSHEET_ID');
  if (backupId) {
    try { backupSs = SpreadsheetApp.openById(backupId); } catch(e) { backupSs = null; }
  }
  if (!backupSs) {
    backupSs = SpreadsheetApp.create('【リミー バックアップ】診断・顧客データ');
    p.setProperty('BACKUP_SPREADSHEET_ID', backupSs.getId());
    // Mihoと共有
    backupSs.addEditor(config.limeeEmail);
  }

  const timestamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');
  const sheets = ss.getSheets();
  let backedUp = [];

  sheets.forEach(sheet => {
    const name = sheet.getName();
    const data = sheet.getDataRange().getValues();
    if (data.length === 0) return;

    // バックアップ先に同名シートがあれば上書き、なければ新規作成
    let dest = backupSs.getSheetByName(name);
    if (!dest) {
      dest = backupSs.insertSheet(name);
    } else {
      dest.clearContents();
    }
    dest.getRange(1, 1, data.length, data[0].length).setValues(data);
    backedUp.push(`${name}（${data.length - 1}件）`);
  });

  // バックアップログシートに記録
  let logSheet = backupSs.getSheetByName('_backup_log');
  if (!logSheet) {
    logSheet = backupSs.insertSheet('_backup_log');
    logSheet.appendRow(['実行日時', 'バックアップシート一覧']);
  }
  logSheet.appendRow([timestamp, backedUp.join(' / ')]);

  // 完了メールをMihoに送信
  MailApp.sendEmail({
    to: config.limeeEmail,
    subject: `✅【リミー】データバックアップ完了（${timestamp}）`,
    body: `リミーのスプレッドシートデータのバックアップが完了しました。\n\n` +
          `■ バックアップ日時：${timestamp}\n` +
          `■ バックアップ内容：\n${backedUp.map(s => `  ・${s}`).join('\n')}\n\n` +
          `■ バックアップ先スプレッドシート：\n` +
          `https://docs.google.com/spreadsheets/d/${backupSs.getId()}/edit\n\n` +
          `リミー自動バックアップシステム`,
  });
}

// ===== ヘルパー =====
function validateAdmin(secret, config) { return secret === config.adminSecret; }
function ok(data)  { return ContentService.createTextOutput(JSON.stringify({ success: true, ...data })).setMimeType(ContentService.MimeType.JSON); }
function err(msg)  { return ContentService.createTextOutput(JSON.stringify({ success: false, error: msg })).setMimeType(ContentService.MimeType.JSON); }
