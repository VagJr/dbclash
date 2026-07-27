with open('c:/dbtcg/js/ui-manager.js', 'r', encoding='utf-8') as f:
    ui_text = f.read()

old_switch = """  switchTab(tabId) {
    this.sidebarItems.forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));"""

new_switch = """  switchTab(tabId) {
    const hideHeaderTabs = ['landing', 'arena'];
    document.body.classList.toggle('hide-header', hideHeaderTabs.includes(tabId));

    this.sidebarItems.forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));"""

if old_switch in ui_text:
    ui_text = ui_text.replace(old_switch, new_switch)
    with open('c:/dbtcg/js/ui-manager.js', 'w', encoding='utf-8') as f:
        f.write(ui_text)
    print('Updated switchTab in ui-manager.js!')
else:
    print('Pattern not found in ui-manager.js')

# Add CSS rules to main.css
hide_css = """

/* ── HIDE APP HEADER ON LANDING & ARENA ───────────────────────────────────── */
body.hide-header #app-header {
  display: none !important;
}

body.hide-header #app-content {
  margin-top: 0 !important;
  height: 100vh !important;
}
"""

with open('c:/dbtcg/styles/main.css', 'a', encoding='utf-8') as f:
    f.write(hide_css)

print('Added hide-header CSS rules to main.css!')
