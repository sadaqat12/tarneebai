# Tarneeb AI - Multiplayer Card Game

A sophisticated Tarneeb card game implementation with intelligent AI opponents, built with React, TypeScript, and Tailwind CSS.

## Features

- 🃏 **Complete Tarneeb Rules**: Authentic bidding, trump suits, and scoring
- 🤖 **Smart AI Opponents**: Realistic trick estimation and strategic play
- 🏆 **Multi-Round Gameplay**: Tournament-style games to 21 points
- 🎨 **Beautiful UI**: Modern, responsive design with smooth animations
- ⚡ **Real-time Gameplay**: Instant card play and state updates

## Game Rules

Tarneeb is a trick-taking card game popular in the Middle East:
- **Teams**: 4 players in 2 teams (1&3 vs 2&4)
- **Bidding**: Players bid on how many tricks their team will win
- **Trump**: Highest bidder chooses the trump suit
- **Scoring**: Make your bid to score points, fail to lose points
- **Victory**: First team to reach 21 points wins

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation
```bash
# Clone the repository
git clone https://github.com/yourusername/TarneebAI.git
cd TarneebAI

# Install dependencies
npm install

# Start development server
npm run dev
```

The game will be available at `http://localhost:5173`

### Building for Production
```bash
# Build the application
npm run build

# Preview the build
npm run preview
```

## Deployment Options

### Option 1: GitHub Pages (Static Deployment)
```bash
# Deploy to GitHub Pages
npm run deploy
```

Make sure to:
1. Enable GitHub Pages in your repository settings
2. Set source to "gh-pages" branch
3. Your game will be available at `https://yourusername.github.io/TarneebAI/`

### Option 2: Netlify
1. Connect your GitHub repository to Netlify
2. Build command: `npm run build`
3. Publish directory: `dist`

### Option 3: Vercel
1. Connect your GitHub repository to Vercel
2. Build command: `npm run build`
3. Output directory: `dist`

## Real Multiplayer Setup

### ✅ **Multiplayer is Now Integrated!**

This game includes **full real-time multiplayer** powered by Supabase:

**Features:**
- ✅ Real-time player connections
- ✅ Game room management (create/join with codes)
- ✅ Live turn synchronization
- ✅ Real-time card play updates
- ✅ Automatic reconnection handling
- ✅ Multi-round tournament gameplay

### Quick Multiplayer Setup

1. **Create Supabase Project** (free):
   - Go to [supabase.com](https://supabase.com) → "New Project"
   - Copy your **Project URL** and **Anon Key** from Settings > API

2. **Configure Environment**:
   ```bash
   # Create .env file in project root
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. **Setup Database**:
   - In Supabase dashboard: SQL Editor → Run the schema from `supabase-setup.md`
   - Enable replication for `games`, `players`, `game_states` tables

4. **Deploy with Multiplayer**:
   ```bash
   npm run build && npm run deploy
   ```

**🎮 How to Play Multiplayer:**
1. Player 1: "Create Game Room" → Share room code
2. Players 2-4: "Join Game Room" → Enter room code  
3. Host clicks "Start Game" when all players joined
4. Play Tarneeb with real-time updates!

**📖 Detailed Setup**: See `supabase-setup.md` for complete instructions

## Technology Stack

- **Frontend**: React 18, TypeScript
- **Styling**: Tailwind CSS
- **Build**: Vite
- **Icons**: Lucide React
- **Deployment**: GitHub Pages, Netlify, Vercel

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details 