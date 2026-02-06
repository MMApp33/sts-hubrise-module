import { SignJWT } from 'jose'; // Install locally for dev, but not required on Workers

function str2ab(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\n/g, "").replace(/\\n/g, "");
  const binary = atob(b64);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
  return buffer.buffer;
}

export async function getAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);

  const key = await crypto.subtle.importKey(
    "pkcs8",
    str2ab(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const jwt = await new SignJWT({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  })
    .setProtectedHeader({ alg: "RS256" })
    .sign(key);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error("Token exchange failed: " + err);
  }

  const { access_token } = await res.json();
  return access_token;
}

export async function sendFcmNotification(fcmToken,messageType,projectid,accessToken,title,body,priority = "high",url ="https://scantoserve.com",restaurantLogo,restaurantName) {
  // Base message with data payload
  const message = {
    token: fcmToken,
    data: {
      type: messageType,
      title: title || "Notification",
      body: body || "You have a new notification",
      priority: priority
    }
  };
  if (url) message.data.url = url;
  if (restaurantLogo) message.data.restaurantLogo = restaurantLogo;
  if (restaurantName) message.data.restaurantName = restaurantName;
  // If messageType requires a visible notification, add the notification block
  if (messageType === "USER_NOTIFICATION") {
    message.notification = {
      title: title || "Notification",
      body: body || "You have a new notification"
    };

    // Optionally, you can add webpush or android headers here for priority
    message.webpush = {
      headers: {
        Urgency: priority === "high" ? "high" : "normal"
      }
    };
  }

  const payload = { message };

  // Timeout controller for fetch
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectid}/messages:send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const err = await res.text();
      console.error(`FCM push failed: ${err}`);
      return { success: false, error: err };
    }

    const data = await res.json();
    return { success: true, data };
  } catch (error) {
    clearTimeout(timeoutId);
    console.error(`FCM push error: ${error.message}`);
    return { success: false, error: error.message };
  }
}


export async function readFCMTokenFromTable(storageAccountUrl, tableName, sasToken, partitionKey, projectid, accessToken,orderTitle,OrderDescription,userfcmtoken,itemurl,restaurantLogo,restaurantName) {
  const encodedPartitionKey = encodeURIComponent(partitionKey);
  const url = `${storageAccountUrl}/${tableName}?${sasToken}&$filter=PartitionKey eq '${encodedPartitionKey}'`;
  try {
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
    
    if (data.value && data.value.length > 0) {
      const notificationPromises = [];
      
      for (const item of data.value) {
        if (item.fcmtoken && item.fcmtoken.trim() !== "") {
          // Store promises instead of awaiting each one
          notificationPromises.push(sendFcmNotification(item.fcmtoken, "REFRESH_SCREEN", projectid, accessToken,orderTitle, OrderDescription, "high",itemurl,restaurantLogo,restaurantName));
        }
      }

       if (userfcmtoken && userfcmtoken.trim() !== "" && userfcmtoken !== "NA") {
      notificationPromises.push(
        sendFcmNotification(
          userfcmtoken,
          "USER_NOTIFICATION",
          projectid,
          accessToken,
          orderTitle,
          OrderDescription,
          "high",
          itemurl,
          restaurantLogo,
          restaurantName
        )
      );
    }
      
      // Wait for all notifications to complete in parallel
      if (notificationPromises.length > 0) {
        const results = await Promise.allSettled(notificationPromises);
        //console.log(`Sent ${results.length} notifications, ${results.filter(r => r.status === 'fulfilled' && r.value.success).length} succeeded`);
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error("Error in readFCMTokenFromTable:", error);
    return { success: false, error: error.message };
  }
}


export async function readUserFCMTokenForOrder(storageAccountUrl, tableName, sasToken, partitionKey, rowKey) {
  const url = `${storageAccountUrl}/${tableName}(PartitionKey='${partitionKey}',RowKey='${rowKey}')?${sasToken}`;

  try {
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

    return {
      fcmToken: data.fcmToken || "NA",
      success: true
    };

  } catch (error) {
    console.error("Error in readUserFCMTokenForOrder:", error);
    return { success: false, error: error.message };
  }
}
