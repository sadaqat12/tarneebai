import React, { useState, useEffect } from 'react';
import { Crown, Users, Wifi, WifiOff, UserPlus, Play, Trophy } from 'lucide-react';
import { gameService } from '../services/supabase';

// Real-time multiplayer functionality integrated with Supabase

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const SUIT_SYMBOLS = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠'
};

const SUIT_COLORS = {
  hearts: 'text-red-500',
  diamonds: 'text-red-500',
  clubs: 'text-black',
  spades: 'text-black'
};

const createDeck = () => {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, id: suit + '-' + rank });
    }
  }
  return deck;
};

const shuffleDeck = (deck) => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const TarneebMultiplayer = () => {
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [gameRoom, setGameRoom] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [players, setPlayers] = useState([]);
  const [playerHand, setPlayerHand] = useState([]);
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [gameMode, setGameMode] = useState(null);
  const [aiPlayers, setAiPlayers] = useState([]);
  const [trickResult, setTrickResult] = useState(null); // To show trick winner
  const [trickHistory, setTrickHistory] = useState([]); // Store completed tricks with details
  const [subscription, setSubscription] = useState(null); // Real-time subscription

  // Initialize connection and cleanup subscriptions
  useEffect(() => {
    setConnectionStatus('connected'); // Supabase connects automatically
    
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
      if (currentPlayer?.id) {
        gameService.disconnectPlayer(currentPlayer.id);
      }
    };
  }, []);

  // Set up real-time subscription when game starts
  useEffect(() => {
    if (gameRoom?.id && !subscription) {
      const sub = gameService.subscribeToGame(gameRoom.id, handleRealtimeUpdate);
      setSubscription(sub);
    }
  }, [gameRoom?.id]);

  // Handle real-time updates from other players
  const handleRealtimeUpdate = (type, payload) => {
    console.log('Real-time update:', type, payload);
    
    if (type === 'game_state') {
      const newState = payload.new;
      if (newState) {
        setGameState({
          ...gameState,
          phase: newState.phase,
          current_player: newState.current_player,
          game_state: newState.game_data
        });
      }
    } else if (type === 'players') {
      // Refresh players list
      if (gameRoom?.id) {
        refreshPlayers();
      }
    }
  };

  // Refresh players from database
  const refreshPlayers = async () => {
    if (!gameRoom?.id) return;
    
    try {
      const players = await gameService.getPlayers(gameRoom.id);
      setPlayers(players);
    } catch (error) {
      console.error('Error refreshing players:', error);
    }
  };

  // AI Decision Making - Realistic Trick Estimation
  
  // Estimate how many tricks this hand can realistically win
  const estimateWinnableTricks = (hand, potentialTrump = null) => {
    const suitCounts = {};
    const suitCards = {};
    
    // Group cards by suit
    hand.forEach(card => {
      if (!suitCards[card.suit]) suitCards[card.suit] = [];
      suitCards[card.suit].push(card);
      suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
    });
    
    // Sort each suit's cards by rank (high to low)
    const rankOrder = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
    Object.keys(suitCards).forEach(suit => {
      suitCards[suit].sort((a, b) => rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank));
    });
    
    let estimatedTricks = 0;
    
    // Analyze each suit for winnable tricks
    SUITS.forEach(suit => {
      const cards = suitCards[suit] || [];
      if (cards.length === 0) return;
      
      const isTrump = suit === potentialTrump;
      let suitTricks = 0;
      
      if (isTrump) {
        // Trump suit analysis - more aggressive counting
        if (cards.length >= 5) {
          // Long trump suit - count top cards + length bonus
          suitTricks += Math.min(3, cards.filter(c => ['A', 'K', 'Q'].includes(c.rank)).length);
          suitTricks += Math.max(0, cards.length - 5); // Bonus for length > 5
        } else if (cards.length >= 3) {
          // Medium trump suit
          suitTricks += Math.min(2, cards.filter(c => ['A', 'K'].includes(c.rank)).length);
        } else {
          // Short trump - only count aces
          suitTricks += cards.filter(c => c.rank === 'A').length;
        }
      } else {
        // Non-trump suit analysis
        const aces = cards.filter(c => c.rank === 'A').length;
        const kings = cards.filter(c => c.rank === 'K').length;
        
        if (cards.length >= 6) {
          // Long suit - count high cards + some length tricks
          suitTricks += aces;
          suitTricks += Math.min(kings, 1); // Max 1 king trick in long suits
          suitTricks += Math.max(0, cards.length - 7); // Length tricks for 8+ cards
        } else if (cards.length >= 4) {
          // Medium suit - count aces and some kings
          suitTricks += aces;
          if (aces > 0 && kings > 0) suitTricks += Math.min(kings, 1);
        } else {
          // Short suit - only count aces (kings unlikely to win)
          suitTricks += aces;
        }
      }
      
      estimatedTricks += suitTricks;
    });
    
    // Conservative adjustment - reduce by 15% for uncertainty
    estimatedTricks = Math.floor(estimatedTricks * 0.85);
    
    console.log(`Estimated tricks for ${potentialTrump ? potentialTrump + ' trump' : 'no trump'}: ${estimatedTricks}`);
    return Math.max(0, Math.min(13, estimatedTricks));
  };
  
  const makeAIBid = (aiPlayer) => {
    const hand = aiPlayer.hand;
    const currentBid = gameState?.game_state?.bid?.amount || 0;
    
    console.log(`\n=== ${aiPlayer.player_name} BIDDING ANALYSIS ===`);
    console.log(`Current bid to beat: ${currentBid}`);
    
    // Display AI's complete hand
    const handBysuit = {};
    hand.forEach(card => {
      if (!handBysuit[card.suit]) handBysuit[card.suit] = [];
      handBysuit[card.suit].push(card.rank);
    });
    
    console.log(`${aiPlayer.player_name}'s Hand (${hand.length} cards):`);
    SUITS.forEach(suit => {
      const cards = handBysuit[suit] || [];
      const suitSymbol = { hearts: '♥️', diamonds: '♦️', clubs: '♣️', spades: '♠️' }[suit];
      if (cards.length > 0) {
        const sortedCards = cards.sort((a, b) => {
          const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
          return ranks.indexOf(b) - ranks.indexOf(a); // High to low
        });
        console.log(`  ${suitSymbol} ${suit.toUpperCase()}: [${sortedCards.join(', ')}] (${cards.length} cards)`);
      } else {
        console.log(`  ${suitSymbol} ${suit.toUpperCase()}: [] (void)`);
      }
    });
    
    // Test each suit as potential trump and find the best
    let bestTricks = 0;
    let bestSuit = null;
    const suitAnalysis = {};
    
    console.log(`\nTrump Analysis:`);
    SUITS.forEach(suit => {
      const tricks = estimateWinnableTricks(hand, suit);
      suitAnalysis[suit] = tricks;
      const suitCards = handBysuit[suit] || [];
      const highCards = suitCards.filter(rank => ['A', 'K', 'Q', 'J'].includes(rank));
      
      console.log(`  ${suit.toUpperCase()} trump: ${tricks} tricks (${suitCards.length} cards, honors: [${highCards.join(', ') || 'none'}])`);
      
      if (tricks > bestTricks) {
        bestTricks = tricks;
        bestSuit = suit;
      }
    });
    
    // AI strategy: bid 1 more than estimated tricks (as requested)
    const desiredBid = bestTricks + 1;
    
    console.log(`\nBest trump suit: ${bestSuit?.toUpperCase()} (${bestTricks} estimated tricks)`);
    console.log(`Desired bid: ${bestTricks} tricks + 1 = ${desiredBid}`);
    
    // Only bid if we can beat current bid and have reasonable confidence
    if (desiredBid > currentBid && bestTricks >= 5) {
      // Make sure bid is valid (7-13 range)
      const finalBid = Math.max(7, Math.min(13, desiredBid));
      console.log(`✅ ${aiPlayer.player_name} BIDDING: ${finalBid}`);
      console.log(`   Reason: Can beat current bid (${currentBid}) and confident with ${bestTricks} tricks`);
      if (finalBid !== desiredBid) {
        console.log(`   Note: Adjusted from ${desiredBid} to ${finalBid} (valid range 7-13)`);
      }
      console.log(`=== END ${aiPlayer.player_name} ANALYSIS ===\n`);
      return finalBid;
    } else {
      console.log(`❌ ${aiPlayer.player_name} PASSING`);
      if (desiredBid <= currentBid) {
        console.log(`   Reason: Desired bid ${desiredBid} cannot beat current bid ${currentBid}`);
      }
      if (bestTricks < 5) {
        console.log(`   Reason: Only ${bestTricks} estimated tricks (need 5+ for confidence)`);
      }
      console.log(`=== END ${aiPlayer.player_name} ANALYSIS ===\n`);
      return 0; // Pass
    }
  };

  const makeAITrumpSelection = (aiPlayer) => {
    const hand = aiPlayer.hand;
    
    // Use the same trick estimation logic as bidding
    let bestTricks = 0;
    let bestSuit = 'spades'; // Default fallback
    
    SUITS.forEach(suit => {
      const tricks = estimateWinnableTricks(hand, suit);
      if (tricks > bestTricks) {
        bestTricks = tricks;
        bestSuit = suit;
      }
    });
    
    console.log(`AI selecting trump: ${bestSuit} (estimated ${bestTricks} tricks)`);
    return bestSuit;
  };

  // Advanced AI Card Play Logic with Proper Tarneeb Strategy
  const makeAICardPlay = (aiPlayer) => {
    const hand = aiPlayer.hand;
    const currentTrick = gameState?.game_state?.currentTrick || [];
    const trump = gameState?.game_state?.trump;
    const tricksPlayed = gameState?.game_state?.tricks || [];
    
    console.log(`${aiPlayer.player_name} analyzing play. Trump: ${trump}, Trick cards: ${currentTrick.length}`);
    
    if (currentTrick.length === 0) {
      // LEADING: Advanced leading strategy
      return makeLeadingPlay(hand, trump, tricksPlayed, aiPlayer.position);
    } else {
      // FOLLOWING: Advanced following strategy with partner awareness
      return makeFollowingPlay(hand, currentTrick, trump, tricksPlayed, aiPlayer.position);
    }
  };

  // Leading Strategy: Smart card selection when going first
  const makeLeadingPlay = (hand, trump, tricksPlayed, position) => {
    console.log('AI Leading - choosing strategic opening card');
    
    // Strategy 1: Lead with Aces to win tricks
    const aces = hand.filter(c => c.rank === 'A' && c.suit !== trump);
    if (aces.length > 0) {
      console.log('Leading with Ace to win trick');
      return aces[0];
    }
    
    // Strategy 2: Lead with Kings if safe (Ace already played in that suit)
    const kings = hand.filter(c => c.rank === 'K' && c.suit !== trump);
    for (const king of kings) {
      const aceAlreadyPlayed = tricksPlayed.some(trick => 
        trick.cards.some(play => play.card.rank === 'A' && play.card.suit === king.suit)
      );
      if (aceAlreadyPlayed) {
        console.log(`Leading with King of ${king.suit} - Ace already played`);
        return king;
      }
    }
    
    // Strategy 3: Lead from longest non-trump suit
    const suitCounts = {};
    hand.filter(c => c.suit !== trump).forEach(card => {
      suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
    });
    
    const longestSuit = Object.keys(suitCounts).reduce((a, b) => 
      suitCounts[a] > suitCounts[b] ? a : b, Object.keys(suitCounts)[0]
    );
    
    if (longestSuit) {
      const suitCards = hand.filter(c => c.suit === longestSuit);
      // Lead with middle card from longest suit
      const sortedSuit = suitCards.sort((a, b) => getRankValue(a.rank) - getRankValue(b.rank));
      const middleCard = sortedSuit[Math.floor(sortedSuit.length / 2)];
      console.log(`Leading with middle card from longest suit: ${middleCard.rank} of ${middleCard.suit}`);
      return middleCard;
    }
    
    // Fallback: play any non-trump card
    const nonTrumpCards = hand.filter(c => c.suit !== trump);
    return nonTrumpCards.length > 0 ? nonTrumpCards[0] : hand[0];
  };

  // Following Strategy: Smart responses with partner awareness
  const makeFollowingPlay = (hand, currentTrick, trump, tricksPlayed, position) => {
    const leadSuit = currentTrick[0].card.suit;
    const suitCards = hand.filter(c => c.suit === leadSuit);
    const trumpCards = hand.filter(c => c.suit === trump);
    
    console.log(`AI Following - Lead suit: ${leadSuit}, Can follow: ${suitCards.length > 0}`);
    
    // Determine current trick winner and if it's partner
    const currentWinner = getCurrentTrickWinnerInternal(currentTrick, trump);
    const isPartnerWinning = isPartnerCurrentlyWinning(position, currentWinner);
    
    console.log(`Current winner: Player ${currentWinner}, Is partner winning: ${isPartnerWinning}`);
    
    if (suitCards.length > 0) {
      // CAN FOLLOW SUIT
      return makeFollowSuitPlay(suitCards, currentTrick, trump, isPartnerWinning, position);
    } else {
      // CANNOT FOLLOW SUIT - Trump or Discard decision
      return makeTrumpOrDiscardPlay(hand, trumpCards, currentTrick, trump, isPartnerWinning, position);
    }
  };

  // Smart play when able to follow suit
  const makeFollowSuitPlay = (suitCards, currentTrick, trump, isPartnerWinning, position) => {
    const currentWinningCard = getCurrentTrickWinningCard(currentTrick, trump);
    const canWin = suitCards.some(card => canBeatCard(card, currentWinningCard, trump));
    
    if (isPartnerWinning) {
      // PARTNER IS WINNING - Play low to save high cards
      console.log('Partner winning - playing low card to support');
      return getLowestCard(suitCards);
    } else if (canWin && shouldTryToWin(position, currentTrick)) {
      // OPPONENT WINNING & CAN WIN - Play lowest winning card
      const winningCards = suitCards.filter(card => canBeatCard(card, currentWinningCard, trump));
      const lowestWinner = getLowestCard(winningCards);
      console.log(`Playing lowest winning card: ${lowestWinner.rank} of ${lowestWinner.suit}`);
      return lowestWinner;
    } else {
      // CANNOT WIN OR SHOULDN'T TRY - Play lowest card
      console.log('Cannot win or saving cards - playing lowest');
      return getLowestCard(suitCards);
    }
  };

  // Smart trump/discard decision when cannot follow suit
  const makeTrumpOrDiscardPlay = (hand, trumpCards, currentTrick, trump, isPartnerWinning, position) => {
    if (isPartnerWinning) {
      // PARTNER WINNING - Just discard lowest non-trump
      console.log('Partner winning - discarding lowest non-trump');
      const nonTrumpCards = hand.filter(c => c.suit !== trump);
      return nonTrumpCards.length > 0 ? getLowestCard(nonTrumpCards) : getLowestCard(hand);
    }
    
    // OPPONENT WINNING - Consider trumping
    const currentWinningCard = getCurrentTrickWinningCard(currentTrick, trump);
    const canTrumpWin = trumpCards.length > 0 && 
      (currentWinningCard.suit !== trump || 
       trumpCards.some(card => getRankValue(card.rank) > getRankValue(currentWinningCard.rank)));
    
    if (canTrumpWin && shouldTrumpTrick(currentTrick, trump, position)) {
      // TRUMP THE TRICK
      if (currentWinningCard.suit === trump) {
        // Need higher trump
        const higherTrumps = trumpCards.filter(card => 
          getRankValue(card.rank) > getRankValue(currentWinningCard.rank)
        );
        if (higherTrumps.length > 0) {
          const lowestHigher = getLowestCard(higherTrumps);
          console.log(`Over-trumping with ${lowestHigher.rank} of ${lowestHigher.suit}`);
          return lowestHigher;
        }
      } else {
        // Trump non-trump winner
        const lowestTrump = getLowestCard(trumpCards);
        console.log(`Trumping with ${lowestTrump.rank} of ${lowestTrump.suit}`);
        return lowestTrump;
      }
    }
    
    // DON'T TRUMP - Discard lowest non-trump
    console.log('Not trumping - discarding lowest');
    const nonTrumpCards = hand.filter(c => c.suit !== trump);
    return nonTrumpCards.length > 0 ? getLowestCard(nonTrumpCards) : getLowestCard(hand);
  };

  // Helper functions for AI decision making
  const getCurrentTrickWinnerInternal = (trick, trump) => {
    if (trick.length === 0) return null;
    
    const leadSuit = trick[0].card.suit;
    let winner = trick[0];
    
    for (const play of trick) {
      const card = play.card;
      const winnerCard = winner.card;
      
      // Trump beats non-trump
      if (card.suit === trump && winnerCard.suit !== trump) {
        winner = play;
      }
      // Higher trump beats lower trump
      else if (card.suit === trump && winnerCard.suit === trump) {
        if (getRankValue(card.rank) > getRankValue(winnerCard.rank)) {
          winner = play;
        }
      }
      // Higher same suit beats lower (when both not trump)
      else if (card.suit === leadSuit && winnerCard.suit === leadSuit && 
               card.suit !== trump && winnerCard.suit !== trump) {
        if (getRankValue(card.rank) > getRankValue(winnerCard.rank)) {
          winner = play;
        }
      }
    }
    
    return winner.player;
  };

  const getCurrentTrickWinningCard = (trick, trump) => {
    if (trick.length === 0) return null;
    const winnerPlayer = getCurrentTrickWinnerInternal(trick, trump);
    return trick.find(play => play.player === winnerPlayer).card;
  };

  const isPartnerCurrentlyWinning = (position, currentWinner) => {
    // Team 1: positions 1 & 3, Team 2: positions 2 & 4
    if ((position === 1 || position === 3) && (currentWinner === 1 || currentWinner === 3)) return true;
    if ((position === 2 || position === 4) && (currentWinner === 2 || currentWinner === 4)) return true;
    return false;
  };

  const canBeatCard = (myCard, winningCard, trump) => {
    if (!winningCard) return true;
    
    // My trump beats non-trump
    if (myCard.suit === trump && winningCard.suit !== trump) return true;
    
    // Higher trump beats lower trump
    if (myCard.suit === trump && winningCard.suit === trump) {
      return getRankValue(myCard.rank) > getRankValue(winningCard.rank);
    }
    
    // Higher same suit beats lower (when both not trump)
    if (myCard.suit === winningCard.suit && myCard.suit !== trump) {
      return getRankValue(myCard.rank) > getRankValue(winningCard.rank);
    }
    
    return false;
  };

  const shouldTryToWin = (position, currentTrick) => {
    // Generally try to win unless partner is already winning
    return currentTrick.length <= 2; // More aggressive early in trick
  };

  const shouldTrumpTrick = (currentTrick, trump, position) => {
    // Trump if trick has value (high cards) and opponent winning
    const hasHighCards = currentTrick.some(play => 
      ['A', 'K', 'Q', 'J'].includes(play.card.rank)
    );
    return hasHighCards || currentTrick.length >= 3; // Trump valuable tricks or late in trick
  };

  const getRankValue = (rank) => {
    const values = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
    return values[rank] || 0;
  };

  const getLowestCard = (cards) => {
    return cards.sort((a, b) => getRankValue(a.rank) - getRankValue(b.rank))[0];
  };

  // Process AI turns
  useEffect(() => {
    if (gameMode !== 'single' || !gameState) return;
    
    // Don't process AI turns if game is finished
    if (gameState.phase === 'finished') {
      console.log('Game finished, no more AI turns');
      return;
    }
    
    const currentPlayerData = players.find(p => p.position === gameState.current_player);
    if (!currentPlayerData || currentPlayerData.id === 'human') return;
    
    console.log('AI Turn:', currentPlayerData.player_name, 'Phase:', gameState.phase, 'Hand size:', currentPlayerData.hand?.length);
    
    const timer = setTimeout(() => {
      if (gameState.phase === 'bidding') {
        console.log('AI Bidding...');
        const decision = makeAIBid(currentPlayerData);
        console.log('AI Bid Decision:', decision);
        handleBid(decision);
      } else if (gameState.phase === 'trump-selection') {
        console.log('AI Selecting Trump...');
        const decision = makeAITrumpSelection(currentPlayerData);
        console.log('AI Trump Decision:', decision);
        setTrump(decision);
      } else if (gameState.phase === 'playing') {
        // Guard: Don't play if trick is already complete or result is showing
        const currentTrick = gameState?.game_state?.currentTrick || [];
        
        if (currentTrick.length >= 4) {
          console.log(`AI Skipping - trick already complete with ${currentTrick.length} cards`);
          return;
        }
        
        if (trickResult) {
          console.log('AI Skipping - trick result is showing:', trickResult);
          return;
        }
        
        console.log('AI Playing Card...');
        const decision = makeAICardPlay(currentPlayerData);
        console.log('AI Card Decision:', decision);
        if (decision) {
          // Remove card from AI player's hand BEFORE playing
          const updatedPlayers = players.map(p => {
            if (p.id === currentPlayerData.id) {
              const newHand = p.hand.filter(c => c.id !== decision.id);
              console.log(`Removing card ${decision.rank} of ${decision.suit} from ${p.player_name}. Hand size: ${p.hand.length} -> ${newHand.length}`);
              return { ...p, hand: newHand };
            }
            return p;
          });
          
          // Update both players and aiPlayers states
          setPlayers(updatedPlayers);
          setAiPlayers(prev => prev.map(ai => {
            if (ai.id === currentPlayerData.id) {
              const newHand = ai.hand.filter(c => c.id !== decision.id);
              return { ...ai, hand: newHand };
            }
            return ai;
          }));
          
          playCardForAI(decision, currentPlayerData.position);
        }
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [gameState?.current_player, gameState?.phase, gameMode, players]);

  const playCardForAI = (card, playerPosition) => {
    const currentTrick = gameState.game_state?.currentTrick || [];
    const newTrick = [...currentTrick, { card, player: playerPosition }];
    
    // Only update current trick if it doesn't exceed 4 cards
    if (newTrick.length <= 4) {
      setGameState(prev => ({
        ...prev,
        game_state: {
          ...prev.game_state,
          currentTrick: newTrick
        }
      }));
    }
    
    let newCurrentPlayer = (gameState.current_player % 4) + 1;
    let newTricks = gameState.game_state?.tricks || [];
    let newCurrentTrick = newTrick;
    let newPhase = gameState.phase;

    if (newTrick.length === 4) {
      const winner = determineTrickWinner(newTrick, gameState.game_state?.trump);
      const trickWinner = newTrick.find(play => play.player === winner);
      
      // Determine why this card won
      const trump = gameState.game_state?.trump;
      const leadSuit = newTrick[0].card.suit;
      let winReason = '';
      
      if (trickWinner.card.suit === trump) {
        const trumpCards = newTrick.filter(play => play.card.suit === trump);
        if (trumpCards.length === 1) {
          winReason = `Only trump card (${SUIT_SYMBOLS[trump]} ${trump})`;
        } else {
          winReason = `Highest trump (${SUIT_SYMBOLS[trump]} ${trump})`;
        }
      } else {
        winReason = `Highest ${leadSuit} (${SUIT_SYMBOLS[leadSuit]})`;
      }
      
      // Add to trick history with detailed info
      const trickInfo = {
        trickNumber: newTricks.length + 1,
        cards: newTrick,
        winner: winner,
        winningCard: trickWinner.card,
        trump: trump,
        leadSuit: leadSuit,
        winReason: winReason,
        timestamp: Date.now()
      };
      
      // Show trick result for 3 seconds and immediately clear the current trick
      setTrickResult(trickInfo);
      
      // Immediately clear the current trick
      newTricks = [...newTricks, { cards: newTrick, winner }];
      newCurrentTrick = [];
      newCurrentPlayer = winner;
      
      // Add to history immediately
      setTrickHistory(prev => [...prev, trickInfo]);
      
      // Check if all 13 tricks are played
      if (newTricks.length === 13) {
          newPhase = 'finished';
          console.log('Game Finished! Final tricks:', newTricks.length);
          
          // Calculate final scores
          const team1Tricks = newTricks.filter(t => t.winner === 1 || t.winner === 3).length;
          const team2Tricks = newTricks.filter(t => t.winner === 2 || t.winner === 4).length;
          const bid = gameState.game_state?.bid;
          
          let newScores = { ...gameState.game_state.scores };
          
          if (bid && bid.player) {
            const bidTeam = (bid.player === 1 || bid.player === 3) ? 1 : 2;
            const bidAmount = bid.amount;
            
            if (bidTeam === 1) {
              if (team1Tricks >= bidAmount) {
                newScores.team1 += team1Tricks;
              } else {
                newScores.team1 -= bidAmount;
                newScores.team2 += team2Tricks;
              }
            } else {
              if (team2Tricks >= bidAmount) {
                newScores.team2 += team2Tricks;
              } else {
                newScores.team2 -= bidAmount;
                newScores.team1 += team1Tricks;
              }
            }
          }
          
          console.log('Final Scores - Team 1:', newScores.team1, 'Team 2:', newScores.team2);
        }
      
      // Clear trick result after delay
      setTimeout(() => {
        setTrickResult(null);
      }, 3000); // 3 second delay to clear trick result
      
      // Update game state immediately when trick is complete
      setGameState(prev => ({
        ...prev,
        phase: newPhase,
        current_player: newPhase === 'finished' ? null : newCurrentPlayer,
        game_state: {
          ...prev.game_state,
          tricks: newTricks,
          currentTrick: newCurrentTrick,
          scores: newPhase === 'finished' ? newScores : prev.game_state.scores
        }
      }));
      
      return; // Don't update state immediately for completed tricks
    }

    // For incomplete tricks, update the current player
    setTimeout(() => {
      setGameState(prev => ({
        ...prev,
        current_player: newCurrentPlayer
      }));
    }, 500); // Small delay to show the card was played
  };

  // Start single player game
  const startSinglePlayerGame = async () => {
    if (!playerName.trim()) return;

    try {
      setConnectionStatus('creating');
      
      const deck = shuffleDeck(createDeck());
      const hands = [[], [], [], []];
      
      for (let i = 0; i < 52; i++) {
        hands[i % 4].push(deck[i]);
      }

      const sortedHands = hands.map(hand => 
        hand.sort((a, b) => {
          const suitOrder = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };
          const rankOrder = { '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6, '9': 7, '10': 8, 'J': 9, 'Q': 10, 'K': 11, 'A': 12 };
          return suitOrder[a.suit] - suitOrder[b.suit] || rankOrder[a.rank] - rankOrder[b.rank];
        })
      );

      const aiPlayersList = [
        { id: 'ai1', player_name: 'AI Player 1', position: 2, is_host: false, hand: sortedHands[1] },
        { id: 'ai2', player_name: 'AI Player 2', position: 3, is_host: false, hand: sortedHands[2] },
        { id: 'ai3', player_name: 'AI Player 3', position: 4, is_host: false, hand: sortedHands[3] }
      ];

      const humanPlayer = { 
        id: 'human', 
        player_name: playerName, 
        position: 1, 
        is_host: true, 
        hand: sortedHands[0] 
      };

      setGameMode('single');
      setCurrentPlayer(humanPlayer);
      setPlayerHand(sortedHands[0]);
      setAiPlayers(aiPlayersList);
      setPlayers([humanPlayer, ...aiPlayersList]);
      setConnectionStatus('connected');
      
      setGameState({
        id: 'single-player-game',
        status: 'active',
        phase: 'bidding',
        current_player: 1,
        game_state: {
          scores: { team1: 0, team2: 0 },
          tricks: [],
          currentTrick: [],
          bid: { player: null, amount: 0 },
          trump: null,
          biddingPassed: []
        }
      });

    } catch (error) {
      console.error('Failed to start single player game:', error);
      setConnectionStatus('error');
    }
  };

  // Create multiplayer game room with real Supabase
  const createGameRoom = async () => {
    if (!playerName.trim()) return;

    try {
      setConnectionStatus('creating');
      const gameCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const { game, player, gameState } = await gameService.createGame(playerName, gameCode);

      setGameMode('multiplayer');
      setGameRoom(game);
      setCurrentPlayer(player);
      setGameState({
        ...game,
        phase: gameState.phase,
        current_player: gameState.current_player,
        game_state: gameState.game_data
      });
      setRoomCode(game.room_code);
      setConnectionStatus('connected');
      setPlayers([player]);
    } catch (error) {
      console.error('Failed to create game:', error);
      setConnectionStatus('error');
      alert('Failed to create game: ' + error.message);
    }
  };

  // Join multiplayer game room with real Supabase
  const joinGameRoom = async () => {
    if (!playerName.trim() || !joinRoomCode.trim()) return;

    try {
      setConnectionStatus('joining');
      
      const { game, player } = await gameService.joinGame(playerName, joinRoomCode);
      
      // Get current game state
      const gameState = await gameService.getGameState(game.id);
      const players = await gameService.getPlayers(game.id);

      setGameMode('multiplayer');
      setGameRoom(game);
      setCurrentPlayer(player);
      setGameState({
        ...game,
        phase: gameState.phase,
        current_player: gameState.current_player,
        game_state: gameState.game_data
      });
      setConnectionStatus('connected');
      setPlayers(players);
    } catch (error) {
      console.error('Failed to join game:', error);
      setConnectionStatus('error');
      alert('Failed to join game: ' + error.message);
    }
  };

  // Start multiplayer game with real Supabase
  const startGame = async () => {
    if (!gameRoom || !currentPlayer?.is_host) return;

    try {
      await gameService.startGame(gameRoom.id);
      
      // Refresh game state and players after starting
      const [gameState, players] = await Promise.all([
        gameService.getGameState(gameRoom.id),
        gameService.getPlayers(gameRoom.id)
      ]);

      setGameState({
        ...gameRoom,
        phase: gameState.phase,
        current_player: gameState.current_player,
        game_state: gameState.game_data
      });
      
      setPlayers(players);
      
      // Set current player's hand
      const currentPlayerData = players.find(p => p.id === currentPlayer.id);
      if (currentPlayerData?.hand) {
        setPlayerHand(currentPlayerData.hand);
      }
    } catch (error) {
      console.error('Failed to start game:', error);
      alert('Failed to start game: ' + error.message);
    }
  };

  // Handle bidding
  const handleBid = (amount) => {
    if (!gameState) return;
    
    console.log('Handle Bid:', amount, 'Current Player:', gameState.current_player);
    
    const currentGameState = gameState.game_state || {};
    const biddingPassed = new Set(currentGameState.biddingPassed || []);
    let newBid = currentGameState.bid || { player: null, amount: 0 };
    let nextPlayer = gameState.current_player;
    let newPhase = gameState.phase;
    
    if (amount === 0) {
      // Player passed
      biddingPassed.add(gameState.current_player);
      nextPlayer = (gameState.current_player % 4) + 1;
    } else if (amount > newBid.amount) {
      // Valid bid
      newBid = { player: gameState.current_player, amount };
      biddingPassed.clear(); // Reset passed players after new bid
      nextPlayer = (gameState.current_player % 4) + 1;
    } else {
      // Invalid bid, move to next player
      nextPlayer = (gameState.current_player % 4) + 1;
    }
    
    // Check if bidding should end
    const shouldEndBidding = biddingPassed.size === 3 || amount === 13;
    if (shouldEndBidding && newBid.player) {
      newPhase = 'trump-selection';
      nextPlayer = newBid.player;
    }
    
    console.log('New Game State:', { 
      phase: newPhase, 
      current_player: nextPlayer, 
      bid: newBid, 
      biddingPassed: Array.from(biddingPassed) 
    });

    setGameState({
      ...gameState,
      phase: newPhase,
      current_player: nextPlayer,
      game_state: {
        ...currentGameState,
        bid: newBid,
        biddingPassed: Array.from(biddingPassed)
      }
    });
  };

  // Set trump suit
  const setTrump = (suit) => {
    if (!gameState) return;
    
    console.log('Setting Trump:', suit);

    setGameState({
      ...gameState,
      phase: 'playing',
      current_player: gameState.game_state?.bid?.player || 1, // Bidder leads
      game_state: {
        ...gameState.game_state,
        trump: suit
      }
    });
  };

  // Play card for human player
  const playCard = (card) => {
    if (!gameState) return;
    
    // Only allow human player to call this directly
    if (gameState.current_player !== currentPlayer?.position) return;

    const currentTrick = gameState.game_state?.currentTrick || [];
    
    if (currentTrick.length > 0) {
      const leadSuit = currentTrick[0].card.suit;
      const hasSuit = playerHand.some(c => c.suit === leadSuit);
      if (hasSuit && card.suit !== leadSuit) {
        return;
      }
    }

    const newHand = playerHand.filter(c => c.id !== card.id);
    setPlayerHand(newHand);
    
    // Update human player's hand in players list
    setPlayers(prev => prev.map(p => 
      p.id === 'human' ? { ...p, hand: newHand } : p
    ));
    
    console.log(`Human played ${card.rank} of ${card.suit}. Hand size: ${playerHand.length} -> ${newHand.length}`);
    
    playCardForAI(card, currentPlayer.position);
  };

  // Determine trick winner
  const determineTrickWinner = (trick, trump) => {
    const rankValues = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
    const leadSuit = trick[0].card.suit;
    
    let winner = trick[0];
    
    for (const play of trick) {
      const card = play.card;
      const isCurrentTrump = card.suit === trump;
      const isWinnerTrump = winner.card.suit === trump;
      const isCurrentLeadSuit = card.suit === leadSuit;
      const isWinnerLeadSuit = winner.card.suit === leadSuit;
      
      if (isCurrentTrump && !isWinnerTrump) {
        winner = play;
      } else if (isCurrentTrump && isWinnerTrump) {
        if (rankValues[card.rank] > rankValues[winner.card.rank]) {
          winner = play;
        }
      } else if (!isCurrentTrump && !isWinnerTrump && isCurrentLeadSuit && isWinnerLeadSuit) {
        if (rankValues[card.rank] > rankValues[winner.card.rank]) {
          winner = play;
        }
      }
    }
    
    return winner.player;
  };

  // Card component
  const Card = ({ card, onClick, isPlayable, size }) => {
    const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
    const cardSize = size === 'small' ? 'w-12 h-16' : 'w-16 h-24';
    const textSize = size === 'small' ? 'text-xs' : 'text-sm';
    const symbolSize = size === 'small' ? 'text-lg' : 'text-2xl';
    
    return (
      <div
        className={`relative ${cardSize} bg-white rounded-lg border-2 shadow-md cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg ${isPlayable ? 'border-blue-500 hover:border-blue-600' : 'border-gray-300'} ${isRed ? 'text-red-500' : 'text-black'}`}
        onClick={onClick}
      >
        <div className={`absolute top-1 left-1 ${textSize} font-bold`}>
          {card.rank}
        </div>
        <div className={`absolute top-1 right-1 ${textSize}`}>
          {SUIT_SYMBOLS[card.suit]}
        </div>
        <div className={`absolute bottom-1 right-1 ${textSize} font-bold rotate-180`}>
          {card.rank}
        </div>
        <div className={`absolute bottom-1 left-1 ${textSize} rotate-180`}>
          {SUIT_SYMBOLS[card.suit]}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={symbolSize}>{SUIT_SYMBOLS[card.suit]}</span>
        </div>
      </div>
    );
  };

  // Connection status component
  const ConnectionStatus = () => (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${connectionStatus === 'connected' ? 'bg-green-100 text-green-800' : connectionStatus === 'connecting' || connectionStatus === 'joining' || connectionStatus === 'creating' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
      {connectionStatus === 'connected' ? <Wifi size={16} /> : <WifiOff size={16} />}
      <span className="capitalize">{connectionStatus}</span>
    </div>
  );

  // Render lobby screen
  if (!gameRoom && gameMode !== 'single') {
    return (
      <div className="min-h-screen bg-green-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <Crown className="mx-auto text-yellow-500 mb-4" size={48} />
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Tarneeb Online</h1>
            <ConnectionStatus />
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your name"
                maxLength={20}
              />
            </div>

            <div className="grid grid-cols-1 gap-4">
              <button
                onClick={startSinglePlayerGame}
                disabled={!playerName.trim() || connectionStatus !== 'connected'}
                className="flex items-center justify-center gap-2 px-6 py-4 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                <Crown size={20} />
                <div className="text-left">
                  <div className="font-medium">Single Player</div>
                  <div className="text-sm opacity-90">Play against 3 AI opponents</div>
                </div>
              </button>

              <div className="text-center text-gray-500 text-sm">or</div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={createGameRoom}
                  disabled={!playerName.trim() || connectionStatus !== 'connected'}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  <UserPlus size={16} />
                  Create Game
                </button>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={joinRoomCode}
                    onChange={(e) => setJoinRoomCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center"
                    placeholder="ROOM CODE"
                    maxLength={6}
                  />
                  <button
                    onClick={joinGameRoom}
                    disabled={!playerName.trim() || !joinRoomCode.trim() || connectionStatus !== 'connected'}
                    className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    Join Game
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render waiting lobby
  if (gameState?.status === 'waiting') {
    return (
      <div className="min-h-screen bg-green-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Game Lobby</h1>
                <p className="text-gray-600">Room Code: <span className="font-mono text-lg font-bold text-blue-600">{roomCode}</span></p>
              </div>
              <ConnectionStatus />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[1, 2, 3, 4].map(position => {
                const player = players.find(p => p.position === position);
                return (
                  <div
                    key={position}
                    className={`p-4 rounded-lg border-2 text-center ${player ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200 border-dashed'}`}
                  >
                    <div className="text-lg font-medium">
                      {player ? player.player_name : `Player ${position}`}
                    </div>
                    <div className="text-sm text-gray-600">
                      {player ? (player.is_host ? 'Host' : 'Player') : 'Waiting...'}
                    </div>
                    {player?.id === currentPlayer?.id && (
                      <div className="mt-2 inline-block px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                        You
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="text-center">
              {currentPlayer?.is_host ? (
                <button
                  onClick={startGame}
                  className="flex items-center justify-center gap-2 mx-auto px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                >
                  <Play size={20} />
                  Start Game (Demo Mode)
                </button>
              ) : (
                <p className="text-gray-600">
                  Waiting for host to start the game...
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render active game
  const currentTrick = gameState?.game_state?.currentTrick || [];
  const trump = gameState?.game_state?.trump;
  const bid = gameState?.game_state?.bid || { player: null, amount: 0 };
  const tricks = gameState?.game_state?.tricks || [];

  return (
    <div className="min-h-screen bg-green-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Crown className="text-yellow-500" size={32} />
              <h1 className="text-3xl font-bold text-gray-800">Tarneeb</h1>
              {gameMode === 'single' && (
                <div className="text-sm text-gray-600 bg-purple-100 px-3 py-1 rounded-full">
                  Single Player vs AI
                </div>
              )}
              {gameMode === 'multiplayer' && (
                <div className="text-sm text-gray-600">
                  Room: <span className="font-mono font-bold">{roomCode}</span>
                </div>
              )}
              <ConnectionStatus />
            </div>
            
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {gameState?.game_state?.scores?.team1 || 0}
                </div>
                <div className="text-sm text-gray-600">
                  {gameMode === 'single' ? 'Team 1 (You & AI 2)' : 'Team 1'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {gameState?.game_state?.scores?.team2 || 0}
                </div>
                <div className="text-sm text-gray-600">
                  {gameMode === 'single' ? 'Team 2 (AI 1 & AI 3)' : 'Team 2'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Game Phase Info */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${gameState?.phase === 'bidding' ? 'bg-yellow-100 text-yellow-800' : gameState?.phase === 'trump-selection' ? 'bg-orange-100 text-orange-800' : gameState?.phase === 'playing' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                {gameState?.phase === 'bidding' ? 'Bidding Phase' :
                 gameState?.phase === 'trump-selection' ? 'Select Trump Suit' :
                 gameState?.phase === 'playing' ? 'Playing Cards' :
                 'Game Finished'}
              </div>
              
              {trump && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Trump:</span>
                  <div className={`flex items-center gap-1 ${SUIT_COLORS[trump]}`}>
                    <span className="text-lg">{SUIT_SYMBOLS[trump]}</span>
                    <span className="text-sm capitalize">{trump}</span>
                  </div>
                </div>
              )}
              
              {bid.player && (
                <div className="text-sm text-gray-600">
                  Current Bid: {bid.amount} tricks by {gameMode === 'single' ? (bid.player === 1 ? 'You' : `AI Player ${bid.player - 1}`) : `Player ${bid.player}`}
                </div>
              )}
            </div>
            
            <div className="text-sm text-gray-600">
              Current Turn: {gameMode === 'single' ? (gameState?.current_player === 1 ? 'You' : `AI Player ${gameState?.current_player - 1}`) : `Player ${gameState?.current_player}`}
              {gameState?.current_player === currentPlayer?.position && (
                <span className="ml-2 text-blue-600 font-medium">(Your turn)</span>
              )}
            </div>
          </div>
        </div>

        {/* Bidding Interface */}
        {gameState?.phase === 'bidding' && gameState?.current_player === currentPlayer?.position && (
          <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
            <div className="flex justify-between items-center">
              <div className="text-lg font-medium">
                Your turn to bid
                {bid.amount > 0 && (
                  <span className="text-sm text-gray-600 ml-2">
                    (Current bid: {bid.amount})
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleBid(0)}
                  className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                >
                  Pass
                </button>
                {[7, 8, 9, 10, 11, 12, 13].map(amount => (
                  <button
                    key={amount}
                    onClick={() => handleBid(amount)}
                    disabled={amount <= bid.amount}
                    className={`px-3 py-1 rounded transition-colors ${amount <= bid.amount ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                  >
                    {amount}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Game Stats */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
          <div className="text-lg font-medium mb-3">Game Statistics</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="font-medium">Tricks Played</div>
              <div className="text-2xl font-bold text-blue-600">{tricks.length}/13</div>
            </div>
            <div>
              <div className="font-medium">Current Turn</div>
              <div className="text-lg font-bold text-green-600">
                {gameMode === 'single' 
                  ? (gameState?.current_player === 1 ? 'You' : `AI ${gameState?.current_player - 1}`)
                  : `Player ${gameState?.current_player}`
                }
              </div>
            </div>
            <div>
              <div className="font-medium">Team 1 Tricks</div>
              <div className="text-2xl font-bold text-blue-600">
                {tricks.filter(t => t.winner === 1 || t.winner === 3).length}
              </div>
            </div>
            <div>
              <div className="font-medium">Team 2 Tricks</div>
              <div className="text-2xl font-bold text-red-600">
                {tricks.filter(t => t.winner === 2 || t.winner === 4).length}
              </div>
            </div>
          </div>
          
          {/* Debug info for card counts */}
          {gameMode === 'single' && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-sm font-medium text-gray-700 mb-2">Card Counts (Debug)</div>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div>You: {playerHand.length}</div>
                {players.filter(p => p.id !== 'human').map(player => (
                  <div key={player.id}>
                    {player.player_name}: {player.hand?.length || 0}
                  </div>
                ))}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                All players should have the same number of cards
              </div>
            </div>
          )}
        </div>

        {/* Trump Selection */}
        {gameState?.phase === 'trump-selection' && gameState?.current_player === currentPlayer?.position && (
          <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
            <div className="flex justify-between items-center">
              <div className="text-lg font-medium">
                Choose Trump Suit (You won with {bid.amount} tricks)
              </div>
              <div className="flex gap-2">
                {SUITS.map(suit => (
                  <button
                    key={suit}
                    onClick={() => setTrump(suit)}
                    className={`flex items-center gap-1 px-3 py-2 bg-white border rounded-lg hover:bg-gray-50 transition-colors ${SUIT_COLORS[suit]}`}
                  >
                    <span className="text-lg">{SUIT_SYMBOLS[suit]}</span>
                    <span className="text-sm capitalize">{suit}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Game Finished */}
        {gameState?.phase === 'finished' && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-4">
            <div className="text-center">
              <Trophy className="mx-auto text-yellow-500 mb-4" size={48} />
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Game Finished!</h2>
              
              <div className="grid grid-cols-2 gap-8 mb-6">
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-600 mb-2">
                    {gameState.game_state?.scores?.team1 || 0}
                  </div>
                  <div className="text-lg font-medium text-gray-700">
                    Team 1 {gameMode === 'single' ? '(You & AI 2)' : ''}
                  </div>
                  <div className="text-sm text-gray-600">
                    {tricks.filter(t => t.winner === 1 || t.winner === 3).length} tricks won
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-4xl font-bold text-red-600 mb-2">
                    {gameState.game_state?.scores?.team2 || 0}
                  </div>
                  <div className="text-lg font-medium text-gray-700">
                    Team 2 {gameMode === 'single' ? '(AI 1 & AI 3)' : ''}
                  </div>
                  <div className="text-sm text-gray-600">
                    {tricks.filter(t => t.winner === 2 || t.winner === 4).length} tricks won
                  </div>
                </div>
              </div>
              
              <div className="text-lg text-gray-700 mb-4">
                {(() => {
                  const team1Score = gameState.game_state?.scores?.team1 || 0;
                  const team2Score = gameState.game_state?.scores?.team2 || 0;
                  const bid = gameState.game_state?.bid;
                  
                  if (team1Score > team2Score) {
                    return gameMode === 'single' ? '🎉 Congratulations! You and AI 2 won!' : '🎉 Team 1 Wins!';
                  } else if (team2Score > team1Score) {
                    return gameMode === 'single' ? '😔 AI Team (AI 1 & AI 3) won this round.' : '🎉 Team 2 Wins!';
                  } else {
                    return "🤝 It's a tie!";
                  }
                })()}
              </div>
              
              {gameState.game_state?.bid && (
                <div className="text-sm text-gray-600 mb-6">
                  Bid: {gameState.game_state.bid.amount} tricks by {gameMode === 'single' ? 
                    (gameState.game_state.bid.player === 1 ? 'You' : `AI Player ${gameState.game_state.bid.player - 1}`) : 
                    `Player ${gameState.game_state.bid.player}`}
                </div>
              )}
              
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                Play Again
              </button>
            </div>
          </div>
        )}

        {/* Trick Result Display */}
        {trickResult && (
          <div className="bg-white rounded-lg shadow-lg p-4 mb-4 border-4 border-yellow-400">
            <div className="text-center">
              <div className="text-lg font-bold text-yellow-600 mb-3">
                🏆 Trick {trickResult.trickNumber} Won by {gameMode === 'single' ? 
                  (trickResult.winner === 1 ? 'You' : `AI Player ${trickResult.winner - 1}`) : 
                  `Player ${trickResult.winner}`}
              </div>
              
              <div className="flex justify-center gap-4 mb-3">
                {trickResult.cards.map((play, index) => {
                  const isWinning = play.player === trickResult.winner;
                  return (
                    <div key={index} className="text-center">
                      <div className={`p-2 rounded-lg ${isWinning ? 'bg-yellow-100 border-2 border-yellow-400' : 'bg-gray-50'}`}>
                        <Card card={play.card} onClick={() => {}} isPlayable={false} size="small" />
                      </div>
                      <div className={`text-sm mt-1 ${isWinning ? 'font-bold text-yellow-600' : 'text-gray-600'}`}>
                        {gameMode === 'single' ? (play.player === 1 ? 'You' : `AI ${play.player - 1}`) : `Player ${play.player}`}
                        {isWinning && ' ✨'}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="text-sm text-gray-600">
                <span className="font-medium text-blue-600">
                  🎯 {trickResult.winReason}
                </span>
              </div>
              
              {gameMode === 'single' && (
                <div className="mt-2 text-xs text-gray-500">
                  {(trickResult.winner === 1 || trickResult.winner === 3) ? 
                    '📗 Point for your team!' : 
                    '📕 Point for opponent team'}
                </div>
              )}
            </div>
          </div>
        )}

        

        {/* Current Trick */}
        {currentTrick.length > 0 && !trickResult && (
          <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
            <div className="text-lg font-medium mb-3">Current Trick</div>
            <div className="flex justify-center gap-4">
              {currentTrick.map((play, index) => (
                <div key={index} className="text-center">
                  <Card card={play.card} onClick={() => {}} isPlayable={false} size="small" />
                  <div className="text-sm text-gray-600 mt-1">
                    {gameMode === 'single' ? (play.player === 1 ? 'You' : `AI ${play.player - 1}`) : `Player ${play.player}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Player's Hand */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
          <div className="text-lg font-medium mb-3">
            Your Hand ({playerHand.length} cards)
          </div>
          <div className="flex gap-2 flex-wrap justify-center">
            {playerHand.map((card) => {
              const canPlay = gameState?.phase === 'playing' && gameState?.current_player === currentPlayer?.position;
              
              let isPlayable = canPlay;
              if (canPlay && currentTrick.length > 0) {
                const leadSuit = currentTrick[0].card.suit;
                const hasSuit = playerHand.some(c => c.suit === leadSuit);
                isPlayable = !hasSuit || card.suit === leadSuit;
              }
              
              return (
                <Card
                  key={card.id}
                  card={card}
                  isPlayable={isPlayable}
                  onClick={() => isPlayable && playCard(card)}
                />
              );
            })}
          </div>
        </div>

        {/* Other Players */}
        {gameMode === 'single' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {aiPlayers.map((aiPlayer) => {
              const isTeammate = (aiPlayer.position === 3); // AI Player 2 is your teammate
              return (
                <div key={aiPlayer.id} className={`bg-white rounded-lg shadow-lg p-4 ${isTeammate ? 'border-2 border-green-300' : ''}`}>
                  <div className="flex justify-between items-center mb-2">
                    <div className={`font-medium flex items-center gap-2 ${gameState?.current_player === aiPlayer.position ? 'text-blue-600' : 'text-gray-700'}`}>
                      <Crown size={16} className={isTeammate ? 'text-green-500' : 'text-purple-500'} />
                      {aiPlayer.player_name}
                      {isTeammate && <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Your Partner</span>}
                    </div>
                    <div className="text-sm text-gray-600">
                      {aiPlayer.hand?.length || 0} cards
                    </div>
                  </div>
                  
                  <div className="flex gap-1 flex-wrap">
                    {Array.from({ length: aiPlayer.hand?.length || 0 }).map((_, index) => (
                      <div
                        key={index}
                        className={`w-8 h-12 rounded border flex items-center justify-center ${isTeammate ? 'bg-green-600 border-green-700' : 'bg-purple-600 border-purple-700'}`}
                      >
                        <Crown className="text-white" size={12} />
                      </div>
                    ))}
                  </div>
                  
                  {bid.player === aiPlayer.position && (
                    <div className="mt-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                      Bidder: {bid.amount} tricks
                    </div>
                  )}
                  
                  {gameState?.current_player === aiPlayer.position && gameState?.phase !== 'finished' && !trickResult && (
                    <div className="mt-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded animate-pulse">
                      AI Thinking...
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {players.filter(p => p.id !== currentPlayer?.id).map((player) => (
              <div key={player.id} className="bg-white rounded-lg shadow-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <div className={`font-medium ${gameState?.current_player === player.position ? 'text-blue-600' : 'text-gray-700'}`}>
                    {player.player_name}
                  </div>
                  <div className="text-sm text-gray-600">
                    {player.hand?.length || 0} cards
                  </div>
                </div>
                
                <div className="flex gap-1 flex-wrap">
                  {Array.from({ length: player.hand?.length || 0 }).map((_, index) => (
                    <div
                      key={index}
                      className="w-8 h-12 bg-blue-600 rounded border border-blue-700 flex items-center justify-center"
                    >
                      <Crown className="text-white" size={12} />
                    </div>
                  ))}
                </div>
                
                {bid.player === player.position && (
                  <div className="mt-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                    Bidder: {bid.amount} tricks
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Trick History - Always visible */}
        <div className="bg-white rounded-lg shadow-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-medium">Trick History</h3>
            <div className="text-sm text-gray-600">
              {trickHistory.length} trick{trickHistory.length !== 1 ? 's' : ''} completed
            </div>
          </div>
          
          {trickHistory.length === 0 ? (
            <div className="text-center text-gray-500 py-4">
              <div className="text-sm">No tricks completed yet</div>
              <div className="text-xs mt-1">Previous tricks will appear here after each round</div>
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-3">
              {trickHistory.slice().reverse().map((trick, index) => (
                <div key={trick.timestamp} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-sm">
                      Trick {trick.trickNumber}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      gameMode === 'single' && (trick.winner === 1 || trick.winner === 3) ? 
                      'bg-green-100 text-green-700' : 
                      gameMode === 'single' && (trick.winner === 2 || trick.winner === 4) ?
                      'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      Won by {gameMode === 'single' ? 
                        (trick.winner === 1 ? 'You' : `AI ${trick.winner - 1}`) : 
                        `Player ${trick.winner}`}
                    </span>
                  </div>
                  
                  <div className="flex gap-2 mb-2">
                    {trick.cards.map((play, cardIndex) => {
                      const isWinning = play.player === trick.winner;
                      return (
                        <div key={cardIndex} className="text-center">
                          <div className={`p-1 rounded ${isWinning ? 'bg-yellow-50 border border-yellow-300' : 'bg-gray-50'}`}>
                            <Card card={play.card} onClick={() => {}} isPlayable={false} size="small" />
                          </div>
                          <div className={`text-xs mt-1 ${isWinning ? 'font-bold text-yellow-600' : 'text-gray-500'}`}>
                            {gameMode === 'single' ? (play.player === 1 ? 'You' : `AI${play.player - 1}`) : `P${play.player}`}
                            {isWinning && ' 🏆'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="text-xs text-blue-600 font-medium">
                    📝 {trick.winReason}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TarneebMultiplayer;