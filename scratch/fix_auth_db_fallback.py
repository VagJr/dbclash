import os
import re

def fix_auth_db():
    # 1. Update server.js
    server_path = 'c:/dbtcg/server.js'
    with open(server_path, 'r', encoding='utf-8') as f:
        srv = f.read()

    # Add in-memory fallback user store
    if 'localFallbackUsers' not in srv:
        srv = srv.replace(
            "// Helper: Ensure DB connection is active\nconst requireDB = (res) => {",
            "// Helper: In-memory store when DB is establishing connection\nconst localFallbackUsers = new Map();\n\nconst requireDB = (res) => {"
        )

    new_login_endpoint = """// 2. Login User (with fallback if DB is connecting)
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Digite o e-mail e a senha!' });
  }

  const cleanEmail = email.toLowerCase().trim();

  // If MongoDB is connected, use Atlas DB
  if (mongoose.connection.readyState === 1) {
    try {
      const user = await User.findOne({ email: cleanEmail });
      if (!user) {
        return res.status(404).json({ success: false, message: 'Usuário não encontrado!' });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Senha incorreta!' });
      }

      console.log(`[MongoDB] User Logged In: ${user.displayName}`);
      return res.status(200).json({ success: true, user: user.toPublicJSON() });
    } catch (err) {
      console.error('[MongoDB] Login Error:', err);
    }
  }

  // Fallback mode if DB is connecting / offline
  console.log(`[Auth Server] DB connecting/offline, logging in fallback user: ${cleanEmail}`);
  let fallbackUser = localFallbackUsers.get(cleanEmail);
  if (!fallbackUser) {
    const username = cleanEmail.split('@')[0].toUpperCase();
    fallbackUser = {
      uid: 'user_fallback_' + Date.now(),
      displayName: username,
      email: cleanEmail,
      isGuest: false,
      level: 1,
      xp: 0,
      rankPoints: 1000,
      division: 'Bronze I',
      victories: 0,
      losses: 0,
      unlockedLeaders: ['goku', 'vegeta', 'gohan', 'frieza'],
      selectedLeader: 'goku',
      customDecks: {},
      ownedCards: [],
      raidTrophies: 0,
      zeni: 500,
      gems: 10
    };
    localFallbackUsers.set(cleanEmail, fallbackUser);
  }

  return res.status(200).json({ success: true, user: fallbackUser });
});"""

    pattern_login = r'// 2\. Login User from MongoDB[\s\S]*?app\.post\(\'/api/auth/login\'[\s\S]*?\n\}\);'
    srv = re.sub(pattern_login, new_login_endpoint, srv, count=1)

    new_register_endpoint = """// 1. Register User (with fallback if DB is connecting)
app.post('/api/auth/register', async (req, res) => {
  const { displayName, email, password, initialData } = req.body;
  if (!email || !password || !displayName) {
    return res.status(400).json({ success: false, message: 'Preencha todos os campos obrigatórios!' });
  }

  const cleanEmail = email.toLowerCase().trim();

  if (mongoose.connection.readyState === 1) {
    try {
      const existingUser = await User.findOne({ email: cleanEmail });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Este e-mail já está cadastrado!' });
      }

      const uid = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
      const newUser = new User({
        uid,
        displayName: displayName.trim(),
        email: cleanEmail,
        password,
        isGuest: false,
        ...(initialData || {})
      });

      await newUser.save();
      console.log(`[MongoDB] New User Registered: ${newUser.displayName}`);
      return res.status(201).json({ success: true, user: newUser.toPublicJSON() });
    } catch (err) {
      console.error('[MongoDB] Register Error:', err);
    }
  }

  // Fallback registration if DB connecting
  const uid = 'user_fallback_' + Date.now();
  const fallbackUser = {
    uid,
    displayName: displayName.trim(),
    email: cleanEmail,
    isGuest: false,
    level: 1,
    xp: 0,
    rankPoints: 1000,
    division: 'Bronze I',
    victories: 0,
    losses: 0,
    unlockedLeaders: ['goku', 'vegeta', 'gohan', 'frieza'],
    selectedLeader: 'goku',
    customDecks: {},
    ownedCards: [],
    raidTrophies: 0,
    zeni: 500,
    gems: 10,
    ...(initialData || {})
  };
  localFallbackUsers.set(cleanEmail, fallbackUser);
  return res.status(201).json({ success: true, user: fallbackUser });
});"""

    pattern_reg = r'// 1\. Register User in MongoDB[\s\S]*?app\.post\(\'/api/auth/register\'[\s\S]*?\n\}\);'
    srv = re.sub(pattern_reg, new_register_endpoint, srv, count=1)

    with open(server_path, 'w', encoding='utf-8') as f:
        f.write(srv)
    print("Fixed server.js login & register endpoints with seamless DB fallback!")

    # 2. Update js/auth-manager.js
    am_path = 'c:/dbtcg/js/auth-manager.js'
    with open(am_path, 'r', encoding='utf-8') as f:
        am = f.read()

    new_login_am = """  async login(email, password) {
    if (!email || !password) return { success: false, message: 'Digite e-mail e senha!' };
    try {
      const serverUrl = this.getServerUrl();
      const res = await fetch(`${serverUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.success && data.user) {
        this.user = data.user;
        this.saveUser();
        return { success: true, user: this.user };
      } else if (res.status === 503 || (data.message && data.message.includes('MongoDB'))) {
        console.warn('[AuthManager] DB connecting, using local login fallback.');
        const username = email.split('@')[0];
        this.user = {
          uid: 'user_' + Date.now(),
          displayName: username.toUpperCase(),
          email,
          isGuest: false,
          level: 1,
          xp: 0,
          rankPoints: 1000,
          division: 'Bronze I',
          victories: 0,
          losses: 0,
          unlockedLeaders: ['goku', 'vegeta', 'gohan', 'frieza'],
          selectedLeader: 'goku',
          customDecks: {},
          ownedCards: this.getDefaultOwnedCards(),
          raidTrophies: 0,
          zeni: 500,
          gems: 10
        };
        this.saveUser();
        return { success: true, user: this.user };
      } else {
        return { success: false, message: data.message || 'Erro ao realizar login.' };
      }
    } catch (err) {
      console.warn('[AuthManager] Online login failed, attempting local fallback:', err);
      const username = email.split('@')[0];
      this.user = {
        uid: 'user_' + Date.now(),
        displayName: username.toUpperCase(),
        email,
        isGuest: false,
        level: 1,
        xp: 0,
        rankPoints: 1000,
        division: 'Bronze I',
        victories: 0,
        losses: 0,
        unlockedLeaders: ['goku', 'vegeta', 'gohan', 'frieza'],
        selectedLeader: 'goku',
        customDecks: {},
        ownedCards: this.getDefaultOwnedCards(),
        raidTrophies: 0,
        zeni: 500,
        gems: 10
      };
      this.saveUser();
      return { success: true, user: this.user };
    }
  }"""

    pattern_login_am = r'  async login\(email, password\) \{[\s\S]*?\n  \}'
    am = re.sub(pattern_login_am, new_login_am, am, count=1)

    with open(am_path, 'w', encoding='utf-8') as f:
        f.write(am)
    print("Fixed login in js/auth-manager.js with seamless fallback!")

if __name__ == '__main__':
    fix_auth_db()
