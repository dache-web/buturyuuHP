document.addEventListener('DOMContentLoaded', () => {
    // フォーム要素の取得
    const inputNameKanji = document.getElementById('name-kanji');
    const inputNameKana = document.getElementById('name-kana');
    const inputJobTitle = document.getElementById('job-title');
    const inputCatchphrase = document.getElementById('catchphrase');
    const inputSnsId = document.getElementById('sns-id');
    const inputBio = document.getElementById('biography');
    const charCounter = document.querySelector('.char-counter');

    // プレビュー表示要素の取得
    const viewNameMain = document.getElementById('name-main');
    const viewNameSub = document.getElementById('name-sub');
    const viewJobTitle = document.getElementById('view-job-title');
    const viewCatchphrase = document.getElementById('view-catchphrase');
    const viewBio = document.getElementById('view-bio');
    const viewSns = document.getElementById('view-sns');

    // 1. リアルタイム同期ロジックの拡張
    const updatePreview = () => {
        // Hero Section
        viewNameMain.textContent = inputNameKanji.value || '山田 太郎';
        viewNameSub.textContent = inputNameKana.value || 'やまだ たろう';
        viewJobTitle.textContent = inputJobTitle.value || 'ウェブデザイナー';
        viewCatchphrase.textContent = inputCatchphrase.value || 'ワクワクを届けるエンジニア';
        
        // About Section
        viewBio.textContent = inputBio.value || '10年間のエンジニア経験を活かし、最新のAI技術とデザインを融合させた心地よいプロダクト開発を得意としています。';
        
        // Contact Section
        viewSns.textContent = inputSnsId.value || '@username';
    };

    // イベントリスナーの設定
    const inputs = [inputNameKanji, inputNameKana, inputJobTitle, inputCatchphrase, inputSnsId, inputBio];
    
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            updatePreview();
            
            // 自己紹介の文字数カウント
            if (input === inputBio) {
                const length = inputBio.value.length;
                charCounter.textContent = `${length} / 100`;
                charCounter.style.color = length > 100 ? '#e53e3e' : '#718096';
            }
        });
    });

    // 2. スクロールアニメーション (Intersection Observer)
    const observerOptions = {
        threshold: 0.2
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('appear');
            }
        });
    }, observerOptions);

    const fadeElements = document.querySelectorAll('.fade-in');
    fadeElements.forEach(el => observer.observe(el));

    // 初回実行
    updatePreview();
});
