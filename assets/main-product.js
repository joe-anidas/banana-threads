// function toggleDescription(element) {
//     element.classList.toggle('active');
//     const content = element.nextElementSibling;
//     content.classList.toggle('active');
// }
  document.addEventListener('DOMContentLoaded', function() {
  // Tab switching functionality
  const tabs = document.querySelectorAll('.size-tab');
  const tables = document.querySelectorAll('.size-table');
  
  function hideAllTables() {
    tables.forEach(table => {
      table.style.display = 'none';
      table.classList.remove('active');
    });
  }
  
  function showTable(unit) {
    const tableToShow = document.querySelector(`.size-table[data-unit="${unit}"]`);
    if (tableToShow) {
      tableToShow.style.display = 'table';
      tableToShow.classList.add('active');
    }
  }
  
  // Initialize - hide all tables and show inches by default
  hideAllTables();
  showTable('inches');
  
  // Make inches tab active by default
  tabs.forEach(tab => {
    tab.classList.remove('active');
    if(tab.dataset.unit === 'inches') {
      tab.classList.add('active');
    }
  });
  
  // Set up tab click handlers
  tabs.forEach(tab => {
    tab.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Update active tab styling
      tabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      
      // Hide all tables and show the selected one
      const unit = this.dataset.unit;
      hideAllTables();
      showTable(unit);
    });
  });
});