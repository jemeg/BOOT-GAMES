# 🎭 بوت مافيا / القاتل - Mafia Killer Discord Bot

بوت ديسكورد كامل للعبة **مافيا / القاتل** مبني باستخدام **Node.js** و **Discord.js v14**.
**واجهة عربية بالكامل** (Embeds · DMs · رسائل النجاح/الخطأ · أسماء الأدوار).

---

## ✨ المميزات

* 🎮 ألعاب متعددة في نفس الوقت (دعم عدة قنوات)
* 🕵️ 4 أدوار: **القاتل** · **الطبيب** · **المحقق** · **مواطن**
* 📩 إرسال الأدوار سرّياً عبر **DM**
* 🌙 مرحلة ليلية مع Select Menus
* ☀️ مرحلة نهارية للنقاش
* 🗳️ مرحلة تصويت علنية
* 🏆 شروط فوز كاملة + كشف الأدوار في النهاية
* 🔁 زر **العب مجدداً** لإعادة اللعب
* 🤖 نظام بوتات اختياري للعب الفردي / الاختبار
* 🛡️ معالجة كاملة للأخطاء (DM مغلق، تايم اوت، صلاحيات، ...)

---

## 📁 هيكل المشروع

```
BOOT-GAMES/
├── data/
│   ├── config.js          # إعدادات اللعبة الافتراضية
│   └── index.js           # طبقة البيانات
├── src/
│   ├── commands/          # أوامر سلاش كوماند
│   │   ├── createGame.js
│   │   ├── joinGame.js
│   │   ├── leaveGame.js
│   │   └── startGame.js
│   ├── events/            # أحداث ديسكورد
│   │   ├── interactionCreate.js
│   │   └── ready.js
│   ├── managers/          # كلاسات المنطق
│   │   ├── GameManager.js
│   │   ├── NightManager.js
│   │   ├── RoleManager.js
│   │   └── VoteManager.js
│   ├── models/            # نماذج البيانات
│   │   ├── GameSession.js
│   │   └── Player.js
│   ├── utils/             # أدوات مساعدة
│   │   ├── constants.js
│   │   ├── embeds.js
│   │   └── helpers.js
│   ├── config.js
│   └── index.js
├── .env.example
├── .gitignore
└── package.json
```

---

## 🚀 خطوات التشغيل

### 1) إنشاء بوت على Discord Developer Portal

