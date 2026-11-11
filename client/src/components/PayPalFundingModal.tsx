import { useState, useEffect, useRef } from "react";
import { ModalDialog } from "./ModalDialog";
import { apiRequest } from "../api/client";
import type { IBounty } from "../types/bounty";

interface PayPalFundingModalProps {
  bounty: IBounty;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedBounty: IBounty) => void;
}

declare global {
  interface Window {
    paypal?: any;
  }
}

export function PayPalFundingModal({
  bounty,
  isOpen,
  onClose,
  onSuccess,
}: PayPalFundingModalProps) {
  const [loadingSdk, setLoadingSdk] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const paypalButtonContainerRef = useRef<HTMLDivElement>(null);
  const buttonsRenderedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      buttonsRenderedRef.current = false;
      setError(null);
      setInfoMsg(null);
      return;
    }

    let isMounted = true;

    async function loadPayPalSdk() {
      try {
        setLoadingSdk(true);
        setSdkError(null);

        // Fetch public PayPal client configuration from server
        const config = await apiRequest<{
          clientId: string;
          environment: string;
          currency: string;
        }>("/bounties/paypal/config");

        if (!isMounted) return;

        const clientId = config.clientId || "sb";

        // Check if script is already present
        const existingScript = document.getElementById("paypal-sdk-script");
        if (existingScript && window.paypal) {
          setLoadingSdk(false);
          renderPayPalButtons();
          return;
        }

        if (existingScript && !window.paypal) {
          existingScript.remove();
        }

        const script = document.createElement("script");
        script.id = "paypal-sdk-script";
        script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
          clientId,
        )}&currency=USD&intent=capture&components=buttons`;
        script.async = true;

        script.onload = () => {
          if (!isMounted) return;
          setLoadingSdk(false);
          renderPayPalButtons();
        };

        script.onerror = () => {
          if (!isMounted) return;
          setLoadingSdk(false);
          setSdkError(
            "Failed to load PayPal JavaScript SDK. Please check your network connection.",
          );
        };

        document.body.appendChild(script);
      } catch (err: any) {
        if (!isMounted) return;
        setLoadingSdk(false);
        setSdkError(err.message || "Failed to initialize PayPal configuration.");
      }
    }

    function renderPayPalButtons() {
      if (!window.paypal || !paypalButtonContainerRef.current) return;
      if (buttonsRenderedRef.current) return;

      try {
        paypalButtonContainerRef.current.innerHTML = "";
        buttonsRenderedRef.current = true;

        window.paypal
          .Buttons({
            style: {
              layout: "vertical",
              color: "gold",
              shape: "rect",
              label: "paypal",
              height: 44,
            },
            createOrder: async () => {
              setError(null);
              setInfoMsg(null);
              const res = await apiRequest<{ orderId: string }>(
                `/bounties/${bounty._id}/create-paypal-order`,
                {
                  method: "POST",
                },
              );
              return res.orderId;
            },
            onApprove: async (data: { orderID: string }) => {
              setCapturing(true);
              setError(null);
              setInfoMsg(null);
              try {
                const res = await apiRequest<{
                  bounty: IBounty;
                  message: string;
                  captureId: string;
                }>(`/bounties/${bounty._id}/capture-paypal-order`, {
                  method: "POST",
                  body: JSON.stringify({ orderId: data.orderID }),
                });
                onSuccess(res.bounty);
                onClose();
              } catch (err: any) {
                setError(
                  err.message || "PayPal order capture failed on server.",
                );
              } finally {
                setCapturing(false);
              }
            },
            onCancel: () => {
              setInfoMsg(
                "PayPal checkout was cancelled. No funds were captured.",
              );
            },
            onError: (err: any) => {
              console.error("[PayPal Checkout Error]", err);
              setError(
                err?.message || "An unexpected PayPal checkout error occurred.",
              );
            },
          })
          .render(paypalButtonContainerRef.current)
          .catch((renderErr: any) => {
            console.warn(
              "[PayPal Buttons render warning]:",
              renderErr?.message,
            );
            buttonsRenderedRef.current = false;
          });
      } catch (err: any) {
        console.error("[PayPal Buttons init error]:", err);
        buttonsRenderedRef.current = false;
      }
    }

    loadPayPalSdk();

    return () => {
      isMounted = false;
    };
  }, [isOpen, bounty._id]);

  const formattedReward = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(bounty.rewardAmount);

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={capturing ? () => {} : onClose}
      title="Fund Bounty via PayPal Escrow"
      subtitle={
        <span className="status-badge badge-progress" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "var(--amber)" }} />
          PayPal Sandbox Mode
        </span>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)", marginTop: "var(--space-sm)" }}>
        {/* Sandbox Notice Banner */}
        <div
          style={{
            padding: "var(--space-xs) var(--space-sm)",
            backgroundColor: "rgba(217, 119, 6, 0.12)",
            border: "1px solid rgba(217, 119, 6, 0.3)",
            borderRadius: "var(--radius-sm)",
            fontSize: "var(--text-xs)",
            color: "var(--color-ink)",
            lineHeight: 1.4,
          }}
        >
          <strong>PayPal Sandbox Environment:</strong> Simulated transaction backed by PayPal REST API escrow verification. No real financial debit occurs.
        </div>

        {/* Deposit Summary Card */}
        <div
          style={{
            backgroundColor: "var(--color-paper-2)",
            border: "var(--rule-hair) solid var(--color-rule-2)",
            borderRadius: "var(--radius-sm)",
            padding: "var(--space-sm)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-muted)" }}>
              Escrow Funding Amount
            </div>
            <div style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--color-ink)", fontFamily: "var(--font-outlier)" }}>
              {formattedReward} USD
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-muted)" }}>
              Current Status
            </div>
            <span className="status-badge badge-cancelled" style={{ marginTop: "2px" }}>
              Unfunded
            </span>
          </div>
        </div>

        {/* Error / Info Alerts */}
        {error && (
          <div
            style={{
              padding: "var(--space-xs) var(--space-sm)",
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              borderRadius: "var(--radius-sm)",
              fontSize: "var(--text-xs)",
              color: "#FCA5A5",
            }}
          >
            {error}
          </div>
        )}

        {infoMsg && (
          <div
            style={{
              padding: "var(--space-xs) var(--space-sm)",
              backgroundColor: "rgba(59, 130, 246, 0.15)",
              border: "1px solid rgba(59, 130, 246, 0.4)",
              borderRadius: "var(--radius-sm)",
              fontSize: "var(--text-xs)",
              color: "#93C5FD",
            }}
          >
            {infoMsg}
          </div>
        )}

        {/* Loading States */}
        {loadingSdk && (
          <div style={{ textAlign: "center", padding: "var(--space-md)", color: "var(--color-muted)", fontSize: "var(--text-xs)" }}>
            Initializing PayPal Sandbox Checkout…
          </div>
        )}

        {capturing && (
          <div style={{ textAlign: "center", padding: "var(--space-md)", color: "var(--color-accent)", fontSize: "var(--text-xs)" }}>
            Authoritatively capturing & verifying payment with PayPal REST API…
          </div>
        )}

        {sdkError && (
          <div style={{ textAlign: "center", padding: "var(--space-md)", color: "#FCA5A5", fontSize: "var(--text-xs)" }}>
            {sdkError}
          </div>
        )}

        {/* PayPal SDK Buttons Render Target */}
        <div
          ref={paypalButtonContainerRef}
          style={{
            minHeight: "44px",
            display: loadingSdk || capturing ? "none" : "block",
          }}
        />

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--space-xs)" }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={onClose}
            disabled={capturing}
          >
            {capturing ? "Processing…" : "Close"}
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}

