// ──────────── CONFIG ────────────
// Sponsor ID and registration URL are now DYNAMIC — fetched from the backend
// based on which leader the current user was referred by.
const CATALOG_API       = "https://us-central1-ersag-ai-bot.cloudfunctions.net/api/customer/catalog";
const LEADER_CONFIG_API = "https://us-central1-ersag-ai-bot.cloudfunctions.net/api/customer/context";
const PENDING_LEADS_API = "https://us-central1-ersag-ai-bot.cloudfunctions.net/api/leader/leads";
const DEFAULT_SPONSOR   = "5422685";

const urlParams   = new URLSearchParams(window.location.search);

// Mutable — overwritten by loadLeaderConfig() from backend
let SPONSOR_ID = DEFAULT_SPONSOR;
let REG_URL    = buildRegUrl(SPONSOR_ID);

function buildRegUrl(sid) {
    return 'https://www.ersagglobal.uz/account.asp?mod=myaccount&sub=edit&action=register&p=1&red=&sponsor=' + encodeURIComponent(sid);
}

// ──────────── SECURE TENANT FETCH ────────────
async function secureApiFetch(url) {
    const tg = window.Telegram?.WebApp;
    const initData = tg?.initData || '';
    const tenantId = urlParams.get('tenant') || ''; // Uses tenant UUID safely

    return fetch(url, {
        headers: {
            'Authorization': `tma ${initData}`,
            'x-tenant-id': tenantId
        }
    });
}

// ──────────── STATE ────────────
let currentLang    = 'uz';
let globalProducts = [];
let productsLoaded = false;
let activeFilter   = 'all'; // 'all' | exact category key

