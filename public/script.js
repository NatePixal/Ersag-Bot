// --- ADD THIS TO YOUR EXISTING SCRIPT.JS ---

const searchInput = document.getElementById('searchInput');

if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        const grid = document.getElementById('product-grid');
        const isRu = currentLang === 'ru';

        if (!term) {
            renderProducts(); // Go back to category view
            return;
        }

        const filtered = globalProducts.filter(p => {
            const nUz = (p.name_uz || '').toLowerCase();
            const nRu = (p.name_ru || '').toLowerCase();
            return nUz.includes(term) || nRu.includes(term);
        });

        if (filtered.length === 0) {
            grid.innerHTML = `<p class="text-center text-gray-400 py-10">${isRu ? 'Ничего не найдено' : 'Hech narsa topilmadi'}</p>`;
            return;
        }

        // Render flat grid for search results
        grid.innerHTML = '<div class="grid grid-cols-2 gap-3">' + 
            filtered.map(p => {
                const idx = globalProducts.indexOf(p);
                const name = isRu ? (p.name_ru || p.name_uz) : (p.name_uz || p.name_ru);
                return `<div onclick="openModal(${idx})" class="product-card bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 cursor-pointer flex flex-col">
                    <div class="aspect-square bg-gray-50 overflow-hidden">
                        <img src="${p.image || 'https://placehold.co/400'}" class="w-full h-full object-cover">
                    </div>
                    <div class="p-3">
                        <h4 class="font-bold text-[11px] text-gray-800 line-clamp-2">${name}</h4>
                        <p class="text-primary font-extrabold text-xs mt-1">${p.price} UZS</p>
                    </div>
                </div>`;
            }).join('') + '</div>';
    });
}