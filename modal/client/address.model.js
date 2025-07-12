const db = require('../../config/database');
const fs = require('fs');
const axios = require('axios');

exports.getAddresses = async (userId) => {
  const [rows] = await db.execute(
    `SELECT * FROM dia_chi 
     WHERE id_nguoi_dung = ? AND deleted = 0`,
    [userId]
  );
  return rows;
};


// ➕ Thêm địa chỉ mới
exports.addAddress = async (data) => {
  const {
    id_nguoi_dung,
    ten_nguoi_dung,
    so_dien_thoai,
    dia_chi_day_du,
    mac_dinh = 0
  } = data;

  const macDinhInt = parseInt(mac_dinh) || 0;
  console.log('🎯 Giá trị mac_dinh ép kiểu:', macDinhInt);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    console.log('🚀 Bắt đầu transaction');

    if (macDinhInt === 1) {
      console.log(`🔄 Reset địa chỉ mặc định cũ của user ${id_nguoi_dung}`);
      await conn.execute(
        `UPDATE dia_chi
         SET mac_dinh = 0
         WHERE id_nguoi_dung = ? AND deleted = 0`,
        [id_nguoi_dung]
      );
      console.log('✅ Đã reset địa chỉ mặc định cũ');
    }

    console.log('➕ Thêm địa chỉ mới vào DB');
    await conn.execute(
      `INSERT INTO dia_chi
       (id_nguoi_dung, ten_nguoi_dung, so_dien_thoai, dia_chi_day_du, mac_dinh, deleted)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [
        id_nguoi_dung,
        ten_nguoi_dung,
        so_dien_thoai,
        dia_chi_day_du,
        macDinhInt
      ]
    );
    console.log(`✅ Đã thêm địa chỉ mới (mac_dinh=${macDinhInt})`);

    await conn.commit();
    console.log('🎉 Commit thành công');
  } catch (error) {
    await conn.rollback();
    console.error('❌ Lỗi khi thêm địa chỉ, rollback:', error);
    throw error;
  } finally {
    conn.release();
    console.log('🔚 Đóng kết nối DB');
  }
};





exports.updateAddress = async (id, data) => {
  const {
    ten_nguoi_dung,
    so_dien_thoai,
    dia_chi_day_du,
    mac_dinh = 0
  } = data;

  const macDinhInt = parseInt(mac_dinh) || 0;
  console.log('🎯 Giá trị mac_dinh ép kiểu:', macDinhInt);

  if (macDinhInt === 1) {
    console.log(`🔄 Reset địa chỉ mặc định cũ cho user chứa địa chỉ ID=${id}`);
    await db.execute(
      `UPDATE dia_chi
       SET mac_dinh = 0
       WHERE id_nguoi_dung = (
         SELECT id_nguoi_dung FROM dia_chi WHERE id = ?
       ) AND deleted = 0`,
      [id]
    );
    console.log('✅ Đã reset địa chỉ mặc định cũ');
  }

  console.log('✏️ Cập nhật địa chỉ mới vào DB');
  await db.execute(
    `UPDATE dia_chi
     SET ten_nguoi_dung = ?, so_dien_thoai = ?, dia_chi_day_du = ?, mac_dinh = ?
     WHERE id = ? AND deleted = 0`,
    [ten_nguoi_dung, so_dien_thoai, dia_chi_day_du, macDinhInt, id]
  );
  console.log(`✅ Đã cập nhật địa chỉ (mac_dinh=${macDinhInt})`);
};


exports.deleteAddress = async (id) => {
  // 🔥 Check xem địa chỉ có phải mặc định không
  const [rows] = await db.execute(
    `SELECT mac_dinh FROM dia_chi WHERE id = ? AND deleted = 0`,
    [id]
  );

  if (rows.length === 0) {
    throw new Error('Địa chỉ không tồn tại hoặc đã bị xóa');
  }

  if (rows[0].mac_dinh === 1) {
    throw new Error('Không thể xóa địa chỉ mặc định. Vui lòng chọn địa chỉ mặc định khác trước.');
  }

  // ✅ Nếu không phải mặc định → cho phép xóa (ẩn)
  await db.execute(
    `UPDATE dia_chi
     SET deleted = 1
     WHERE id = ?`,
    [id]
  );
};



// ⭐ Đặt địa chỉ mặc định
exports.setDefaultAddress = async (userId, addressId) => {
  // Reset các địa chỉ cũ về mac_dinh = 0
  await db.execute(
    `UPDATE dia_chi
     SET mac_dinh = 0
     WHERE id_nguoi_dung = ? AND deleted = 0`,
    [userId]
  );

  // Set địa chỉ mới được chọn thành mặc định
  await db.execute(
    `UPDATE dia_chi
     SET mac_dinh = 1
     WHERE id = ? AND id_nguoi_dung = ? AND deleted = 0`,
    [addressId, userId]
  );
};

