"use client";

import { useCallback, useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export default function usePushNotifications(userId) {
  const [permission, setPermission] = useState("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported =
      "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

    const timer = window.setTimeout(() => {
      setIsSupported(supported);
      if (!supported) return;
      setPermission(Notification.permission);

      if (Notification.permission === "granted") {
        navigator.serviceWorker.ready
          .then((reg) => reg.pushManager.getSubscription())
          .then((sub) => setIsSubscribed(!!sub))
          .catch(() => {});
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const subscribe = useCallback(async () => {
    if (!userId || !VAPID_PUBLIC_KEY) return false;
    if (!isSupported) return false;

    const result = await Notification.requestPermission();
    setPermission(result);
    if (result !== "granted") return false;

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), userId }),
      });

      setIsSubscribed(true);
      return true;
    } catch (err) {
      console.error("Push subscribe failed:", err);
      return false;
    }
  }, [isSupported, userId]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        if (userId) {
          await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint, userId }),
          });
        }
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error("Push unsubscribe failed:", err);
    }
  }, [isSupported, userId]);

  return { permission, isSubscribed, isSupported, subscribe, unsubscribe };
}
