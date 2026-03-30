import { NextResponse } from "next/server";
import { auth } from "@/auth";

const PRODUCT_CATEGORIES = new Set(["Men", "Women", "Accessories"]);

const getAdminEmails = () =>
  (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

export async function requireAdmin() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();

  if (!email) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }

  const adminEmails = getAdminEmails();
  if (adminEmails.length === 0) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "ADMIN_EMAILS is not configured on the server" },
        { status: 503 },
      ),
    };
  }

  if (!adminEmails.includes(email)) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
    };
  }

  return {
    authorized: true,
    session,
  };
}

export function validateProductPayload(payload) {
  const name = payload?.name?.trim();
  const category = payload?.category?.trim();
  const tag = payload?.tag?.trim() || "";
  const img = payload?.img?.trim() || "";
  const price = Number(payload?.price);

  if (!name || name.length > 120) {
    return { valid: false, error: "Product name is required and must be 120 characters or fewer" };
  }

  if (!Number.isFinite(price) || price < 0 || price > 1000000) {
    return { valid: false, error: "Product price must be a valid amount between 0 and 1000000" };
  }

  if (!PRODUCT_CATEGORIES.has(category)) {
    return { valid: false, error: "Product category is invalid" };
  }

  if (tag.length > 40) {
    return { valid: false, error: "Product tag must be 40 characters or fewer" };
  }

  if (img) {
    try {
      const url = new URL(img);
      if (!["http:", "https:"].includes(url.protocol)) {
        return { valid: false, error: "Product image URL must use http or https" };
      }
    } catch {
      return { valid: false, error: "Product image URL is invalid" };
    }
  }

  return {
    valid: true,
    data: {
      name,
      price,
      category,
      tag,
      img,
    },
  };
}
