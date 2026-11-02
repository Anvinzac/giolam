#!/bin/bash

# Script to seed test employees via Supabase Edge Function
# Usage: ./seed_employees.sh

echo "🌱 Seeding test employees..."

# Get Supabase URL and anon key from .env file
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_PUBLISHABLE_KEY" ]; then
  echo "❌ Error: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set in .env"
  exit 1
fi

# Invoke the seed-employees function
response=$(curl -s -X POST "${VITE_SUPABASE_URL}/functions/v1/seed-employees" \
  -H "Authorization: Bearer ${VITE_SUPABASE_PUBLISHABLE_KEY}" \
  -H "Content-Type: application/json")

echo "📋 Response:"
echo "$response" | jq '.' 2>/dev/null || echo "$response"

echo ""
echo "✅ Done! Check the Salary Admin page to see the department folders."
echo "   Password for all accounts: l@123456"