1. اذهب إلى [Discord Developer Portal](https://discord.com/developers/applications).
2. أنشئ **New Application** → اختر اسم.
3. اذهب إلى **Bot** → اضغط **Add Bot** → انسخ الـ **TOKEN**.
4. في نفس الصفحة فعّل **MESSAGE CONTENT INTENT** (اختياري).
5. اذهب إلى **OAuth2 → URL Generator**:
   * Scopes: `bot`, `applications.commands`
   * Bot Permissions: `Send Messages`, `Embed Links`, `Use Slash Commands`, `Read Message History`
6. انسخ الـ **CLIENT_ID** من صفحة **General Information**.

### 2) تثبيت Node.js

تأكد من وجود **Node.js 18+**:

```bash
node --version
```

### 3) تثبيت الحزم

```bash
cd BOOT-GAMES
npm install
```

### 4) إعداد ملف البيئة

انسخ `.env.example` إلى `.env` واملأ القيم:

```env
TOKEN=YOUR_BOT_TOKEN_HERE
CLIENT_ID=YOUR_CLIENT_ID_HERE
GUILD_ID=                # اختياري - لتسجيل أوامر فوري داخل سيرفر معين
```

### 5) تشغيل البوت

```bash
npm start
```

ستظهر في الـ console رسالة تأكيد أن البوت جاهز، وسيتم تسجيل الأوامر تلقائياً.

---

## 🎯 الأوامر

| الأمر | الوصف |
|-------|-------|
| `/create-game` | إنشاء غرفة جديدة (مع `room_name` و `max_players`) |
| `/join` | الانضمام للغرفة |
| `/leave` | مغادرة الغرفة (قبل البدء فقط) |
| `/start` | بدء اللعبة (4 لاعبين على الأقل) |
| `/add-bots` | إضافة بوتات (لعب solo للاختبار) — اختياري |
| `/remove-bots` | إزالة كل البوتات من اللوبي — اختياري |

أزرار إضافية على رسالة الإنشاء:
* **Join** / **Leave** / **Start**

---

## 🤖 نظام البوتات (للعب الفردي / الاختبار)

ميزة اختيارية تتيح لك **لعب اللعبة وحدك** بملء اللوبي بلاعبين وهميين.

### الاستخدام

```bash
# إنشاء اللعبة
/create-game room_name:Test max_players:6

# إضافة 3 بوتات (الحد الأدنى للبدء = 4)
/add-bots count:3

# ابدأ
/start
```

البوتات سيظهرون في الـ embed بعلامة 🤖 وسيشاركون تلقائياً:
* يتلقون قراراتهم الليلية (قتل/حماية/تحقيق) بشكل عشوائي مع تأخير عشوائي يحاكي التفكير البشري
* يصوّتون عشوائياً في مرحلة التصويت
* يظهر كل قرارهم في الـ console بصيغة `🤖 [Bot X/Role] → Target`

### الإعدادات

في `data/config.js`:

```js
BOTS: {
  ENABLED: true,           // ← غيّره إلى false لتعطيل
  SKIP_CHANCE: 0.3,        // 30% فرصة تخطي الإجراء الليلي
  NIGHT_MIN_DELAY_MS: 1500,
  NIGHT_MAX_DELAY_MS: 5500,
  VOTE_MIN_DELAY_MS: 600,
  VOTE_MAX_DELAY_MS: 2800
}
```

### إزالة الميزة بالكامل

النظام **قابل للإزالة بالكامل** بدون لمس منطق اللعبة الأساسي. لحذفه:

1. احذف `src/managers/BotManager.js`
2. احذف `src/commands/addBots.js`
3. احذف `src/commands/removeBots.js`
4. احذف السطر `client.botManager = new BotManager();` من `src/index.js`

كل نقاط التكامل في `NightManager` و `VoteManager` تستخدم `if (client.botManager && client.botManager.isEnabled())` فإذا حذفت الملفات ستُعطَّل تلقائياً.

---

## 📜 قواعد اللعبة

| عدد اللاعبين | Killer | Doctor | Detective | Citizen |
|--------------|:------:|:------:|:---------:|:-------:|
| 4            | 1      | 1      | 1         | 1       |
| 5–6          | 1      | 1      | 1         | الباقي  |
| 7–10         | 2      | 1      | 1         | الباقي  |

### مراحل اللعبة

1. **🌙 Night (60s)** — القاتل، الطبيب، والمحقق يتصرفون عبر DM
2. **☀️ Day (120s)** — نقاش عام
3. **🗳️ Voting (60s)** — تصويت علني
4. تكرار حتى فوز فريق

### شروط الفوز

* **Citizens Win** ← موت جميع الـ Killers
* **Killers Win** ← عدد الـ Killers الأحياء ≥ عدد باقي اللاعبين

---

## 🛠️ المتطلبات التقنية

* Node.js 18+
* Discord.js v14
* صلاحيات البوت في السيرفر: Send Messages, Embed Links, Use Slash Commands, Read Message History

---

## 🐛 معالجة الأخطاء

البوت يتعامل تلقائياً مع:
* ❌ DM مغلق (يستمر بدون إشعار للاعب)
* ⏱️ انتهاء الوقت في أي مرحلة
* 🚫 محاولة لاعب ميت التصويت أو استخدام قدرة
* 🚫 محاولة بدء اللعبة مرتين
* 🚫 الانضمام / المغادرة بعد البدء
* 🚫 إنشاء غرف مكررة في نفس القناة

---

## 📝 ملاحظات

* البيانات تُخزن في **الذاكرة** — عند إعادة تشغيل البوت، تنتهي جميع الألعاب.
* `data/index.js` و `data/config.js` جاهزان كطبقة بيانات قابلة للترقية لقاعدة بيانات حقيقية مستقبلاً.
