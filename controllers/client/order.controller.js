
  const orderModel = require('../../modal/client/order.model');
  const cartModel = require('../../modal/client/cart.model');
  const crypto = require('crypto');
  const axios = require('axios');
  const db = require("../../config/database");
  const moment = require("moment");

const secretKey = 'K951B6PE1waDMi640xX08PD3vg6EkVlz'; // key test MoMo
const accessKey = 'F8BBA842ECF85'; // key test MoMo
  // 📥 Lấy danh sách đơn hàng
  module.exports.getOrdersByUser = async (req, res) => {
    try {
      const userId = req.user.id;
      const { status } = req.query;
      const orders = await orderModel.getOrdersByUserId(userId, status);

      res.json({ success: true, message: 'Danh sách đơn hàng', data: orders });
    } catch (err) {
      console.error('❌ Lỗi getOrdersByUser:', err);
      res.status(500).json({ success: false, message: 'Lỗi server lấy đơn hàng' });
    }
  };

  // 🔍 Xem chi tiết đơn hàng - chỉ trả về mảng chi tiết sản phẩm
module.exports.getOrderDetailByUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const orderId = req.params.id;

    // Thay vì gọi getProductsFromOrder, gọi đúng hàm lấy sản phẩm chi tiết
    const products = await orderModel.getOrderProductsByUser(orderId, userId);

    if (!products || products.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm trong đơn hàng hoặc không thuộc về bạn.' });
    }

    return res.json({
      success: true,
      message: 'Danh sách sản phẩm trong đơn hàng',
      data: products
    });
  } catch (err) {
    console.error('❌ Lỗi getOrderDetailByUser:', err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server lấy chi tiết đơn hàng'
    });
  }
};




