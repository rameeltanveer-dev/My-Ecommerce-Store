/* Utilities */
const q = (s) => document.querySelector(s);
const qa = (s) => Array.from(document.querySelectorAll(s));

/* Year */
q('#year').textContent = new Date().getFullYear();

/* Side panel logic */
const sidePanel = q('#sidePanel');
const openSide = q('#openSide');
const closeSide = q('#closeSide');
openSide.addEventListener('click', () => {
  sidePanel.classList.add('open');
  sidePanel.setAttribute('aria-hidden','false');
});
closeSide.addEventListener('click', () => {
  sidePanel.classList.remove('open');
  sidePanel.setAttribute('aria-hidden','true');
});
document.addEventListener('click', (e) => {
  if(!sidePanel.contains(e.target) && !openSide.contains(e.target)){
    sidePanel.classList.remove('open');
    sidePanel.setAttribute('aria-hidden','true');
  }
});

/* Slider logic */
const slides = qa('.slide');
let current = 0;
function showSlide(i){
  slides.forEach((s,idx)=> s.classList.toggle('active', idx===i));
}
if(slides.length){
  showSlide(current);
  let slideInterval = setInterval(()=> {
    current = (current+1) % slides.length;
    showSlide(current);
  }, 4000);

  q('#prev').addEventListener('click', ()=> {
    clearInterval(slideInterval);
    current = (current-1+slides.length) % slides.length;
    showSlide(current);
    slideInterval = setInterval(()=>{ current=(current+1)%slides.length; showSlide(current); }, 4000);
  });
  q('#next').addEventListener('click', ()=> {
    clearInterval(slideInterval);
    current = (current+1)%slides.length;
    showSlide(current);
    slideInterval = setInterval(()=>{ current=(current+1)%slides.length; showSlide(current); }, 4000);
  });
  q('.hero').addEventListener('mouseenter', ()=> clearInterval(slideInterval));
  q('.hero').addEventListener('mouseleave', ()=> slideInterval = setInterval(()=>{ current=(current+1)%slides.length; showSlide(current); }, 4000));
}

/* Advanced cart (localStorage) */
const CART_KEY = 'premium_cart_v2';
let CART = JSON.parse(localStorage.getItem(CART_KEY) || '{}'); // { id: {id,name,price,img,qty} }

const cartBtn = q('#cartBtn');
const cartCountEl = q('#cartCount');
const cartDrawer = q('#cartDrawer');
const closeCart = q('#closeCart');
const cartItemsWrap = q('#cartItems');
const cartTotalEl = q('#cartTotal');
const clearCartBtn = q('#clearCart');
const checkoutBtn = q('#checkout');

function persist(){ localStorage.setItem(CART_KEY, JSON.stringify(CART)); updateCartUI(); }

function computeTotals(){
  const items = Object.values(CART);
  const qty = items.reduce((s,i)=> s + i.qty, 0);
  const total = items.reduce((s,i)=> s + (i.qty * i.price), 0);
  return { items, qty, total };
}

function updateCartUI(){
  const { items, qty, total } = computeTotals();
  cartCountEl.textContent = qty;
  cartItemsWrap.innerHTML = '';
  if(items.length === 0){
    cartItemsWrap.innerHTML = '<p class="meta">Your cart is empty.</p>';
    cartTotalEl.textContent = '$0.00';
    return;
  }

  items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'cart-item fade-in';
    el.innerHTML = `
      <img src="${item.img}" alt="${item.name}">
      <div style="flex:1">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <strong>${item.name}</strong>
          <button class="remove-btn" data-id="${item.id}" title="Remove item">✕</button>
        </div>
        <div class="meta">${item.price.toFixed(2)} USD</div>
        <div style="margin-top:8px;display:flex;align-items:center;gap:8px">
          <div class="qty-controls">
            <button class="qty-decrease" data-id="${item.id}" aria-label="Decrease quantity">−</button>
            <span style="padding:6px 8px;background:rgba(255,255,255,0.03);border-radius:6px">${item.qty}</span>
            <button class="qty-increase" data-id="${item.id}" aria-label="Increase quantity">+</button>
          </div>
        </div>
      </div>
    `;
    cartItemsWrap.appendChild(el);
  });

  cartTotalEl.textContent = `$${total.toFixed(2)}`;

  // Attach handlers
  qa('.remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      delete CART[id];
      persist();
    });
  });
  qa('.qty-decrease').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      if(!CART[id]) return;
      CART[id].qty = Math.max(0, CART[id].qty - 1);
      if(CART[id].qty === 0) delete CART[id];
      persist();
    });
  });
  qa('.qty-increase').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      if(!CART[id]) return;
      CART[id].qty += 1;
      persist();
    });
  });
}

/* Cart drawer open/close */
function openCart(){ cartDrawer.classList.add('open'); cartDrawer.setAttribute('aria-hidden','false'); updateCartUI(); }
function closeCartDrawer(){ cartDrawer.classList.remove('open'); cartDrawer.setAttribute('aria-hidden','true'); }

cartBtn.addEventListener('click', openCart);
closeCart.addEventListener('click', closeCartDrawer);
clearCartBtn.addEventListener('click', ()=> { CART = {}; persist(); });
checkoutBtn.addEventListener('click', ()=> {
  const items = Object.values(CART);
  if(items.length === 0){ alert('Your cart is empty'); return; }
  // Demo checkout behaviour
  alert('Checkout demo — implement real payment flow in production.');
  CART = {}; persist();
});

// Close drawer when clicking outside
document.addEventListener('click', (e) => {
  if(cartDrawer.classList.contains('open') && !cartDrawer.contains(e.target) && !cartBtn.contains(e.target)){
    closeCartDrawer();
  }
});

/* Add to cart + fly animation + quantity bump */
function addToCartFromCard(card){
  const id = card.dataset.id;
  const name = card.dataset.name;
  const price = parseFloat(card.dataset.price);
  const img = card.dataset.img || card.querySelector('img').src;

  if(!CART[id]) CART[id] = { id, name, price, img, qty: 0 };
  CART[id].qty += 1;

  // animate image flying to cart
  const imgEl = card.querySelector('img');
  if(imgEl) flyToCart(imgEl);

  persist();
  // small pulse on cart button
  cartBtn.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 350 });
}

qa('.add-cart').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const card = e.currentTarget.closest('.card');
    addToCartFromCard(card);
  });
});

/* fly-to-cart animation */
function flyToCart(imgEl){
  if(!imgEl) return;
  const imgRect = imgEl.getBoundingClientRect();
  const cartRect = cartBtn.getBoundingClientRect();
  const fly = imgEl.cloneNode(true);
  fly.style.position = 'fixed';
  fly.style.left = imgRect.left + 'px';
  fly.style.top = imgRect.top + 'px';
  fly.style.width = imgRect.width + 'px';
  fly.style.height = imgRect.height + 'px';
  fly.style.transition = 'all 700ms cubic-bezier(.2,.9,.25,1)';
  fly.style.zIndex = 120;
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
}

/* Init UI */
updateCartUI();
