
const db = require('../../config/database');

// 📦 Tạo đơn hàng mới (COD / MoMo)
const createOrder = async (orderData) => {
  try {
    // Bắt đầu giao dịch
    await db.query('START TRANSACTION');

    // 1. Insert đơn hàng (đã có giảm giá nếu có)
    const insertQuery = `
      INSERT INTO don_hang (
        id_nguoi_dung,
        id_dia_chi,
        phuong_thuc_thanh_toan,
        trang_thai,
        trang_thai_thanh_toan,
        tong_gia,
        tong_gia_truoc_giam,
        gia_tri_giam,
        id_giam_gia,
        ghi_chu,
        ngay_tao
      ) VALUES (?, ?, ?, 'Đang xử lý', 'Chưa thanh toán', ?, ?, ?, ?, ?, NOW())
    `;

    const insertValues = [
      orderData.id_nguoi_dung,
      orderData.id_dia_chi,
      orderData.phuong_thuc_thanh_toan,
      orderData.tong_gia,
      orderData.tong_gia_truoc_giam || null,
      orderData.gia_tri_giam || 0,
      orderData.id_giam_gia || null,
      orderData.ghi_chu || null,
    ];

    const [result] = await db.query(insertQuery, insertValues);

    const orderId = result.insertId;

    let momo_order_id = null;
    
    // Nếu phương thức thanh toán là MoMo, tạo momo_order_id
    if (orderData.phuong_thuc_thanh_toan === 'momo') {
      momo_order_id = `MOMO_${Date.now()}_${orderId}`;
      // 2. Update momo_order_id vào đơn hàng
      await db.query(
        `UPDATE don_hang SET momo_order_id = ? WHERE id_don_hang = ?`,
        [momo_order_id, orderId]
      );


    }
  
    // 3. Insert chi tiết đơn hàng
    for (const item of orderData.chi_tiet_san_pham) {
      await db.query(
        `INSERT INTO chi_tiet_don_hang (id_don_hang, id_san_pham, so_luong, ghi_chu)
         VALUES (?, ?, ?, ?)`,
        [orderId, item.id_san_pham, item.so_luong, item.ghi_chu || null]
      );
    }

    // 4. Ghi lịch sử
    await db.query(
      `INSERT INTO lich_su_don_hang (id_don_hang, thoi_gian, trang_thai, mo_ta)
       VALUES (?, NOW(), 'Chưa xác nhận', 'Tạo đơn hàng mới')`,
      [orderId]
    );

    // Cam kết giao dịch
    await db.query('COMMIT');

    // Trả về thông tin đơn hàng và momo_order_id nếu có
    //console.log(orderId);

    return { orderId, momo_order_id };

  } catch (err) {
    // Nếu có lỗi, rollback giao dịch
    await db.query('ROLLBACK');
    console.error('❌ Lỗi tạo đơn hàng:', err.message);
    throw err;
  }
};


// 📥 Lấy danh sách đơn hàng theo user
const getOrdersByUserId = async (userId, status) => {
  let sql = `
    SELECT id_don_hang, ngay_tao, trang_thai, tong_gia,
           phuong_thuc_thanh_toan, trang_thai_thanh_toan
    FROM don_hang
    WHERE id_nguoi_dung = ?
  `;
  const params = [userId];

  if (status) {
    sql += ' AND trang_thai = ?';
    params.push(status);
  }

  sql += ' ORDER BY ngay_tao DESC';
  const [rows] = await db.query(sql, params);
  return rows;
};

