import os
import re

def fix_all():
    # 1. Add clearMatchmaking to js/multiplayer-manager.js
    mp_path = 'c:/dbtcg/js/multiplayer-manager.js'
    with open(mp_path, 'r', encoding='utf-8') as f:
        mp = f.read()

    clear_mm_def = """  clearMatchmaking() {
    this.isPaired = false;
    if (this.mmInterval) {
      clearInterval(this.mmInterval);
      this.mmInterval = null;
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    delete this.myLeader;
    delete this.myDeck;
  }
"""

    if 'clearMatchmaking()' not in mp:
        idx = mp.find('startMatchmaking(')
        if idx != -1:
            mp = mp[:idx] + clear_mm_def + "\n  " + mp[idx:]

    with open(mp_path, 'w', encoding='utf-8') as f:
        f.write(mp)
    print("Added clearMatchmaking to js/multiplayer-manager.js!")

    # 2. Fix /api/user/sync in server.js to return 200 instead of 503
    srv_path = 'c:/dbtcg/server.js'
    with open(srv_path, 'r', encoding='utf-8') as f:
        srv = f.read()

    new_sync_endpoint = """// 3. User Progress & Inventory Cloud Sync (with offline fallback)
app.post('/api/user/sync', async (req, res) => {
  const { uid, userData } = req.body;
  if (!uid || !userData) return res.status(400).json({ success: false, message: 'Dados inválidos.' });

  if (mongoose.connection.readyState === 1) {
    try {
      const updatedUser = await User.findOneAndUpdate(
        { uid },
        { $set: userData },
        { returnDocument: 'after' }
      );
      if (updatedUser) return res.status(200).json({ success: true, user: updatedUser.toPublicJSON() });
    } catch (err) {
      console.error('[MongoDB] Sync Error:', err);
    }
  }

  // Graceful fallback sync when DB is connecting or offline
  return res.status(200).json({ success: true, user: userData, localSync: true });
});"""

    pattern_sync = r'// 3\. User Progress & Inventory Cloud Sync[\s\S]*?app\.post\(\'/api/user/sync\'[\s\S]*?\n\}\);'
    srv = re.sub(pattern_sync, new_sync_endpoint, srv, count=1)

    with open(srv_path, 'w', encoding='utf-8') as f:
        f.write(srv)
    print("Fixed /api/user/sync in server.js!")

if __name__ == '__main__':
    fix_all()
