export const consumeAnimation = (player, durationMs = 500) => {
    if (!player) return;
    
    // Start the consume animation
    player.isConsumeAnimating = true;
    player.consumeAnimationStartTime = Date.now();
    player.consumeAnimationDuration = durationMs;
    
    // Hide the preview model during animation
    if (player.previewModel) {
        player.previewModel.visible = false;
    }
} 