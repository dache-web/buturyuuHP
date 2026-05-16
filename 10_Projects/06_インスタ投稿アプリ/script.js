document.addEventListener('DOMContentLoaded', () => {
  const fieldsToSave = [
    'apiKey',
    'messageIdea',
    'textLength',
    'imageTextMode',
    'storeInfo',
    'imageText1',
    'imageText2',
    'imageText3',
    'platform',
    'genre',
    'targetAudience',
    'tone',
    'mode',
    'characterSetting',
    'textLarge',
    'textMedium',
    'textSmall',
    'writingSample'
  ];

  const els = {
    apiKey: document.getElementById('apiKey'),
    messageIdea: document.getElementById('messageIdea'),
    textLength: document.getElementById('textLength'),
    imageTextMode: document.getElementById('imageTextMode'),
    storeInfo: document.getElementById('storeInfo'),
    individualImageTextFields: document.getElementById('individualImageTextFields'),
    imageText1: document.getElementById('imageText1'),
    imageText2: document.getElementById('imageText2'),
    imageText3: document.getElementById('imageText3'),
    platform: document.getElementById('platform'),
    genre: document.getElementById('genre'),
    targetAudience: document.getElementById('targetAudience'),
    tone: document.getElementById('tone'),
    mode: document.getElementById('mode'),
    characterSetting: document.getElementById('characterSetting'),
    characterSettingGroup: document.getElementById('characterSettingGroup'),
    textLarge: document.getElementById('textLarge'),
    textMedium: document.getElementById('textMedium'),
    textSmall: document.getElementById('textSmall'),
    writingSample: document.getElementById('writingSample'),
    profileStatus: document.getElementById('profileStatus'),
    generateBtn: document.getElementById('generateBtn'),
    loadingArea: document.getElementById('loadingArea'),
    loadingText: document.getElementById('loadingText'),
    errorLogArea: document.getElementById('errorLogArea'),
    errorLogContent: document.getElementById('errorLogContent'),
    resultArea: document.getElementById('resultArea'),
    planResult: document.getElementById('planResult'),
    visualTextResult: document.getElementById('visualTextResult'),
    imagePromptResult1: document.getElementById('imagePromptResult1'),
    imagePromptResult2: document.getElementById('imagePromptResult2'),
    imagePromptResult3: document.getElementById('imagePromptResult3'),
    captionResult: document.getElementById('captionResult'),
    copyBtns: document.querySelectorAll('.copy-btn')
  };


  const voiceProfile = localStorage.getItem('snsVoiceProfile') || '';
  const japaneseTextRule = [
    '画像内に表示する文字は必ず日本語にしてください。',
    '英語のキャッチコピー、英語の見出し、英語の説明文は作らないでください。',
    'ユーザーが日本語で入力した文字は英訳せず、そのまま日本語で使ってください。',
    'ユーザー指定が空欄の場合も、日本語の自然なコピーを新しく考えてください。'
  ].join('\n');

  if (els.profileStatus) {
    els.profileStatus.innerText = voiceProfile
      ? '保存済みの口調プロフィールを反映します。'
      : '保存済みの口調プロフィールはありません。';
  }

  const savedData = JSON.parse(localStorage.getItem('snsContentAppSavedData')) || {};
  fieldsToSave.forEach((key) => {
    if (savedData[key]) {
      els[key].value = savedData[key];
    }
  });

  const saveInputs = () => {
    const dataToSave = {};
    fieldsToSave.forEach((key) => {
      dataToSave[key] = els[key].value;
    });
    localStorage.setItem('snsContentAppSavedData', JSON.stringify(dataToSave));
  };

  fieldsToSave.forEach((key) => {
    els[key].addEventListener('input', saveInputs);
    els[key].addEventListener('change', saveInputs);
  });

  const toggleCharacterSetting = () => {
    if (els.mode.value === '漫画') {
      els.characterSettingGroup.style.display = 'block';
    } else {
      els.characterSettingGroup.style.display = 'none';
    }
  };

  if (els.mode) {
    els.mode.addEventListener('change', toggleCharacterSetting);
    toggleCharacterSetting();
  }

  const toggleImageTextFields = () => {
    if (!els.imageTextMode || !els.individualImageTextFields) return;
    els.individualImageTextFields.style.display = els.imageTextMode.value === 'individual'
      ? 'block'
      : 'none';
  };

  if (els.imageTextMode) {
    els.imageTextMode.addEventListener('change', toggleImageTextFields);
    toggleImageTextFields();
  }

  const referenceImages = [null, null, null];

  const setupDropZone = (zoneId, inputId, previewId, index) => {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    
    if (!zone || !input || !preview) return;

    zone.addEventListener('click', () => input.click());

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0]);
      }
    });

    input.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFile(e.target.files[0]);
      }
    });

    const handleFile = (file) => {
      if (!file.type.startsWith('image/')) {
        alert('画像ファイルを選択してください。');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        referenceImages[index] = {
          url: e.target.result,
          mime: file.type
        };
        preview.src = e.target.result;
        preview.style.display = 'block';
      };
      reader.readAsDataURL(file);
    };
  };

  setupDropZone('dropZone1', 'refImage1', 'preview1', 0);
  setupDropZone('dropZone2', 'refImage2', 'preview2', 1);
  setupDropZone('dropZone3', 'refImage3', 'preview3', 2);

  const isValidOpenAiKey = (apiKey) => {
    return apiKey.startsWith('sk-') || apiKey.startsWith('sess-');
  };

  const callOpenAIApi = async (apiKey, contentItems, isJson = false) => {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: contentItems }],
        temperature: 0.75,
        response_format: isJson ? { type: 'json_object' } : { type: 'text' }
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || 'APIリクエストに失敗しました。');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('AIから有効な結果が返りませんでした。');
    
    return content;
  };

  const buildPlannerRequest = () => {
    let lengthInstruction = '目安として1000〜1500文字程度で、非常に充実した内容（現在の3倍程度のボリューム）にしてください。';
    if (els.textLength.value === '短め') {
      lengthInstruction = '目安として200〜400文字程度で、短く簡潔にまとめてください。';
    } else if (els.textLength.value === '長め') {
      lengthInstruction = '目安として1500〜2000文字程度で、かなり長文で詳細かつ熱量のある内容にしてください。';
    }

    const imageTextModeLabel = els.imageTextMode.value === 'individual'
      ? '3枚それぞれ個別に指定'
      : '1つの指示から3枚分を生成';
    const storeInfo = els.storeInfo.value.trim() || '未指定（店舗情報は入れずに作成）';
    const individualTextInstructions = els.imageTextMode.value === 'individual'
      ? `- 1枚目のテキスト指示: ${els.imageText1.value.trim() || '未指定'}
- 2枚目のテキスト指示: ${els.imageText2.value.trim() || '未指定'}
- 3枚目のテキスト指示: ${els.imageText3.value.trim() || '未指定'}`
      : `- 3枚の文字構成: 1つのテーマから、1枚目は導入、2枚目は魅力・理由、3枚目は予約・来店・購入などの行動喚起につながる連続した内容にしてください。`;

    return `あなたはSNS発信の企画者・コピーライターです。
ユーザーの要望から、投稿企画、画像内文字、連作指示（3枚の流れ）、投稿本文、ハッシュタグを作成してください。
必ずJSON形式で出力してください。
すべて日本語で出力してください。特に textLarge / textMedium / textSmall は、画像内にそのまま入る文字なので英語にしないでください。
${japaneseTextRule}

{
  "plan": "投稿のテーマ、狙い、刺さる切り口を箇条書きで",
  "textLarge": "画像に入れる日本語のメインコピー（大）※ユーザー指定があれば英訳せずそのまま使用",
  "textMedium": "画像に入れる日本語のサブコピー（中）※ユーザー指定があれば英訳せずそのまま使用",
  "textSmall": "画像に入れる日本語の補足コピー（小）※ユーザー指定があれば英訳せずそのまま使用",
  "seriesInstructions": "1枚目：導入、2枚目：展開、3枚目：オチ のように3枚の画像の流れを詳細に指定",
  "caption": "実際に投稿できる本文（行動喚起含む）。${lengthInstruction}最後に改行を入れて、10〜18個のハッシュタグもここに含めてください。"
}

ユーザー条件:
- 何を発信したいか: ${els.messageIdea.value || '未指定'}
- 発信先: ${els.platform.value}
- ジャンル: ${els.genre.value}
- 届けたい相手: ${els.targetAudience.value}
- トーン: ${els.tone.value}
- モード: ${els.mode.value}
- 文章量: ${els.textLength.value}
- 3枚の文字指定方法: ${imageTextModeLabel}
- お店・サービス情報: ${storeInfo}
- お店・サービス情報が未指定の場合: 店舗情報は無理に作らず、指示なしとして扱ってください。
${individualTextInstructions}
- ユーザー指定 文字（大）: ${els.textLarge.value || '空欄（AIが自動で考案してください）'}
- ユーザー指定 文字（中）: ${els.textMedium.value || '空欄（AIが自動で考案してください）'}
- ユーザー指定 文字（小）: ${els.textSmall.value || '空欄（AIが自動で考案してください）'}
- 普段の文章: ${els.writingSample.value || '未指定'}
- 口調プロフィール: ${voiceProfile || '未指定'}
`.trim();
  };

  const buildPromptEngineerRequest = (plannerData) => {
    const textLarge = els.textLarge.value.trim() || plannerData.textLarge || '';
    const textMedium = els.textMedium.value.trim() || plannerData.textMedium || '';
    const textSmall = els.textSmall.value.trim() || plannerData.textSmall || '';
    const storeInfo = els.storeInfo.value.trim() || '未指定（店舗情報は入れない）';
    const imageTextModeLabel = els.imageTextMode.value === 'individual'
      ? '3枚それぞれ個別に指定'
      : '1つの指示から3枚分を生成';
    const imageTextInstructions = els.imageTextMode.value === 'individual'
      ? `・1枚目の文字指示: ${els.imageText1.value.trim() || '未指定。全体テーマに合わせてAIが考える'}
・2枚目の文字指示: ${els.imageText2.value.trim() || '未指定。全体テーマに合わせてAIが考える'}
・3枚目の文字指示: ${els.imageText3.value.trim() || '未指定。全体テーマに合わせてAIが考える'}`
      : `・3枚の文字指示: 1つのテーマから、1枚目は導入、2枚目は魅力や理由、3枚目は予約・来店・購入などの行動喚起へ自然につながる連続した文字を作る`;

    let aspectRatio = '';
    const platform = els.platform.value;
    if (platform === 'Instagramフィード') {
      aspectRatio = '--ar 4:5'; // 縦長フィード推奨
    } else if (platform === 'Instagramリール' || platform === 'Instagramストーリー') {
      aspectRatio = '--ar 9:16';
    } else if (platform === 'X投稿') {
      aspectRatio = '--ar 3:4';
    } else if (platform === 'YouTubeサムネイル') {
      aspectRatio = '--ar 16:9';
    } else {
      aspectRatio = '--ar 16:9';
    }

    const hasRefImages = referenceImages.some(img => img !== null);

    return `あなたは世界最高峰の画像生成プロンプトエンジニアです。
ユーザーの要望（テーマ・被写体）を、指定された「参考画像のデザインフォーマット（テンプレート）」に完全に流し込むための、DALL-E 3用プロンプトを3枚分作成してください。
重要: 画像内に表示される文字は必ず日本語です。プロンプト本文は英語中心で構いませんが、visible text / typography / headline として指定する文字列は日本語のまま記述し、英訳しないでください。
${japaneseTextRule}

【参考画像の役割について（超重要）】
参考画像は「この被写体を描いてほしい」という意味ではありません。
参考画像は、完成画像における『デザイン・レイアウト・余白・文字配置・構図・写真配置・雰囲気』の【テンプレート】として機能させるためのものです。
あなたがすべきことは、「参考画像と同じ雰囲気・レイアウト・余白感のまま、主役（被写体）だけをユーザーのテーマに差し替えた画像」を作らせるプロンプトを書くことです。

NG例：
・参考画像が「無地背景にポツンと置かれたブロッコリー」で、テーマが「ピザ」の場合に、「ピザを食べる家族のいる背景の描き込まれたリアルな生活シーン」にする（←レイアウトや雰囲気が破壊されているため絶対NG）
・不要な背景（キッチン、店内、装飾など）を描き込みすぎる
・チラシやポップすぎる広告風にする
・参考画像とまったく違う構図にする

【ステップ1：参考画像の徹底分析（Chain of Thought）】
まず、添付された参考画像（ある場合）を深く観察し、以下の項目を日本語で言語化して出力してください。
1. 背景のトーン（無地か、どんな色か）
2. 被写体の配置（中央、やや下など）とカメラアングル
3. 余白（ネガティブスペース）の広さと位置
4. 文字の配置ルールとサイズ感の違い
5. 全体のデザインジャンル（ミニマル、上品、情報量少なめなど）

【ステップ2：プロンプトの作成】
ステップ1の分析結果を、**DALL-E 3への強制力を持たせたスタイル指示（ネガティブプロンプト的な禁止事項含む）**として変換し、ユーザーのテーマと融合させたプロンプトを3枚分作成します。
スタイルや構図の説明は英語で構いません。ただし画像に描かせる文字だけは、必ず日本語の引用符付きテキストとして入れてください。

【プロンプト構成の絶対ルール（レシピ）】
生成するプロンプトは、必ず以下の順序で組み立ててください。
[1. 媒体・絶対的なスタイル制約]
参考画像の分析結果を元に、背景（例: solid muted-green background）、余白（例: ample negative space at the top）、デザインジャンル（例: minimalist graphic design, elegant）を強力に指定。不要なものを描かないよう（例: do not clutter the background, no unnecessary objects, no people）強く指示。
[2. 被写体]
今回の発信内容（${els.messageIdea.value || '未指定'}）に沿ったメイン被写体のみを記述。
[3. テキスト配置]
参考画像の文字配置ルールに則り、指定された文字を配置。
- 大: Visible large Japanese headline text: "${textLarge}"
- 中: Visible medium Japanese subheadline text: "${textMedium}"
- 小: Visible small Japanese supporting text: "${textSmall}"
追加指定: Do not translate the visible Japanese text. Do not replace it with English words. Avoid any English visible text in the image.
[4. アスペクト比]
末尾に必ず ${aspectRatio} を追加。

【出力フォーマット（厳守）】
以下の形式で出力してください。挨拶や解説は不要です。

<スタイル分析>
（ステップ1の分析結果を日本語で記述）
</スタイル分析>

\`\`\`
（1枚目のDALL-E 3用プロンプト。表示文字は日本語）
\`\`\`

\`\`\`
（2枚目のDALL-E 3用プロンプト。表示文字は日本語）
\`\`\`

\`\`\`
（3枚目のDALL-E 3用プロンプト。表示文字は日本語）
\`\`\`

【ユーザー入力データ】
・発信先（用途）: ${platform}
・テーマ: ${els.messageIdea.value || '未指定'}
・文字（大）: ${textLarge}
・文字（中）: ${textMedium}
・文字（小）: ${textSmall}
・文章量: ${els.textLength.value}
・3枚の文字指定方法: ${imageTextModeLabel}
${imageTextInstructions}
・お店・サービス情報: ${storeInfo}
・店舗情報が未指定の場合: 架空の住所、電話番号、営業時間、URLは作らない。指示なしとして扱う。
・参考画像の有無: ${hasRefImages ? 'あり（分析してレイアウトを完全に真似てください）' : 'なし（ミニマルな配置で構成してください）'}
・連作指示: ${plannerData.seriesInstructions || ''}
`;
  };

  els.generateBtn.addEventListener('click', async () => {
    const apiKey = els.apiKey.value.trim();

    if (!apiKey) {
      alert('OpenAI APIキーを入力してください。');
      return;
    }

    if (apiKey.startsWith('AIza')) {
      alert('これはGoogle系APIキーです。OpenAI APIキー（sk- から始まるキー）を入力してください。');
      return;
    }

    if (!isValidOpenAiKey(apiKey)) {
      alert('OpenAI APIキーを入力してください。通常は sk- から始まります。');
      return;
    }

    if (!els.messageIdea.value.trim()) {
      alert('何を発信したいかを入力してください。');
      return;
    }

    els.generateBtn.disabled = true;
    els.loadingArea.style.display = 'block';
    els.resultArea.style.display = 'none';
    if (els.errorLogArea) els.errorLogArea.style.display = 'none';
    if (els.errorLogContent) els.errorLogContent.innerText = '';
    
    try {
      // Agent 1: Planner
      if (els.loadingText) els.loadingText.innerHTML = '企画・構成を立案中...<br><small>Agent 1 / 2（約10〜15秒）</small>';
      
      const plannerContentItems = [{ type: 'text', text: buildPlannerRequest() }];
      referenceImages.forEach(img => {
        if (img) {
          plannerContentItems.push({ type: 'image_url', image_url: { url: img.url } });
        }
      });

      const plannerResponse = await callOpenAIApi(apiKey, plannerContentItems, true);
      let plannerData;
      try {
        plannerData = JSON.parse(plannerResponse);
      } catch (parseError) {
        throw new Error(`Planner AgentのJSON解析に失敗しました。\n${parseError.message}\n---\n${plannerResponse}`);
      }

      // Populate Planner Results
      els.planResult.innerText = plannerData.plan || '企画の生成に失敗しました。';
      els.visualTextResult.innerText = `【大】${plannerData.textLarge || ''}\n【中】${plannerData.textMedium || ''}\n【小】${plannerData.textSmall || ''}\n\n【連作指示】\n${plannerData.seriesInstructions || ''}`;
      els.captionResult.innerText = plannerData.caption || '投稿本文の生成に失敗しました。';

      // Agent 2: Image Prompt Engineer
      if (els.loadingText) els.loadingText.innerHTML = '画像生成プロンプトを構築中...<br><small>Agent 2 / 2（約15〜20秒）</small>';
      
      const engineerContentItems = [{ type: 'text', text: buildPromptEngineerRequest(plannerData) }];
      // Pass all available reference images to the Image Prompt Engineer
      referenceImages.forEach(img => {
        if (img) {
          engineerContentItems.push({ type: 'image_url', image_url: { url: img.url } });
        }
      });

      const engineerResponse = await callOpenAIApi(apiKey, engineerContentItems, false);

      // Extract up to 3 markdown code blocks
      const extractMarkdownBlocks = (text) => {
        const regex = /```(?:markdown)?\s*([\s\S]*?)```/gi;
        const blocks = [];
        let match;
        while ((match = regex.exec(text)) !== null) {
          blocks.push(match[1].trim());
        }
        return blocks;
      };

      const blocks = extractMarkdownBlocks(engineerResponse);
      
      els.imagePromptResult1.innerText = blocks[0] || '1枚目の抽出失敗。生データ:\n' + engineerResponse;
      els.imagePromptResult2.innerText = blocks[1] || '2枚目の抽出失敗。生データ:\n' + engineerResponse;
      els.imagePromptResult3.innerText = blocks[2] || '3枚目の抽出失敗。生データ:\n' + engineerResponse;

      els.resultArea.style.display = 'block';
    } catch (error) {
      // Agent 3: Error Handler
      if (els.errorLogArea && els.errorLogContent) {
        els.errorLogArea.style.display = 'block';
        els.errorLogContent.innerText = `[Error Timestamp: ${new Date().toISOString()}]\n${error.message}\n${error.stack}`;
      }
      alert('エラーが発生しました。画面下部のエラーログを確認してください。');
      console.error('Agent Team Error:', error);
    } finally {
      els.generateBtn.disabled = false;
      els.loadingArea.style.display = 'none';
    }
  });

  els.copyBtns.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const targetId = btn.getAttribute('data-target');
      const textToCopy = els[targetId].innerText;

      try {
        await navigator.clipboard.writeText(textToCopy);
        const originalText = btn.innerText;
        btn.innerText = 'コピー済み!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.innerText = originalText;
          btn.classList.remove('copied');
        }, 2000);
      } catch (error) {
        alert('コピーに失敗しました。手動でコピーしてください。');
        console.error('Copy failed:', error);
      }
    });
  });
});
