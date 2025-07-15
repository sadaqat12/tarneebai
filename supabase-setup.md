# Supabase Setup for Tarneeb Multiplayer

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click "New Project" 
3. Choose your organization and enter project details:
   - **Name**: `tarneeb-multiplayer`
   - **Database Password**: Generate a strong password
   - **Region**: Choose closest to your users
4. Wait for project creation (2-3 minutes)

## Step 2: Get Project Credentials

1. In your Supabase dashboard, go to **Settings** > **API**
2. Copy these values:
   - **Project URL**: `https://your-project-ref.supabase.co`
   - **Anon/Public Key**: `eyJhbGciOiJIUzI1NiIs...` (long string)

## Step 3: Create Environment File

Create a `.env` file in your project root:

```bash
# .env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...your-actual-key
```

**⚠️ Important**: 
- Replace with your actual values from Step 2
- Add `.env` to `.gitignore` to keep credentials secure
- For production, use environment variables in your hosting platform

## Step 4: Setup Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Create a new query and paste this schema:

```sql
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

-- Enable Row Level Security (RLS)
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_states ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow all for now, restrict later)
CREATE POLICY "Allow all operations on games" ON games FOR ALL USING (true);
CREATE POLICY "Allow all operations on players" ON players FOR ALL USING (true);
CREATE POLICY "Allow all operations on game_states" ON game_states FOR ALL USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_games_room_code ON games(room_code);
CREATE INDEX IF NOT EXISTS idx_players_game_id ON players(game_id);
CREATE INDEX IF NOT EXISTS idx_game_states_game_id ON game_states(game_id);
```

3. Click **Run** to execute the schema

## Step 5: Enable Real-time

1. Go to **Database** > **Replication** in Supabase dashboard
2. Enable replication for these tables:
   - ✅ `games`
   - ✅ `players` 
   - ✅ `game_states`

## Step 6: Test Your Setup

1. Restart your dev server: `npm run dev`
2. The game should now connect to real Supabase instead of mock data
3. You can monitor real-time activity in **Database** > **Logs**

## Deployment Configuration

### For GitHub Pages:
Add secrets to your GitHub repository:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### For Netlify:
Add environment variables in Site Settings > Environment Variables

### For Vercel:
Add environment variables in Project Settings > Environment Variables

## Security Notes

- The anon key is safe to expose publicly (it has limited permissions)
- RLS policies control data access
- For production, consider implementing user authentication
- Monitor usage in Supabase dashboard

## Troubleshooting

**Connection Issues:**
- Verify environment variables are correct
- Check browser console for errors
- Ensure database schema was created successfully

**Real-time Not Working:**
- Confirm replication is enabled for all tables
- Check real-time logs in Supabase dashboard

**Game Creation Fails:**
- Verify RLS policies are active
- Check SQL Editor for schema errors 