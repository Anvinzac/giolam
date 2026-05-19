-- Seed ingredients from schema-export categories (excluding menu items)
-- Vegetables (v1-v42)
INSERT INTO public.ingredients (id, name, emoji, unit, category, subcategory, reference_price) VALUES
  ('v1', 'Cà Rốt', '🥕', 'kg', 'vegetables', 'root-vegetables', 18),
  ('v2', 'Khoai Tây', '🥔', 'kg', 'vegetables', 'root-vegetables', 15),
  ('v3', 'Củ Cải Trắng', '🤍', 'kg', 'vegetables', 'root-vegetables', 12),
  ('v4', 'Rau Muống', '🥬', 'kg', 'vegetables', 'leafy-greens', 20),
  ('v5', 'Rau Ngót', '🌿', 'kg', 'vegetables', 'leafy-greens', 18),
  ('v6', 'Cải Bẹ Xanh', '🥬', 'kg', 'vegetables', 'leafy-greens', 15),
  ('v7', 'Xà Lách', '🥬', 'kg', 'vegetables', 'leafy-greens', 12),
  ('v8', 'Rau Cải', '🥬', 'kg', 'vegetables', 'leafy-greens', 15),
  ('v9', 'Rau Mùi', '🌿', 'kg', 'vegetables', 'allium-vegetables', 25),
  ('v10', 'Hành Lá', '🧅', 'kg', 'vegetables', 'allium-vegetables', 18),
  ('v11', 'Tỏi', '🧄', 'kg', 'vegetables', 'allium-vegetables', 35),
  ('v12', 'Hành Tím', '🧅', 'kg', 'vegetables', 'allium-vegetables', 25),
  ('v13', 'Ớt', '🌶️', 'kg', 'vegetables', 'allium-vegetables', 30),
  ('v14', 'Sả', '🌿', 'kg', 'vegetables', 'stem-vegetables', 20),
  ('v15', 'Cần Tây', '🌱', 'kg', 'vegetables', 'stem-vegetables', 25),
  ('v16', 'Măng', '🎋', 'kg', 'vegetables', 'stem-vegetables', 30),
  ('v17', 'Bí Đao', '🥒', 'kg', 'vegetables', 'root-vegetables', 15),
  ('v18', 'Bầu', '🥒', 'kg', 'vegetables', 'root-vegetables', 12),
  ('v19', 'Mướp', '🥒', 'kg', 'vegetables', 'root-vegetables', 15),
  ('v20', 'Cà Chua', '🍅', 'kg', 'vegetables', 'root-vegetables', 20),
  ('v21', 'Cà Tím', '🍆', 'kg', 'vegetables', 'root-vegetables', 18),
  ('v22', 'Đậu Cô Ve', '🫘', 'kg', 'vegetables', 'root-vegetables', 25),
  ('v23', 'Đậu Que', '🫛', 'kg', 'vegetables', 'root-vegetables', 20),
  ('v24', 'Bắp Cải', '🥬', 'kg', 'vegetables', 'leafy-greens', 15),
  ('v25', 'Su Hào', '🥬', 'kg', 'vegetables', 'root-vegetables', 18),
  ('v26', 'Củ Sả', '🌿', 'kg', 'vegetables', 'stem-vegetables', 22),
  ('v27', 'Ngò Gai', '🌿', 'kg', 'vegetables', 'allium-vegetables', 25),
  ('v28', 'Rau Răm', '🌿', 'kg', 'vegetables', 'allium-vegetables', 20),
  ('v29', 'Tía Tô', '🌿', 'kg', 'vegetables', 'allium-vegetables', 25),
  ('v30', 'Kinh Giới', '🌿', 'kg', 'vegetables', 'allium-vegetables', 20),
  ('v31', 'Lá Lốt', '🍃', 'kg', 'vegetables', 'leafy-greens', 30),
  ('v32', 'Hành Phi', '🧅', 'kg', 'vegetables', 'allium-vegetables', 40),
  ('v33', 'Dọc Mùng', '🌱', 'kg', 'vegetables', 'stem-vegetables', 15),
  ('v34', 'Giá Đỗ', '🌱', 'kg', 'vegetables', 'stem-vegetables', 12),
  ('v35', 'Bông Cải Trắng', '🥦', 'kg', 'vegetables', 'leafy-greens', 25),
  ('v36', 'Bông Cải Xanh', '🥦', 'kg', 'vegetables', 'leafy-greens', 30),
  ('v37', 'Khoai Môn', '🥔', 'kg', 'vegetables', 'root-vegetables', 20),
  ('v38', 'Khoai Lang', '🍠', 'kg', 'vegetables', 'root-vegetables', 15),
  ('v39', 'Khổ Qua', '🥒', 'kg', 'vegetables', 'root-vegetables', 18),
  ('v40', 'Ổi Non', '🌱', 'kg', 'vegetables', 'leafy-greens', 25),
  ('v41', 'Đọt Choai', '🌱', 'kg', 'vegetables', 'leafy-greens', 20),
  ('v42', 'Rau Má', '🌿', 'kg', 'vegetables', 'leafy-greens', 15);

