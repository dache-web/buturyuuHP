document.addEventListener('DOMContentLoaded', () => {
  const els = {
    apiKey: document.getElementById('apiKey'),
    postUrls: document.getElementById('postUrls'),
    youtubeUrls: document.getElementById('youtubeUrls'),
    imageDropZone: document.getElementById('imageDropZone'),
    sampleImages: document.getElementById('sampleImages'),
    imagePreviewGrid: document.getElementById('imagePreviewGrid'),
    sheetUrl: document.getElementById('sheetUrl'),
    sampleText: document.getElementById('sampleText'),
    profileMemo: document.getElementById('profileMemo'),
    templateBtn: document.getElementById('templateBtn'),
    learnBtn: document.getElementById('learnBtn'),
    loadingArea: document.getElementById('loadingArea'),
    profileResult: document.getElementById('profileResult'),
    copyProfileBtn: document.getElementById('copyProfileBtn'),
    clearProfileBtn: document.getElementById('clearProfileBtn')
  };

  const storageKey = 'snsVoiceProfile';
  let sampleImageDataUrls = [];
  const savedProfile = localStorage.getItem(storageKey);
  els.profileResult.innerText = savedProfile || 'まだ口調プロフィールは保存されていません。';

  const isValidOpenAiKey = (apiKey) => {
    return apiKey.startsWith('sk-') || apiKey.startsWith('sess-');
  };

  const normalizeSheetUrl = (url) => {
    if (!url) return '';
    if (url.includes('/edit')) {
      return url.replace(/\/edit.*$/, '/export?format=csv');
    }
    return url;
  };

  const fetchSheetText = async (url) => {
    if (!url) return '';
    const response = await fetch(normalizeSheetUrl(url));
    if (!response.ok) {
      throw new Error('スプレッドシートを読み込めませんでした。CSV公開URLか共有設定を確認してください。');
    }
    return response.text();
  };

  const extractYouTubeId = (url) => {
    const patterns = [
      /youtu\.be\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/watch\?[^#]*v=([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return '';
  };

  const buildYouTubeLearningText = () => {
    const urls = els.youtubeUrls.value
      .split(/\r?\n/)
      .map((url) => url.trim())
      .filter(Boolean);

    if (!urls.length) return '';

    return urls.map((url) => {
      const id = extractYouTubeId(url);
      if (!id) {
        return `URL: ${url}\n動画ID: 取得できませんでした`;
      }

      return [
        `URL: ${url}`,
        `動画ID: ${id}`,
        `推定サムネイル: https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
        `代替サムネイル: https://img.youtube.com/vi/${id}/hqdefault.jpg`
      ].join('\n');
    }).join('\n\n');
  };

  const buildLearningTemplate = () => {
    return `【投稿URL】
Instagram:
X:
YouTube:

【投稿本文・概要欄】
ここに過去投稿の本文、YouTube概要欄、X本文などを貼る

【画像・サムネの特徴】
色:
文字量:
構図:
人物/商品:
よく使う装飾:

【反応が良かった投稿】
URL:
理由:
いいね/保存/再生など:

【自分らしい言い回し】

【避けたい言い方】

【今後も残したい発信方針】
`;
  };

  const renderImagePreviews = () => {
    els.imagePreviewGrid.innerHTML = '';
    if (!sampleImageDataUrls.length) {
      els.imagePreviewGrid.style.display = 'none';
      return;
    }

    sampleImageDataUrls.forEach((dataUrl) => {
      const img = document.createElement('img');
      img.src = dataUrl;
      img.alt = '学習用画像プレビュー';
      els.imagePreviewGrid.appendChild(img);
    });
    els.imagePreviewGrid.style.display = 'grid';
  };

  const loadImageFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter((file) => file.type.startsWith('image/'));
    if (!files.length) {
      sampleImageDataUrls = [];
      renderImagePreviews();
      return;
    }

    const limitedFiles = files.slice(0, 10);
    if (files.length > limitedFiles.length) {
      alert('一度に読み込める画像は10枚までです。先頭10枚を使います。');
    }

    sampleImageDataUrls = await Promise.all(limitedFiles.map((file) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (readerEvent) => resolve(readerEvent.target.result);
      reader.readAsDataURL(file);
    })));
    renderImagePreviews();
  };

  els.sampleImages.addEventListener('change', async (event) => {
    await loadImageFiles(event.target.files);
  });

  els.imageDropZone.addEventListener('click', () => {
    els.sampleImages.click();
  });

  els.imageDropZone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      els.sampleImages.click();
    }
  });

  ['dragenter', 'dragover'].forEach((eventName) => {
    els.imageDropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      els.imageDropZone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    els.imageDropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      els.imageDropZone.classList.remove('drag-over');
    });
  });

  els.imageDropZone.addEventListener('drop', async (event) => {
    await loadImageFiles(event.dataTransfer.files);
  });

  const buildLearningRequest = (sheetText, sampleText, memo, postUrls, youtubeText) => {
    return `
あなたはSNS投稿者の文体・思考・発信方針を分析する編集者です。
以下の投稿URL、文章サンプル、画像・スクショから、今後のSNS投稿生成に使う「口調・思考プロフィール」を作ってください。

目的:
- 投稿作成AIが、その人らしい言葉選び、距離感、価値観、避けるべき表現を再現できるようにする。
- 単なる文体ではなく、どんな切り口を好むか、読者にどう接するか、何を大切にしているかまで抽出する。
- 画像やスクショがある場合は、色、余白、文字量、構図、写真の使い方、サムネイルらしさも抽出する。
- 個人情報や固有の秘密情報は保存しない。

出力形式:
【文体】
よく使う語尾、文章の長さ、改行、絵文字の傾向、温度感。

【思考・価値観】
発信で大切にしている視点、読者への向き合い方、よく使う切り口。

【よく使う表現】
再現してよい言い回し、フレーズ、言葉選び。

【避ける表現】
避けるべき言い方、強すぎる表現、らしくない言葉。

【投稿作成時の指示】
今後の投稿本文、画像内文字、ハッシュタグ生成時に守るべき実用指示。

【画像・デザイン傾向】
過去画像から読み取れる色、構図、文字量、被写体、雰囲気、サムネイル/投稿画像の傾向。

投稿URL:
${postUrls || 'なし'}

YouTube URL解析:
${youtubeText || 'なし'}

スプレッドシート本文:
${sheetText || 'なし'}

貼り付け文章:
${sampleText || 'なし'}

補足メモ:
${memo || 'なし'}
`.trim();
  };

  els.templateBtn.addEventListener('click', async () => {
    els.profileResult.innerText = buildLearningTemplate();
    try {
      await navigator.clipboard.writeText(els.profileResult.innerText);
      alert('学習用テンプレをコピーしました。文章サンプル欄に貼って埋めてください。');
    } catch (error) {
      alert('テンプレを出力しました。必要なら手動でコピーしてください。');
      console.error(error);
    }
  });

  els.learnBtn.addEventListener('click', async () => {
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
    if (!els.postUrls.value.trim() && !els.youtubeUrls.value.trim() && !els.sheetUrl.value.trim() && !els.sampleText.value.trim() && !els.profileMemo.value.trim() && !sampleImageDataUrls.length) {
      alert('投稿URL、YouTube URL、画像、文章サンプル、補足メモのいずれかを入力してください。');
      return;
    }

    els.learnBtn.disabled = true;
    els.loadingArea.style.display = 'block';

    try {
      const sheetText = await fetchSheetText(els.sheetUrl.value.trim());
      const requestText = buildLearningRequest(
        sheetText,
        els.sampleText.value.trim(),
        els.profileMemo.value.trim(),
        els.postUrls.value.trim(),
        buildYouTubeLearningText()
      );
      const contentItems = [{ type: 'text', text: requestText }];
      sampleImageDataUrls.forEach((dataUrl) => {
        contentItems.push({ type: 'image_url', image_url: { url: dataUrl } });
      });

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
          temperature: 0.45
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || 'APIリクエストに失敗しました。');
      }

      const data = await response.json();
      const profile = data.choices?.[0]?.message?.content?.trim();
      if (!profile) {
        throw new Error('AIから有効な結果が返りませんでした。');
      }

      localStorage.setItem(storageKey, profile);
      els.profileResult.innerText = profile;
      alert('口調プロフィールを保存しました。投稿作成ページに反映されます。');
    } catch (error) {
      alert(`エラーが発生しました: ${error.message}`);
      console.error(error);
    } finally {
      els.learnBtn.disabled = false;
      els.loadingArea.style.display = 'none';
    }
  });

  els.copyProfileBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(els.profileResult.innerText);
      alert('コピーしました。');
    } catch (error) {
      alert('コピーに失敗しました。手動でコピーしてください。');
      console.error(error);
    }
  });

  els.clearProfileBtn.addEventListener('click', () => {
    if (!confirm('保存済みの口調プロフィールを削除しますか？')) return;
    localStorage.removeItem(storageKey);
    els.profileResult.innerText = 'まだ口調プロフィールは保存されていません。';
  });
});
