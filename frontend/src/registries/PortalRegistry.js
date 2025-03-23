import { Registry } from '../core/Registry.js';
import { redirectMetaverse } from '../portals/onEnter/redirectMetaverse.js';

export class PortalRegistry extends Registry {
    
    static items = [
        { id: 'redirect-1', onEnter: redirectMetaverse },
    ];

}
