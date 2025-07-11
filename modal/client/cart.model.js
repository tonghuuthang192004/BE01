const db = require('../../config/database');

// 📦 Lấy giỏ hàng của user
const getCartUserID = async (userId) => {
  const [result] = await db.query(
    'SELECT * FROM gio_hang WHERE id_nguoi_dung = ? LIMIT 1',
    [userId]
  );
  return result.length > 0 ? result[0] : null;
};

// 📥 Lấy danh sách sản phẩm trong giỏ
const getCartItem = async (userId) => {
  const sql = `
    SELECT 
      gio_hang.id_san_pham, 
      gio_hang.so_luong, 
      san_pham.ten, 
      san_pham.gia, 
      san_pham.hinh_anh
     
    FROM gio_hang
    JOIN san_pham ON gio_hang.id_san_pham = san_pham.id_san_pham
    WHERE gio_hang.id_nguoi_dung = ?`;
  const [result] = await db.query(sql, [userId]);
  return result;
};

// ➕ Thêm sản phẩm vào giỏ
const addItemToCart = async (userId, productId, quantity) => {
  // Kiểm tra nếu sản phẩm đã tồn tại trong giỏ
  const [existing] = await db.query(
    'SELECT * FROM gio_hang WHERE id_nguoi_dung = ? AND id_san_pham = ?',
    [userId, productId]
  );

  if (existing.length > 0) {
    // Cộng dồn số lượng nếu sản phẩm đã có trong giỏ
    const newQuantity = existing[0].so_luong + quantity;
    const [updateResult] = await db.query(
      'UPDATE gio_hang SET so_luong = ? WHERE id_nguoi_dung = ? AND id_san_pham = ?',
      [newQuantity, userId, productId]
    );
    return { type: 'update', result: updateResult, quantity: newQuantity };
  } else {
    // Thêm sản phẩm mới vào giỏ
    const [insertResult] = await db.query(
      'INSERT INTO gio_hang (id_nguoi_dung, id_san_pham, so_luong) VALUES (?, ?, ?)',
      [userId, productId, quantity]
    );
    return { type: 'insert', result: insertResult, quantity };
  }
};

// 🔄 Cập nhật số lượng sản phẩm
const updateCartItemQuantity = async (userId, productId, quantity) => {
  const sql = `
    UPDATE gio_hang 
    SET so_luong = ? 
    WHERE id_nguoi_dung = ? AND id_san_pham = ?`;
  const [result] = await db.query(sql, [quantity, userId, productId]);

  if (result.affectedRows === 0) {
    // Nếu sản phẩm chưa tồn tại => Thêm mới
    return await addItemToCart(userId, productId, quantity);
  }
  return result;
};

// ❌ Xoá 1 sản phẩm khỏi giỏ
const deleteItem = async (userId, productId) => {
  const sql = `
    DELETE FROM gio_hang
    WHERE id_nguoi_dung = ? AND id_san_pham = ?`;
  const [result] = await db.query(sql, [userId, productId]);
  return result;
};

// 🧹 Xoá toàn bộ giỏ hàng
const clearCart = async (userId) => {
  const sql = `
    DELETE FROM gio_hang
    WHERE id_nguoi_dung = ?`;
  const [result] = await db.query(sql, [userId]);
  return result;
};


// const addItemToCart = async (userId, productId, quantity) => {
//   // Kiểm tra số lượng sản phẩm còn trong kho
//   const [product] = await db.query(
//     'SELECT so_luong_kho FROM san_pham WHERE id_san_pham = ?',
//     [productId]
//   );

//   // Nếu không tìm thấy sản phẩm hoặc số lượng kho không đủ
//   if (!product.length || product[0].so_luong_kho < quantity) {
//     throw new Error('Số lượng sản phẩm không đủ trong kho để thêm vào giỏ');
//   }

//   // Kiểm tra nếu sản phẩm đã tồn tại trong giỏ
//   const [existing] = await db.query(
//     'SELECT * FROM gio_hang WHERE id_nguoi_dung = ? AND id_san_pham = ?',
//     [userId, productId]
//   );

//   if (existing.length > 0) {
//     // Cộng dồn số lượng nếu sản phẩm đã có trong giỏ
//     const newQuantity = existing[0].so_luong + quantity;
    
//     // Kiểm tra lại số lượng trong kho sau khi cập nhật
//     if (product[0].so_luong_kho < newQuantity) {
//       throw new Error('Số lượng sản phẩm không đủ trong kho để cập nhật');
//     }

//     const [updateResult] = await db.query(
//       'UPDATE gio_hang SET so_luong = ? WHERE id_nguoi_dung = ? AND id_san_pham = ?',
//       [newQuantity, userId, productId]
//     );
//     return { type: 'update', result: updateResult, quantity: newQuantity };
//   } else {
//     // Thêm sản phẩm mới vào giỏ
//     const [insertResult] = await db.query(
//       'INSERT INTO gio_hang (id_nguoi_dung, id_san_pham, so_luong) VALUES (?, ?, ?)',
//       [userId, productId, quantity]
//     );
//     return { type: 'insert', result: insertResult, quantity };
//   }
// };
// // 🔄 Cập nhật số lượng sản phẩm
// const updateCartItemQuantity = async (userId, productId, quantity) => {
//   // Kiểm tra số lượng sản phẩm còn trong kho
//   const [product] = await db.query(
//     'SELECT so_luong_kho FROM san_pham WHERE id_san_pham = ?',
//     [productId]
//   );

//   // Nếu không tìm thấy sản phẩm hoặc số lượng kho không đủ
//   if (!product.length || product[0].so_luong_kho < quantity) {
//     throw new Error('Số lượng sản phẩm không đủ trong kho để cập nhật');
//   }

//   const sql = `
//     UPDATE gio_hang 
//     SET so_luong = ? 
//     WHERE id_nguoi_dung = ? AND id_san_pham = ?`;
//   const [result] = await db.query(sql, [quantity, userId, productId]);

//   if (result.affectedRows === 0) {
//     // Nếu sản phẩm chưa tồn tại => Thêm mới
//     return await addItemToCart(userId, productId, quantity);
//   }
//   return result;
// };


module.exports = {
  getCartUserID,
  getCartItem,
  addItemToCart,
  updateCartItemQuantity,
  deleteItem,
  clearCart,
};