-- Sauces (s1-s20)
INSERT INTO public.ingredients (id, name, emoji, unit, category, reference_price) VALUES
  ('s1', 'Nước Mắm', '🫙', 'chai', 'sauces', 35),
  ('s2', 'Xì Dầu', '🫙', 'chai', 'sauces', 25),
  ('s3', 'Tương Ớt', '🌶️', 'chai', 'sauces', 20),
  ('s4', 'Dầu Hào', '🫙', 'chai', 'sauces', 30),
  ('s5', 'Tương Đen', '🫙', 'chai', 'sauces', 25),
  ('s6', 'Giấm Gạo', '🫙', 'chai', 'sauces', 15),
  ('s7', 'Muối', '🧂', 'gói', 'sauces', 8),
  ('s8', 'Hạt Nêm', '🧂', 'gói', 'sauces', 12),
  ('s9', 'Bột Ngọt', '🧂', 'gói', 'sauces', 15),
  ('s10', 'Tương Cà', '🍅', 'chai', 'sauces', 22),
  ('s11', 'Mayonnaise', '🫙', 'hộp', 'sauces', 45),
  ('s12', 'Sa Tế', '🌶️', 'hộp', 'sauces', 35),
  ('s13', 'Mè Rang', '🥜', 'gói', 'sauces', 20),
  ('s14', 'Bơ Lạc', '🥜', 'hộp', 'sauces', 30),
  ('s15', 'Nước Cốt Dừa', '🥥', 'hộp', 'sauces', 25),
  ('s16', 'Rượu Nấu Ăn', '🍶', 'chai', 'sauces', 40),
  ('s17', 'Dầu Mè', '🫙', 'chai', 'sauces', 55),
  ('s18', 'Tương Xào', '🫙', 'chai', 'sauces', 35),
  ('s19', 'Sốt Chua Ngọt', '🫙', 'chai', 'sauces', 30),
  ('s20', 'Sốt Марина', '🫙', 'chai', 'sauces', 40);

