const { MongoClient } = require('mongodb');

async function checkBrands() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('projectEcom');
    
    const products = await db.collection('products').find({}).toArray();
    
    console.log(`Total products: ${products.length}`);
    console.log('\n📊 All brands in database:');
    
    // Get all unique brands
    const brands = [...new Set(products.map(p => p.brand))];
    
    brands.forEach((brand, index) => {
      const count = products.filter(p => p.brand === brand).length;
      console.log(`${index + 1}. ${brand || 'No brand'} (${count} products)`);
    });
    
    // Check specific problematic brands
    console.log('\n🔍 Checking problematic brands:');
    const problematicBrands = ['audemarspiguet', 'richardmille', 'cartier', 'tudor', 'rolex', 'omega'];
    
    problematicBrands.forEach(brand => {
      const regex = new RegExp(brand.replace(/\s+/g, ''), 'i');
      const matchingProducts = products.filter(p => 
        p.brand && regex.test(p.brand.replace(/\s+/g, ''))
      );
      console.log(`   ${brand}: ${matchingProducts.length} products found`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkBrands();