// ──────────── TRANSLATIONS ────────────
const T = {
    uz: {
        NAV_HOME: "Asosiy", NAV_SHOP: "Katalog", NAV_LEARN: "Darslar", NAV_JOIN: "A'zo",
        TOP_TAG: "Tabiiy Go'zallik",
        HERO_TITLE: "Tabiat bilan\nUyg'unlik.",
        HERO_SUB: "Sog'ligingiz va tabiatni asrash uchun eng sara organik mahsulotlar.",
        BTN_CATALOG: "Katalogni ko'rish",
        FEAT_ORGANIC: "100% Organik", FEAT_HALAL: "Halal Sertifikat", FEAT_DISCOUNT: "20% Chegirma",
        HOME_CARD1_TITLE: "Biznes Maktabi", HOME_CARD1_SUB: "Daromad topishni o'rganing",
        HOME_CARD2_TITLE: "A'zo Bo'lish",  HOME_CARD2_SUB: "20% chegirma olish uchun",
        SHOP_TITLE: "Katalog",
        ERR_LOAD: "Yuklab bo'lmadi. Qayta urinib ko'ring.", BTN_RETRY: "Qayta urinish",
        LESSONS_TITLE: "Biznes Maktabi", LESSONS_SUB: "Videoni ko'ring va jamoamizga qo'shiling 🌿",
        VID_1_TITLE: "Ersag kompaniyasi nima?", VID_2_TITLE: "Marketing rejasi va daromad",
        VID_CONFIRM: "Men videolarni ko'rib chiqdim va tayyorman ✅",
        READY_TITLE: "Daromad topishga tayyormisiz?",
        READY_SUB: "Rasmiy saytda ro'yxatdan o'ting va 20% chegirmani oling. Sponsor ID so'ralganda kiriting.",
        BTN_READY: "Men Tayyorman! Ro'yxatdan O'tish",
        REG_TITLE: "A'zo Bo'lish", REG_SUBTITLE: "Rasmiy saytda ro'yxatdan o'ting",
        SPONSOR_LABEL: "Sponsor ID Raqami", BTN_COPY: "Nusxa",
        SPONSOR_HINT: "Ro'yxatdan o'tishda «Homiy raqami» maydoniga yuqoridagi raqamni kiriting",
        STEP1_TITLE: "Saytga o'ting", STEP1_DESC: "ersagglobal.uz rasmiy saytini oching",
        STEP2_TITLE: "Ro'yxatdan o'ting", STEP2_DESC: "Shakl to'ldiring va sponsor ID ni kiriting:",
        STEP3_TITLE: "20% chegirma oling", STEP3_DESC: "Barcha mahsulotlarni 20% arzonroq xarid qiling!",
        BTN_GOTO_SITE: "Rasmiy Saytga O'tish", REG_FREE: "Ro'yxatdan o'tish mutlaqo bepul 🎉",
        MODAL_TAG: "Organik", MODAL_DESC_LABEL: "Tavsifi", MODAL_USAGE_LABEL: "Qo'llanilishi",
        BTN_BUY: "20% Chegirma bilan Sotib Olish",
        DISC_TITLE: "20% Chegirma Olish",
        DISC_DESC: "Rasmiy saytda a'zo bo'ling, barcha mahsulotlarni 20% arzonroq xarid qiling!",
        DISC_SPONSOR: "Sponsor ID:", DISC_YES: "Ha, Chegirma Olaman! 🚀", DISC_NO: "Keyinroq",
        TOAST_COPIED: "Nusxa olindi! ✓",
    },
    ru: {
        NAV_HOME: "Главная", NAV_SHOP: "Каталог", NAV_LEARN: "Уроки", NAV_JOIN: "Вступить",
        TOP_TAG: "Натуральная Красота",
        HERO_TITLE: "Гармония\nс Природой.",
        HERO_SUB: "Органические продукты для вашего здоровья и природы.",
        BTN_CATALOG: "Смотреть каталог",
        FEAT_ORGANIC: "100% Органик", FEAT_HALAL: "Халяль серт.", FEAT_DISCOUNT: "Скидка 20%",
        HOME_CARD1_TITLE: "Бизнес Школа", HOME_CARD1_SUB: "Узнайте как зарабатывать",
        HOME_CARD2_TITLE: "Вступить",     HOME_CARD2_SUB: "Получить скидку 20%",
        SHOP_TITLE: "Каталог",
        ERR_LOAD: "Не удалось загрузить. Попробуйте снова.", BTN_RETRY: "Повторить",
        LESSONS_TITLE: "Бизнес Школа", LESSONS_SUB: "Смотрите видео и присоединяйтесь к нам 🌿",
        VID_1_TITLE: "Что такое компания Ersag?", VID_2_TITLE: "Маркетинговый план и доход",
        VID_CONFIRM: "Я посмотрел видео и готов ✅",
        READY_TITLE: "Готовы начать зарабатывать?",
        READY_SUB: "Зарегистрируйтесь на официальном сайте и получите скидку 20%. Введите ID спонсора:",
        BTN_READY: "Я Готов! Регистрация",
        REG_TITLE: "Вступить", REG_SUBTITLE: "Зарегистрируйтесь на официальном сайте",
        SPONSOR_LABEL: "Номер Спонсора (ID)", BTN_COPY: "Копировать",
        SPONSOR_HINT: "При регистрации введите этот номер в поле «Номер спонсора»",
        STEP1_TITLE: "Перейти на сайт", STEP1_DESC: "Откройте официальный сайт ersagglobal.uz",
        STEP2_TITLE: "Зарегистрируйтесь", STEP2_DESC: "Заполните форму и введите ID спонсора:",
        STEP3_TITLE: "Получите скидку 20%", STEP3_DESC: "Покупайте все продукты на 20% дешевле!",
        BTN_GOTO_SITE: "Перейти на официальный сайт", REG_FREE: "Регистрация совершенно бесплатна 🎉",
        MODAL_TAG: "Органик", MODAL_DESC_LABEL: "Описание", MODAL_USAGE_LABEL: "Применение",
        BTN_BUY: "Купить со скидкой 20%",
        DISC_TITLE: "Получить скидку 20%",
        DISC_DESC: "Зарегистрируйтесь на официальном сайте и покупайте всё на 20% дешевле!",
        DISC_SPONSOR: "ID Спонсора:", DISC_YES: "Да, получить скидку! 🚀", DISC_NO: "Позже",
        TOAST_COPIED: "Скопировано! ✓",
    }
};