-- Spices (sp1-sp20)
INSERT INTO public.ingredients (id, name, emoji, unit, category, reference_price) VALUES
  ('sp1', 'Tiêu', '🧂', 'gói', 'spices', 45),
  ('sp2', 'Hành Khô', '🧅', 'gói', 'spices', 30),
  ('sp3', 'Tỏi Khô', '🧄', 'gói', 'spices', 35),
  ('sp4', 'Ngò Khô', '🌿', 'gói', 'spices', 25),
  ('sp5', 'Quế', '🌿', 'gói', 'spices', 40),
  ('sp6', 'Hoa Hồi', '⭐', 'gói', 'spices', 50),
  ('sp7', 'Đinh Hương', '🌸', 'gói', 'spices', 55),
  ('sp8', 'Bột Cà Ri', '🟡', 'gói', 'spices', 35),
  ('sp9', 'Bột Ớt', '🌶️', 'gói', 'spices', 30),
  ('sp10', 'Bột Tỏi', '🧄', 'gói', 'spices', 35),
  ('sp11', 'Bột Hành', '🧅', 'gói', 'spices', 25),
  ('sp12', 'Bột Nghệ', '🟡', 'gói', 'spices', 30),
  ('sp13', 'Gừng', '🫚', 'kg', 'spices', 40),
  ('sp14', 'Nghệ Tươi', '🟡', 'kg', 'spices', 35),
  ('sp15', 'Riềng', '🌿', 'gói', 'spices', 25),
  ('sp16', 'Lá Chanh', '🍃', 'gói', 'spices', 20),
  ('sp17', 'Thảo Quả', '🌰', 'gói', 'spices', 45),
  ('sp18', 'Mật Ong', '🍯', 'chai', 'spices', 60),
  ('sp19', 'Đường', '🍬', 'gói', 'spices', 15),
  ('sp20', 'Bột Quế', '🌿', 'gói', 'spices', 40);

-- Grains (g1-g15)
INSERT INTO public.ingredients (id, name, emoji, unit, category, reference_price) VALUES
  ('g1', 'Gạo', '🌾', 'kg', 'grains', 22),
  ('g2', 'Bánh Phở', '🍜', 'kg', 'grains', 30),
  ('g3', 'Bánh Canh', '🍜', 'kg', 'grains', 25),
  ('g4', 'Bún Tươi', '🍜', 'kg', 'grains', 18),
  ('g5', 'Hủ Tiếu', '🍜', 'kg', 'grains', 20),
  ('g6', 'Miến', '🍜', 'gói', 'grains', 25),
  ('g7', 'Mì Gói', '🍜', 'gói', 'grains', 12),
  ('g8', 'Yến Mạch', '🌾', 'kg', 'grains', 45),
  ('g9', 'Bột Năng', '🌾', 'gói', 'grains', 20),
  ('g10', 'Bột Gạo', '🌾', 'gói', 'grains', 22),
  ('g11', 'Bột Mì', '🌾', 'gói', 'grains', 25),
  ('g12', 'Đậu Xanh', '🫘', 'kg', 'grains', 30),
  ('g13', 'Đậu Đỏ', '🫘', 'kg', 'grains', 35),
  ('g14', 'Đậu Đen', '🫘', 'kg', 'grains', 30),
  ('g15', 'Đậu Phộng', '🥜', 'kg', 'grains', 40);

-- Oils (o1-o10)
INSERT INTO public.ingredients (id, name, emoji, unit, category, reference_price) VALUES
  ('o1', 'Dầu Ăn', '🫒', 'lít', 'oils', 35),
  ('o2', 'Dầu Oliu', '🫒', 'lít', 'oils', 80),
  ('o3', 'Mỡ Heo', '🐷', 'kg', 'oils', 50),
  ('o4', 'Dầu Đậu Nành', '🫒', 'lít', 'oils', 30),
  ('o5', 'Dầu Hạt Cải', '🫒', 'lít', 'oils', 35),
  ('o6', 'Dầu Dừa', '🥥', 'lít', 'oils', 45),
  ('o7', 'Dầu Vừng', '🌰', 'lít', 'oils', 60),
  ('o8', 'Bơ Thực Vật', '🧈', 'kg', 'oils', 55),
  ('o9', 'Shortening', '🧈', 'kg', 'oils', 40),
  ('o10', 'Dầu Chiên', '🫒', 'lít', 'oils', 30);

-- Proteins (p1-p10)
INSERT INTO public.ingredients (id, name, emoji, unit, category, reference_price) VALUES
  ('p1', 'Thịt Heo', '🥩', 'kg', 'proteins', 90),
  ('p2', 'Thịt Bò', '🥩', 'kg', 'proteins', 150),
  ('p3', 'Gà Nguyên Con', '🐔', 'kg', 'proteins', 75),
  ('p4', 'Tôm Sú', '🦐', 'kg', 'proteins', 180),
  ('p5', 'Cá Lóc', '🐟', 'kg', 'proteins', 120),
  ('p6', 'Trứng Gà', '🥚', 'tá', 'proteins', 45),
  ('p7', 'Trứng Vịt', '🥚', 'tá', 'proteins', 50),
  ('p8', 'Cá basa', '🐟', 'kg', 'proteins', 80),
  ('p9', 'Mực', '🦑', 'kg', 'proteins', 130),
  ('p10', 'Cua', '🦀', 'kg', 'proteins', 160);

