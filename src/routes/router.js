import {
    initiateHubRiseConnection,
    handleHubRiseCallback,
    getHubRiseStatus,
    disconnectHubRise,
    syncMenuToHubRiseHandler,
    handleHubRiseWebhook,
    updateHubRiseOrderStatus,
    getHubRiseOrders
} from '../handlers/hubriseHandlers.js';

export const routes = [
    // HubRise Integration Routes
    { path: '/api/hubrise/connect', auth: 'token', handler: initiateHubRiseConnection },
    { path: '/api/hubrise/callback', auth: 'none', handler: handleHubRiseCallback },
    { path: '/api/hubrise/status', auth: 'token', handler: getHubRiseStatus },
    { path: '/api/hubrise/disconnect', auth: 'token', handler: disconnectHubRise },
    { path: '/api/hubrise/sync-menu', auth: 'token', handler: syncMenuToHubRiseHandler },
    { path: '/api/hubrise/webhook', auth: 'none', handler: handleHubRiseWebhook },
    { path: '/api/hubrise/update-order-status', auth: 'token', handler: updateHubRiseOrderStatus },
    { path: '/api/hubrise/orders', auth: 'token', handler: getHubRiseOrders },
];
