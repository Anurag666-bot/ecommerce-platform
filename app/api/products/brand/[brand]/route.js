import connect from "@/utils/config/dbConnection";
import { Product } from "@/utils/models/Product";
import { NextResponse } from "next/server";

// Brand normalization and mapping
const brandMappings = {
  // Map common misspellings/variations to actual brand names
  'audemarspiguet': 'Audemars Piguet',
  'audemars': 'Audemars Piguet',
  'ap': 'Audemars Piguet',
  'richardmille': 'Richard Mille',
  'rm': 'Richard Mille',
  'patekphilippe': 'Patek Philipe',
  'patek': 'Patek Philipe',
  'pp': 'Patek Philipe',
  'cartier': 'Cartier',
  'tudor': 'Tudor',
  'rolex': 'Rolex',
  'omega': 'Omega',
  'iwc': 'IWC',
};

export async function GET(req, { params }) {
  await connect();

  const { brand } = params;

  try {
    // Clean and normalize the search term
    const searchTerm = decodeURIComponent(brand)
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ''); // Remove all spaces
    
    console.log(`🔍 Original search: "${brand}" -> Normalized: "${searchTerm}"`);

    // Check if we have a direct mapping
    const mappedBrand = brandMappings[searchTerm];
    if (mappedBrand) {
      console.log(`📌 Mapped "${searchTerm}" to "${mappedBrand}"`);
    }

    // Get ALL products first to see what we have
    const allProducts = await Product.find({})
      .populate("user")
      .sort({ createdAt: -1 })
      .limit(100);
    
    console.log(`📦 Total products in DB: ${allProducts.length}`);
    
    // Get all unique brands in database
    const dbBrands = [...new Set(allProducts.map(p => p.brand).filter(Boolean))];
    console.log(`🏷️  Brands in DB: ${dbBrands.join(', ')}`);

    // Filter products that match the search
    let foundProducts = allProducts.filter(product => {
      if (!product.brand) return false;
      
      // Normalize database brand
      const dbBrand = product.brand.toLowerCase().replace(/\s+/g, '');
      
      // Check various matching strategies
      return (
        // Direct match
        dbBrand === searchTerm ||
        // Mapped brand match
        (mappedBrand && product.brand.toLowerCase() === mappedBrand.toLowerCase()) ||
        // Contains search term
        dbBrand.includes(searchTerm) ||
        // Search term contains brand
        searchTerm.includes(dbBrand) ||
        // Partial match (at least 50% of characters)
        (searchTerm.length >= 3 && dbBrand.includes(searchTerm.substring(0, Math.floor(searchTerm.length * 0.7))))
      );
    });

    console.log(`✅ Found ${foundProducts.length} products for search "${searchTerm}"`);

    if (foundProducts.length > 0) {
      // Log what brands were actually found
      const foundBrands = [...new Set(foundProducts.map(p => p.brand))];
      console.log(`🏷️  Found brands: ${foundBrands.join(', ')}`);
      
      return NextResponse.json(foundProducts);
    } else {
      // No products found - return helpful error
      console.log(`❌ No products found for "${searchTerm}"`);
      
      return NextResponse.json(
        { 
          error: `No products found for brand "${brand}"`,
          searchedFor: brand,
          normalizedSearch: searchTerm,
          availableBrands: dbBrands,
          suggestion: `Try searching for: ${dbBrands.join(', ')}`,
          brandMappings: Object.entries(brandMappings)
            .filter(([key]) => key.includes(searchTerm) || searchTerm.includes(key))
            .map(([key, value]) => `${key} → ${value}`)
        },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error(`❌ Error fetching products for brand "${brand}":`, error);
    return NextResponse.json(
      { 
        error: "Error fetching brand products",
        details: error.message,
        brand: brand
      },
      { status: 500 }
    );
  }
}