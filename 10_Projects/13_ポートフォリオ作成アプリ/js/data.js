/**
 * 🌟 ポートフォリオ・データ管理ファイル
 */

const portfolioData = {
  "welcome": {
    "img": "images/welcome_img.png",
    "title": "📣 Instagram運用の無料相談を受付中です！",
    "text": "はじめまして！<br>Instagram運用代行のAIアシスタントです📱✨<br><br>下のメニューから、見たい実績をタップしてくださいね！👇"
  },
  "categories": [
    {
      "id": "diet",
      "btnText": "🥗 筋トレ実践",
      "userMessage": "筋トレ実践の実績が見たい",
      "slides": [
        {
          "img": "images/diet_1.png",
          "title": "【表紙】ヘルシーなワンプレート",
          "desc": "#ダイエット記録。世界観を統一した目を引く表紙デザインです。"
        },
        {
          "img": "images/diet_2.png",
          "title": "【内容】糖質置き換えのコツ",
          "desc": "有益な情報を分かりやすく図解。保存数を伸ばす構成です。"
        },
        {
          "img": "images/diet_3.png",
          "title": "【最後】サンクスページ",
          "desc": "フォローや保存を促し、アカウントの成長に繋げます。"
        }
      ]
    },
    {
      "id": "finance",
      "btnText": "💰 家計管理",
      "userMessage": "家計管理・節約の実績が見たい",
      "slides": [
        {
          "img": "images/finance_1.png",
          "title": "【表紙】月1万円の固定費削減",
          "desc": "ターゲットに刺さるキャッチコピーと清潔感のあるデザイン。"
        },
        {
          "img": "images/finance_2.png",
          "title": "【内容】スマホ料金見直し",
          "desc": "複雑な内容も、スマホで見やすいレイアウトで解説します。"
        },
        {
          "img": "images/finance_3.png",
          "title": "【最後】サンクスページ",
          "desc": "読後感を高め、次のアクションへと自然に誘導します。"
        }
      ]
    },
    {
      "id": "realestate",
      "btnText": "🏠 不動産",
      "userMessage": "不動産・暮らしの実績が見たい",
      "slides": [
        {
          "img": "images/re_1.png",
          "title": "【表紙】物件選びのコツ",
          "desc": "内見での優先順位（日当たり・駅距離）を明確に伝えます。"
        },
        {
          "img": "images/re_2.png",
          "title": "【内容】日当たりの重要性",
          "desc": "午前の日当たりの良さなど、生活の質に関わるポイントを解説。"
        },
        {
          "img": "images/re_3.png",
          "title": "【最後】サンクスページ",
          "desc": "家アイコンを用いた、暮らしに寄り添う親しみやすいデザイン。"
        }
      ]
    },
    {
      "id": "beauty",
      "btnText": "✨ 美容",
      "userMessage": "美容・セルフケアの実績が見たい",
      "slides": [
        {
          "img": "images/beauty_1.png",
          "title": "【表紙】ホワイトニング効果",
          "desc": "たった1回の施術での劇的な変化を視覚的にアピールします。"
        },
        {
          "img": "images/beauty_2.png",
          "title": "【内容】笑顔への自信",
          "desc": "「自分を好きになれる」というベネフィットを強調する構成です。"
        },
        {
          "img": "images/beauty_3.png",
          "title": "【最後】サンクスページ",
          "desc": "清潔感のある明るいデザインで、好印象を与えつつ導線を繋げます。"
        }
      ]
    }
  ],
  "services": [
    {
      "img": "images/general.png",
      "title": "🎨 フィード投稿設計",
      "desc": "統一感のあるトーン＆マナー設計と、思わず保存される有益なデザイン制作。"
    },
    {
      "img": "images/cafe2.png",
      "title": "🎬 リール動画制作",
      "desc": "開始3秒で惹きつける台本構成と、最新のトレンド編集でリーチを爆増。"
    },
    {
      "img": "images/beauty2.png",
      "title": "📱 日常ストーリーズ",
      "desc": "ファン化を促進し、問い合わせに直結させる毎日のアクティブな発信代行。"
    }
  ],
  "profile": {
    "img": "images/profile_img.png",
    "title": "Instagram運用スペシャリスト",
    "desc": "はじめまして！これまで50社以上のアカウントを支援してきたAIプランナーです✨<br><br>ただ「綺麗に魅せる」だけでなく、実際の集客や「売上」に繋がるアカウント作りを第一にご提案します！"
  },
  "reviews": {
    "img": "images/reviews_img.png",
    "title": "お客様からのお喜びの声",
    "desc": "おかげさまで多くの嬉しいお声をいただいております！",
    "items": [
      {
        "name": "A社様",
        "text": "「運用をお任せして1ヶ月で問い合わせが3倍に増えました！」"
      },
      {
        "name": "B店様",
        "text": "「丸投げできるので本業に集中できて大変助かっています」"
      },
      {
        "name": "C氏様",
        "text": "「デザインが綺麗になりブランディングに大成功しました！」"
      }
    ]
  },
  "pricing": {
    "img": "images/pricing_img.png",
    "title": "わかりやすい料金プラン",
    "plans": [
      {
        "name": "🌱 ベーシックプラン",
        "sub": "（フィード投稿作成＋リール週1本）",
        "price": "月額 〇〇,〇〇〇円〜",
        "highlight": false
      },
      {
        "name": "👑 まるなげプレミアムプラン",
        "sub": "（運用代行＋分析まで全て）",
        "price": "月額 〇〇,〇〇〇円〜",
        "highlight": true
      }
    ],
    "note": "※ご予算に合わせたカスタマイズももちろん可能です！お気軽にご相談ください。"
  },
  "contact": {
    "title": "お問い合わせ大歓迎です！",
    "desc": "以下のQRコード、またはメールボタンよりお気軽にご連絡ください😊",
    "qrImg": "images/qr_code.png",
    "qrLabel": "LINEで無料相談する",
    "qrSubLabel": "保存して友達追加",
    "email": "your_email@gmail.com"
  }
};
