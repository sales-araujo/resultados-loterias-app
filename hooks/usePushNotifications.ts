"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type PushPermission = "granted" | "denied" | "default" | "unsupported";

export function usePushNotifications() {
  const [permission, setPermission] = useState<PushPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as PushPermission);

    navigator.serviceWorker.ready.then(async (registration) => {
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    });
  }, []);

  const subscribe = useCallback(
    async (tipoJogo: string[]) => {
      if (permission === "unsupported") {
        toast.error("Seu navegador não suporta notificações push.");
        return false;
      }

      setIsLoading(true);

      try {
        const perm = await Notification.requestPermission();
        setPermission(perm as PushPermission);

        if (perm !== "granted") {
          toast.error("Permissão de notificação negada.");
          setIsLoading(false);
          return false;
        }

        // Register the push service worker
        const swRegistration = await navigator.serviceWorker.register(
          "/sw-push.js",
          { scope: "/" }
        );
        await navigator.serviceWorker.ready;

        const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        const subscription = await swRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
        });

        const response = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscription: subscription.toJSON(),
            tipoJogo,
          }),
        });

        if (!response.ok) {
          throw new Error("Falha ao salvar subscription no servidor");
        }

        setIsSubscribed(true);
        toast.success("Notificações ativadas! Você será avisado quando sair o resultado.");
        return true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Erro desconhecido";
        console.error("[Push Subscribe Error]", msg);
        toast.error(`Erro ao ativar notificações: ${msg}`);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [permission]
  );

  const unsubscribe = useCallback(async () => {
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      toast.success("Notificações desativadas.");
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      console.error("[Push Unsubscribe Error]", msg);
      toast.error(`Erro ao desativar notificações: ${msg}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateGames = useCallback(
    async (tipoJogo: string[]) => {
      if (!isSubscribed) return;

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          await fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              subscription: subscription.toJSON(),
              tipoJogo,
            }),
          });
        }
      } catch (err: unknown) {
        console.error("[Push UpdateGames Error]", err);
      }
    },
    [isSubscribed]
  );

  return {
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    updateGames,
  };
}
