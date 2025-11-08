// Variáveis globais
let currentCategory = '';
let currentPage = 1;
let totalPages = 1;
let currentFilters = {
    sort: 'newest',
    priceRange: 'all',
    sizes: [],
    colors: []
};

// Função para inicializar a página
async function initCategoryPage() {
    // Pegar o tipo de categoria da URL
    const urlParams = new URLSearchParams(window.location.search);
    currentCategory = urlParams.get('type');

    // Definir o título da página baseado na categoria
    updateCategoryTitle();

    // Configurar listeners de eventos
    setupEventListeners();

    // Carregar produtos iniciais
    await loadProducts();
}

// Função para atualizar o título da categoria
function updateCategoryTitle() {
    const titleMap = {
        'novo': 'Novidades',
        'roupas': 'Roupas',
        'calcados': 'Calçados',
        'acess': 'Acessórios',
        'ofertas': 'Ofertas'
    };

    const title = titleMap[currentCategory] || 'Produtos';
    document.getElementById('category-title').textContent = title;
    document.title = `${title} - HYPEX`;
}

// Função para configurar listeners de eventos
function setupEventListeners() {
    // Ordenação
    document.getElementById('sort').addEventListener('change', async (e) => {
        currentFilters.sort = e.target.value;
        await loadProducts();
    });

    // Faixa de preço
    document.getElementById('price_range').addEventListener('change', async (e) => {
        currentFilters.priceRange = e.target.value;
        await loadProducts();
    });

    // Tamanhos
    const sizeCheckboxes = document.querySelectorAll('.checkbox-group input[type="checkbox"]');
    sizeCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', async () => {
            currentFilters.sizes = Array.from(sizeCheckboxes)
                .filter(cb => cb.checked)
                .map(cb => cb.value);
            await loadProducts();
        });
    });

    // Cores
    const colorCheckboxes = document.querySelectorAll('.color-filters input[type="checkbox"]');
    colorCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', async () => {
            currentFilters.colors = Array.from(colorCheckboxes)
                .filter(cb => cb.checked)
                .map(cb => cb.value);
            await loadProducts();
        });
    });

    // Paginação
    document.querySelector('.prev-page').addEventListener('click', async () => {
        if (currentPage > 1) {
            currentPage--;
            await loadProducts();
        }
    });

    document.querySelector('.next-page').addEventListener('click', async () => {
        if (currentPage < totalPages) {
            currentPage++;
            await loadProducts();
        }
    });
}

// Função para carregar produtos
async function loadProducts() {
    try {
        const productsGrid = document.getElementById('products-grid');
        productsGrid.innerHTML = '<div class="loading">Carregando produtos...</div>';

        // Construir parâmetros da query
        const params = new URLSearchParams({
            category: currentCategory,
            page: currentPage,
            sort: currentFilters.sort,
            priceRange: currentFilters.priceRange,
            sizes: currentFilters.sizes.join(','),
            colors: currentFilters.colors.join(',')
        });

        // Fazer a requisição para a API
        const response = await fetch(`/api/products?${params}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Erro ao carregar produtos');
        }

        // Atualizar total de páginas
        totalPages = data.totalPages || 1;
        updatePagination();

        // Renderizar produtos
        renderProducts(data.products);

    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        document.getElementById('products-grid').innerHTML = `
            <div class="error-message">
                Ocorreu um erro ao carregar os produtos. Por favor, tente novamente.
            </div>
        `;
    }
}

// Função para renderizar produtos
function renderProducts(products) {
    const productsGrid = document.getElementById('products-grid');
    
    if (!products || products.length === 0) {
        productsGrid.innerHTML = `
            <div class="no-products">
                Nenhum produto encontrado com os filtros selecionados.
            </div>
        `;
        return;
    }

    productsGrid.innerHTML = products.map(product => `
        <div class="product-card" data-product-id="${product.id}">
            <div class="product-image">
                <img src="${product.image}" alt="${product.name}">
                <button class="favorite-btn" onclick="toggleFavorite(${product.id})">
                    <i class="fas fa-heart"></i>
                </button>
            </div>
            <div class="product-info">
                <h3>${product.name}</h3>
                <div class="product-price">
                    ${product.discount ? `
                        <span class="original-price">R$ ${product.originalPrice.toFixed(2)}</span>
                        <span class="discount-badge">-${product.discount}%</span>
                    ` : ''}
                    <span class="current-price">R$ ${product.price.toFixed(2)}</span>
                </div>
                <div class="product-sizes">
                    ${product.sizes.map(size => `
                        <span class="size-tag">${size}</span>
                    `).join('')}
                </div>
            </div>
        </div>
    `).join('');

    // Adicionar event listeners para os cards de produto
    document.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Ignorar se clicou no botão de favorito
            if (!e.target.closest('.favorite-btn')) {
                const productId = card.dataset.productId;
                window.location.href = `/pages/product.html?id=${productId}`;
            }
        });
    });
}

// Função para atualizar a paginação
function updatePagination() {
    const prevButton = document.querySelector('.prev-page');
    const nextButton = document.querySelector('.next-page');
    const pageText = document.querySelector('.current-page');

    prevButton.disabled = currentPage === 1;
    nextButton.disabled = currentPage === totalPages;
    pageText.textContent = `Página ${currentPage} de ${totalPages}`;
}

// Função para alternar favorito
async function toggleFavorite(productId) {
    try {
        // Verificar se o usuário está logado
        const token = localStorage.getItem('hypex_token');
        if (!token) {
            window.location.href = '/pages/auth.html?redirect=' + encodeURIComponent(window.location.href);
            return;
        }

        const response = await fetch('/api/favorites/toggle', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ productId })
        });

        if (!response.ok) {
            throw new Error('Erro ao atualizar favorito');
        }

        // Atualizar o ícone do favorito
        const btn = document.querySelector(`[data-product-id="${productId}"] .favorite-btn i`);
        btn.classList.toggle('active');

    } catch (error) {
        console.error('Erro ao alternar favorito:', error);
        alert('Erro ao atualizar favorito. Por favor, tente novamente.');
    }
}

// Inicializar a página quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', initCategoryPage);