/* script.js — Unified site script
   Features:
   - Load products from localStorage (premium_products) and render on index
   - Advanced cart (premium_cart_v2): add, qty +/- , remove, totals, localStorage
   - Fly-to-cart animation
   - Slider controls
   - Mini-cart and cart drawer
   - Dark / Light mode toggle (persisted)
*/

/* =================== Utilities =================== */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const CART_KEY = 'premium_cart_v2';
const PRODUCT_KEY = 'premium_products';
const THEME_KEY = 'theme_preference';

/* =================== THEME (Dark/Light) =================== */
function applyTheme(theme) {
  if (theme === 'light') document.body.classList.add('light-theme');
  else document.body.classList.remove('light-theme');
  localStorage.setItem(THEME_KEY, theme);
}
function toggleTheme() {
  const current = localStorage.getItem(THEME_KEY) || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}
/* create floating toggle button in header area */
(function initThemeToggle() {
  const container = document.querySelector('.actions') || document.body;
  const btn = document.createElement('button');
  btn.className = 'icon-btn';
  btn.title = 'Toggle theme';
  btn.style.marginLeft = '8px';
  btn.innerHTML = '<i class="fa-solid fa-sun"></i>';
  btn.addEventListener('click', () => {
    toggleTheme();
    updateThemeIcon();
  });
  function updateThemeIcon(){
    const theme = localStorage.getItem(THEME_KEY) || 'dark';
    btn.innerHTML = theme === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
  }
  // append to header actions (if exists)
  const actions = document.querySelector('.actions');
  if (actions) actions.appendChild(btn);
  // set initial
  applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
  updateThemeIcon();
})();

/* Optional tiny CSS for light-theme (if you want different palette) */
const styleTag = document.createElement('style');
styleTag.innerHTML = `
  body.light-theme {
    --bg: #f6f7fb;
    --card: #ffffff;
    --muted: #555a66;
    --accent: #ff8a00;
    color: #111;
    background: #f5f7fa;
  }
  body.light-theme .header { background: rgba(255,255,255,0.85); border-bottom: 1px solid rgba(0,0,0,0.05); }
  body.light-theme .footer { color: var(--muted); }
`;
document.head.appendChild(styleTag);

/* =================== PRODUCT LOADER & RENDERER =================== */
function loadProducts() {
  try {
    const raw = localStorage.getItem(PRODUCT_KEY) || '[]';
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

/* Render admin products into index grids if those grids exist.
   We expect optional product object shape:
   { id, img, name, price, category } where category is 'watch'|'perfume' (optional)
*/
function renderAdminProductsToIndex() {
  const products = loadProducts();
  if (!products || products.length === 0) return;

  const watchGrid = $('#watchGrid');
  const perfumeGrid = $('#perfumeGrid');

  // fallback: find first .grid on page to append if specific ids absent
  const fallbackGrid = document.querySelector('.grid');

  products.forEach(prod => {
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.id = prod.id || `p_${Date.now()}`;
    card.dataset.name = prod.name || 'Product';
    card.dataset.price = (typeof prod.price === 'number') ? prod.price : parseFloat(prod.price || 0);
    card.dataset.img = prod.img || '';

    card.innerHTML = `
      <img src="${prod.img || 'https://via.placeholder.com/800x600?text=Product'}" alt="${(prod.name||'Product')}">
      <h3>${prod.name || 'Product'}</h3>
      <p class="meta">${prod.meta || ''}</p>
      <div class="card-foot">
        <div class="price">$${(card.dataset.price*1).toFixed(2)}</div>
        <div class="card-actions">
          <button class="btn add-cart">Add to Cart</button>
        </div>
      </div>
    `;

    // decide where to place
    let placed = false;
    if (prod.category) {
      const c = prod.category.toLowerCase();
      if (c.includes('watch') && watchGrid) { watchGrid.appendChild(card); placed = true; }
      if (c.includes('perfume') && perfumeGrid) { perfumeGrid.appendChild(card); placed = true; }
    }
    if (!placed) {
      // if both grids present, append to watches by default
      if (watchGrid) watchGrid.appendChild(card);
      else if (perfumeGrid) perfumeGrid.appendChild(card);
      else if (fallbackGrid) fallbackGrid.appendChild(card);
    }
  });

  // attach add-to-cart listeners for newly added cards
  attachAddCartHandlers();
}

/* =================== SLIDER =================== */
(function initSlider() {
  const slides = $$('.slide');
  if (!slides || slides.length === 0) return;
  let idx = 0;
  function show(i) { slides.forEach((s, j) => s.classList.toggle('active', i === j)); }
  show(idx);
  let interval = setInterval(()=> { idx = (idx+1)%slides.length; show(idx); }, 3800);

  const prev = $('#prev'), next = $('#next'), hero = $('.hero');
  if (prev) prev.addEventListener('click', ()=> { clearInterval(interval); idx = (idx-1+slides.length)%slides.length; show(idx); interval = setInterval(()=>{ idx=(idx+1)%slides.length; show(idx); },3800); });
  if (next) next.addEventListener('click', ()=> { clearInterval(interval); idx = (idx+1)%slides.length; show(idx); interval = setInterval(()=>{ idx=(idx+1)%slides.length; show(idx); },3800); });
  if (hero) {
    hero.addEventListener('mouseenter', ()=> clearInterval(interval));
    hero.addEventListener('mouseleave', ()=> interval = setInterval(()=>{ idx=(idx+1)%slides.length; show(idx); },3800));
  }
})();

/* =================== CART (Advanced) =================== */
let CART = JSON.parse(localStorage.getItem(CART_KEY) || '{}'); // { id: {id,name,price,img,qty} }

const cartBtn = $('#cartBtn');
const cartDrawer = $('.cart-drawer') || $('#cartDrawer'); // different pages have different markup
const cartCountEl = $('#cartCount') || $('.cart-count') || $('#miniCount');
const cartItemsWrap = $('#cartItems');
const cartTotalEl = $('#cartTotal');

function persistCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(CART));
  updateCartUI();
  // broadcast storage event for same-tab immediate update (storage event doesn't fire in same tab)
  window.dispatchEvent(new Event('storage'));
}

