// Short cut for assets paths
const assetPath = (path) => {
    return `/assets/${path}`;
};

/**
 * Debug utility to log asset paths
 * @param {string} path - The asset path to log
 * @returns {string} - The full URL of the asset
 */
const logAssetPath = (path) => {
    const fullPath = assetPath(path);
    console.log(`Asset path: ${fullPath}`);
    return fullPath;
};

export { assetPath, logAssetPath };