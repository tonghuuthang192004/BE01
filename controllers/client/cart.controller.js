const cartModel = require('../../modal/client/cart.model');
const db=require('../../config/database')
// 📦 Lấy giỏ hàng của user
module.exports.getUserCart = async (req, res) => {
  try {
    const userId = req.user.id;
  
   // console.log(userId)
    const cart = await cartModel.getCartUserID(userId);

    if (!cart) {
      return res.status(200).json({ success: true, data: [], message: "Giỏ hàng trống" });
    }

    const items = await cartModel.getCartItem(userId);
    res.status(200).json({ success: true, data: items });
  } catch (error) {
    console.error('❌ [getUserCart] Error:', error.message);
    res.status(500).json({ success: false, message: "Lỗi server khi lấy giỏ hàng" });
  }
};
// Kiểm tra giỏ hàng và tạo nếu chưa tồn tại
const checkOrCreateCart = async (userId) => {
  try {
    const [cart] = await db.query('SELECT * FROM gio_hang WHERE id_nguoi_dung = ?', [userId]);
    
    if (cart.length === 0) {
      // Nếu giỏ hàng không tồn tại, tạo giỏ hàng mới
      const [createResult] = await db.query('INSERT INTO gio_hang (id_nguoi_dung) VALUES (?)', [userId]);
      console.log('Giỏ hàng mới đã được tạo cho người dùng:', userId);
      return createResult;
    }

    return cart[0]; // Trả về giỏ hàng nếu đã tồn tại
  } catch (error) {
    console.error('Error in checkOrCreateCart:', error.message);
    throw new Error("Lỗi khi kiểm tra hoặc tạo giỏ hàng.");
  }
};


// ➕ Thêm sản phẩm vào giỏ
module.exports.addItemToCart = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('User ID:', userId);

    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    const { id_san_pham, so_luong } = req.body;

    // Kiểm tra nếu thiếu id_san_pham hoặc so_luong
    if (!id_san_pham || so_luong === undefined) {
      return res.status(400).json({ success: false, message: "Thiếu id_san_pham hoặc so_luong" });
    }

    // Kiểm tra và tạo giỏ hàng nếu chưa tồn tại
    const cart = await checkOrCreateCart(userId);

    // Thêm hoặc cập nhật sản phẩm vào giỏ hàng mà không cần kiểm tra kho
    const result = await cartModel.addItemToCart(userId, id_san_pham, so_luong);

    let message;
    if (result.type === 'insert') {
      message = "Đã thêm sản phẩm vào giỏ";
    } else if (result.type === 'update') {
      message = "Đã cập nhật số lượng sản phẩm";
    } else if (result.type === 'restore') {
      message = "Đã khôi phục và thêm lại sản phẩm vào giỏ";
    }

    res.status(result.type === 'insert' ? 201 : 200).json({
      success: true,
      message,
      quantity: result.quantity
    });

  } catch (error) {
    console.error('❌ [addItemToCart] Error:', error.message);
    res.status(500).json({ success: false, message: "Lỗi server khi thêm sản phẩm vào giỏ" });
  }
};


module.exports.updateItemQuantity = async (req, res) => {
  try {
    const userId = req.user.id;
    const id_san_pham = req.params.id_san_pham;
    const so_luong = req.body.so_luong;

    if (!id_san_pham || so_luong === undefined) {
      return res.status(400).json({ success: false, message: "Thiếu id_san_pham hoặc so_luong" });
    }

    // Kiểm tra giỏ hàng của người dùng
    const cart = await checkOrCreateCart(userId);

    // Cập nhật sản phẩm trong giỏ hàng mà không cần kiểm tra số lượng kho
    const result = await cartModel.updateCartItemQuantity(userId, id_san_pham, so_luong);

    res.status(200).json({
      success: true,
      message: result.added
        ? "Đã thêm mới sản phẩm vào giỏ vì trước đó không tồn tại hoặc đã bị xoá"
        : "Cập nhật số lượng thành công"
    });
  } catch (error) {
    console.error('❌ [updateItemQuantity] Error:', error.message);
    res.status(500).json({ success: false, message: "Lỗi server khi cập nhật số lượng" });
  }
};


// ❌ Xoá 1 sản phẩm khỏi giỏ (soft-delete)
module.exports.deleteItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const id_san_pham = req.params.id_san_pham;

    if (!id_san_pham) {
      return res.status(400).json({ success: false, message: "Thiếu id_san_pham" });
    }

    const cart = await cartModel.getCartUserID(userId);
    if (!cart) {
      return res.status(404).json({ success: false, message: "Không tìm thấy giỏ hàng" });
    }

    const result = await cartModel.deleteItem(userId, id_san_pham);

    if (result.affectedRows > 0) {
      res.status(200).json({ success: true, message: "Đã xoá sản phẩm (soft-delete)" });
    } else {
      res.status(404).json({ success: false, message: "Sản phẩm không tồn tại trong giỏ" });
    }
  } catch (error) {
    console.error('❌ [deleteItem] Error:', error.message);
    res.status(500).json({ success: false, message: "Lỗi server khi xoá sản phẩm" });
  }
};

// 🧹 Xoá toàn bộ giỏ hàng (soft-delete)
module.exports.clearCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const cart = await cartModel.getCartUserID(userId);

    if (!cart) {
      return res.status(404).json({ success: false, message: "Không tìm thấy giỏ hàng" });
    }

    const result = await cartModel.clearCart(userId);

    res.status(200).json({
      success: true,
      message: result.affectedRows > 0
        ? "Đã xoá toàn bộ giỏ hàng (soft-delete)"
        : "Giỏ hàng đã trống"
    });
  } catch (error) {
    console.error('❌ [clearCart] Error:', error.message);
    res.status(500).json({ success: false, message: "Lỗi server khi xoá giỏ hàng" });
  }
};

// ♻️ Khôi phục 1 sản phẩm đã xoá
module.exports.restoreItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const id_san_pham = req.params.id_san_pham;
    const so_luong = req.body.so_luong || 1; // mặc định 1 nếu không truyền

    if (!id_san_pham) {
      return res.status(400).json({ success: false, message: "Thiếu id_san_pham" });
    }

    const cart = await cartModel.getCartUserID(userId);
    if (!cart) {
      return res.status(404).json({ success: false, message: "Không tìm thấy giỏ hàng" });
    }

    const result = await cartModel.restoreCartItem(cart.id_gio_hang, id_san_pham, so_luong);

    if (result.affectedRows > 0) {
      res.status(200).json({ success: true, message: "Đã khôi phục sản phẩm vào giỏ" });
    } else {
      res.status(404).json({ success: false, message: "Sản phẩm không tồn tại để khôi phục" });
    }
  } catch (error) {
    console.error('❌ [restoreItem] Error:', error.message);
    res.status(500).json({ success: false, message: "Lỗi server khi khôi phục sản phẩm" });
  }
};