module.exports.createOrderAndPay = async (req, res) => {
  const orderData = req.body;

  

  
  try {
      // =======================
    // ✅ TÍNH TỔNG GIÁ + GIẢM
    // =======================
 let tong_gia_truoc_giam = 0;

// for (const sp of orderData.chi_tiet_san_pham) {
//   const [rows] = await db.execute(`SELECT gia FROM san_pham WHERE id_san_pham = ?`, [sp.id_san_pham]);

//   if (rows.length === 0) {
//     return res.status(400).json({ message: `Sản phẩm với ID ${sp.id_san_pham} không tồn tại.` });
//   }

//   const gia = rows[0].gia;
//   sp.gia = gia; // gán lại để insert vào chi tiết đơn hàng
//   tong_gia_truoc_giam += gia * sp.so_luong;
// }
let gia_tri_giam = 0;

if (orderData.ma_giam_gia?.trim()) {
  const ma = orderData.ma_giam_gia.trim();

  const [rows] = await db.execute(`
    SELECT * FROM giam_gia 
    WHERE ma_giam_gia = ? AND deleted = 0 AND trang_thai = 'active'
  `, [ma]);

  const giamGia = rows[0];
  if (!giamGia) return res.status(400).json({ message: 'Mã giảm giá không hợp lệ.' });

  const now = moment();

  if (now.isBefore(giamGia.ngay_bat_dau) || now.isAfter(giamGia.ngay_ket_thuc)) {
    return res.status(400).json({ message: 'Mã giảm giá đã hết hạn hoặc chưa bắt đầu.' });
  }

  if (giamGia.so_luong_con_lai <= 0) {
    return res.status(400).json({ message: 'Mã giảm giá đã hết lượt sử dụng.' });
  }

  if (tong_gia_truoc_giam < giamGia.dieu_kien) {
    return res.status(400).json({ message: `Đơn hàng phải từ ${giamGia.dieu_kien}đ để dùng mã.` });
  }

  // Tính giá trị giảm
  if (giamGia.loai === 'phan_tram') {
    gia_tri_giam = Math.floor(tong_gia_truoc_giam * giamGia.gia_tri / 100);
  } else {
    gia_tri_giam = giamGia.gia_tri;
  }

  // Trừ lượt
  await db.execute(`
    UPDATE giam_gia 
    SET so_luong_con_lai = so_luong_con_lai - 1 
    WHERE id_giam_gia = ?
  `, [giamGia.id_giam_gia]);

  // Gán id_giam_gia vào orderData để lưu đơn hàng
  orderData.id_giam_gia = giamGia.id_giam_gia;
}

// ✅ GÁN GIÁ TRỊ VÀO orderData
orderData.tong_gia_truoc_giam = tong_gia_truoc_giam;
orderData.gia_tri_giam = gia_tri_giam;
orderData.tong_gia = tong_gia_truoc_giam - gia_tri_giam;
    // 1. Tạo đơn hàng trong hệ thống
    const {orderId,momo_order_id} = await orderModel.createOrder(orderData);

    // 2. Nếu chọn thanh toán MoMo
    if (orderData.phuong_thuc_thanh_toan === 'momo') {
      const partnerCode = 'MOMO';
      const requestType = "payWithMethod";
      const amount = orderData.tong_gia.toString();
      const orderInfo = `Thanh toán đơn hàng #${orderId}`;
      const redirectUrl = 'https://webhook.site/b3088a6a-2d17-4f8d-a383-71389a6c600b';

  var ipnUrl = 'https://ee7c-113-185-64-1.ngrok-free.app/order/momo/callback';
      // const momoOrderId = 'MOMO_' + Date.now(); // orderId gửi MoMo
      const requestId = 'REQ_' + Date.now();
      const extraData = '';const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${momo_order_id}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

      const signature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');

      const requestBody = {
        partnerCode,
        partnerName: "YourStore",
        storeId: "Store001",
        requestId,
        amount,
        orderId: momo_order_id,
        orderInfo,
        redirectUrl,
        ipnUrl,
        lang: 'vi',
        requestType,
        autoCapture: true,
        extraData,
        orderGroupId: '',
        signature
      };

      const momoRes = await axios.post('https://test-payment.momo.vn/v2/gateway/api/create', requestBody, {
        headers: { 'Content-Type': 'application/json' }
      });

      if (momoRes.data.resultCode !== 0) {
        // Xoá đơn hàng nếu MoMo tạo thất bại
        await orderModel.deleteOrder(orderId);
        return res.status(400).json({
          message: 'Tạo yêu cầu thanh toán MoMo thất bại.',
          momoResponse: momoRes.data
        });
      }

      return res.status(200).json({
        message: 'Đơn hàng được tạo thành công. Vui lòng thanh toán qua MoMo.',
        orderId,
        payUrl: momoRes.data.payUrl,
        momoResponse: momoRes.data
      });
    }

    // 3. Nếu chọn COD
    if (orderData.phuong_thuc_thanh_toan === 'cod') {
      return res.status(201).json({
        message: 'Đơn hàng được tạo thành công. Phương thức thanh toán COD đã được ghi nhận.',
        orderId
      });
    }

    // 4. Phương thức không hợp lệ
    return res.status(400).json({ message: 'Phương thức thanh toán không hợp lệ.' });

  } catch (err) {
    console.error('❌ Lỗi khi tạo đơn hàng hoặc thanh toán:', err.message);
    return res.status(500).json({
      message: 'Có lỗi xảy ra khi tạo đơn hàng.',
      error: err.message
    });
  }
};
  // 🗑️ Huỷ đơn hàng
  module.exports.cancelOrderByUser = async (req, res) => {
    try {
      const userId = req.user.id;
      const orderId = req.params.id;

      const success = await orderModel.cancelOrderByUser(orderId, userId);
      if (!success) {
        return res.status(400).json({ success: false, message: 'Không thể huỷ đơn hàng này.' });
      }

      res.json({ success: true, message: 'Huỷ đơn hàng thành công.' });
    } catch (err) {
      console.error('❌ Lỗi cancelOrderByUser:', err);
      res.status(500).json({ success: false, message: 'Lỗi server khi huỷ đơn hàng.' });
    }
  };

  // 🔄 Mua lại đơn hàng
  module.exports.reorder = async (req, res) => {
    try {
      const userId = req.user.id;
      const orderId = req.params.id;

      const items = await orderModel.getProductsFromOrder(orderId, userId);
      if (!items.length) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng hoặc không thuộc về bạn.' });
      }

      const cart = await cartModel.createCart(userId);
      for (const item of items) {
        await cartModel.addItemToCart(cart.id_gio_hang, item.id_san_pham, item.so_luong);
      }

      res.json({ success: true, message: 'Sản phẩm đã được thêm lại vào giỏ hàng.' });
    } catch (err) {
      console.error('❌ Lỗi reorder:', err);
      res.status(500).json({ success: false, message: 'Lỗi khi mua lại đơn hàng.' });
    }
  };

  // ⭐ Đánh giá sản phẩm
 module.exports.reviewProduct = async (req, res) => {
  try {
    const userId = req.user.id;
    const productId = req.params.id;
    const { diem_so, nhan_xet } = req.body;

    // Validate đầu vào ngay controller, tránh gọi hàm addReview khi dữ liệu sai
    if (!diem_so || diem_so < 1 || diem_so > 5) {
      return res.status(400).json({ success: false, message: 'Điểm số phải từ 1 đến 5' });
    }
    if (!nhan_xet || nhan_xet.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập nhận xét' });
    }

    await orderModel.addReview(productId, userId, diem_so, nhan_xet.trim());

    res.json({ success: true, message: 'Đánh giá thành công.' });
  } catch (err) {
    console.error('❌ Lỗi reviewProduct:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};


module.exports.callback = async (req, res) => {
  console.log("📥 [MoMo Callback] Dữ liệu nhận được:", req.body);
  res.send('ok')
  // const {
  //   orderId,    // momo_order_id
  //   amount,
  //   resultCode,
  //   message,
  //   transId,
  // } = req.body;

  // if (!orderId) {
  //   return res.status(200).json({
  //     success: false,
  //     message: "❌ Thiếu orderId trong dữ liệu callback"
  //   });
  // }

  // try {
  //   if (resultCode === 0) {
  //     // 🔍 1. Tìm đơn hàng
  //     const [orders] = await db.query(
  //       'SELECT * FROM don_hang WHERE momo_order_id = ?',
  //       [orderId]
  //     );

  //     if (!orders.length) {
  //       console.warn(`⚠️ Không tìm thấy đơn hàng với momo_order_id: ${orderId}`);
  //       return res.status(200).json({
  //         success: false,
  //         message: "❌ Không tìm thấy đơn hàng"
  //       });
  //     }

  //     const order = orders[0];
  //     const idDonHang = order.id_don_hang;

  //     // ✅ Kiểm tra số tiền MoMo trả có khớp không
  //     if (parseInt(amount) !== parseInt(order.tong_gia)) {
  //       console.error(`❌ Số tiền không khớp. MoMo gửi: ${amount}, hệ thống: ${order.tong_gia}`);
  //       return res.status(200).json({
  //         success: false,
  //         message: "❌ Số tiền thanh toán không khớp"
  //       });
  //     }

  //     // 💳 2. Xử lý thanh toán
  //     const [existing] = await db.query(
  //       'SELECT * FROM thanh_toan WHERE id_don_hang = ? AND phuong_thuc = ?',
  //       [idDonHang, 'MoMo']
  //     );

  //     if (!existing.length) {
  //       await db.query(
  //         `INSERT INTO thanh_toan
  //         (id_don_hang, so_tien, phuong_thuc, trang_thai, ngay_thanh_toan)
  //         VALUES (?, ?, 'MoMo', 'Đã thanh toán', NOW())`,
  //         [idDonHang, amount]
  //       );
  //       console.log('✅ Insert thanh toán MoMo');
  //     } else {
  //       await db.query(
  //         `UPDATE thanh_toan
  //         SET trang_thai = 'Đã thanh toán', ngay_thanh_toan = NOW()
  //         WHERE id_don_hang = ? AND phuong_thuc = 'MoMo'`,
  //         [idDonHang]
  //       );
  //       console.log('🔁 Update thanh toán MoMo');
  //     }

  //     // 📦 3. Cập nhật đơn hàng
  //     await db.query(
  //       `UPDATE don_hang
  //       SET trang_thai = ?, trang_thai_thanh_toan = ?, phuong_thuc_thanh_toan = ?
  //       WHERE id_don_hang = ?`,
  //       ['Đã giao', 'Đã thanh toán', 'MoMo', idDonHang]
  //     );
  //     console.log('📦 Đã cập nhật trạng thái đơn hàng');

  //     // 📝 4. Lưu lịch sử đơn hàng
  //     await db.query(
  //       `INSERT INTO lich_su_don_hang (id_don_hang, thoi_gian, trang_thai, mo_ta)
  //       VALUES (?, NOW(), ?, ?)` ,
  //       [idDonHang, 'Đã giao', 'Thanh toán MoMo thành công']
  //     );
  //     console.log('📝 Đã lưu lịch sử đơn hàng');

  //     // 🗑️ 5. Xóa giỏ hàng sau khi thanh toán thành công
  //     await db.query(
  //       'DELETE FROM gio_hang WHERE id_nguoi_dung = ?',
  //       [order.id_nguoi_dung]
  //     );
  //     console.log('🗑️ Giỏ hàng của người dùng đã bị xóa sau khi thanh toán thành công');

  //     return res.status(200).json({
  //       success: true,
  //       message: "✅ Đã xử lý callback MoMo thành công, giỏ hàng đã được xóa"
  //     });
  //   } else {
  //     // ❌ Xử lý trường hợp thanh toán thất bại
  //     console.warn(`❌ Thanh toán thất bại từ MoMo. resultCode=${resultCode}, message=${message}`);

  //     // 🗑️ Xóa đơn hàng nếu thanh toán thất bại
  //     const [orders] = await db.query(
  //       'SELECT * FROM don_hang WHERE momo_order_id = ?',
  //       [orderId]
  //     );

  //     if (orders.length) {
  //       const order = orders[0];
  //       const idDonHang = order.id_don_hang;

  //       // Xóa đơn hàng trong cơ sở dữ liệu
  //       await db.query('DELETE FROM don_hang WHERE id_don_hang = ?', [idDonHang]);
  //       console.log(`🗑️ Đơn hàng ${idDonHang} đã bị xóa do thanh toán thất bại.`);
  //     }

  //     return res.status(200).json({
  //       success: false,
  //       message: `❌ Thanh toán thất bại từ MoMo: ${message}`,
  //       resultCode
  //     });
  //   }
  // } catch (error) {
  //   console.error('❌ Lỗi xử lý callback MoMo:', error);
  //   return res.status(200).json({
  //     success: false,
  //     message: "❌ Lỗi server khi xử lý callback MoMo",
  //     error: error.message
  //   });
  //  }
};

  // 📥 Lấy tất cả đánh giá
  module.exports.getReviews = async (req, res) => {
    try {
      const productId = req.params.id;
      const reviews = await orderModel.getReviewsByProductId(productId);

      res.status(200).json({
        success: true,
        message: 'Danh sách đánh giá',
        data: reviews
      });
    } catch (err) {
      console.error('❌ Lỗi getReviews:', err);
      res.status(500).json({ success: false, message: 'Lỗi lấy đánh giá.' });
    }
  };

  // 📥 Lấy lịch sử đơn hàng của user
module.exports.getOrderHistoriesByUser = async (req, res) => {
  try {
    console.log('📌 [getOrderHistoriesByUser] req.user:', req.user);

    if (!req.user || !req.user.id) {
      console.error('❌ Middleware không gắn user hoặc token sai');
      return res.status(401).json({
        success: false,
        message: 'Chưa đăng nhập hoặc token không hợp lệ'
      });
    }

    const userId = req.user.id;

    // 📥 Lấy status từ query params
    const status = req.query.status;
    console.log('📥 [getOrderHistoriesByUser] Filter trạng thái:', status);

    // Gọi model với userId và status
    const histories = await orderModel.getOrderHistoriesByUser(userId, status);

    console.log('📦 [getOrderHistoriesByUser] Dữ liệu trả về:', histories);

    return res.status(200).json({
      success: true,
      message: 'Danh sách lịch sử đơn hàng',
      data: histories
    });

  } catch (err) {
    console.error('❌ [getOrderHistoriesByUser] Lỗi server:', err.message);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy lịch sử đơn hàng'
    });
  }
};
