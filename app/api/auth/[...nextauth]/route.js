
import connect from "@/utils/config/dbConnection";
import User from "@/utils/models/User.js";
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcryptjs from "bcryptjs";

const DEFAULT_PROFILE_IMAGE =
  "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";

async function createUser(email, password, name) {
  const hashedPassword = await bcryptjs.hash(password, 10);
  const newUser = new User({
    email,
    password: hashedPassword,
    name,
    profileImage: DEFAULT_PROFILE_IMAGE,
  });
  return await newUser.save();
}

// Define authOptions
const authOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        name: { label: "Name", type: "text", optional: true },
        isRegistering: { label: "Is Registering", type: "boolean", optional: true }
      },
      async authorize(credentials) {
        const { email, password, name, isRegistering } = credentials;
        console.log("🔐 Auth attempt for:", email, isRegistering ? "(registering)" : "(logging in)");
        
        try {
          await connect();
          let user = await User.findOne({ email });
          
          if (isRegistering) {
            if (user) {
              console.log("❌ User already exists:", email);
              throw new Error("User is already registered");
            }
            console.log("📝 Creating new user:", email);
            user = await createUser(email, password, name);
            console.log("✅ User created:", user._id);
          } else {
            if (!user) {
              console.log("❌ User not found:", email);
              return null;
            }
            const passwordMatch = await bcryptjs.compare(password, user.password);
            if (!passwordMatch) {
              console.log("❌ Password mismatch for:", email);
              return null;
            }
            console.log("✅ Password valid for:", email);
          }

          if (!user.profileImage) {
            user.profileImage = DEFAULT_PROFILE_IMAGE;
            await user.save();
          }
          
          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            profileImage: user.profileImage,
            admin: user.admin || false,
            notificationPreferences: user.notificationPreferences || {
              orderUpdates: true,
              promotions: false
            }
          };
          
        } catch (error) {
          console.log("❌ Error in authorize:", error.message);
          return null;
        }
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },

  callbacks: {
    async signIn({ user, account }) {
      console.log("🔑 SignIn callback triggered for provider:", account?.provider);
      
      if (account?.provider === "google") {
        try {
          const { email, name, image } = user;
          await connect();
          let foundUser = await User.findOne({ email });

          if (!foundUser) {
            console.log("📝 Creating new Google user:", email);
            const newUser = new User({
              email,
              name,
              profileImage: image || DEFAULT_PROFILE_IMAGE,
            });
            foundUser = await newUser.save();
          } else if (!foundUser.profileImage || foundUser.profileImage === DEFAULT_PROFILE_IMAGE) {
            foundUser.profileImage = image || DEFAULT_PROFILE_IMAGE;
            await foundUser.save();
          }

          user.id = foundUser._id.toString();
          user.email = foundUser.email;
          user.name = foundUser.name;
          user.notificationPreferences = foundUser.notificationPreferences || {
            orderUpdates: true,
            promotions: false
          };
          user.admin = foundUser.admin || false;
          user.profileImage = foundUser.profileImage;

          console.log("✅ Google user processed:", user.email);
          return true;
        } catch (error) {
          console.log("❌ Google signIn error:", error);
          return false;
        }
      }
      return true;
    },
    
    async jwt({ token, user, trigger, session }) {
      if (user) {
        console.log("🔄 Creating JWT for user:", user.email);
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.notificationPreferences = user.notificationPreferences || {
          orderUpdates: true,
          promotions: false
        };
        token.admin = user.admin || false;
        token.profileImage = user.profileImage || DEFAULT_PROFILE_IMAGE;
      }
      
      if (trigger === "update" && session) {
        console.log("🔄 Updating JWT with session data");
        if (session.user?.name) token.name = session.user.name;
        if (session.user?.email) token.email = session.user.email;
        if (session.user?.profileImage) token.profileImage = session.user.profileImage;
        if (session.user?.notificationPreferences) token.notificationPreferences = session.user.notificationPreferences;
        if (session.user?.admin !== undefined) token.admin = session.user.admin;
      }
      
      return token;
    },
    
    async session({ session, token }) {
      console.log("🔄 Creating session from token");
      
      if (token?.id) {
        session.user.id = token.id;
      }
      
      if (token?.email) {
        session.user.email = token.email;
      }
      
      if (token?.name) {
        session.user.name = token.name;
      }
      
      if (token?.notificationPreferences) {
        session.user.notificationPreferences = token.notificationPreferences;
      } else {
        session.user.notificationPreferences = {
          orderUpdates: true,
          promotions: false
        };
      }
      
      if (token?.admin !== undefined) {
        session.user.admin = token.admin;
      } else {
        session.user.admin = false;
      }
      
      if (token?.profileImage) {
        session.user.profileImage = token.profileImage;
      } else {
        session.user.profileImage = DEFAULT_PROFILE_IMAGE;
      }
      
      console.log("✅ Session created for:", session.user.email || "unknown");
      return session;
    },
  },
  
  secret: process.env.NEXTAUTH_SECRET || "dev-secret-for-testing-only",
  debug: process.env.NODE_ENV === "development",
  pages: {
    signIn: "/login",
    error: "/login",
  }
};

// Create the handler
const handler = NextAuth(authOptions);

// Export only once - choose one option:

// OPTION 1: Export handler for NextAuth
export { handler as GET, handler as POST };

// OPTION 2: If other files need authOptions, export it too
// export { handler as GET, handler as POST, authOptions };

// BUT NOT BOTH! The error happens when you export authOptions twice
