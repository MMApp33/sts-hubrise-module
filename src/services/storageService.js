import { v4 as uuidv4 } from 'uuid';
import { getCorsHeaders } from "../utils/utils";
// Prepares an entity for Azure Table Storage, converting object properties to table entity format.
export function prepareTableEntity(updateData) {
  const entity = { ...updateData };

  if (Array.isArray(entity.ingredients)) {
    entity.ingredients = JSON.stringify(entity.ingredients);
  }
  if (Array.isArray(entity.contains_allergens)) {
    entity.contains_allergens = JSON.stringify(entity.contains_allergens);
  }
  if (typeof entity.nutrition_facts === 'object') {
    entity.nutrition_facts = JSON.stringify(entity.nutrition_facts);
  }
  if (typeof entity.sustainability_info === 'object') {
    entity.sustainability_info = JSON.stringify(entity.sustainability_info);
  }
  if (typeof entity.availability === 'object') {
    entity.availability = JSON.stringify(entity.availability);
  }
  if (typeof entity.customizations === 'object') {
    entity.customizations = JSON.stringify(entity.customizations);
  }
  if (Array.isArray(entity.modifiers)) {
    entity.modifiers = JSON.stringify(entity.modifiers);
  }

  // Optionally delete Timestamp (Table Storage doesn't like updating it)
  delete entity.Timestamp;

  return entity;
}

// Fetches data from an Azure Table by PartitionKey.
export async function getTableDataByPartitionKey(partitionKey, accountName, tableName, sasToken) {
  const url = `${accountName}/${tableName}${sasToken}&$filter=PartitionKey eq '${partitionKey}'`;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json;odata=nometadata' }
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error fetching table data: ${response.status} ${response.statusText}`, errorText);
      return new Response(JSON.stringify({ error: 'Failed to fetch data', details: errorText }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    const data = await response.json();
    return new Response(JSON.stringify({ data: data.value }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Exception in getTableDataByPartitionKey:', error);
    return new Response(JSON.stringify({ error: 'Server error while fetching data', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Creates a new table in Azure Table Storage if it doesn't exist.
export async function createTable(accountName, tableName, sasToken, businessType, motelID, request) {
  const url = `${accountName}/Tables?${sasToken}`;

  const body = JSON.stringify({
    TableName: tableName
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Accept": "application/json;odata=nometadata",
        "Content-Type": "application/json",
        "Prefer": "return-no-content" // Optional: No response content if success
      },
      body: body
    });

    if (response.status === 204) {
      if (tableName.toLowerCase().includes("menu")) {
        await uploadMenuItems(accountName, tableName, sasToken, businessType, motelID, request);
      }
    } else if (response.status === 409) {
    } else {
      const errorText = await response.text();
      console.error(`Failed to create table: ${response.status}`, errorText);
    }
  } catch (err) {
    console.error("Error:", err);
  }
}
// Reads top items from a specified table, optionally filtered by PartitionKey.
export async function readTopItemsFromTable(storageAccountUrl, tableName, sasToken, partitionKey) {
  const encodedPartitionKey = encodeURIComponent(partitionKey);
  const url = `${storageAccountUrl}/${tableName}?${sasToken}&$filter=PartitionKey eq '${encodedPartitionKey}'`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json;odata=nometadata"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to read table: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  const parsedItems = data.value.map(item => {
    return {
      ...item,
      ingredients: item.ingredients ? JSON.parse(item.ingredients) : [],
      contains_allergens: item.contains_allergens ? JSON.parse(item.contains_allergens) : [],
      nutrition_facts: item.nutrition_facts ? JSON.parse(item.nutrition_facts) : null,
      sustainability_info: item.sustainability_info ? JSON.parse(item.sustainability_info) : null,
      availability: item.availability ? JSON.parse(item.availability) : null,
      customizations: item.customizations ? JSON.parse(item.customizations) : null,
      modifiers: item.modifiers ? JSON.parse(item.modifiers) : []
    };
  });

  return parsedItems;
}


// Adds a menu item to the specified table.
export async function addMenuItem(storageAccount, tableName, sasToken, request, motelid) {
  const url = `${storageAccount}/${tableName}?${sasToken}`;

  const headers = {
    "Accept": "application/json;odata=nometadata",
    "Content-Type": "application/json",
    "Prefer": "return-no-content"
  };

  // Prepare the body
  const rawBody = await request.json();  // from incoming request
  const preparedBody = prepareTableEntity(rawBody);
  preparedBody.PartitionKey = rawBody.PartitionKey || motelid;
  const body = JSON.stringify(preparedBody);

  const requestOptions = {
    method: "POST", // INSERT uses POST
    headers: headers,
    body: body
  };

  try {
    const response = await fetch(url, requestOptions);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to insert item: ${errorText}`);
    }
    return response;
  } catch (error) {
    console.error("Error inserting item:", error.message);
  }
}

