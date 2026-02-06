/**
 * HubRise API Service
 * Handles all interactions with HubRise API
 */

/**
 * Exchange OAuth code for access token
 * @param {string} code - OAuth authorization code
 * @param {string} clientId - HubRise client ID
 * @param {string} clientSecret - HubRise client secret
 * @param {string} redirectUri - OAuth redirect URI
 * @returns {Promise<Object>} Token response
 */
export async function exchangeCodeForToken(code, clientId, clientSecret, redirectUri) {
  const tokenUrl = 'https://manager.hubrise.com/oauth2/v1/token';
  
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri
  });
  
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }
  
  return await response.json();
}

/**
 * Refresh access token
 * @param {string} refreshToken - Refresh token
 * @param {string} clientId - HubRise client ID
 * @param {string} clientSecret - HubRise client secret
 * @returns {Promise<Object>} New token response
 */
export async function refreshAccessToken(refreshToken, clientId, clientSecret) {
  const tokenUrl = 'https://manager.hubrise.com/oauth2/v1/token';
  
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret
  });
  
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }
  
  return await response.json();
}

/**
 * Get account information from HubRise
 * @param {string} accessToken - HubRise access token
 * @param {string} accountId - HubRise account ID
 * @returns {Promise<Object>} Account information
 */
export async function getAccountInfo(accessToken, accountId) {
  const response = await fetch(`https://api.hubrise.com/v1/accounts/${accountId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get account info: ${response.statusText}`);
  }
  
  return await response.json();
}

/**
 * Get location information from HubRise
 * @param {string} accessToken - HubRise access token
 * @param {string} locationId - HubRise location ID
 * @returns {Promise<Object>} Location information
 */
export async function getLocationInfo(accessToken, locationId) {
  const response = await fetch(`https://api.hubrise.com/v1/locations/${locationId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get location info: ${response.statusText}`);
  }
  
  return await response.json();
}

/**
 * Sync menu to HubRise catalog
 * @param {string} accessToken - HubRise access token
 * @param {string} catalogId - HubRise catalog ID
 * @param {Object} menuData - Menu data to sync
 * @returns {Promise<Object>} Sync response
 */
export async function syncMenuToHubRise(accessToken, catalogId, menuData) {
  const response = await fetch(`https://api.hubrise.com/v1/catalogs/${catalogId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(menuData)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Menu sync failed: ${error}`);
  }
  
  return await response.json();
}

/**
 * Get orders from HubRise
 * @param {string} accessToken - HubRise access token
 * @param {string} locationId - HubRise location ID
 * @param {Object} filters - Optional filters (status, date, etc.)
 * @returns {Promise<Array>} List of orders
 */
export async function getOrders(accessToken, locationId, filters = {}) {
  const params = new URLSearchParams(filters);
  const url = `https://api.hubrise.com/v1/locations/${locationId}/orders?${params.toString()}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get orders: ${response.statusText}`);
  }
  
  return await response.json();
}

/**
 * Update order status in HubRise
 * @param {string} accessToken - HubRise access token
 * @param {string} orderId - HubRise order ID
 * @param {Object} updateData - Update data (status, expected_time, etc.)
 * @returns {Promise<Object>} Updated order
 */
export async function updateOrderStatus(accessToken, orderId, updateData) {
  const response = await fetch(`https://api.hubrise.com/v1/orders/${orderId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updateData)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Order update failed: ${error}`);
  }
  
  return await response.json();
}

/**
 * Get catalog from HubRise
 * @param {string} accessToken - HubRise access token
 * @param {string} catalogId - HubRise catalog ID
 * @returns {Promise<Object>} Catalog data
 */
export async function getCatalog(accessToken, catalogId) {
  const response = await fetch(`https://api.hubrise.com/v1/catalogs/${catalogId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get catalog: ${response.statusText}`);
  }
  
  return await response.json();
}

/**
 * Create a callback (webhook) in HubRise
 * @param {string} accessToken - HubRise access token
 * @param {string} locationId - HubRise location ID
 * @param {string} callbackUrl - Webhook URL
 * @param {Array<string>} events - Events to subscribe to
 * @returns {Promise<Object>} Callback response
 */
export async function createCallback(accessToken, locationId, callbackUrl, events = ['order.create', 'order.update']) {
  const response = await fetch(`https://api.hubrise.com/v1/locations/${locationId}/callbacks`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: callbackUrl,
      events: events
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Callback creation failed: ${error}`);
  }
  
  return await response.json();
}

/**
 * Transform menu data to HubRise catalog format
 * @param {Array} menuItems - Menu items from your system
 * @returns {Object} HubRise catalog format
 */
export function transformMenuToHubRiseCatalog(menuItems) {
  const categories = {};
  const products = [];
  
  // Group items by category
  menuItems.forEach(item => {
    const categoryName = item.Category || 'Uncategorized';
    
    if (!categories[categoryName]) {
      categories[categoryName] = {
        name: categoryName,
        ref: categoryName.toLowerCase().replace(/\s+/g, '_')
      };
    }
    
    products.push({
      name: item.Name || item.ItemName,
      ref: item.RowKey || item.id,
      category_ref: categories[categoryName].ref,
      description: item.Description || '',
      price: parseFloat(item.Price || 0),
      image_ids: item.ImageUrl ? [item.ImageUrl] : [],
      tags: item.Tags ? item.Tags.split(',').map(t => t.trim()) : [],
      available: item.IsAvailable !== false
    });
  });
  
  return {
    name: 'Menu Catalog',
    categories: Object.values(categories),
    products: products
  };
}

/**
 * Transform HubRise order to internal order format
 * @param {Object} hubriseOrder - Order from HubRise
 * @returns {Object} Internal order format
 */
export function transformHubRiseOrderToInternal(hubriseOrder) {
  return {
    hubriseOrderId: hubriseOrder.id,
    status: hubriseOrder.status,
    customerName: hubriseOrder.customer?.first_name + ' ' + hubriseOrder.customer?.last_name,
    customerEmail: hubriseOrder.customer?.email,
    customerPhone: hubriseOrder.customer?.phone,
    items: hubriseOrder.items?.map(item => ({
      name: item.product_name,
      quantity: item.quantity,
      price: item.price,
      skuRef: item.sku_ref
    })) || [],
    totalAmount: hubriseOrder.total,
    currency: hubriseOrder.currency,
    serviceType: hubriseOrder.service_type,
    expectedTime: hubriseOrder.expected_time,
    createdAt: hubriseOrder.created_at
  };
}
