import { Room, Client } from "@colyseus/core";
import { LobbyState, Player } from "./schema/LobbyState";

export class LobbyRoom extends Room<LobbyState> {
  maxClients = 16; // Increased for a multiplayer lobby
  state = new LobbyState();
  
  // Track client IDs to allow multiple connections from same browser
  clientIds = new Map<string, string>();

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
      const targetPlayer = this.state.players.get(message.targetId);
      if (targetPlayer) {
        targetPlayer.health -= message.amount;
        
        // If player health is depleted
        if (targetPlayer.health <= 0) {
          targetPlayer.health = 100; // Respawn with full health
          
          // Optionally increment score for the attacker
          const attackerPlayer = this.state.players.get(client.sessionId);
          if (attackerPlayer) {
            attackerPlayer.score += 1;
          }
        }
      }
    });
    
    this.onMessage("equip", (client, message) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.equippedItem = message.itemId;
      }
    });
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
