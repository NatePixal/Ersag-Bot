// Initialize WebApp
const tg = window.Telegram?.WebApp;
const initData = tg?.initData || '';
if (tg) { tg.expand(); tg.ready(); }

let activeTenantId = '';
let isRegistered = false;

// ─── Helpers ───
function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.style.background = type === 'error' ? '#ef4444' : '#004902';
    toast.classList.remove('opacity-0');
    setTimeout(() => toast.classList.add('opacity-0'), 2800);
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.add('active');
    document.getElementById('nav-' + tabId).classList.add('active');
    if (tabId === 'dashboard' && isRegistered) { fetchAnalytics(); fetchLeads(); }
    if (tabId === 'dashboard' && !isRegistered) {
        document.getElementById('dashboard-requires-onboard').classList.remove('hidden');
        document.getElementById('dashboard-content').classList.add('hidden');
    }
}

// ─── API Wrapper ───
const BASE = 'https://us-central1-ersag-ai-bot.cloudfunctions.net/api';

async function apiCall(endpoint, method = 'GET', body = null) {
    const headers = { 'Authorization': `tma ${initData}`, 'Content-Type': 'application/json' };
    if (activeTenantId) headers['x-tenant-id'] = activeTenantId;
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(`${BASE}${endpoint}`, options);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

// ─── Boot ───
async function boot() {
    try {
        const profile = await apiCall('/base/profile');
        document.getElementById('global-loader').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');

        if (profile.registered) {
            isRegistered = true;
            activeTenantId = profile.tenant_id;
            document.getElementById('onboard-view').classList.add('hidden');
            document.getElementById('profile-view').classList.remove('hidden');
            document.getElementById('cfg-sponsor').textContent = profile.sponsor_id || '—';
            document.getElementById('cfg-vip').textContent = profile.vip_group || 'Kiritilmagan';
            document.getElementById('cfg-phone').textContent = profile.phone || 'Kiritilmagan';
            document.getElementById('profile-status').textContent = 'Ulangan';
            document.getElementById('dashboard-requires-onboard').classList.add('hidden');
            document.getElementById('dashboard-content').classList.remove('hidden');

            // Populate my link
            const myLink = `https://t.me/${profile.bot_username || 'ErsagAiBot'}?start=${profile.tenant_id}`;
            const linkEl = document.getElementById('my-bot-link');
            if (linkEl) linkEl.textContent = myLink;

            switchTab('dashboard');
        } else {
            document.getElementById('onboard-view').classList.remove('hidden');
            document.getElementById('profile-status').textContent = 'Ulanmagan';
            switchTab('settings');
        }
    } catch (err) {
        document.getElementById('global-loader').innerHTML =
            '<div class="text-red-500 font-bold p-5 text-center">Xatolik. Botga qaytib tushing.</div>';
        console.error(err);
    }
}

// ─── Analytics ───
async function fetchAnalytics() {
    try {
        const data = await apiCall('/leader/analytics');
        setText('stat-total-leads', data.total_leads ?? 0);
        setText('stat-leads-today', data.leads_today ?? 0);
        setText('stat-total-users', data.total_users ?? 0);
        const sub = data.subscription_status;
        const subEl = document.getElementById('stat-subscription');
        if (subEl) {
            subEl.textContent = sub === 'active' ? '✅ Faol' : sub === 'grace' ? '⚠️ Tugayapti' : '❌ Tugagan';
            subEl.className = sub === 'active' ? 'text-emerald-600 font-bold' :
                              sub === 'grace'  ? 'text-amber-500 font-bold' : 'text-red-500 font-bold';
        }
    } catch (e) { console.warn('Analytics failed:', e.message); }
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

// ─── Copy my link ───
function copyMyLink() {
    const txt = document.getElementById('my-bot-link')?.textContent || '';
    navigator.clipboard.writeText(txt).then(() => showToast('Havola nusxalandi! 📋'));
}

// ─── Leads ───
const STATUS_LABELS = {
    new: { label: 'Yangi', color: 'bg-blue-100 text-blue-700' },
    contacted: { label: 'Bog\'lashildi', color: 'bg-yellow-100 text-yellow-700' },
    registered: { label: "Ro'yxatdan o'tdi", color: 'bg-purple-100 text-purple-700' },
    converted: { label: 'Sotildi ✅', color: 'bg-emerald-100 text-emerald-700' },
    inactive: { label: 'Faol emas', color: 'bg-gray-100 text-gray-500' },
    pending: { label: 'Kutmoqda 🔒', color: 'bg-amber-100 text-amber-700' },
    delivered: { label: 'Yetkazildi', color: 'bg-sky-100 text-sky-700' },
};

async function fetchLeads() {
    const list = document.getElementById('leads-container');
    list.innerHTML = '<p class="text-center text-xs text-gray-400 py-6">Yuklanmoqda...</p>';
    try {
        const data = await apiCall('/leader/leads');
        const leads = data.leads || [];
        if (leads.length === 0) {
            list.innerHTML = '<p class="text-center text-xs text-gray-400 py-8 border border-dashed rounded-2xl">Hali mijozlar yo\'q</p>';
            return;
        }
        list.innerHTML = leads.map(l => {
            const s = STATUS_LABELS[l.status] || STATUS_LABELS.new;
            const date = l.created_at ? new Date(l.created_at).toLocaleDateString('uz-UZ') : '';
            return `
            <div class="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                <div class="flex items-center gap-3 mb-2">
                    <div class="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                        <span class="text-emerald-700 font-bold text-base">${(l.name||'?')[0]}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="font-bold text-sm text-gray-800 truncate">${l.name || '—'}</p>
                        <p class="text-xs text-gray-400">${l.phone || '—'} &bull; ${date}</p>
                    </div>
                    <span class="text-[9px] font-bold px-2 py-1 rounded-full ${s.color}">${s.label}</span>
                </div>
                ${l.interest ? `<p class="text-xs text-gray-500 mb-1">❤️ ${l.interest}</p>` : ''}
                <div class="flex flex-wrap gap-1 mt-2">
                    ${['contacted','converted','inactive'].map(st => `
                        <button onclick="updateLeadStatus('${l.id}','${st}')"
                            class="text-[9px] px-2 py-1 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100">
                            ${STATUS_LABELS[st].label}
                        </button>`).join('')}
                </div>
            </div>`;
        }).join('');
    } catch (e) {
        list.innerHTML = `<p class="text-center text-xs text-red-500 py-6">${e.message}</p>`;
    }
}

async function updateLeadStatus(leadId, status) {
    try {
        await apiCall(`/leader/leads/${leadId}/status`, 'PATCH', { status });
        showToast('Status yangilandi ✅');
        fetchLeads();
    } catch (e) { showToast('Xatolik: ' + e.message, 'error'); }
}

// ─── Onboarding ───
document.getElementById('onboard-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnText = document.getElementById('ob-btn-text');
    const spinner = document.getElementById('ob-spinner');
    const errorEl = document.getElementById('ob-error');
    errorEl.classList.add('hidden');
    btnText.textContent = 'Iltimos kuting...';
    spinner.classList.remove('hidden');

    const payload = {
        leaderName:  document.getElementById('ob-leader-name').value.trim(),
        botToken:    document.getElementById('ob-bot-token').value.trim(),
        botType:     document.getElementById('ob-bot-type').value,
        sponsorId:   document.getElementById('ob-sponsor-id').value.trim(),
        leadGroupId: document.getElementById('ob-lead-group').value.trim(),
        vipGroup:    document.getElementById('ob-vip-group').value.trim(),
        phone:       document.getElementById('ob-phone').value.trim()
    };

    try {
        await apiCall('/base/onboard', 'POST', payload);
        showToast('Muvaffaqiyatli saqlandi! Sahifa yangilanmoqda...');
        setTimeout(() => location.reload(), 1500);
    } catch (err) {
        let msg = err.message;
        try { msg = JSON.parse(msg).error || msg; } catch (_) {}
        errorEl.textContent = msg;
        errorEl.classList.remove('hidden');
        btnText.textContent = 'Birlashtirish va Qidirish 🚀';
        spinner.classList.add('hidden');
    }
});

boot();

