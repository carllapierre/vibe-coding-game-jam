export class Leaderboard {
  constructor() {
    this.container = null;
    this.players = [];
    this.createLeaderboard();
  }
  
  createLeaderboard() {
    // Create container
    this.container = document.createElement('div');
    this.container.id = 'leaderboard';
    this.container.style.cssText = `
      position: absolute;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #6b9ac4 0%, #486f9d 100%);
      border: 2px solid #ffffffa0;
      border-radius: 12px;
      padding: 12px;
      color: white;
      font-family: sans-serif;
      min-width: 200px;
      z-index: 1000;
      box-shadow: 0 4px 15px rgba(72, 111, 157, 0.3);
      transform-origin: top right;
      opacity: 0;
      transform: scale(0.8);
      transition: opacity 0.3s ease, transform 0.3s ease;
    `;
    
    // Add title
    const title = document.createElement('div');
    title.textContent = 'LEADERBOARD';
    title.style.cssText = `
      font-size: 16px;
      font-weight: bold;
      text-align: center;
      margin-bottom: 10px;
      text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.6);
      color: #fff;
      border-bottom: 1px solid rgba(255, 255, 255, 0.3);
      padding-bottom: 5px;
    `;
    this.container.appendChild(title);
    
    // Add header with "Kills" label
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      padding: 0 6px;
      margin-bottom: 5px;
    `;
    
    const playerLabel = document.createElement('div');
    playerLabel.textContent = 'Player';
    playerLabel.style.cssText = `
      font-size: 12px;
      color: rgba(255, 255, 255, 0.8);
    `;
    
    const killsLabel = document.createElement('div');
    killsLabel.textContent = 'Kills';
    killsLabel.style.cssText = `
      font-size: 12px;
      color: rgba(255, 255, 255, 0.8);
    `;
    
    header.appendChild(playerLabel);
    header.appendChild(killsLabel);
    this.container.appendChild(header);
    
    // Create player list container
    this.playerListEl = document.createElement('div');
    this.playerListEl.style.cssText = `
      margin-top: 5px;
    `;
    this.container.appendChild(this.playerListEl);
    
    // Add to DOM
    document.body.appendChild(this.container);
    
    // Animate in
    setTimeout(() => {
      this.container.style.opacity = '1';
      this.container.style.transform = 'scale(1)';
    }, 100);
    
    // Add animation keyframes if not already added
    if (!document.getElementById('leaderboardAnimations')) {
      const style = document.createElement('style');
      style.id = 'leaderboardAnimations';
      style.textContent = `
        @keyframes leaderboardAppear {
          0% {
            transform: scale(0.5);
            opacity: 0;
          }
          50% {
            transform: scale(1.1) rotate(1deg);
          }
          70% {
            transform: scale(0.95) rotate(-0.5deg);
          }
          100% {
            transform: scale(1) rotate(0);
            opacity: 1;
          }
        }
        @keyframes crownGlow {
          0% { text-shadow: 0 0 5px gold, 0 0 10px gold; }
          50% { text-shadow: 0 0 10px gold, 0 0 15px gold; }
          100% { text-shadow: 0 0 5px gold, 0 0 10px gold; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  updateLeaderboard(players) {
    // Clear current list
    this.playerListEl.innerHTML = '';
    
    // Handle empty players array
    if (!players || players.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.textContent = 'No players connected';
      emptyMessage.style.cssText = `
        text-align: center;
        font-style: italic;
        color: rgba(255, 255, 255, 0.6);
        padding: 10px 0;
      `;
      this.playerListEl.appendChild(emptyMessage);
      return;
    }
    
    // Sort players by score (kills)
    this.players = [...players].sort((a, b) => b.score - a.score);
    
    // Display top 5 players (or all if less than 5)
    const displayCount = Math.min(this.players.length, 5);
    
    for (let i = 0; i < displayCount; i++) {
      const player = this.players[i];
      
      const playerRow = document.createElement('div');
      playerRow.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 6px;
        margin: 4px 0;
        background: rgba(255, 255, 255, 0.15);
        border-radius: 8px;
        box-shadow: inset 0 0 5px rgba(255, 255, 255, 0.1);
        animation: leaderboardAppear 0.3s ease-out forwards;
        animation-delay: ${i * 0.05}s;
        opacity: 0;
      `;
      
      // Add special styling for top player
      if (i === 0 && player.score > 0) {
        playerRow.style.background = 'rgba(255, 215, 0, 0.2)';
        playerRow.style.boxShadow = 'inset 0 0 10px rgba(255, 215, 0, 0.3)';
        playerRow.style.border = '1px solid rgba(255, 215, 0, 0.3)';
      }
      
      const playerNameContainer = document.createElement('div');
      playerNameContainer.style.cssText = `
        display: flex;
        align-items: center;
      `;
      
      // Crown icon for top player with kills
      if (i === 0 && player.score > 0) {
        const crown = document.createElement('span');
        crown.textContent = '👑 ';
        crown.style.cssText = `
          font-size: 14px;
          margin-right: 4px;
          animation: crownGlow 1.5s infinite;
        `;
        playerNameContainer.appendChild(crown);
      }
      
      const playerName = document.createElement('div');
      playerName.textContent = player.name || `Player ${player.id.substring(0, 4)}`;
      playerName.style.cssText = `
        font-size: 14px;
        text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
      `;
      
      playerNameContainer.appendChild(playerName);
      
      const scoreContainer = document.createElement('div');
      scoreContainer.style.cssText = `
        display: flex;
        align-items: center;
        background: rgba(255, 255, 255, 0.2);
        padding: 2px 8px;
        border-radius: 10px;
      `;
      
      // Special styling for top player score
      if (i === 0 && player.score > 0) {
        scoreContainer.style.background = 'rgba(255, 215, 0, 0.3)';
      }
      
      const playerScore = document.createElement('div');
      playerScore.textContent = player.score || 0;
      playerScore.style.cssText = `
        font-size: 14px;
        font-weight: bold;
        text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.7);
      `;
      
      scoreContainer.appendChild(playerScore);
      playerRow.appendChild(playerNameContainer);
      playerRow.appendChild(scoreContainer);
      this.playerListEl.appendChild(playerRow);
    }
  }
  
  // Show/hide the leaderboard
  show() {
    this.container.style.display = 'block';
    setTimeout(() => {
      this.container.style.opacity = '1';
      this.container.style.transform = 'scale(1)';
    }, 10);
  }
  
  hide() {
    this.container.style.opacity = '0';
    this.container.style.transform = 'scale(0.8)';
    setTimeout(() => {
      this.container.style.display = 'none';
    }, 300);
  }
} 