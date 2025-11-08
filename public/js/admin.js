document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('hypex_token');
  const user = JSON.parse(localStorage.getItem('hypex_user') || '{}');

  if (!token || user.role !== 'admin') {
    document.querySelectorAll('.admin-section').forEach(section => {
      section.innerHTML = '<p>Você precisa estar logado como admin para acessar esta área.</p>';
    });
    return;
  }

  // Nav Tabs
  document.querySelectorAll('.admin-nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = link.getAttribute('data-section');
      document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.admin-nav-link').forEach(l => l.classList.remove('active'));
      document.getElementById(section).classList.add('active');
      link.classList.add('active');
    });
  });

  // Load Orders
  const ordersList = document.getElementById('orders-list');
  fetch('/api/orders', { headers: { Authorization: `Bearer ${token}` }})
    .then(r => r.json())
    .then(data => {
      if (!data.orders) {
        ordersList.innerHTML = '<p>Sem pedidos ou acesso negado.</p>';
        return;
      }

      ordersList.innerHTML = '';
      data.orders.forEach(o => {
        const el = document.createElement('div');
        el.className = 'order-card';
        el.innerHTML = `
          <h4>Pedido #${o.id} — <small>${o.status}</small></h4>
          <div><strong>Total:</strong> R$ ${Number(o.total).toFixed(2)}</div>
          <div><strong>Criado:</strong> ${new Date(o.created_at).toLocaleString()}</div>
          <div class="admin-actions">
            <select data-order-id="${o.id}" class="status-select">
              <option value="pedido feito">Pedido feito</option>
              <option value="em separacao">Em separação</option>
              <option value="enviado">Enviado</option>
              <option value="entregue">Entregue</option>
            </select>
            <button data-order-id="${o.id}" class="save-status btn btn-outline">Salvar</button>
          </div>
        `;
        ordersList.appendChild(el);
      });

      // Set current statuses
      document.querySelectorAll('.status-select').forEach(sel => {
        const id = sel.getAttribute('data-order-id');
        const order = data.orders.find(x => String(x.id) === String(id));
        if (order) sel.value = order.status;
      });

      document.querySelectorAll('.save-status').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = btn.getAttribute('data-order-id');
          const sel = document.querySelector(`.status-select[data-order-id="${id}"]`);
          const status = sel.value;
          try {
            const res = await fetch(`/api/orders/${id}/status`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ status })
            });
            const json = await res.json();
            if (res.ok) {
              alert('Status atualizado');
            } else {
              throw new Error(json.error || 'Erro');
            }
          } catch (err) {
            alert(err.message);
          }
        });
      });
    }).catch(err => {
      ordersList.innerHTML = '<p>Erro ao carregar pedidos.</p>';
      console.error(err);
    });

  // Products Management
  const productModal = document.getElementById('product-modal');
  const productForm = document.getElementById('product-form');
  const addProductBtn = document.getElementById('add-product');
  const productsGrid = document.querySelector('#products-list .products-grid');
  let currentProduct = null;

  // Load Products
  async function loadProducts() {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (!data.products) throw new Error('Sem produtos.');

      productsGrid.innerHTML = '';
      data.products.forEach(p => {
        const el = document.createElement('div');
        el.className = 'product-card';
        const img = p.images && p.images.length ? p.images[0] : 'https://via.placeholder.com/300x400';
        el.innerHTML = `
          <img src="${img}" alt="${p.name}">
          <div class="product-info">
            <h4>${p.name}</h4>
            <p>R$ ${Number(p.price).toFixed(2)}</p>
            <p><small>Em estoque: ${p.stock}</small></p>
            <div class="admin-actions">
              <button class="btn btn-outline edit-product" data-id="${p.id}">Editar</button>
              <button class="btn btn-outline delete-product" data-id="${p.id}">Excluir</button>
            </div>
          </div>
        `;
        productsGrid.appendChild(el);

        // Edit button
        el.querySelector('.edit-product').addEventListener('click', () => editProduct(p));
        
        // Delete button
        el.querySelector('.delete-product').addEventListener('click', async () => {
          if (!confirm('Tem certeza que deseja excluir este produto?')) return;
          try {
            const res = await fetch(`/api/products/${p.id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
              el.remove();
              alert('Produto excluído com sucesso.');
            } else {
              throw new Error('Erro ao excluir produto.');
            }
          } catch (err) {
            alert(err.message);
          }
        });
      });
    } catch (err) {
      productsGrid.innerHTML = '<p>Erro ao carregar produtos.</p>';
      console.error(err);
    }
  }

  // Open modal to add product
  addProductBtn.addEventListener('click', () => {
    currentProduct = null;
    productForm.reset();
    productForm.querySelector('[name=id]').value = '';
    productForm.querySelector('.image-preview').innerHTML = '';
    productModal.style.display = 'flex';
  });

  // Close modal
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      productModal.style.display = 'none';
    });
  });

  // Edit product
  function editProduct(product) {
    currentProduct = product;
    productForm.querySelector('[name=id]').value = product.id;
    productForm.querySelector('[name=name]').value = product.name;
    productForm.querySelector('[name=description]').value = product.description;
    productForm.querySelector('[name=price]').value = product.price;
    productForm.querySelector('[name=stock]').value = product.stock;

    const preview = productForm.querySelector('.image-preview');
    preview.innerHTML = '';
    if (product.images) {
      product.images.forEach(img => {
        preview.innerHTML += `<img src="${img}" alt="Preview">`;
      });
    }

    productModal.style.display = 'flex';
  }

  // Handle form submit
  productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(productForm);
    const id = formData.get('id');
    const isEdit = id && currentProduct;

    try {
      // For edit, convert FormData to JSON since we're not handling files in edit
      if (isEdit) {
        const data = Object.fromEntries(formData);
        const res = await fetch(`/api/products/${id}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}` 
          },
          body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Erro ao salvar produto.');
        productModal.style.display = 'none';
        loadProducts();
        alert('Produto atualizado com sucesso!');
      } else {
        // For create, send FormData with files
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData // FormData sets its own Content-Type with boundary
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Erro ao criar produto.');
        productModal.style.display = 'none';
        loadProducts();
        alert('Produto criado com sucesso!');
      }
    } catch (err) {
      alert(err.message);
    }
  });

  // Coupons Management
  const couponsList = document.getElementById('coupons-list');

  async function loadCoupons() {
    try {
      const res = await fetch('/api/coupons', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.coupons) throw new Error('Sem cupons.');

      couponsList.innerHTML = `
        <div class="section-header">
          <button class="btn btn-primary" id="add-coupon">
            <i class="fas fa-plus"></i> Novo Cupom
          </button>
        </div>
        <div class="coupons-grid"></div>
      `;

      const grid = couponsList.querySelector('.coupons-grid');
      data.coupons.forEach(c => {
        const expires = new Date(c.expires_at).toLocaleDateString();
        const el = document.createElement('div');
        el.className = 'coupon-card';
        el.innerHTML = `
          <div class="coupon-info">
            <h4>${c.code}</h4>
            <p>${c.type === 'percentage' ? c.value + '%' : 'R$ ' + Number(c.value).toFixed(2)} de desconto</p>
            <p><small>Expira em: ${expires}</small></p>
            <p><small>Limite de uso: ${c.usage_limit === null || typeof c.usage_limit === 'undefined' ? 'Ilimitado' : c.usage_limit}</small></p>
            <div class="admin-actions">
              <button class="btn btn-outline edit-coupon" data-id="${c.id}">Editar</button>
              <button class="btn btn-outline delete-coupon" data-id="${c.id}">Excluir</button>
            </div>
          </div>
        `;
        grid.appendChild(el);

        // Delete button
        el.querySelector('.delete-coupon').addEventListener('click', async () => {
          if (!confirm('Tem certeza que deseja excluir este cupom?')) return;
          try {
            const res = await fetch(`/api/coupons/${c.id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
              el.remove();
              alert('Cupom excluído com sucesso.');
            } else {
              throw new Error('Erro ao excluir cupom.');
            }
          } catch (err) {
            alert(err.message);
          }
        });

        // Edit button
        el.querySelector('.edit-coupon').addEventListener('click', () => {
          showCouponModal(c);
        });
      });

      const addBtn = document.getElementById('add-coupon');
      addBtn.addEventListener('click', () => showCouponModal());
    } catch (err) {
      couponsList.innerHTML = '<p>Erro ao carregar cupons.</p>';
      console.error(err);
    }
  }

  function showCouponModal(coupon = null) {
    const modal = document.createElement('div');
    modal.className = 'admin-modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h4>${coupon ? 'Editar' : 'Novo'} Cupom</h4>
          <button class="close-modal">&times;</button>
        </div>
        <form id="coupon-form" class="admin-form">
          <input type="hidden" name="id" value="${coupon?.id || ''}">
          <div class="form-group">
            <label for="code">Código do Cupom</label>
            <input type="text" id="code" name="code" required value="${coupon?.code || ''}"
              pattern="[A-Za-z0-9]+" title="Apenas letras e números">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="type">Tipo de Desconto</label>
              <select id="type" name="type" required>
                <option value="percentage" ${coupon?.type === 'percentage' ? 'selected' : ''}>Porcentagem</option>
                <option value="fixed" ${coupon?.type === 'fixed' ? 'selected' : ''}>Valor Fixo</option>
              </select>
            </div>
            <div class="form-group">
              <label for="value">Valor do Desconto</label>
              <input type="number" id="value" name="value" required min="0" step="0.01" 
                value="${coupon?.value || ''}">
            </div>
          </div>
          <div class="form-group">
            <label for="expires">Data de Expiração</label>
            <input type="date" id="expires" name="expires_at" required 
              value="${coupon?.expires_at ? coupon.expires_at.split('T')[0] : ''}">
          </div>
          <div class="form-group">
            <label for="usage_limit">Limite de Uso (opcional)</label>
            <input type="number" id="usage_limit" name="usage_limit" min="0" step="1"
              value="${typeof coupon?.usage_limit !== 'undefined' && coupon?.usage_limit !== null ? coupon.usage_limit : ''}">
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Salvar Cupom</button>
            <button type="button" class="btn btn-outline close-modal">Cancelar</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    // Close modal
    modal.querySelectorAll('.close-modal').forEach(btn => {
      btn.addEventListener('click', () => modal.remove());
    });

    // Handle form submit
    const form = modal.querySelector('#coupon-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const data = Object.fromEntries(formData);
      const isEdit = data.id;

      try {
        const res = await fetch(isEdit ? `/api/coupons/${data.id}` : '/api/coupons', {
          method: isEdit ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            code: data.code,
            type: data.type,
            value: Number(data.value),
            expires_at: data.expires_at,
            usage_limit: data.usage_limit !== '' && typeof data.usage_limit !== 'undefined' ? Number(data.usage_limit) : undefined
          })
        });

        const json = await res.json();
        if (res.ok) {
          modal.remove();
          loadCoupons();
          alert(isEdit ? 'Cupom atualizado com sucesso!' : 'Cupom criado com sucesso!');
        } else {
          throw new Error(json.error || 'Erro ao salvar cupom.');
        }
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // Initial loads
  loadProducts();
  loadCoupons();
});
