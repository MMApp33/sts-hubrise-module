/**
 * HubRise Integration Handlers
 * Handles OAuth, webhooks, menu sync, and order management
 */

import { getCorsHeaders } from '../utils/utils.js';
import { encrypt, decrypt, validateHMAC, generateUUID } from '../utils/encryption.js';
import {
  exchangeCodeForToken,
  refreshAccessToken,
  getAccountInfo,
  getLocationInfo,
  syncMenuToHubRise,
  updateOrderStatus,
  createCallback,
  transformMenuToHubRiseCatalog,
  transformHubRiseOrderToInternal
} from '../services/hubriseService.js';
import { addOrderItem, readtodayOrders } from '../services/storageService.js';

/**
 * Initiate HubRise OAuth flow
 * GET /api/hubrise/connect
 */
export async function initiateHubRiseConnection(request, env, decoded) {
  try {
    const organizationId = decoded.userClaims.MotelID;
    
    if (!organizationId) {
      return new Response(JSON.stringify({ error: 'Organization ID not found' }), {
        status: 400,
        headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
      });
    }
    
    // Build OAuth URL
    const authUrl = new URL('https://manager.hubrise.com/oauth2/v1/authorize');
    authUrl.searchParams.append('client_id', env.HUBRISE_CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', env.HUBRISE_REDIRECT_URI);
    authUrl.searchParams.append('scope', env.HUBRISE_SCOPE || 'location[orders.write,catalog.write]');
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('state', organizationId);
    
    return new Response(JSON.stringify({ 
      authUrl: authUrl.toString(),
      message: 'Redirect user to this URL to connect HubRise'
    }), {
      status: 200,
      headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error initiating HubRise connection:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to initiate connection',
      details: error.message 
    }), {
      status: 500,
      headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle OAuth callback from HubRise
 * GET /api/hubrise/callback
 */
export async function handleHubRiseCallback(request, env) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const organizationId = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    
    if (error) {
      console.error('OAuth error:', error);
      return Response.redirect(`${env.APP_URL}/admin/settings/integrations?error=${error}`, 302);
    }
    
    if (!code || !organizationId) {
      return new Response('Invalid callback parameters', { status: 400 });
    }
    
    // Exchange code for tokens
    const tokens = await exchangeCodeForToken(
      code,
      env.HUBRISE_CLIENT_ID,
      env.HUBRISE_CLIENT_SECRET,
      env.HUBRISE_REDIRECT_URI
    );
    
    // Get account info
    let accountName = 'Unknown';
    try {
      const accountInfo = await getAccountInfo(tokens.access_token, tokens.account_id);
      accountName = accountInfo.name || accountName;
    } catch (err) {
      console.error('Failed to get account info:', err);
    }
    
    // Encrypt tokens
    const encryptedAccessToken = await encrypt(tokens.access_token, env.ENCRYPTION_SECRET);
    const encryptedRefreshToken = await encrypt(tokens.refresh_token, env.ENCRYPTION_SECRET);
    
    // Calculate token expiry
    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();
    
    // Store in D1 database
    const connectionId = generateUUID();
    await env.DB.prepare(`
      INSERT INTO hubrise_connections (
        id, organization_id, hubrise_account_id, hubrise_location_id,
        access_token, refresh_token, token_expires_at, account_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(organization_id) DO UPDATE SET
        hubrise_account_id = excluded.hubrise_account_id,
        hubrise_location_id = excluded.hubrise_location_id,
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        token_expires_at = excluded.token_expires_at,
        account_name = excluded.account_name,
        updated_at = datetime('now')
    `).bind(
      connectionId,
      organizationId,
      tokens.account_id,
      tokens.location_id,
      encryptedAccessToken,
      encryptedRefreshToken,
      expiresAt,
      accountName
    ).run();
    
    // Create webhook callback
    try {
      const webhookUrl = `${env.API_ENDPOINT}/api/hubrise/webhook`;
      await createCallback(tokens.access_token, tokens.location_id, webhookUrl);
    } catch (err) {
      console.error('Failed to create webhook:', err);
    }
    
    // Redirect back to app
    return Response.redirect(`${env.APP_URL}/admin/settings/integrations?connected=true`, 302);
  } catch (error) {
    console.error('OAuth callback error:', error);
    return Response.redirect(`${env.APP_URL}/admin/settings/integrations?error=callback_failed`, 302);
  }
}

/**
 * Get HubRise connection status
 * GET /api/hubrise/status
 */
export async function getHubRiseStatus(request, env, decoded) {
  try {
    const organizationId = decoded.userClaims.MotelID;
    
    const connection = await env.DB.prepare(
      'SELECT organization_id, hubrise_account_id, account_name, connected_at, last_synced_at, is_active FROM hubrise_connections WHERE organization_id = ?'
    ).bind(organizationId).first();
    
    if (!connection) {
      return new Response(JSON.stringify({ 
        connected: false,
        message: 'No HubRise connection found'
      }), {
        status: 200,
        headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      connected: !!connection.is_active,
      accountName: connection.account_name,
      accountId: connection.hubrise_account_id,
      connectedAt: connection.connected_at,
      lastSyncedAt: connection.last_synced_at
    }), {
      status: 200,
      headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting HubRise status:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to get status',
      details: error.message 
    }), {
      status: 500,
      headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Disconnect HubRise integration
 * POST /api/hubrise/disconnect
 */
export async function disconnectHubRise(request, env, decoded) {
  try {
    const organizationId = decoded.userClaims.MotelID;
    
    await env.DB.prepare(
      'UPDATE hubrise_connections SET is_active = 0, updated_at = datetime(\'now\') WHERE organization_id = ?'
    ).bind(organizationId).run();
    
    return new Response(JSON.stringify({ 
      success: true,
      message: 'HubRise disconnected successfully'
    }), {
      status: 200,
      headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error disconnecting HubRise:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to disconnect',
      details: error.message 
    }), {
      status: 500,
      headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Sync menu to HubRise
 * POST /api/hubrise/sync-menu
 */
export async function syncMenuToHubRiseHandler(request, env, decoded) {
  try {
    const organizationId = decoded.userClaims.MotelID;
    
    // Get HubRise connection
    const connection = await env.DB.prepare(
      'SELECT * FROM hubrise_connections WHERE organization_id = ? AND is_active = 1'
    ).bind(organizationId).first();
    
    if (!connection) {
      return new Response(JSON.stringify({ 
        error: 'No active HubRise connection found'
      }), {
        status: 404,
        headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
      });
    }
    
    // Decrypt access token
    const accessToken = await decrypt(connection.access_token, env.ENCRYPTION_SECRET);
    
    // Get menu from KV
    const menuDataJson = await env.sts_menu.get(organizationId + "Menu");
    if (!menuDataJson) {
      return new Response(JSON.stringify({ 
        error: 'No menu data found'
      }), {
        status: 404,
        headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
      });
    }
    
    const menuItems = JSON.parse(menuDataJson);
    
    // Transform menu to HubRise format
    const catalog = transformMenuToHubRiseCatalog(menuItems);
    
    // Sync to HubRise
    const catalogId = connection.hubrise_location_id; // Use location ID as catalog ID
    await syncMenuToHubRise(accessToken, catalogId, catalog);
    
    // Update last sync time
    await env.DB.prepare(
      'UPDATE hubrise_connections SET last_synced_at = datetime(\'now\'), updated_at = datetime(\'now\') WHERE organization_id = ?'
    ).bind(organizationId).run();
    
    return new Response(JSON.stringify({ 
      success: true,
      itemsSynced: menuItems.length,
      message: 'Menu synced successfully to HubRise'
    }), {
      status: 200,
      headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error syncing menu to HubRise:', error);
    
    return new Response(JSON.stringify({ 
      error: 'Failed to sync menu',
      details: error.message 
    }), {
      status: 500,
      headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle HubRise webhook
 * POST /api/hubrise/webhook
 */
export async function handleHubRiseWebhook(request, env) {
  try {
    const body = await request.text();
    const signature = request.headers.get('X-Hubrise-Hmac-SHA256');
    
    // Validate HMAC signature
    if (env.HUBRISE_WEBHOOK_SECRET) {
      const isValid = await validateHMAC(body, signature, env.HUBRISE_WEBHOOK_SECRET);
      if (!isValid) {
        console.error('Invalid webhook signature');
        return new Response('Invalid signature', { status: 401 });
      }
    }
    
    const webhook = JSON.parse(body);
    const eventType = webhook.event_type;
    const locationId = webhook.location_id;
    
    // Find organization by location ID
    const connection = await env.DB.prepare(
      'SELECT organization_id FROM hubrise_connections WHERE hubrise_location_id = ? AND is_active = 1'
    ).bind(locationId).first();
    
    if (!connection) {
      console.error('No connection found for location:', locationId);
      return new Response('OK', { status: 200 }); // Return 200 to prevent retries
    }
    
    const organizationId = connection.organization_id;
    
    // Handle different event types
    if (eventType === 'order.create' || eventType === 'order.update') {
      const order = webhook.order;
      const transformedOrder = transformHubRiseOrderToInternal(order);
      
      // Prepare order for Azure Table Storage
      const orderData = {
        PartitionKey: organizationId,
        RowKey: order.id || generateUUID(),
        hubriseOrderId: order.id,
        hubriseLocationId: locationId,
        status: order.status || 'new',
        customerName: transformedOrder.customerName || '',
        customerEmail: transformedOrder.customerEmail || '',
        customerPhone: transformedOrder.customerPhone || '',
        orderItems: JSON.stringify(transformedOrder.items || []),
        totalAmount: transformedOrder.totalAmount || 0,
        currency: transformedOrder.currency || 'EUR',
        serviceType: transformedOrder.serviceType || 'delivery',
        expectedTime: transformedOrder.expectedTime || '',
        orderSource: 'hubrise',
        createdAt: transformedOrder.createdAt || new Date().toISOString(),
        Timestamp: new Date().toISOString()
      };
      
      // Store order in Azure Table Storage
      try {
        await addOrderItem(
          env.STORAG_BASE_URL,
          'Orders',
          env.SAS_TOKEN,
          orderData,
          organizationId,
          orderData.RowKey
        );
        
        // TODO: Notify restaurant via WebSocket/Push notification
        // You can integrate with your existing FCM notification system here
        console.log(`Order ${order.id} stored successfully for ${organizationId}`);
      } catch (storageError) {
        console.error('Failed to store order in Azure:', storageError);
      }
    }
    
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook processing error:', error);
    
    return new Response('OK', { status: 200 });
  }
}

/**
 * Update order status in HubRise
 * POST /api/hubrise/update-order-status
 */
export async function updateHubRiseOrderStatus(request, env, decoded) {
  try {
    const organizationId = decoded.userClaims.MotelID;
    const { hubriseOrderId, status, expectedTime } = await request.json();
    
    if (!hubriseOrderId || !status) {
      return new Response(JSON.stringify({ 
        error: 'hubriseOrderId and status are required'
      }), {
        status: 400,
        headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
      });
    }
    
    // Get HubRise connection
    const connection = await env.DB.prepare(
      'SELECT * FROM hubrise_connections WHERE organization_id = ? AND is_active = 1'
    ).bind(organizationId).first();
    
    if (!connection) {
      return new Response(JSON.stringify({ 
        error: 'No active HubRise connection found'
      }), {
        status: 404,
        headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
      });
    }
    
    // Decrypt access token
    const accessToken = await decrypt(connection.access_token, env.ENCRYPTION_SECRET);
    
    // Update order in HubRise
    const updateData = { status };
    if (expectedTime) {
      updateData.expected_time = expectedTime;
    }
    
    await updateOrderStatus(accessToken, hubriseOrderId, updateData);
    
    // Note: Order status is updated in HubRise, Azure Table Storage update can be done separately if needed
    
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Order status updated successfully'
    }), {
      status: 200,
      headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to update order status',
      details: error.message 
    }), {
      status: 500,
      headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get HubRise orders from Azure Table Storage
 * GET /api/hubrise/orders
 */
export async function getHubRiseOrders(request, env, decoded) {
  try {
    const organizationId = decoded.userClaims.MotelID;
    const url = new URL(request.url);
    const branchCode = url.searchParams.get('branchCode') || organizationId;
    
    // Get today's orders from Azure Table Storage
    const orders = await readtodayOrders(
      env.STORAG_BASE_URL,
      'Orders',
      env.SAS_TOKEN,
      organizationId,
      branchCode
    );
    
    // Filter for HubRise orders only
    const hubriseOrders = orders.filter(order => order.orderSource === 'hubrise');
    
    return new Response(JSON.stringify({ 
      orders: hubriseOrders,
      count: hubriseOrders.length
    }), {
      status: 200,
      headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting orders:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to get orders',
      details: error.message 
    }), {
      status: 500,
      headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
    });
  }
}