// ──────────── PAGE ROUTING ────────────
const pageNavMap = { home: 'nav-home', shop: 'nav-shop', lessons: 'nav-lessons', profile: 'nav-profile', dashboard: 'nav-dashboard' };

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('page-active'));
    const target = document.getElementById('page-' + pageId);
    if (target) target.classList.add('page-active');

    Object.entries(pageNavMap).forEach(([page, navId]) => {
        const btn = document.getElementById(navId);
        if (btn) {
            btn.classList.toggle('active', page === pageId);
            btn.classList.toggle('inactive', page !== pageId);
        }
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (pageId === 'shop' && !productsLoaded) loadProducts();
    if (pageId === 'dashboard') loadDashboard();
}

// ──────────── DASHBOARD / LEAD DAM ────────────
const ADMIN_SECRET_KEY  = ""; // Leave blank — set via URL ?secret= for security
const PAYNET_URL        = "https://paynet.uz/paying/link_YOUR_ID_HERE"; // ← replace
const CARD_NUM          = "8600 0000 0000 0000"; // ← replace

async function loadDashboard() {
    // Get admin_secret from URL param ?secret= for security
    const urlSecret = new URLSearchParams(window.location.search).get('secret') || ADMIN_SECRET_KEY;
    const container  = document.getElementById('leads-container');
    const noLeads    = document.getElementById('no-leads-state');
    const unlockSec  = document.getElementById('unlock-section');

    container.innerHTML = '<div class="text-center py-8 text-gray-400 text-sm">Yuklanmoqda...</div>';
    noLeads.classList.add('hidden');
    unlockSec.classList.add('hidden');

    // Set card and paynet link
    document.getElementById('card-display').textContent = CARD_NUM;
    document.getElementById('paynet-link').href = PAYNET_URL;

    if (!urlSecret) {
        container.innerHTML = '<div class="text-center py-8 text-xs text-gray-400">Dashboard uchun URL da ?secret=XXXX parametrini qo\'shing.</div>';
        return;
    }

    try {
        const res  = await secureApiFetch(
            PENDING_LEADS_API + '?leader_id=' + encodeURIComponent(SPONSOR_PARAM) +
            '&admin_secret=' + encodeURIComponent(urlSecret)
        );
        if (res.status === 403) {
            container.innerHTML = '<div class="text-center py-8 text-xs text-red-400">Ruxsat yo\'q. Secret noto\'g\'ri.</div>';
            return;
        }
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        const leads = data.leads || [];

        if (leads.length === 0) {
            container.innerHTML = '';
            noLeads.classList.remove('hidden');
            return;
        }

        unlockSec.classList.remove('hidden');

        container.innerHTML = '<div class="space-y-3">' +
            leads.map(function(lead) {
                return '<div class="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3">' +
                    '<div class="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">' +
                    '<span class="material-symbols-outlined text-amber-600" style="font-size:20px">lock</span>' +
                    '</div>' +
                    '<div class="flex-1 min-w-0">' +
                    '<p class="font-bold text-sm text-gray-800 truncate">' + escHtml(lead.name) + '</p>' +
                    '<p class="text-xs text-gray-400 font-mono">' + escHtml(lead.phone) + '</p>' +
                    '</div>' +
                    '<span class="text-[9px] text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded-full">QULFLANGAN</span>' +
                    '</div>';
            }).join('') + '</div>' +
            '<p class="text-center text-xs text-gray-400 mt-3">' + leads.length + ' ta mijoz kutmoqda</p>';

    } catch (e) {
        container.innerHTML = '<div class="text-center py-8 text-xs text-red-400">Xatolik: ' + e.message + '</div>';
    }
}

// ──────────── PAYMENT MODAL ────────────
function openPaymentModal() {
    document.getElementById('card-display').textContent = CARD_NUM;
    document.getElementById('paynet-link').href = PAYNET_URL;
    const overlay = document.getElementById('payment-overlay');
    const sheet   = document.getElementById('payment-sheet');
    overlay.classList.replace('closed', 'open');
    sheet.classList.replace('closed', 'open');
    document.body.style.overflow = 'hidden';
}

function closePaymentModal() {
    const overlay = document.getElementById('payment-overlay');
    const sheet   = document.getElementById('payment-sheet');
    sheet.classList.replace('open', 'closed');
    overlay.classList.replace('open', 'closed');
    document.body.style.overflow = '';
}

document.getElementById('payment-overlay').addEventListener('click', function(e) {
    if (e.target === this) closePaymentModal();
});

function copyCard() {
    navigator.clipboard.writeText(CARD_NUM)
        .then(() => showToast('Karta nusxa olindi ✓'))
        .catch(() => showToast('Karta: ' + CARD_NUM));
}

// ──────────── LANGUAGE ────────────
function switchLang(lang) {
    currentLang = lang;
    const t = T[lang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key] !== undefined) el.textContent = t[key];
    });
    // Update lang button styles
    document.getElementById('btn-uz').className = lang === 'uz'
        ? 'text-[10px] font-bold px-3 py-1 rounded-full border border-primary text-primary bg-transparent'
        : 'text-[10px] font-bold px-3 py-1 rounded-full border border-gray-300 text-gray-400 bg-transparent';
    document.getElementById('btn-ru').className = lang === 'ru'
        ? 'text-[10px] font-bold px-3 py-1 rounded-full border border-primary text-primary bg-transparent'
        : 'text-[10px] font-bold px-3 py-1 rounded-full border border-gray-300 text-gray-400 bg-transparent';

    // Re-inject live sponsor ID into any fields that contain it
    updateSponsorDom(SPONSOR_ID);

    // Re-render product sections in the new language (names, desc, section headers)
    if (productsLoaded) renderProducts();
}

