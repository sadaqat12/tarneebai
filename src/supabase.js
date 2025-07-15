import { createClient } from '@supabase/supabase-js'

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project-ref.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database Schema Setup (run these in Supabase SQL editor)
/*
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
*/

// Game Management Functions
export const gameService = {
  // Create a new game room
  async createGame(playerName, roomCode) {
    try {
      // Create game
      const { data: game, error: gameError } = await supabase
        .from('games')
        .insert([{ 
          room_code: roomCode,
          status: 'waiting'
        }])
        .select()
        .single()

      if (gameError) throw gameError

      // Add host player
      const { data: player, error: playerError } = await supabase
        .from('players')
        .insert([{
          game_id: game.id,
          player_name: playerName,
          position: 1,
          is_host: true
        }])
        .select()
        .single()

      if (playerError) throw playerError

      // Create initial game state
      const { data: gameState, error: stateError } = await supabase
        .from('game_states')
        .insert([{
          game_id: game.id,
          phase: 'waiting',
          current_player: 1,
          game_data: {
            scores: { team1: 0, team2: 0 },
            tricks: [],
            currentTrick: [],
            bid: { player: null, amount: 0 },
            trump: null,
            biddingPassed: [],
            round: 1
          }
        }])
        .select()
        .single()

      if (stateError) throw stateError

      return { game, player, gameState }
    } catch (error) {
      console.error('Error creating game:', error)
      throw error
    }
  },

  // Join an existing game
  async joinGame(playerName, roomCode) {
    try {
      // Find game by room code
      const { data: game, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('room_code', roomCode.toUpperCase())
        .eq('status', 'waiting')
        .single()

      if (gameError) throw gameError
      if (!game) throw new Error('Game not found or already started')

      // Get existing players to find next position
      const { data: existingPlayers, error: playersError } = await supabase
        .from('players')
        .select('position')
        .eq('game_id', game.id)
        .eq('connected', true)

      if (playersError) throw playersError

      const takenPositions = existingPlayers.map(p => p.position)
      const availablePosition = [1, 2, 3, 4].find(pos => !takenPositions.includes(pos))

      if (!availablePosition) throw new Error('Game is full')

      // Add player
      const { data: player, error: playerError } = await supabase
        .from('players')
        .insert([{
          game_id: game.id,
          player_name: playerName,
          position: availablePosition,
          is_host: false
        }])
        .select()
        .single()

      if (playerError) throw playerError

      return { game, player }
    } catch (error) {
      console.error('Error joining game:', error)
      throw error
    }
  },

  // Start the game (deal cards)
  async startGame(gameId) {
    try {
      // Generate and shuffle deck
      const suits = ['hearts', 'diamonds', 'clubs', 'spades']
      const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
      const deck = []
      
      for (const suit of suits) {
        for (const rank of ranks) {
          deck.push({ suit, rank, id: `${suit}-${rank}` })
        }
      }
      
      // Shuffle deck
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]]
      }

      // Deal 13 cards to each player
      const hands = [[], [], [], []]
      for (let i = 0; i < 52; i++) {
        hands[i % 4].push(deck[i])
      }

      // Sort hands by suit and rank
      const suitOrder = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 }
      const rankOrder = { '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6, '9': 7, '10': 8, 'J': 9, 'Q': 10, 'K': 11, 'A': 12 }
      
      hands.forEach(hand => {
        hand.sort((a, b) => {
          return suitOrder[a.suit] - suitOrder[b.suit] || rankOrder[a.rank] - rankOrder[b.rank]
        })
      })

      // Update player hands
      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('game_id', gameId)
        .order('position')

      if (playersError) throw playersError

      for (let i = 0; i < players.length; i++) {
        await supabase
          .from('players')
          .update({ hand: hands[players[i].position - 1] })
          .eq('id', players[i].id)
      }

      // Update game status and state
      await supabase
        .from('games')
        .update({ status: 'playing' })
        .eq('id', gameId)

      await supabase
        .from('game_states')
        .update({ 
          phase: 'bidding',
          current_player: 1
        })
        .eq('game_id', gameId)

      return { success: true }
    } catch (error) {
      console.error('Error starting game:', error)
      throw error
    }
  },

  // Get game state
  async getGameState(gameId) {
    try {
      const { data: gameState, error } = await supabase
        .from('game_states')
        .select('*')
        .eq('game_id', gameId)
        .single()

      if (error) throw error
      return gameState
    } catch (error) {
      console.error('Error getting game state:', error)
      throw error
    }
  },

  // Update game state
  async updateGameState(gameId, updates) {
    try {
      const { data, error } = await supabase
        .from('game_states')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('game_id', gameId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error updating game state:', error)
      throw error
    }
  },

  // Get players in game
  async getPlayers(gameId) {
    try {
      const { data: players, error } = await supabase
        .from('players')
        .select('*')
        .eq('game_id', gameId)
        .eq('connected', true)
        .order('position')

      if (error) throw error
      return players
    } catch (error) {
      console.error('Error getting players:', error)
      throw error
    }
  },

  // Subscribe to real-time changes
  subscribeToGame(gameId, callback) {
    const subscription = supabase
      .channel(`game-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_states',
          filter: `game_id=eq.${gameId}`
        },
        (payload) => {
          callback('game_state', payload)
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `game_id=eq.${gameId}`
        },
        (payload) => {
          callback('players', payload)
        }
      )
      .subscribe()

    return subscription
  },

  // Disconnect from game
  async disconnectPlayer(playerId) {
    try {
      await supabase
        .from('players')
        .update({ connected: false })
        .eq('id', playerId)
    } catch (error) {
      console.error('Error disconnecting player:', error)
    }
  }
}

export default gameService 