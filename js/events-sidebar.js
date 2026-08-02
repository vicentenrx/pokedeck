// ═══════════════════════════════════════════════════════════════
// MOBILE SIDEBAR
// ═══════════════════════════════════════════════════════════════
function openSidebar()  { $('sidebar').classList.add('open'); $('sb-backdrop').classList.add('show'); }
function closeSidebar() { $('sidebar').classList.remove('open'); $('sb-backdrop').classList.remove('show'); }

$('mob-menu').addEventListener('click', openSidebar);
$('sb-backdrop').addEventListener('click', closeSidebar);

// ═══════════════════════════════════════════════════════════════
// COLOR PICKER
// ═══════════════════════════════════════════════════════════════
function buildColorPicker() {
  const row = $('color-row');
  row.innerHTML = '';
  COLORS.forEach(c => {
    const sw = document.createElement('div');
    sw.className = 'cswatch'+(c===selColor?' sel':'');
    sw.style.background = c;
    sw.addEventListener('click', () => {
      selColor = c;
      row.querySelectorAll('.cswatch').forEach(s=>s.classList.remove('sel'));
      sw.classList.add('sel');
    });
    row.appendChild(sw);
  });
}