//📥 Lấy chi tiết danh sách sản phẩm trong đơn hàng của user
const getOrderProductsByUser = async (orderId, userId) => {
  const [items] = await db.query(`
    SELECT 
      -- 🛒 Thông tin sản phẩm
      ctdh.id_san_pham,
      sp.ten AS productName,
      sp.hinh_anh AS imageUrl,
      sp.gia AS price,
      sp.trang_thai AS status,  -- 👈 THÊM dòng này để trả trạng thái sản phẩm
      ctdh.so_luong AS quantity,
      (sp.gia * ctdh.so_luong) AS total,

      -- 👤 Thông tin người mua
      nd.ten AS customerName,
      nd.email AS customerEmail,
      nd.so_dien_thoai AS customerPhone,

      -- 📍 Địa chỉ giao hàng
      dc.dia_chi_day_du AS shippingAddress,

      -- 📦 Thông tin đơn hàng
      dh.id_don_hang,
      dh.ngay_tao AS orderDate,
      dh.trang_thai AS orderStatus,
      dh.phuong_thuc_thanh_toan AS paymentMethod,
      dh.trang_thai_thanh_toan AS paymentStatus,
      dh.tong_gia AS totalPrice,
      dh.gia_tri_giam AS discountValue,
      dh.tong_gia_truoc_giam AS totalBeforeDiscount,
      dh.ghi_chu AS orderNote
    FROM chi_tiet_don_hang ctdh
    INNER JOIN san_pham sp ON ctdh.id_san_pham = sp.id_san_pham
    INNER JOIN don_hang dh ON ctdh.id_don_hang = dh.id_don_hang
    INNER JOIN nguoi_dung nd ON dh.id_nguoi_dung = nd.id_nguoi_dung
    INNER JOIN dia_chi dc ON dh.id_dia_chi = dc.id
    WHERE ctdh.id_don_hang = ? 
      AND dh.id_nguoi_dung = ? 
      AND sp.deleted = 0
      AND (sp.trang_thai = 'active' OR sp.trang_thai = 'Đã hủy')
    ORDER BY ctdh.id_san_pham;
  `, [orderId, userId]);

  return items;
};


const getOrderHistoriesByUser = async (filters = {}) => {
  let sql = `
    SELECT SQL_CALC_FOUND_ROWS
      dh.id_don_hang,
      dh.id_nguoi_dung,
      nd.ten AS ten_nguoi_dung,
      dh.ngay_tao,
      dh.trang_thai,
      dh.phuong_thuc_thanh_toan,
      dh.trang_thai_thanh_toan,
      dh.tong_gia,
      dh.ghi_chu,
      dc.dia_chi_day_du,
      nd.so_dien_thoai
    FROM don_hang dh
    JOIN nguoi_dung nd ON dh.id_nguoi_dung = nd.id_nguoi_dung
    LEFT JOIN dia_chi dc ON dh.id_dia_chi = dc.id
    WHERE 1
  `;

  const params = [];

  // Add the user ID filter if provided
  if (filters.userID) {
    sql += ` AND dh.id_nguoi_dung = ?`;
    params.push(filters.userID);
  }

  // Add the status filter if provided
  if (filters.status) {
    sql += ` AND dh.trang_thai = ?`;
    params.push(filters.status);
  }

  // Add the search filter if provided (name or phone number)
  if (filters.search !== undefined) {
    const keyword = `%${filters.search.toLowerCase()}%`;
    sql += ' AND (LOWER(nd.ten) LIKE ? OR nd.so_dien_thoai LIKE ?)';
    params.push(keyword, filters.search); // 1 for name, 1 for phone number
  }

  sql += ` ORDER BY dh.ngay_tao DESC`;

  // Add the pagination filters if provided
  if (filters.limit !== undefined && filters.offset !== undefined) {
    sql += ` LIMIT ? OFFSET ?`;
    params.push(filters.limit, filters.offset);
  }

  console.log('SQL:', sql);  // Debugging: Print SQL Query
  console.log('Params:', params);  // Debugging: Print parameters

  // Execute the query
  const [rows] = await db.query(sql, params);

  // Get the total number of records
  const [[{ total }]] = await db.query('SELECT FOUND_ROWS() AS total');

  return { orders: rows, total };
};

