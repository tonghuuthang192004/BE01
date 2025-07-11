const productModel = require('../../modal/client/product.model');

// 🟢 Lấy tất cả sản phẩm
const getAllProducts = async (req, res) => {
    try {
        const data = await productModel.getAllProducts();


        res.json({
            success: true,
            message: 'Lấy danh sách sản phẩm thành công',
            data
        });
    } catch (error) {
        console.error('❌ Lỗi khi lấy tất cả sản phẩm:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};


// 🔥 Lấy sản phẩm HOT
const getHotProducts = async (req, res) => {
    try {
        const data = await productModel.getHotProducts();
        res.json({
            success: true,
            message: 'Lấy danh sách sản phẩm HOT thành công',
            data
        });
    } catch (error) {
        console.error('❌ Lỗi khi lấy sản phẩm hot:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// 📦 Lấy chi tiết sản phẩm theo ID
const getProductById = async (req, res) => {
    try {
        const { id } = req.params;
        const data = await productModel.getProductById(id);

        if (!data) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
        }

        // 🚫 Check trạng thái sản phẩm
        if (data.trang_thai === 'Đã hủy') {
            return res.status(200).json({
                success: true,
                message: 'Sản phẩm đã hết hàng',
                data,
                canOrder: false // 👈 Thêm flag để frontend biết ẩn nút đặt hàng
            });
        }

        res.json({
            success: true,
            message: 'Lấy chi tiết sản phẩm thành công',
            data,
            canOrder: true // 👈 Cho phép đặt hàng
        });
    } catch (error) {
        console.error('❌ Lỗi khi lấy chi tiết sản phẩm:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};


// 🛍️ Lấy sản phẩm theo danh mục
const getProductsByCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const data = await productModel.getProductsByCategoryId(id);

        res.json({
            success: true,
            message: 'Lấy sản phẩm theo danh mục thành công',
            data
        });
    } catch (error) {
        console.error('❌ Lỗi khi lấy sản phẩm theo danh mục:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// ✅ Lấy sản phẩm liên quan
const getRelatedProducts = async (req, res) => {
    try {
        const { categoryId, productId } = req.params;
        const data = await productModel.getRelatedProducts(categoryId, productId);

        res.json({
            success: true,
            message: 'Lấy sản phẩm liên quan thành công',
            data
        });
    } catch (error) {
        console.error('❌ Lỗi lấy sản phẩm liên quan:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};
// const stock  = async (req, res) => {
//     try {
//         const { id_san_pham } = req.params;
//         const data = await productModel.stock(id_san_pham);

//         res.json({
//             success: true,
//             message: 'Lấy sản phẩm liên quan thành công',
//             data
//         });
//     } catch (error) {
//         console.error('❌ Lỗi lấy sản phẩm liên quan:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Internal server error'
//         });
//     }
// };

const searchProducts = async (req, res) => {
    try {
        const { keyword } = req.query;

        if (!keyword || keyword.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập từ khóa tìm kiếm'
            });
        }

        const data = await productModel.searchProducts(keyword);

        res.json({
            success: true,
            message: `Tìm kiếm sản phẩm với từ khóa "${keyword}" thành công`,
            data
        });
    } catch (error) {
        console.error('❌ Lỗi khi tìm kiếm sản phẩm:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    getAllProducts,
    getHotProducts,
    getProductById,
    getProductsByCategory,
    getRelatedProducts,
    searchProducts,
};
