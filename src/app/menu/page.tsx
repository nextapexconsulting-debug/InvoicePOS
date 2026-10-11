"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import AuthGate from "@/components/AuthGate";
import {
  Product,
  loadProducts,
  saveProducts,
  makeProductId,
  makeKeywords,
} from "@/lib/products";

export default function MenuPage() {
  return (
    <AuthGate roles={["owner", "staff"]}>
      <MenuManager />
    </AuthGate>
  );
}

function MenuManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    nameEn: "",
    nameGu: "",
    price: "",
    keywords: "",
  });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setProducts(loadProducts());
  }, []);

  const showMsg = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 2500);
  };

  const resetForm = () => {
    setForm({ nameEn: "", nameGu: "", price: "", keywords: "" });
    setEditingId(null);
  };

  const handleSave = () => {
    const nameEn = form.nameEn.trim();
    const nameGu = form.nameGu.trim();
    const price = parseFloat(form.price);

    if (!nameEn || !nameGu || isNaN(price) || price < 0) {
      showMsg("Please fill English name, Gujarati name and valid price");
      return;
    }

    let keywords: string[];
    if (form.keywords.trim()) {
      keywords = form.keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
    } else {
      keywords = makeKeywords(nameEn, nameGu);
    }

    let updated: Product[];

    if (editingId) {
      // Edit existing
      updated = products.map((p) =>
        p.id === editingId
          ? { ...p, nameEn, nameGu, price, keywords }
          : p
      );
      showMsg("Product updated");
    } else {
      // Add new
      const id = makeProductId(nameEn);
      // Avoid duplicate ids
      const finalId = products.some((p) => p.id === id)
        ? `${id}-${Date.now()}`
        : id;

      const newProduct: Product = {
        id: finalId,
        nameEn,
        nameGu,
        price,
        keywords,
      };
      updated = [...products, newProduct];
      showMsg("Product added");
    }

    setProducts(updated);
    saveProducts(updated);
    resetForm();
  };

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    setForm({
      nameEn: product.nameEn,
      nameGu: product.nameGu,
      price: String(product.price),
      keywords: product.keywords.join(", "),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this product?")) return;
    const updated = products.filter((p) => p.id !== id);
    setProducts(updated);
    saveProducts(updated);
    showMsg("Product deleted");
    if (editingId === id) resetForm();
  };

  const handleResetDefaults = () => {
    if (!confirm("Reset to default menu? Your custom items will be removed.")) return;
    localStorage.removeItem("pos-voice-products");
    const defaults = loadProducts();
    setProducts(defaults);
    showMsg("Reset to default menu");
    resetForm();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold">Menu Manager</h1>
          <p className="text-xs text-slate-400">Add / Edit products</p>
        </div>
        <Link
          href="/"
          className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg text-sm font-medium"
        >
          ← Back to POS
        </Link>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-6">
        <Link
          href="/menu/import"
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl py-3 font-semibold"
        >
          📷 Upload menu photo (add or replace all items)
        </Link>
        {message && (
          <div className="bg-emerald-900/50 border border-emerald-600 text-emerald-300 px-4 py-2 rounded-lg text-sm">
            {message}
          </div>
        )}

        {/* Add / Edit Form */}
        <section className="bg-slate-800 rounded-2xl p-5 border border-slate-700 space-y-4">
          <h2 className="font-semibold text-lg">
            {editingId ? "Edit Product" : "Add New Product"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                English Name *
              </label>
              <input
                type="text"
                value={form.nameEn}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nameEn: e.target.value }))
                }
                placeholder="e.g. Butter Slice"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Gujarati Name *
              </label>
              <input
                type="text"
                value={form.nameGu}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nameGu: e.target.value }))
                }
                placeholder="e.g. બટર સ્લાઇસ"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Price (₹) *
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.price}
                onChange={(e) =>
                  setForm((f) => ({ ...f, price: e.target.value }))
                }
                placeholder="e.g. 30"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Keywords (optional, comma separated)
              </label>
              <input
                type="text"
                value={form.keywords}
                onChange={(e) =>
                  setForm((f) => ({ ...f, keywords: e.target.value }))
                }
                placeholder="Auto-generated if empty"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              className="bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 rounded-lg font-medium text-sm"
            >
              {editingId ? "Update Product" : "Add Product"}
            </button>
            {editingId && (
              <button
                onClick={resetForm}
                className="bg-slate-600 hover:bg-slate-500 px-5 py-2.5 rounded-lg text-sm"
              >
                Cancel
              </button>
            )}
          </div>
        </section>

        {/* Product List */}
        <section className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-700 flex items-center justify-between">
            <h2 className="font-semibold">
              Current Menu ({products.length} items)
            </h2>
            <button
              onClick={handleResetDefaults}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Reset to Defaults
            </button>
          </div>

          {products.length === 0 ? (
            <p className="p-6 text-slate-500 text-center">No products yet</p>
          ) : (
            <ul className="divide-y divide-slate-700">
              {products.map((p) => (
                <li
                  key={p.id}
                  className="px-5 py-3 flex items-center gap-3 hover:bg-slate-750"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{p.nameEn}</div>
                    <div className="text-xs text-slate-400 truncate">
                      {p.nameGu}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 truncate">
                      Keywords: {p.keywords.join(", ")}
                    </div>
                  </div>
                  <div className="text-emerald-400 font-semibold whitespace-nowrap">
                    ₹{p.price}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(p)}
                      className="text-xs bg-slate-600 hover:bg-slate-500 px-3 py-1.5 rounded-lg"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-xs bg-red-900/50 hover:bg-red-800 text-red-300 px-3 py-1.5 rounded-lg"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-xs text-slate-500 text-center pb-6">
          Changes are saved automatically in this browser. Open Menu Manager on
          the same device to keep the same menu.
        </p>
      </main>
    </div>
  );
}
