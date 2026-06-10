import { NextResponse } from "next/server";
import connect from "@/utils/config/dbConnection";
import { Product } from "@/utils/models/Product";
import User from "@/utils/models/User";

// Simplified session extraction from cookies
async function getSessionFromRequest(req) {
  try {
    // Get the session token from cookies
    const cookieHeader = req.headers.get('cookie');
    if (!cookieHeader) return null;
    
    // Extract the next-auth.session-token
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [name, value] = cookie.trim().split('=');
      acc[name] = value;
      return acc;
    }, {});
    
    const sessionToken = cookies['next-auth.session-token'];
    
    if (!sessionToken) {
      return null;
    }
    
    await connect();
    
    // Find user by session (you might need to adjust this based on your User model)
    // This is a simplified approach
    const user = await User.findOne({ 
      // Assuming you store session info in your User model
      // Adjust this query based on your actual User schema
      email: { $exists: true } // Temporary - we'll get email from token
    });
    
    if (!user) {
      return null;
    }
    
    return {
      user: {
        email: user.email,
        id: user._id.toString(),
        name: user.name
      }
    };
    
  } catch (error) {
    console.error("Session extraction error:", error);
    return null;
  }
}

export async function GET(req) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !session.user || !session.user.email) {
      return NextResponse.json(
        { error: "User not authenticated. Please log in." },
        { status: 401 }
      );
    }
    
    await connect();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    const skip = (page - 1) * limit;

    const user = await User.findOne({ email: session.user.email });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    const totalItems = user.wishlist ? user.wishlist.length : 0;
    const paginatedWishListIds = user.wishlist ? user.wishlist.slice(skip, skip + limit) : [];

    const wishlistItems = await Product.find({
      _id: { $in: paginatedWishListIds },
    });

    return NextResponse.json({
      items: wishlistItems,
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit),
      hasMore: skip + limit < totalItems,
      totalItems: totalItems
    });
  } catch (error) {
    console.error("Wishlist GET error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(req) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !session.user || !session.user.email) {
      return NextResponse.json(
        { error: "User not authenticated. Please log in." },
        { status: 401 }
      );
    }
    
    await connect();
    
    const { productId } = await req.json();
    if (!productId) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }
    
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    const product = await Product.findById(productId);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    
    if (!user.wishlist) {
      user.wishlist = [];
    }
    
    // Check if product is already in wishlist
    const isAlreadyInWishlist = user.wishlist.some(id => 
      id.toString() === productId.toString()
    );
    
    if (!isAlreadyInWishlist) {
      user.wishlist.push(productId);
      await user.save();
    }
    
    return NextResponse.json(
      {
        message: "Product added to wishlist",
        wishlistCount: user.wishlist.length,
        alreadyInWishlist: isAlreadyInWishlist
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Wishlist PUT error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || !session.user || !session.user.email) {
      return NextResponse.json(
        { error: "User not authenticated. Please log in." },
        { status: 401 }
      );
    }
    
    await connect();
    
    const { productId } = await req.json();
    if (!productId) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }
    
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    if (!user.wishlist) {
      user.wishlist = [];
    }
    
    const initialLength = user.wishlist.length;
    user.wishlist = user.wishlist.filter((id) => id.toString() !== productId.toString());
    
    if (user.wishlist.length !== initialLength) {
      await user.save();
    }
    
    return NextResponse.json(
      {
        message: "Product removed from wishlist",
        removed: initialLength !== user.wishlist.length,
        wishlistCount: user.wishlist.length
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Wishlist DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