-- Dairy (d1-d8)
INSERT INTO public.ingredients (id, name, emoji, unit, category, reference_price) VALUES
  ('d1', 'Sữa Tươi', '🥛', 'hộp', 'dairy', 25),
  ('d2', 'Sữa Đặc', '🥛', 'hộp', 'dairy', 30),
  ('d3', 'Kem Tươi', '🧁', 'hộp', 'dairy', 45),
  ('d4', 'Phô Mai', '🧀', 'gói', 'dairy', 35),
  ('d5', 'Bơ', '🧈', 'gói', 'dairy', 40),
  ('d6', 'Sữa Chua', '🥛', 'hộp', 'dairy', 20),
  ('d7', 'Sữa Bột', '🥛', 'hộp', 'dairy', 55),
  ('d8', 'Phô Mai Que', '🧀', 'gói', 'dairy', 30);

-- Gas (ga1-ga5)
INSERT INTO public.ingredients (id, name, emoji, unit, category, reference_price) VALUES
  ('ga1', 'Gas Bếp', '⛽', 'bình', 'gas', 250),
  ('ga2', 'Gas Dự Phòng', '⛽', 'bình', 'gas', 180),
  ('ga3', 'Bếp Ga Du Lịch', '🔥', 'bình', 'gas', 60),
  ('ga4', 'Van Ga', '🔧', 'cái', 'gas', 45),
  ('ga5', 'Dây Ga', '🔧', 'cái', 'gas', 35);

-- Equipment (e1-e10)
INSERT INTO public.ingredients (id, name, emoji, unit, category, reference_price) VALUES
  ('e1', 'Túi Nylon', '🛍️', 'cuộn', 'equipment', 25),
  ('e2', 'Hộp Đựng', '📦', 'gói', 'equipment', 40),
  ('e3', 'Găng Tay', '🧤', 'hộp', 'equipment', 30),
  ('e4', 'Khăn Lau', '🧻', 'gói', 'equipment', 20),
  ('e5', 'Chổi Lau', '🧹', 'cái', 'equipment', 45),
  ('e6', 'Xoong Chảo', '🍳', 'cái', 'equipment', 120),
  ('e7', 'Dao Kéo', '🔪', 'cái', 'equipment', 60),
  ('e8', 'Thớt', '🪵', 'cái', 'equipment', 45),
  ('e9', 'Muỗng Nĩa', '🥄', 'gói', 'equipment', 25),
  ('e10', 'Giấy Bạc', '📄', 'cuộn', 'equipment', 35);

-- Tissue & Cleaning (t1-t10)
INSERT INTO public.ingredients (id, name, emoji, unit, category, reference_price) VALUES
  ('t1', 'Giấy Vệ Sinh', '🧻', 'cuộn', 'tissue', 20),
  ('t2', 'Khăn Giấy', '🧻', 'gói', 'tissue', 15),
  ('t3', 'Nước Rửa Chén', '🧴', 'chai', 'tissue', 25),
  ('t4', 'Nước Lau Sàn', '🧴', 'chai', 'tissue', 30),
  ('t5', 'Xà Phòng', '🧼', 'bánh', 'tissue', 18),
  ('t6', 'Nước Tẩy', '🧴', 'chai', 'tissue', 35),
  ('t7', 'Bông Rửa', '🧽', 'gói', 'tissue', 15),
  ('t8', 'Túi Rác', '🗑️', 'cuộn', 'tissue', 20),
  ('t9', 'Cồn', '🧴', 'chai', 'tissue', 25),
  ('t10', 'Nước Hoa', '🌸', 'chai', 'tissue', 40);
