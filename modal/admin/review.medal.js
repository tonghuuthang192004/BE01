const db=require('../../config/database');
const getAllReview = async (filters) => {
  let sql = `
    SELECT 
      san_pham.ten,
      nguoi_dung.email,
      nguoi_dung.ten,
      danh_gia_san_pham.diem_so,
      danh_gia_san_pham.diem_so,
      danh_gia_san_pham.ngay_danh_gia,
      danh_gia_san_pham.trang_thai
    FROM 
      san_pham
    INNER JOIN 
      danh_gia_san_pham ON san_pham.id_san_pham = danh_gia_san_pham.id_san_pham
    INNER JOIN 
      nguoi_dung ON danh_gia_san_pham.id_nguoi_dung = nguoi_dung.id_nguoi_dung
    WHERE 
      1=1  -- This is a workaround to handle dynamic WHERE conditions easily
  `;

  const params = [];

  // Apply filters based on the filters object
  if (filters.deleted !== undefined) {
    sql += ' AND danh_gia_san_pham.deleted = ?';
    params.push(filters.deleted);
  }

  if (filters.status !== undefined && filters.status !== '') {
    sql += ' AND danh_gia_san_pham.trang_thai = ?';
    params.push(filters.status);
  }

  if (filters.search !== undefined && filters.search !== '') {
    sql += ' AND LOWER(nguoi_dung.ten) LIKE ?';
    params.push(`%${filters.search.toLowerCase()}%`);
  }

  // Apply order and pagination
  sql += ' ORDER BY danh_gia_san_pham.id_danh_gia ASC';

  if (filters.limit !== undefined && filters.offset !== undefined) {
    sql += ' LIMIT ? OFFSET ?';
    params.push(filters.limit, filters.offset);
  }

  console.log('SQL:', sql); // Debugging the SQL query
  console.log('Params:', params); // Debugging the query params

  const [rows] = await db.query(sql, params);
  return rows;
};


// update 1 trạng thái
const updateProductStatus = async (id, newStatus) => {
  const sql = 'UPDATE danh_gia_san_pham SET trang_thai = ? WHERE id_danh_gia = ?';
  const [result] = await db.query(sql, [newStatus, id]);
  return result;
};

// update Status nhìu sản phẩm
const updateProductsStatusMulti = async (ids, newStatus) => {
  if (!ids || ids.length === 0) {
    throw new Error('Danh sách ids rỗng');
  }

  // Tạo chuỗi dấu hỏi ? cho số phần tử trong mảng ids
  const placeholders = ids.map(() => '?').join(','); // vd: "?,?,?"
  const sql = `UPDATE danh_gia_san-pham SET trang_thai = ? WHERE id_danh_gia IN (${placeholders})`;

  // Tham số truyền cho query: newStatus + từng id
  const params = [newStatus, ...ids];

  const [result] = await db.query(sql, params);
  return result;
};

// xóa 1 sản phẩm
const deleteItem = async (id) => {
  const [reslut] = await db.query('UPDATE danh_gia_san_pham SET deleted=1 where id_danh_gia=?', [id])
  return reslut

}

// xóa nhìu sản phẩm
const deleteAll = async (ids) => {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error('Danh sách ID không hợp lệ');
  }

  const placeholders = ids.map(() => '?').join(', ');
  const sql = `UPDATE danh_gia_san_pham SET deleted = 1  WHERE id_danh_gia IN (${placeholders})`;

  const [result] = await db.execute(sql, ids);
  return result;
}



module.exports={
    getAllReview,
    updateProductStatus,
    updateProductsStatusMulti,
    deleteItem,
    deleteAll,
}