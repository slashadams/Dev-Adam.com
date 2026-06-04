/* ============================================
   dev-adam.com - Interactive Behaviors
   ============================================
   Handles mobile navigation, smooth interactions,
   and dynamic scroll spying (highlighting active sections).
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  // Mobile Navigation Drawer Toggle
  const mobileBtn = document.getElementById('mobile-menu-btn');
  const navLinks = document.getElementById('nav-links');

  if (mobileBtn && navLinks) {
    mobileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navLinks.classList.toggle('active');
      
      // Toggle icon between hamburger and close
      const icon = mobileBtn.querySelector('span');
      if (icon) {
        icon.textContent = navLinks.classList.contains('active') ? '✕' : '☰';
      }
    });

    // Close mobile menu when clicking a nav link
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('active');
        const icon = mobileBtn.querySelector('span');
        if (icon) icon.textContent = '☰';
      });
    });

    // Close menu when clicking outside of navigation header
    document.addEventListener('click', (e) => {
      if (!navLinks.contains(e.target) && !mobileBtn.contains(e.target)) {
        if (navLinks.classList.contains('active')) {
          navLinks.classList.remove('active');
          const icon = mobileBtn.querySelector('span');
          if (icon) icon.textContent = '☰';
        }
      }
    });
  }

  // Header Scroll Style
  const header = document.querySelector('header.site-header');
  if (header) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        header.style.backgroundColor = 'rgba(10, 10, 10, 0.85)';
        header.style.borderBottomColor = 'rgba(99, 102, 241, 0.2)';
      } else {
        header.style.backgroundColor = 'rgba(10, 10, 10, 0.75)';
        header.style.borderBottomColor = 'rgba(63, 63, 70, 0.3)';
      }
    });
  }

  // IntersectionObserver: ScrollSpy for Navigation Highlights
  const sections = document.querySelectorAll('section[id]');
  const navAnchors = document.querySelectorAll('.nav-links a[href*="#"]');

  if (sections.length > 0 && navAnchors.length > 0) {
    const observerOptions = {
      root: null,
      rootMargin: '-30% 0px -50% 0px',
      threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          navAnchors.forEach(anchor => {
            const href = anchor.getAttribute('href');
            if (href.endsWith('#' + id)) {
              anchor.classList.add('nav-anchor-active');
            } else {
              anchor.classList.remove('nav-anchor-active');
            }
          });
        }
      });
    }, observerOptions);

    sections.forEach(section => observer.observe(section));

    // Clear active status if scrolled to the top
    window.addEventListener('scroll', () => {
      if (window.scrollY < 100) {
        navAnchors.forEach(anchor => anchor.classList.remove('nav-anchor-active'));
      }
    });
  }

  // Smooth Scroll for Homepage Anchors
  document.querySelectorAll('a[href^="/#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const hash = this.getAttribute('href').split('#')[1];
      const targetElement = document.getElementById(hash);
      
      if (targetElement) {
        // If we are already on the page where the target element exists
        e.preventDefault();
        const headerOffset = 80;
        const elementPosition = targetElement.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

  // Console Easter Egg
  console.log('%c[dev-adam.com] Welcome to the neural matrix. Optimized with ❤️ by Antigravity.', 'color:#6366f1; font-size:10px; font-weight:bold;');
});