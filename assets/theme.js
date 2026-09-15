(function () {
  'use strict';

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── ANNOUNCEMENT BAR (carousel + dismiss) ── */
  function initAnnouncementBar() {
    var bar = document.querySelector('.announcement-bar');
    if (!bar) return;

    /* Dismiss */
    var closeBtn = bar.querySelector('.announcement-bar__close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        /* Target the Shopify section wrapper, not just the inner bar.
           Removing only the inner bar leaves the wrapper taking up space = gap bug. */
        var sectionWrapper = bar.closest('.shopify-section') || bar;
        sectionWrapper.style.transition = 'opacity 0.3s var(--ease-out-expo), max-height 0.3s var(--ease-out-expo)';
        sectionWrapper.style.opacity = '0';
        sectionWrapper.style.maxHeight = '0';
        sectionWrapper.style.overflow = 'hidden';
        /* Reset CSS variables so header + hero reposition flush to top */
        document.documentElement.style.setProperty('--announcement-h', '0px');
        setTimeout(function () { sectionWrapper.remove(); }, 300);
      });
    }

    /* Carousel */
    var slides = bar.querySelectorAll('.announcement-bar__slide');
    if (slides.length < 2) return;

    var currentIndex = 0;
    var speed = parseInt(bar.closest('.section-announcement-bar')
      ? bar.closest('.section-announcement-bar').dataset.rotateSpeed || '5'
      : '5', 10) * 1000;
    var autoTimer = null;

    function showSlide(index) {
      slides.forEach(function (s) { s.classList.remove('is-active'); });
      currentIndex = ((index % slides.length) + slides.length) % slides.length;
      slides[currentIndex].classList.add('is-active');
    }

    function next() { showSlide(currentIndex + 1); }
    function prev() { showSlide(currentIndex - 1); }

    function startAuto() {
      if (prefersReducedMotion) return;
      stopAuto();
      autoTimer = setInterval(next, speed);
    }
    function stopAuto() { if (autoTimer) clearInterval(autoTimer); }

    var prevBtn = bar.querySelector('.announcement-bar__prev');
    var nextBtn = bar.querySelector('.announcement-bar__next');
    if (prevBtn) prevBtn.addEventListener('click', function () { prev(); startAuto(); });
    if (nextBtn) nextBtn.addEventListener('click', function () { next(); startAuto(); });

    startAuto();
  }

  /* ── HEADER: transparent overlay → solid on scroll ── */
  function initHeaderScroll() {
    var sectionHeader = document.querySelector('.section-header');
    if (!sectionHeader) return;
    var announcementBar = document.querySelector('.section-announcement-bar');
    var abH = announcementBar ? announcementBar.offsetHeight : 0;
    var headerH = sectionHeader.offsetHeight;
    /* Set CSS variables for positioning */
    document.documentElement.style.setProperty('--announcement-h', abH + 'px');
    document.documentElement.style.setProperty('--header-h', headerH + 'px');
    var heroSection = document.querySelector('.hero--slideshow, .section-hero-slideshow');
    if (!heroSection) {
      sectionHeader.classList.add('header--scrolled');
      return;
    }
    /* Watch hero visibility to toggle solid/transparent header */
    var observer = new IntersectionObserver(function (entries) {
      sectionHeader.classList.toggle('header--scrolled', !entries[0].isIntersecting);
    }, { threshold: 0.05 });
    observer.observe(heroSection);
  }

  /* ── MOBILE NAV ── */
  function initMobileNav() {
    var toggle = document.querySelector('.nav-toggle');
    var nav = document.querySelector('.mobile-nav');
    var overlay = document.querySelector('.mobile-nav-overlay');
    if (!toggle || !nav) return;

    function openNav() {
      nav.classList.add('is-open');
      if (overlay) overlay.classList.add('is-visible');
      toggle.setAttribute('aria-expanded', 'true');
      nav.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
    function closeNav() {
      nav.classList.remove('is-open');
      if (overlay) overlay.classList.remove('is-visible');
      toggle.setAttribute('aria-expanded', 'false');
      nav.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    toggle.addEventListener('click', function () {
      var isOpen = nav.classList.contains('is-open');
      isOpen ? closeNav() : openNav();
    });
    if (overlay) overlay.addEventListener('click', closeNav);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) closeNav();
    });
  }

  /* ═══════════════════════════════════════════
     SCROLL REVEAL — Progressive Enhancement

     Content is ALWAYS visible by default.
     JS arms the animation system AFTER marking
     above-fold content as already revealed.
     If JS fails, nothing breaks — content shows.
     ═══════════════════════════════════════════ */
  function initScrollReveal() {
    if (prefersReducedMotion) return;

    var elements = document.querySelectorAll('[data-reveal]');
    if (!elements.length) return;

    var viewportHeight = window.innerHeight;

    /* Step 1: Pre-reveal everything already visible above the fold */
    elements.forEach(function (el) {
      var rect = el.getBoundingClientRect();
      if (rect.top < viewportHeight * 0.8) {
        el.classList.add('is-revealed');
      }
    });

    /* Step 2: Arm the CSS system */
    document.body.classList.add('js-reveal-armed');

    /* Step 3: Each element gets its own observer.
       Reveals individually as it enters the viewport — not grouped by section. */
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -60px 0px'
    });

    elements.forEach(function (el) {
      if (!el.classList.contains('is-revealed')) {
        observer.observe(el);
      }
    });

    /* Step 4: Failsafe.
       AI-generated sections sometimes use opacity:0 + [data-revealed] (no
       progressive enhancement) — if their JS observer never fires (Playwright
       fullPage screenshots, slow connections, OS-throttled tabs), content
       stays invisible. Force-reveal everything after 2s no matter what. */
    setTimeout(function () {
      document.querySelectorAll('[data-reveal]').forEach(function (el) {
        el.classList.add('is-revealed');
        el.setAttribute('data-revealed', '');
      });
    }, 2000);
  }

  /* ── DROPDOWN NAV KEYBOARD SUPPORT ── */
  function initDropdownNav() {
    var navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(function (item) {
      var link = item.querySelector('.nav-link.has-dropdown');
      var dropdown = item.querySelector('.dropdown');
      if (!link || !dropdown) return;

      link.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          var isOpen = dropdown.classList.contains('is-active');
          /* Close all other dropdowns first */
          document.querySelectorAll('.dropdown.is-active').forEach(function (d) {
            d.classList.remove('is-active');
          });
          if (!isOpen) {
            dropdown.classList.add('is-active');
            var firstLink = dropdown.querySelector('.dropdown__link');
            if (firstLink) firstLink.focus();
          }
        }
      });

      /* Close on Escape */
      dropdown.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          dropdown.classList.remove('is-active');
          link.focus();
        }
      });
    });

    /* Close dropdowns on click outside */
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.nav-item')) {
        document.querySelectorAll('.dropdown.is-active').forEach(function (d) {
          d.classList.remove('is-active');
        });
      }
    });
  }

  /* ── HERO SLIDESHOW ── */
  function initHeroSlideshow() {
    var hero = document.querySelector('[data-slideshow]');
    if (!hero) return;

    var slides = hero.querySelectorAll('.hero__slide');
    var dots = hero.querySelectorAll('.hero__dot');
    var prevBtn = hero.querySelector('.hero__prev');
    var nextBtn = hero.querySelector('.hero__next');
    if (slides.length < 2) return;

    var counter = hero.querySelector('.hero__counter');
    var current = 0;
    var speed = parseInt(hero.dataset.speed || '5', 10) * 1000;
    var autoTimer = null;

    function showSlide(index) {
      current = ((index % slides.length) + slides.length) % slides.length;
      slides.forEach(function (s, i) {
        var isActive = i === current;
        s.classList.toggle('is-active', isActive);
        s.setAttribute('aria-hidden', isActive ? 'false' : 'true');
      });
      dots.forEach(function (d, i) {
        d.classList.toggle('is-active', i === current);
        d.setAttribute('aria-current', i === current ? 'true' : 'false');
      });
      if (counter) counter.textContent = (current + 1) + ' / ' + slides.length;
    }

    function next() { showSlide(current + 1); }
    function prev() { showSlide(current - 1); }

    function startAuto() {
      if (prefersReducedMotion || speed === 0) return;
      stopAuto();
      autoTimer = setInterval(next, speed);
    }
    function stopAuto() { if (autoTimer) clearInterval(autoTimer); }

    if (prevBtn) prevBtn.addEventListener('click', function () { prev(); startAuto(); });
    if (nextBtn) nextBtn.addEventListener('click', function () { next(); startAuto(); });
    dots.forEach(function (dot) {
      dot.addEventListener('click', function () {
        showSlide(parseInt(dot.dataset.slide, 10));
        startAuto();
      });
    });

    /* Pause on hover */
    hero.addEventListener('mouseenter', stopAuto);
    hero.addEventListener('mouseleave', startAuto);

    startAuto();
  }

  /* ── DEPTH PARALLAX HERO ── */
  function initHeroParallax() {
    var hero = document.querySelector('.hero--slideshow');
    if (!hero) return;

    /* Check if parallax layers exist */
    var bgLayer = hero.querySelector('.hero__parallax-bg');
    var fgLayer = hero.querySelector('.hero__parallax-fg');
    if (!bgLayer || !fgLayer) return;
    if (prefersReducedMotion) return;

    var midLayer = hero.querySelector('.hero__parallax-mid');
    var intensity = parseFloat(hero.dataset.parallaxIntensity || '20');
    var centerX = 0.5;
    var centerY = 0.5;
    var currentX = 0.5;
    var currentY = 0.5;
    var rafId = null;

    function updateLayers() {
      /* Smooth interpolation toward target */
      currentX += (centerX - currentX) * 0.06;
      currentY += (centerY - currentY) * 0.06;

      var offsetX = (currentX - 0.5) * intensity;
      var offsetY = (currentY - 0.5) * intensity;

      /* Both layers move in the SAME direction (opposite to mouse).
         Near objects (FG) move MORE than far objects (BG).
         This prevents the "doubled image" artifact. */
      bgLayer.style.transform = 'translate(' + (-offsetX * 0.15) + 'px, ' + (-offsetY * 0.15) + 'px) scale(1.05)';

      if (midLayer) {
        midLayer.style.transform = 'translate(' + (-offsetX * 0.3) + 'px, ' + (-offsetY * 0.3) + 'px) scale(1.03)';
      }

      /* Foreground shifts more — the differential creates the depth illusion */
      fgLayer.style.transform = 'translate(' + (-offsetX * 0.5) + 'px, ' + (-offsetY * 0.5) + 'px) scale(1.05)';

      rafId = requestAnimationFrame(updateLayers);
    }

    /* Desktop: mousemove */
    hero.addEventListener('mousemove', function (e) {
      var rect = hero.getBoundingClientRect();
      centerX = (e.clientX - rect.left) / rect.width;
      centerY = (e.clientY - rect.top) / rect.height;
    });

    hero.addEventListener('mouseleave', function () {
      centerX = 0.5;
      centerY = 0.5;
    });

    /* Mobile: device orientation (gyroscope) */
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', function (e) {
        if (e.gamma === null) return;
        /* gamma: -90..90 (left-right tilt), beta: -180..180 (front-back tilt) */
        centerX = 0.5 + (e.gamma / 90) * 0.5;
        centerY = 0.5 + ((e.beta - 45) / 90) * 0.5;
        centerX = Math.max(0, Math.min(1, centerX));
        centerY = Math.max(0, Math.min(1, centerY));
      });
    }

    /* Start animation loop */
    rafId = requestAnimationFrame(updateLayers);

    /* Pause when not visible */
    var visObserver = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        if (!rafId) rafId = requestAnimationFrame(updateLayers);
      } else {
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      }
    });
    visObserver.observe(hero);
  }

  /* ── NEWSLETTER FORM ── */
  function initNewsletterForm() {
    var forms = document.querySelectorAll('.newsletter-form');
    forms.forEach(function (form) {
      form.addEventListener('submit', function () {
        var btn = form.querySelector('button[type="submit"]');
        if (btn) btn.textContent = 'Sending...';
      });
    });
  }

  /* ── BACK TO TOP ── */
  function initBackToTop() {
    var btn = document.querySelector('.back-to-top');
    if (!btn) return;
    window.addEventListener('scroll', function() {
      btn.classList.toggle('is-visible', window.scrollY > 600);
    });
    btn.addEventListener('click', function() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ── MEGA MENU ── */
  function initMegaMenu() {
    var megaItems = document.querySelectorAll('[data-mega-menu]');
    if (!megaItems.length) return;

    var closeTimer = null;

    megaItems.forEach(function (item) {
      var panel = item.querySelector('.mega-menu');
      if (!panel) return;

      function open() {
        if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
        /* Close any other open mega menus */
        megaItems.forEach(function (other) {
          if (other !== item) {
            other.classList.remove('is-mega-open');
            var otherPanel = other.querySelector('.mega-menu');
            if (otherPanel) otherPanel.setAttribute('aria-hidden', 'true');
          }
        });
        item.classList.add('is-mega-open');
        panel.setAttribute('aria-hidden', 'false');
      }

      function close() {
        closeTimer = setTimeout(function () {
          item.classList.remove('is-mega-open');
          panel.setAttribute('aria-hidden', 'true');
        }, 120);
      }

      item.addEventListener('mouseenter', open);
      item.addEventListener('mouseleave', close);
      panel.addEventListener('mouseenter', function () {
        if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
      });
      panel.addEventListener('mouseleave', close);

      /* Keyboard support */
      var trigger = item.querySelector('.nav-link');
      if (trigger) {
        trigger.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            var isOpen = item.classList.contains('is-mega-open');
            if (isOpen) {
              item.classList.remove('is-mega-open');
              panel.setAttribute('aria-hidden', 'true');
            } else {
              open();
              var firstLink = panel.querySelector('.mega-menu__column-title, .mega-menu__link');
              if (firstLink) firstLink.focus();
            }
          }
        });
      }

      /* Close on Escape */
      panel.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          item.classList.remove('is-mega-open');
          panel.setAttribute('aria-hidden', 'true');
          if (trigger) trigger.focus();
        }
      });
    });

    /* Close mega menu on click outside */
    document.addEventListener('click', function (e) {
      if (!e.target.closest('[data-mega-menu]')) {
        megaItems.forEach(function (item) {
          item.classList.remove('is-mega-open');
          var panel = item.querySelector('.mega-menu');
          if (panel) panel.setAttribute('aria-hidden', 'true');
        });
      }
    });
  }

  /* ═══════════════════════════════════════════
     WISHLIST — Pro-tier feature
     localStorage-only, per-device.
     window.Themr namespace is shared — future
     modules can attach here too.
     ═══════════════════════════════════════════ */
  window.Themr = window.Themr || {};
  window.Themr.wishlist = (function () {
    var KEY = 'themr:wishlist';
    function read() {
      try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
      catch (e) { return []; }
    }
    function write(arr) {
      try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch (e) {}
    }
    function has(handle) { return read().indexOf(handle) > -1; }
    function add(handle) {
      var items = read();
      if (items.indexOf(handle) === -1) {
        items.push(handle);
        write(items);
        broadcast(handle, true);
      }
    }
    function remove(handle) {
      var items = read().filter(function (h) { return h !== handle; });
      write(items);
      broadcast(handle, false);
    }
    function toggle(handle) {
      if (has(handle)) remove(handle);
      else add(handle);
      return has(handle);
    }
    function list() { return read(); }
    function broadcast(handle, state) {
      window.dispatchEvent(new CustomEvent('themr:wishlist-change', {
        detail: { handle: handle, added: state, count: read().length }
      }));
    }
    return { has: has, add: add, remove: remove, toggle: toggle, list: list };
  })();

  function initWishlistButtons() {
    var buttons = document.querySelectorAll('[data-wishlist-btn]');
    if (!buttons.length) return;

    /* Reflect initial state from localStorage */
    buttons.forEach(function (btn) {
      var handle = btn.getAttribute('data-product-handle');
      if (handle && window.Themr.wishlist.has(handle)) {
        btn.classList.add('is-wishlisted');
        btn.setAttribute('aria-pressed', 'true');
        btn.setAttribute('aria-label', 'Remove from wishlist');
      }
      btn.addEventListener('click', function (e) {
        /* Prevent product-card anchor navigation when heart is clicked */
        e.preventDefault();
        e.stopPropagation();
        if (!handle) return;
        var state = window.Themr.wishlist.toggle(handle);
        btn.classList.toggle('is-wishlisted', state);
        btn.setAttribute('aria-pressed', state ? 'true' : 'false');
        btn.setAttribute('aria-label', state ? 'Remove from wishlist' : 'Add to wishlist');
      });
    });

    /* Cross-button sync: keep multiple buttons for the same handle aligned */
    window.addEventListener('themr:wishlist-change', function (e) {
      var handle = e.detail.handle;
      var state = e.detail.added;
      document.querySelectorAll('[data-wishlist-btn][data-product-handle="' + handle + '"]').forEach(function (btn) {
        btn.classList.toggle('is-wishlisted', state);
        btn.setAttribute('aria-pressed', state ? 'true' : 'false');
        btn.setAttribute('aria-label', state ? 'Remove from wishlist' : 'Add to wishlist');
      });
    });

    /* Optional header counter badge */
    var counter = document.querySelector('[data-wishlist-count]');
    if (counter) {
      var n = window.Themr.wishlist.list().length;
      counter.textContent = String(n);
      counter.classList.toggle('is-hidden', n === 0);
      window.addEventListener('themr:wishlist-change', function (e) {
        counter.textContent = String(e.detail.count);
        counter.classList.toggle('is-hidden', e.detail.count === 0);
      });
    }
  }

  /* ── WISHLIST PAGE HYDRATION ── */
  function initWishlistPage() {
    var page = document.querySelector('[data-wishlist-page]');
    if (!page) return;
    var handles = window.Themr.wishlist.list();
    var empty = page.querySelector('.wishlist-empty');
    var grid = page.querySelector('.wishlist-grid');

    function currency() {
      return (window.Shopify && window.Shopify.currency && window.Shopify.currency.active) || 'USD';
    }
    function money(cents) {
      return (cents / 100).toFixed(2);
    }

    function render(products) {
      if (!grid) return;
      grid.innerHTML = '';
      products.filter(Boolean).forEach(function (p) {
        var card = document.createElement('article');
        card.className = 'wishlist-item';
        var img = p.featured_image || (p.images && p.images[0]) || '';
        card.innerHTML =
          '<a class="wishlist-item__link" href="/products/' + p.handle + '">' +
            (img ? '<img class="wishlist-item__image" src="' + img + '" alt="' + (p.title || '').replace(/"/g, '&quot;') + '" loading="lazy">' : '<div class="wishlist-item__placeholder" aria-hidden="true"></div>') +
            '<h3 class="wishlist-item__title">' + (p.title || '') + '</h3>' +
            '<p class="wishlist-item__price">' + money(p.price) + ' ' + currency() + '</p>' +
          '</a>' +
          '<button type="button" class="wishlist-item__remove" data-wishlist-remove="' + p.handle + '" aria-label="Remove ' + (p.title || '').replace(/"/g, '&quot;') + ' from wishlist">Remove</button>';
        grid.appendChild(card);
      });
      grid.querySelectorAll('[data-wishlist-remove]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var h = btn.getAttribute('data-wishlist-remove');
          window.Themr.wishlist.remove(h);
          var card = btn.closest('.wishlist-item');
          if (card) card.remove();
          if (!grid.children.length && empty) {
            empty.style.display = 'block';
            grid.style.display = 'none';
          }
        });
      });
    }

    if (!handles.length) {
      if (empty) empty.style.display = 'block';
      if (grid) grid.style.display = 'none';
      return;
    }

    Promise.all(handles.map(function (h) {
      return fetch('/products/' + h + '.js')
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    })).then(render);
  }

  /* ═══════════════════════════════════════════
     BUNDLE BUILDER — Pro-tier feature
     Wires "Add bundle to cart" buttons to the
     Shopify cart API. Resolves product handles
     to variant IDs via /products/<handle>.js,
     then POSTs a single /cart/add.js with all
     items. Discount codes are stashed in
     sessionStorage for the checkout page.
     ═══════════════════════════════════════════ */
  window.Themr = window.Themr || {};
  window.Themr.bundle = (function () {
    function parseHandles(raw) {
      if (!raw) return [];
      return String(raw).split(/[,\n]/).map(function (s) { return s.trim(); }).filter(Boolean);
    }

    function addBundle(handles, discountCode) {
      if (!handles || !handles.length) {
        return Promise.resolve({ ok: false, error: 'No products' });
      }
      return Promise.all(handles.map(function (h) {
        return fetch('/products/' + encodeURIComponent(h) + '.js')
          .then(function (r) { return r.ok ? r.json() : null; })
          .catch(function () { return null; });
      })).then(function (products) {
        var variantItems = products
          .filter(function (p) { return p && p.variants && p.variants.length; })
          .map(function (p) { return { id: p.variants[0].id, quantity: 1 }; });
        if (!variantItems.length) {
          return { ok: false, error: 'No products resolved' };
        }
        return fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ items: variantItems })
        }).then(function (res) {
          if (!res.ok) throw new Error('Cart add failed: ' + res.status);
          return res.json();
        }).then(function () {
          if (discountCode) {
            try { sessionStorage.setItem('themr:bundle-discount', discountCode); } catch (e) {}
          }
          window.dispatchEvent(new CustomEvent('themr:bundle-added', {
            detail: { handles: handles, discountCode: discountCode || '', count: variantItems.length }
          }));
          return { ok: true, count: variantItems.length };
        });
      }).catch(function (e) {
        return { ok: false, error: (e && e.message) || 'Unknown error' };
      });
    }

    return { addBundle: addBundle, parseHandles: parseHandles };
  })();

  function initBundleButtons() {
    var buttons = document.querySelectorAll('[data-bundle-add]');
    if (!buttons.length) return;

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var handles = window.Themr.bundle.parseHandles(btn.getAttribute('data-bundle-handles') || '');
        var discount = btn.getAttribute('data-bundle-discount') || '';
        if (!handles.length) return;

        var originalText = btn.textContent;
        btn.textContent = 'Adding…';
        btn.setAttribute('aria-busy', 'true');
        btn.disabled = true;

        window.Themr.bundle.addBundle(handles, discount).then(function (result) {
          btn.setAttribute('aria-busy', 'false');
          btn.disabled = false;
          if (result && result.ok) {
            btn.textContent = 'Added \u2713';
            setTimeout(function () {
              btn.textContent = originalText;
              /* Open cart-drawer if present; otherwise go to /cart */
              var drawer = document.querySelector('[data-cart-drawer]');
              if (drawer) {
                drawer.setAttribute('aria-hidden', 'false');
                drawer.classList.add('is-open');
                document.body.classList.add('cart-drawer-open');
              } else {
                window.location.href = '/cart' + (discount ? '?discount=' + encodeURIComponent(discount) : '');
              }
            }, 800);
          } else {
            btn.textContent = 'Try again';
            setTimeout(function () { btn.textContent = originalText; }, 2000);
          }
        });
      });
    });
  }

  /* ── CUSTOM INTERACTIONS (injected by AI) ── */
  

  /* ── INIT ── */
  document.addEventListener('DOMContentLoaded', function () {
    initAnnouncementBar();
    initHeaderScroll();
    initMobileNav();
    initDropdownNav();
    initMegaMenu();
    initHeroSlideshow();
    initScrollReveal();
    initHeroParallax();
    initNewsletterForm();
    initBackToTop();
    initWishlistButtons();
    initWishlistPage();
    initBundleButtons();
    
  });
})();