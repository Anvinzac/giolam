#!/bin/bash

# Load environment variables
source .env

SUPABASE_URL="${VITE_SUPABASE_URL}"
SUPABASE_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY}"

echo "🌱 Creating test employee accounts..."
echo ""

# Kitchen employees
declare -a kitchen=(
  "chithoa:Chị Thoa:basic:5000000:25000"
  "chithu:Chị Thu:basic:4800000:25000"
  "chioanh:Chị Oanh:basic:4800000:25000"
  "chiNuong:Chị Nương:overtime:4500000:30000"
  "chiXuan:Chị Xuân:basic:4800000:25000"
  "coHa:Cô Hà:basic:5000000:25000"
  "anhCuong:Anh Cường:overtime:4500000:30000"
  "chichi:Chị Chi:overtime:4500000:30000"
  "tphi:T. Phi:basic:4800000:25000"
  "ntruong:N. Trường:basic:4800000:25000"
  "chinu:Chị Nụ:basic:4800000:25000"
  "chiLinh:Chị Linh:basic:4800000:25000"
)

# Service employees
declare -a service=(
  "ptuan:P. Tuấn:overtime:4500000:30000"
  "hthao:H. Thảo:basic:4800000:25000"
  "vtuan:V. Tuấn:basic:4800000:25000"
  "mhieu:M. Hiếu:basic:4800000:25000"
  "nhuyen:N. Huyền:basic:4800000:25000"
  "tphat:T. Phát:overtime:4500000:30000"
  "ghan:G. Hân:basic:4800000:25000"
  "nbinh:N. Bình:overtime:4500000:30000"
)

# Other employees
declare -a other=(
  "ttu:T. Tư:notice_only:0:35000"
  "qlam:Q. Lâm:notice_only:0:35000"
)

PASSWORD="l@123456"

create_employee() {
  local username=$1
  local full_name=$2
  local shift_type=$3
  local base_salary=$4
  local hourly_rate=$5
  local department=$6
  
  echo "👤 Creating $username ($full_name) - $department..."
  
  response=$(curl -s -X POST \
    "${SUPABASE_URL}/functions/v1/manage-employee" \
    -H "Content-Type: application/json" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -d "{
      \"action\": \"create\",
      \"username\": \"$username\",
      \"password\": \"$PASSWORD\",
      \"full_name\": \"$full_name\",
      \"shift_type\": \"$shift_type\",
      \"base_salary\": $base_salary,
      \"hourly_rate\": $hourly_rate,
      \"default_clock_in\": \"17:00\",
      \"default_clock_out\": \"22:00\",
      \"department_id\": null
    }")
  
  if echo "$response" | grep -q "error"; then
    echo "   ❌ Failed: $(echo $response | grep -o '"error":"[^"]*"' | cut -d'"' -f4)"
  else
    echo "   ✓ Created successfully"
  fi
}

echo "=== KITCHEN DEPARTMENT ==="
for emp in "${kitchen[@]}"; do
  IFS=':' read -r username full_name shift_type base_salary hourly_rate <<< "$emp"
  create_employee "$username" "$full_name" "$shift_type" "$base_salary" "$hourly_rate" "Kitchen"
  sleep 0.5
done

echo ""
echo "=== SERVICE DEPARTMENT ==="
for emp in "${service[@]}"; do
  IFS=':' read -r username full_name shift_type base_salary hourly_rate <<< "$emp"
  create_employee "$username" "$full_name" "$shift_type" "$base_salary" "$hourly_rate" "Service"
  sleep 0.5
done

echo ""
echo "=== OTHER DEPARTMENT ==="
for emp in "${other[@]}"; do
  IFS=':' read -r username full_name shift_type base_salary hourly_rate <<< "$emp"
  create_employee "$username" "$full_name" "$shift_type" "$base_salary" "$hourly_rate" "Other"
  sleep 0.5
done

echo ""
echo "✅ Test accounts created!"
echo ""
echo "📱 All accounts use password: $PASSWORD"
echo "🌐 Login at: http://localhost:5199/login"