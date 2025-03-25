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
        // Increment score for the source player (who threw the projectile)
        const sourcePlayer = this.state.players.get(targetId);
        if (sourcePlayer) {
          sourcePlayer.score += 10; // 10 points for a kill
          console.log(`${targetId}'s score increased to ${sourcePlayer.score}`);
        }
        
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
  }

  onLeave (client: Client, consented: boolean) {
    console.log(client.sessionId, "left the lobby!");
    
    // Remove the client ID mapping
    this.clientIds.delete(client.sessionId);
    
    // Remove the player from the state
    this.state.players.delete(client.sessionId);
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
}