const cancelOrderByUser = async (orderId, userId) => {
  // Chỉ cập nhật nếu trạng thái đơn hàng là 'Đang xử lý'
  const [result] = await db.query(
    `UPDATE don_hang
     SET trang_thai = 'Đã hủy'
     WHERE id_don_hang = ? AND id_nguoi_dung = ? AND trang_thai = 'Đang xử lý'`,
    [orderId, userId]
  );

  // Nếu có đơn hàng được cập nhật thì ghi log
  if (result.affectedRows > 0) {
    await db.query(
      `INSERT INTO lich_su_don_hang (id_don_hang,trang_thai, thoi_gian, mo_ta)
       VALUES (?,  'Đã hủy',NOW(), 'Người dùng đã hủy đơn hàng')`,
      [orderId]
    );
  }

  return result;
};
const addReview = async (productId, userId, rating, comment) => {
  if (!rating || rating < 1 || rating > 5) {
    throw new Error('Điểm số phải từ 1 đến 5');
  }
  if (!comment || comment.trim().length === 0) {
    throw new Error('Nhận xét không được để trống');
  }

  // Kiểm tra user có đơn hàng đã giao với sản phẩm đó không
  const [rows] = await db.query(`
    SELECT dh.id_don_hang
    FROM don_hang dh
    JOIN chi_tiet_don_hang ctdh ON dh.id_don_hang = ctdh.id_don_hang
    WHERE dh.id_nguoi_dung = ? AND dh.trang_thai = 'Đã giao' AND ctdh.id_san_pham = ?
  `, [userId, productId]);

  if (rows.length === 0) {
    throw new Error('Chỉ có thể đánh giá sản phẩm sau khi đơn hàng đã giao.');
  }

  await db.query(`
    INSERT INTO danh_gia_san_pham (
      id_san_pham, id_nguoi_dung, diem_so, nhan_xet, ngay_danh_gia, deleted, trang_thai
    ) VALUES (?, ?, ?, ?, NOW(), 0, 'active')
  `, [productId, userId, rating, comment.trim()]);
};


const markOrderPaid = async (momoOrderId, amount, method) => {
  await db.query(`
    UPDATE don_hang
    SET trang_thai = 'Đã giao', trang_thai_thanh_toan = 'Đã thanh toán', phuong_thuc_thanh_toan = ?
    WHERE momo_order_id = ? AND trang_thai_thanh_toan = 'Chưa thanh toán'
  `, [method, momoOrderId]);

  await db.query(`
    INSERT INTO thanh_toan (id_don_hang, so_tien, phuong_thuc, trang_thai, ngay_thanh_toan)
    SELECT id_don_hang, ?, ?, 'Đã thanh toán', NOW()
    FROM don_hang WHERE momo_order_id = ?
  `, [amount, method, momoOrderId]);
};

const markOrderFailed = async (momoOrderId) => {
  await db.query(`
    UPDATE don_hang
    SET trang_thai = 'Đã hủy', trang_thai_thanh_toan = 'Thanh toán thất bại'
    WHERE momo_order_id = ?
  `, [momoOrderId]);
};

const getProductsFromOrder = async (orderId, userId) => {
  const [rows] = await db.query(`
    SELECT ctdh.id_san_pham, ctdh.so_luong
    FROM chi_tiet_don_hang ctdh
    JOIN don_hang dh ON dh.id_don_hang = ctdh.id_don_hang
    WHERE dh.id_don_hang = ? AND dh.id_nguoi_dung = ?
  `, [orderId, userId]);
  return rows;
};

const getReviewsByProductId = async (productId) => {
  const [reviews] = await db.query(`
    SELECT dg.id_danh_gia, dg.id_nguoi_dung, nd.ten AS ten_nguoi_dung,
           dg.diem_so, dg.nhan_xet, dg.ngay_danh_gia
    FROM danh_gia_san_pham dg
    JOIN nguoi_dung nd ON dg.id_nguoi_dung = nd.id_nguoi_dung
    WHERE dg.id_san_pham = ? AND dg.deleted = 0 AND dg.trang_thai = 'active'
    ORDER BY dg.ngay_danh_gia DESC
  `, [productId]);
  return reviews;
};

const deleteOrder = async (orderId) => {
  try {
    const [result] = await db.query(
      `Update don_hang set deleted=1  WHERE id_don_hang = ?`,
      [orderId]
    );
    return result.affectedRows > 0;
  } catch (err) {
    console.error('❌ Lỗi deleteOrder:', err);
    throw new Error('Không thể xóa đơn hàng');
  }
};

module.exports = {
  createOrder,
  getOrdersByUserId,
  getOrderProductsByUser, // hàm mới lấy chi tiết sản phẩm đơn hàng
  getOrderHistoriesByUser,
  cancelOrderByUser,
  addReview,
  markOrderPaid,
  markOrderFailed,
  getProductsFromOrder,
  getReviewsByProductId,
  deleteOrder
};
