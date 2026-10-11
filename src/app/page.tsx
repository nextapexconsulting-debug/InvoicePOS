"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Product, loadProducts } from "@/lib/products";
import {
  OrderItem,
  parseSpokenOrder,
  mergeOrderItems,
  calculateTotal,
} from "@/lib/parseOrder";

export default function VoicePOS() {
  const [products, setProducts] = useState<Product[]>([]);
  const [order, setOrder] = useState<OrderItem[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [status, setStatus] = useState<string>("Ready");
  const [error, setError] = useState<string | null>(null);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [orderCounter, setOrderCounter] = useState(1000);
  const [isSupported, setIsSupported] = useState(false); // start false to avoid hydration mismatch
  const [priceTab, setPriceTab] = useState<string>("all");

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const productsRef = useRef<Product[]>([]);

  // Load products from localStorage
  useEffect(() => {
    const loaded = loadProducts();
    setProducts(loaded);
    productsRef.current = loaded;
  }, []);

  // Initialize Speech Recognition (client-only)
  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

    setIsSupported(supported);

    if (!supported) {
      setError("Speech Recognition not supported in this browser. Use Chrome or Edge.");
      return;
    }

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    // en-IN often works better for mixed Gujarati-English food names
    // User can still speak Gujarati; product names are matched in both languages
    recognition.lang = "en-IN";
    recognition.maxAlternatives = 3;

    // Keep last interim so we can process it when user stops
    let lastInterim = "";

    const processSpoken = (spoken: string) => {
      const cleaned = spoken.trim();
      if (!cleaned) return;
      setTranscript((prev) => (prev ? prev + " " + cleaned : cleaned));
      setInterimTranscript("");

      const parsed = parseSpokenOrder(cleaned, productsRef.current);
      if (parsed.length > 0) {
        setOrder((prev) => mergeOrderItems(prev, parsed));
        const names = parsed
          .map((p) => `${p.quantity} × ${p.product.nameEn}`)
          .join(", ");
        setLastAdded(names);
        setStatus(`Added: ${names}`);
      } else {
        setStatus(`Heard: "${cleaned}" (no match – try full name)`);
      }
    };

    recognition.onstart = () => {
      setIsListening(true);
      setStatus("Listening... Speak product name");
      setError(null);
      lastInterim = "";
    };

    recognition.onend = () => {
      setIsListening(false);
      // Process any remaining interim text when user stops (helps with fast speech)
      if (lastInterim.trim()) {
        processSpoken(lastInterim);
        lastInterim = "";
      } else {
        setStatus("Stopped");
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech error:", event.error);
      setIsListening(false);
      if (event.error === "not-allowed") {
        setError("Microphone permission denied. Please allow mic access.");
      } else if (event.error === "no-speech") {
        setStatus("No speech detected. Try again.");
      } else if (event.error === "network") {
        setError("Network error – speech needs internet. Check WiFi/data and try again.");
      } else if (event.error === "aborted") {
        // ignore user stop
      } else if (event.error === "audio-capture") {
        setError("No microphone found. Check your mic.");
      } else {
        setError(`Speech error: ${event.error}`);
      }
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript + " ";
        } else {
          interim += result[0].transcript;
        }
      }

      if (interim) {
        lastInterim = interim;
        setInterimTranscript(interim);
      }

      if (final.trim()) {
        lastInterim = "";
        processSpoken(final.trim());
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try { recognition.stop(); } catch {}
    };
  }, []); // run once on mount (client-only)

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    setTranscript("");
    setInterimTranscript("");
    setLastAdded(null);
    try {
      recognitionRef.current.start();
    } catch (e) {
      // already started
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
  }, []);

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setOrder((prev) =>
      prev
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeItem = (productId: string) => {
    setOrder((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearOrder = () => {
    setOrder([]);
    setTranscript("");
    setLastAdded(null);
    setStatus("Order cleared");
  };

  const confirmOrder = async () => {
    if (order.length === 0) {
      setStatus("No items in order");
      return;
    }

    setIsSending(true);
    setStatus("Sending order to Telegram...");

    const newOrderNumber = orderCounter + 1;
    setOrderCounter(newOrderNumber);

    const now = new Date();
    const timeStr = now.toLocaleTimeString("gu-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    // Build the Telegram message in Gujarati (HTML format)
    const itemsText = order
      .map(
        (i) =>
          `• <b>${i.product.nameGu}</b> × ${i.quantity}  =  ₹${i.product.price * i.quantity}`
      )
      .join("\n");

    const message = `
🆕 <b>નવો ઓર્ડર #${newOrderNumber}</b>
⏰ સમય: ${timeStr}

${itemsText}

💰 <b>કુલ: ₹${total}</b>
📌 સ્થિતિ: નવો
`.trim();

    try {
      const res = await fetch("/api/send-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderText: message,
          orderNumber: newOrderNumber,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setStatus(`✅ Order #${newOrderNumber} sent to Telegram!`);
        // Clear order after successful send
        setOrder([]);
        setTranscript("");
        setLastAdded(null);
      } else {
        setStatus(`❌ Failed: ${data.error}`);
        // Still show the order details so user can note it
        alert(
          `Could not send to Telegram.\n\nOrder #${newOrderNumber}\n\n${order
            .map(
              (i) =>
                `${i.quantity} × ${i.product.nameEn} = ₹${i.product.price * i.quantity}`
            )
            .join("\n")}\n\nTotal: ₹${total}\n\nError: ${data.error}`
        );
      }
    } catch (err: any) {
      setStatus(`❌ Network error: ${err.message}`);
      alert("Failed to send order. Check your internet connection.");
    } finally {
      setIsSending(false);
    }
  };

  const addProductManually = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setOrder((prev) => mergeOrderItems(prev, [{ product, quantity: 1 }]));
    setLastAdded(`1 × ${product.nameEn}`);
    setStatus(`Added: 1 × ${product.nameEn}`);
  };


  const total = calculateTotal(order);

  // Price tabs
  const PRICE_TABS = [
    { id: "all", label: "All" },
    { id: "0-50", label: "≤ ₹50" },
    { id: "51-100", label: "₹51–100" },
    { id: "101-150", label: "₹101–150" },
    { id: "151-200", label: "₹151–200" },
    { id: "201+", label: "> ₹200" },
  ] as const;

  const filteredProducts = products.filter((p) => {
    if (priceTab === "all") return true;
    if (priceTab === "0-50") return p.price <= 50;
    if (priceTab === "51-100") return p.price > 50 && p.price <= 100;
    if (priceTab === "101-150") return p.price > 100 && p.price <= 150;
    if (priceTab === "151-200") return p.price > 150 && p.price <= 200;
    if (priceTab === "201+") return p.price > 200;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Voice POS</h1>
          <p className="text-xs text-slate-400">Krishna Sandwich - Pizza</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/menu"
            className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg"
          >
            Menu
          </Link>
          <div className="text-right">
            <div className="text-2xl font-bold text-emerald-400">₹{total}</div>
            <div className="text-xs text-slate-400">Total</div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row max-w-6xl mx-auto w-full min-h-0">
        {/* Left: Voice + Products */}
        <section className="flex-1 p-3 flex flex-col gap-3 min-h-0 overflow-hidden">
          {/* Mic Control - compact */}
          <div className="bg-slate-800 rounded-xl p-3 flex items-center gap-4 border border-slate-700 shrink-0">
            <button
              onClick={toggleListening}
              disabled={!isSupported}
              className={`relative w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all shrink-0 ${
                isListening
                  ? "mic-active mic-pulse bg-emerald-600"
                  : "bg-slate-700 hover:bg-slate-600"
              } ${!isSupported ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {isListening ? "🎙️" : "🎤"}
            </button>
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium truncate ${
                  isListening ? "text-emerald-400" : "text-slate-400"
                }`}
              >
                {status}
              </p>
              {(transcript || interimTranscript) && (
                <p className="text-xs text-slate-400 truncate">
                  {transcript}{" "}
                  <span className="italic text-slate-500">{interimTranscript}</span>
                </p>
              )}
              {lastAdded && (
                <p className="text-xs text-emerald-400 truncate">✓ {lastAdded}</p>
              )}
              {error && <p className="text-xs text-red-400 truncate">{error}</p>}
            </div>
          </div>

          {/* Price Tabs + Products */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Tabs */}
            <div className="flex gap-1 p-2 border-b border-slate-700 overflow-x-auto shrink-0">
              {PRICE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setPriceTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    priceTab === tab.id
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Product grid */}
            <div className="flex-1 overflow-y-auto p-2">
              {filteredProducts.length === 0 ? (
                <p className="text-center text-slate-500 py-8 text-sm">
                  No products in this range
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {filteredProducts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addProductManually(p.id)}
                      className="bg-slate-700 hover:bg-slate-600 active:bg-emerald-700 rounded-xl px-3 py-3 text-left transition-colors"
                    >
                      <div className="text-sm font-medium leading-tight">
                        {p.nameEn}
                      </div>
                      <div className="text-xs text-slate-400 truncate mt-0.5">
                        {p.nameGu}
                      </div>
                      <div className="text-emerald-400 text-sm font-bold mt-1">
                        ₹{p.price}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Right: Current Order */}
        <section className="w-full md:w-96 bg-slate-800/50 border-t md:border-t-0 md:border-l border-slate-700 flex flex-col max-h-[50vh] md:max-h-none">
          {/* Order header with Okay button */}
          <div className="p-3 border-b border-slate-700 flex items-center gap-2 shrink-0">
            <h2 className="font-semibold flex-1">Current Order</h2>
            {order.length > 0 && (
              <button
                onClick={clearOrder}
                className="text-xs text-red-400 hover:text-red-300 px-2"
              >
                Clear
              </button>
            )}
            <button
              onClick={confirmOrder}
              disabled={order.length === 0 || isSending}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
            >
              {isSending ? "Sending..." : "Okay"}
            </button>
          </div>

          {/* Order items */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {order.length === 0 ? (
              <div className="text-center text-slate-500 py-8">
                <div className="text-3xl mb-1">🛒</div>
                <p className="text-sm">No items yet</p>
                <p className="text-xs mt-1">Tap products or use mic</p>
              </div>
            ) : (
              order.map((item) => (
                <div
                  key={item.product.id}
                  className="bg-slate-800 rounded-xl p-2.5 flex items-center gap-2 border border-slate-700"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {item.product.nameEn}
                    </div>
                    <div className="text-xs text-slate-400">
                      ₹{item.product.price} each
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateQuantity(item.product.id, -1)}
                      className="w-7 h-7 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-base"
                    >
                      −
                    </button>
                    <span className="w-5 text-center font-semibold text-sm">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.product.id, 1)}
                      className="w-7 h-7 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-base"
                    >
                      +
                    </button>
                  </div>

                  <div className="text-right min-w-[48px]">
                    <div className="font-semibold text-emerald-400 text-sm">
                      ₹{item.product.price * item.quantity}
                    </div>
                    <button
                      onClick={() => removeItem(item.product.id)}
                      className="text-[10px] text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Total bar */}
          <div className="p-3 border-t border-slate-700 bg-slate-900 flex items-center justify-between shrink-0">
            <span className="text-slate-300 font-medium">Total</span>
            <span className="font-bold text-xl text-emerald-400">₹{total}</span>
          </div>
        </section>
      </main>
    </div>
  );
}
