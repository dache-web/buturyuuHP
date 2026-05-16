/* 究極の連続対話エンジン script.js */

const chatWindow = document.getElementById('chat-window');
const optionsContainer = document.getElementById('options-container');
const userInput = document.getElementById('user-input');
const thinkingBar = document.getElementById('thinking-bar');
const thinkingText = document.getElementById('thinking-text');
const analysisLog = document.getElementById('analysis-log');

let currentState = 'start';
let conversationHistory = [];

// 初期化
window.onload = () => {
    initChat();
};

function initChat() {
    renderStep('start');
}

// ステップのレンダリング
async function renderStep(stateKey) {
    analysisLog.innerHTML += `<br>[System] Moving to state: ${stateKey}`;
    
    // データがない場合のフォールバック
    if (!dialogueTree[stateKey]) {
        addLog(`Critical: State [${stateKey}] not found. Escalating.`);
        addMessage("申し訳ございません。こちらの手続きについて、専門のオペレーターがお手伝いした方がスムーズな状況でございます。よろしければ、有人窓口へお繋ぎしてもよろしいでしょうか。", 'bot');
        renderFinalOptions(); // 有人窓口へのボタンを含むオプションを表示
        return;
    }


    const node = dialogueTree[stateKey];
    currentState = stateKey;
    
    // オプションを一度クリア
    optionsContainer.innerHTML = '';
    
    // AIの思考中を演出
    await simulateThinking(node.text);
    
    // メッセージを表示
    addMessage(node.text, 'bot');
    
    // 選択肢を表示
    if (node.options && node.options.length > 0) {
        node.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'opt-btn';
            btn.innerText = opt.text;
            btn.onclick = () => selectOption(opt);
            optionsContainer.appendChild(btn);
        });
    } else {
        // 最終ノード後のフォローアップ
        addLog(`Final node reached. Providing loop options.`);
        setTimeout(() => {
            addMessage("こちらで解決いたしましたでしょうか？他にも何かお困りのことがあれば、何なりとおっしゃってくださいね。", 'bot');
            renderFinalOptions();
        }, 1500);
    }
}


function renderFinalOptions() {
    const btn = document.createElement('button');
    btn.className = 'opt-btn';
    btn.innerText = "最初に戻る";
    btn.onclick = () => renderStep('start');
    optionsContainer.appendChild(btn);
    
    const btnAgent = document.createElement('button');
    btnAgent.className = 'opt-btn';
    btnAgent.innerText = "有人チャットを希望する";
    btnAgent.onclick = () => renderStep('complaint');
    optionsContainer.appendChild(btnAgent);
}

// 選択肢を選んだ時
function selectOption(option) {
    addMessage(option.text, 'user');
    
    // 履歴をログに表示
    addLog(`User choice registered: ${option.text}`);
    
    renderStep(option.next);
}

// 思考シミュレーション
function simulateThinking(targetText) {
    return new Promise(resolve => {
        thinkingBar.style.display = 'block';
        
        // 分岐に応じた「思考ログ」の演出
        const thoughts = [
            "> アカウント情報を参照中...",
            "> 配送データベースへクエリ送信中...",
            "> ユーザーの感情パラメータを分析中...",
            "> 「共感」モードをアクティブ化します。",
            "> 最適な解決策を3つのパスから抽出..."
        ];
        
        const randomThought = thoughts[Math.floor(Math.random() * thoughts.length)];
        addLog(randomThought);
        
        // 文字数に応じて時間を変える（より自然に）
        const duration = Math.min(2000, 500 + targetText.length * 10);
        
        setTimeout(() => {
            thinkingBar.style.display = 'none';
            resolve();
        }, duration);
    });
}

// メッセージ表示
function addMessage(text, side) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `msg ${side}-msg`;
    msgDiv.innerText = text;
    chatWindow.appendChild(msgDiv);
    
    // スクロール
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// 送信ボタン・エンターキー
function handleEnter(e) { if (e.key === 'Enter') sendMessage(); }

function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    addMessage(text, 'user');
    userInput.value = '';
    
    addLog(`Natural Language Input: "${text}"`);
    processNaturalLanguage(text);
}

// 簡易的なキーワード解析（LLMの意図解釈をシミュレート）
async function processNaturalLanguage(text) {
    thinkingBar.style.display = 'block';
    thinkingText.innerText = "意図を解釈しています...";
    
    await new Promise(r => setTimeout(r, 1500));
    
    const keywords = {
        '届': 'shipping',
        '遅': 'comp_delay',
        '怒': 'complaint',
        '戻': 'returns',
        'キャンセル': 'cancel',
        '壊': 'defective',
        '金': 'payment',
        'プレゼント': 'gift',
        'クーポン': 'promo',
        '在庫': 'product'
    };

    let matched = false;
    for (const [kw, state] of Object.entries(keywords)) {
        if (text.includes(kw)) {
            addLog(`Intent detected: [${kw}] -> Mapping to ${state}`);
            renderStep(state);
            matched = true;
            break;
        }
    }

// 意図が不明確な場合（有人チャットへのエスカレーション）
    if (!matched) {
        addLog(`Intent unclear. Escalating to human support option.`);
        addMessage("申し訳ございません。より正確な解決策をご案内するため、専門のオペレーターへ直接お繋ぎしましょうか？", 'bot');
        
        // 有人チャットへの誘導ボタンを表示
        optionsContainer.innerHTML = '';
        const btnAgent = document.createElement('button');
        btnAgent.className = 'opt-btn';
        btnAgent.innerText = "🚩 有人オペレーターに繋ぐ";
        btnAgent.onclick = () => {
            addMessage("有人オペレーターへの接続を希望します", 'user');
            addLog("Manual escalation target: 10.3 [Escalate]");
            renderStep('complaint'); // お叱り・有人対応ルートへ
        };
        optionsContainer.appendChild(btnAgent);

        const btnMenu = document.createElement('button');
        btnMenu.className = 'opt-btn';
        btnMenu.innerText = "メニューから選び直す";
        btnMenu.onclick = () => renderStep('start');
        optionsContainer.appendChild(btnMenu);
    }
}


function addLog(msg) {
    const time = new Date().toLocaleTimeString();
    analysisLog.innerHTML += `<br>[${time}] ${msg}`;
    // ログが多すぎる場合は上を切る
    const lines = analysisLog.innerHTML.split('<br>');
    if (lines.length > 8) {
        analysisLog.innerHTML = lines.slice(lines.length - 8).join('<br>');
    }
}