// Updates an existing menu item in the specified table.
export async function updateMenuItem(accountName, partitionKey, rowKey, rawBody, tableName, sasToken, request) {
  const url = `${accountName}/${tableName}(PartitionKey='${partitionKey}',RowKey='${rowKey}')?${sasToken}`;

  const headers = new Headers({
    "Accept": "application/json;odata=nometadata",
    "Content-Type": "application/json",
    "x-ms-date": new Date().toUTCString(),
    "If-Match": "*" // Allows updates without checking ETag
  });
  try {
    const preparedBody = prepareTableEntity(rawBody);  // ✨ flatten complex fields
    const body = JSON.stringify(preparedBody);
    const requestOptions = {
      method: "PATCH",
      headers: headers,
      body: body
    };
    const response = await fetch(url, requestOptions);
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    return response;
  }
  catch (error) {
    console.error('Error updating menu item:', error);
    return new Response(JSON.stringify({ error: 'Server error while updating menu item', details: error.message }), {
      status: 500, headers: getCorsHeaders(request)
    });
  }
}

// Deletes a menu item from the specified table.
export async function deleteMenuItem(storageAccount, tableName, sasToken, partitionKey, rowKey) {
  // Encode PartitionKey and RowKey to handle special characters
  const encodedPartitionKey = encodeURIComponent(`PartitionKey='${partitionKey}'`);
  const encodedRowKey = encodeURIComponent(`RowKey='${rowKey}'`);

  const url = `${storageAccount}/${tableName}(${encodedPartitionKey},${encodedRowKey})?${sasToken}`;

  const headers = {
    "Accept": "application/json;odata=nometadata",
    "Content-Type": "application/json",
    "If-Match": "*" // Needed to allow deletion without checking ETag
  };

  const requestOptions = {
    method: "DELETE",
    headers: headers
  };

  try {
    const response = await fetch(url, requestOptions);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to delete item: ${errorText}`);
    }
    return response;
  } catch (error) {
    console.error("Error deleting item:", error.message);
  }
}


// Adds organization details to the OrgDetails table.
export async function addOrgDetails(accountName, sasToken, motelID, businessType, request, tablevalue) {
  try {
    //await createTable(accountName, motelID+'Menu', sasToken,businessType,motelID,request);
    //await uploadMenuItems(accountName, 'Menu', sasToken, businessType, motelID, request);
    await addOrgItem(accountName, 'Org', sasToken, tablevalue, request);
    return new Response(JSON.stringify({ message: "Business Registration Success." }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  }
  catch (error) {
    console.error('Exception in addOrgDetails:', error);
    return new Response(JSON.stringify({ error: 'Server error during organization setup', details: error.message }), {
      status: 500,
      headers: getCorsHeaders(request)
    });
  }
}



export async function updateOrgDetails(accountName, request, tableName, sasToken) {
  const updateData = await request.json();
  const partitionKey = updateData.PartitionKey;
  const rowKey = updateData.RowKey;

  const url = `${accountName}/${tableName}(PartitionKey='${partitionKey}',RowKey='${rowKey}')?${sasToken}`;

  const headers = new Headers({
    "Accept": "application/json;odata=nometadata",
    "Content-Type": "application/json",
    "x-ms-date": new Date().toUTCString(),
    "If-Match": "*" // Allows updates without checking ETag
  });
  try {
    const body = JSON.stringify(updateData);
    const requestOptions = {
      method: "PATCH",
      headers: headers,
      body: body
    };
    const response = await fetch(url, requestOptions);
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    return response;
  }
  catch (error) {
    console.error('Error updating org item:', error);
    return new Response(JSON.stringify({ error: 'Server error while updating org  item', details: error.message }), {
      status: 500, headers: getCorsHeaders(request)
    });
  }
}

export async function readOrgItemsFromTable(storageAccountUrl, tableName, sasToken, partitionKey) {
  const encodedPartitionKey = encodeURIComponent(partitionKey);
  const url = `${storageAccountUrl}/${tableName}?${sasToken}&$filter=PartitionKey eq '${encodedPartitionKey}'`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json;odata=nometadata"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to read table: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  const parsedItems = data.value.map(item => {
    return {
      ...item,
    };
  });
  return parsedItems;
}

// Uploads predefined menu items based on business type.
async function uploadMenuItems(accountName, tableName, sasToken, businessType, motelID, request) {

  const storageUrl = `${accountName}/${tableName}?${sasToken}`;

  try {
    // Step 1: Fetch the menu JSON
    const menuResponse = await fetch(`https://assets.scantoserve.com/menu/Default.json`);
    const menuData = await menuResponse.json();

    if (!menuData.menu || !Array.isArray(menuData.menu)) {
      console.error("Invalid menu format");
      return;
    }

    // Step 2: Loop through menu items
    for (const item of menuData.menu) {
      const entity = {
        PartitionKey: motelID,
        RowKey: uuidv4(), // Use ID as fallback RowKey
        // Simple flat properties
        restaurant: menuData.restaurant,
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        currency: item.currency,
        size: item.size,
        category: item.category,
        menue_logo: item.menue_logo,
        is_vegetarian: item.is_vegetarian,
        is_vegan: item.is_vegan,
        is_gluten_free: item.is_gluten_free,
        is_dairy_free: item.is_dairy_free,
        is_nut_free: item.is_nut_free,
        seasonal_offer: item.seasonal_offer,
        rating: item.rating,
        reviews_count: item.reviews_count,
        calories: item.calories,
        serving_size: item.serving_size,
        total_serving_size: item.total_serving_size,

        // Complex properties: stringify them
        ingredients: JSON.stringify(item.ingredients || []),
        contains_allergens: JSON.stringify(item.contains_allergens || []),
        nutrition_facts: JSON.stringify(item.nutrition_facts || {}),
        sustainability_info: JSON.stringify(item.sustainability_info || {}),
        availability: JSON.stringify(item.availability || {}),
        customizations: JSON.stringify(item.customizations || []),
        modifiers: JSON.stringify(item.modifiers || [])
      };

      // Step 3: Send POST request for each item
      const response = await fetch(storageUrl, {
        method: "POST",
        headers: {
          "Accept": "application/json;odata=nometadata",
          "Content-Type": "application/json",
          "Prefer": "return-no-content"
        },
        body: JSON.stringify(entity)
      });

      if (response.status === 204) {
        console.log(`✅ Inserted: ${item.name}`);
      } else if (response.status === 409) {
        console.warn(`⚠️ Already exists: ${item.name}`);
      } else {
        const errorText = await response.text();
        console.error(`❌ Error inserting ${item.name}:`, response.status, errorText);
      }
    }
  } catch (error) {
    console.error("❌ Upload failed:", error);
    return new Response(JSON.stringify({ error: 'Failed to upload menu items', details: error.message }), {
      status: 500,
      headers: getCorsHeaders(request)
    });
  }
}

