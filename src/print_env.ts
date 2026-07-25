console.log('Environment variables:');
for (const key of Object.keys(process.env)) {
  if (key.includes('SUPABASE') || key.includes('DB') || key.includes('POSTGRES') || key.includes('KEY') || key.includes('PASS')) {
    console.log(`${key}: ${process.env[key]}`);
  }
}
