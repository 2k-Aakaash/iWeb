const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');

searchForm.addEventListener('submit', (event) => {
event.preventDefault();
const searchTerm = searchInput.value.trim();

if (isValidURL(searchTerm)) {
const url = `http://${searchTerm}`;
window.location.href = url;
} else if (searchTerm !== '') {
const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchTerm)}`;
window.location.href = searchUrl;
}
});

searchInput.addEventListener('keydown', (event) => {
    // Check if the user pressed Ctrl+Enter (or Command+Enter on Mac)
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      const searchTerm = searchInput.value.trim();
      const shortcutUrl = `http://${searchTerm}.com`;
      window.location.href = shortcutUrl;
    }
  });

function isValidURL(url) {
const urlPattern = /^([a-z]+:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+([/?].*)?$/i;
return urlPattern.test(url);
}

function toggleExpand() {
const bookmarkBox = document.getElementById('bookmark-box');
const toggleIcon = document.getElementById('toggle-icon');

bookmarkBox.classList.toggle('collapsed');
bookmarkBox.classList.toggle('expanded');
toggleIcon.classList.toggle('collapse');
toggleIcon.classList.toggle('expand');
}