// Reads top order items from a specified table.
export async function readTopOrderItemsFromTable(storageAccountUrl, tableName, sasToken, request) {
  const url = `${storageAccountUrl}/${tableName}${sasToken}&$top=100`; // Example: Fetch top 100 orders
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json;odata=nometadata' }
    });
    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: 'Failed to read order items', details: errorText }), {
        status: response.status,
        headers: getCorsHeaders(request)
      });
    }
    const data = await response.json();
    return new Response(JSON.stringify(data.value), {
      status: 200,
      headers: getCorsHeaders(request)
    });
  } catch (error) {
    console.error('Error reading order items from table:', error);
    return new Response(JSON.stringify({ error: 'Server error reading order items', details: error.message }), {
      status: 500,
      headers: getCorsHeaders(request)
    });
  }
}

// Prepares an order entity for storage, flattening complex fields.
export function prepareOrderEntity(order) {
  const entity = { ...order }; // Shallow copy
  entity.PartitionKey = order.tableId || 'DefaultPartition'; // Use tableId or a default
  entity.RowKey = new Date().toISOString() + Math.random().toString(36).substr(2, 9); // Generate unique RowKey
  entity.created_at = new Date().toISOString();

  // Flatten items array into a JSON string to store in a single field
  if (order.items && Array.isArray(order.items)) {
    entity.itemsJson = JSON.stringify(order.items.map(item => ({
      itemId: item.itemId,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      specialInstructions: item.specialInstructions || ''
    })));
  }
  delete entity.items; // Remove original items array

  // Flatten customerDetails object
  if (order.customerDetails) {
    Object.keys(order.customerDetails).forEach(key => {
      entity[`customer_${key}`] = order.customerDetails[key];
    });
  }
  delete entity.customerDetails;

  return prepareTableEntity(entity); // Use the generic preparer for other types
}

