import { Room, Client } from "@colyseus/core";
import { LobbyState, Player } from "./schema/LobbyState";

export class LobbyRoom extends Room<LobbyState> {
  maxClients = 16; // Increased for a multiplayer lobby
  state = new LobbyState();
  
  // Track client IDs to allow multiple connections from same browser
  clientIds = new Map<string, string>();
  
  // Define spawn points for player respawns
  spawnPoints = [
    { x: 0, y: 2, z: 0 },
    { x: 10, y: 2, z: 10 },
    { x: -10, y: 2, z: -10 },
    { x: 10, y: 2, z: -10 },
    { x: -10, y: 2, z: 10 }
  ];

  onCreate (options: any) {
    console.log("LobbyRoom created!", this.roomId);
    
    // Set simulation interval for game loop
    this.setSimulationInterval((deltaTime) => this.update(deltaTime));
    
    this.onMessage("move", (client, message) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.x = message.x;
        player.y = message.y;
        player.z = message.z;
        player.rotationY = message.rotationY;
      }
    });
    
    this.onMessage("damage", (client, message) => {
      const { targetId, amount } = message;
      const targetPlayer = this.state.players.get(targetId);
      
      if (!targetPlayer) {
        console.log(`Target player ${targetId} not found for damage`);
        return;
      }
      
      console.log(`Processing damage: ${client.sessionId} -> ${targetId} for ${amount} damage`);
      
      // The client who reported damage is the TARGET (the one being hit)
      // targetId is the SOURCE (the one who threw the projectile)
      
      // Update the target player's health (that's the client who sent the message)
      // This reverses the source/target relationship to match the projectile hit flow
      const hitPlayer = this.state.players.get(client.sessionId);
      
      if (!hitPlayer) {
        console.log(`Hit player ${client.sessionId} not found`);
        return;
      }
      
      // Update target player's health
      hitPlayer.health = Math.max(0, hitPlayer.health - amount);
      console.log(`${client.sessionId}'s health reduced to ${hitPlayer.health}`);
      
      // If player health is depleted
      if (hitPlayer.health <= 0) {
        // Don't increment score here, will be handled by killAttribution
        
        // Schedule respawn
        this.respawnPlayer(hitPlayer);
      }
      
      // Broadcast damage event to all clients
      this.broadcast("damage", {
        targetId: client.sessionId,  // The player who was hit (sent the message)
        sourceId: targetId,          // The player who threw the projectile
        amount: amount,
        remainingHealth: hitPlayer.health
      });
    });
    
    this.onMessage("projectile", (client, data) => {
      console.log(`Received projectile from ${client.sessionId}:`, data.itemType);
      
      // Add the player ID to the projectile data
      const projectileData = {
        ...data,
        playerId: client.sessionId
      };
      
      // Broadcast to all clients except the sender
      this.broadcast("projectile", projectileData, { except: client });
    });
    
    this.onMessage("equip", (client, message) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.equippedItem = message.itemId;
      }
    });
    
    this.onMessage("playerState", (client, message) => {
      const player = this.state.players.get(client.sessionId);
      if (player && message.state) {
        player.state = message.state;
        console.log(`Player ${client.sessionId} state updated to: ${message.state}`);
      }
    });
    
    this.onMessage("playerHit", (client, message) => {
      const { targetId, damage, itemType, sourceId } = message;
      const targetPlayer = this.state.players.get(targetId);
      const sourcePlayer = this.state.players.get(sourceId || client.sessionId);
      
      if (!targetPlayer || !sourcePlayer) {
        console.log(`Invalid players for hit: source=${sourceId}, target=${targetId}`);
        return;
      }
      
      console.log(`Processing hit: ${sourceId} -> ${targetId} for ${damage} damage with ${itemType}`);
      
      // Generate a unique hit ID for tracking
      const hitId = `hit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Update target player's health
      targetPlayer.health = Math.max(0, targetPlayer.health - damage);
      console.log(`${targetId}'s health reduced to ${targetPlayer.health}`);
      
      // If player health is depleted
      if (targetPlayer.health <= 0) {
        // Don't increment score here, it will be handled by killAttribution
        // Schedule respawn
        this.respawnPlayer(targetPlayer);
      }
      
      // Broadcast damage event to ALL clients including the target and source
      // This ensures synchronization across all clients
      this.broadcast("playerDamaged", {
        hitId: hitId, // Add unique ID for deduplication
        targetId: targetId,
        sourceId: sourceId || client.sessionId,
        damage: damage,
        itemType: itemType,
        remainingHealth: targetPlayer.health,
        timestamp: Date.now()
      });
      
      // Send a direct message to the target player to ensure they get the hit
      // This helps with reliable delivery of hit events
      const targetClient = this.clients.find(c => c.sessionId === targetId);
      if (targetClient) {
        targetClient.send("playerHit", {
          hitId: hitId,
          targetId: targetId,
          sourceId: sourceId || client.sessionId,
          damage: damage,
          itemType: itemType
        });
      }
    });
    
    // Handle kill attribution from clients
    this.onMessage("killAttribution", (client, message) => {
      const { killerId } = message;
      
      // Get the killer
      const killer = this.state.players.get(killerId);
      if (!killer) {
        console.log(`Killer ${killerId} not found for kill attribution`);
        return;
      }
      
      // Increment the killer's score
      killer.score += 1;
      console.log(`Player ${killerId} scored a kill, new score: ${killer.score}`);
      
      // Broadcast leaderboard update to all clients
      const leaderboardData = this.getLeaderboardData();
      this.broadcast("leaderboardUpdate", leaderboardData);
    });
    
    // Handle request for leaderboard data
    this.onMessage("requestLeaderboard", (client) => {
      console.log(`Player ${client.sessionId} requested leaderboard data`);
      
      // Get the current leaderboard data
      const leaderboardData = this.getLeaderboardData();
      
      // Send the leaderboard data to the client who requested it
      client.send("leaderboardUpdate", leaderboardData);
    });
  }

  /**
   * Respawn a player after they die
   * @param player The player to respawn
   */
  respawnPlayer(player: Player) {
    // Wait 3 seconds before respawning
    setTimeout(() => {
      // Reset health
      player.health = 100;
      
      // Set to a random spawn position
      const spawn = this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)];
      
      player.x = spawn.x;
      player.y = spawn.y;
      player.z = spawn.z;
      
      // Notify about respawn
      this.broadcast("playerRespawned", {
        playerId: player.id
      });
      
      console.log(`Player ${player.id} respawned at`, spawn);
    }, 3000);
  }

  onJoin (client: Client, options: any) {
    console.log(client.sessionId, "joined the lobby!", options);
    
    // Store client ID if provided (for handling multiple tabs)
    if (options.clientId) {
      this.clientIds.set(client.sessionId, options.clientId);
      console.log(`Client ID ${options.clientId} registered for session ${client.sessionId}`);
    }
    
    // Create a new player in the state
    const player = new Player();
    player.id = client.sessionId;
    player.name = options.name || "Player";
    player.x = 0;
    player.y = 0;
    player.z = 0;
    player.rotationY = 0;
    player.characterModel = options.characterModel || "character-1";
    player.health = 100;
    player.equippedItem = null;
    player.score = 0;
    player.clientId = options.clientId || null;
    
    this.state.players.set(client.sessionId, player);
    
    // Broadcast updated leaderboard after player joins
    const leaderboardData = this.getLeaderboardData();
    this.broadcast("leaderboardUpdate", leaderboardData);
  }

  onLeave (client: Client, consented: boolean) {
    console.log(client.sessionId, "left the lobby!");
    
    // Remove the client ID mapping
    this.clientIds.delete(client.sessionId);
    
    // Remove the player from the state
    this.state.players.delete(client.sessionId);
    
    // Broadcast updated leaderboard after player leaves
    const leaderboardData = this.getLeaderboardData();
    this.broadcast("leaderboardUpdate", leaderboardData);
  }

  onDispose() {
    console.log("Lobby room", this.roomId, "disposing...");
    this.clientIds.clear();
  }
  
  // Game loop update function
  update(deltaTime: number) {
    // Handle game state updates, AI, physics, etc.
    // For now, this is a simple placeholder for future game logic
  }
  
  /**
   * Get leaderboard data for all players
   * @returns Array of player data for leaderboard
   */
  getLeaderboardData(): Array<{id: string, name: string, score: number}> {
    const players: Array<{id: string, name: string, score: number}> = [];
    
    this.state.players.forEach((player, sessionId) => {
      players.push({
        id: sessionId,
        name: player.name,
        score: player.score
      });
    });
    
    return players;
  }
}
