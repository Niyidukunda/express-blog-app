// Theme Toggle Functionality
function toggleTheme() {
  try {
    console.log('Theme toggle function called');
    const body = document.body;
    const moonIcon = document.querySelector('.theme-moon');
    const sunIcon = document.querySelector('.theme-sun');
    
    console.log('Body element:', body);
    console.log('Moon icon:', moonIcon);
    console.log('Sun icon:', sunIcon);
    
    const currentTheme = body.getAttribute('data-theme');
    console.log('Current theme:', currentTheme);
    
    if (currentTheme === 'dark') {
      // Switch to light theme
      body.removeAttribute('data-theme');
      if (moonIcon) {
        moonIcon.style.display = 'block';
        moonIcon.style.visibility = 'visible';
      }
      if (sunIcon) {
        sunIcon.style.display = 'none';
        sunIcon.style.visibility = 'hidden';
      }
      localStorage.setItem('theme', 'light');
      console.log('Switched to light theme');
    } else {
      // Switch to dark theme
      body.setAttribute('data-theme', 'dark');
      if (moonIcon) {
        moonIcon.style.display = 'none';
        moonIcon.style.visibility = 'hidden';
      }
      if (sunIcon) {
        sunIcon.style.display = 'block';
        sunIcon.style.visibility = 'visible';
      }
      localStorage.setItem('theme', 'dark');
      console.log('Switched to dark theme');
    }
    
    // Force a style recalculation
    body.offsetHeight;
    
  } catch (error) {
    console.error('Error in toggleTheme:', error);
    alert('Theme toggle error: ' + error.message);
  }
}

// Load saved theme on page load
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded, applying saved theme');
  const savedTheme = localStorage.getItem('theme');
  const moonIcon = document.querySelector('.theme-moon');
  const sunIcon = document.querySelector('.theme-sun');
  
  console.log('Saved theme:', savedTheme);
  
  if (savedTheme === 'dark') {
    document.body.setAttribute('data-theme', 'dark');
    if (moonIcon) moonIcon.style.display = 'none';
    if (sunIcon) sunIcon.style.display = 'block';
  } else {
    document.body.removeAttribute('data-theme');
    if (moonIcon) moonIcon.style.display = 'block';
    if (sunIcon) sunIcon.style.display = 'none';
  }
});