function computeCart() {
  const items = Object.values(CART);
  const qty = items.reduce((s,i)=> s + i.qty, 0);
  const total = items.reduce((s,i)=> s + (i.qty * i.price), 0);
  return { items, qty, total };
}

function updateCartUI() {
  const { items, qty, total } = computeCart();
  // cart count (multiple possible elements)
  $$('.cart-count').forEach(el => el.textContent = qty);
  if (cartCountEl) cartCountEl.textContent = qty;

  // fill cart drawer if present
  if (cartItemsWrap) {
    cartItemsWrap.innerHTML = '';
    if (items.length === 0) {
      cartItemsWrap.innerHTML = '<p class="meta">Your cart is empty.</p>';
    } else {
      items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'cart-item fade-in';
        div.innerHTML = `
          <img src="${item.img}" alt="${item.name}">
          <div style="flex:1">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <strong>${item.name}</strong>
              <button class="remove-item" data-id="${item.id}" aria-label="remove">✕</button>
            </div>
            <div class="meta">${item.qty} × $${item.price.toFixed(2)}</div>
          </div>
        `;
        cartItemsWrap.appendChild(div);
      });
      if (cartTotalEl) cartTotalEl.textContent = `$${total.toFixed(2)}`;
    }
  }
}

/* Add to cart logic + fly animation */
function addToCart(payload) {
  if (!payload || !payload.id) return;
  if (!CART[payload.id]) CART[payload.id] = { ...payload, qty: 0 };
  CART[payload.id].qty += 1;
  persistCart();
}

/* Attaches to existing and dynamically created add-cart buttons */
function attachAddCartHandlers() {
  $$('.add-cart').forEach(btn => {
    // ensure not attached multiple times
    if (btn.dataset.attached) return;
    btn.dataset.attached = 'true';
    btn.addEventListener('click', (e) => {
      const card = e.currentTarget.closest('.card') || e.currentTarget.closest('article');
      if (!card) return;
      const id = card.dataset.id || (`p_${Date.now()}`);
      const name = card.dataset.name || (card.querySelector('h3') ? card.querySelector('h3').innerText : 'Product');
      const price = parseFloat(card.dataset.price || card.querySelector('.price')?.innerText?.replace(/[^0-9.-]+/g,"") || 0);
      const img = card.dataset.img || (card.querySelector('img') ? card.querySelector('img').src : '');
      // add
      addToCart({ id, name, price, img });
      // animate
      const imgEl = card.querySelector('img');
      if (imgEl) flyToCart(imgEl);
      // small pulse on cart button
      if (cartBtn) cartBtn.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 340 });
    });
  });
}

