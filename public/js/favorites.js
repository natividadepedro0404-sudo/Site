// Gerenciamento de favoritos
function getFavorites() {
    try {
        return JSON.parse(localStorage.getItem('hypex_favorites') || '[]');
    } catch (e) {
        return [];
    }
}

function saveFavorites(favorites) {
    localStorage.setItem('hypex_favorites', JSON.stringify(favorites));
    renderFavorites();
}

function toggleFavorite(product) {
    const favorites = getFavorites();
    const index = favorites.findIndex(f => f.id === product.id);
    
    if (index > -1) {
        favorites.splice(index, 1);
    } else {
        favorites.push(product);
    }
    
    saveFavorites(favorites);
}

async function renderFavorites() {
    const list = document.getElementById('favorites-list');
    if (!list) return; // Não estamos na página de favoritos
    
    const favorites = getFavorites();
    list.innerHTML = '';
    
    if (!favorites.length) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="far fa-heart"></i>
                <h3>Nenhum favorito ainda</h3>
                <p>Explore nossos produtos e adicione seus favoritos aqui!</p>
                <a href="/" class="cta-button">Ver Produtos</a>
            </div>
        `;
        return;
    }
    
    favorites.forEach(product => {
        const card = document.createElement('article');
        card.className = 'product-card';
        
        const hasDiscount = product.original_price > product.price;
        const discount = hasDiscount ? Math.round((1 - product.price / product.original_price) * 100) : 0;
        
        card.innerHTML = `
            <div class="product-image">
                <img src="${product.images?.[0] || 'https://via.placeholder.com/300x400?text=HYPEX'}" alt="${product.name}">
                ${hasDiscount ? `<span class="discount-badge">-${discount}%</span>` : ''}
                <div class="quick-actions">
                    <button class="action-btn favorite active" onclick="toggleFavorite(${JSON.stringify(product)})">
                        <i class="fas fa-heart"></i>
                    </button>
                    <button class="action-btn add-cart" onclick="addItemToCart(${JSON.stringify(product)})">
                        <i class="fas fa-shopping-cart"></i>
                    </button>
                </div>
            </div>
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <div class="price-info">
                    ${hasDiscount ? `<span class="original-price">R$ ${Number(product.original_price).toFixed(2)}</span>` : ''}
                    <span class="current-price">R$ ${Number(product.price).toFixed(2)}</span>
                </div>
            </div>
        `;
        
        list.appendChild(card);
    });
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    renderFavorites();
});