# Deployment Guide - Tarneeb AI

## 🚀 Two Deployment Options

### Option 1: Single-Player Game (Static Deployment)
**Best for**: Quick demo, portfolio, testing  
**Features**: AI opponents, complete game logic, beautiful UI  
**Requirements**: None (no backend needed)

### Option 2: Real Multiplayer Game (Supabase + Hosting)
**Best for**: Production use, real multiplayer experience  
**Features**: Everything from Option 1 + real-time multiplayer  
**Requirements**: Supabase account (free tier available)

---

## 🎯 Quick Start - Single Player

### Deploy to GitHub Pages (Free)

1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/TarneebAI.git
   git push -u origin main
   ```

2. **Install deployment dependencies**:
   ```bash
   npm install --save-dev gh-pages
   ```

3. **Deploy**:
   ```bash
   npm run deploy
   ```

4. **Enable GitHub Pages**:
   - Go to repository Settings → Pages
   - Source: "Deploy from branch" → `gh-pages`
   - Your game will be live at: `https://yourusername.github.io/TarneebAI/`

### Alternative: Netlify (Recommended)

1. **Connect Repository**:
   - Go to [netlify.com](https://netlify.com) → "New site from Git"
   - Connect your GitHub repository

2. **Configure Build**:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Deploy!

3. **Custom Domain** (optional):
   - Domain settings → Add custom domain
   - Configure DNS with your provider

---

## 🌟 Full Setup - Real Multiplayer

### Step 1: Supabase Backend Setup

1. **Create Supabase Project**:
   ```bash
   # Go to supabase.com → New Project
   # Choose: tarneeb-multiplayer, generate password, select region
   ```

2. **Get Credentials**:
   - Dashboard → Settings → API
   - Copy: Project URL & Anon Key

3. **Setup Database**:
   ```sql
   -- In Supabase SQL Editor, run this schema:
   
   -- Enable real-time
   alter publication supabase_realtime add table games;
   alter publication supabase_realtime add table players;
   alter publication supabase_realtime add table game_states;

   -- Games table
   CREATE TABLE IF NOT EXISTS games (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     room_code TEXT UNIQUE NOT NULL,
     status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Players table
   CREATE TABLE IF NOT EXISTS players (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     game_id UUID REFERENCES games(id) ON DELETE CASCADE,
     player_name TEXT NOT NULL,
     position INTEGER CHECK (position >= 1 AND position <= 4),
     is_host BOOLEAN DEFAULT false,
     connected BOOLEAN DEFAULT true,
     hand JSONB DEFAULT '[]',
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     UNIQUE(game_id, position)
   );

   -- Game states table  
   CREATE TABLE IF NOT EXISTS game_states (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     game_id UUID REFERENCES games(id) ON DELETE CASCADE,
     phase TEXT DEFAULT 'bidding' CHECK (phase IN ('waiting', 'bidding', 'trump-selection', 'playing', 'round-complete', 'game-finished')),
     current_player INTEGER CHECK (current_player >= 1 AND current_player <= 4),
     game_data JSONB DEFAULT '{}',
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Enable Row Level Security
   ALTER TABLE games ENABLE ROW LEVEL SECURITY;
   ALTER TABLE players ENABLE ROW LEVEL SECURITY;
   ALTER TABLE game_states ENABLE ROW LEVEL SECURITY;

   -- RLS Policies
   CREATE POLICY "Allow all operations on games" ON games FOR ALL USING (true);
   CREATE POLICY "Allow all operations on players" ON players FOR ALL USING (true);
   CREATE POLICY "Allow all operations on game_states" ON game_states FOR ALL USING (true);

   -- Indexes
   CREATE INDEX IF NOT EXISTS idx_games_room_code ON games(room_code);
   CREATE INDEX IF NOT EXISTS idx_players_game_id ON players(game_id);
   CREATE INDEX IF NOT EXISTS idx_game_states_game_id ON game_states(game_id);
   ```

4. **Enable Real-time**:
   - Database → Replication
   - Enable for: `games`, `players`, `game_states`

### Step 2: Environment Configuration

Create `.env` file:
```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**⚠️ Security**: Add `.env` to `.gitignore`

### Step 3: Deploy with Multiplayer

#### Option A: Netlify (Recommended)

1. **Connect Repository**:
   - Netlify → New site from Git → Choose repo

2. **Environment Variables**:
   - Site Settings → Environment Variables
   - Add: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

3. **Build Settings**:
   - Build command: `npm run build`
   - Publish directory: `dist`

4. **Deploy**: Automatic on every push!

#### Option B: Vercel

1. **Connect Repository**:
   - [vercel.com](https://vercel.com) → Import Project

2. **Environment Variables**:
   - Project Settings → Environment Variables
   - Add Supabase credentials

3. **Deploy**: Automatic!

#### Option C: GitHub Pages + GitHub Secrets

1. **Add Secrets**:
   - Repository → Settings → Secrets and Variables → Actions
   - Add: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

2. **GitHub Actions** (create `.github/workflows/deploy.yml`):
   ```yaml
   name: Deploy to GitHub Pages
   on:
     push:
       branches: [ main ]
   
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - uses: actions/setup-node@v3
           with:
             node-version: '18'
             cache: 'npm'
         
         - run: npm install
         - run: npm run build
           env:
             VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
             VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
         
         - uses: peaceiris/actions-gh-pages@v3
           with:
             github_token: ${{ secrets.GITHUB_TOKEN }}
             publish_dir: ./dist
   ```

---

## 🧪 Testing Your Deployment

### Single-Player Testing
1. Visit your deployed URL
2. Click "Single Player Game"
3. Enter name → Start Game
4. Test bidding, trump selection, card play

### Multiplayer Testing
1. **Create Game**:
   - Visit deployed URL
   - "Create Game Room" → Copy room code

2. **Join Game** (new browser/device):
   - "Join Game Room" → Enter room code

3. **Test Real-time**:
   - Start game → Verify all players see updates
   - Play cards → Check real-time synchronization
   - Monitor Supabase dashboard for activity

---

## 📊 Monitoring & Analytics

### Supabase Dashboard
- **Database**: Monitor table activity
- **Logs**: Real-time error tracking  
- **API**: Usage statistics
- **Real-time**: Connection monitoring

### Performance Optimization
- **Netlify**: Automatic CDN, compression
- **Vercel**: Edge functions, analytics
- **GitHub Pages**: Basic hosting metrics

---

## 🔧 Troubleshooting

### Common Issues

**Build Fails**:
```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build
```

**Environment Variables Not Working**:
- Verify variable names start with `VITE_`
- Check hosting platform environment setup
- Restart deployment after adding variables

**Supabase Connection Issues**:
- Verify credentials in Supabase dashboard
- Check browser console for CORS errors
- Ensure RLS policies are active

**Real-time Not Working**:
- Confirm replication enabled for all tables
- Check Supabase real-time logs
- Verify WebSocket connections in browser dev tools

### Support
- **Supabase Issues**: [supabase.com/docs](https://supabase.com/docs)
- **Deployment Issues**: Check hosting platform docs
- **Game Issues**: Review browser console errors

---

## 🎯 Production Recommendations

### Security
- Implement proper RLS policies (restrict by user)
- Add rate limiting for API calls
- Consider user authentication for persistent profiles

### Performance
- Enable compression on hosting platform
- Monitor Supabase usage and upgrade if needed
- Implement connection pooling for high traffic

### Features to Add
- User accounts and game history
- Tournament brackets
- Spectator mode
- Game replay system
- Mobile app version

---

**🚀 Your Tarneeb multiplayer game is now ready for the world!** 

Share your room codes and enjoy authentic Tarneeb gameplay with friends globally! 🃏 