// ──────────── FILTER ────────────
function setFilter(cat) {
    activeFilter = cat;

    // Update button active styles
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active-filter');
    });
    // Map filter value to button id
    const idMap = {
        'all':         'filter-all',
        'Sog\u2019liq':    'filter-health',
        'Go\u2019zallik':   'filter-beauty',
        'Uy tozalash': 'filter-cleaning'
    };
    const targetId = idMap[cat];
    if (targetId) document.getElementById(targetId).classList.add('active-filter');

    if (productsLoaded) renderProducts();
}

// ──────────── CATALOG ────────────
const CAT_CONFIG = [
    {
        key:   "Sog\u2019liq",   // Matches sheet value: Sog'liq
        uz:    "Sog\u02BBliq \uD83D\uDC8A",    // Sog'liq 💊
        ru:    "\u0417\u0434\u043E\u0440\u043E\u0432\u044C\u0435 \uD83D\uDC8A",  // Здоровье 💊
        emoji: "💊"
    },
    {
        key:   "Go\u2019zallik",  // Matches sheet value: Go'zallik
        uz:    "Go\u02BBallik \uD83C\uDF38",    // Go'zallik 🌸
        ru:    "\u041A\u0440\u0430\u0441\u043E\u0442\u0430 \uD83C\uDF38",         // Красота 🌸
        emoji: "🌸"
    },
    {
        key:   "Uy tozalash",
        uz:    "Uy tozalash \uD83C\uDFE0",      // Uy tozalash 🏠
        ru:    "\u0423\u0431\u043E\u0440\u043A\u0430 \uD83C\uDFE0",               // Уборка 🏠
        emoji: "🏠"
    }
];

