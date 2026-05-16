document.addEventListener('DOMContentLoaded', () => {
  const fieldsToSave = [
    'messageIdea',
    'platform',
    'genre',
    'targetAudience',
    'tone',
    'mustInclude',
    'writingSample',
    'extraNotes'
  ];

  const els = {
    apiKey: document.getElementById('apiKey'),
    referenceImage: document.getElementById('referenceImage'),
    imagePreviewArea: document.getElementById('imagePreviewArea'),
    imagePreview: document.getElementById('imagePreview'),
    messageIdea: document.getElementById('messageIdea'),
    platform: document.getElementById('platform'),
    genre: document.getElementById('genre'),
    targetAudience: document.getElementById('targetAudience'),
    tone: document.getElementById('tone'),
    mustInclude: document.getElementById('mustInclude'),
    writingSample: document.getElementById('writingSample'),
    profileStatus: document.getElementById('profileStatus'),
    extraNotes: document.getElementById('extraNotes'),
    generateBtn: document.getElementById('generateBtn'),
    loadingArea: document.getElementById('loadingArea'),
    resultArea: document.getElementById('resultArea'),
    planResult: document.getElementById('planResult'),
    visualTextResult: document.getElementById('visualTextResult'),
    imagePromptResult: document.getElementById('imagePromptResult'),
    captionResult: document.getElementById('captionResult'),
    hashtagResult: document.getElementById('hashtagResult'),
    copyBtns: document.querySelectorAll('.copy-btn')
  };

  let imageDataUrl = null;
  let imageMimeType = null;
  const voiceProfile = localStorage.getItem('snsVoiceProfile') || '';

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

  els.referenceImage.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) {
      imageDataUrl = null;
      imageMimeType = null;
      els.imagePreviewArea.style.display = 'none';
      els.imagePreview.removeAttribute('src');
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('画像ファイルを選択してください。');
      els.referenceImage.value = '';
      return;
    }

    imageMimeType = file.type;
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      imageDataUrl = readerEvent.target.result;
      els.imagePreview.src = imageDataUrl;
      els.imagePreviewArea.style.display = 'block';
    };
    reader.readAsDataURL(file);
  });

  const isValidOpenAiKey = (apiKey) => {
    return apiKey.startsWith('sk-') || apiKey.startsWith('sess-');
  };

  const buildRequest = () => {
    return `
あなたはSNS発信の企画者、コピーライター、画像生成ディレクターです。
ユーザーは「何を作ればいいかわからない」という悩みを持っています。
入力された発信したいことを、実際に投稿できる内容まで具体化してください。

重要:
- ただの画像生成プロンプトではなく、投稿の狙い、画像内文字、投稿本文、ハッシュタグまで作る。
- 発信先の媒体に合わせて、情報量、言い回し、クリック/保存/視聴されやすさを調整する。
- 参考画像がある場合は、被写体、色味、雰囲気、使えそうな訴求を読み取り、企画と画像プロンプトに反映する。
- 画像内の日本語文字はそのまま使う前提でよい。
- 薬機法や誇大広告に触れそうな断定表現は避ける。特に美容・健康では「治る」「必ず」「完全に」などを使わない。
- ユーザーがその場で編集しやすいよう、各項目を短く整理する。
- 保存済みの口調・思考プロフィールがある場合は、投稿本文と画像内文字の言い回しに強く反映する。
- 保存済みプロフィールに画像・デザイン傾向がある場合は、画像生成プロンプトにも反映する。

ユーザー条件:
- 何を発信したいか: ${els.messageIdea.value || '未指定'}
- 発信先: ${els.platform.value}
- ジャンル: ${els.genre.value}
- 届けたい相手: ${els.targetAudience.value}
- 文体・トーン: ${els.tone.value}
- 必ず入れたい言葉・商品名: ${els.mustInclude.value || '未指定'}
- 普段の文章サンプル: ${els.writingSample.value || '未指定'}
- 保存済みの口調・思考プロフィール: ${voiceProfile || '未指定'}
- 避けたい表現・追加要望: ${els.extraNotes.value || '未指定'}
- 参考画像MIME: ${imageMimeType || '参考画像なし'}

必ず次の5見出しで返してください。

【投稿企画】
投稿のテーマ、狙い、ターゲットの悩み、刺さる切り口を箇条書きで作る。

【画像内に入れる文字】
画像またはサムネイルに入れるメインコピー、サブコピー、補足コピーを作る。短く、視認性を優先する。

【画像生成プロンプト】
ChatGPT Imageに貼れる1枚画像用プロンプトを作る。サイズ、構図、被写体、背景、色、光、文字配置、余白、SNSで目立つ要素を含める。
参考画像を添付して使う場合の一文も入れる。

【投稿本文】
実際に投稿できる本文を作る。冒頭の引き、本文、行動喚起まで含める。
Instagramなら保存・コメント・DMにつなげる。YouTubeサムネイルなら概要欄や投稿告知文として使える文章にする。

【ハッシュタグ】
媒体とジャンルに合うハッシュタグを10〜18個作る。大きいタグ、具体タグ、悩みタグ、行動タグを混ぜる。
`.trim();
  };

  const extractSection = (content, title, nextTitles) => {
    const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nextPattern = nextTitles.map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const regex = new RegExp(`${escapedTitle}([\\s\\S]*?)(?=${nextPattern || '$'}|$)`);
    const match = content.match(regex);
    return match ? match[1].trim() : '';
  };

  const parseResult = (content) => {
    const titles = [
      '【投稿企画】',
      '【画像内に入れる文字】',
      '【画像生成プロンプト】',
      '【投稿本文】',
      '【ハッシュタグ】'
    ];

    return {
      plan: extractSection(content, titles[0], titles.slice(1)) || content,
      visualText: extractSection(content, titles[1], titles.slice(2)),
      imagePrompt: extractSection(content, titles[2], titles.slice(3)),
      caption: extractSection(content, titles[3], titles.slice(4)),
      hashtags: extractSection(content, titles[4], [])
    };
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

    try {
      const contentItems = [{ type: 'text', text: buildRequest() }];
      if (imageDataUrl) {
        contentItems.push({ type: 'image_url', image_url: { url: imageDataUrl } });
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: contentItems
            }
          ],
          temperature: 0.75
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || 'APIリクエストに失敗しました。');
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content?.trim();

      if (!content) {
        throw new Error('AIから有効な結果が返りませんでした。');
      }

      const sections = parseResult(content);
      els.planResult.innerText = sections.plan;
      els.visualTextResult.innerText = sections.visualText || '画像内文字を生成できませんでした。投稿企画をもとに編集してください。';
      els.imagePromptResult.innerText = sections.imagePrompt || '画像生成プロンプトを生成できませんでした。投稿企画をもとに編集してください。';
      els.captionResult.innerText = sections.caption || '投稿本文を生成できませんでした。投稿企画をもとに編集してください。';
      els.hashtagResult.innerText = sections.hashtags || 'ハッシュタグを生成できませんでした。投稿企画をもとに編集してください。';
      els.resultArea.style.display = 'block';
    } catch (error) {
      alert(`エラーが発生しました: ${error.message}`);
      console.error(error);
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
        alert('コピーしました。');
      } catch (error) {
        alert('コピーに失敗しました。手動でコピーしてください。');
        console.error('Copy failed:', error);
      }
    });
  });
});
