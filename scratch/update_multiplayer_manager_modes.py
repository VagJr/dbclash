import os
import re

def update_multiplayer_manager():
    filepath = 'c:/dbtcg/js/multiplayer-manager.js'
    with open(filepath, 'r', encoding='utf-8') as f:
        mp = f.read()

    new_matchmaking_methods = """  startMatchmaking(mode = '1v1', leaderKey = 'goku', deck = null) {
    this.mode = mode;
    this.isMultiplayer = true;
    this.isPaired = false;
    this.engine.multiplayerMode = mode;
    
    const mmModal = document.getElementById('matchmaking-modal');
    const mmTimer = document.getElementById('mm-timer');
    const cancelBtn = document.getElementById('mm-cancel-btn');
    
    if (mmModal) mmModal.classList.add('active');
    
    let seconds = 0;
    if (mmTimer) mmTimer.textContent = '15s';
    
    this.clearMatchmaking();
    
    const baseUid = (typeof authManager !== 'undefined' && authManager.user?.uid) 
      ? authManager.user.uid 
      : 'user';
    this.myUid = baseUid + '_' + Math.random().toString(36).substring(2, 11);
    const pLeader = leaderKey || (typeof authManager !== 'undefined' && authManager.user?.selectedLeader) || 'goku';
    this.pendingLeaderKey = pLeader;
    
    const myUsername = (typeof authManager !== 'undefined' && authManager.user?.displayName) 
      ? authManager.user.displayName : 'Guerreiro Z';
    
    const finalDeck = (Array.isArray(deck) && deck.length >= 5) ? deck : deckBuilder.getDeckForLeader(pLeader);

    this.myLeader = pLeader;
    this.myDeck = finalDeck;

    this.lastUserData = {
      uid: this.myUid,
      username: myUsername,
      leader: pLeader,
      deck: finalDeck,
      mode
    };

    console.log(`[MultiplayerManager] Entering ${mode.toUpperCase()} queue as: ${myUsername}`);

    socketManager.emit('join_matchmaking', this.lastUserData);

    this.mmInterval = setInterval(() => {
      seconds++;
      const remaining = Math.max(0, 15 - seconds);
      if (mmTimer) mmTimer.textContent = `${remaining}s`;
      
      // Matchmaking timer: Trigger Bot AI fallback automatically after 15 seconds
      if (seconds >= 15) {
        socketManager.emit('leave_matchmaking');
        this.fallbackToBot(mode, pLeader, finalDeck);
      }
    }, 1000);

    if (cancelBtn) {
      cancelBtn.onclick = () => {
        socketManager.emit('leave_matchmaking');
        this.clearMatchmaking();
        if (mmModal) mmModal.classList.remove('active');
      };
    }
  }

  startRanked1v1Matchmaking(leaderKey, deck) {
    return this.startMatchmaking('1v1', leaderKey, deck);
  }

  startRanked2v2(leaderKey, deck) {
    return this.startMatchmaking('2v2', leaderKey, deck);
  }

  startCoOpRaid(bossId = 'cell_max', leaderKey = 'goku') {
    return this.startMatchmaking('raid', leaderKey);
  }

  startSyncedMatch(pLeader, oLeader, setupObj, mode = '1v1') {
    this.engine.multiplayerMode = mode;
    this.engine.startMatch(pLeader, oLeader, [], false, setupObj);

    if (mode === '2v2') {
      this.engine.p1 = this.engine.player;
      this.engine.p2 = this.engine.opponent;
      this.engine.p3 = { name: 'Gohan (Aliado)', leader: { ...LEADERS.gohan }, hp: 400, maxHp: 400, shields: 8, ki: 4, isAwakened: false, hand: [], deck: getStarterDeckForLeader('gohan') };
      this.engine.p4 = { name: 'Frieza (Oponente 2)', leader: { ...LEADERS.frieza }, hp: 400, maxHp: 400, shields: 8, ki: 5, isAwakened: false, hand: [], deck: getStarterDeckForLeader('frieza') };
      this.engine.turnOrder = ['p1', 'p2', 'p3', 'p4'];
    } else if (mode === 'raid') {
      const bossData = RAID_BOSSES.cell_max;
      this.engine.p2 = {
        name: bossData.name,
        leader: {
          id: bossData.id,
          name: bossData.name,
          awakenedName: `${bossData.name} (FÚRIA TOTAL)`,
          maxHp: bossData.hp,
          color: bossData.color,
          awakenThresholdHp: Math.floor(bossData.hp * 0.5)
        },
        hp: bossData.hp,
        maxHp: bossData.hp,
        shields: 12,
        ki: 6,
        isAwakened: false,
        isOpenGuard: false,
        hand: [],
        deck: getStarterDeckForLeader('frieza')
      };
      this.engine.p1 = this.engine.player;
      this.engine.p3 = { name: 'Vegeta (P2)', leader: { ...LEADERS.vegeta }, hp: 400, maxHp: 400, shields: 8, ki: 4, isAwakened: false, hand: [], deck: getStarterDeckForLeader('vegeta') };
      this.engine.p5 = { name: 'Gohan (P3)', leader: { ...LEADERS.gohan }, hp: 400, maxHp: 400, shields: 8, ki: 4, isAwakened: false, hand: [], deck: getStarterDeckForLeader('gohan') };
      this.engine.p6 = { name: 'Trunks (P4)', leader: { ...LEADERS.trunks }, hp: 400, maxHp: 400, shields: 8, ki: 4, isAwakened: false, hand: [], deck: getStarterDeckForLeader('trunks') };
      this.engine.turnOrder = ['p1', 'p3', 'p5', 'p6', 'p2'];
    } else {
      this.engine.p1 = this.engine.player;
      this.engine.p2 = this.engine.opponent;
      this.engine.turnOrder = ['p1', 'p2'];
    }

    sceneManager.switchScene(GAME_SCENES.ARENA);
    this.engine.notifyState();
  }

  fallbackToBot(mode, pLeader, finalDeck) {
    this.clearMatchmaking();
    const mmModal = document.getElementById('matchmaking-modal');
    if (mmModal) mmModal.classList.remove('active');

    this.isMultiplayer = false;
    this.engine.multiplayerMode = mode;

    if (mode === '2v2') {
      if (typeof uiManager !== 'undefined' && uiManager) {
        uiManager.triggerActionBanner('DUETO 2V2 INICIADO!', 'act-attack', 'TIME A VS TIME B');
      }
      this.engine.startMatch(pLeader, 'vegeta', finalDeck, true);

      this.engine.p1 = this.engine.player; // Team A Member 1 (You)
      this.engine.p2 = this.engine.opponent; // Team B Member 1 (Vegeta)
      this.engine.p3 = { name: 'Gohan (Parceiro)', leader: { ...LEADERS.gohan }, hp: 400, maxHp: 400, shields: 8, ki: 4, isAwakened: false, hand: [], deck: getStarterDeckForLeader('gohan') }; // Team A Member 2
      this.engine.p4 = { name: 'Frieza (Oponente 2)', leader: { ...LEADERS.frieza }, hp: 400, maxHp: 400, shields: 8, ki: 5, isAwakened: false, hand: [], deck: getStarterDeckForLeader('frieza') }; // Team B Member 2

      this.engine.turnOrder = ['p1', 'p2', 'p3', 'p4'];

    } else if (mode === 'raid') {
      const bossData = RAID_BOSSES.cell_max;

      if (typeof uiManager !== 'undefined' && uiManager) {
        uiManager.triggerActionBanner(`MODO RAID CO-OP: ${bossData.name.toUpperCase()}`, 'act-attack', '4 GUERREIROS Z VS CHEFÃO GIGANTE');
      }

      this.engine.startMatch(pLeader, 'frieza', finalDeck, true);

      this.engine.opponent = {
        name: bossData.name,
        leader: {
          id: bossData.id,
          name: bossData.name,
          awakenedName: `${bossData.name} (FÚRIA TOTAL)`,
          maxHp: bossData.hp,
          color: bossData.color,
          awakenThresholdHp: Math.floor(bossData.hp * 0.5)
        },
        hp: bossData.hp,
        maxHp: bossData.hp,
        shields: 12,
        ki: 6,
        isAwakened: false,
        isOpenGuard: false,
        hand: [],
        deck: getStarterDeckForLeader('frieza')
      };

      this.engine.p1 = this.engine.player;
      this.engine.p2 = this.engine.opponent;
      this.engine.p3 = { name: 'Vegeta (P2)', leader: { ...LEADERS.vegeta }, hp: 400, maxHp: 400, shields: 8, ki: 4, isAwakened: false, hand: [], deck: getStarterDeckForLeader('vegeta') };
      this.engine.p5 = { name: 'Gohan (P3)', leader: { ...LEADERS.gohan }, hp: 400, maxHp: 400, shields: 8, ki: 4, isAwakened: false, hand: [], deck: getStarterDeckForLeader('gohan') };
      this.engine.p6 = { name: 'Trunks (P4)', leader: { ...LEADERS.trunks }, hp: 400, maxHp: 400, shields: 8, ki: 4, isAwakened: false, hand: [], deck: getStarterDeckForLeader('trunks') };

      this.engine.turnOrder = ['p1', 'p3', 'p5', 'p6', 'p2'];

    } else {
      if (typeof uiManager !== 'undefined' && uiManager) {
        uiManager.triggerActionBanner('DESAFIANTE ENCONTRADO!', 'act-attack', '1V1 DUELO RANKED');
      }
      this.engine.startMatch(pLeader, 'vegeta', finalDeck, true);
      this.engine.p1 = this.engine.player;
      this.engine.p2 = this.engine.opponent;
      this.engine.turnOrder = ['p1', 'p2'];
    }

    sceneManager.switchScene(GAME_SCENES.ARENA);
    this.engine.notifyState();
  }"""

    pattern_mm = r'  startRanked1v1Matchmaking\(leaderKey, deck\) \{[\s\S]*?\n  startCoOpRaid[\s\S]*?\n  \}'
    mp = re.sub(pattern_mm, new_matchmaking_methods, mp, count=1)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(mp)
    print("Updated js/multiplayer-manager.js with 15s timer matchmaking and full mode support!")

if __name__ == '__main__':
    update_multiplayer_manager()