function cleanCatStr(str) {
    return (str || '').trim().replace(/['\u2018\u2019\u02BB\u0060\u00B4\s]/g, '').toLowerCase();
}

// ──────────── MULTI-TENANT LEADER CONFIG ────────────
async function loadLeaderConfig() {
    try {
        // Fetch dynamic context from the backend based on this user's assigned leader
        const res = await secureApiFetch(LEADER_CONFIG_API);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const cfg = await res.json();
        if (cfg && cfg.sponsor_id) {
            SPONSOR_ID = cfg.sponsor_id;
            REG_URL    = cfg.ersag_registration_link || buildRegUrl(SPONSOR_ID);
            updateSponsorDom(SPONSOR_ID);
        }
    } catch (e) {
        console.warn('loadLeaderConfig failed, using default sponsor:', e.message);
    }
}

function updateSponsorDom(sid) {
    var el1 = document.getElementById('profile-sponsor-id');
    if (el1) el1.textContent = sid;

    var el2 = document.getElementById('step2-sponsor-id');
    if (el2) el2.textContent = sid;

    var el3 = document.getElementById('disc-modal-sponsor-id');
    if (el3) el3.textContent = sid;

    var readySub = document.querySelector('[data-i18n="READY_SUB"]');
    if (readySub) {
        var isRu = currentLang === 'ru';
        readySub.textContent = isRu
            ? 'Зарегистрируйтесь на официальном сайте и получите скидку 20%. Введите ID спонсора: ' + sid + '.'
            : 'Rasmiy saytda ro\u2019yxatdan o\u2019ting va 20% chegirmani oling. Sponsor ID so\u2019ralganda ' + sid + ' kiriting.';
    }
}

// ──────────── CATALOG ────────────
function getField(p, field, fallbackField) {
    var v = p[field];
    if (v && v.trim()) return v;
    if (fallbackField) {
        var f = p[fallbackField];
        if (f && f.trim()) return f;
    }
    return '';
}

async function loadProducts() {
    const grid    = document.getElementById('product-grid');
    const errorEl = document.getElementById('load-error');
    productsLoaded = false;

    grid.innerHTML = [
        '<div class="grid grid-cols-2 gap-3">',
        Array(4).fill('<div class="skeleton h-56"></div>').join(''),
        '</div>'
    ].join('');
    errorEl.classList.add('hidden');

    try {
        const res = await secureApiFetch(CATALOG_API);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error('Bad format');

        globalProducts = data;
        productsLoaded = true;
        renderProducts();

    } catch (e) {
        console.error('Catalog load error:', e);
        grid.innerHTML = '';
        errorEl.classList.remove('hidden');
    }
}

function renderProducts() {
    const grid    = document.getElementById('product-grid');
    const countEl = document.getElementById('product-count');
    const isRu    = currentLang === 'ru';

    if (globalProducts.length === 0) {
        grid.innerHTML = '<p class="text-center text-gray-400 text-sm py-10">'
            + (isRu ? '\u041a\u0430\u0442\u0430\u043b\u043e\u0433 \u043f\u0443\u0441\u0442' : 'Katalog bo\u02BBsh') + '</p>';
        if (countEl) countEl.textContent = '';
        return;
    }

    function cardName(p) {
        return escHtml(isRu
            ? getField(p, 'name_ru', 'name_uz') || getField(p, 'name_uz', '') || 'Nomsiz'
            : getField(p, 'name_uz', 'name_ru') || getField(p, 'name_ru', '') || 'Nomsiz');
    }

    if (activeFilter !== 'all') {
        const filtered = globalProducts.filter(function(p) {
            return cleanCatStr(p.category) === cleanCatStr(activeFilter);
        });

        if (countEl) countEl.textContent = filtered.length + (isRu ? ' \u0442\u043e\u0432\u0430\u0440\u043e\u0432' : ' ta mahsulot');

        if (filtered.length === 0) {
            grid.innerHTML = '<p class="text-center text-gray-400 text-sm py-10">'
                + (isRu ? '\u0422\u043e\u0432\u0430\u0440\u044b \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u044b' : 'Mahsulot topilmadi') + '</p>';
            return;
        }

        grid.innerHTML = '<div class="grid grid-cols-2 gap-3">'
            + filtered.map(function(p) {
                const idx   = globalProducts.indexOf(p);
                const name  = cardName(p);
                const img   = escHtml(p.image || 'https://placehold.co/400x400/e8f0e8/004902?text=ERSAG');
                const price = escHtml(p.price || '0');
                return '<div onclick="openModal(' + idx + ')" class="product-card bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 cursor-pointer flex flex-col">'
                    + '<div class="aspect-square bg-gray-50 overflow-hidden">'
                    + '<img src="' + img + '" alt="' + name + '" class="w-full h-full object-cover" loading="lazy"'
                    + ' onerror="this.src=\'https://placehold.co/400x400/e8f0e8/004902?text=ERSAG\'">'
                    + '</div>'
                    + '<div class="p-3 flex-1 flex flex-col justify-between">'
                    + '<h4 class="font-bold text-[11px] text-gray-800 line-clamp-2 leading-tight">' + name + '</h4>'
                    + '<p class="text-primary font-extrabold text-xs mt-1">' + price + ' UZS</p>'
                    + '</div></div>';
            }).join('')
            + '</div>';
        return;
    }

    if (countEl) countEl.textContent = globalProducts.length + (isRu ? ' \u0442\u043e\u0432\u0430\u0440\u043e\u0432' : ' ta mahsulot');

    let html = '';

    CAT_CONFIG.forEach(function(cat) {
        const products = globalProducts.filter(function(p) {
            return cleanCatStr(p.category) === cleanCatStr(cat.key);
        });

        if (products.length === 0) return;

        const header = isRu ? cat.ru : cat.uz;

        html += '<div class="mt-6 mb-3 flex items-center gap-3">'
              +   '<h4 class="text-base font-extrabold text-primary font-headline whitespace-nowrap">' + escHtml(header) + '</h4>'
              +   '<div class="h-px bg-gray-200 flex-1"></div>'
              + '</div>'
              + '<div class="grid grid-cols-2 gap-3">';

        products.forEach(function(p) {
            const idx   = globalProducts.indexOf(p);
            const name  = cardName(p);
            const img   = escHtml(p.image || 'https://placehold.co/400x400/e8f0e8/004902?text=ERSAG');
            const price = escHtml(p.price || '0');

            html += '<div onclick="openModal(' + idx + ')" class="product-card bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 cursor-pointer flex flex-col">'
                  +   '<div class="aspect-square bg-gray-50 overflow-hidden">'
                  +     '<img src="' + img + '" alt="' + name + '" class="w-full h-full object-cover" loading="lazy"'
                  +       ' onerror="this.src=\'https://placehold.co/400x400/e8f0e8/004902?text=ERSAG\'">'
                  +   '</div>'
                  +   '<div class="p-3 flex-1 flex flex-col justify-between">'
                  +     '<h4 class="font-bold text-[11px] text-gray-800 line-clamp-2 leading-tight">' + name + '</h4>'
                  +     '<p class="text-primary font-extrabold text-xs mt-1">' + price + ' UZS</p>'
                  +   '</div>'
                  + '</div>';
        });

        html += '</div>';
    });

    const knownKeys = CAT_CONFIG.map(function(c) { return cleanCatStr(c.key); });
    const other = globalProducts.filter(function(p) {
        return !knownKeys.includes(cleanCatStr(p.category));
    });

    if (other.length > 0) {
        const otherHeader = isRu ? 'Другое' : 'Boshqa';
        html += '<div class="mt-6 mb-3 flex items-center gap-3">'
              +   '<h4 class="text-base font-extrabold text-primary font-headline">' + escHtml(otherHeader) + '</h4>'
              +   '<div class="h-px bg-gray-200 flex-1"></div>'
              + '</div>'
              + '<div class="grid grid-cols-2 gap-3">';

        other.forEach(function(p) {
            const idx   = globalProducts.indexOf(p);
            const name  = cardName(p);
            const img   = escHtml(p.image || 'https://placehold.co/400x400/e8f0e8/004902?text=ERSAG');
            const price = escHtml(p.price || '0');

            html += '<div onclick="openModal(' + idx + ')" class="product-card bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 cursor-pointer flex flex-col">'
                  +   '<div class="aspect-square bg-gray-50 overflow-hidden">'
                  +     '<img src="' + img + '" alt="' + name + '" class="w-full h-full object-cover" loading="lazy"'
                  +       ' onerror="this.src=\'https://placehold.co/400x400/e8f0e8/004902?text=ERSAG\'">'
                  +   '</div>'
                  +   '<div class="p-3 flex-1 flex flex-col justify-between">'
                  +     '<h4 class="font-bold text-[11px] text-gray-800 line-clamp-2 leading-tight">' + name + '</h4>'
                  +     '<p class="text-primary font-extrabold text-xs mt-1">' + price + ' UZS</p>'
                  +   '</div>'
                  + '</div>';
        });

        html += '</div>';
    }

    grid.innerHTML = html;
}

function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ──────────── PRODUCT MODAL ────────────
function openModal(index) {
    const p    = globalProducts[index];
    const isRu = currentLang === 'ru';

    const name  = isRu
        ? (getField(p, 'name_ru', 'name_uz') || 'Nomsiz')
        : (getField(p, 'name_uz', 'name_ru') || 'Nomsiz');
    const desc  = isRu
        ? (getField(p, 'desc_ru', 'desc_uz') || '')
        : (getField(p, 'desc_uz', 'desc_ru') || '');
    const usage = isRu
        ? (getField(p, 'usage_ru', 'usage_uz') || '')
        : (getField(p, 'usage_uz', 'usage_ru') || '');

    document.getElementById('modal-title').textContent = name;
    document.getElementById('modal-code').textContent  = p.code ? 'Kod: ' + p.code : '';
    document.getElementById('modal-img').src           = p.image || 'https://placehold.co/400x400/e8f0e8/004902?text=ERSAG';
    document.getElementById('modal-price').textContent = (p.price || '0') + ' UZS';
    document.getElementById('modal-desc').textContent  = desc;

    const usageEl   = document.getElementById('modal-usage');
    const usageWrap = document.getElementById('modal-usage-wrap');
    if (usage) {
        usageEl.textContent = usage;
        usageWrap.classList.remove('hidden');
    } else {
        usageWrap.classList.add('hidden');
    }

    const overlay = document.getElementById('modal-overlay');
    const sheet   = document.getElementById('modal-sheet');
    overlay.classList.replace('closed', 'open');
    sheet.classList.replace('closed', 'open');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    const sheet   = document.getElementById('modal-sheet');
    sheet.classList.replace('open', 'closed');
    overlay.classList.replace('open', 'closed');
    document.body.style.overflow = '';
}

document.getElementById('modal-overlay').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
});

