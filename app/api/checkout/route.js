import { NextResponse } from "next/server";
import connect from "@/utils/config/dbConnection";
import Order from "@/utils/models/Order";
import { Product } from "@/utils/models/Product";
import Stripe from "stripe";

// Initialize Stripe with error handling
let stripe;
try {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
  console.log("✅ Stripe initialized");
} catch (error) {
  console.error("❌ Stripe initialization error:", error);
}

// Helper function to validate and clean image URLs for Stripe
function getStripeImageUrl(imageUrl) {
  if (!imageUrl) return undefined;
  
  // Remove any query parameters
  const cleanUrl = imageUrl.split('?')[0];
  
  // Check if URL is valid HTTPS
  try {
    const url = new URL(cleanUrl);
    if (url.protocol === 'https:') {
      return cleanUrl;
    }
  } catch (e) {
    // URL is invalid
    console.warn(`⚠️ Invalid image URL for Stripe: ${imageUrl}`);
  }
  
  return undefined;
}

export async function POST(req) {
  try {
    console.log("=== CHECKOUT PROCESS START ===");
    
    // Validate Stripe
    if (!stripe) {
      console.error("❌ Stripe not initialized");
      return NextResponse.json(
        { error: "Payment service not available" },
        { status: 500 }
      );
    }

    // Validate STRIPE_SECRET_KEY
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_SECRET_KEY.startsWith('sk_')) {
      console.error("❌ Invalid STRIPE_SECRET_KEY");
      return NextResponse.json(
        { error: "Payment configuration error" },
        { status: 500 }
      );
    }

    // Connect to database
    console.log("1. Connecting to database...");
    try {
      await connect();
      console.log("✅ Database connected");
    } catch (dbError) {
      console.error("❌ Database connection error:", dbError);
      return NextResponse.json(
        { error: "Database connection failed", details: dbError.message },
        { status: 500 }
      );
    }

    // Parse request body
    console.log("2. Parsing request body...");
    let body;
    try {
      body = await req.json();
      console.log("📦 Request body received");
    } catch (parseError) {
      console.error("❌ JSON parse error:", parseError);
      return NextResponse.json(
        { error: "Invalid request format" },
        { status: 400 }
      );
    }

    const {
      name,
      email,
      city,
      postalCode,
      streetAddress,
      country,
      cartItems = [],
      user,
    } = body;

    console.log("👤 Customer:", { 
      name: name?.substring(0, 20) + (name?.length > 20 ? '...' : ''),
      email: email?.substring(0, 20) + (email?.length > 20 ? '...' : ''),
      city, 
      postalCode, 
      streetAddress: streetAddress?.substring(0, 30) + (streetAddress?.length > 30 ? '...' : ''),
      country 
    });

    // Validate required fields
    const requiredFields = { name, email, city, postalCode, streetAddress, country };
    const missingFields = Object.entries(requiredFields)
      .filter(([key, value]) => !value || value.trim() === '')
      .map(([key]) => key);

    if (missingFields.length > 0) {
      console.log("❌ Missing required fields:", missingFields);
      return NextResponse.json(
        { 
          error: "Missing required fields", 
          missingFields,
          details: `Please provide: ${missingFields.join(', ')}`
        },
        { status: 400 }
      );
    }

    // Validate cart
    if (!cartItems || cartItems.length === 0) {
      console.log("❌ Cart is empty");
      return NextResponse.json(
        { error: "Cart is empty" },
        { status: 400 }
      );
    }

    console.log(`🛒 Cart has ${cartItems.length} items`);

    // Get product IDs
    const productIds = cartItems.map((item) => item.id).filter(id => id);
    const uniqueIds = [...new Set(productIds)];
    
    if (uniqueIds.length === 0) {
      console.log("❌ No valid product IDs in cart");
      return NextResponse.json(
        { error: "No valid products in cart" },
        { status: 400 }
      );
    }

    console.log("🔍 Looking up products:", uniqueIds);

    // Fetch products from database
    let productsInfos;
    try {
      productsInfos = await Product.find({ _id: { $in: uniqueIds } });
      console.log(`✅ Found ${productsInfos.length} products`);
    } catch (productError) {
      console.error("❌ Error fetching products:", productError);
      return NextResponse.json(
        { error: "Error fetching products", details: productError.message },
        { status: 500 }
      );
    }

    if (!productsInfos || productsInfos.length === 0) {
      console.log("❌ No products found in database");
      return NextResponse.json(
        { error: "No products found" },
        { status: 400 }
      );
    }

    // Build line items and calculate total
    let line_items = [];
    let total = 0;
    let orderCartProducts = [];

    console.log("💰 Calculating order total...");
    for (const cartItem of cartItems) {
      const productInfo = productsInfos.find(
        (p) => p._id.toString() === cartItem.id
      );

      if (productInfo) {
        const quantity = cartItem.quantity || 1;
        if (quantity > 0) {
          const itemTotal = productInfo.price * quantity;
          total += itemTotal;
          
          // Prepare product data for Stripe
          const productData = {
            name: productInfo.name,
            description: productInfo.description?.substring(0, 100) || productInfo.name,
          };
          
          // Add image only if it's a valid HTTPS URL
          const firstImage = productInfo.images?.[0];
          const stripeImageUrl = getStripeImageUrl(firstImage);
          if (stripeImageUrl) {
            productData.images = [stripeImageUrl];
            console.log(`   ✅ Using image: ${stripeImageUrl.substring(0, 50)}...`);
          } else if (firstImage) {
            console.log(`   ⚠️  Skipping invalid image URL: ${firstImage.substring(0, 50)}...`);
          }
          
          line_items.push({
            price_data: {
              currency: "usd",
              product_data: productData,
              unit_amount: Math.round(productInfo.price * 100), // Convert to cents
            },
            quantity: quantity,
          });

          orderCartProducts.push({
            product: productInfo._id,
            quantity: quantity,
            price: productInfo.price,
            name: productInfo.name,
          });

          console.log(`   • ${productInfo.name}: $${productInfo.price} x ${quantity} = $${itemTotal}`);
        }
      } else {
        console.log(`⚠️  Product not found for ID: ${cartItem.id}`);
      }
    }

    console.log(`💰 Total: $${total}`);

    // Validate total
    if (total <= 0) {
      console.log("❌ Invalid total amount");
      return NextResponse.json(
        { error: "Invalid order total" },
        { status: 400 }
      );
    }

    // Create order in database
    console.log("📝 Creating order in database...");
    let orderDoc;
    try {
      orderDoc = await Order.create({
        name,
        email,
        city,
        postalCode,
        streetAddress,
        country,
        paid: false,
        cartProducts: orderCartProducts,
        total,
        user: user || null,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`✅ Order created with ID: ${orderDoc._id}`);
    } catch (orderError) {
      console.error("❌ Error creating order:", orderError);
      
      if (orderError.name === 'ValidationError') {
        const validationErrors = {};
        for (const field in orderError.errors) {
          validationErrors[field] = orderError.errors[field].message;
        }
        console.error("Validation errors:", validationErrors);
        
        return NextResponse.json(
          { 
            error: "Order validation failed", 
            validationErrors,
            details: Object.values(validationErrors).join(', ')
          },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: "Error creating order", details: orderError.message },
        { status: 500 }
      );
    }

    // Create Stripe checkout session
    console.log("💳 Creating Stripe checkout session...");
    let session;
    try {
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      const successUrl = `${baseUrl}/checkout/success?orderId=${orderDoc._id}`;
      const cancelUrl = `${baseUrl}/cart`;
      
      console.log(`🔗 Base URL: ${baseUrl}`);
      console.log(`🔗 Success URL: ${successUrl}`);
      console.log(`🔗 Cancel URL: ${cancelUrl}`);
      
      // Debug: Log line_items before sending to Stripe
      console.log("🛍️ Line items being sent to Stripe:");
      console.log(JSON.stringify(line_items, null, 2));
      
      session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items,
        mode: "payment",
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: email,
        metadata: {
          orderId: orderDoc._id.toString(),
          customerName: name,
          customerEmail: email,
        },
        shipping_address_collection: {
          allowed_countries: ['US', 'CA', 'GB', 'AU', 'IN', 'DE', 'FR', 'NP'],
        },
      });
      
      console.log(`✅ Stripe session created: ${session.id}`);
      
      // Update order with Stripe session ID
      await Order.findByIdAndUpdate(orderDoc._id, {
        stripeSessionId: session.id,
      });
      
    } catch (stripeError) {
      console.error("❌ Error creating Stripe session:", stripeError.message);
      console.error("Stripe error details:", {
        type: stripeError.type,
        code: stripeError.code,
        param: stripeError.param,
        raw: stripeError.raw
      });
      
      // Update order to reflect failure
      try {
        await Order.findByIdAndUpdate(orderDoc._id, {
          status: "payment_failed",
          stripeError: stripeError.message,
        });
      } catch (updateError) {
        console.error("❌ Error updating failed order:", updateError);
      }
      
      return NextResponse.json(
        { 
          error: "Payment processing failed", 
          details: stripeError.message,
          type: stripeError.type,
          code: stripeError.code,
          param: stripeError.param,
        },
        { status: 500 }
      );
    }

    console.log("=== CHECKOUT PROCESS COMPLETE ===");
    console.log(`📊 Summary: Order ${orderDoc._id}, Total: $${total}, Stripe Session: ${session.id}`);
    
    return NextResponse.json(
      {
        url: session.url,
        orderId: orderDoc._id,
        sessionId: session.id,
        total: total,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("❌ UNEXPECTED CHECKOUT ERROR:", error);
    console.error("Stack trace:", error.stack);
    
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error.message,
        type: error.type || "unknown",
      },
      { status: 500 }
    );
  }
}