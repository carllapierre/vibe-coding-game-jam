// Open the metaverse host in a new tab

export function redirectMetaverse() {
    window.open(import.meta.env.VITE_METAVERSE_HOST);
}