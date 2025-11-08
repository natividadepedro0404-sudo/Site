const api = (p, opts) => fetch(`/api/${p}`, opts).then(r => r.json());

// Carrinho Modal
const cartModal = document.getElementById('cart-modal');
const cartIcon = document.querySelector('.cart-icon');
const closeModal = document.querySelector('.close-modal');

cartIcon.addEventListener('click', (e) => {
  e.preventDefault();
  cartModal.style.display = 'block';
});

closeModal.addEventListener('click', () => {
  cartModal.style.display = 'none';
});

// Produtos
async function loadProducts() {
  const res = await api('products');
  const list = document.getElementById('product-list');
  list.innerHTML = '';
  
  (res.products || []).forEach(p => {
    const hasDiscount = p.original_price > p.price;
    const discount = hasDiscount ? Math.round((1 - p.price / p.original_price) * 100) : 0;
    
    const card = document.createElement('article');
    card.className = 'product-card';
    
    // Imagem principal
    const imgWrap = document.createElement('div');
    imgWrap.className = 'product-image';
    const img = document.createElement('img');
    img.alt = p.name;
    img.src = (p.images && p.images[0]) || 'https://via.placeholder.com/300x400?text=HYPEX';
    imgWrap.appendChild(img);
    
    if (hasDiscount) {
      const discountBadge = document.createElement('span');
      discountBadge.className = 'discount-badge';
      discountBadge.textContent = `-${discount}%`;
      imgWrap.appendChild(discountBadge);
    }
    
    // Quick actions
    const actions = document.createElement('div');
    actions.className = 'quick-actions';
    
    const favorite = document.createElement('button');
    favorite.innerHTML = '<i class="far fa-heart"></i>';
    favorite.title = 'Adicionar aos favoritos';
    favorite.className = 'action-btn favorite';
    
    const addToCart = document.createElement('button');
    addToCart.innerHTML = '<i class="fas fa-shopping-cart"></i>';
    addToCart.title = 'Adicionar ao carrinho';
    addToCart.className = 'action-btn add-cart';
    addToCart.addEventListener('click', () => addItemToCart(p));
    
    actions.appendChild(favorite);
    actions.appendChild(addToCart);
    imgWrap.appendChild(actions);
    
    card.appendChild(imgWrap);
    
    // Info do produto
    const info = document.createElement('div');
    info.className = 'product-info';
    
    const name = document.createElement('h3');
    name.className = 'product-name';
    name.textContent = p.name;
    
    const priceInfo = document.createElement('div');
    priceInfo.className = 'price-info';
    
    const currentPrice = document.createElement('span');
    currentPrice.className = 'current-price';
    currentPrice.textContent = `R$ ${Number(p.price).toFixed(2)}`;
    
    if (hasDiscount) {
      const originalPrice = document.createElement('span');
      originalPrice.className = 'original-price';
      originalPrice.textContent = `R$ ${Number(p.original_price).toFixed(2)}`;
      priceInfo.appendChild(originalPrice);
    }
    
    priceInfo.appendChild(currentPrice);
    
    info.appendChild(name);
    info.appendChild(priceInfo);
    card.appendChild(info);
    
    list.appendChild(card);
  });
  
  updateCartCount();
}

// Carrinho
function getCart() {
  try {
    return JSON.parse(localStorage.getItem('hypex_cart') || '[]');
  } catch(e) {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem('hypex_cart', JSON.stringify(cart));
  renderCart();
  updateCartCount();
}

function addItemToCart(product) {
  const cart = getCart();
  const found = cart.find(i => i.product_id === product.id);
  
  if (found) {
    found.qty++;
  } else {
    cart.push({
      product_id: product.id,
      name: product.name,
      price: product.price,
      image: product.images?.[0],
      qty: 1,
      checked: true
    });
  }
  
  saveCart(cart);
  cartModal.style.display = 'block';
}

function updateCartCount() {
  const cart = getCart();
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  document.querySelector('.cart-count').textContent = count;
}

function renderCart() {
  const el = document.getElementById('cart-items');
  const cart = getCart();
  el.innerHTML = '';
  
  if (!cart.length) {
    el.innerHTML = '<div class="empty-cart">Seu carrinho está vazio</div>';
    document.getElementById('cart-total-value').textContent = 'R$ 0,00';
    return;
  }
  
  let total = 0;
  
  cart.forEach((item, idx) => {
    const itemTotal = item.price * item.qty;
    if (item.checked) total += itemTotal;
    
    const row = document.createElement('div');
    row.className = 'cart-item';
    
    // Checkbox
    const cbWrap = document.createElement('div');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!item.checked;
    cb.addEventListener('change', e => {
      item.checked = e.target.checked;
      saveCart(cart);
    });
    cbWrap.appendChild(cb);
    
    // Imagem
    const img = document.createElement('img');
    img.src = item.image || 'https://via.placeholder.com/80x100?text=HYPEX';
    img.alt = item.name;
    
    // Info
    const info = document.createElement('div');
    info.className = 'item-info';
    info.innerHTML = `
      <h4>${item.name}</h4>
      <div class="item-price">R$ ${Number(item.price).toFixed(2)}</div>
      <div class="item-quantity">
        <button class="qty-btn" onclick="updateQuantity(${idx}, ${item.qty - 1})">-</button>
        <span>${item.qty}</span>
        <button class="qty-btn" onclick="updateQuantity(${idx}, ${item.qty + 1})">+</button>
      </div>
    `;
    
    // Remove
    const remove = document.createElement('button');
    remove.className = 'remove-item';
    remove.innerHTML = '<i class="fas fa-trash"></i>';
    remove.addEventListener('click', () => {
      cart.splice(idx, 1);
      saveCart(cart);
    });
    
    row.appendChild(cbWrap);
    row.appendChild(img);
    row.appendChild(info);
    row.appendChild(remove);
    el.appendChild(row);
  });
  
  document.getElementById('cart-total-value').textContent = `R$ ${total.toFixed(2)}`;
}

function updateQuantity(idx, newQty) {
  if (newQty < 1) return;
  const cart = getCart();
  cart[idx].qty = newQty;
  saveCart(cart);
}

// Checkout
document.getElementById('checkout-btn').addEventListener('click', async () => {
  const token = localStorage.getItem('hypex_token');
  if (!token) {
    alert('Faça login antes de finalizar a compra');
    return;
  }
  
  const cart = getCart();
  const selectedItems = cart.filter(item => item.checked);
  
  if (!selectedItems.length) {
    alert('Selecione ao menos um item para finalizar a compra');
    return;
  }
  
  try {
    const res = await fetch('/api/orders/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        items: selectedItems,
        address: null // será pedido no checkout
      })
    });
    
    const data = await res.json();
    
    if (res.ok) {
      alert('Pedido criado com sucesso! Siga as instruções de pagamento PIX.');
      if (data.payment?.payment_url) {
        window.location.href = data.payment.payment_url;
      }
      
      // Limpa itens comprados do carrinho
      const newCart = cart.filter(item => !item.checked);
      saveCart(newCart);
      cartModal.style.display = 'none';
    } else {
      throw new Error(data.error || 'Erro ao criar pedido');
    }
  } catch (err) {
    alert(err.message);
  }
});

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  loadProducts();
  renderCart();
});