// Open the metaverse host in a new tab
const ref = 'https://foodvibers.netlify.app';
import { addUsernameToUrl } from '../../utils/urlParams.js';

export function redirectRandomGame() {
    // Add username to the URL if available
    const url = addUsernameToUrl('https://portal.pieter.com?ref=' + ref);
    window.location.href = url;
}

export function redirectVibeverse() {
    // Add username to the URL if available
    const url = addUsernameToUrl('https://metaverse-delta.vercel.app/?ref=' + ref);
    window.location.href = url;
}