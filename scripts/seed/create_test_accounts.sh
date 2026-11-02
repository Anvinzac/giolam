#!/bin/bash

# Load environment variables
source .env

SUPABASE_URL="${VITE_SUPABASE_URL}"
SUPABASE_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY}"

echo "🌱 Creating test accounts..."
echo ""

# Test accounts
declare -a accounts=(
  "nhanvien_a:test123:Nguyễn Văn A:basic:5000000:25000:17:00:22:00"
  "nhanvien_b:test123:Trần Thị B:overtime:4500000:30000:17:00:22:00"
  "nhanvien_c:test123:Lê Văn C:notice_only:0:35000:08:00:17:30"
)

for account in "${accounts[@]}"; do
  IFS=':' read -r username password full_name shift_type base_salary hourly_rate clock_in clock_out <<< "$account"
  
  echo "👤 Creating $username ($full_name)..."
  
  response=$(curl -s -X POST \
    "${SUPABASE_URL}/functions/v1/manage-employee" \
    -H "Content-Type: application/json" \
    -H "apikey: ${SUPABASE_KEY}" \
    -d "{
      \"action\": \"create\",
      \"username\": \"$username\",
      \"password\": \"$password\",
      \"full_name\": \"$full_name\",
      \"shift_type\": \"$shift_type\",
      \"base_salary\": $base_salary,
      \"hourly_rate\": $hourly_rate,
      \"default_clock_in\": \"$clock_in\",
      \"default_clock_out\": \"$clock_out\"
    }")
  
  if echo "$response" | grep -q "error"; then
    echo "   ❌ Failed: $(echo $response | grep -o '"error":"[^"]*"' | cut -d'"' -f4)"
  else
    echo "   ✓ Created successfully"
    echo "   📝 Username: $username"
    echo "   🔑 Password: $password"
    echo "   💼 Type: $shift_type"
  fi
  echo ""
done

echo "✅ Test accounts created"
echo ""
echo "📱 Login credentials:"
echo "   nhanvien_a / test123 (Type A - Basic)"
echo "   nhanvien_b / test123 (Type B - Overtime)"
echo "   nhanvien_c / test123 (Type C - Notice Only)"
echo ""
echo "🌐 Login at: http://localhost:5199/login"
echo "📱 Or from phone: http://192.168.1.3:5199/login"
