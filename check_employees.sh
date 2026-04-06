#!/bin/bash

# Script to check employees in the database
# Usage: ./check_employees.sh

echo "🔍 Checking employees in database..."

# Get Supabase URL and anon key from .env file
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_PUBLISHABLE_KEY" ]; then
  echo "❌ Error: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set in .env"
  exit 1
fi

# Query profiles table
response=$(curl -s -X GET "${VITE_SUPABASE_URL}/rest/v1/profiles?select=username,full_name,department_id,shift_type" \
  -H "Authorization: Bearer ${VITE_SUPABASE_PUBLISHABLE_KEY}" \
  -H "apikey: ${VITE_SUPABASE_PUBLISHABLE_KEY}" \
  -H "Content-Type: application/json")

echo "📋 Employees:"
echo "$response" | jq '.' 2>/dev/null || echo "$response"

echo ""
echo "Kitchen dept ID: d0000000-0000-0000-0000-000000000001"
echo "Service dept ID: d0000000-0000-0000-0000-000000000002"