/* fly-to-cart animation */
function flyToCart(imgEl) {
  try {
    const imgRect = imgEl.getBoundingClientRect();
    const target = cartBtn || document.querySelector('.cart-btn');
    const cartRect = target ? target.getBoundingClientRect() : { left: window.innerWidth-80, top: 20 };
    const fly = imgEl.cloneNode(true);
    fly.style.position = 'fixed';
    fly.style.left = imgRect.left + 'px';
    fly.style.top = imgRect.top + 'px';
    fly.style.width = imgRect.width + 'px';
    fly.style.height = imgRect.height + 'px';
    fly.style.transition = 'all 700ms cubic-bezier(.2,.9,.25,1)';
    fly.style.zIndex = 1200;
    fly.style.borderRadius = '8px';
    document.body.appendChild(fly);
    requestAnimationFrame(() => {
      fly.style.left = (cartRect.left + 8) + 'px';
      fly.style.top = (cartRect.top + 8) + 'px';
      fly.style.width = '40px';
      fly.style.height = '40px';
      fly.style.opacity = '0.6';
      fly.style.transform = 'rotate(20deg)';
    });
    setTimeout(()=> fly.remove(), 750);
  } catch (err) { /* no-op */ }
}

/* Attach remove / qty handlers inside cart drawer or cart page */
function attachCartDrawerHandlers() {
  // removals
  $$('.remove-item').forEach(btn => {
    if (btn.dataset.attachedRemove) return;
    btn.dataset.attachedRemove = 'true';
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      if (CART[id]) { delete CART[id]; persistCart(); }
    });
  });
}

/* =================== CART DRAWER + MINI CART =================== */
(function initCartUI() {
  // Elements may exist on some pages only
  const drawer = cartDrawer || $('.cart-drawer');
  const cartOpenBtn = cartBtn || $('#cartBtn') || document.querySelector('.cart-btn');
  const closeBtn = drawer ? drawer.querySelector('.icon-btn') : null;

  if (cartOpenBtn && drawer) {
    cartOpenBtn.addEventListener('click', () => {
      drawer.classList.add('open');
      drawer.setAttribute('aria-hidden','false');
      updateCartUI();
    });
  }
  if (closeBtn) closeBtn.addEventListener('click', () => {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden','true');
  });

  // clear & checkout in drawer if those elements exist
  const clearBtn = $('#clearCart');
  const checkoutBtn = $('#checkout');
  if (clearBtn) clearBtn.addEventListener('click', () => { if (confirm('Clear cart?')) { CART = {}; persistCart(); }});
  if (checkoutBtn) checkoutBtn.addEventListener('click', () => {
    const { items } = computeCart();
    if (!items.length) return alert('Your cart is empty');
    // demo checkout behaviour: clear cart + notify
    alert('Checkout demo — implement payment backend in production.');
    CART = {}; persistCart();
  });
})();

/* =================== PRODUCT RENDER ON INDEX (initialization) =================== */
(function initProductsOnIndex() {
  // render admin products to index (if any)
  try { renderAdminProductsToIndex(); } catch (e) { /* ignore */ }

  // attach handlers to any existing add-cart buttons (static html)
  attachAddCartHandlers();
})();

/* =================== INITIAL CART UI UPDATE =================== */
updateCartUI();
attachCartDrawerHandlers();

/* respond to storage events so multiple tabs stay in sync */
window.addEventListener('storage', (e) => {
  if (e.key === CART_KEY) {
    CART = JSON.parse(localStorage.getItem(CART_KEY) || '{}');
    updateCartUI();
  }
  if (e.key === PRODUCT_KEY) {
    // if admin updated product set, re-render added items on index
    renderAdminProductsToIndex();
  }
});

/* =================== CART PAGE / MINI CART PAGE SUPPORT =================== */
/* If cart.html or cart page's scripts exist, they may use same key. The UI there
   will be updated automatically via updateCartUI() and storage sync. */

/* =================== ATTACH ADD-CART HANDLERS (initial) =================== */
document.addEventListener('DOMContentLoaded', () => {
  // ensure handlers attached after DOM ready
  attachAddCartHandlers();
  // re-attach remove handlers periodically (in case dynamic changes)
  setInterval(() => {
    attachCartDrawerHandlers();
  }, 800);
});
