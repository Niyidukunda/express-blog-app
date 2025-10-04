// Search Functionality
function searchPosts() {
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  const postCards = document.querySelectorAll('.post-card');
  
  if (!searchTerm.trim()) {
    // Show all posts if search is empty
    postCards.forEach(card => {
      card.style.display = 'block';
    });
    return;
  }
  
  postCards.forEach(card => {
    const title = card.querySelector('h2')?.textContent.toLowerCase() || '';
    const content = card.querySelector('.post-content')?.textContent.toLowerCase() || '';
    const category = card.querySelector('.category-badge')?.textContent.toLowerCase() || '';
    
    if (title.includes(searchTerm) || content.includes(searchTerm) || category.includes(searchTerm)) {
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });
}

// Real-time search as user types
document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', searchPosts);
  }
});

// Category Filter Functionality
function filterByCategory(category) {
  const postCards = document.querySelectorAll('.post-card');
  const filterBtns = document.querySelectorAll('.filter-btn');
  
  // Update active button
  filterBtns.forEach(btn => btn.classList.remove('active'));
  if (event && event.target) {
    event.target.classList.add('active');
  }
  
  // Filter posts
  postCards.forEach(card => {
    const postCategory = card.querySelector('.category-badge')?.textContent || '';
    
    if (category === 'all' || postCategory === category) {
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });
  
  // Clear search when filtering by category
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.value = '';
  }
}