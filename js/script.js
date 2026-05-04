/* ============================================
   dev-adam.com - Interactive Behaviors
   ============================================
   Handles mobile navigation, smooth interactions,
   and future extensibility (modals, filters, etc.)
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  // Mobile Navigation Toggle
  const mobileBtn = document.getElementById('mobile-menu-btn');
  const navLinks = document.getElementById('nav-links');

  if (mobileBtn && navLinks) {
    mobileBtn.addEventListener('click', () => {
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
  }

  // Optional: Add subtle scroll progress indicator (future enhancement)
  // Can be expanded later for analytics or more features.

  // Console Easter Egg
  console.log('%c[dev-adam.com] Welcome to the dark side of the web. Built with ❤️ by Peter Parser.', 'color:#6366f1; font-size:9px');
});

/* 
  Future Ideas (commented for clarity):
  - Project filtering by tag
  - Light/dark toggle (currently locked to dark)
  - Contact form submission handler (with Netlify/EmailJS)
  - IntersectionObserver for scroll animations
*/