import os

def patch_all():
    # 1. Update index.html cache busters
    html_path = 'c:/dbtcg/index.html'
    with open(html_path, 'r', encoding='utf-8') as f:
        html = f.read()

    html = html.replace('?v=realtime_firebase_v3', '?v=v5_layout_fix')
    html = html.replace("import { UIManager } from './js/ui-manager.js';", "import { UIManager } from './js/ui-manager.js?v=v5_layout_fix';")

    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html)
    print("Updated index.html cache busters to v5_layout_fix!")

    # 2. Update server.js
    server_path = 'c:/dbtcg/server.js'
    with open(server_path, 'r', encoding='utf-8') as f:
        srv = f.read()

    old_srv_queue = "const matchmakingQueue = [];"
    new_srv_queue = """const matchmakingQueues = {
  '1v1': [],
  '2v2': [],
  'raid': []
};
const matchmakingQueue = matchmakingQueues['1v1'];"""

    srv = srv.replace(old_srv_queue, new_srv_queue)

    old_join = """  socket.on('join_matchmaking', (userData) => {
    socket.userData = userData || { uid: socket.id, username: 'Guerreiro Z', leader: 'goku', deck: [] };
    
    // Remove if already in queue to avoid duplicates
    const existingIndex = matchmakingQueue.findIndex(s => s.id === socket.id || (s.userData && s.userData.uid === socket.userData.uid));
    if (existingIndex !== -1) {
      matchmakingQueue.splice(existingIndex, 1);
    }

    if (matchmakingQueue.length > 0) {"""

    new_join = """  socket.on('join_matchmaking', (userData) => {
    socket.userData = userData || { uid: socket.id, username: 'Guerreiro Z', leader: 'goku', deck: [], mode: '1v1' };
    const reqMode = socket.userData.mode || '1v1';
    const targetQueue = matchmakingQueues[reqMode] || matchmakingQueues['1v1'];

    // Remove if already in queue
    Object.values(matchmakingQueues).forEach(q => {
      const idx = q.findIndex(s => s.id === socket.id || (s.userData && s.userData.uid === socket.userData.uid));
      if (idx !== -1) q.splice(idx, 1);
    });

    if (targetQueue.length > 0) {
      const opponentSocket = targetQueue.shift();"""

    srv = srv.replace(old_join, new_join)

    old_emit_host = """        initiative: initiative
      });"""

    new_emit_host = """        initiative: initiative,
        mode: reqMode
      });"""

    srv = srv.replace(old_emit_host, new_emit_host)

    old_push = """      matchmakingQueue.push(socket);
      socket.emit('waiting_for_opponent');
      console.log(`[Matchmaking] ${socket.userData.username} added to queue (Total in queue: ${matchmakingQueue.length})`);"""

    new_push = """      targetQueue.push(socket);
      socket.emit('waiting_for_opponent');
      console.log(`[Matchmaking] ${socket.userData.username} added to ${reqMode} queue (Total: ${targetQueue.length})`);"""

    srv = srv.replace(old_push, new_push)

    with open(server_path, 'w', encoding='utf-8') as f:
        f.write(srv)
    print("Updated server.js queue mode separation!")

    # 3. Update dbtcg-render-server/server.js if exists
    render_srv_path = 'c:/dbtcg/dbtcg-render-server/server.js'
    if os.path.exists(render_srv_path):
        with open(render_srv_path, 'w', encoding='utf-8') as f:
            f.write(srv)
        print("Updated dbtcg-render-server/server.js successfully!")

    # 4. Update js/multiplayer-manager.js match_found listener
    mp_path = 'c:/dbtcg/js/multiplayer-manager.js'
    with open(mp_path, 'r', encoding='utf-8') as f:
        mp = f.read()

    old_mf = """      this.startSyncedMatch(pLeader, payload.opponent.leader || payload.opponent.username, setupObj);"""
    new_mf = """      const reqMode = payload.mode || this.mode || '1v1';
      this.engine.multiplayerMode = reqMode;
      this.startSyncedMatch(pLeader, payload.opponent.leader || payload.opponent.username, setupObj, reqMode);"""

    mp = mp.replace(old_mf, new_mf)

    old_ssm = """  startSyncedMatch(pLeader, oLeader, setupObj) {
    this.engine.multiplayerMode = '1v1';
    this.engine.startMatch(pLeader, oLeader, [], false, setupObj);
    sceneManager.switchScene(GAME_SCENES.ARENA);
  }"""

    new_ssm = """  startSyncedMatch(pLeader, oLeader, setupObj, mode = '1v1') {
    this.engine.multiplayerMode = mode;
    this.engine.startMatch(pLeader, oLeader, [], false, setupObj);
    sceneManager.switchScene(GAME_SCENES.ARENA);
    this.engine.notifyState();
  }"""

    mp = mp.replace(old_ssm, new_ssm)

    with open(mp_path, 'w', encoding='utf-8') as f:
        f.write(mp)
    print("Updated multiplayer-manager.js match_found handler!")

if __name__ == '__main__':
    patch_all()
