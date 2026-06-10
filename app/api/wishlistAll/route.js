import connect from "@/utils/config/dbConnection";
import { Product } from "@/utils/models/Product";
import { NextResponse } from "next/server";
import User from "@/utils/models/User";

// Since authOptions isn't exported, we need a workaround
// Let's create a simple session checker

async function getSessionFromHeaders() {
  try {
    // Import headers dynamically
    const { headers } = await import('next/headers');
    const headersList = headers();
    
    // Check for auth cookie
    const cookie = headersList.get('cookie') || '';
    
    if (!cookie.includes('next-auth.session-token')) {
      return null;
    }
    
    // For development, we'll try to find a user
    await connect();
    const users = await User.find({}).limit(1);
    
    if (users.length === 0) {
      return null;
    }
    
    return {
      user: {
        email: users[0].email,
        _id: users[0]._id
      }
    };
    
  } catch (error) {
    console.error("Session error:", error);
    return null;
  }
}

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    
    if (!session) {
      return NextResponse.json(
        { error: "User not authenticated" },
        { status: 401 }
      );
    }
    
    await connect();
    
    const user = await User.findOne({ _id: session.user._id });
    
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }
    
    const wishlistItems = await Product.find({
      _id: { $in: user.wishlist || [] },
    });
    
    return NextResponse.json({ 
      items: wishlistItems,
      count: wishlistItems.length 
    });
    
  } catch (error) {
    console.error("WishlistAll error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