// Adds an order item to the specified table.
export async function addOrderItem(storageAccount, tableName, sasToken, rawBody, motelID, rowKey) {
  const url = `${storageAccount}/${tableName}?${sasToken}`;

  const headers = {
    "Accept": "application/json;odata=nometadata",
    "Content-Type": "application/json",
    "Prefer": "return-no-content"
  };

  // Prepare the body
  // const rawBody = await request.json();  // from incoming request
  const preparedBody = prepareorderTableEntity(rawBody, motelID, rowKey);  // ✨ flatten complex fields
  const body = JSON.stringify(preparedBody);

  const requestOptions = {
    method: "POST", // INSERT uses POST
    headers: headers,
    body: body
  };

  try {
    const response = await fetch(url, requestOptions);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to insert item: ${errorText}`);
    }
    return response;
  } catch (error) {
    console.error("Error inserting item:", error.message);
  }
}

// Adds screen FCM  to the specified table.
export async function addScreeneItem(storageAccount, tableName, sasToken, request, motelID, userID) {
  const url = `${storageAccount}/${tableName}?${sasToken}`;

  const headers = {
    "Accept": "application/json;odata=nometadata",
    "Content-Type": "application/json",
    "Prefer": "return-no-content"
  };

  // Prepare the body
  const rawBody = await request.json();  // from incoming request
  const preparedBody = prepareFCMTableEntity(rawBody, motelID, userID);  // ✨ flatten complex fields
  const body = JSON.stringify(preparedBody);

  const requestOptions = {
    method: "POST", // INSERT uses POST
    headers: headers,
    body: body
  };

  try {
    const response = await fetch(url, requestOptions);
    if (response.ok) {
      return response;
    }
    if (!response.ok) {
      const fallbackResponse = await updateScreenItem(storageAccount, preparedBody.PartitionKey, preparedBody.RowKey, preparedBody, tableName, sasToken, request);
      return fallbackResponse;
    }

  } catch (error) {
    console.error("Error inserting item:", error.message);
  }
}

// Updates creen FCM item in the specified table.
async function updateScreenItem(accountName, partitionKey, rowKey, rawBody, tableName, sasToken, request) {
  const url = `${accountName}/${tableName}(PartitionKey='${partitionKey}',RowKey='${rowKey}')?${sasToken}`;

  const headers = new Headers({
    "Accept": "application/json;odata=nometadata",
    "Content-Type": "application/json",
    "x-ms-date": new Date().toUTCString(),
    "If-Match": "*" // Allows updates without checking ETag
  });
  try {
    const body = JSON.stringify(rawBody);
    const requestOptions = {
      method: "PATCH",
      headers: headers,
      body: body
    };
    const response = await fetch(url, requestOptions);
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    return response;
  }
  catch (error) {
    console.error('Error updating menu item:', error);
    return new Response(JSON.stringify({ error: 'Server error while updating menu item', details: error.message }), {
      status: 500, headers: getCorsHeaders(request)
    });
  }
}

// Updates an order item in the specified table.
export async function updateOrderItem(accountName, partitionKey, rowKey, rawBody, tableName, sasToken, request) {
  const url = `${accountName}/${tableName}(PartitionKey='${partitionKey}',RowKey='${rowKey}')?${sasToken}`;

  const headers = new Headers({
    "Accept": "application/json;odata=nometadata",
    "Content-Type": "application/json",
    "x-ms-date": new Date().toUTCString(),
    "If-Match": "*" // Allows updates without checking ETag
  });
  try {
    const preparedBody = prepareUpdateorderTableEntity(rawBody);  // ✨ flatten complex fields
    const body = JSON.stringify(preparedBody);
    const requestOptions = {
      method: "PATCH",
      headers: headers,
      body: body
    };
    const response = await fetch(url, requestOptions);
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    return response;
  }
  catch (error) {
    console.error('Error updating menu item:', error);
    return new Response(JSON.stringify({ error: 'Server error while updating menu item', details: error.message }), {
      status: 500, headers: getCorsHeaders(request)
    });
  }
}

// Reads today Orders.
export async function readtodayOrders(storageAccountUrl, tableName, sasToken, partitionKey, branchCode) {
  const encodedPartitionKey = encodeURIComponent(partitionKey);

  const today = new Date();
  const yyyy = today.getUTCFullYear();
  const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(today.getUTCDate()).padStart(2, '0');

  const startOfDay = `${yyyy}-${mm}-${dd}T00:00:00Z`;
  const endOfDay = `${yyyy}-${mm}-${dd}T23:59:59Z`;

  // Build the filter without datetime''
  const filter = `$filter=PartitionKey eq '${encodedPartitionKey}' and orderCreatedAt ge '${startOfDay}' and orderCreatedAt le '${endOfDay}'`;

  const url = `${storageAccountUrl}/${tableName}?${sasToken}&${filter}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json;odata=nometadata"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to read table: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (branchCode !== "default") 
  {
    const parsedItems = data.value
      .map(({ fcmToken, ...item }) => ({
        ...item,
        orderItems: item.orderItems ? JSON.parse(item.orderItems) : [],
        customizations: item.customizations ? JSON.parse(item.customizations) : [],
      }))
      .filter(item => item.branchCode === branchCode);
    return parsedItems;
  } 
  else 
  {
    const parsedItems = data.value.map(({ fcmToken, ...item }) => { return { ...item, orderItems: item.orderItems ? JSON.parse(item.orderItems) : [], customizations: item.customizations ? JSON.parse(item.customizations) : [], }; });
    return parsedItems;
  }
}

// Reads today Orders.
export async function read30daysOrdersLimited(
  storageAccountUrl,
  tableName,
  sasToken,
  partitionKey,
  maxRecords = 5000 // default limit
) {
  const encodedPartitionKey = encodeURIComponent(partitionKey);
  const today = new Date();
  const startDateObj = new Date(today);
  startDateObj.setDate(startDateObj.getDate() - 29);
  const startDate = startDateObj.toISOString().split('T')[0] + 'T00:00:00Z';
  const endDate = today.toISOString().split('T')[0] + 'T23:59:59Z';

  let url = `${storageAccountUrl}/${tableName}?${sasToken}&$filter=PartitionKey eq '${encodedPartitionKey}' and orderCreatedAt ge '${startDate}' and orderCreatedAt le '${endDate}'`;
  let allItems = [];

  while (url && allItems.length < maxRecords) {
    const response = await fetch(url, {
      headers: { "Accept": "application/json;odata=nometadata" }
    });
    if (!response.ok) throw new Error(`Failed: ${response.status} ${response.statusText}`);

    const data = await response.json();
    const parsedItems = data.value.map(({ fcmToken, ...item }) => ({
      ...item,
      orderItems: item.orderItems ? JSON.parse(item.orderItems) : []
    }));

    // Add only up to maxRecords
    const spaceLeft = maxRecords - allItems.length;
    allItems.push(...parsedItems.slice(0, spaceLeft));

    // Stop if we've reached maxRecords
    if (allItems.length >= maxRecords) break;

    // Get next page if exists
    url = data['@odata.nextLink'] ? data['@odata.nextLink'] : null;
  }

  return allItems;
}


function prepareFCMTableEntity(rawBody, partitionKey, userID) {
  return {
    PartitionKey: partitionKey,
    RowKey: userID,
    screenType: rawBody.screenType,
    fcmtoken: rawBody.fcmtoken,
    userAgent: rawBody.userAgent,
    platform: rawBody.platform,
  };
}

function prepareUpdateorderTableEntity(rawBody, partitionKey) {
  const now = new Date().toISOString();
  const rowKey = `${partitionKey}_${now}`;

  return {
    PartitionKey: partitionKey,
    RowKey: rowKey,
    orderId: rawBody.orderId,
    orderItems: JSON.stringify(rawBody.orderItems),
    totalAmount: rawBody.totalAmount,
    orderStatus: rawBody.orderStatus,
    specialInstructions: rawBody.specialInstructions,
    paymentStatus: rawBody.paymentStatus,
    paymentMethod: rawBody.paymentMethod,
    orderUpdatedAt: rawBody.orderUpdatedAt,
    orderConfirmedAt: rawBody.orderConfirmedAt,
    estimatedPreparationTime: rawBody.estimatedPreparationTime,
    orderCompletedAt: rawBody.orderCompletedAt,
    paymentCompletedAt: rawBody.paymentCompletedAt,
    tableID: rawBody.tableID,
    reason: rawBody.reason,
  };
}

function prepareorderTableEntity(rawBody, partitionKey, rowKey) {

  const now = new Date().toISOString();
  return {
    PartitionKey: partitionKey,
    RowKey: rowKey,
    orderId: rawBody.orderId || "",
    orderCreatedAt: rawBody.orderCreatedAt || now,
    orderItems: JSON.stringify(rawBody.orderItems || []),
    totalAmount: rawBody.totalAmount != null ? rawBody.totalAmount.toString() : "0.00",
    orderStatus: rawBody.orderStatus || "placed",
    specialInstructions: rawBody.specialInstructions || "",
    paymentStatus: rawBody.paymentStatus || "pending",
    paymentMethod: rawBody.paymentMethod || "Cash",
    orderUpdatedAt: rawBody.orderUpdatedAt || now,
    orderConfirmedAt: rawBody.orderConfirmedAt || "NA",
    estimatedPreparationTime: rawBody.estimatedPreparationTime || "NA",
    orderCompletedAt: rawBody.orderCompletedAt || "NA",
    paymentCompletedAt: rawBody.paymentCompletedAt || "NA",
    tableID: rawBody.tableID || "",
    fcmToken: rawBody.fcmToken || "NA",
    orderType: rawBody.orderType || "Dine-in",
    customizations: JSON.stringify(rawBody.customizations || []),
    discount: rawBody.discount || "",
    revpoints: rawBody.revpoints || "",
    claimedPoints: rawBody.claimedPoints || 0,
    rewardPointsDiscount: rawBody.rewardPointsDiscount || 0,
    ClaimRewardRatio: rawBody.ClaimRewardRatio || 0,
    deliveryInfo: rawBody.deliveryInfo || "NA",
    deliveryCharge: rawBody.deliveryCharge || "NA",
    branchCode: rawBody.branchCode || "default",
    platformFee:rawBody.platformFee || 0,
    vatAmount:rawBody.vatAmount || 0
  };
}
// Prepares an assistance request entity for storage.
export function prepareAssistanceEntity(tableID, requestType = 'assistance') {
  return {
    PartitionKey: tableID, // Using tableID as PartitionKey
    RowKey: new Date().toISOString() + Math.random().toString(36).substr(2, 9), // Unique RowKey
    requestTime: new Date().toISOString(),
    status: 'Pending',
    requestType: requestType // e.g., 'assistance', 'water', 'bill'
  };
}

// Adds an assistance request item to the specified table.
export async function addAssistanceItem(storageAccount, tableName, sasToken, tableNo, requestType, request) {
  const entity = prepareAssistanceEntity(tableNo, requestType);
  const url = `${storageAccount}/${tableName}${sasToken}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entity)
    });
    if (response.status === 201 || response.status === 204) {
      return new Response(JSON.stringify({ message: 'Assistance request submitted successfully', assistanceId: entity.RowKey }), {
        status: 201,
        headers: getCorsHeaders(request)
      });
    } else {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: 'Failed to submit assistance request', details: errorText }), {
        status: response.status,
        headers: getCorsHeaders(request)
      });
    }
  } catch (error) {
    console.error('Error adding assistance item:', error);
    return new Response(JSON.stringify({ error: 'Server error while submitting assistance request', details: error.message }), {
      status: 500,
      headers: getCorsHeaders(request)
    });
  }
}

// Adds feedback to the specified table.
export async function addFeedback(storageAccount, tableName, sasToken, rawbody, request) {
  const url = `${storageAccount}/${tableName}?${sasToken}`;

  const headers = {
    "Accept": "application/json;odata=nometadata",
    "Content-Type": "application/json",
    "Prefer": "return-no-content"
  };

  // Prepare the body from incoming request (which contains the order data)
  //const rawBody = await request.json();  // Parse the incoming request body
  const body = JSON.stringify(rawbody);

  const requestOptions = {
    method: "POST", // Use POST to insert the order item
    headers: headers,
    body: body
  };

  try {
    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      const errorText = await response.text();
      // Return a structured error response
      return new Response(JSON.stringify({ error: 'Failed to submit feedback', details: errorText }), {
        status: 500,
        headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
      });
    }

    // Return success response including orderId
    return new Response(JSON.stringify({ Success: 'Feedback Submitted sucessfully' }), {
      status: 200,
      headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
    });
  } catch (error) {
    // Return a structured error on fetch/connection issues
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
    });
  }
}


// Reads feedback items from a table, optionally filtered by PartitionKey.
export async function readFeedbackItemsFromTable(storageAccountUrl, tableName, sasToken, partitionKey, request) {
  //const url = `${storageAccountUrl}/${tableName}?$filter=&top=${count}&${sasToken}`;
  const encodedPartitionKey = encodeURIComponent(partitionKey);
  const url = `${storageAccountUrl}/${tableName}?${sasToken}&$filter=PartitionKey eq '${encodedPartitionKey}'`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json;odata=nometadata"
    }
  });

  if (!response.ok) {
    return new Response(JSON.stringify({ error: 'reading feedback items' }), {
      status: response.status,
      headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
    });
  }

  const data = await response.json();

  // Loop through each item and parse the JSON fields
  const parsedItems = data.value.map(item => {
    return {
      ...item
    };
  });
  return new Response(JSON.stringify(parsedItems, null, 2), {
    status: 200,
    headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' }
  });
}

// Reads alert items from a table, typically filtered by a specific PartitionKey for alerts.
export async function readAlertItemsFromTable(storageAccountUrl, tableName, sasToken, partitionKey, request) {
  //const url = `${storageAccountUrl}/${tableName}?$filter=&top=${count}&${sasToken}`;
  const encodedPartitionKey = encodeURIComponent(partitionKey);
  const url = `${storageAccountUrl}/${tableName}?${sasToken}&$filter=PartitionKey eq '${encodedPartitionKey}'`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json;odata=nometadata"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to read table: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Loop through each item and parse the JSON fields
  const parsedItems = data.value.map(item => {
    return {
      ...item
    };
  });
  return parsedItems;
}

// Fetches report data by aggregating or processing data from a table.
export async function getThirtyDaysReportdata(storageAccount, tableName, sasToken, request, motelID, maxRecords = 3000) {
  const encodedPartitionKey = encodeURIComponent(motelID);
  let url = `${storageAccount}/${tableName}?${sasToken}&$filter=PartitionKey eq '${encodedPartitionKey}'`;
  let allItems = [];

  try {
    while (url && allItems.length < maxRecords) {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json;odata=nometadata' }
      });

      if (!response.ok) {
        const errorText = await response.text();
        return new Response(JSON.stringify({ error: 'Failed to get report data', details: errorText }), {
          status: response.status,
          headers: getCorsHeaders(request)
        });
      }

      const data = await response.json();
      const parsedItems = data.value.map(({ fcmToken, ...item }) => ({
        ...item,
        orderItems: item.orderItems ? JSON.parse(item.orderItems) : []
      }));

      // Add only up to maxRecords
      const spaceLeft = maxRecords - allItems.length;
      allItems.push(...parsedItems.slice(0, spaceLeft));

      if (allItems.length >= maxRecords) break;

      // Follow next page link if present
      url = data['@odata.nextLink'] ? data['@odata.nextLink'] : null;
    }

    return { value: allItems };
  } catch (error) {
    console.error('Error in getreportdata:', error);
    return new Response(JSON.stringify({ error: 'Server error generating report data', details: error.message }), {
      status: 500,
      headers: getCorsHeaders(request)
    });
  }
}


// Adds an order item to the specified table.
export async function addOrgItem(storageAccount, tableName, sasToken, jsondata, request) {

  const url = `${storageAccount}/${tableName}?${sasToken}`;

  const headers = {
    "Accept": "application/json;odata=nometadata",
    "Content-Type": "application/json",
    "Prefer": "return-no-content"
  };

  const requestOptions = {
    method: "POST", // INSERT uses POST
    headers: headers,
    body: jsondata
  };

  try {
    const response = await fetch(url, requestOptions);
    if (!response.ok) {
      const errorText = await response.text();
      //throw new Error(`Failed to insert item: ${errorText}`);
    }
    return response;
  } catch (error) {
    console.error("Error inserting item:", error.message);
  }
}