// ──────────── BUY FLOW ────────────
function onBuyClick() {
    closeModal();
    setTimeout(() => openDiscountModal(), 300);
}

function openDiscountModal() {
    const overlay = document.getElementById('discount-overlay');
    const sheet   = document.getElementById('discount-sheet');
    overlay.classList.replace('closed', 'open');
    sheet.classList.replace('closed', 'open');
    document.body.style.overflow = 'hidden';
}

function closeDiscountModal() {
    const overlay = document.getElementById('discount-overlay');
    const sheet   = document.getElementById('discount-sheet');
    sheet.classList.replace('open', 'closed');
    overlay.classList.replace('open', 'closed');
    document.body.style.overflow = '';
}

document.getElementById('discount-overlay').addEventListener('click', function(e) {
    if (e.target === this) closeDiscountModal();
});

// ──────────── REGISTRATION ────────────
function goToRegistration() {
    navigator.clipboard.writeText(SPONSOR_ID).catch(() => {});
    window.open(REG_URL, '_blank');
}

function copySponsorId() {
    navigator.clipboard.writeText(SPONSOR_ID)
        .then(() => showToast(T[currentLang].TOAST_COPIED))
        .catch(() => showToast(T[currentLang].TOAST_COPIED));
}

// ──────────── LESSONS ────────────
let videosWatched = { 1: false, 2: false };

function markVideo(num) {
    videosWatched[num] = true;
}

function handleWatchedChange() {
    const checked = document.getElementById('watched-check').checked;
    const readyBlock = document.getElementById('ready-block');
    if (checked) {
        readyBlock.classList.add('visible');
        setTimeout(() => readyBlock.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
    } else {
        readyBlock.classList.remove('visible');
    }
}

// ──────────── TOAST ────────────
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

// ──────────── INIT ────────────
window.addEventListener('DOMContentLoaded', async () => {
    switchLang('uz');
    await loadLeaderConfig();
});
