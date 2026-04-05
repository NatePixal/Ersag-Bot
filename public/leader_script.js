// Initialize WebApp
const tg = window.Telegram?.WebApp;
const initData = tg?.initData || '';
if (tg) {
    tg.expand();
    tg.ready();
}

let activeTenantId = '';
let isRegistered = false;

// Helpers
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('opacity-0');
    setTimeout(() => toast.classList.add('opacity-0'), 2500);
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById('tab-' + tabId).classList.add('active');
    document.getElementById('nav-' + tabId).classList.add('active');
    
    // Auto-actions triggering
    if (tabId === 'dashboard' && isRegistered) fetchLeads();
    if (tabId === 'dashboard' && !isRegistered) {
        document.getElementById('dashboard-requires-onboard').classList.remove('hidden');
        document.getElementById('dashboard-content').classList.add('hidden');
    }
}

// Fetch Wrapped Setup
async function apiCall(endpoint, method = 'GET', body = null) {
    const headers = { 'Authorization': `tma ${initData}`, 'Content-Type': 'application/json' };
    if (activeTenantId) headers['x-tenant-id'] = activeTenantId;
    
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);
    
    const res = await fetch(`/api${endpoint}`, options);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

// Boot Sequence
async function boot() {
    try {
        const profile = await apiCall('/base/profile');
        
        document.getElementById('global-loader').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        
        if (profile.registered) {
            isRegistered = true;
            activeTenantId = profile.tenant_id;
            
            // Show Profile View
            document.getElementById('onboard-view').classList.add('hidden');
            document.getElementById('profile-view').classList.remove('hidden');
            
            // Populate logic
            document.getElementById('cfg-sponsor').textContent = profile.sponsor_id;
            document.getElementById('cfg-vip').textContent = profile.vip_group || 'Kiritilmagan';
            document.getElementById('cfg-phone').textContent = profile.phone || 'Kiritilmagan';
            document.getElementById('profile-status').className = "text-xs font-bold text-emerald-100 bg-emerald-700 px-2 py-0.5 rounded";
            document.getElementById('profile-status').textContent = "Ulangan";
            
            // Set Dashboard states
            document.getElementById('dashboard-requires-onboard').classList.add('hidden');
            document.getElementById('dashboard-content').classList.remove('hidden');
            
            // Default shift to Dashboard
            switchTab('dashboard');
        } else {
            // Show Onboard Form
            document.getElementById('onboard-view').classList.remove('hidden');
            document.getElementById('profile-status').textContent = "Ulanmagan";
            switchTab('settings');
        }
    } catch (err) {
        document.getElementById('global-loader').innerHTML = '<div class="text-red-500 font-bold p-5 text-center">Xatolik yuz berdi. Iltimos botga qaytib tushing.</div>';
        console.error(err);
    }
}

// Registration Submit
document.getElementById('onboard-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnText = document.getElementById('ob-btn-text');
    const spinner = document.getElementById('ob-spinner');
    const errorEl = document.getElementById('ob-error');
    
    errorEl.classList.add('hidden');
    btnText.textContent = "Iltimos kuting...";
    spinner.classList.remove('hidden');
    
    const payload = {
        leaderName: document.getElementById('ob-leader-name').value.trim(),
        botToken: document.getElementById('ob-bot-token').value.trim(),
        sponsorId: document.getElementById('ob-sponsor-id').value.trim(),
        leadGroupId: document.getElementById('ob-lead-group').value.trim(),
        vipGroup: document.getElementById('ob-vip-group').value.trim(),
        phone: document.getElementById('ob-phone').value.trim()
    };
    
    try {
        await apiCall('/base/onboard', 'POST', payload);
        showToast("Muvaffaqiyatli saqlandi! Sahifa yangilanmoqda...");
        setTimeout(() => location.reload(), 1500);
    } catch (err) {
        const errorText = JSON.parse(err.message).error || err.message;
        errorEl.textContent = errorText;
        errorEl.classList.remove('hidden');
        btnText.textContent = "Birlashtirish va Qidirish 🚀";
        spinner.classList.add('hidden');
    }
});

// Fetch Leads logic port over
async function fetchLeads() {
    const list = document.getElementById('leads-container');
    list.innerHTML = '<p class="text-center text-xs text-gray-400 py-6">Mijozlar yuklanmoqda...</p>';
    
    try {
        const data = await apiCall('/leader/leads');
        const leads = data.leads || [];
        
        if (leads.length === 0) {
            list.innerHTML = '<p class="text-center text-xs text-gray-400 py-6 p-4 rounded-xl border border-dashed border-gray-300">Yangi mijozlar mavjud emas</p>';
            return;
        }
        
        list.innerHTML = leads.map(l => `
            <div class="bg-white border text-left border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                <div class="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                    <span class="text-amber-600 text-lg">🔒</span>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="font-bold text-sm text-gray-800 truncate">${l.name}</p>
                    <p class="text-xs text-gray-400 font-mono">${l.phone}</p>
                </div>
                <span class="text-[9px] text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded-full border border-amber-200">Kutmoqda</span>
            </div>
        `).join('');
    } catch (e) {
        list.innerHTML = `<p class="text-center text-xs text-red-500 py-6">${e.message}</p>`;
    }
}

// Start sequence globally
boot();
