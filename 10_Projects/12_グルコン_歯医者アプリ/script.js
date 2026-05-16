document.addEventListener('DOMContentLoaded', () => {
    
    // --- 0. Initialize Date Selects ---
    const yearSelect = document.getElementById('dob_year');
    const monthSelect = document.getElementById('dob_month');
    const daySelect = document.getElementById('dob_day');
    
    const currentYear = new Date().getFullYear();
    for (let i = currentYear; i >= currentYear - 100; i--) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i + '年';
        yearSelect.appendChild(option);
    }
    for (let i = 1; i <= 12; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i + '月';
        monthSelect.appendChild(option);
    }
    for (let i = 1; i <= 31; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i + '日';
        daySelect.appendChild(option);
    }

    // --- 1. Pain Slider Logic ---
    const painSlider = document.getElementById('pain-level');
    const painValue = document.getElementById('pain-value');

    painSlider.addEventListener('input', (e) => {
        const val = e.target.value;
        painValue.textContent = val;
        
        // Change color based on severity
        if (val < 4) {
            painValue.style.color = '#88d8b0'; // Greenish
        } else if (val < 8) {
            painValue.style.color = '#ffb347'; // Orange
        } else {
            painValue.style.color = '#ff7f7f'; // Red/Pink
        }
    });

    // --- 2. Conditional Inputs Logic ---
    const setupConditionalInput = (triggerElement, targetContainerId, triggerCondition = true) => {
        const container = document.getElementById(targetContainerId);
        
        const toggleVisibility = () => {
            let isMatch = false;
            if (triggerElement.type === 'checkbox') {
                isMatch = triggerElement.checked === triggerCondition;
            } else if (triggerElement.type === 'radio') {
                const groupName = triggerElement.name;
                const checkedRadio = document.querySelector(`input[name="${groupName}"]:checked`);
                isMatch = checkedRadio && (checkedRadio.id === triggerElement.id) === triggerCondition;
            }

            if (isMatch) {
                container.classList.add('show');
                const textarea = container.querySelector('textarea');
                if (textarea) textarea.required = true;
            } else {
                container.classList.remove('show');
                const textarea = container.querySelector('textarea');
                if (textarea) {
                    textarea.required = false;
                    textarea.value = ''; // clear value when hidden
                }
            }
        };

        if (triggerElement.type === 'radio') {
            const groupName = triggerElement.name;
            const radios = document.querySelectorAll(`input[name="${groupName}"]`);
            radios.forEach(radio => {
                radio.addEventListener('change', toggleVisibility);
            });
        } else {
            triggerElement.addEventListener('change', toggleVisibility);
        }
        
        toggleVisibility();
    };

    setupConditionalInput(document.getElementById('reason-other-check'), 'reason-other-input-container');
    setupConditionalInput(document.getElementById('disease-yes'), 'disease-input-container');
    setupConditionalInput(document.getElementById('allergy-yes'), 'allergy-input-container');
    setupConditionalInput(document.getElementById('medicine-yes'), 'medicine-input-container');
    setupConditionalInput(document.getElementById('request-other-check'), 'request-other-input-container');

    // --- 3. Form Validation & Confirmation Logic ---
    const form = document.getElementById('questionnaire-form');
    const formSection = document.getElementById('form-section');
    const confirmSection = document.getElementById('confirm-section');
    const confirmContent = document.getElementById('confirm-content');
    
    const goConfirmBtn = document.getElementById('go-confirm-btn');
    const backEditBtn = document.getElementById('back-edit-btn');
    const finalSubmitBtn = document.getElementById('final-submit-btn');
    const modal = document.getElementById('success-modal');
    const closeModalBtn = document.getElementById('close-modal');

    const labels = {
        name_kanji: "お名前（漢字）",
        name_kana: "お名前（フリガナ）",
        dob: "生年月日",
        phone: "電話番号",
        first_visit: "当院は初めてですか？",
        reason: "今日はどうなさいましたか？",
        when_pain: "いつから痛いですか？",
        pain_level: "痛みの程度",
        pain_area: "気になる箇所",
        disease: "現在治療中、または過去にかかった病気",
        allergy: "アレルギー",
        medicine: "現在服用中のお薬",
        request: "治療へのご希望"
    };

    goConfirmBtn.addEventListener('click', () => {
        // HTML5 Validation check (必須項目が入力されているかチェック)
        if (!form.checkValidity()) {
            form.reportValidity();
            // 画面に何も出ないブラウザもあるため、念のためアラートを表示します
            alert("未入力の必須項目があるか、入力内容に誤りがあります。赤枠の箇所をご確認ください。");
            return;
        }

        // Build Confirmation Content
        const fd = new FormData(form);
        let html = '';

        const addRow = (label, value) => {
            if (!value) return;
            html += `
                <div class="confirm-row">
                    <div class="confirm-label">${label}</div>
                    <div class="confirm-val">${value}</div>
                </div>
            `;
        };

        // Name
        addRow(labels.name_kanji, fd.get('name_kanji'));
        addRow(labels.name_kana, fd.get('name_kana'));
        
        // DOB
        const y = fd.get('dob_year');
        const m = fd.get('dob_month');
        const d = fd.get('dob_day');
        addRow(labels.dob, `${y}年 ${m}月 ${d}日`);
        
        // Phone
        addRow(labels.phone, fd.get('phone'));
        
        // Q1
        addRow(labels.first_visit, fd.get('first_visit'));

        // Q2
        const reasons = fd.getAll('reason');
        let reasonStr = reasons.join(', ');
        if (reasons.includes('その他') && fd.get('reason_other_text')) {
            reasonStr += `\n（詳細: ${fd.get('reason_other_text')}）`;
        }
        if (reasonStr) addRow(labels.reason, reasonStr);

        // Q3
        addRow(labels.when_pain, fd.get('when_pain'));

        // Q4
        addRow(labels.pain_level, fd.get('pain_level') + " / 10");
        const areas = fd.getAll('pain_area');
        if (areas.length > 0) {
            addRow(labels.pain_area, areas.join(', '));
        }

        // Q5
        const disease = fd.get('disease');
        let diseaseStr = disease;
        if (disease === 'あり' && fd.get('disease_text')) {
            diseaseStr += `\n（病名: ${fd.get('disease_text')}）`;
        }
        addRow(labels.disease, diseaseStr);

        // Q6
        const allergy = fd.get('allergy');
        let allergyStr = allergy;
        if (allergy === 'あり' && fd.get('allergy_text')) {
            allergyStr += `\n（原因: ${fd.get('allergy_text')}）`;
        }
        addRow(labels.allergy, allergyStr);

        // Q7
        const medicine = fd.get('medicine');
        let medicineStr = medicine;
        if (medicine === 'あり' && fd.get('medicine_text')) {
            medicineStr += `\n（薬名: ${fd.get('medicine_text')}）`;
        }
        addRow(labels.medicine, medicineStr);

        // Q8
        const requests = fd.getAll('request');
        let reqStr = requests.join(', ');
        if (requests.includes('その他') && fd.get('request_other_text')) {
            reqStr += `\n（詳細: ${fd.get('request_other_text')}）`;
        }
        if (reqStr) addRow(labels.request, reqStr);

        confirmContent.innerHTML = html;

        // Switch screens
        formSection.classList.add('hidden');
        confirmSection.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    backEditBtn.addEventListener('click', () => {
        confirmSection.classList.add('hidden');
        formSection.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    finalSubmitBtn.addEventListener('click', async () => {
        // ▼▼▼ Google Apps Script (GAS) 連携の設定 ▼▼▼
        // GASでデプロイしたときに発行される「ウェブアプリのURL」を下の '' の中に貼り付けます。
        // 例: 'https://script.google.com/macros/s/xxxxxxxxx/exec'
        const GAS_URL = ''; 
        // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

        const fd = new FormData(form);
        
        // 送信ボタンを連打できないように無効化（「送信中...」に変更）
        const originalText = finalSubmitBtn.innerHTML;
        finalSubmitBtn.innerHTML = '<span class="btn-text">送信中...</span>';
        finalSubmitBtn.disabled = true;

        // もしGAS_URLが空の場合は、連携テストとして成功モーダルだけ表示して終了します
        if (!GAS_URL) {
            console.log("GAS_URLが設定されていないため、テスト送信として扱います。");
            setTimeout(() => {
                modal.classList.remove('hidden');
                finalSubmitBtn.innerHTML = originalText;
                finalSubmitBtn.disabled = false;
            }, 1000);
            return;
        }

        // --- ここからGASへデータを送信する処理 ---
        
        // 入力データをGASが読みやすい形式にまとめる
        const submitData = {
            name_kanji: fd.get('name_kanji'),
            name_kana: fd.get('name_kana'),
            dob: `${fd.get('dob_year')}年 ${fd.get('dob_month')}月 ${fd.get('dob_day')}日`,
            phone: fd.get('phone'),
            first_visit: fd.get('first_visit'),
            reason: fd.getAll('reason').join(', ') + (fd.get('reason_other_text') ? `（詳細: ${fd.get('reason_other_text')}）` : ''),
            when_pain: fd.get('when_pain') || '未選択',
            pain_level: fd.get('pain_level') + ' / 10',
            pain_area: fd.getAll('pain_area').join(', '),
            disease: fd.get('disease') === 'あり' && fd.get('disease_text') ? `あり（${fd.get('disease_text')}）` : fd.get('disease'),
            allergy: fd.get('allergy') === 'あり' && fd.get('allergy_text') ? `あり（${fd.get('allergy_text')}）` : fd.get('allergy'),
            medicine: fd.get('medicine') === 'あり' && fd.get('medicine_text') ? `あり（${fd.get('medicine_text')}）` : fd.get('medicine'),
            request: fd.getAll('request').join(', ') + (fd.get('request_other_text') ? `（詳細: ${fd.get('request_other_text')}）` : '')
        };

        try {
            // fetchを使ってGASにデータを送信します
            const response = await fetch(GAS_URL, {
                method: 'POST',
                // ※CORSエラー（通信拒否）を防ぐための設定
                mode: 'no-cors', 
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(submitData)
            });

            // エラーがなく送信が終わったら、完了モーダルを表示
            modal.classList.remove('hidden');
        } catch (error) {
            console.error("送信エラー:", error);
            alert("送信に失敗しました。インターネット接続を確認して再度お試しください。");
        } finally {
            // ボタンを元の状態に戻す
            finalSubmitBtn.innerHTML = originalText;
            finalSubmitBtn.disabled = false;
        }
    });

    closeModalBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        // Reset form to start over
        form.reset();
        // Reset slider UI
        painValue.textContent = "0";
        painValue.style.color = '#88d8b0';
        
        // Go back to form section
        confirmSection.classList.add('hidden');
        formSection.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
});
