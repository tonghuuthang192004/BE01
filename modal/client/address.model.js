const db = require('../../config/database');
const fs = require('fs');
const axios = require('axios');

exports.getAddresses = async (userId) => {
  const [rows] = await db.execute(
    'SELECT * FROM dia_chi WHERE  deleted=0 AND id_nguoi_dung = ?',
    [userId]
  );
  return rows;
};

exports.addAddress = async (data) => {
  const { id_nguoi_dung, ten_nguoi_dung, so_dien_thoai, dia_chi_day_du } = data;
  await db.execute(
    `INSERT INTO dia_chi (id_nguoi_dung, ten_nguoi_dung, so_dien_thoai, dia_chi_day_du, mac_dinh)
     VALUES (?, ?, ?, ?, 0)`,
    [id_nguoi_dung, ten_nguoi_dung, so_dien_thoai, dia_chi_day_du]
  );
};

exports.updateAddress = async (id, data) => {
  const { ten_nguoi_dung, so_dien_thoai, dia_chi_day_du } = data;
  await db.execute(
    `UPDATE dia_chi
     SET ten_nguoi_dung = ?, so_dien_thoai = ?, dia_chi_day_du = ?
     WHERE id = ?`,
    [ten_nguoi_dung, so_dien_thoai, dia_chi_day_du, id]
  );
};

exports.deleteAddress = async (id) => {
  await db.execute('UPDATE dia_chi SET deleted=1 Where id= ?', [id]);
};

exports.setDefaultAddress = async (userId, addressId) => {
  // Reset all addresses to mac_dinh = 0
  await db.execute(
    'UPDATE dia_chi SET mac_dinh = 0 WHERE id_nguoi_dung = ?',
    [userId]
  );
  // Set selected address to mac_dinh = 1
  await db.execute(
    'UPDATE dia_chi SET mac_dinh = 1 WHERE id = ? AND id_nguoi_dung = ?',
    [addressId, userId]
  );
};



// const GOOGLE_API_KEY = 'AIzaSyAf7gz1NJpDaldW0srTH2ElMK_0SxFfLS8';
// const geocodeUrl = 'https://maps.googleapis.com/maps/api/geocode/json';

// // Hàm để ghi dữ liệu vào file
// const writeToFile = (data) => {
//   fs.writeFile('../../aaaa.json', JSON.stringify(data, null, 2), (err) => {
//     if (err) {
//       console.error('Lỗi khi ghi file:', err);
//     } else {
//       console.log('Dữ liệu đã được ghi vào file geocode_results.json');
//     }
//   });
// };

// // Hàm geocode - chuyển địa chỉ thành tọa độ
// const geocodeAddress = async (address) => {
//   try {
//     const response = await axios.get(geocodeUrl, {
//       params: {
//         address: address,
//         key: GOOGLE_API_KEY,
//       },
//     });

//     if (response.data.status === 'OK') {
//       const location = response.data.results[0]?.geometry.location;
//       console.log('Latitude:', location.lat);
//       console.log('Longitude:', location.lng);

//       // Ghi kết quả vào file
//       writeToFile({
//         address: address,
//         latitude: location.lat,
//         longitude: location.lng,
//       });
//     } else {
//       console.log('Không tìm thấy kết quả cho địa chỉ:', address);
//     }
//   } catch (error) {
//     console.error('Lỗi khi gọi Google Maps API:', error);
//   }
// };
// module.exports={
//   geocodeAddress
// }